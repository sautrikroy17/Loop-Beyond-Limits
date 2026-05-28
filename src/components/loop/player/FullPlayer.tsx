import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import {
  X, SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Loader2, Plus, Mic2, ListMusic, Music2, FolderPlus, Check
} from 'lucide-react';
import { usePlayback, type Track } from '@/hooks/usePlayback';
import { subscribeToAudio } from '@/hooks/useAudioData';
import { FrequencyBars } from '@/components/loop/visualizer/FrequencyBars';
import { CinematicLyrics } from './CinematicLyrics';
import { LikeButton } from '@/components/loop/LikeButton';
import { LoopLogoCanvas } from '@/components/loop/LoopLogo';
import { useUserProfile } from '@/hooks/useUserProfile';

import { SpotifyCanvas } from '@/components/loop/visualizer/SpotifyCanvas';

function fmt(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

type Tab = 'lyrics' | 'queue';

// ─── Reactive Album Art ───────────────────────────────────────────
// Direct DOM style mutations — zero React rerenders per frame

function ReactiveAlbumArt({ src, trackId }: { src?: string; trackId?: string }) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const flashRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el    = wrapRef.current;
    const flash = flashRef.current;
    if (!el) return;
    let lastBeat = 0;
    return subscribeToAudio((data) => {
      if (!el) return;
      const scale     = (1 + data.bass * 0.035).toFixed(4);
      const glowSize  = (data.bass * 70).toFixed(1);
      const glowAlpha = (0.12 + data.bass * 0.50).toFixed(3);
      const hue       = 248 + data.treble * 40;
      el.style.transform = `scale(${scale})`;
      el.style.boxShadow = [
        `0 ${data.bass * 40}px ${glowSize}px -12px rgba(0,0,0,0.95)`,
        `0 0 ${glowSize}px -6px oklch(0.72 0.26 ${hue.toFixed(0)} / ${glowAlpha})`,
      ].join(', ');
      // Beat-drop flash
      if (flash && data.beat > 0.65 && Date.now() - lastBeat > 400) {
        lastBeat = Date.now();
        flash.style.opacity = '0.20';
        setTimeout(() => { if (flash) flash.style.opacity = '0'; }, 120);
      }
    });
  }, [trackId]);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-3xl"
      style={{ willChange: 'transform, box-shadow', transformOrigin: 'center' }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[oklch(0.20_0.08_290)] to-[oklch(0.10_0.04_260)]">
          <Music2 className="h-16 w-16 text-white/10" />
        </div>
      )}
      {/* Beat-drop flash overlay */}
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 rounded-3xl bg-white"
        style={{ opacity: 0, transition: 'opacity 120ms ease-out' }}
      />
    </div>
  );
}



// ─── Queue ────────────────────────────────────────────────────────

