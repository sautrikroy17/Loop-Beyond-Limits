/**
 * KaraokeMode
 *
 * Fullscreen immersive karaoke overlay.
 *
 * Layout:
 *  - Blurred album art as full-bleed backdrop
 *  - Dark gradient vignette for readability
 *  - 3-line lyric stage: prev (fading up) / active (bright, large) / next (fading down)
 *  - Click active line → nothing; click any line → seek to timestamp
 *  - Mic pulse icon animated with audio beat
 *  - K shortcut to toggle
 *  - Close button + ESC
 *
 * Visual feel: Apple Music Sing × Spotify Lyrics × concert backdrop
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic2 } from "lucide-react";
import { usePlayback } from "@/hooks/usePlayback";
import { getLyricsFn, type LyricLine } from "@/functions/lyrics";
import { subscribeToAudio } from "@/hooks/useAudioData";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ── Mic beat pulse icon ────────────────────────────────────────────

function MicPulse() {
  const circleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    return subscribeToAudio((d) => {
      if (!circleRef.current) return;
      const s = 1 + d.beat * 0.35;
      const a = 0.3 + d.beat * 0.5;
      circleRef.current.style.transform = `scale(${s.toFixed(3)})`;
      circleRef.current.style.opacity = a.toFixed(3);
    });
  }, []);

  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <div
        ref={circleRef}
        className="absolute inset-0 rounded-full border border-white/30 will-change-transform"
      />
      <Mic2 className="h-5 w-5 text-white/60" />
    </div>
  );
}

// ── Lyric line component ───────────────────────────────────────────

function LyricStage({
  lines,
  activeIdx,
  progress,
  onSeek,
}: {
  lines: LyricLine[];
  activeIdx: number;
  progress: number;
  onSeek: (t: number) => void;
}) {
  // Show: [prev-1, prev, active, next, next+1]
  const show = [-2, -1, 0, 1, 2].map((offset) => {
    const idx = activeIdx + offset;
    return { idx, line: lines[idx] ?? null, offset };
  });

  return (
    <div className="flex flex-col items-center gap-5 px-6 text-center">
      {show.map(({ idx, line, offset }) => {
        if (!line) return <div key={`empty-${offset}`} className="h-8" />;
        const isActive = offset === 0;
        const dist = Math.abs(offset);

        return (
          <motion.button
            key={idx}
            onClick={() => !isActive && onSeek(line.time)}
            animate={{
              opacity: isActive ? 1 : dist === 1 ? 0.35 : 0.14,
              scale: isActive ? 1 : dist === 1 ? 0.88 : 0.76,
              filter: isActive ? "blur(0px)" : dist === 1 ? "blur(1px)" : "blur(2px)",
            }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="block max-w-2xl cursor-pointer select-none"
          >
            <span
              className="block font-semibold leading-tight"
              style={{
                fontSize: isActive
                  ? "clamp(1.6rem, 4.5vw, 2.8rem)"
                  : "clamp(1.1rem, 2.5vw, 1.6rem)",
                color: "white",
                textShadow: isActive
                  ? "0 0 60px rgba(200,160,255,0.6), 0 2px 30px rgba(0,0,0,0.8)"
                  : "none",
              }}
            >
              {line.text}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function KaraokeMode({ isOpen, onClose }: Props) {
  const { currentTrack, progress, seekTo } = usePlayback();
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [plain, setPlain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const prevTrackId = useRef<string | null>(null);

  // Fetch lyrics on track change
  useEffect(() => {
    if (!currentTrack) {
      setLines([]);
      setPlain(null);
      return;
    }
    if (currentTrack.id === prevTrackId.current) return;
    prevTrackId.current = currentTrack.id;

    setLoading(true);
    setLines([]);
    setPlain(null);
    getLyricsFn({
      data: {
        title: currentTrack.title,
        artist: currentTrack.artist,
        duration: currentTrack.durationMs ? currentTrack.durationMs / 1000 : undefined,
      },
    })
      .then((r) => {
        setLines(r.lines);
        setPlain(r.plain ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentTrack?.id]);

  // K shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "k" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target instanceof HTMLInputElement)
      ) {
        isOpen ? onClose() : null; // only close via shortcut (open via PlayerBar)
      }
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const activeIdx = lines.reduce<number>((acc, l, i) => (l.time <= progress ? i : acc), -1);
  const hasTimedLyrics = lines.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Full-bleed blurred album art backdrop */}
          <AnimatePresence mode="wait">
            {currentTrack?.albumArt && (
              <motion.div
                key={currentTrack.id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${currentTrack.albumArt})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(80px) saturate(160%) brightness(0.5)",
                  transform: "scale(1.1)",
                }}
              />
            )}
          </AnimatePresence>

          {/* Dark radial vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 80% at 50% 50%, transparent 10%, rgba(0,0,0,0.55) 100%),
                linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.8))
              `,
            }}
          />

          {/* Header */}
          <div className="relative z-10 flex w-full items-center justify-between px-6 py-4 absolute top-0">
            <div className="flex items-center gap-3">
              <MicPulse />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/35">
                  Karaoke
                </p>
                {currentTrack && (
                  <p className="mt-0.5 text-[13px] font-medium text-white/70">
                    {currentTrack.title} — {currentTrack.artist}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Lyric stage */}
          <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-6">
            {loading && <p className="animate-pulse text-white/30 text-sm">Loading lyrics…</p>}

            {!loading && hasTimedLyrics && (
              <LyricStage lines={lines} activeIdx={activeIdx} progress={progress} onSeek={seekTo} />
            )}

            {!loading && !hasTimedLyrics && plain && (
              <div className="max-w-xl text-center text-lg leading-relaxed text-white/60 whitespace-pre-line">
                {plain.slice(0, 600)}
              </div>
            )}

            {!loading && !hasTimedLyrics && !plain && !currentTrack && (
              <p className="text-white/30 text-sm">Play a track to start Karaoke</p>
            )}

            {!loading && !hasTimedLyrics && !plain && currentTrack && (
              <p className="text-white/30 text-sm">No lyrics found for this track</p>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative z-10 w-full px-8 pb-8">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: `${
                    progress > 0 && currentTrack?.durationMs
                      ? (progress / (currentTrack.durationMs / 1000)) * 100
                      : 0
                  }%`,
                  background: "linear-gradient(90deg, oklch(0.75 0.22 290), oklch(0.72 0.20 240))",
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
