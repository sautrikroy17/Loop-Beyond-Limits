/**
 * LoadingScreen
 *
 * Cinematic intro for Loop.
 * Stable, smooth, no flashing.
 *
 * Sequence:
 *  0.0s — dark fade in, ambient glow appears
 *  0.4s — logo SVG draws itself
 *  1.2s — LOOP wordmark fades up
 *  1.8s — progress bar starts filling
 *  ~3s  — bar reaches 100%, hold 400ms
 *  3.4s — full-bleed exit: scale + blur + opacity out
 */

import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState, useRef } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

// ── Ambient particle field (CSS-only dots) ─────────────────────────
function ParticleField() {
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: (i * 37.1 + 11) % 100,
    y: (i * 53.7 + 7) % 100,
    size: 1 + (i % 3) * 0.5,
    dur: 4 + (i % 5) * 1.2,
    del: (i * 0.22) % 3,
    op: 0.06 + (i % 4) * 0.04,
  }));

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.op,
          }}
          animate={{ opacity: [p.op, p.op * 4, p.op], y: [0, -18, 0] }}
          transition={{ duration: p.dur, delay: p.del, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Logo mark ─────────────────────────────────────────────────────
function LogoMark() {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" fill="none" className="overflow-visible">
      <defs>
        <linearGradient id="lg-a" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.88 0.16 248)" />
          <stop offset="48%" stopColor="oklch(0.76 0.26 270)" />
          <stop offset="100%" stopColor="oklch(0.80 0.20 210)" />
        </linearGradient>
        <linearGradient id="lg-b" x1="88" y1="88" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.72 0.26 248)" />
          <stop offset="100%" stopColor="oklch(0.68 0.24 286)" />
        </linearGradient>
        <filter id="glow-logo" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
      </defs>

      {/* Outer loop — draws first */}
      <motion.path
        d="M 18 44 C 18 18, 70 18, 70 44 C 70 70, 18 70, 18 44"
        stroke="url(#lg-a)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#glow-logo)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.0, delay: 0.2, ease }}
      />

      {/* Inner cross — draws second */}
      <motion.path
        d="M 44 18 C 70 18, 70 70, 44 70 C 18 70, 18 18, 44 18"
        stroke="url(#lg-b)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.55 }}
        transition={{ duration: 2.2, delay: 0.5, ease }}
      />

      {/* Center dot */}
      <motion.circle
        cx="44"
        cy="44"
        r="3"
        fill="url(#lg-a)"
        filter="url(#glow-logo)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.6, ease }}
      />
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────

export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"in" | "loaded" | "out">("in");

  useEffect(() => {
    // Start filling after logo has drawn
    const start = setTimeout(() => {
      let p = 0;
      const tick = () => {
        // Ease-out curve: fast start, slow finish for cinematic feel
        const remaining = 100 - p;
        const step = Math.max(0.4, remaining * 0.055 + Math.random() * 1.2);
        p = Math.min(100, p + step);
        setProgress(p);

        if (p < 100) {
          setTimeout(tick, 28 + Math.random() * 36);
        } else {
          // Hold at 100%
          setTimeout(() => {
            setPhase("out");
            setTimeout(onComplete, 800);
          }, 380);
        }
      };
      tick();
    }, 1600); // wait for logo draw

    return () => clearTimeout(start);
  }, [onComplete]);

  const stages = [
    [0, "Initializing acoustic nodes"],
    [22, "Calibrating soundstage"],
    [48, "Loading discovery engine"],
    [74, "Syncing playback core"],
    [92, "Unleashing Loop"],
  ] as const;

  const stageText = [...stages].reverse().find(([t]) => progress >= t)?.[1] ?? "";

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(20px)" }}
          transition={{ duration: 0.9, ease }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "oklch(0.04 0.024 258)" }}
        >
          {/* Ambient glow */}
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            style={{
              width: "60vmax",
              height: "60vmax",
              background:
                "radial-gradient(ellipse at center, oklch(0.68 0.24 286 / 0.22) 0%, oklch(0.72 0.26 248 / 0.10) 45%, transparent 72%)",
              filter: "blur(32px)",
            }}
          />

          {/* Particle field */}
          <ParticleField />

          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center gap-10">
            {/* Logo */}
            <div className="flex flex-col items-center gap-5">
              <LogoMark />

              <motion.div
                initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.0, delay: 1.1, ease }}
                className="text-center"
              >
                <div
                  className="font-display text-[26px] font-bold tracking-[0.22em] text-white"
                  style={{ letterSpacing: "0.22em" }}
                >
                  LOOP
                </div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.38em] text-white/25">
                  Music beyond sound
                </div>
              </motion.div>
            </div>

            {/* Progress */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.5 }}
              className="flex w-60 flex-col items-center gap-3"
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
                  {stageText}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-white/50">
                  {Math.floor(progress)}%
                </span>
              </div>

              {/* Progress track */}
              <div className="relative h-px w-full overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress}%`,
                    background:
                      "linear-gradient(90deg, oklch(0.72 0.26 248), oklch(0.68 0.24 286), oklch(0.80 0.18 208))",
                  }}
                  transition={{ duration: 0.15 }}
                />
                {/* Glow tip */}
                <div
                  className="absolute inset-y-[-3px] w-6 rounded-full blur-[4px]"
                  style={{
                    left: `calc(${progress}% - 12px)`,
                    background: "oklch(0.72 0.26 248 / 0.8)",
                    transition: "left 0.15s",
                  }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
