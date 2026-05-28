import { supabase } from './client';
import { usePlayback, type Track } from '@/hooks/usePlayback';
import type { RealtimeChannel } from '@supabase/supabase-js';

let syncChannel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let isApplyingSync = false;
let unsubscribePlayback: (() => void) | null = null;

// ── Types ─────────────────────────────────────────────────────────

type PlaybackSyncEvent = {
  type: 'SYNC_STATE';
  track: Track | null;
  queue: Track[];
  progress: number;
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
    .on('broadcast', { event: 'playback-update' }, (payload) => {
      const data = payload.payload as PlaybackSyncEvent;
      if (data.type === 'SYNC_STATE') {
        applyRemoteState(data);
      }
    })
    .subscribe();

  // Attach Zustand listener to broadcast out local changes
  unsubscribePlayback = usePlayback.subscribe((state, prevState) => {
    // Only broadcast if track or queue changed, and we aren't currently applying a remote state
    if (!isApplyingSync && (state.currentTrack?.id !== prevState.currentTrack?.id || state.queue !== prevState.queue)) {
      broadcastPlaybackState();
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

function applyRemoteState(data: PlaybackSyncEvent) {
  isApplyingSync = true;
  
  usePlayback.setState((state) => {
    // Only update if the track actually changed, to avoid jarring UI jumps
    // when both devices are open.
    if (state.currentTrack?.id !== data.track?.id) {
      return {
        currentTrack: data.track,
        queue: data.queue || state.queue,
        progress: data.progress || 0,
        // Hand-off logic: always stay paused when receiving a remote track change
        isPlaying: false,
        youtubePlayerReady: false,
      };
    }
    return state;
  });
  
  isApplyingSync = false;
}

// ── Outgoing ──────────────────────────────────────────────────────

export function broadcastPlaybackState() {
  // If we don't have a channel or we are currently applying a remote state (to prevent echo)
  if (!syncChannel || isApplyingSync) return;

  const state = usePlayback.getState();
  
  // Only broadcast if we have a track
  if (!state.currentTrack) return;

  const event: PlaybackSyncEvent = {
    type: 'SYNC_STATE',
    track: state.currentTrack,
    queue: state.queue.slice(0, 50), // keep payload size reasonable
    progress: state.progress,
  };

  syncChannel.send({
    type: 'broadcast',
    event: 'playback-update',
    payload: event,
  }).catch(console.error);
}
