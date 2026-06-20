/**
 * realtimeSync.ts — Supabase Realtime for instant cross-device sync
 *
 * Subscribes to postgres_changes on:
 *  - liked_songs  → liked / unliked on another device
 *  - playlists    → playlist created / deleted / renamed on another device
 *  - playlist_tracks → track added / removed on another device
 *
 * When a change arrives from another device, we update the local
 * useUserProfile store directly — no full reload, just a surgical patch.
 *
 * Prerequisites in Supabase dashboard (SQL Editor — run once):
 *   ALTER TABLE public.liked_songs     REPLICA IDENTITY FULL;
 *   ALTER TABLE public.playlists       REPLICA IDENTITY FULL;
 *   ALTER TABLE public.playlist_tracks REPLICA IDENTITY FULL;
 *   ALTER PUBLICATION supabase_realtime ADD TABLE
 *     public.liked_songs, public.playlists, public.playlist_tracks;
 */

import { supabase } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Track } from "@/hooks/usePlayback";

let realtimeChannel: RealtimeChannel | null = null;
let _currentUserId: string | null = null;

// ── Types matching DB row shapes ─────────────────────────────────────

interface LikedSongRow {
  id: string;
  user_id: string;
  track_id: string;
  track_data: Track;
  created_at: string;
}

interface PlaylistRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  cover_art?: string;
  created_at: string;
  updated_at: string;
}

interface PlaylistTrackRow {
  id: string;
  playlist_id: string;
  track_id: string;
  track_data: Track;
  position: number;
  added_at: string;
}

// ── Public API ────────────────────────────────────────────────────────

export function initRealtimeSync(userId: string) {
  // Already subscribed for this user
  if (realtimeChannel && _currentUserId === userId) return;

  // Clean up previous subscription
  stopRealtimeSync();

  _currentUserId = userId;

  const channel = supabase.channel(`loop-user-sync-${userId}`, {
    config: { broadcast: { ack: false } },
  });

  // ── Liked Songs ────────────────────────────────────────────────────
  channel
    .on(
      "postgres_changes" as any,
      {
        event: "INSERT",
        schema: "public",
        table: "liked_songs",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const row = payload.new as LikedSongRow;
        handleLikedSongInsert(row);
      },
    )
    .on(
      "postgres_changes" as any,
      {
        event: "DELETE",
        schema: "public",
        table: "liked_songs",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const row = payload.old as LikedSongRow;
        handleLikedSongDelete(row);
      },
    )

    // ── Playlists ──────────────────────────────────────────────────
    .on(
      "postgres_changes" as any,
      {
        event: "INSERT",
        schema: "public",
        table: "playlists",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const row = payload.new as PlaylistRow;
        handlePlaylistInsert(row);
      },
    )
    .on(
      "postgres_changes" as any,
      {
        event: "UPDATE",
        schema: "public",
        table: "playlists",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const row = payload.new as PlaylistRow;
        handlePlaylistUpdate(row);
      },
    )
    .on(
      "postgres_changes" as any,
      {
        event: "DELETE",
        schema: "public",
        table: "playlists",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const row = payload.old as PlaylistRow;
        handlePlaylistDelete(row);
      },
    )

    // ── Playlist Tracks ────────────────────────────────────────────
    .on(
      "postgres_changes" as any,
      {
        event: "INSERT",
        schema: "public",
        table: "playlist_tracks",
      },
      (payload: any) => {
        const row = payload.new as PlaylistTrackRow;
        handlePlaylistTrackInsert(row);
      },
    )
    .on(
      "postgres_changes" as any,
      {
        event: "DELETE",
        schema: "public",
        table: "playlist_tracks",
      },
      (payload: any) => {
        const row = payload.old as PlaylistTrackRow;
        handlePlaylistTrackDelete(row);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[realtime] Cross-device sync active for user", userId);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[realtime] Sync channel issue:", status);
      }
    });

  realtimeChannel = channel;
}

