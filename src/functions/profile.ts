import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useListeningIntelligence } from "@/hooks/useListeningIntelligence";
import { usePlayback } from "@/hooks/usePlayback";
import { hybridSearchFn, getRecommendationsFn } from "@/functions/search";

let _saveTimeout: any = null;

export async function saveProfileFn() {
  if (_saveTimeout) clearTimeout(_saveTimeout);

  _saveTimeout = setTimeout(async () => {
    const { session } = useAuth.getState();
    if (!session?.user) return;

    const intel = useListeningIntelligence.getState();

    // We still save the top 10 arrays for easy querying/analytics if needed
    const topArtists = intel.getTopArtists(10);
    const topGenres = intel.getTopGenres(10);
    const moodHistory = intel.getTopGenres(1)[0];

    try {
      await (supabase as any).from("user_profiles").upsert(
        {
          id: session.user.id,
          display_name: session.user.user_metadata.full_name,
          avatar_url: session.user.user_metadata.avatar_url,
          top_artists: topArtists,
          top_genres: topGenres,
          mood_history: moodHistory,
          artist_weights: intel.artistWeights,
          genre_weights: intel.genreWeights,
          events: intel.events,
        },
        { onConflict: "id" },
      );
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  }, 10000); // 10-second debounce to protect database
}

export async function loadProfileFn() {
  const { session } = useAuth.getState();
  if (!session?.user) return;

  try {
    const { data, error } = await (supabase as any)
      .from("user_profiles")
      .select("top_artists, top_genres, artist_weights, genre_weights, events")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) throw error;

    const intel = useListeningIntelligence.getState();
    const currentArtists = intel.getTopArtists();

    if (data) {
      // Actively merge cloud profile with local profile flawlessly
      const aw: Record<string, number> = { ...intel.artistWeights };
      const gw: Record<string, number> = { ...intel.genreWeights };
      let events = [...intel.events];

      // Merge exact numeric weights using Math.max to prevent inflation while preserving highest score
      if (data.artist_weights) {
        Object.entries(data.artist_weights).forEach(([key, val]) => {
          aw[key] = Math.max(aw[key] || 0, Number(val));
        });
      } else if (data.top_artists && Array.isArray(data.top_artists)) {
        data.top_artists.forEach((a: string, i: number) => {
          aw[a] = Math.max(aw[a] || 0, 10 - i);
        });
      }

      if (data.genre_weights) {
        Object.entries(data.genre_weights).forEach(([key, val]) => {
          gw[key] = Math.max(gw[key] || 0, Number(val));
        });
      } else if (data.top_genres && Array.isArray(data.top_genres)) {
        data.top_genres.forEach((g: string, i: number) => {
          gw[g] = Math.max(gw[g] || 0, 10 - i);
        });
      }

      // Merge events log (keep 200 most recent unique events)
      if (data.events && Array.isArray(data.events)) {
        const uniqueEvents = new Map();
        [...data.events, ...events].forEach((e) => {
          uniqueEvents.set(e.trackId + e.timestamp, e);
        });
        events = Array.from(uniqueEvents.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 200);
      }

      useListeningIntelligence.setState({ artistWeights: aw, genreWeights: gw, events });

      // If the cloud was missing the raw weights but local had them, push them up
      if (!data.artist_weights && Object.keys(aw).length > 0) {
        saveProfileFn();
      }
    } else if (currentArtists.length > 0) {
      // Cloud is empty, but this device has a rich profile! Upload it to cloud immediately.
      saveProfileFn();
    }
  } catch (error) {
    console.error("Error loading profile:", error);
  }
}

export async function getDailyMixFn() {
  const { session } = useAuth.getState();
  if (!session?.user) return null;

  try {
    // 1. Check local storage first for a lightning-fast cached mix
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `loop_daily_mix_v4_${session.user.id}`;
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
      .from("user_profiles")
      .select("daily_mix, daily_mix_date")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.daily_mix_date === today && profile.daily_mix && profile.daily_mix.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify({ date: today, mix: profile.daily_mix }));
      return profile.daily_mix as any[];
    }

    // 3. Generate new mix
    // CRITICAL FIX: Ensure the cloud taste profile is fully loaded into Zustand BEFORE generating!
    await loadProfileFn();

    const intel = useListeningIntelligence.getState();
    const topArtists = intel.getTopArtists(3);
    const seeds = topArtists.length > 0 ? topArtists : ["Justin Bieber", "The Kid Laroi"];

    let mixedTracks: any[] = [];

    for (const artist of seeds) {
      // Use RPC to search for artist tracks
      const searchData = await hybridSearchFn({ data: `${artist} official audio` });
      if (searchData && searchData.length > 0) {
        // Use RPC to get recommendations based on first result
        const related = await getRecommendationsFn({
          data: searchData[0].id || searchData[0].youtubeId || searchData[0].title,
        });
        if (related) mixedTracks = [...mixedTracks, ...related];
      }
    }

    const unique = Array.from(new Map(mixedTracks.map((t) => [t.id || t.youtubeId, t])).values());
    const shuffled = unique.sort(() => 0.5 - Math.random()).slice(0, 25);

    // Save to local storage cache immediately
    localStorage.setItem(cacheKey, JSON.stringify({ date: today, mix: shuffled }));

    // Attempt to save to Supabase (might fail silently if columns missing, but local storage covers us)
    await (supabase as any).from("user_profiles").upsert(
      {
        id: session.user.id,
        daily_mix: shuffled,
        daily_mix_date: today,
      },
      { onConflict: "id" },
    );

    return shuffled;
  } catch (error) {
    console.error("Error generating daily mix:", error);
    return null;
  }
}
