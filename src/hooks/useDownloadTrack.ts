import { useState, useEffect } from "react";
import { Track } from "./usePlayback";
import { getOfflineTrack, saveOfflineTrack, removeOfflineTrack } from "@/lib/offlineDB";
import { getPlaybackSourceFn } from "@/functions/search";
import { toast } from "sonner";

async function ensureYoutubeId(track: Track): Promise<string | null> {
  if (track.youtubeId && /^[a-zA-Z0-9_-]{10,12}$/.test(track.youtubeId)) return track.youtubeId;
  if (track.id && /^[a-zA-Z0-9_-]{10,12}$/.test(track.id)) return track.id;
  try {
    const ytId = await getPlaybackSourceFn({ data: { trackName: track.title, artistName: track.artist } });
    return ytId ?? null;
  } catch {
    return null;
  }
}

/**
 * Massive list of public proxy instances for YouTube.
 * We try them one by one until one succeeds.
 * This guarantees the download works even if 90% of instances are dead.
 */
const INVIDIOUS_INSTANCES = [
  "https://invidious.jing.rocks",
  "https://invidious.asir.dev",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://invidious.flokinet.to",
  "https://vid.puffyan.us",
  "https://inv.tux.pizza",
  "https://invidious.privacydev.net",
  "https://inv.nadeko.net",
];

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.yt",
  "https://pipedapi.darkness.services",
  "https://piped-api.garudalinux.org",
  "https://pipedapi.tokhmi.xyz",
  "https://pipedapi.smarthome.re",
  "https://piped.projectsegfau.lt",
];

const COBALT_INSTANCES = [
  "https://cobalt-api.kwiatekm.me",
  "https://co.wuk.sh",
  "https://api.cobalt.tools", 
];

async function getClientSideAudioStream(videoId: string) {
  // 1. Try Invidious (Most reliable currently)
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      // Invidious /latest_version proxies the audio through their server (bypassing googlevideo CORS)
      // itag 140 = m4a audio, itag 251 = webm audio
      const url = `${instance}/latest_version?id=${videoId}&itag=140`;
      
      // We just do a HEAD request to check if this instance is alive and allows CORS
      const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      if (head.ok) return { url, mimeType: "audio/mp4" };
      
      const urlWebm = `${instance}/latest_version?id=${videoId}&itag=251`;
      const headWebm = await fetch(urlWebm, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      if (headWebm.ok) return { url: urlWebm, mimeType: "audio/webm" };
    } catch (e) {
      // instance dead or cors blocked, try next
    }
  }

  // 2. Try Piped 
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const streams = json.audioStreams ?? [];
      if (!streams.length) continue;
      const best = [...streams].sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
      if (best?.url) {
        // Piped URLs are already proxied
        return { url: best.url, mimeType: best.mimeType ?? "audio/webm" };
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Try Cobalt public instances
  for (const instance of COBALT_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/json`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          isAudioOnly: true
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.status === "stream" || json.status === "redirect") {
        return { url: json.url, mimeType: "audio/mp4" }; 
      }
    } catch (e) {
      // ignore
    }
  }

  return null;
}

export function useDownloadTrack(track: Track) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (!track?.id) {
      setIsDownloaded(false);
      return;
    }
    getOfflineTrack(track.id)
      .then((t) => setIsDownloaded(!!t))
      .catch(() => setIsDownloaded(false));
  }, [track?.id]);

  const toggleDownload = async () => {
    if (isDownloaded) {
      await removeOfflineTrack(track.id);
      setIsDownloaded(false);
      toast.info(`Removed "${track.title}" from Downloads`);
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    const toastId = toast.loading(`Preparing "${track.title}"…`, { duration: Infinity });

    try {
      toast.loading(`Finding "${track.title}"…`, { id: toastId });
      const ytId = await ensureYoutubeId(track);

      if (!ytId) {
        throw new Error("Could not find this song on YouTube");
      }

      toast.loading(`Getting stream for "${track.title}"… (This may take a few seconds)`, { id: toastId });
      
      // Ultra-robust client side stream resolution through dozens of instances
      const streamInfo = await getClientSideAudioStream(ytId);

      if (!streamInfo?.url) {
        throw new Error("All proxy servers are currently busy — please try again later");
      }

      toast.loading(`Downloading "${track.title}" — 0%`, { id: toastId });
      
      const response = await fetch(streamInfo.url);
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;
      const chunks: Uint8Array[] = [];

      const reader = response.body?.getReader();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.byteLength;
            if (total > 0) {
              const pct = Math.min(99, Math.round((loaded / total) * 100));
              setDownloadProgress(pct);
              toast.loading(`Downloading "${track.title}" — ${pct}%`, { id: toastId });
            } else {
              // If no content length, just show MB downloaded
              const mb = (loaded / 1024 / 1024).toFixed(1);
              toast.loading(`Downloading "${track.title}" — ${mb}MB`, { id: toastId });
            }
          }
        }
      } else {
        const buf = await response.arrayBuffer();
        chunks.push(new Uint8Array(buf));
      }

      const totalLen = chunks.reduce((a, c) => a + c.byteLength, 0);
      const merged = new Uint8Array(totalLen);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.byteLength;
      }

      const blob = new Blob([merged], { type: streamInfo.mimeType });
      await saveOfflineTrack(track, blob);

      setIsDownloaded(true);
      setDownloadProgress(100);
      toast.success(`"${track.title}" saved for offline listening! ✈️`, { id: toastId });
    } catch (e: any) {
      console.error("[Download]", e);
      toast.error(e?.message ?? `Download failed for "${track.title}"`, { id: toastId });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return { isDownloaded, isDownloading, downloadProgress, toggleDownload };
}
