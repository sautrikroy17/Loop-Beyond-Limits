import { createServerFn } from "@tanstack/react-start";
import ytdl from "@distube/ytdl-core";

/**
 * Resolves a streamable audio URL for a given YouTube video ID.
 *
 * Strategy (server-side — no CORS, no bot detection issues):
 * 1. Try multiple Piped API instances (open-source YouTube frontend)
 *    Piped proxies the audio through its own servers with CORS enabled,
 *    so the browser can fetch the returned URL directly.
 * 2. Fall back to ytdl-core (direct YouTube CDN URL)
 */
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://piped-api.garudalinux.org",
  "https://api.piped.yt",
  "https://pipedapi.darkness.services",
];

export const resolveAudioUrlFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { id } = data;

    // ── Strategy 1: Piped API (fast, reliable, CORS-enabled audio proxy) ──
    for (const instance of PIPED_INSTANCES) {
      try {
        const res = await fetch(`${instance}/streams/${id}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;

        const json = (await res.json()) as any;
        const streams: any[] = json.audioStreams ?? [];
        if (!streams.length) continue;

        // Highest bitrate = best quality
        const best = [...streams].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
        if (best?.url) {
          console.log(`[Audio] Resolved via ${instance}`);
          return { url: best.url as string, mimeType: (best.mimeType as string) ?? "audio/webm" };
        }
      } catch (e) {
        console.warn(`[Audio] Piped ${instance} failed:`, e);
      }
    }

    // ── Strategy 2: ytdl-core direct URL ──────────────────────────────────
    try {
      const info = await ytdl.getInfo(`https://youtube.com/watch?v=${id}`);
      const format = ytdl.chooseFormat(info.formats, {
        filter: "audioonly",
        quality: "lowestaudio", // smaller file, faster download
      });
      if (format?.url) {
        console.log("[Audio] Resolved via ytdl");
        return { url: format.url, mimeType: format.mimeType ?? "audio/webm" };
      }
    } catch (e) {
      console.warn("[Audio] ytdl failed:", e);
    }

    return null;
  });
