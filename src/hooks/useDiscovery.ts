/**
 * useDiscovery — Personalized recommendation fetcher
 *
 * Reads from useListeningIntelligence to build a rich seed object
 * passed to getDiscoverySectionsFn. Re-fetches on track change.
 * Session-caches by trackId to avoid redundant calls.
 */

import { useState, useEffect, useRef } from "react";
import { usePlayback } from "./usePlayback";
import { getDiscoverySectionsFn } from "@/functions/recommendations";
import { useListeningIntelligence } from "./useListeningIntelligence";

export interface DiscoveryTrack {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  youtubeId: string;
  durationMs?: number;
}

export interface DiscoverySection {
  id: string;
  title: string;
  icon?: string;
  tracks: DiscoveryTrack[];
}

// Session cache: key → sections[]
const _cache = new Map<string, DiscoverySection[]>();

export function useDiscovery() {
  const { currentTrack } = usePlayback();
  const intel = useListeningIntelligence();

  const [sections, setSections] = useState<DiscoverySection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const prevKey = useRef<string | null>(null);

  useEffect(() => {
    const trackId = currentTrack?.youtubeId ?? currentTrack?.id ?? null;
    const topGenre = intel.getTopGenres(1)[0] ?? "pop";
    const vibe = intel.getVibeQuerySeed();

    // Cache key includes top genre so re-fetches when taste changes significantly
    const cacheKey = `${trackId ?? "__default__"}:${topGenre}`;

    if (cacheKey === prevKey.current && hasLoaded) return;
    prevKey.current = cacheKey;

    if (_cache.has(cacheKey)) {
      setSections(_cache.get(cacheKey)!);
      setHasLoaded(true);
      return;
    }

    setIsLoading(true);
    getDiscoverySectionsFn({
      data: {
        trackId: trackId ?? undefined,
        title: currentTrack?.title,
        artist: currentTrack?.artist,
        topGenres: intel.getTopGenres(5),
        topArtists: intel.getTopArtists(5),
        recentArtists: intel.getRecentArtists(3),
        topReplayedTracks: intel.getTopReplayedTracks(3),
        genre: vibe.genre,
        tasteIdentity: intel.getTasteIdentity(),
      },
    })
      .then((result) => {
        _cache.set(cacheKey, result as DiscoverySection[]);
        setSections(result as DiscoverySection[]);
        setHasLoaded(true);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [currentTrack?.id, intel.getTopGenres(1)[0]]);

  return { sections, isLoading, hasLoaded };
}
