/**
 * useUserProfile — Cloud-synced user data store
 *
 * Strategy: "Cloud-first, local cache"
 *  - Zustand state = source of truth for UI
 *  - Authenticated: every mutation also writes to Supabase immediately
 *  - On every page load (login): re-fetch from Supabase (no stale-sync guard)
 *  - One-time migration: pushes existing localStorage data to Supabase on first
 *    login after the sync feature was deployed
 *
 * Tables: run supabase/schema.sql in Supabase SQL Editor first.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "./usePlayback";
import {
  fetchLikedSongs,
  insertLikedSong,
  deleteLikedSong,
  fetchPlaylists,
  createPlaylistDB,
  updatePlaylistDB,
  deletePlaylistDB,
  addTrackToPlaylistDB,
  removeTrackFromPlaylistDB,
  reorderPlaylistTracksDB,
  fetchRecentlyPlayed,
  insertRecentlyPlayed,
  fetchUserProfile,
  upsertUserProfile,
  fetchSavedAlbums,
  insertSavedAlbum,
  deleteSavedAlbum,
  type SavedAlbum,
} from "@/lib/supabase/db";
import { toast } from "sonner";

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  coverArt?: string;
}

interface UserProfileState {
  // Data
  likedTrackIds: string[];
  likedTracks: Track[];
  recentlyPlayed: Track[];
  playlists: Playlist[];
  savedAlbums: SavedAlbum[];
  customAvatarUrl: string | null;

  // Internal (not persisted — reset on every page load)
  _syncing: boolean;

  // Actions — userId is optional; pass it when user is logged in so data writes to Supabase
  likeTrack: (track: Track, userId?: string) => void;
  unlikeTrack: (id: string, userId?: string) => void;
  isLiked: (id: string) => boolean;

  saveAlbum: (album: SavedAlbum, userId?: string) => void;
  removeAlbum: (albumId: string, userId?: string) => void;
  isAlbumSaved: (albumId: string) => boolean;

  addToRecentlyPlayed: (track: Track, userId?: string) => void;
  createPlaylist: (name: string, coverArt?: string, userId?: string) => Playlist;
  deletePlaylist: (id: string, userId?: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track, userId?: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string, userId?: string) => void;
  renamePlaylist: (id: string, newName: string, userId?: string) => void;
  updatePlaylistCover: (id: string, coverArt: string, userId?: string) => void;
  reorderPlaylist: (id: string, startIndex: number, endIndex: number) => void;
  clearHistory: () => void;

  // Avatar
  setCustomAvatarUrl: (url: string | null) => void;

  // Cloud sync
  loadFromCloud: (userId: string, googleAvatarUrl?: string) => Promise<void>;
  clearLocalData: () => void;
}

// ── One-time migration: push existing localStorage → Supabase ──────────────

const MIGRATION_PREFIX = "loop-cloud-migrated-v1-";

async function migrateLocalToCloud(
  userId: string,
  localLikedTracks: Track[],
  localPlaylists: Playlist[],
  localRecentlyPlayed: Track[],
) {
  const key = `${MIGRATION_PREFIX}${userId}`;
  if (localStorage.getItem(key)) return; // Already done

  console.log("[sync] First-time migration: pushing local data to Supabase…");

  try {
    // Push liked songs (deduplicated by Supabase UNIQUE constraint)
    const likedPromises = localLikedTracks.map((t) => insertLikedSong(userId, t).catch(() => {}));

    // Push playlists + their tracks
    const playlistPromises = localPlaylists.flatMap((pl) => [
      createPlaylistDB(userId, pl.id, pl.name, pl.coverArt).catch(() => {}),
      ...pl.tracks.map((t, i) => addTrackToPlaylistDB(pl.id, t, i).catch(() => {})),
    ]);

    // Push recently played (newest first → play in reverse so newest ends on top)
    const recentPromises = [...localRecentlyPlayed]
      .reverse()
      .slice(0, 10)
      .map((t) => insertRecentlyPlayed(userId, t).catch(() => {}));

    await Promise.all([...likedPromises, ...playlistPromises, ...recentPromises]);

    localStorage.setItem(key, "true");
    console.log("[sync] Migration complete");
  } catch (err) {
    console.error("[sync] Migration failed (will retry next login):", err);
  }
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useUserProfile = create<UserProfileState>()(
  persist(
    (set, get) => ({
      likedTrackIds: [],
      likedTracks: [],
      recentlyPlayed: [],
      playlists: [],
      savedAlbums: [],
      customAvatarUrl: null,
      _syncing: false,

      // ── Likes ────────────────────────────────────────────────────────
      likeTrack: (track, userId) => {
        set((s) => {
          if (s.likedTrackIds.includes(track.id)) return s;
          return {
            likedTrackIds: [track.id, ...s.likedTrackIds],
            likedTracks: [track, ...s.likedTracks],
          };
        });
        if (userId) {
          insertLikedSong(userId, track).catch(console.error);
        }
        toast.success(`Saved to Liked Songs`);
      },

      unlikeTrack: (id, userId) => {
        set((s) => ({
          likedTrackIds: s.likedTrackIds.filter((i) => i !== id),
          likedTracks: s.likedTracks.filter((t) => t.id !== id),
        }));
        if (userId) {
          deleteLikedSong(userId, id).catch(console.error);
        }
        toast.info(`Removed from Liked Songs`);
      },

      isLiked: (id) => get().likedTrackIds.includes(id),

      // ── Saved Albums ────────────────────────────────────────────────
      saveAlbum: (album, userId) => {
        set((s) => {
          if (s.savedAlbums.some((a) => a.id === album.id)) return s;
          return { savedAlbums: [album, ...s.savedAlbums] };
        });
        if (userId) insertSavedAlbum(userId, album).catch(console.error);
      },

      removeAlbum: (albumId, userId) => {
        set((s) => ({
          savedAlbums: s.savedAlbums.filter((a) => a.id !== albumId),
        }));
        if (userId) deleteSavedAlbum(userId, albumId).catch(console.error);
      },

      isAlbumSaved: (albumId) => get().savedAlbums.some((a) => a.id === albumId),

      // ── Recently Played ──────────────────────────────────────────────
      addToRecentlyPlayed: (track, userId) => {
        set((s) => {
          const filtered = s.recentlyPlayed.filter((t) => t.id !== track.id);
          return { recentlyPlayed: [track, ...filtered].slice(0, 10) };
        });
        if (userId) insertRecentlyPlayed(userId, track).catch(console.error);
      },

      // ── Playlists ────────────────────────────────────────────────────
      createPlaylist: (name, coverArt, userId) => {
        const playlist: Playlist = {
          id: `pl_${Date.now()}`,
          name,
          tracks: [],
          createdAt: Date.now(),
          ...(coverArt ? { coverArt } : {}),
        };
        set((s) => ({ playlists: [playlist, ...s.playlists] }));
        import("@/hooks/useAuth").then(({ useAuth }) => {
          const uid = userId || useAuth.getState().user?.id;
          if (uid) createPlaylistDB(uid, playlist.id, name, coverArt).catch(console.error);
        });
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
        import("@/hooks/useAuth").then(({ useAuth }) => {
          const uid = userId || useAuth.getState().user?.id;
          if (uid) {
            const updatedPl = get().playlists.find((p) => p.id === playlistId);
            const position = (updatedPl?.tracks.length ?? 1) - 1;
            const pl = get().playlists.find((p) => p.id === playlistId);
            if (pl) {
              toast.success(`Added ${track.title} to ${pl.name}`);
            }
            addTrackToPlaylistDB(playlistId, track, position).catch(console.error);
          }
        });
      },

      removeTrackFromPlaylist: (playlistId, trackId, userId) => {
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p,
          ),
        }));
        import("@/hooks/useAuth").then(({ useAuth }) => {
          const uid = userId || useAuth.getState().user?.id;
          if (uid) removeTrackFromPlaylistDB(playlistId, trackId).catch(console.error);
        });
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

      reorderPlaylist: (id, startIndex, endIndex) => {
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== id) return p;
            const result = [...p.tracks];
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return { ...p, tracks: result };
          }),
        }));
        
        import("@/hooks/useAuth").then(({ useAuth }) => {
          const uid = useAuth.getState().user?.id;
          if (uid) {
            const updatedPlaylist = get().playlists.find((p) => p.id === id);
            if (updatedPlaylist) {
              reorderPlaylistTracksDB(id, updatedPlaylist.tracks).catch(console.error);
            }
          }
        });
      },

      clearHistory: () => set({ recentlyPlayed: [] }),

      setCustomAvatarUrl: (url) => set({ customAvatarUrl: url }),

      // ── Cloud Sync ───────────────────────────────────────────────────

      /**
       * Fetch all user data from Supabase and MERGE with local state.
       * Strategy: "Merge wins" — never discard data that exists locally
       * but hasn't synced to cloud yet (e.g. liked while offline).
       *
       * Called on every login / page load.
       * Also runs a one-time migration to push existing local data first.
       */
      loadFromCloud: async (userId: string, googleAvatarUrl?: string) => {
        if (get()._syncing) return;
        set({ _syncing: true });

        try {
          const s = get();

          // ── Step 1: migrate local → Supabase (one-time) ─────────────
          await migrateLocalToCloud(userId, s.likedTracks, s.playlists, s.recentlyPlayed);

          // ── Step 2: fetch fresh data from Supabase ───────────────────
          const [dbLiked, dbPlaylists, dbRecent, dbProfile, dbAlbums] = await Promise.all([
            fetchLikedSongs(userId),
            fetchPlaylists(userId),
            fetchRecentlyPlayed(userId),
            fetchUserProfile(userId),
            fetchSavedAlbums(userId),
          ]);

          // ── Step 3: MERGE liked songs (local + cloud) ────────────────
          // Cloud is authoritative, but add any local tracks missing from cloud
          const cloudLikedIds = new Set(dbLiked.map((t) => t.id));
          const localOnlyLiked = s.likedTracks.filter((t) => !cloudLikedIds.has(t.id));

          // Re-push any locally-liked tracks that never made it to cloud
          if (localOnlyLiked.length > 0) {
            console.log(`[sync] Re-pushing ${localOnlyLiked.length} local-only liked tracks to Supabase`);
            localOnlyLiked.forEach((t) => insertLikedSong(userId, t).catch(() => {}));
          }

          // Final merged list: cloud first (newest), then local-only additions
          const mergedLiked = [...dbLiked, ...localOnlyLiked];
          const mergedLikedIds = mergedLiked.map((t) => t.id);

          // ── Step 4: MERGE playlists ───────────────────────────────────
          // Cloud playlists are authoritative for existing playlists.
          // Add any local-only playlists (created offline / not yet synced).
          const playlists: Playlist[] = dbPlaylists.map((p) => ({
            id: p.id,
            name: p.name,
            tracks: p.tracks,
            createdAt: p.created_at,
            coverArt: p.cover_art,
          }));

          // Merge tracks for playlists that exist in both cloud and local
          const mergedPlaylistsWithTracks = playlists.map((cloudPl) => {
            const localPl = s.playlists.find((p) => p.id === cloudPl.id);
            if (!localPl) return cloudPl;

            const cloudTrackIds = new Set(cloudPl.tracks.map((t) => t.id));
            const localOnlyTracks = localPl.tracks.filter((t) => !cloudTrackIds.has(t.id));

            if (localOnlyTracks.length > 0) {
              console.log(`[sync] Re-pushing ${localOnlyTracks.length} local-only tracks for playlist ${cloudPl.name} to Supabase`);
              let position = cloudPl.tracks.length;
              localOnlyTracks.forEach((t) => {
                addTrackToPlaylistDB(cloudPl.id, t, position++).catch(() => {});
              });
            }

            return {
              ...cloudPl,
              tracks: [...cloudPl.tracks, ...localOnlyTracks],
            };
          });

          const cloudPlaylistIds = new Set(playlists.map((p) => p.id));
          const localOnlyPlaylists = s.playlists.filter((p) => !cloudPlaylistIds.has(p.id));

          // Re-push any local-only playlists to cloud
          if (localOnlyPlaylists.length > 0) {
            console.log(`[sync] Re-pushing ${localOnlyPlaylists.length} local-only playlists to Supabase`);
            localOnlyPlaylists.forEach((pl) => {
              createPlaylistDB(userId, pl.id, pl.name, pl.coverArt).catch(() => {});
              pl.tracks.forEach((t, i) => addTrackToPlaylistDB(pl.id, t, i).catch(() => {}));
            });
          }

          const mergedPlaylists = [...mergedPlaylistsWithTracks, ...localOnlyPlaylists];

          // Avatar priority:
          // 1. Existing locally cached customAvatarUrl (this is what the user just set, completely bulletproof)
          // 2. user_profiles.avatar_url (cloud-synced for other devices)
          // 3. Google OAuth avatar
          let avatarUrl: string | null = s.customAvatarUrl || dbProfile?.avatar_url || null;
          if (!avatarUrl && googleAvatarUrl) {
            upsertUserProfile(userId, { avatar_url: googleAvatarUrl }).catch(() => {});
            avatarUrl = googleAvatarUrl;
          }

          set({
            likedTracks: mergedLiked,
            likedTrackIds: mergedLikedIds,
            playlists: mergedPlaylists,
            recentlyPlayed: dbRecent.slice(0, 50), // Keep up to 50 from cloud (DB trigger keeps 50)
            savedAlbums: dbAlbums,
            customAvatarUrl: avatarUrl,
          });

          // Hydrate the local AI intelligence engine with cross-device cloud history
          if (dbRecent.length > 0) {
            import("./useListeningIntelligence").then(({ useListeningIntelligence }) => {
              useListeningIntelligence.getState().hydrateFromCloudHistory(dbRecent);
            });
          }
        } catch (err) {
          console.error("[useUserProfile] loadFromCloud failed:", err);
        } finally {
          set({ _syncing: false });
        }
      },

      /** Clear local data on sign out */
      clearLocalData: () =>
        set({
          likedTrackIds: [],
          likedTracks: [],
          recentlyPlayed: [],
          playlists: [],
          savedAlbums: [],
          customAvatarUrl: null,
        }),
    }),

    {
      name: "loop-user-profile-v2",
      // Do NOT persist _syncing — it should always start as false on page load
      partialize: (s) => ({
        likedTrackIds: s.likedTrackIds,
        likedTracks: s.likedTracks,
        recentlyPlayed: s.recentlyPlayed,
        playlists: s.playlists,
        savedAlbums: s.savedAlbums,
        customAvatarUrl: s.customAvatarUrl,
        // _syncedUserId intentionally excluded — removed from v2
      }),
    },
  ),
);

/**
 * Wire usePlayback → useUserProfile for auto-recording recently played.
 * Call once at app root.
 */
export function initProfileSync() {
  import("./usePlayback").then(({ usePlayback }) => {
    import("@/hooks/useAuth").then(({ useAuth }) => {
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
