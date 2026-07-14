import { useEffect, useRef } from "react";
import { usePlayback } from "@/hooks/usePlayback";
import { getPlaybackSourceFn } from "@/functions/search";
import { getLyricsFn } from "@/functions/lyrics";
import { getOfflineTrack } from "@/lib/offlineDB";
import { getStreamUrlFn } from "@/functions/download";

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIdRef = useRef<string | null>(null);

  const {
    setDuration,
    setLoadingTrack,
    setPlaying,
    clearSeekTarget,
    nextTrack,
    setYoutubePlayerReady
  } = usePlayback.getState();

  // Let the rest of the app know the player is "ready" immediately
  useEffect(() => {
    setYoutubePlayerReady(true);
  }, [setYoutubePlayerReady]);

  // ── 1. Native Audio Event Handlers ──────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      usePlayback.setState({
        progress: audio.currentTime,
        duration: audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity 
          ? audio.duration 
          : usePlayback.getState().duration,
      });
    };
    
    const onEnded = () => {
      nextTrack();
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    
    const onWaiting = () => setLoadingTrack(true);
    const onPlaying = () => setLoadingTrack(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
    };
  }, [nextTrack, setPlaying, setLoadingTrack]);

  // ── 2. Load Track (Offline or Proxy Stream) ──────────────────────
  const currentTrackId = usePlayback((s) => s.currentTrack?.id);
  const currentTrack = usePlayback((s) => s.currentTrack);

  useEffect(() => {
    if (!currentTrack) {
      audioRef.current?.pause();
      trackIdRef.current = null;
      return;
    }

    if (currentTrack.id === trackIdRef.current) return;
    trackIdRef.current = currentTrack.id;
    setLoadingTrack(true);

    let cancelled = false;

    (async () => {
      const audio = audioRef.current;
      if (!audio) return;
      
      // Clean up previous blob URL if it exists
      if (audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src);
      }

      // 1. Check Offline DB First
      const offlineData = await getOfflineTrack(currentTrack.id);
      if (cancelled) return;

      if (offlineData) {
        audio.src = URL.createObjectURL(offlineData.audioBlob);
      } else {
        // 2. Fetch YouTube streaming ID if needed
        let ytId = currentTrack.youtubeId;
        if (!ytId) {
          ytId = await getPlaybackSourceFn({
            data: { trackName: currentTrack.title, artistName: currentTrack.artist },
          }).catch(() => null);
        }

        if (cancelled) return;

        if (ytId) {
          // Point directly to our true native streaming URL
          const streamUrl = await getStreamUrlFn({ data: { id: ytId } });
          if (cancelled) return;

          if (streamUrl) {
            audio.src = streamUrl;
          } else {
            setLoadingTrack(false);
            nextTrack();
            return;
          }
        } else {
          setLoadingTrack(false);
          nextTrack();
          return;
        }
      }

      audio.currentTime = 0;
      audio.volume = usePlayback.getState().volume / 100;
      
      setDuration(currentTrack.durationMs ? currentTrack.durationMs / 1000 : 0);
      
      if (usePlayback.getState().isPlaying) {
         audio.play().catch(console.error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTrackId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Play/Pause Sync ──────────────────────────────────────────
  const isPlaying = usePlayback((s) => s.isPlaying);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!audioRef.current || !currentTrackId) return;

    if (isPlaying) {
       audioRef.current.play().catch((e) => {
         console.warn("Failed to play native audio", e);
       });
    } else {
       audioRef.current.pause();
    }
  }, [isPlaying, currentTrackId]);

  // ── 4. Seek ─────────────────────────────────────────────────────
  const seekTarget = usePlayback((s) => s.seekTarget);

  useEffect(() => {
    if (seekTarget !== null && audioRef.current) {
      audioRef.current.currentTime = seekTarget;
      usePlayback.setState({ progress: seekTarget });
      clearSeekTarget();
      
      const dur = usePlayback.getState().duration;
      if ("mediaSession" in navigator && dur > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(dur, 0),
            playbackRate: isPlaying ? 1.0 : 0,
            position: Math.max(0, Math.min(seekTarget, dur)),
          });
        } catch (e) {}
      }
    }
  }, [seekTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5. Volume Sync ──────────────────────────────────────────────
  const volume = usePlayback((s) => s.volume);
  const duration = usePlayback((s) => s.duration);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Sync MediaSession position state when play state or duration changes
  useEffect(() => {
    if ("mediaSession" in navigator && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 0),
          playbackRate: isPlaying ? 1.0 : 0,
          position: Math.max(0, Math.min(usePlayback.getState().progress, duration)),
        });
      } catch (e) {
      }
    }
  }, [isPlaying, duration]);

  // ── 6. MediaSession Integration (Lock Screen / Background) ──────
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [{ src: currentTrack.albumArt, sizes: "512x512", type: "image/jpeg" }],
      });

      try {
        navigator.mediaSession.setActionHandler("play", () => {
          usePlayback.getState().setPlaying(true);
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          usePlayback.getState().setPlaying(false);
        });
        navigator.mediaSession.setActionHandler("previoustrack", () =>
          usePlayback.getState().prevTrack(),
        );
        navigator.mediaSession.setActionHandler("nexttrack", () =>
          usePlayback.getState().nextTrack(),
        );
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            usePlayback.getState().seekTo(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler("seekbackward", () => {
          const currentT = usePlayback.getState().progress;
          usePlayback.getState().seekTo(Math.max(currentT - 10, 0));
        });
        navigator.mediaSession.setActionHandler("seekforward", () => {
          const currentT = usePlayback.getState().progress;
          const dur = usePlayback.getState().duration;
          usePlayback.getState().seekTo(Math.min(currentT + 10, dur));
        });
      } catch (e) {
        console.warn("MediaSession action handlers not supported", e);
      }
    }
  }, [currentTrack]);

  // ── 7. Prefetch Lyrics ──────────────────────────────────────────
  const nextTrackInQueue = usePlayback((s) => s.queue[0]);

  useEffect(() => {
    if (currentTrack) {
      getLyricsFn({
        data: {
          title: currentTrack.title,
          artist: currentTrack.artist,
          duration: currentTrack.durationMs ? currentTrack.durationMs / 1000 : undefined,
        },
      }).catch(() => {});
    }
  }, [currentTrack?.id]);

  useEffect(() => {
    if (nextTrackInQueue) {
      getLyricsFn({
        data: {
          title: nextTrackInQueue.title,
          artist: nextTrackInQueue.artist,
          duration: nextTrackInQueue.durationMs ? nextTrackInQueue.durationMs / 1000 : undefined,
        },
      }).catch(() => {});
    }
  }, [nextTrackInQueue?.id]);

  return (
    <audio
      ref={audioRef}
      className="hidden"
      playsInline
      preload="auto"
    />
  );
}
