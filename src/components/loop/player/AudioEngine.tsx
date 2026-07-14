import { useEffect, useRef } from "react";
import { usePlayback } from "@/hooks/usePlayback";
import { getPlaybackSourceFn } from "@/functions/search";
import { getLyricsFn } from "@/functions/lyrics";
import { getOfflineTrack } from "@/lib/offlineDB";

// ── YouTube ID prefetch cache ─────────────────────────────────────
// Maps track.id → resolved YouTube video ID
// Populated while current track plays so next track starts instantly
const ytIdCache = new Map<string, string>();

async function prefetchYtId(trackId: string, trackName: string, artistName: string, existingYtId?: string) {
  if (ytIdCache.has(trackId)) return;
  const id = existingYtId ?? await getPlaybackSourceFn({
    data: { trackName, artistName },
  }).catch(() => null);
  if (id) ytIdCache.set(trackId, id);
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function AudioEngine() {
  const playerRef = useRef<any>(null);
  const trackIdRef = useRef<string | null>(null);
  const isReadyRef = useRef(false);
  const progressRafRef = useRef<number | null>(null);
  const currentYtIdRef = useRef<string | null>(null);
  const hasPlayedOnceRef = useRef(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Offline playback refs
  const offlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingOfflineRef = useRef(false);

  // When true, we are mid-transition between tracks.
  // YouTube fires a PAUSED event when loadVideoById() interrupts a playing track.
  // Without this flag, that PAUSED event sets isPlaying=false and the new track never plays.
  const isTransitioningRef = useRef(false);

  const {
    setDuration,
    setYoutubePlayerReady,
    setLoadingTrack,
    setPlaying,
    clearSeekTarget,
    nextTrack,
  } = usePlayback.getState();

  const fadeAudio = (targetVolume: number, onComplete?: () => void) => {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    if (!playerRef.current?.getVolume || !playerRef.current?.setVolume) {
      onComplete?.();
      return;
    }
    const startVol = playerRef.current.getVolume();
    const diff = targetVolume - startVol;
    if (Math.abs(diff) < 2) {
      playerRef.current.setVolume(targetVolume);
      onComplete?.();
      return;
    }
    const steps = 15;
    const stepVal = diff / steps;
    let currentStep = 0;
    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      playerRef.current?.setVolume?.(startVol + stepVal * currentStep);
      if (currentStep >= steps) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        playerRef.current?.setVolume?.(targetVolume);
        onComplete?.();
      }
    }, 20);
  };

  // ── 1. Initialize YouTube IFrame API (once) ────────────────────
  useEffect(() => {
    const initPlayer = () => {
      playerRef.current = new window.YT.Player("youtube-headless-player", {
        height: "200",
        width: "200",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            setYoutubePlayerReady(true);
            playerRef.current.setVolume(usePlayback.getState().volume);
          },

          onStateChange: (event: any) => {
            const YTState = window.YT.PlayerState;

            if (event.data === YTState.PLAYING) {
              isTransitioningRef.current = false;
              setLoadingTrack(false);
              setPlaying(true);
              const dur = playerRef.current?.getDuration?.() ?? 0;
              if (dur > 0) setDuration(dur);
              startProgressLoop();
              updateMediaSessionPosition();
              if (playerRef.current?.getVolume?.() === 0 || usePlayback.getState().isPlaying) {
                fadeAudio(usePlayback.getState().volume);
              }
            }

            if (event.data === YTState.PAUSED) {
              if (isTransitioningRef.current) return;
              setPlaying(false);
              stopProgressLoop();
            }

            if (event.data === YTState.BUFFERING) {
              setLoadingTrack(true);
            }

            if (event.data === YTState.ENDED) {
              stopProgressLoop();
              nextTrack();
            }

            if (event.data === YTState.UNSTARTED || event.data === YTState.CUED) {
              if (usePlayback.getState().isPlaying) {
                playerRef.current?.playVideo?.();
              } else if (event.data === YTState.CUED) {
                isTransitioningRef.current = false;
                setLoadingTrack(false);
                const dur = playerRef.current?.getDuration?.() ?? 0;
                if (dur > 0) setDuration(dur);
              }
            }
          },

          onError: (e: any) => {
            console.warn("[AudioEngine] YT error", e.data);
            isTransitioningRef.current = false;
            setLoadingTrack(false);
            stopProgressLoop();
            nextTrack();
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => stopProgressLoop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RAF-based progress loop ─────────────────────────────────────
  function startProgressLoop() {
    stopProgressLoop();
    const tick = () => {
      if (playerRef.current?.getCurrentTime) {
        const t = playerRef.current.getCurrentTime();
        const d = playerRef.current.getDuration?.() ?? 0;
        usePlayback.setState({
          progress: t,
          duration: d > 0 ? d : usePlayback.getState().duration,
        });
        // Keep lock screen progress bar in sync
        updateMediaSessionPosition();
      }
      progressRafRef.current = requestAnimationFrame(tick);
    };
    progressRafRef.current = requestAnimationFrame(tick);
  }

  function stopProgressLoop() {
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }

  function updateMediaSessionPosition() {
    const state = usePlayback.getState();
    const dur = playerRef.current?.getDuration?.() ?? state.duration;
    const pos = playerRef.current?.getCurrentTime?.() ?? state.progress;
    if ("mediaSession" in navigator && dur > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(dur, 0),
          playbackRate: 1.0,
          position: Math.max(0, Math.min(pos, dur)),
        });
      } catch (e) {}
    }
  }

  // Handle native audio (offline) events
  useEffect(() => {
    const audio = offlineAudioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (isPlayingOfflineRef.current) {
        usePlayback.setState({
          progress: audio.currentTime,
          duration: audio.duration || usePlayback.getState().duration,
        });
        const dur = audio.duration;
        const pos = audio.currentTime;
        if ("mediaSession" in navigator && dur > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration: Math.max(dur, 0),
              playbackRate: 1.0,
              position: Math.max(0, Math.min(pos, dur)),
            });
          } catch (e) {}
        }
      }
    };

    const onEnded = () => {
      if (isPlayingOfflineRef.current) nextTrack();
    };
    const onPlay = () => { if (isPlayingOfflineRef.current) setPlaying(true); };
    const onPause = () => { if (isPlayingOfflineRef.current) setPlaying(false); };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [nextTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Load new track when ID changes ──────────────────────────
  const currentTrackId = usePlayback((s) => s.currentTrack?.id);
  const currentTrack = usePlayback((s) => s.currentTrack);
  const youtubePlayerReady = usePlayback((s) => s.youtubePlayerReady);

  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current?.loadVideoById) return;
    if (!currentTrack) {
      playerRef.current.stopVideo?.();
      trackIdRef.current = null;
      hasPlayedOnceRef.current = false;
      isTransitioningRef.current = false;
      stopProgressLoop();
      return;
    }

    if (currentTrack.id === trackIdRef.current) return;

    trackIdRef.current = currentTrack.id;
    setLoadingTrack(true);
    stopProgressLoop();
    isTransitioningRef.current = true;

    let cancelled = false;

    (async () => {
      // 1. Check Offline DB First
      const offlineData = await getOfflineTrack(currentTrack.id);
      if (cancelled) return;

      if (offlineData) {
        isPlayingOfflineRef.current = true;
        playerRef.current?.stopVideo?.();
        isTransitioningRef.current = false;

        if (offlineAudioRef.current) {
          if (offlineAudioRef.current.src.startsWith("blob:")) {
            URL.revokeObjectURL(offlineAudioRef.current.src);
          }
          offlineAudioRef.current.src = URL.createObjectURL(offlineData.audioBlob);
          offlineAudioRef.current.currentTime = 0;
          offlineAudioRef.current.volume = usePlayback.getState().volume / 100;

          setDuration(currentTrack.durationMs ? currentTrack.durationMs / 1000 : 0);
          setLoadingTrack(false);

          if (usePlayback.getState().isPlaying) {
            offlineAudioRef.current.play().catch(console.error);
          }
        }
        return;
      }

      // 2. Fallback to YouTube IFrame (reliable, always works)
      isPlayingOfflineRef.current = false;
      offlineAudioRef.current?.pause();

      // ✅ Cache-first: if we prefetched this ID already, use it instantly (0ms wait)
      let ytId = currentTrack.youtubeId ?? ytIdCache.get(currentTrack.id) ?? null;
      if (!ytId) {
        ytId = await getPlaybackSourceFn({
          data: { trackName: currentTrack.title, artistName: currentTrack.artist },
        }).catch(() => null);
      }
      // Store in cache so future loads of same track are instant
      if (ytId) ytIdCache.set(currentTrack.id, ytId);

      if (cancelled) return;

      if (ytId) {
        currentYtIdRef.current = ytId;
        if (usePlayback.getState().isPlaying) {
          hasPlayedOnceRef.current = true;
          playerRef.current?.loadVideoById({ videoId: ytId, startSeconds: 0 });
        } else {
          playerRef.current?.cueVideoById({ videoId: ytId, startSeconds: 0 });
        }
        playerRef.current?.setVolume(usePlayback.getState().volume);

        // 🚀 Background prefetch next 3 tracks in queue while current plays
        if (prefetchTimeoutRef.current) clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = setTimeout(() => {
          const queue = usePlayback.getState().queue.slice(0, 3);
          queue.forEach((t) => {
            if (!ytIdCache.has(t.id)) {
              prefetchYtId(t.id, t.title, t.artist, t.youtubeId);
            }
          });
        }, 3000); // Start prefetching 3 seconds into playback
      } else {
        isTransitioningRef.current = false;
        setLoadingTrack(false);
        nextTrack();
      }
    })();

    // Safety net: if track never reaches PLAYING after 15s, skip
    const stuckTimeout = setTimeout(() => {
      if (usePlayback.getState().isLoadingTrack && !isPlayingOfflineRef.current) {
        console.warn("[AudioEngine] 15s timeout — skipping stuck track");
        isTransitioningRef.current = false;
        setLoadingTrack(false);
        nextTrack();
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearTimeout(stuckTimeout);
    };
  }, [currentTrackId, youtubePlayerReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Toggle play/pause for SAME track ───────────────────────
  const isPlaying = usePlayback((s) => s.isPlaying);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;
    if (isTransitioningRef.current) return;
    if (!currentTrackId || currentTrackId !== trackIdRef.current) return;

    if (isPlaying) {
      if (isPlayingOfflineRef.current) {
        offlineAudioRef.current?.play().catch(console.error);
        silentAudioRef.current?.play().catch(() => {});
        return;
      }

      const state = playerRef.current.getPlayerState?.();
      const YTState = window.YT?.PlayerState;

      playerRef.current.setVolume?.(0);
      silentAudioRef.current?.play().catch(() => {});

      if (!hasPlayedOnceRef.current || state === YTState?.CUED || state === YTState?.UNSTARTED) {
        const videoId = playerRef.current.getVideoData?.()?.video_id || currentYtIdRef.current;
        if (videoId) {
          hasPlayedOnceRef.current = true;
          playerRef.current.loadVideoById?.({ videoId, startSeconds: 0 });
        } else {
          playerRef.current.playVideo?.();
        }
      } else {
        playerRef.current.playVideo?.();
      }
      fadeAudio(usePlayback.getState().volume);
    } else {
      if (isPlayingOfflineRef.current) {
        offlineAudioRef.current?.pause();
        silentAudioRef.current?.pause();
        return;
      }

      fadeAudio(0, () => {
        playerRef.current?.pauseVideo?.();
        silentAudioRef.current?.pause();
      });
    }
  }, [isPlaying, youtubePlayerReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4. Seek ───────────────────────────────────────────────────
  const seekTarget = usePlayback((s) => s.seekTarget);

  useEffect(() => {
    if (seekTarget !== null) {
      if (isPlayingOfflineRef.current && offlineAudioRef.current) {
        offlineAudioRef.current.currentTime = seekTarget;
        usePlayback.setState({ progress: seekTarget });
        clearSeekTarget();
      } else if (playerRef.current?.seekTo) {
        playerRef.current.seekTo(seekTarget, true);
        usePlayback.setState({ progress: seekTarget });
        clearSeekTarget();
      }

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

  // ── 5. Volume sync ─────────────────────────────────────────────
  const volume = usePlayback((s) => s.volume);
  const duration = usePlayback((s) => s.duration);

  useEffect(() => {
    if (isPlayingOfflineRef.current && offlineAudioRef.current) {
      offlineAudioRef.current.volume = volume / 100;
      return;
    }
    if (usePlayback.getState().isPlaying) {
      fadeAudio(volume);
    }
  }, [volume]);

  // Sync MediaSession position state on duration/playing changes
  useEffect(() => {
    if ("mediaSession" in navigator && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 0),
          playbackRate: isPlaying ? 1.0 : 0,
          position: Math.max(0, Math.min(usePlayback.getState().progress, duration)),
        });
      } catch (e) {}
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
    <>
      <div
        id="youtube-headless-player"
        className="fixed -z-50 opacity-0 pointer-events-none -left-[2000px] -top-[2000px]"
        style={{ width: "200px", height: "200px" }}
        aria-hidden="true"
      />
      <audio
        ref={offlineAudioRef}
        className="hidden"
        playsInline
      />
      {/* Silent audio keeps the media session alive on iOS/Android when screen locks */}
      <audio
        ref={silentAudioRef}
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        loop
        playsInline
      />
    </>
  );
}
