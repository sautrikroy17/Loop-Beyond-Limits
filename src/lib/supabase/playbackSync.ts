import { supabase } from './client';
import { usePlayback, type Track } from '@/hooks/usePlayback';
import { saveCloudPlaybackState, loadCloudPlaybackState } from './db';
import type { RealtimeChannel } from '@supabase/supabase-js';

let syncChannel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let isApplyingSync = false;
let unsubscribePlayback: (() => void) | null = null;
let beforeUnloadListener: (() => void) | null = null;

const localDeviceId = Math.random().toString(36).substring(2, 15);

// ── Types ─────────────────────────────────────────────────────────

type PlaybackSyncEvent = {
  type: 'SYNC_STATE' | 'SYNC_REQUEST' | 'SYNC_PLAY' | 'SYNC_PAUSE';
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
  
  // 1. Instantly load cloud state as a fallback
  loadCloudPlaybackState(userId).then((cloudState) => {
    // Only apply cloud state if we haven't already started playing something else
    // or received a live WebSocket SYNC_STATE in the meantime
    const currentState = usePlayback.getState();
    if (cloudState && !currentState.currentTrack && !currentState.isPlaying) {
      usePlayback.setState({
        currentTrack: cloudState.currentTrack,
        queue: cloudState.queue || [],
        progress: cloudState.progress || 0,
        isShuffle: cloudState.isShuffle || false,
        repeatMode: cloudState.repeatMode || 'none',
        isPlaying: false, // ALWAYS start paused when booting from cloud
      });
    }
  });

  // 2. Connect WebSockets
  syncChannel = supabase.channel(topic, {
    config: {
      broadcast: { ack: false },
    },
  });

  syncChannel
    .on('broadcast', { event: 'playback-update' }, (payload) => {
      const data = payload.payload as PlaybackSyncEvent;
      // Ignore our own broadcast echoes
      if (data.deviceId === localDeviceId) return;
      handleRemoteEvent(data);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // When we join, ask if anyone is playing anything so we can catch up
        broadcastEvent({ type: 'SYNC_REQUEST' });
      }
    });

  // Attach Zustand listener to broadcast out local changes
  unsubscribePlayback = usePlayback.subscribe((state, prevState) => {
    if (isApplyingSync) return;

    // If track or queue changed, broadcast full state
    if (state.currentTrack?.id !== prevState.currentTrack?.id || state.queue !== prevState.queue) {
      broadcastEvent({ type: 'SYNC_STATE' });
      // Save snapshot to cloud database for true offline resuming
      saveCloudPlaybackState(userId, {
        currentTrack: state.currentTrack,
        queue: state.queue.slice(0, 50),
        progress: state.progress,
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode
      });
    }
    // If we just hit play, tell other devices to pause
    else if (state.isPlaying && !prevState.isPlaying) {
      broadcastEvent({ type: 'SYNC_PLAY' });
    }
    // If we just paused, tell other devices
    else if (!state.isPlaying && prevState.isPlaying) {
      broadcastEvent({ type: 'SYNC_PAUSE' });
      // Save snapshot to cloud on pause
      saveCloudPlaybackState(userId, {
        currentTrack: state.currentTrack,
        queue: state.queue.slice(0, 50),
        progress: state.progress,
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode
      });
    }
  });

  if (typeof window !== 'undefined') {
    beforeUnloadListener = () => {
      const state = usePlayback.getState();
      if (state.currentTrack) {
        // Use keepalive or a synchronous-like beacon to save data on close
        saveCloudPlaybackState(userId, {
          currentTrack: state.currentTrack,
          queue: state.queue.slice(0, 50),
          progress: state.progress,
          isShuffle: state.isShuffle,
          repeatMode: state.repeatMode
        });
      }
    };
    window.addEventListener('beforeunload', beforeUnloadListener);
  }
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
  if (beforeUnloadListener && typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', beforeUnloadListener);
    beforeUnloadListener = null;
  }
}

// ── Incoming ──────────────────────────────────────────────────────

function handleRemoteEvent(data: PlaybackSyncEvent) {
  isApplyingSync = true;
  
  if (data.type === 'SYNC_REQUEST') {
    // Another device just woke up and wants to know what's playing.
    // If we are actively playing, we should respond with our state.
    const state = usePlayback.getState();
    if (state.isPlaying && state.currentTrack) {
      broadcastEvent({ type: 'SYNC_STATE' });
    }
  } 
  else if (data.type === 'SYNC_STATE') {
    usePlayback.setState((state) => {
      if (state.currentTrack?.id !== data.track?.id) {
        return {
          currentTrack: data.track ?? null,
          queue: data.queue || state.queue,
          progress: data.progress || 0,
          // Handoff: We receive the new track, but we DO NOT auto-play it. 
          // We wait for the user to explicitly hit play on this device.
          isPlaying: false,
          youtubePlayerReady: false,
        };
      }
      return state;
    });
  }
  else if (data.type === 'SYNC_PLAY') {
    // Another device just started playing! We must pause ourselves to prevent double-audio.
    usePlayback.setState({ isPlaying: false });
  }
  else if (data.type === 'SYNC_PAUSE') {
    // Another device just paused. We just pause as well.
    usePlayback.setState({ isPlaying: false });
  }
  
  // Ensure Zustand listeners that fire synchronously have time to run before unblocking
  setTimeout(() => {
    isApplyingSync = false;
  }, 50);
}

// ── Outgoing ──────────────────────────────────────────────────────

export function broadcastEvent(eventOverride: Partial<PlaybackSyncEvent>) {
  if (!syncChannel || isApplyingSync) return;

  const state = usePlayback.getState();
  
  const event: PlaybackSyncEvent = {
    type: eventOverride.type || 'SYNC_STATE',
    deviceId: localDeviceId,
    track: state.currentTrack,
    queue: state.queue.slice(0, 50),
    progress: state.progress,
    isPlaying: state.isPlaying,
    ...eventOverride,
  };

  syncChannel.send({
    type: 'broadcast',
    event: 'playback-update',
    payload: event,
  }).catch(console.error);
}
