import { useEffect, useRef } from "react";
import { usePlayback } from "@/hooks/usePlayback";
import { getPlaybackSourceFn } from "@/functions/search";
import { getLyricsFn } from "@/functions/lyrics";
import { getOfflineTrack } from "@/lib/offlineDB";

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
  
  // Offline playback refs
  const offlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingOfflineRef = useRef(false);

  // KEY FIX: When true, we are mid-transition between tracks.
  // YouTube fires a PAUSED event when loadVideoById() interrupts a playing track.
  // Without this flag, that PAUSED event sets isPlaying=false, and the new track
  // never gets told to play — causing every other track to silently stall.
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
    }, 20); // 300ms total fade
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
              // Transition complete — new track is successfully playing
              isTransitioningRef.current = false;
              setLoadingTrack(false);
              setPlaying(true);
              const dur = playerRef.current?.getDuration?.() ?? 0;
              if (dur > 0) setDuration(dur);
              startProgressLoop();
              
              // Fade in if starting from 0 (e.g. new track or resuming)
              if (playerRef.current?.getVolume?.() === 0 || usePlayback.getState().isPlaying) {
                fadeAudio(usePlayback.getState().volume);
              }
            }

            if (event.data === YTState.PAUSED) {
              // CRITICAL: Suppress PAUSED events during track transitions.
              // When loadVideoById() stops the current track, YouTube fires PAUSED.
              // If we process that, isPlaying becomes false and the new track never plays.
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
              // Only force-play if the user actually intends to play.
              // DO NOT check isTransitioningRef here — that flag is only for
              // suppressing stale PAUSED events, not for forcing playback.
              // This prevents the restored track from auto-playing on page load.
              if (usePlayback.getState().isPlaying) {
                playerRef.current?.playVideo?.();
              } else if (event.data === YTState.CUED) {
                // Track successfully cued and waiting to be played.
                // End the transition and loading state.
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

  // Handle native audio events
  useEffect(() => {
    const audio = offlineAudioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (isPlayingOfflineRef.current) {
        usePlayback.setState({
          progress: audio.currentTime,
          duration: audio.duration || usePlayback.getState().duration,
        });
      }
    };
    
    const onEnded = () => {
      if (isPlayingOfflineRef.current) {
        nextTrack();
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [nextTrack]);

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

    // Begin transition — PAUSED events are suppressed until PLAYING fires
    isTransitioningRef.current = true;

    let cancelled = false;

    (async () => {
      // 1. Check Offline DB First
      const offlineData = await getOfflineTrack(currentTrack.id);
      if (cancelled) return;

      if (offlineData) {
        isPlayingOfflineRef.current = true;
        // Stop YouTube player
        playerRef.current?.stopVideo?.();
        isTransitioningRef.current = false;
        
        if (offlineAudioRef.current) {
          // If we had a previous blob url, revoke it to avoid memory leaks
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

      // 2. Fallback to YouTube
      isPlayingOfflineRef.current = false;
      offlineAudioRef.current?.pause();

      let ytId = currentTrack.youtubeId;
      if (!ytId) {
        ytId = await getPlaybackSourceFn({
          data: { trackName: currentTrack.title, artistName: currentTrack.artist },
        }).catch(() => null);
      }

      if (cancelled) return;

      if (ytId) {
        currentYtIdRef.current = ytId;
        const startSeconds = 0; // Always start from beginning per user request
        if (usePlayback.getState().isPlaying) {
          hasPlayedOnceRef.current = true;
          playerRef.current?.loadVideoById({ videoId: ytId, startSeconds });
        } else {
          playerRef.current?.cueVideoById({ videoId: ytId, startSeconds });
        }
        playerRef.current?.setVolume(usePlayback.getState().volume);
      } else {
        isTransitioningRef.current = false;
        setLoadingTrack(false);
        nextTrack();
      }
    })();

    // Safety net: if track never reaches PLAYING after 10s, skip
    const stuckTimeout = setTimeout(() => {
      if (usePlayback.getState().isLoadingTrack && !isPlayingOfflineRef.current) {
        console.warn("[AudioEngine] 10s timeout — skipping stuck track");
        isTransitioningRef.current = false;
        setLoadingTrack(false);
        nextTrack();
      }
    }, 10000);

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
    // Don't touch the player during transitions — it would race with loading
    if (isTransitioningRef.current) return;
    if (!currentTrackId || currentTrackId !== trackIdRef.current) return;

    if (isPlaying) {
      if (isPlayingOfflineRef.current) {
         offlineAudioRef.current?.play().catch(console.error);
         return;
      }

      const state = playerRef.current.getPlayerState?.();
      const YTState = window.YT?.PlayerState;

      // Start volume at 0 for fade in
      playerRef.current.setVolume?.(0);

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
      silentAudioRef.current?.play().catch(() => {});
    } else {
      if (isPlayingOfflineRef.current) {
         offlineAudioRef.current?.pause();
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
    }
  }, [seekTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5. Volume sync (Immediate if playing) ─────────────────────
  const volume = usePlayback((s) => s.volume);

  useEffect(() => {
    if (isPlayingOfflineRef.current && offlineAudioRef.current) {
      offlineAudioRef.current.volume = volume / 100;
      return;
    }
    
    if (usePlayback.getState().isPlaying) {
      fadeAudio(volume);
    }
  }, [volume]);

  // ── MediaSession Integration (Dynamic Island / Background) ──────
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [{ src: currentTrack.albumArt, sizes: "512x512", type: "image/jpeg" }],
      });

      try {
        navigator.mediaSession.setActionHandler("play", () => {
          playerRef.current?.playVideo?.();
          usePlayback.getState().setPlaying(true);
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          playerRef.current?.pauseVideo?.();
          usePlayback.getState().setPlaying(false);
        });
        navigator.mediaSession.setActionHandler("previoustrack", () =>
          usePlayback.getState().prevTrack(),
        );
        navigator.mediaSession.setActionHandler("nexttrack", () =>
          usePlayback.getState().nextTrack(),
        );
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (details.seekTime && playerRef.current?.seekTo) {
            playerRef.current.seekTo(details.seekTime, true);
            usePlayback.getState().setProgress(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler("seekbackward", () => {
          const t = Math.max((playerRef.current?.getCurrentTime() || 0) - 10, 0);
          playerRef.current?.seekTo(t, true);
        });
        navigator.mediaSession.setActionHandler("seekforward", () => {
          const t = (playerRef.current?.getCurrentTime() || 0) + 10;
          playerRef.current?.seekTo(t, true);
        });
      } catch (e) {
        console.warn("MediaSession action handlers not supported", e);
      }
    }
  }, [currentTrack]);

  // ── 6. Prefetch Lyrics ────────────────────────────────────────
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
      />
      <audio
        ref={silentAudioRef}
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        loop
        playsInline
      />
    </>
  );
}
