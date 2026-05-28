/**
 * PlayerBar — Spotify-style 3-section layout
 *
 * [Left: Track info + Queue + Playlist]
 * [Center: Controls + Seekbar with white track]
 * [Right: Volume with white track + Autoplay + Karaoke]
 *
 * Top edge: EQ canvas — 64 bars that pulse with audio frequency
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Loader2, Mic2, Shuffle, Repeat, Repeat1, Infinity, ListPlus, FolderPlus, Check, Heart, Plus
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePlayback } from '@/hooks/usePlayback';
import { useUserProfile } from '@/hooks/useUserProfile';
import { subscribeToAudio } from '@/hooks/useAudioData';

function fmt(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

// ── EQ Progress Canvas ───────────────────────────────────────────
/**
 * Replaces the static neon line with a full EQ equalizer bar visualization.
 * - 64 bars across the full player width
 * - Bars in the "played" portion rise/fall with actual frequency bins
 * - Bars ahead of playhead = dim grey track
 * - Glow effect behind played bars
 * - Click/drag to seek
 */
function EQProgressCanvas({
  pct,
  onSeek,
}: {
  pct: number;
  onSeek: (pct: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pctRef    = useRef(pct);

  useEffect(() => { pctRef.current = pct; }, [pct]);

  // Handle click/drag to seek
  const handleInteract = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * 100);
  }, [onSeek]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.getBoundingClientRect().width  || window.innerWidth;
      canvas.height = canvas.getBoundingClientRect().height || 16;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const unsub = subscribeToAudio((d) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const p = pctRef.current;
      const progressW = (p / 100) * W;

      ctx.clearRect(0, 0, W, H);

      const numBars = Math.max(32, Math.floor(W / 5));
      const barW    = W / numBars;
      const maxBarH = H - 2;

      // Glow behind progress (soft blur layer)
      if (progressW > 4) {
        const glowGrad = ctx.createLinearGradient(0, 0, progressW, 0);
        glowGrad.addColorStop(0,   'rgba(80, 180, 255, 0.12)');
        glowGrad.addColorStop(0.5, 'rgba(130, 100, 255, 0.12)');
        glowGrad.addColorStop(1,   'rgba(170, 140, 255, 0.10)');
        ctx.fillStyle = glowGrad;
        ctx.filter = 'blur(4px)';
        ctx.fillRect(0, 0, progressW, H);
        ctx.filter = 'none';
      }

      for (let i = 0; i < numBars; i++) {
        const x = i * barW;
        const inProgress = x < progressW;
        const bw = barW - 1.2;

        if (inProgress) {
          // Map to frequency bin
          const binIdx = Math.floor((i / numBars) * d.freqBins.length);
          const amp = d.freqBins[binIdx] || 0;
          const barH = Math.max(2, 2 + amp * maxBarH);

          // Color: blue → purple gradient based on position
          const ratio = i / numBars;
          const r = Math.floor(60  + ratio * 120);  // 60 → 180
          const g = Math.floor(160 - ratio * 60);   // 160 → 100
          const b = 255;
          const a = 0.75 + d.loudness * 0.25;

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
          ctx.fillRect(x, H - barH, bw, barH);

          // Inner glow on bar top
          if (amp > 0.3) {
            ctx.fillStyle = `rgba(255, 255, 255, ${(amp * 0.5).toFixed(2)})`;
            ctx.fillRect(x, H - barH, bw, 1.5);
          }
        } else {
          // Ahead of playhead: dim grey
          ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.fillRect(x, H - 2, bw, 2);
        }
      }

      // White playhead dot
      if (p > 0 && p < 100) {
        const px = progressW;
        ctx.beginPath();
        ctx.arc(px, H / 2 + 1, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
        ctx.shadowColor = 'rgba(150, 120, 255, 0.8)';
        ctx.shadowBlur  = 6;
        ctx.fill();
        ctx.shadowBlur  = 0;
      }
    });

    return () => {
      ro.disconnect();
      unsub();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleInteract}
      className="absolute top-0 inset-x-0 w-full cursor-pointer"
      style={{ height: 16, display: 'block' }}
      title="Seek"
    />
  );
}

// ── Custom Slider (white track + white fill) ─────────────────────

