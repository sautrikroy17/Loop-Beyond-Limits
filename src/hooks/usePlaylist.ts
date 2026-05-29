/**
 * usePlaylist — Playlist creation & management store
 *
 * Persisted to localStorage.
 * Features:
 *  - Create / rename / delete playlists
 *  - Add / remove tracks from playlists
 *  - Liked Songs is a virtual system playlist
 *  - Recent search history with delete
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "./usePlayback";

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverArt?: string; // first track art by default
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

interface PlaylistState {
  playlists: Playlist[];
  likedTrackIds: Set<string>; // stored as array, hydrated to Set
  likedTracks: Track[];
  recentSearches: string[];

  // Playlist CRUD
  createPlaylist: (name: string, initialTracks?: Track[]) => string; // returns id
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;

  // Likes
  likeTrack: (track: Track) => void;
  unlikeTrack: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;

  // Search history
  addSearchHistory: (query: string) => void;
  deleteSearchHistoryItem: (query: string) => void;
  clearSearchHistory: () => void;
}

let _idCounter = Date.now();
function genId() {
  return `pl_${++_idCounter}`;
}

export const usePlaylist = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      likedTrackIds: new Set<string>(),
      likedTracks: [],
      recentSearches: [],

      createPlaylist: (name, initialTracks = []) => {
        const id = genId();
        const now = Date.now();
        const pl: Playlist = {
          id,
          name,
          tracks: initialTracks,
          coverArt: initialTracks[0]?.albumArt,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ playlists: [...s.playlists, pl] }));
        return id;
      },

      renamePlaylist: (id, name) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
          ),
        })),

      deletePlaylist: (id) =>
        set((s) => ({
          playlists: s.playlists.filter((p) => p.id !== id),
        })),

      addToPlaylist: (playlistId, track) =>
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            if (p.tracks.some((t) => t.id === track.id)) return p; // no dup
            const tracks = [...p.tracks, track];
            return {
              ...p,
              tracks,
              coverArt: p.coverArt || track.albumArt,
              updatedAt: Date.now(),
            };
          }),
        })),

      removeFromPlaylist: (playlistId, trackId) =>
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            const tracks = p.tracks.filter((t) => t.id !== trackId);
            return { ...p, tracks, updatedAt: Date.now() };
          }),
        })),

      likeTrack: (track) =>
        set((s) => {
          if (s.likedTrackIds.has(track.id)) return s;
          const ids = new Set(s.likedTrackIds);
          ids.add(track.id);
          return { likedTrackIds: ids, likedTracks: [track, ...s.likedTracks] };
        }),

      unlikeTrack: (trackId) =>
        set((s) => {
          const ids = new Set(s.likedTrackIds);
          ids.delete(trackId);
          return {
            likedTrackIds: ids,
            likedTracks: s.likedTracks.filter((t) => t.id !== trackId),
          };
        }),

      isLiked: (trackId) => get().likedTrackIds.has(trackId),

      addSearchHistory: (query) => {
        const q = query.trim();
        if (!q) return;
        set((s) => ({
          recentSearches: [q, ...s.recentSearches.filter((r) => r !== q)].slice(0, 20),
        }));
      },

      deleteSearchHistoryItem: (query) =>
        set((s) => ({
          recentSearches: s.recentSearches.filter((r) => r !== query),
        })),

      clearSearchHistory: () => set({ recentSearches: [] }),
    }),

    {
      name: "loop-playlists-v1",
      // Convert Set to array for JSON serialization
      partialize: (s) => ({
        playlists: s.playlists,
        likedTrackIds: Array.from(s.likedTrackIds),
        likedTracks: s.likedTracks,
        recentSearches: s.recentSearches,
      }),
      // Convert array back to Set on hydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.likedTrackIds = new Set(state.likedTrackIds as any);
        }
      },
    },
  ),
);