function QueueView() {
  const { queue, removeFromQueue, playTrack } = usePlayback();
  if (queue.length === 0) {
    return <EmptyState icon={<ListMusic className="h-8 w-8" />} text="Queue is empty — autoplay will continue" />;
  }
  return (
    <div className="h-full overflow-y-auto px-3 py-3 space-y-1" style={{ scrollbarWidth: 'none' }}>
      {queue.map((track, i) => (
        <div key={`${track.id}-${i}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/5 transition-colors">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
            {track.albumArt && <img src={track.albumArt} alt="" className="h-full w-full object-cover" />}
            <button
              onClick={() => playTrack(track)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Play className="h-4 w-4 fill-white text-white" />
            </button>
          </div>
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => playTrack(track)}>
            <div className="truncate text-sm font-medium text-white/90">{track.title}</div>
            <div className="truncate text-xs text-white/40">{track.artist}</div>
          </div>
          <button
            onClick={() => removeFromQueue(i)}
            className="shrink-0 rounded-full p-1.5 text-white/20 hover:bg-red-500/10 hover:text-red-400/70 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-white/18">
      {icon}
      <p className="text-[13px]">{text}</p>
    </div>
  );
}

function PlaylistPickerPopup({ onClose, track }: { onClose: () => void, track: Track }) {
  const { playlists, addTrackToPlaylist, createPlaylist } = useUserProfile();
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
    addTrackToPlaylist(playlistId, track);
    setAdded(playlistId);
    setTimeout(() => onClose(), 800);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPl = createPlaylist(newPlaylistName.trim());
    addTrackToPlaylist(newPl.id, track);
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
          No playlists yet
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

function FullSeekbar() {
  const { duration, seekTo } = usePlayback();
  const progress = usePlayback(s => s.progress);
  const [isDragging, setIsDragging] = useState(false);
  const [dragVal, setDragVal] = useState(0);

  const displayTime = isDragging ? dragVal : progress;
  const pct = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div>
      <div className="group relative">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, oklch(0.72 0.26 248), oklch(0.68 0.24 286))',
            }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={displayTime}
          onChange={(e) => { setIsDragging(true); setDragVal(Number(e.target.value)); }}
          onMouseUp={(e) => { seekTo(Number((e.target as HTMLInputElement).value)); setIsDragging(false); }}
          onTouchEnd={(e) => { seekTo(Number((e.target as HTMLInputElement).value)); setIsDragging(false); }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-md opacity-0 transition-opacity group-hover:opacity-100"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-white/28">
        <span>{fmt(displayTime)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  );
}

// ─── Full Player ──────────────────────────────────────────────────

export function FullPlayer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    currentTrack, isPlaying, duration, volume,
    isShuffle, repeatMode, isLoadingTrack, queue,
    togglePlayPause, nextTrack, prevTrack, toggleShuffle,
    toggleRepeat, seekTo, setVolume, playTrack, removeFromQueue,
  } = usePlayback();



  const [tab, setTab] = useState<Tab>('lyrics');
  const [showPlaylistPicker, setPicker] = useState(false);
  const REPEAT_ICON = repeatMode === 'one' ? Repeat1 : Repeat;

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden"
          style={{ background: 'oklch(0.04 0.024 258)' }}
        >
          {/* Animated immersive background */}
          <SpotifyCanvas albumArt={currentTrack?.albumArt} />

          {/* Gradient vignette — dark edges ensure legibility */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 20%, oklch(0.04 0.024 258 / 0.55) 100%)',
                'linear-gradient(to bottom, oklch(0.04 0.024 258 / 0.50) 0%, oklch(0.04 0.024 258 / 0.15) 25%, oklch(0.04 0.024 258 / 0.15) 70%, oklch(0.04 0.024 258 / 0.80) 100%)',
              ].join(', '),
            }}
          />

          {/* Header */}
          <div className="relative z-10 flex shrink-0 items-center justify-between px-6 py-4">
            <p className="text-[9px] font-medium uppercase tracking-[0.4em] text-white/28">Now Playing</p>
            <LoopLogoCanvas size={26} />
            <button
              onClick={onClose}
              className="rounded-full p-2 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="relative z-10 flex flex-1 flex-col md:flex-row overflow-y-auto md:overflow-hidden pb-[env(safe-area-inset-bottom)]">

            {/* ── Left: Album + controls ──────────────────────────── */}
            <div className="flex w-full md:max-w-[22rem] shrink-0 flex-col justify-center gap-5 px-6 md:px-8 py-4">

              {/* Reactive album art — scale + glow from audio engine */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTrack?.id ?? 'empty'}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                >
                  <ReactiveAlbumArt
                    src={currentTrack?.albumArt}
                    trackId={currentTrack?.id}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Track info + like/playlist */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 text-center md:text-left">
                  <div className="truncate text-[17px] font-semibold text-white">
                    {currentTrack?.title || '—'}
                  </div>
                  <div className="mt-1 truncate text-[13px] text-white/40">
                    {currentTrack?.artist}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 -mt-0.5">
                  <div className="relative">
                    <button
                      onClick={() => setPicker(v => !v)}
                      className={`rounded-full p-2 transition-colors ${showPlaylistPicker ? 'text-[oklch(0.72_0.26_248)]' : 'text-white/30 hover:text-white/70'}`}
                    >
                      <FolderPlus className="h-5 w-5" />
                    </button>
                    <AnimatePresence>
                      {showPlaylistPicker && currentTrack && (
                        <PlaylistPickerPopup onClose={() => setPicker(false)} track={currentTrack} />
                      )}
                    </AnimatePresence>
                  </div>
                  {currentTrack && (
                    <LikeButton track={currentTrack} size="md" />
                  )}
                </div>
              </div>

              <div className="hidden md:block w-full overflow-hidden rounded-lg">
                <FrequencyBars height={52} numBars={56} />
              </div>

              <FullSeekbar />



              {/* Transport controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleShuffle}
                  className={`rounded-full p-2 transition-colors ${isShuffle ? 'text-[oklch(0.82_0.22_290)]' : 'text-white/30 hover:text-white/65'}`}
                >
                  <Shuffle className="h-5 w-5" />
                </button>
                <button onClick={prevTrack} className="rounded-full p-2 text-white/55 transition-colors hover:text-white">
                  <SkipBack className="h-6 w-6 fill-current" />
                </button>
                <button
                  onClick={togglePlayPause}
                  disabled={!currentTrack || isLoadingTrack}
                  className="flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.72 0.26 248), oklch(0.68 0.24 286))',
                    boxShadow: '0 0 60px -6px oklch(0.72 0.26 248 / 0.80)',
                  }}
                >
                  {isLoadingTrack
                    ? <Loader2 className="h-7 w-7 animate-spin" />
                    : isPlaying
                    ? <Pause className="h-7 w-7 fill-current" />
                    : <Play className="h-7 w-7 fill-current ml-0.5" />}
                </button>
                <button onClick={nextTrack} className="rounded-full p-2 text-white/55 transition-colors hover:text-white">
                  <SkipForward className="h-6 w-6 fill-current" />
                </button>
                <button
                  onClick={toggleRepeat}
                  className={`rounded-full p-2 transition-colors ${repeatMode !== 'none' ? 'text-[oklch(0.82_0.22_290)]' : 'text-white/30 hover:text-white/65'}`}
                >
                  <REPEAT_ICON className="h-5 w-5" />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setVolume(volume === 0 ? 75 : 0)}
                  className="shrink-0 text-white/28 transition-colors hover:text-white/65"
                >
                  {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="flex-1 cursor-pointer accent-[oklch(0.72_0.23_290)] thumbless-range"
                />
                <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-white/22">
                  {volume}
                </span>
              </div>
            </div>

            {/* ── Right: Lyrics / Queue ──────────────────────────── */}
            <div className="flex min-h-[400px] md:min-h-0 flex-1 flex-col overflow-hidden border-t md:border-l md:border-t-0 border-white/[0.06] mt-4 md:mt-0">
              {/* Tabs */}
              <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-4 py-3">
                {(['lyrics', 'queue'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      tab === t
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/30 hover:text-white/65'
                    }`}
                  >
                    {t === 'lyrics' ? <Mic2 className="h-3.5 w-3.5" /> : <ListMusic className="h-3.5 w-3.5" />}
                    {t === 'queue'
                      ? `Queue${queue.length > 0 ? ` (${queue.length})` : ''}`
                      : 'Lyrics'}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16 }}
                    className="absolute inset-0 h-full w-full"
                  >
                    {tab === 'lyrics' && <CinematicLyrics track={currentTrack} />}
                    {tab === 'queue'  && <QueueView />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
