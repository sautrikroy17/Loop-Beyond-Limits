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
import { searchYouTubeMusic, getRelatedTracks, searchAlbums, getAlbumDetails } from '../server/services/youtubeMusic';

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
  tasteIdentity?: string;
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
  type?: 'tracks' | 'albums';
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

const GARBAGE_REGEX = /workout|karaoke|cover|tribute|compilation|80s|90s|lofi hip hop radio|sex playlist|vocal version|instrumental cover|8d audio|slowed \+ reverb/i;

function isPremiumTrack(t: DiscoveryTrack): boolean {
  if (GARBAGE_REGEX.test(t.title) || GARBAGE_REGEX.test(t.artist)) return false;
  return true;
}

function deduplicateTracks(tracks: DiscoveryTrack[]): DiscoveryTrack[] {
  const seen = new Set<string>();
  const unique: DiscoveryTrack[] = [];
  for (const t of tracks) {
    const key = t.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }
  return unique;
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
      recentArtists = [], topReplayedTracks = [], tasteIdentity = 'New Explorer'
    } = data;

    const g1 = topGenres[0] ?? 'Pop';
    const primaryArtist = artist ?? topArtists[0] ?? recentArtists[0] ?? '';

    // 1. Core Dynamic Sections (Your Obsessions / Similar)
    const t1 = topReplayedTracks[0];
    const basedOnTitle = t1 ? `Because you looped ${t1.title}` : `Because you replayed ${toTitleCase(primaryArtist)}`;
    
    const qForYou = trackId ? '' : t1 ? `${t1.title} ${t1.artist}` : `${primaryArtist} ${g1}`;
    const qBasedOn = t1 ? `${t1.title} ${g1}` : `${topArtists[0] || 'Viral'} ${g1} hits`;
    
    // AI Mix Generation
    const qAIMix = `${tasteIdentity} ${primaryArtist}`;
    const aiMixTitle = `Your ${tasteIdentity} Mix`;

    // 2. Real Music Culture Charts & Playlists
    // These strings map directly to massive real playlists on YT Music
    const CHART_POOL: Record<string, { title: string; query: string; icon: string }[]> = {
      'Bollywood Romance': [
        { title: 'Bollywood Hits', query: 'Bollywood official hits', icon: '🌊' },
        { title: 'Desi Romance', query: 'Desi Romance Hindi songs', icon: '❤️' },
      ],
      'Desi Trap': [
        { title: 'Desi Trap & Hip Hop', query: 'Desi Hip Hop official hits', icon: '🔥' },
        { title: 'Punjabi Hits', query: 'Punjabi official top hits', icon: '🌶️' },
      ],
      'Punjabi Heat': [
        { title: 'Punjabi Hits', query: 'Punjabi official top hits', icon: '🌶️' },
        { title: 'Desi Heat', query: 'Top Punjabi trending songs', icon: '🔥' },
      ],
      'Dark R&B': [
        { title: 'R&B Essentials', query: 'R&B Essentials official tracks', icon: '🖤' },
        { title: 'Moody Albums', query: 'Dark R&B late night hits', icon: '🌙' },
      ],
      'Sad Girl Pop': [
        { title: 'Sad Songs', query: 'Sad Girl Pop emotional tracks', icon: '💧' },
        { title: 'Indie Nights', query: 'Indie pop alternative hits', icon: '🌌' },
      ],
      'Festival EDM': [
        { title: 'Festival EDM', query: 'Top EDM festival dance tracks', icon: '🪩' },
        { title: 'Party Anthems', query: 'Global party anthems official', icon: '🎉' },
      ],
    };

    // Global fallbacks if culture not matched
    const GLOBAL_CHARTS = [
      { title: 'Trending Worldwide', query: 'Global top songs trending official', icon: '🌎' },
      { title: 'Viral TikTok Songs', query: 'Viral TikTok songs official', icon: '📱' },
      { title: 'Top Played This Week', query: 'Top 50 global weekly songs', icon: '📈' },
      { title: 'Underground Trending', query: 'Underground hidden gems tracks', icon: '💎' },
      { title: 'Hollywood Hits', query: 'Pop hits 2024 official', icon: '🌟' },
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
      // AI Mix: Procedurally generated for identity
      searchYouTubeMusic(qAIMix, 20).then(t => t.map(toTrack)),
      // For You: best signal from YTM related
      trackId
        ? getRelatedTracks(trackId, 20).then(t => t.map(toTrack))
        : searchYouTubeMusic(qForYou, 20).then(t => t.map(toTrack)),
      // Based on Top Loop
      searchYouTubeMusic(qBasedOn, 18).then(t => t.map(toTrack)),
      // Fetch specific Gen Z / Top Albums related to the vibe
      searchAlbums(`${primaryArtist} album`, 10),
    ];

    // Add chart queries
    selectedCharts.forEach(chart => {
      promises.push(searchYouTubeMusic(chart.query, 16).then(t => t.map(toTrack)));
    });

    const results = await Promise.allSettled(promises);

    function unwrap(index: number): DiscoveryTrack[] {
      const r = results[index];
      const raw = r?.status === 'fulfilled' ? r.value : [];
      return deduplicateTracks(raw.filter(isPremiumTrack));
    }

    function unwrapAlbums(index: number): DiscoveryTrack[] {
      const r = results[index];
      if (r?.status === 'fulfilled' && Array.isArray(r.value)) {
        const raw = r.value.map(a => ({
          id: a.id,
          youtubeId: a.id,
          title: a.title,
          artist: a.artist,
          albumArt: a.albumArt
        }));
        return deduplicateTracks(raw.filter(isPremiumTrack));
      }
      return [];
    }

    const sections: DiscoverySection[] = [
      { id: 'ai-mix',   title: aiMixTitle,               icon: '🧠', tracks: unwrap(0), type: 'tracks' },
      { id: 'for-you',  title: 'Your Current Obsession', icon: '❤️', tracks: unwrap(1), type: 'tracks' },
      { id: 'albums',   title: 'Essential Albums',       icon: '💿', tracks: unwrapAlbums(3), type: 'albums' },
      { id: 'based-on', title: basedOnTitle,             icon: '🔥', tracks: unwrap(2), type: 'tracks' },
    ];

    selectedCharts.forEach((chart, idx) => {
      sections.push({
        id: `chart-${idx}`,
        title: chart.title,
        icon: chart.icon,
        tracks: unwrap(4 + idx),
        type: 'tracks',
      });
    });

    return sections.filter(s => s.tracks && s.tracks.length > 0);
  });

export const getAlbumDetailsFn = createServerFn({ method: 'GET' })
  .inputValidator((browseId: string) => browseId)
  .handler(async ({ data: browseId }): Promise<DiscoveryTrack[]> => {
    const tracks = await getAlbumDetails(browseId);
    return tracks.map(toTrack);
  });
