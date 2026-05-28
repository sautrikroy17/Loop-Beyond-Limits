/**
 * useUserProfile — Cloud-synced user data store
 *
 * Strategy: "Cloud-first, local cache"
 *  - Zustand state = source of truth for the UI
 *  - When user is authenticated: every mutation also writes to Supabase
 *  - On login: `loadFromCloud(userId)` fetches everything from Supabase
 *    and replaces local state
 *  - Unauthenticated users still get localStorage persistence as before
 *
 * Tables needed: run supabase/schema.sql in your Supabase dashboard first.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track } from './usePlayback';
import {
  fetchLikedSongs, insertLikedSong, deleteLikedSong,
  fetchPlaylists, createPlaylistDB, updatePlaylistDB, deletePlaylistDB,
  addTrackToPlaylistDB, removeTrackFromPlaylistDB,
  fetchRecentlyPlayed, insertRecentlyPlayed,
  fetchUserProfile, upsertUserProfile, uploadAvatar,
} from '@/lib/supabase/db';

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  coverArt?: string;
}

interface UserProfileState {
  // Data
  likedTrackIds:  string[];
  likedTracks:    Track[];
  recentlyPlayed: Track[];
  playlists:      Playlist[];
  customAvatarUrl: string | null;  // Uploaded avatar (overrides Google avatar)

  // Sync state
  _syncedUserId: string | null;    // user ID we last synced for
  _syncing: boolean;

  // Actions
  likeTrack:               (track: Track, userId?: string) => void;
  unlikeTrack:             (id: string, userId?: string) => void;
  isLiked:                 (id: string) => boolean;
  addToRecentlyPlayed:     (track: Track, userId?: string) => void;
  createPlaylist:          (name: string, coverArt?: string, userId?: string) => Playlist;
  deletePlaylist:          (id: string, userId?: string) => void;
  addTrackToPlaylist:      (playlistId: string, track: Track, userId?: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string, userId?: string) => void;
  renamePlaylist:          (id: string, newName: string, userId?: string) => void;
  updatePlaylistCover:     (id: string, coverArt: string, userId?: string) => void;
  reorderPlaylist:         (id: string, startIndex: number, endIndex: number) => void;
  clearHistory:            () => void;

  // Avatar
  updateAvatar:            (file: File, userId: string) => Promise<string | null>;

  // Cloud sync
  loadFromCloud:           (userId: string) => Promise<void>;
  clearLocalData:          () => void;
}

export const useUserProfile = create<UserProfileState>()(
  persist(
    (set, get) => ({
      likedTrackIds:   [],
      likedTracks:     [],
      recentlyPlayed:  [],
      playlists:       [],
      customAvatarUrl: null,
      _syncedUserId:   null,
      _syncing:        false,

      // ── Likes ──────────────────────────────────────────────────────
      likeTrack: (track, userId) => {
        set((s) => {
          if (s.likedTrackIds.includes(track.id)) return s;
          return {
            likedTrackIds: [track.id, ...s.likedTrackIds],
            likedTracks:   [track, ...s.likedTracks],
          };
        });
        if (userId) insertLikedSong(userId, track).catch(console.error);
      },

      unlikeTrack: (id, userId) => {
        set((s) => ({
          likedTrackIds: s.likedTrackIds.filter((i) => i !== id),
          likedTracks:   s.likedTracks.filter((t) => t.id !== id),
        }));
        if (userId) deleteLikedSong(userId, id).catch(console.error);
      },

      isLiked: (id) => get().likedTrackIds.includes(id),

      // ── Recently Played ────────────────────────────────────────────
      addToRecentlyPlayed: (track, userId) => {
        set((s) => {
          const filtered = s.recentlyPlayed.filter((t) => t.id !== track.id);
          return { recentlyPlayed: [track, ...filtered].slice(0, 50) };
        });
        if (userId) insertRecentlyPlayed(userId, track).catch(console.error);
      },

      // ── Playlists ──────────────────────────────────────────────────
      createPlaylist: (name, coverArt, userId) => {
        const playlist: Playlist = {
          id:        `pl_${Date.now()}`,
          name,
          tracks:    [],
          createdAt: Date.now(),
          ...(coverArt ? { coverArt } : {}),
        };
        set((s) => ({ playlists: [playlist, ...s.playlists] }));
        if (userId) createPlaylistDB(userId, playlist.id, name, coverArt).catch(console.error);
        return playlist;
      },

      deletePlaylist: (id, userId) => {
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
        if (userId) deletePlaylistDB(id).catch(console.error);
      },

      addTrackToPlaylist: (playlistId, track, userId) => {
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId || p.tracks.find((t) => t.id === track.id)) return p;
            return { ...p, tracks: [...p.tracks, track] };
          }),
        }));
        if (userId) {
          const position = (get().playlists.find((p) => p.id === playlistId)?.tracks.length ?? 0);
          addTrackToPlaylistDB(playlistId, track, position).catch(console.error);
        }
      },

      removeTrackFromPlaylist: (playlistId, trackId, userId) => {
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
              : p,
          ),
        }));
        if (userId) removeTrackFromPlaylistDB(playlistId, trackId).catch(console.error);
      },

      renamePlaylist: (id, name, userId) => {
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === id ? { ...p, name } : p)),
        }));
        if (userId) updatePlaylistDB(id, { name }).catch(console.error);
      },

      updatePlaylistCover: (id, coverArt, userId) => {
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === id ? { ...p, coverArt } : p)),
        }));
        if (userId) updatePlaylistDB(id, { cover_art: coverArt }).catch(console.error);
      },

      reorderPlaylist: (id, startIndex, endIndex) =>
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== id) return p;
            const result = [...p.tracks];
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return { ...p, tracks: result };
          }),
        })),

      clearHistory: () => set({ recentlyPlayed: [] }),

      // ── Avatar ─────────────────────────────────────────────────────
      updateAvatar: async (file, userId) => {
        const url = await uploadAvatar(userId, file);
        if (url) set({ customAvatarUrl: url });
        return url;
      },

      // ── Cloud Sync ─────────────────────────────────────────────────

      /**
       * Fetch all user data from Supabase and replace local state.
       * Called once per login.
       */
      loadFromCloud: async (userId) => {
        if (get()._syncing || get()._syncedUserId === userId) return;
        set({ _syncing: true });

        try {
          const [liked, playlists, recent, profile] = await Promise.all([
            fetchLikedSongs(userId),
            fetchPlaylists(userId),
            fetchRecentlyPlayed(userId),
            fetchUserProfile(userId),
          ]);

          set({
            likedTracks:    liked,
            likedTrackIds:  liked.map((t) => t.id),
            playlists:      playlists.map((p) => ({
              id:        p.id,
              name:      p.name,
              tracks:    p.tracks,
              createdAt: p.created_at,
              coverArt:  p.cover_art,
            })),
            recentlyPlayed: recent,
            customAvatarUrl: profile?.avatar_url ?? get().customAvatarUrl,
            _syncedUserId: userId,
          });

        } catch (err) {
          console.error('[useUserProfile] loadFromCloud failed:', err);
        } finally {
          set({ _syncing: false });
        }
      },

      /** Clear local data on logout */
      clearLocalData: () => set({
        likedTrackIds:   [],
        likedTracks:     [],
        recentlyPlayed:  [],
        playlists:       [],
        customAvatarUrl: null,
        _syncedUserId:   null,
      }),
    }),

    {
      name: 'loop-user-profile-v2',
      partialize: (s) => ({
        likedTrackIds:   s.likedTrackIds,
        likedTracks:     s.likedTracks,
        recentlyPlayed:  s.recentlyPlayed,
        playlists:       s.playlists,
        customAvatarUrl: s.customAvatarUrl,
        _syncedUserId:   s._syncedUserId,
      }),
    },
  ),
);

/**
 * Wire usePlayback → useUserProfile for auto-recording recently played tracks.
 * Call once at app root. Pass userId so cloud sync also gets triggered.
 */
export function initProfileSync() {
  import('./usePlayback').then(({ usePlayback }) => {
    import('@/hooks/useAuth').then(({ useAuth }) => {
      let prevTrackId: string | undefined;
      usePlayback.subscribe((state) => {
        if (state.currentTrack && state.currentTrack.id !== prevTrackId) {
          prevTrackId = state.currentTrack.id;
          const userId = useAuth.getState().user?.id;
          useUserProfile.getState().addToRecentlyPlayed(state.currentTrack, userId);
        }
      });
    });
  });
}
