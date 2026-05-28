/**
 * Loop Recommendation Engine — Intelligence-powered discovery
 *
 * This server function accepts rich personalization seeds derived from
 * useListeningIntelligence and builds targeted YTM search queries.
 *
 * Section strategy:
 *  For You       → YTM "Up Next" from current track (best signal)
 *  More Like X   → Artist-seeded search
 *  [Mood] Mix    → Time-of-day + mood-based query
 *  Trending Now  → Always-fresh trending query
 *  Underground   → Genre-specific underground discovery
 *  Deep Cuts     → Same artist, rare/hidden tracks
 *  Based On You  → Top genre × top artist combination
 */

import { createServerFn } from '@tanstack/react-start';
import { searchYouTubeMusic, getRelatedTracks } from '../server/services/youtubeMusic';

interface PersonalizedSeed {
  // Current track context
  trackId?: string;
  title?: string;
  artist?: string;

  // Intelligence-derived signals (from useListeningIntelligence)
  topGenres?: string[];      // e.g. ['lofi', 'phonk', 'bollywood']
  topArtists?: string[];     // e.g. ['arijit singh', 'the weeknd']
  recentArtists?: string[];
  topReplayedTracks?: { title: string; artist: string }[];
  genre?: string;            // single primary genre hint
}

interface DiscoveryTrack {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  youtubeId: string;
  durationMs?: number;
}

interface DiscoverySection {
  id: string;
  title: string;
  tracks: DiscoveryTrack[];
  icon?: string;
}

function toTrack(t: any): DiscoveryTrack {
  return {
    id:        t.videoId ?? t.id,
    title:     t.title,
    artist:    t.artist ?? 'Unknown',
    albumArt:  t.albumArt ?? '',
    youtubeId: t.videoId ?? t.id,
    durationMs: t.durationMs,
  };
}

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

export const getDiscoverySectionsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: PersonalizedSeed) => data)
  .handler(async ({ data }): Promise<DiscoverySection[]> => {
    const {
      trackId, artist, topGenres = [], topArtists = [],
      recentArtists = [], topReplayedTracks = []
    } = data;

    const g1 = topGenres[0] ?? 'Pop';
    const g2 = topGenres[1] ?? 'Hip Hop';
    const g3 = topGenres[2] ?? 'R&B';
    const primaryArtist = artist ?? topArtists[0] ?? recentArtists[0] ?? '';

    // Extract top replayed tracks
    const t1 = topReplayedTracks[0];
    const t2 = topReplayedTracks[1];

    // Build dynamic titles based on recent activity
    const basedOnTitle = t1 ? `Because you looped ${t1.title}` : `Because you replayed ${primaryArtist}`;
    const similarTitle = t2 ? `Deep dive into ${t2.title}` : `Similar to ${toTitleCase(primaryArtist)}`;

    // Queries prioritizing song identity and micro-genres
    const qForYou = trackId
      ? '' // We use getRelatedTracks if trackId exists
      : t1 ? `${t1.title} ${t1.artist} mix playlist` : `${primaryArtist} ${g1} mix playlist`;

    const qSimilar = t2 
      ? `${t2.title} ${t2.artist} similar songs mix` 
      : `${primaryArtist} similar artists ${g1}`;

    const qGenre1Trending = `${g1} viral trending 2024 hits playlist`;
    const qGenre2Classics = `${g2} best tracks universe playlist`;
    const qGenre3Hidden   = `${g3} underground gems rare tracks`;
    
    const qBasedOn = t1
      ? `${t1.title} ${g1} best playlist`
      : topArtists.length > 0
        ? `${topArtists[0]} ${g1} best playlist`
        : `global top songs viral playlist`;

    // Fetch all in parallel
    const [forYou, similar, g1Trending, g2Classics, g3Hidden, basedOn] =
      await Promise.allSettled([
        // For You: best signal from YTM related
        trackId
          ? getRelatedTracks(trackId, 20).then(t => t.map(toTrack))
          : searchYouTubeMusic(qForYou, 20).then(t => t.map(toTrack)),

        // Deep Dive / Similar
        searchYouTubeMusic(qSimilar, 18).then(t => t.map(toTrack)),

        // Genre 1 Trending -> e.g. "Dark R&B Rotation"
        searchYouTubeMusic(qGenre1Trending, 18).then(t => t.map(toTrack)),

        // Genre 2 Universe -> e.g. "Atmospheric Trap Universe"
        searchYouTubeMusic(qGenre2Classics, 18).then(t => t.map(toTrack)),

        // Genre 3 Hidden Gems -> e.g. "Underground Sad Girl Pop"
        searchYouTubeMusic(qGenre3Hidden, 16).then(t => t.map(toTrack)),

        // Based on Top Loop
        searchYouTubeMusic(qBasedOn, 18).then(t => t.map(toTrack)),
      ]);

    function unwrap(r: PromiseSettledResult<DiscoveryTrack[]>): DiscoveryTrack[] {
      return r.status === 'fulfilled' ? r.value : [];
    }

    const sections: DiscoverySection[] = [
      { id: 'for-you',     title: 'Your Current Obsession',                            icon: '❤️', tracks: unwrap(forYou) },
      { id: 'based-on',    title: basedOnTitle,                                        icon: '🧠', tracks: unwrap(basedOn) },
      { id: 'similar',     title: similarTitle,                                        icon: '🎵', tracks: unwrap(similar) },
      { id: 'g1-trending', title: `${toTitleCase(g1)} Rotation`,                       icon: '🔥', tracks: unwrap(g1Trending) },
      { id: 'g2-classics', title: `${toTitleCase(g2)} Universe`,                       icon: '🌌', tracks: unwrap(g2Classics) },
      { id: 'g3-hidden',   title: `Underground ${toTitleCase(g3)}`,                    icon: '💎', tracks: unwrap(g3Hidden) },
    ];

    return sections.filter(s => s.tracks.length > 0);
  });
