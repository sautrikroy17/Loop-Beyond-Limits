import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useListeningIntelligence } from '@/hooks/useListeningIntelligence';
import { usePlayback } from '@/hooks/usePlayback';
import { hybridSearchFn, getRecommendationsFn } from '@/functions/search';

export async function saveProfileFn() {
  const { session } = useAuth.getState();
  if (!session?.user) return;

  const intel = useListeningIntelligence.getState();
  const topArtists = intel.getTopArtists(10);
  const topGenres = intel.getTopGenres(10);
  const moodHistory = intel.getTopGenres(1)[0]; // storing current top genre as basic history for now

  try {
    await (supabase as any).from('user_profiles').upsert({
      id: session.user.id,
      display_name: session.user.user_metadata.full_name,
      avatar_url: session.user.user_metadata.avatar_url,
      top_artists: topArtists,
      top_genres: topGenres,
      mood_history: moodHistory,
    }, { onConflict: 'id' });
  } catch (error) {
    console.error('Error saving profile:', error);
  }
}

export async function loadProfileFn() {
  const { session } = useAuth.getState();
  if (!session?.user) return;

  try {
    const { data, error } = await (supabase as any)
      .from('user_profiles')
      .select('top_artists, top_genres')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;

    if (data) {
      const intel = useListeningIntelligence.getState();
      
      // Actively merge cloud profile with local profile so devices stay perfectly in sync
      const aw: Record<string, number> = { ...intel.artistWeights };
      if (data.top_artists && Array.isArray(data.top_artists)) {
        data.top_artists.forEach((a: string, i: number) => {
          aw[a] = (aw[a] || 0) + Math.max(1, 10 - i);
        });
      }
      
      const gw: Record<string, number> = { ...intel.genreWeights };
      if (data.top_genres && Array.isArray(data.top_genres)) {
        data.top_genres.forEach((g: string, i: number) => {
          gw[g] = (gw[g] || 0) + Math.max(1, 10 - i);
        });
      }

      useListeningIntelligence.setState({ artistWeights: aw, genreWeights: gw });
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

export async function getDailyMixFn() {
  const { session } = useAuth.getState();
  if (!session?.user) return null;

  try {
    // 1. Check local storage first for a lightning-fast cached mix
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `loop_daily_mix_v2_${session.user.id}`;
    const cachedStr = localStorage.getItem(cacheKey);
    
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        if (cached.date === today && cached.mix && cached.mix.length > 0) {
          return cached.mix;
        }
      } catch (e) {
        // ignore parse error
      }
    }

    // 2. Fallback to Supabase
    const { data: profile } = await (supabase as any)
      .from('user_profiles')
      .select('daily_mix, daily_mix_date')
      .eq('id', session.user.id)
      .single();

    if (profile?.daily_mix_date === today && profile.daily_mix && profile.daily_mix.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify({ date: today, mix: profile.daily_mix }));
      return profile.daily_mix as any[];
    }

    // 3. Generate new mix
    const intel = useListeningIntelligence.getState();
    const topArtists = intel.getTopArtists(3);
    const seeds = topArtists.length > 0 ? topArtists : ['Justin Bieber', 'The Kid Laroi'];
    
    let mixedTracks: any[] = [];
    
    for (const artist of seeds) {
      // Use RPC to search for artist tracks
      const searchData = await hybridSearchFn({ data: `${artist} official audio` });
      if (searchData && searchData.length > 0) {
        // Use RPC to get recommendations based on first result
        const related = await getRecommendationsFn({ data: searchData[0].id || searchData[0].youtubeId || searchData[0].title });
        if (related) mixedTracks = [...mixedTracks, ...related];
      }
    }

    const unique = Array.from(new Map(mixedTracks.map(t => [t.id || t.youtubeId, t])).values());
    const shuffled = unique.sort(() => 0.5 - Math.random()).slice(0, 25);

    // Save to local storage cache immediately
    localStorage.setItem(cacheKey, JSON.stringify({ date: today, mix: shuffled }));

    // Attempt to save to Supabase (might fail silently if columns missing, but local storage covers us)
    await (supabase as any).from('user_profiles').upsert({
      id: session.user.id,
      daily_mix: shuffled,
      daily_mix_date: today,
    }, { onConflict: 'id' });

    return shuffled;
  } catch (error) {
    console.error('Error generating daily mix:', error);
    return null;
  }
}


