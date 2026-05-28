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
    const primaryArtist = artist ?? topArtists[0] ?? recentArtists[0] ?? '';

    // 1. Core Dynamic Sections (Your Obsessions / Similar)
    const t1 = topReplayedTracks[0];
    const basedOnTitle = t1 ? `Because you looped ${t1.title}` : `Because you replayed ${toTitleCase(primaryArtist)}`;
    
    const qForYou = trackId ? '' : t1 ? `${t1.title} ${t1.artist} mix` : `${primaryArtist} ${g1} mix`;
    const qBasedOn = t1 ? `${t1.title} ${g1} playlist` : `${topArtists[0] || 'Viral'} ${g1} best playlist`;

    // 2. Real Music Culture Charts & Playlists
    // These strings map directly to massive real playlists on YT Music
    const CHART_POOL: Record<string, { title: string; query: string; icon: string }[]> = {
      'Bollywood Romance': [
        { title: 'Bollywood Hits', query: 'Bollywood Hits playlist', icon: '🌊' },
        { title: 'Desi Romance', query: 'Desi Romance Hindi songs playlist', icon: '❤️' },
      ],
      'Desi Trap': [
        { title: 'Desi Trap & Hip Hop', query: 'Desi Hip Hop playlist', icon: '🔥' },
        { title: 'Punjabi Hits', query: 'Punjabi Hits playlist', icon: '🌶️' },
      ],
      'Punjabi Heat': [
        { title: 'Punjabi Hits', query: 'Punjabi Hits playlist', icon: '🌶️' },
        { title: 'Desi Heat', query: 'Top Punjabi trending playlist', icon: '🔥' },
      ],
      'Dark R&B': [
        { title: 'R&B Essentials', query: 'R&B Essentials playlist', icon: '🖤' },
        { title: 'Moody Albums', query: 'Dark R&B late night playlist', icon: '🌙' },
      ],
      'Sad Girl Pop': [
        { title: 'Sad Songs', query: 'Sad Girl Pop emotional playlist', icon: '💧' },
        { title: 'Indie Nights', query: 'Indie pop alternative playlist', icon: '🌌' },
      ],
      'Festival EDM': [
        { title: 'Festival EDM', query: 'Top EDM festival dance playlist', icon: '🪩' },
        { title: 'Party Anthems', query: 'Global party anthems playlist', icon: '🎉' },
      ],
    };

    // Global fallbacks if culture not matched
    const GLOBAL_CHARTS = [
      { title: 'Trending Worldwide', query: 'Global top songs trending playlist', icon: '🌎' },
      { title: 'Viral TikTok Songs', query: 'Viral TikTok songs playlist', icon: '📱' },
      { title: 'Top Played This Week', query: 'Top 50 global weekly playlist', icon: '📈' },
      { title: 'Underground Trending', query: 'Underground hidden gems playlist', icon: '💎' },
      { title: 'Hollywood Hits', query: 'Pop hits 2024 playlist', icon: '🌟' },
    ];

    // Select culture-specific charts
    let selectedCharts = CHART_POOL[g1] || [];
    
    // Fill the rest with Global Charts
    const needed = 4 - selectedCharts.length;
    for (let i = 0; i < needed; i++) {
      if (GLOBAL_CHARTS[i]) selectedCharts.push(GLOBAL_CHARTS[i]);
    }

    // Fetch all in parallel
    const promises = [
      // For You: best signal from YTM related
      trackId
        ? getRelatedTracks(trackId, 20).then(t => t.map(toTrack))
        : searchYouTubeMusic(qForYou, 20).then(t => t.map(toTrack)),
      // Based on Top Loop
      searchYouTubeMusic(qBasedOn, 18).then(t => t.map(toTrack)),
    ];

    // Add chart queries
    selectedCharts.forEach(chart => {
      promises.push(searchYouTubeMusic(chart.query, 16).then(t => t.map(toTrack)));
    });

    const results = await Promise.allSettled(promises);

    function unwrap(index: number): DiscoveryTrack[] {
      const r = results[index];
      return r?.status === 'fulfilled' ? r.value : [];
    }

    const sections: DiscoverySection[] = [
      { id: 'for-you',  title: 'Your Current Obsession', icon: '❤️', tracks: unwrap(0) },
      { id: 'based-on', title: basedOnTitle, icon: '🧠', tracks: unwrap(1) },
    ];

    selectedCharts.forEach((chart, idx) => {
      sections.push({
        id: `chart-${idx}`,
        title: chart.title,
        icon: chart.icon,
        tracks: unwrap(2 + idx),
      });
    });

    return sections.filter(s => s.tracks.length > 0);
  });
