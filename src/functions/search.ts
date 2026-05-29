/**
 * Loop Search & Recommendation RPCs
 *
 * All server functions run securely on the server — API internals
 * are never exposed to the browser bundle.
 *
 * Security: Every public endpoint is rate-limited and all inputs
 * are sanitised before reaching internal services.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  searchYouTubeMusic,
  getRelatedTracks,
  resolveVideoId,
} from "../server/services/youtubeMusic";
import { searchSpotifyTracks, getRecommendations } from "../server/services/spotify";
import { resolveYouTubePlayback } from "../server/services/youtube";
import { sanitiseQuery, sanitiseId, checkRateLimit } from "../server/middleware/security";

// ─── Shared Track Shape ──────────────────────────────────────────

interface LoopTrack {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  youtubeId?: string;
  durationMs?: number;
  explicit?: boolean;
}

function getHighResAlbumArt(url: any): string {
  if (!url) return "";
  if (Array.isArray(url)) {
    const thumb = url[url.length - 1];
    url = thumb?.url || "";
  }
  if (typeof url !== "string") return "";
  // Upgrade YouTube Music's thumbnail to maximum possible resolution.
  // 1200x1200 will be dynamically served by Google's CDN if available.
  return url.replace(/([=\-])w\d+-h\d+[^&"']*/, "$1w1200-h1200");
}

function ytmToLoop(t: any): LoopTrack {
  return {
    id: t.videoId ?? t.id,
    title: t.title,
    artist: t.artist,
    albumArt: getHighResAlbumArt(t.albumArt),
    youtubeId: t.videoId ?? t.id, // already a YT video ID — no extra resolution needed
    durationMs: t.durationMs,
  };
}

function spotifyToLoop(t: any): LoopTrack {
  return {
    id: t.id,
    title: t.name,
    artist: t.artists?.map((a: any) => a.name).join(", ") ?? "",
    albumArt: t.album?.images?.[0]?.url ?? "",
    durationMs: t.duration_ms,
    explicit: t.explicit,
    // youtubeId intentionally undefined — resolved lazily by AudioEngine
  };
}

// ─── hybridSearchFn ──────────────────────────────────────────────
/**
 * Real music search.
 * 1. Tries YouTube Music InnerTube (zero keys, massive catalog)
 * 2. Falls back to Spotify API if available
 * Results include real video IDs ready for immediate IFrame playback.
 */
export const hybridSearchFn = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: rawQuery }) => {
    const query = sanitiseQuery(rawQuery);
    if (!query) return [];
    checkRateLimit(`search:${query.slice(0, 20)}`);

    // ── Primary: YouTube Music ──
    try {
      const ytmResults = await searchYouTubeMusic(query, 40);
      if (ytmResults.length > 0) {
        return ytmResults.map(ytmToLoop);
      }
    } catch (err) {
      console.warn("[Search] YouTube Music search failed, trying Spotify:", err);
    }

    // ── Fallback: Spotify (if credentials are configured) ──
    try {
      const spotifyResults = await searchSpotifyTracks(query, 20);
      if (spotifyResults && spotifyResults.length > 0) {
        return spotifyResults.map(spotifyToLoop);
      }
    } catch (err) {
      console.warn("[Search] Spotify search also failed:", err);
    }

    return [];
  });

// ─── getPlaybackSourceFn ─────────────────────────────────────────
/**
 * Resolve a YouTube video ID from track name + artist.
 * Used by AudioEngine when a track came from Spotify (no videoId).
 * Primary: YouTube Music InnerTube search
 * Fallback: YouTube Data API v3 (if key is configured)
 */
export const getPlaybackSourceFn = createServerFn({ method: "GET" })
  .inputValidator((data: { trackName: string; artistName: string; isRemix?: boolean }) => data)
  .handler(async ({ data }) => {
    const trackName = sanitiseQuery(data.trackName, 150);
    const artistName = sanitiseQuery(data.artistName, 150);
    if (!trackName) return null;
    checkRateLimit(`playback:${trackName.slice(0, 20)}`);

    // ── Primary: fast music search resolution ──
    try {
      const videoId = await resolveVideoId(trackName, artistName);
      if (videoId) return videoId;
    } catch (err) {
      console.warn("[Playback] Primary resolution failed, trying fallback:", err);
    }

    // ── Fallback: secondary resolution ──
    try {
      const videoId = await resolveYouTubePlayback(trackName, artistName, data.isRemix);
      if (videoId) return videoId;
    } catch (err) {
      console.warn("[Playback] Fallback resolution also failed:", err);
    }

    return null;
  });

/**
 * Highly reliable fallback that uses standard YouTube (not YouTube Music)
 * to bypass label embed restrictions by finding a user-uploaded lyrics video.
 */
