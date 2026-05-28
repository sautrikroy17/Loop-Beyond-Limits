/**
 * playbackSync.ts — Lean cross-device playback restore
 *
 * Strategy (simple, no race conditions):
 *   ON BOOT   → Load cloud state once. If no track is playing, apply it (paused).
 *   ON CLOSE  → Save snapshot to cloud via keepalive fetch (beforeunload).
 *   NO real-time WebSockets — localStorage handles same-browser restore instantly.
 *   Cloud state is for cross-device "Pick up where you left off" only.
 */

import { supabase } from './client';
import { usePlayback } from '@/hooks/usePlayback';

let userId: string | null = null;
let bootDone = false;
let beforeUnloadListener: (() => void) | null = null;

// ── Public API ────────────────────────────────────────────────────

export async function initPlaybackSync(uid: string) {
  // Only run once per session
  if (userId === uid && bootDone) return;
  userId = uid;
  bootDone = true;

  // 1. Restore from cloud if localStorage has nothing
  const localState = usePlayback.getState();
  if (!localState.currentTrack) {
    try {
      const cloudState = await loadCloudState(uid);
      if (cloudState?.currentTrack) {
        usePlayback.setState({
          currentTrack: cloudState.currentTrack,
          queue: cloudState.queue || [],
          progress: cloudState.progress || 0,
          isShuffle: cloudState.isShuffle || false,
          repeatMode: cloudState.repeatMode || 'none',
          isPlaying: false, // Always start paused — user presses play
        });
      }
    } catch {
      // Silently ignore cloud errors — localStorage is the fallback
    }
  }

  // 2. Save to cloud when tab closes
  if (beforeUnloadListener) {
    window.removeEventListener('beforeunload', beforeUnloadListener);
  }
  beforeUnloadListener = () => {
    const state = usePlayback.getState();
    if (state.currentTrack) {
      saveCloudStateBeacon(uid, state);
    }
  };
  window.addEventListener('beforeunload', beforeUnloadListener);
}

export function stopPlaybackSync() {
  userId = null;
  bootDone = false;
  if (beforeUnloadListener) {
    window.removeEventListener('beforeunload', beforeUnloadListener);
    beforeUnloadListener = null;
  }
}

// ── Cloud Read/Write ──────────────────────────────────────────────

async function loadCloudState(uid: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.user_metadata?.playback_state) return null;
  return data.user.user_metadata.playback_state;
}

function saveCloudStateBeacon(uid: string, state: ReturnType<typeof usePlayback.getState>) {
  // keepalive: true ensures this request completes even as the tab closes
  supabase.auth.getSession().then(({ data }) => {
    const session = data?.session;
    if (!session?.access_token) return;

    const payload = {
      currentTrack: state.currentTrack,
      queue: state.queue.slice(0, 30), // limit size
      progress: state.progress,
      isShuffle: state.isShuffle,
      repeatMode: state.repeatMode,
    };

    const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user`;
    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ data: { playback_state: payload } }),
      keepalive: true,
    }).catch(() => {});
  });
}
