/**
 * Loop Lyrics Service — Production-grade pipeline
 *
 * Strategy (parallel where possible, sequential fallbacks):
 *   1. lrclib.net /get  — raw title + raw artist           (fast path)
 *   2. lrclib.net /get  — fully sanitized title + primary artist
 *   3. lrclib.net /search — 3 query variants in parallel, scored by similarity
 *   4. lyrics.ovh       — plain lyrics fallback
 *   5. chartlyrics.com  — final XML fallback (no key)
 *
 * Title sanitization strips ALL parenthetical/bracket content, so:
 *   "Gehra Hua (From 'Dhurandhar')"  → "Gehra Hua"
 *   "APT. (feat. Bruno Mars)"        → "APT."
 *   "Blinding Lights (Official Audio)"→ "Blinding Lights"
 *   "Run It Up [Slowed + Reverb]"    → "Run It Up"
 *   "Love Story - Taylor's Version"  → "Love Story"
 */

import { createServerFn } from "@tanstack/react-start";

export interface LyricLine {
  time: number; // seconds
  text: string;
}

type LyricResult = { lines: LyricLine[]; plain: string | null };

// ── Server-side LRU cache ──────────────────────────────────────────

const _cache = new Map<string, { result: LyricResult; ts: number; negative: boolean }>();
const CACHE_MAX = 300;
const CACHE_TTL = 45 * 60 * 1000; // 45 min for positive results
const CACHE_NEG_TTL = 3 * 60 * 1000; //  3 min for negative (retry sooner)

function cacheGet(key: string): LyricResult | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  const ttl = entry.negative ? CACHE_NEG_TTL : CACHE_TTL;
  if (Date.now() - entry.ts > ttl) {
    _cache.delete(key);
    return null;
  }
  return entry.result;
}

function cacheSet(key: string, result: LyricResult, negative = false) {
  if (_cache.size >= CACHE_MAX) {
    const first = _cache.keys().next().value;
    if (first) _cache.delete(first);
  }
  _cache.set(key, { result, ts: Date.now(), negative });
}

// ── LRC parser ─────────────────────────────────────────────────────
// Handles both [mm:ss.xx] and [mm:ss:xx] and [mm:ss] formats.

function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  // Multi-format timestamp regex
  const regex = /\[(\d{1,2}):(\d{2})[.:](\d{2,3})\]([^\[]*)/g;
  let match;
  while ((match = regex.exec(lrc)) !== null) {
    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    const frac = parseInt(match[3].padEnd(3, "0"), 10);
    const time = min * 60 + sec + frac / 1000;
    const text = match[4].trim();
    if (text) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

// ── Text normalisation ────────────────────────────────────────────

/**
 * Aggressively strip all decorative content from track titles.
 *
 * Rules (applied in order):
 *  1. Remove ALL content in parentheses:  (anything)
 *  2. Remove ALL content in brackets:     [anything]
 *  3. Remove dash-separated suffixes:     " - Official Video", " - Taylor's Version"
 *  4. Remove trailing junk words:         "lyrics", "hd", "4k"
 *  5. Normalise whitespace
 */
function sanitizeTitle(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, "") // strip ALL (...)
    .replace(/\[.*?\]/g, "") // strip ALL [...]
    .replace(
      /\s*[-–—]\s*(official|lyrics?|audio|video|hd|4k|live|remix|edit|cover|version|ft\.?|feat\.?|prod\.?|from\b|acoustic|slowed|reverb|sped\s*up|nightcore|extended).*/gi,
      "",
    )
    .replace(/\b(lyrics?|official|audio|video|hd|4k)\b/gi, "") // trailing noise words
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extract the primary artist, stripping everything that isn't a name:
 *  - Duration patterns:  "2:51"  → gone
 *  - Album names appended after artist in YTM metadata
 *  - Feat / collab suffixes
 *  - Parenthetical content
 */
function primaryArtist(raw: string): string {
  return (
    raw
      // Split camelCase merged names (e.g. 'The WeekndJENNIE' -> 'The Weeknd JENNIE')
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Remove duration patterns like "2:51" or "3:05:12"
      .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, "")
      // Remove feat./ft. and everything after
      .replace(/\s*(feat\.?|ft\.?|x|with|and|&)\s+.*/i, "")
      // Split on comma/semicolon, keep first segment
      .split(/[,;]/)[0]
      // Remove parenthetical content
      .replace(/\s*\(.*?\)\s*/g, "")
      .replace(/\s*\[.*?\]\s*/g, "")
      // Remove isolated numbers / isolated capital words that look like album names
      // (e.g., "Justice" after "Justin Bieber Justice")
      // Strategy: keep only the first 2–3 words if the string is long
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 3) // max 3 words for an artist name
      .join(" ")
      .trim()
  );
}

// ── Similarity scorer (trigram-based) ─────────────────────────────

function trigrams(s: string): Set<string> {
  const n = s.toLowerCase().replace(/\s+/g, " ");
  const g = new Set<string>();
  for (let i = 0; i < n.length - 2; i++) g.add(n.slice(i, i + 3));
  return g;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ga = trigrams(a);
  const gb = trigrams(b);
  let inter = 0;
  for (const t of ga) if (gb.has(t)) inter++;
  return (2 * inter) / (ga.size + gb.size);
}

// ── HTTP helpers ──────────────────────────────────────────────────

const LRCLIB_HEADERS = { "Lrclib-Client": "Loop/2.0 (https://loop.fm)" };
const TIMEOUT = 1500; // ms — strict timeout to prevent cascade hangs

