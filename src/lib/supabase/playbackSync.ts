import { supabase } from "./client";
import { usePlayback, type Track } from "@/hooks/usePlayback";
import type { RealtimeChannel } from "@supabase/supabase-js";

let syncChannel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let isApplyingSync = false;
let unsubscribePlayback: (() => void) | null = null;

const localDeviceId = Math.random().toString(36).substring(2, 15);

// ── Types ─────────────────────────────────────────────────────────

type PlaybackSyncEvent = {
  type: "SYNC_STATE" | "SYNC_REQUEST" | "SYNC_PLAY" | "SYNC_PAUSE";
  deviceId: string;
  track?: Track | null;
  queue?: Track[];
  progress?: number;
  isPlaying?: boolean;
};

// ── Initialization ────────────────────────────────────────────────

export function initPlaybackSync(userId: string) {
  if (syncChannel && currentUserId === userId) return;

  if (syncChannel) {
    supabase.removeChannel(syncChannel);
  }

  currentUserId = userId;
  const topic = `playback-sync-${userId}`;

  syncChannel = supabase.channel(topic, {
    config: {
      broadcast: { ack: false },
    },
  });

  syncChannel
    .on("broadcast", { event: "playback-update" }, (payload) => {
      const data = payload.payload as PlaybackSyncEvent;
      // Ignore our own broadcast echoes
      if (data.deviceId === localDeviceId) return;
      handleRemoteEvent(data);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // When we join, ask if anyone is playing anything so we can catch up
        broadcastEvent({ type: "SYNC_REQUEST" });
      }
    });

  // Attach Zustand listener to broadcast out local changes
  unsubscribePlayback = usePlayback.subscribe((state, prevState) => {
    if (isApplyingSync) return;

    // Broadcast if track, queue, or play state changed
    if (
      state.currentTrack?.id !== prevState.currentTrack?.id ||
      state.queue !== prevState.queue ||
      state.isPlaying !== prevState.isPlaying
    ) {
      broadcastEvent({ type: "SYNC_STATE" });
    }
  });
}

export function stopPlaybackSync() {
  if (syncChannel) {
    supabase.removeChannel(syncChannel);
    syncChannel = null;
    currentUserId = null;
  }
  if (unsubscribePlayback) {
    unsubscribePlayback();
    unsubscribePlayback = null;
  }
}

// ── Incoming ──────────────────────────────────────────────────────

function handleRemoteEvent(data: PlaybackSyncEvent) {
  isApplyingSync = true;

  if (data.type === "SYNC_REQUEST") {
    // Another device woke up. If we are playing, tell them what's playing.
    const state = usePlayback.getState();
    if (state.isPlaying && state.currentTrack) {
      broadcastEvent({ type: "SYNC_STATE" });
    }
  } else if (data.type === "SYNC_STATE") {
    usePlayback.setState((state) => {
      const isNewTrack = state.currentTrack?.id !== data.track?.id;

      return {
        currentTrack: data.track ?? state.currentTrack,
        queue: data.queue || state.queue,
        // Only force progress if it's a new track to avoid jumping
        progress: isNewTrack ? data.progress || 0 : state.progress,
        // If the OTHER device is playing, we MUST pause to prevent double-audio
        isPlaying: data.isPlaying ? false : state.isPlaying,
        youtubePlayerReady: isNewTrack ? false : state.youtubePlayerReady,
      };
    });
  }

  // Ensure Zustand listeners that fire synchronously have time to run before unblocking
  setTimeout(() => {
    isApplyingSync = false;
  }, 100);
}

// ── Outgoing ──────────────────────────────────────────────────────

export function broadcastEvent(eventOverride: Partial<PlaybackSyncEvent>) {
  if (!syncChannel || isApplyingSync) return;

  const state = usePlayback.getState();

  const event: PlaybackSyncEvent = {
    type: "SYNC_STATE",
    deviceId: localDeviceId,
    track: state.currentTrack,
    queue: state.queue.slice(0, 50),
    progress: state.progress,
    isPlaying: state.isPlaying,
    ...eventOverride,
  };

  syncChannel
    .send({
      type: "broadcast",
      event: "playback-update",
      payload: event,
    })
    .catch(console.error);
}
