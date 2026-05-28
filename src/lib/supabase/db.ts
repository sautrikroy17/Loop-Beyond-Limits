/**
 * db.ts — Supabase data access layer for Loop
 *
 * All user data (liked songs, playlists, recently played, profile)
 * is stored in Supabase and synced across all browsers/devices.
 *
 * Tables required: run supabase/schema.sql in your Supabase dashboard.
 */

import { supabase } from './client';
import type { Track } from '@/hooks/usePlayback';

// ── Types ───────────────────────────────────────────────────────────

export interface SavedAlbum {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
}

export interface DBPlaylist {
  id: string;
  name: string;
  description?: string;
  cover_art?: string;
  tracks: Track[];
  created_at: number;
  updated_at: number;
}

// ── Liked Songs ─────────────────────────────────────────────────────

export async function fetchLikedSongs(userId: string): Promise<Track[]> {
  const { data, error } = await supabase
    .from('liked_songs')
    .select('track_data, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) { console.error('[db] fetchLikedSongs:', error.message); return []; }
  return (data ?? []).map((r) => r.track_data as Track);
}

export async function insertLikedSong(userId: string, track: Track): Promise<void> {
  const { error } = await supabase
    .from('liked_songs')
    .upsert({ user_id: userId, track_id: track.id, track_data: track }, { onConflict: 'user_id,track_id' });
  if (error) console.error('[db] insertLikedSong:', error.message);
}

export async function deleteLikedSong(userId: string, trackId: string): Promise<void> {
  const { error } = await supabase
    .from('liked_songs')
    .delete()
    .eq('user_id', userId)
    .eq('track_id', trackId);
  if (error) console.error('[db] deleteLikedSong:', error.message);
}

// ── Saved Albums ────────────────────────────────────────────────────

export async function fetchSavedAlbums(userId: string): Promise<SavedAlbum[]> {
  const { data, error } = await supabase
    .from('saved_albums')
    .select('album_data, saved_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) { console.error('[db] fetchSavedAlbums:', error.message); return []; }
  return (data ?? []).map((r) => r.album_data as SavedAlbum);
}

export async function insertSavedAlbum(userId: string, album: SavedAlbum): Promise<void> {
  const { error } = await supabase
    .from('saved_albums')
    .upsert({ user_id: userId, album_id: album.id, album_data: album }, { onConflict: 'user_id,album_id' });
  if (error) console.error('[db] insertSavedAlbum:', error.message);
}

export async function deleteSavedAlbum(userId: string, albumId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_albums')
    .delete()
    .eq('user_id', userId)
    .eq('album_id', albumId);
  if (error) console.error('[db] deleteSavedAlbum:', error.message);
}

// ── Playlists ───────────────────────────────────────────────────────

export async function fetchPlaylists(userId: string): Promise<DBPlaylist[]> {
  const { data: plData, error: plErr } = await supabase
    .from('playlists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (plErr) { console.error('[db] fetchPlaylists:', plErr.message); return []; }
  if (!plData?.length) return [];

  // Fetch all playlist tracks in one query
  const playlistIds = plData.map((p) => p.id);
  const { data: trData } = await supabase
    .from('playlist_tracks')
    .select('playlist_id, track_data, position')
    .in('playlist_id', playlistIds)
    .order('position', { ascending: true });

  const tracksByPlaylist: Record<string, Track[]> = {};
  for (const row of trData ?? []) {
    if (!tracksByPlaylist[row.playlist_id]) tracksByPlaylist[row.playlist_id] = [];
    tracksByPlaylist[row.playlist_id].push(row.track_data as Track);
  }

  return plData.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    cover_art: p.cover_art ?? undefined,
    tracks: tracksByPlaylist[p.id] ?? [],
    created_at: new Date(p.created_at).getTime(),
    updated_at: new Date(p.updated_at).getTime(),
  }));
}

export async function createPlaylistDB(
  userId: string,
  id: string,
  name: string,
  coverArt?: string,
): Promise<void> {
  const { error } = await supabase.from('playlists').insert({
    id,
    user_id: userId,
    name,
    cover_art: coverArt ?? null,
  });
  if (error) console.error('[db] createPlaylist:', error.message);
}

export async function updatePlaylistDB(
  id: string,
  fields: { name?: string; cover_art?: string; updated_at?: string },
): Promise<void> {
  const { error } = await supabase
    .from('playlists')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[db] updatePlaylist:', error.message);
}

export async function deletePlaylistDB(id: string): Promise<void> {
  const { error } = await supabase.from('playlists').delete().eq('id', id);
  if (error) console.error('[db] deletePlaylist:', error.message);
}

export async function addTrackToPlaylistDB(
  playlistId: string,
  track: Track,
  position: number,
): Promise<void> {
  const { error } = await supabase
    .from('playlist_tracks')
    .upsert(
      { playlist_id: playlistId, track_id: track.id, track_data: track, position },
      { onConflict: 'playlist_id,track_id' },
    );
  if (error) console.error('[db] addTrackToPlaylist:', error.message);
  // bump updated_at
  await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId);
}

export async function removeTrackFromPlaylistDB(
  playlistId: string,
  trackId: string,
): Promise<void> {
  const { error } = await supabase
    .from('playlist_tracks')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('track_id', trackId);
  if (error) console.error('[db] removeTrackFromPlaylist:', error.message);
}

// ── Recently Played ─────────────────────────────────────────────────

export async function fetchRecentlyPlayed(userId: string): Promise<Track[]> {
  const { data, error } = await supabase
    .from('recently_played')
    .select('track_data')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(50);

  if (error) { console.error('[db] fetchRecentlyPlayed:', error.message); return []; }
  return (data ?? []).map((r) => r.track_data as Track);
}

export async function insertRecentlyPlayed(userId: string, track: Track): Promise<void> {
  // Delete previous entry for this track (move to top)
  await supabase
    .from('recently_played')
    .delete()
    .eq('user_id', userId)
    .eq('track_id', track.id);

  const { error } = await supabase.from('recently_played').insert({
    user_id: userId,
    track_id: track.id,
    track_data: track,
  });
  if (error) console.error('[db] insertRecentlyPlayed:', error.message);
}

// ── User Profile (avatar) ───────────────────────────────────────────

export async function fetchUserProfile(userId: string): Promise<{ avatar_url?: string; display_name?: string } | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('avatar_url, display_name')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') console.error('[db] fetchUserProfile:', error.message);
  return data ?? null;
}

export async function upsertUserProfile(
  userId: string,
  fields: { avatar_url?: string; display_name?: string },
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) console.error('[db] upsertUserProfile:', error.message);
}

/**
 * Upload an avatar image file to Supabase Storage.
 * Returns the public URL or null on failure.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) {
    console.error('[db] uploadAvatar:', uploadErr.message);
    return null;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = data.publicUrl + `?t=${Date.now()}`; // cache-bust
  await upsertUserProfile(userId, { avatar_url: url });
  
  // Guarantee the avatar survives reload by saving to core auth session metadata
  await supabase.auth.updateUser({ data: { avatar_url: url } });
  
  return url;
}
