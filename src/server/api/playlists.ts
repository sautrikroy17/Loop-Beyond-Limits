import { supabaseServer } from "@/lib/supabase/server";

/**
 * Creates a new playlist for a user.
 */
export async function createPlaylist(userId: string, title: string, description?: string) {
  const { data, error } = await supabaseServer
    .from("playlists")
    // @ts-ignore
    .insert({ user_id: userId, title, description })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Adds a track to a playlist.
 */
export async function addTrackToPlaylist(
  playlistId: string,
  spotifyId: string,
  youtubeId?: string,
) {
  const { data, error } = await supabaseServer
    .from("playlist_tracks")
    // @ts-ignore
    .insert({ playlist_id: playlistId, spotify_id: spotifyId, youtube_id: youtubeId })
    .select();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Tracks listening history for recommendations.
 * To be called inside the Playback hook when a song starts.
 */
export async function trackRecentlyPlayed(userId: string, spotifyId: string, youtubeId?: string) {
  const { error } = await supabaseServer
    .from("recently_played")
    // @ts-ignore
    .insert({ user_id: userId, spotify_id: spotifyId, youtube_id: youtubeId });

  if (error) console.error("Failed to track history:", error.message);
}