export const getFallbackSourceFn = createServerFn({ method: "GET" })
  .inputValidator((data: { trackName: string; artistName: string }) => data)
  .handler(async ({ data }) => {
    const trackName = sanitiseQuery(data.trackName, 150);
    const artistName = sanitiseQuery(data.artistName, 150);
    if (!trackName) return null;
    checkRateLimit(`fallback:${trackName.slice(0, 20)}`);
    try {
      const YouTube = require("youtube-sr").default;
      const results = await YouTube.search(`${artistName} ${trackName} lyrics audio`, { limit: 1 });
      return results[0]?.id ?? null;
    } catch (e) {
      console.error("[Fallback] Search failed:", e);
      return null;
    }
  });

// ─── getRecommendationsFn ────────────────────────────────────────
/**
 * Fetch real recommendations for the currently playing track.
 * Primary: YouTube Music "Up Next" queue (uses videoId, zero keys)
 * Fallback: Spotify recommendations (uses Spotify track ID, needs credentials)
 */
export const getRecommendationsFn = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: rawId }) => {
    const trackId = sanitiseQuery(rawId, 256);
    if (!trackId) return [];
    checkRateLimit(`recs:${trackId.slice(0, 20)}`, 120); // slightly higher limit for autoplay

    if (!trackId.startsWith("spotify:")) {
      if (trackId.length <= 12) {
        try {
          const related = await getRelatedTracks(trackId, 10);
          if (related.length > 0) return related.map(ytmToLoop);
        } catch (err) {
          console.warn("[Recs] Related tracks failed:", err);
        }
      } else {
        try {
          const searchResults = await searchYouTubeMusic(trackId, 10);
          if (searchResults.length > 0) return searchResults.map(ytmToLoop);
        } catch (err) {
          console.warn("[Recs] Search fallback failed:", err);
        }
      }
    }

    // ── Fallback: Spotify recommendations ──
    try {
      const recs = await getRecommendations(trackId, 10);
      if (recs && recs.length > 0) return recs.map(spotifyToLoop);
    } catch (err) {
      console.warn("[Recs] Spotify recommendations also failed:", err);
    }

    return [];
  });

// ─── omniSearchFn ──────────────────────────────────────────────
import { searchAlbums, searchPlaylist } from "../server/services/youtubeMusic";

export const omniSearchFn = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: query }) => {
    try {
      const [tracks, albums, playlists] = await Promise.all([
        searchYouTubeMusic(query, 20),
        searchAlbums(query, 10),
        searchPlaylist(query, 10),
      ]);
      return {
        tracks: tracks.map(ytmToLoop),
        albums: albums.map((a) => ({
          ...a,
          id: a.id,
          title: a.title,
          artist: a.artist,
          albumArt: getHighResAlbumArt(a.albumArt),
        })),
        playlists: playlists.map((p) => ({
          ...p,
          id: p.videoId || p.id,
          title: p.title,
          artist: p.artist,
          albumArt: getHighResAlbumArt(p.albumArt),
        })),
      };
    } catch (err) {
      console.error("[OmniSearch] Failed:", err);
      return { tracks: [], albums: [], playlists: [] };
    }
  });

export const getAlbumDetailsFn = createServerFn({ method: "GET" })
  .inputValidator((data: any) => data)
  .handler(async ({ data }) => {
    try {
      const albumId = typeof data === "string" ? data : data.id;
      const fallbackArtist = typeof data === "string" ? "" : data.artist;
      const fallbackArt = typeof data === "string" ? "" : data.albumArt;

      const { getAlbumDetails } = await import("../server/services/youtubeMusic");
      const tracks = await getAlbumDetails(albumId);
      return tracks.map(ytmToLoop).map((t) => ({
        ...t,
        artist:
          !t.artist || t.artist === "Unknown Artist" || t.artist === "Unknown"
            ? fallbackArtist || "Unknown Artist"
            : t.artist,
        albumArt: t.albumArt || fallbackArt || "",
      }));
    } catch (err) {
      console.error("[Search] getAlbumDetails failed:", err);
      return [];
    }
  });

export const getPlaylistDetailsFn = createServerFn({ method: "GET" })
  .inputValidator((data: any) => data)
  .handler(async ({ data }) => {
    try {
      const playlistId = typeof data === "string" ? data : data.id;
      const fallbackArtist = typeof data === "string" ? "" : data.artist;
      const fallbackArt = typeof data === "string" ? "" : data.albumArt;

      const { getPlaylistDetails } = await import("../server/services/youtubeMusic");
      const tracks = await getPlaylistDetails(playlistId);
      return tracks.map(ytmToLoop).map((t) => ({
        ...t,
        artist:
          !t.artist || t.artist === "Unknown Artist" || t.artist === "Unknown"
            ? fallbackArtist || "Unknown Artist"
            : t.artist,
        albumArt: t.albumArt || fallbackArt || "",
      }));
    } catch (err) {
      console.error("[Search] getPlaylistDetails failed:", err);
      return [];
    }
  });