async function lrclibGet(title: string, artist: string, duration?: number): Promise<any> {
  const p = new URLSearchParams({ track_name: title, artist_name: artist });
  if (duration) p.set("duration", String(Math.round(duration)));
  const res = await fetch(`https://lrclib.net/api/get?${p}`, {
    headers: LRCLIB_HEADERS,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function lrclibSearch(q: string): Promise<any[]> {
  const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
    headers: LRCLIB_HEADERS,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function lrclibSearchByFields(title: string, artist: string): Promise<any[]> {
  const p = new URLSearchParams({ track_name: title, artist_name: artist });
  const res = await fetch(`https://lrclib.net/api/search?${p}`, {
    headers: LRCLIB_HEADERS,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function fetchOvhLyrics(artist: string, title: string): Promise<string | null> {
  const res = await fetch(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  );
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return typeof json?.lyrics === "string" && json.lyrics.trim() ? json.lyrics : null;
}

async function fetchChartLyrics(artist: string, title: string): Promise<string | null> {
  try {
    const url = `http://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return null;
    const xml = await res.text();
    const m = xml.match(/<Lyric>([\s\S]*?)<\/Lyric>/);
    return m?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

// ── Helpers to extract a clean result from an lrclib item ──────────

function extractItem(item: any): LyricResult | null {
  if (!item) return null;
  if (item.syncedLyrics?.trim()) {
    const lines = parseLrc(item.syncedLyrics);
    if (lines.length > 0) return { lines, plain: item.plainLyrics ?? null };
  }
  if (item.plainLyrics?.trim()) return { lines: [], plain: item.plainLyrics };
  return null;
}

/** Pick the best-matching item from a search result array */
function pickBest(items: any[], targetTitle: string, targetArtist: string): LyricResult | null {
  const tArtistLower = targetArtist.toLowerCase();

  const scored = items
    .map((item) => {
      const itemTitle = (item.trackName ?? "").toLowerCase();
      const itemArtist = (item.artistName ?? "").toLowerCase();

      const titleScore = similarity(itemTitle, targetTitle.toLowerCase());

      // Much more forgiving artist score: if any word matches, it's a huge boost
      let artistScore = similarity(itemArtist, tArtistLower);
      const tWords = tArtistLower.split(/[\s,;&]+/).filter((w) => w.length > 2);
      const iWords = itemArtist.split(/[\s,;&]+/).filter((w) => w.length > 2);

      const sharesWord = tWords.some((tw) =>
        iWords.some((iw) => tw.includes(iw) || iw.includes(tw)),
      );
      if (sharesWord) artistScore = Math.max(artistScore, 0.8);

      return {
        item,
        score: titleScore * 0.65 + artistScore * 0.35,
      };
    })
    .sort((a, b) => b.score - a.score);

  for (const { item, score } of scored) {
    if (score < 0.4) continue; // safety threshold
    const r = extractItem(item);
    if (r) return r;
  }
  return null;
}

// ── Main server function ───────────────────────────────────────────

export const getLyricsFn = createServerFn({ method: "GET" })
  .inputValidator((data: { title: string; artist: string; duration?: number }) => data)
  .handler(async ({ data }): Promise<LyricResult> => {
    const rawTitle = data.title;
    const rawArtist = data.artist;
    const dur = data.duration;

    const cleanTitle = sanitizeTitle(rawTitle);
    const cleanArtist = primaryArtist(rawArtist);

    // Cache key: v2 busts the cache for failed mobile requests
    const cacheKey = `v2|${cleanTitle.toLowerCase()}|${cleanArtist.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    // Helper: store and return
    const finish = (r: LyricResult): LyricResult => {
      cacheSet(cacheKey, r);
      return r;
    };
    const EMPTY: LyricResult = { lines: [], plain: null };

    // ── Fast path: exact /get with raw values ──────────────────────
    try {
      const j = await lrclibGet(rawTitle, rawArtist, dur);
      const r = extractItem(j);
      if (r) return finish(r);
    } catch {
      /* continue */
    }

    // ── Exact /get with sanitized values ──────────────────────────
    try {
      const j = await lrclibGet(cleanTitle, cleanArtist, dur);
      const r = extractItem(j);
      if (r) return finish(r);
    } catch {
      /* continue */
    }

    // ── Parallel search: 3 query variants + field search ──────────
    try {
      const variants = [
        lrclibSearch(`${cleanTitle} ${cleanArtist}`),
        lrclibSearch(cleanTitle),
        lrclibSearch(`${cleanArtist} ${cleanTitle}`),
        lrclibSearchByFields(cleanTitle, cleanArtist),
      ];
      const results = await Promise.allSettled(variants);
      // Merge all result arrays
      const allItems = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      if (allItems.length > 0) {
        const r = pickBest(allItems, cleanTitle, cleanArtist);
        if (r) return finish(r);
      }
    } catch {
      /* continue */
    }

    // ── lyrics.ovh plain fallback ──────────────────────────────────
    try {
      const plain = await fetchOvhLyrics(cleanArtist, cleanTitle);
      if (plain) return finish({ lines: [], plain });
    } catch {
      /* continue */
    }

    // ── chartlyrics.com XML fallback ───────────────────────────────
    try {
      const plain = await fetchChartLyrics(cleanArtist, cleanTitle);
      if (plain) return finish({ lines: [], plain });
    } catch {
      /* continue */
    }

    // All sources exhausted — negative cache with short TTL so user can retry
    cacheSet(cacheKey, EMPTY, /* negative= */ true);
    return EMPTY;
  });