function WhiteSlider({
  value,
  min = 0,
  max = 100,
  step = 0.5,
  onChange,
  onCommit,
  className = '',
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={`group relative flex items-center ${className}`} style={{ height: 16 }}>
      {/* Track */}
      <div className="relative h-[3px] w-full rounded-full bg-white/20">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/80 transition-none"
          style={{ width: `${pct}%` }}
        />
        {/* Thumb (visible on hover) */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${pct}%` }}
        />
      </div>
      {/* Invisible range for interaction */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

// ── Playlist Picker Popup ────────────────────────────────────────

function PlaylistPickerPopup({ onClose }: { onClose: () => void }) {
  const { playlists, addTrackToPlaylist, createPlaylist } = useUserProfile();
  const { currentTrack } = usePlayback();
  const [added, setAdded] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleAdd = (playlistId: string) => {
    if (!currentTrack) return;
    addTrackToPlaylist(playlistId, currentTrack);
    setAdded(playlistId);
    setTimeout(() => onClose(), 800);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !currentTrack) return;
    const newPl = createPlaylist(newPlaylistName.trim());
    addTrackToPlaylist(newPl.id, currentTrack);
    setAdded(newPl.id);
    setNewPlaylistName('');
    setTimeout(() => onClose(), 800);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full right-0 mb-2 w-52 overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl z-50"
      style={{ background: 'oklch(0.08 0.025 260 / 0.98)', backdropFilter: 'blur(24px)' }}
    >
      <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.3em] text-white/30 border-b border-white/[0.06]">
        Add to Playlist
      </div>
      
      {/* Create New Playlist */}
      <form onSubmit={handleCreate} className="border-b border-white/[0.06] p-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="New Playlist..."
          value={newPlaylistName}
          onChange={e => setNewPlaylistName(e.target.value)}
          className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-[11px] text-white placeholder-white/30 outline-none focus:border-white/20 transition-colors"
        />
        <button
          type="submit"
          disabled={!newPlaylistName.trim()}
          className="h-7 w-7 flex items-center justify-center shrink-0 rounded bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white disabled:opacity-30 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </form>

      {playlists.length === 0 ? (
        <div className="px-3 py-5 text-center text-[11px] text-white/30">
          No playlists yet — create one above
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto py-1" style={{ scrollbarWidth: 'none' }}>
          {playlists.map(p => (
            <button
              key={p.id}
              onClick={() => handleAdd(p.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-white/[0.06] flex items-center justify-center">
                {p.coverArt
                  ? <img src={p.coverArt} alt="" className="h-full w-full object-cover" />
                  : <span className="text-[10px] text-white/30">♪</span>
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-white/80">{p.name}</div>
              </div>
              {added === p.id && <Check className="h-3 w-3 shrink-0 text-[oklch(0.72_0.26_248)]" />}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── PlayerBar ─────────────────────────────────────────────────────

export function PlayerBar({ onExpand, onKaraoke }: { onExpand: () => void; onKaraoke: () => void }) {
  const {
    currentTrack, isPlaying, progress, duration, volume, isLoadingTrack,
    isShuffle, repeatMode, isAutoplay,
    togglePlayPause, nextTrack, prevTrack, seekTo, setVolume,
    toggleShuffle, toggleRepeat, toggleAutoplay,
    addToQueue,
  } = usePlayback();

  const [seekDrag, setSeekDrag]         = useState(false);
  const [seekVal,  setSeekVal]          = useState(0);
  const [showPlaylistPicker, setPicker] = useState(false);
  const [queueAdded, setQueueAdded]     = useState(false);

  const { isLiked, likeTrack, unlikeTrack } = useUserProfile();

  const pct         = duration > 0 ? (progress / duration) * 100 : 0;
  const displayTime = seekDrag ? seekVal : progress;

  const handleQueueAdd = () => {
    if (!currentTrack) return;
    addToQueue(currentTrack);
    setQueueAdded(true);
    setTimeout(() => setQueueAdded(false), 1200);
  };

  const handleEQSeek = useCallback((p: number) => {
    if (!duration) return;
    seekTo((p / 100) * duration);
  }, [duration, seekTo]);

  // ── Media Session API — Lock Screen & AirPods Controls ─────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || 'Unknown Track',
      artist: currentTrack.artist || 'Unknown Artist',
      album: 'Loop',
      artwork: currentTrack.albumArt
        ? [
            { src: currentTrack.albumArt, sizes: '512x512', type: 'image/jpeg' },
            { src: currentTrack.albumArt, sizes: '192x192', type: 'image/jpeg' },
          ]
        : [],
    });

    navigator.mediaSession.setActionHandler('play',         () => { if (!isPlaying) togglePlayPause(); });
    navigator.mediaSession.setActionHandler('pause',        () => { if (isPlaying)  togglePlayPause(); });
    navigator.mediaSession.setActionHandler('nexttrack',    () => nextTrack());
    navigator.mediaSession.setActionHandler('previoustrack',() => prevTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seekTo(details.seekTime);
    });

    return () => {
      (['play','pause','nexttrack','previoustrack','seekto'] as MediaSessionAction[]).forEach(
        action => { try { navigator.mediaSession.setActionHandler(action, null); } catch {} }
      );
    };
  }, [currentTrack, isPlaying, togglePlayPause, nextTrack, prevTrack, seekTo]);

  return (
    <AnimatePresence>
      {currentTrack && (
        <motion.div
          key="player-bar"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.05] player-bar-safe"
          style={{
            background: 'oklch(0.07 0.024 260 / 0.96)',
            backdropFilter: 'blur(40px) saturate(180%)',
          }}
        >
          {/* ── EQ + Progress canvas at top edge ── */}
          <EQProgressCanvas pct={pct} onSeek={handleEQSeek} />

          {/* ── Main 3-section bar (offset top by canvas height) ── */}
          <div className="pt-[16px]">
            <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-2 md:px-5 md:py-3">

              {/* ════════════════ LEFT: Track info + quick actions ════════════════ */}
              <div className="flex min-w-0 flex-1 md:w-[240px] md:flex-none shrink-0 items-center gap-3">
                {/* Album art — opens full player on click */}
                <button onClick={onExpand} className="relative shrink-0">
                  <div className="h-11 w-11 overflow-hidden rounded-xl bg-white/8">
                    {currentTrack.albumArt && (
                      <img src={currentTrack.albumArt} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  {isLoadingTrack && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                      <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                    </div>
                  )}
                </button>

                {/* Track name + artist (stacked) */}
                <button onClick={onExpand} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13px] font-semibold leading-tight text-white">
                    {currentTrack.title}
                  </div>
                  <div className="truncate text-[11px] leading-tight text-white/45 mt-0.5">
                    {currentTrack.artist}
                  </div>
                </button>

                {/* Queue (Desktop Only) */}
                <button
                  onClick={handleQueueAdd}
                  title="Add to Queue"
                  className={`hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:bg-white/[0.07] ${
                    queueAdded ? 'text-[oklch(0.72_0.26_248)]' : 'text-white/30 hover:text-white/70'
                  }`}
                >
                  {queueAdded ? <Check className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
                </button>

                {/* Like Button (Desktop Only) */}
                <button
                  onClick={() => {
                    if (!currentTrack) return;
                    if (isLiked(currentTrack.id)) {
                      unlikeTrack(currentTrack.id);
                    } else {
                      likeTrack(currentTrack);
                    }
                  }}
                  title="Like"
                  className={`hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:bg-white/[0.07] ${
                    isLiked(currentTrack?.id || '') ? 'text-red-500 hover:text-red-400' : 'text-white/30 hover:text-white/70'
                  }`}
                >
                  <Heart className="h-4 w-4" fill={isLiked(currentTrack?.id || '') ? 'currentColor' : 'none'} />
                </button>

                {/* Add to Playlist (Desktop Only) */}
                <div className="relative shrink-0 hidden md:block">
                  <button
                    onClick={() => setPicker(v => !v)}
                    title="Add to Playlist"
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-white/[0.07] ${
                      showPlaylistPicker
                        ? 'bg-white/[0.06] text-[oklch(0.72_0.26_248)]'
                        : 'text-white/30 hover:text-white/70'
                    }`}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </button>
                  <AnimatePresence>
                    {showPlaylistPicker && (
                      <PlaylistPickerPopup onClose={() => setPicker(false)} />
                    )}
                  </AnimatePresence>
                </div>

                {/* Mobile Essential Controls (Hidden on Desktop) */}
                <div className="flex items-center gap-1 md:hidden ml-auto">
                  <button
                    onClick={togglePlayPause}
                    disabled={isLoadingTrack}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-40"
                  >
                    {isLoadingTrack
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : isPlaying
                      ? <Pause className="h-5 w-5 fill-current" />
                      : <Play className="h-5 w-5 fill-current ml-0.5" />
                    }
                  </button>
                  <button
                    onClick={nextTrack}
                    className="flex h-10 w-10 items-center justify-center text-white/55 transition-colors active:text-white"
                  >
                    <SkipForward className="h-5 w-5 fill-current" />
                  </button>
                </div>
              </div>

              {/* ════════════════ CENTER: Controls + Seekbar (Desktop Only) ════════════════ */}
              <div className="hidden md:flex flex-1 flex-col items-center gap-2 min-w-0 max-w-[600px] mx-auto">
                {/* Playback controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleShuffle}
                    className={`rounded-full p-2 transition-colors hover:bg-white/[0.06] ${isShuffle ? 'text-white' : 'text-white/28 hover:text-white/60'}`}
                  >
                    <Shuffle className="h-4 w-4" />
                  </button>

                  <button
                    onClick={prevTrack}
                    className="rounded-full p-2 text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <SkipBack className="h-5 w-5 fill-current" />
                  </button>

                  <button
                    onClick={togglePlayPause}
                    disabled={isLoadingTrack}
                    className="mx-1 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.72 0.26 248), oklch(0.68 0.24 286))',
                      boxShadow: '0 0 30px -4px oklch(0.72 0.26 248 / 0.6)',
                    }}
                  >
                    {isLoadingTrack
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : isPlaying
                      ? <Pause className="h-5 w-5 fill-current" />
                      : <Play className="h-5 w-5 fill-current ml-0.5" />
                    }
                  </button>

                  <button
                    onClick={nextTrack}
                    className="rounded-full p-2 text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <SkipForward className="h-5 w-5 fill-current" />
                  </button>

                  <button
                    onClick={toggleRepeat}
                    className={`rounded-full p-2 transition-colors hover:bg-white/[0.06] ${repeatMode !== 'none' ? 'text-white' : 'text-white/28 hover:text-white/60'}`}
                  >
                    {repeatMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                  </button>
                </div>

                {/* Seekbar with white track */}
                <div className="flex w-full items-center gap-2.5">
                  <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-white/32">
                    {fmt(displayTime)}
                  </span>
                  <WhiteSlider
                    value={displayTime}
                    min={0}
                    max={duration || 1}
                    step={0.5}
                    className="flex-1"
                    onChange={(v) => { setSeekDrag(true); setSeekVal(v); }}
                    onCommit={(v) => { seekTo(v); setSeekDrag(false); }}
                  />
                  <span className="w-8 shrink-0 text-[11px] tabular-nums text-white/32">
                    {fmt(duration)}
                  </span>
                </div>
              </div>

              {/* ════════════════ RIGHT: Volume + extras (Desktop Only) ════════════════ */}
              <div className="hidden md:flex w-[200px] shrink-0 items-center justify-end gap-2">
                {/* Volume */}
                <button
                  onClick={() => setVolume(volume === 0 ? 70 : 0)}
                  className="text-white/32 transition-colors hover:text-white/70"
                >
                  {volume === 0
                    ? <VolumeX className="h-4 w-4" />
                    : <Volume2 className="h-4 w-4" />
                  }
                </button>
                <WhiteSlider
                  value={volume}
                  min={0}
                  max={100}
                  step={1}
                  className="w-24"
                  onChange={setVolume}
                />

                {/* Autoplay */}
                <button
                  onClick={toggleAutoplay}
                  title="Autoplay"
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/[0.06] ${isAutoplay ? 'text-white' : 'text-white/28 hover:text-white/70'}`}
                >
                  <Infinity className="h-4 w-4" />
                </button>

                {/* Karaoke */}
                <button
                  onClick={onKaraoke}
                  title="Karaoke (K)"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/28 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                >
                  <Mic2 className="h-4 w-4" />
                </button>
              </div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
