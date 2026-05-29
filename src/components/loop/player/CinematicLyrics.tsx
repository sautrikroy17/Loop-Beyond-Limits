/**
 * CinematicLyrics — Perfect sync lyrics panel
 *
 * SYNC FIX:
 *   Previously relied on React prop `progress` updating every 250ms.
 *   Now uses a RAF loop reading `usePlayback.getState().progress` directly —
 *   updates at 60fps, bypassing React re-renders entirely.
 *   The active line index is stored in a ref and only updates DOM when it changes.
 *
 * States:
 *  loading  → shimmer skeleton
 *  synced   → timed karaoke-style lines
 *  plain    → scrollable plain text
 *  empty    → error + retry
 *  idle     → play prompt
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getLyricsFn, type LyricLine } from "@/functions/lyrics";
import { usePlayback, type Track } from "@/hooks/usePlayback";

interface Props {
  track: Track | null;
}

// ── Skeleton ────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-10 py-12">
      <div className="text-[10px] uppercase tracking-[0.38em] text-white/18 mb-2">
        Loading lyrics…
      </div>
      {[78, 52, 88, 64, 72, 48, 83, 60].map((w, i) => (
        <div
          key={i}
          className="h-3.5 rounded-full bg-white/[0.055]"
          style={{ width: `${w}%`, animation: `pulse 1.8s ease-in-out ${i * 100}ms infinite` }}
        />
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  text,
  action,
}: {
  icon: React.ReactNode;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="text-white/15">{icon}</div>
      <p className="text-[13px] text-white/25">{text}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1.5 rounded-full border border-white/[0.10] px-4 py-1.5 text-[11px] text-white/35 transition-colors hover:border-white/20 hover:text-white/55"
        >
          <RefreshCw className="h-3 w-3" />
          {action.label}
        </button>
      )}
    </div>
  );
}

function PlainLyrics({ text }: { text: string }) {
  return (
    <div className="relative h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <div className="pointer-events-none sticky top-0 h-16 bg-gradient-to-b from-[oklch(0.06_0.018_262)] to-transparent" />
      <div className="px-8 pb-32 pt-2 text-[13px] leading-[2.1] tracking-wide text-white/32 whitespace-pre-line">
        {text}
      </div>
      <div className="pointer-events-none sticky bottom-0 h-20 bg-gradient-to-t from-[oklch(0.06_0.018_262)] to-transparent" />
    </div>
  );
}

// ── SyncedLyrics — RAF-driven, zero React state on scroll ──────────

function SyncedLyrics({
  lines,
  linesRef,
  onSeek,
}: {
  lines: LyricLine[];
  linesRef: React.MutableRefObject<LyricLine[]>;
  onSeek: (t: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineEls = useRef<(HTMLButtonElement | null)[]>([]);
  const lastActiveRef = useRef(-1);
  const rafRef = useRef<number | null>(null);

  // Keep linesRef current
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    lineEls.current = lineEls.current.slice(0, lines.length);
  }, [lines.length]);

  useEffect(() => {
    // RAF loop: poll progress at 60fps and update DOM directly
    const tick = () => {
      const prog = usePlayback.getState().progress;
      const currentLines = linesRef.current;

      // Binary search for active line
      let active = -1;
      let lo = 0,
        hi = currentLines.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (currentLines[mid].time <= prog) {
          active = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }

      if (active === lastActiveRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastActiveRef.current = active;

      // Update all line elements directly — no React re-render
      lineEls.current.forEach((el, i) => {
        if (!el) return;
        const span = el.querySelector("span") as HTMLElement | null;
        if (!span) return;

        const isActive = i === active;
        const isPast = i < active;

        span.style.fontSize = isActive ? "1.22rem" : "1.02rem";
        span.style.fontWeight = isActive ? "700" : "600";
        span.style.color = isActive
          ? "rgba(255,255,255,1)"
          : isPast
            ? "rgba(255,255,255,0.10)"
            : "rgba(255,255,255,0.26)";
        span.style.textShadow = isActive
          ? "0 0 50px oklch(0.72 0.26 248 / 0.65), 0 0 20px oklch(0.68 0.24 286 / 0.45)"
          : "none";
        span.style.transform = isActive ? "scale(1.03)" : "scale(1)";
        span.style.transition = "all 0.28s cubic-bezier(0.16,1,0.3,1)";
      });

      // Auto-scroll active line to center
      const el = lineEls.current[active];
      const container = containerRef.current;
      if (el && container) {
        const target = el.offsetTop - container.offsetHeight / 2 + el.offsetHeight / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto"
      style={{ scrollbarWidth: "none" }}
    >
      {/* Top vignette */}
      <div className="pointer-events-none sticky top-0 z-10 h-20 bg-gradient-to-b from-[oklch(0.06_0.018_262)] to-transparent" />

      <div className="flex flex-col items-center gap-1 pb-40 pt-4 px-6">
        {lines.map((line, i) => (
          <button
            key={i}
            ref={(el) => {
              lineEls.current[i] = el;
            }}
            onClick={() => onSeek(line.time)}
            className="block w-full max-w-sm text-center py-2"
          >
            <span
              className="block leading-tight font-semibold"
              style={{
                fontSize: "1.02rem",
                color: "rgba(255,255,255,0.26)",
                transition: "all 0.28s cubic-bezier(0.16,1,0.3,1)",
                display: "block",
              }}
            >
              {line.text}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom vignette */}
      <div className="pointer-events-none sticky bottom-0 h-24 bg-gradient-to-t from-[oklch(0.06_0.018_262)] to-transparent" />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "synced" | "plain" | "empty";

export function CinematicLyrics({ track }: Props) {
  const { seekTo } = usePlayback.getState();
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [plain, setPlain] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const prevId = useRef<string | null>(null);
  const linesRef = useRef<LyricLine[]>([]);

  const fetchLyrics = useCallback(async (t: Track) => {
    setStatus("loading");
    setLines([]);
    setPlain(null);
    prevId.current = t.id;
    linesRef.current = [];

    try {
      const r = await getLyricsFn({
        data: {
          title: t.title,
          artist: t.artist,
          duration: t.durationMs ? t.durationMs / 1000 : undefined,
        },
      });

      if (r.lines.length > 0) {
        setLines(r.lines);
        linesRef.current = r.lines;
        setPlain(r.plain);
        setStatus("synced");
      } else if (r.plain) {
        setPlain(r.plain);
        setStatus("plain");
      } else {
        setStatus("empty");
      }
    } catch {
      setStatus("empty");
    }
  }, []);

  useEffect(() => {
    if (!track) {
      setStatus("idle");
      setLines([]);
      setPlain(null);
      return;
    }
    if (track.id === prevId.current) return;
    fetchLyrics(track);
  }, [track?.id, fetchLyrics]);

  return (
    <AnimatePresence mode="wait">
      {status === "idle" && (
        <motion.div key="idle" {...fade} className="h-full">
          <EmptyState icon={<Mic2 className="h-10 w-10" />} text="Play a track to see lyrics" />
        </motion.div>
      )}
      {status === "loading" && (
        <motion.div key="loading" {...fade} className="h-full">
          <Skeleton />
        </motion.div>
      )}
      {status === "synced" && (
        <motion.div key="synced" {...fade} className="h-full">
          <SyncedLyrics lines={lines} linesRef={linesRef} onSeek={seekTo} />
        </motion.div>
      )}
      {status === "plain" && plain && (
        <motion.div key="plain" {...fade} className="h-full">
          <PlainLyrics text={plain} />
        </motion.div>
      )}
      {status === "empty" && (
        <motion.div key="empty" {...fade} className="h-full">
          <EmptyState
            icon={<Mic2 className="h-8 w-8" />}
            text="Lyrics unavailable for this track"
            action={track ? { label: "Retry", onClick: () => fetchLyrics(track) } : undefined}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },
};