export function stopRealtimeSync() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    _currentUserId = null;
    console.log("[realtime] Cross-device sync stopped");
  }
}

// ── Handlers — surgically patch local Zustand state ──────────────────

function handleLikedSongInsert(row: LikedSongRow) {
  import("@/hooks/useUserProfile").then(({ useUserProfile }) => {
    const s = useUserProfile.getState();
    // Only add if not already in local state (could be our own write echoed back)
    if (!s.likedTrackIds.includes(row.track_id)) {
      console.log("[realtime] Liked song synced from another device:", row.track_data?.title);
      useUserProfile.setState((prev) => ({
        likedTrackIds: [row.track_id, ...prev.likedTrackIds],
        likedTracks: [row.track_data, ...prev.likedTracks],
      }));
    }
  });
}

function handleLikedSongDelete(row: LikedSongRow) {
  import("@/hooks/useUserProfile").then(({ useUserProfile }) => {
    const trackId = row.track_id;
    if (!trackId) return;
    useUserProfile.setState((prev) => {
      if (!prev.likedTrackIds.includes(trackId)) return prev;
      console.log("[realtime] Unlike synced from another device:", trackId);
      return {
        likedTrackIds: prev.likedTrackIds.filter((id) => id !== trackId),
        likedTracks: prev.likedTracks.filter((t) => t.id !== trackId),
      };
    });
  });
}

function handlePlaylistInsert(row: PlaylistRow) {
  import("@/hooks/useUserProfile").then(({ useUserProfile }) => {
    useUserProfile.setState((prev) => {
      // Don't duplicate if we created it locally
      if (prev.playlists.find((p) => p.id === row.id)) return prev;
      console.log("[realtime] Playlist created on another device:", row.name);
      return {
        playlists: [
          {
            id: row.id,
            name: row.name,
            tracks: [],
            createdAt: new Date(row.created_at).getTime(),
            coverArt: row.cover_art,
          },
          ...prev.playlists,
        ],
      };
    });
  });
}

function handlePlaylistUpdate(row: PlaylistRow) {
  import("@/hooks/useUserProfile").then(({ useUserProfile }) => {
    useUserProfile.setState((prev) => ({
      playlists: prev.playlists.map((p) =>
        p.id === row.id
          ? { ...p, name: row.name, coverArt: row.cover_art ?? p.coverArt }
          : p,
      ),
    }));
  });
}

function handlePlaylistDelete(row: PlaylistRow) {
  import("@/hooks/useUserProfile").then(({ useUserProfile }) => {
    useUserProfile.setState((prev) => {
      if (!prev.playlists.find((p) => p.id === row.id)) return prev;
      console.log("[realtime] Playlist deleted on another device:", row.id);
      return { playlists: prev.playlists.filter((p) => p.id !== row.id) };
    });
  });
}

function handlePlaylistTrackInsert(row: PlaylistTrackRow) {
  import("@/hooks/useUserProfile").then(({ useUserProfile }) => {
    useUserProfile.setState((prev) => ({
      playlists: prev.playlists.map((p) => {
        if (p.id !== row.playlist_id) return p;
        // Already have this track locally
        if (p.tracks.find((t) => t.id === row.track_id)) return p;
        console.log("[realtime] Track added to playlist on another device:", row.track_data?.title);
        return { ...p, tracks: [...p.tracks, row.track_data] };
      }),
    }));
  });
}

function handlePlaylistTrackDelete(row: PlaylistTrackRow) {
  import("@/hooks/useUserProfile").then(({ useUserProfile }) => {
    useUserProfile.setState((prev) => ({
      playlists: prev.playlists.map((p) => {
        if (p.id !== row.playlist_id) return p;
        if (!p.tracks.find((t) => t.id === row.track_id)) return p;
        console.log("[realtime] Track removed from playlist on another device:", row.track_id);
        return { ...p, tracks: p.tracks.filter((t) => t.id !== row.track_id) };
      }),
    }));
  });
}
