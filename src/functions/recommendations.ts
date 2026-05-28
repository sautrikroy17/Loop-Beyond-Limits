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
import type { MoodLabel } from '../hooks/useListeningIntelligence';

interface PersonalizedSeed {
  // Current track context
  trackId?: string;
  title?: string;
  artist?: string;

  // Intelligence-derived signals (from useListeningIntelligence)
  topGenres?: string[];      // e.g. ['lofi', 'phonk', 'bollywood']
  topArtists?: string[];     // e.g. ['arijit singh', 'the weeknd']
  recentArtists?: string[];
  mood?: MoodLabel;
  moodQuery?: string;        // pre-built query from moodToQuery()
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

// ── Mood metadata ─────────────────────────────────────────────────

const MOOD_META: Record<MoodLabel, { label: string; icon: string; underground: string; trending: string }> = {
  focus:        { label: 'Focus Flow',      icon: '🎯', underground: 'lofi underground study instrumental',    trending: 'lofi beats mashup trending' },
  chill:        { label: 'Chill Vibes',     icon: '🌊', underground: 'indie pop hidden gems',                  trending: 'chill 2024 viral' },
  'night-drive':{ label: '2AM Drive',       icon: '🌙', underground: 'dark trap night',                        trending: 'late night drive playlist' },
  party:        { label: 'Party Mode',      icon: '🔥', underground: 'underground club party',                 trending: 'party anthems 2024 viral banger' },
  emotional:    { label: 'Feel Everything', icon: '💙', underground: 'emotional indie sad',                    trending: 'sad songs 2024 viral' },
  gym:          { label: 'Gym Mode',        icon: '⚡', underground: 'workout motivation rap',                 trending: 'gym motivation hype' },
  underground:  { label: 'Hidden Gems',     icon: '💎', underground: 'indie pop obscure 2024 hidden',          trending: 'underground trending 2024' },
  morning:      { label: 'Morning Energy',  icon: '☀️', underground: 'morning uplifting indie',                trending: 'uplifting morning music 2024' },
  discovery:    { label: 'Fresh Picks',     icon: '✨', underground: 'new indie artists 2024 emerging',        trending: 'new music 2024 discovery trending' },
  balanced:     { label: 'Your Mix',        icon: '🎵', underground: 'indie gems 2024',                        trending: 'top songs of the week viral' },
};

// ── Hour-of-day context ───────────────────────────────────────────

function hourLabel(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  if (h >= 21 || h < 4)  return 'night';
  return 'latenight';
}

export const getDiscoverySectionsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: PersonalizedSeed) => data)
  .handler(async ({ data }): Promise<DiscoverySection[]> => {
    const {
      trackId, artist, topGenres = [], topArtists = [],
      recentArtists = [], mood = 'balanced', moodQuery,
      genre,
    } = data;

    const primaryGenre  = genre ?? topGenres[0] ?? 'top trending hits';
    const primaryArtist = artist ?? topArtists[0] ?? recentArtists[0] ?? '';
    const moodMeta      = MOOD_META[mood] ?? MOOD_META.balanced;
    const timeCtx       = hourLabel();

    // Build contextual "More Like" label
    const artistLabel = primaryArtist
      ? primaryArtist.split(/[,&]/)[0].trim()
      : null;
    const moreLikeLabel = artistLabel ? `More Like ${artistLabel}` : 'Similar Artists';

    // Smart trending based on genre + time (Gen-Z adaptive)
    const trendingQuery = topGenres.length > 0
      ? `${primaryGenre} ${moodMeta.trending}`
      : `top songs of the week trending 2024 ${moodMeta.trending}`;

    // Underground query
    const undergroundQuery = topGenres.length > 1
      ? `${topGenres.slice(0, 2).join(' ')} ${moodMeta.underground}`
      : `${primaryGenre} ${moodMeta.underground}`;

    // Based on you: combine top artist × top genre (or default to top charts)
    const basedOnQuery = topArtists.length > 0 && topGenres.length > 0
      ? `${topArtists[0]} ${topGenres[0]} mix playlist`
      : `top songs of the week billboard trending playlist`;

    // Deep cuts: same artist, diverse tracks (or default to party/club)
    const deepCutsQuery = primaryArtist
      ? `${primaryArtist} best songs rare b-sides deep cuts`
      : `${primaryGenre} party songs club mix trending`;

    // Mood query (may be pre-built by client or generated here)
    const moodQ = moodQuery ?? `${primaryGenre} ${moodMeta.label.toLowerCase()} music`;

    // Fetch all in parallel
    const [forYou, similar, moodMix, trending, underground, deepCuts, basedOn] =
      await Promise.allSettled([
        // For You: best signal from YTM related
        trackId
          ? getRelatedTracks(trackId, 20).then(t => t.map(toTrack))
          : searchYouTubeMusic(`${primaryArtist} ${primaryGenre} playlist mix`, 20).then(t => t.map(toTrack)),

        // More Like X: artist-seeded
        primaryArtist
          ? searchYouTubeMusic(`${primaryArtist} similar artists ${primaryGenre}`, 18).then(t => t.map(toTrack))
          : searchYouTubeMusic(`${primaryGenre} similar artists mix`, 18).then(t => t.map(toTrack)),

        // Mood Mix
        searchYouTubeMusic(moodQ, 18).then(t => t.map(toTrack)),

        // Trending (always fresh)
        searchYouTubeMusic(trendingQuery, 18).then(t => t.map(toTrack)),

        // Underground
        searchYouTubeMusic(undergroundQuery, 18).then(t => t.map(toTrack)),

        // Deep Cuts
        searchYouTubeMusic(deepCutsQuery, 16).then(t => t.map(toTrack)),

        // Based on your listening
        searchYouTubeMusic(basedOnQuery, 18).then(t => t.map(toTrack)),
      ]);

    function unwrap(r: PromiseSettledResult<DiscoveryTrack[]>): DiscoveryTrack[] {
      return r.status === 'fulfilled' ? r.value : [];
    }

    const sections: DiscoverySection[] = [
      { id: 'for-you',     title: 'For You',          icon: '❤️', tracks: unwrap(forYou) },
      { id: 'similar',     title: moreLikeLabel,       icon: '🎵', tracks: unwrap(similar) },
      { id: 'mood',        title: `${moodMeta.icon} ${moodMeta.label}`, icon: moodMeta.icon, tracks: unwrap(moodMix) },
      { id: 'trending',    title: 'Trending Now',      icon: '📈', tracks: unwrap(trending) },
      { id: 'underground', title: 'Underground Finds', icon: '💎', tracks: unwrap(underground) },
      { id: 'deep-cuts',   title: 'Deep Cuts',         icon: '🎯', tracks: unwrap(deepCuts) },
      { id: 'based-on',    title: 'Based on Your Taste',icon:'🧠', tracks: unwrap(basedOn) },
    ];

    return sections.filter(s => s.tracks.length > 0);
  });
