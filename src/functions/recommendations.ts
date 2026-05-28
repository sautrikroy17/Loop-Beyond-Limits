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
import { searchYouTubeMusic, getRelatedTracks, searchAlbums, getAlbumDetails, getPlaylistDetails } from '../server/services/youtubeMusic';

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
    const CHART_POOL: Record<string, { title: string; browseId: string; icon: string }[]> = {
      'Bollywood Romance': [
        { title: 'Bollywood Hits', browseId: 'VLPL4fGSI1pDJn40WjZ6utkIuj2rNg-7iGsq', icon: '🌊' }, // Top 100 India
        { title: 'Desi Romance', browseId: 'VLPL4fGSI1pDJn5RgLW0Sb_zECecWdH_4zOX', icon: '❤️' }, // Top Weekly Hindi
      ],
      'Desi Trap': [
        { title: 'Desi Trap & Hip Hop', browseId: 'VLPL4fGSI1pDJn40WjZ6utkIuj2rNg-7iGsq', icon: '🔥' },
        { title: 'Punjabi Hits', browseId: 'VLPL4fGSI1pDJn5JXkyIohg2RstsbL2SnRew', icon: '🌶️' }, // Top Weekly Punjabi
      ],
      'Punjabi Heat': [
        { title: 'Punjabi Hits', browseId: 'VLPL4fGSI1pDJn5JXkyIohg2RstsbL2SnRew', icon: '🌶️' },
        { title: 'Desi Heat', browseId: 'VLOLAK5uy_lSTp1DIuzZBUyee3kDsXwPgP25WdfwB40', icon: '🔥' }, // Trending 20 India
      ],
      'Dark R&B': [
        { title: 'R&B Essentials', browseId: 'VLPL4fGSI1pDJn49TUu37nJoN2QTeYuRwmNv', icon: '🖤' }, // International
        { title: 'Moody Albums', browseId: 'VLPL4fGSI1pDJn69kO7xH3Oq2hP8FvE2i1F', icon: '🌙' }, // Global
      ],
      'Sad Girl Pop': [
        { title: 'Sad Songs', browseId: 'VLPL4fGSI1pDJn49TUu37nJoN2QTeYuRwmNv', icon: '💧' },
        { title: 'Indie Nights', browseId: 'VLPL4fGSI1pDJn69kO7xH3Oq2hP8FvE2i1F', icon: '🌌' },
      ],
      'Festival EDM': [
        { title: 'Festival EDM', browseId: 'VLPL4fGSI1pDJn49TUu37nJoN2QTeYuRwmNv', icon: '🪩' },
        { title: 'Party Anthems', browseId: 'VLPL4fGSI1pDJn69kO7xH3Oq2hP8FvE2i1F', icon: '🎉' },
      ],
    };

    // Global fallbacks if culture not matched
    const GLOBAL_CHARTS = [
      { title: 'Top 50 Global', browseId: 'RDCLAK5uy_m5jZ7a29G1zQy6iZqR8m3I-tC_zV2b_fM', icon: '🌎' }, // Pop Hits
      { title: 'Viral TikTok Songs', browseId: 'VLPL4fGSI1pDJn69kO7xH3Oq2hP8FvE2i1F', icon: '📱' }, // Global 100
      { title: 'Hollywood Hits', browseId: 'VLPL4fGSI1pDJn49TUu37nJoN2QTeYuRwmNv', icon: '🌟' }, // International Weekly
      { title: 'Trending Worldwide', browseId: 'VLPL4fGSI1pDJn69kO7xH3Oq2hP8FvE2i1F', icon: '📈' }, // Global 100
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
      // Fetch dynamic trending albums for the top artist (so we never hit "compilation" albums)
      searchAlbums(primaryArtist ? `${primaryArtist}` : `${g1} trending albums`, 10),
    ];

    // Add chart queries by fetching the OFFICIAL playlist from YouTube Music
    selectedCharts.forEach(chart => {
      promises.push(getPlaylistDetails(chart.browseId, 16).then(t => t.map(toTrack)));
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
      { id: 'albums',   title: 'Feel The Vibe',          icon: '💿', tracks: unwrapAlbums(3), type: 'albums' },
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
