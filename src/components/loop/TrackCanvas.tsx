/**
 * TrackCanvas — Spotify-like generative visual canvas
 *
 * Extracts dominant RGB color from album art via a hidden 16×16 downsample.
 * Drives two animated layers:
 *  1. Lissajous orbital orbs in the extracted palette — breathe with bass
 *  2. Slow rotating diagonal gradient overlay — tied to treble
 *
 * Screen-blended above the CSS ambient orbs, below all UI.
 * Cross-fades between tracks via AnimatePresence.
 * Enabled/disabled via useSettings.canvasEnabled.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayback } from "@/hooks/usePlayback";
import { useSettings } from "@/hooks/useSettings";
import { subscribeToAudio } from "@/hooks/useAudioData";

type RGB = [number, number, number];

// ── Color extraction ───────────────────────────────────────────────

async function extractPalette(url: string): Promise<[RGB, RGB, RGB]> {
  return new Promise((resolve) => {
    if (!url) return resolve(defaultPalette());
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timeout = setTimeout(() => resolve(defaultPalette()), 2500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const c = document.createElement("canvas");
        c.width = 12;
        c.height = 12;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 12, 12);
        const d = ctx.getImageData(0, 0, 12, 12).data;

        // Compute mean ignoring near-black pixels
        let r1 = 0,
          g1 = 0,
          b1 = 0,
          n1 = 0;
        let r2 = 0,
          g2 = 0,
          b2 = 0,
          n2 = 0;
        for (let i = 0; i < d.length; i += 4) {
          const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          if (lum > 25) {
            if (i < d.length / 2) {
              r1 += d[i];
              g1 += d[i + 1];
              b1 += d[i + 2];
              n1++;
            } else {
              r2 += d[i];
              g2 += d[i + 1];
              b2 += d[i + 2];
              n2++;
            }
          }
        }

        const base: RGB = n1 > 0 ? [r1 / n1, g1 / n1, b1 / n1] : [80, 80, 200];
        const comp: RGB =
          n2 > 0 ? [r2 / n2, g2 / n2, b2 / n2] : [base[0] * 0.6, base[1] * 0.4, base[2] * 1.2];
        const accent: RGB = [
          Math.min(255, base[0] * 0.4 + comp[0] * 0.6),
          Math.min(255, base[1] * 0.3 + comp[1] * 0.7),
          Math.min(255, base[2] * 1.1),
        ];
        resolve([saturate(base, 1.9), saturate(comp, 1.6), saturate(accent, 2.0)]);
      } catch {
        resolve(defaultPalette());
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(defaultPalette());
    };
    img.src = url;
  });
}

function saturate([r, g, b]: RGB, f = 1.8): RGB {
  const avg = (r + g + b) / 3;
  return [
    Math.max(0, Math.min(255, avg + (r - avg) * f)),
    Math.max(0, Math.min(255, avg + (g - avg) * f)),
    Math.max(0, Math.min(255, avg + (b - avg) * f)),
  ];
}

function defaultPalette(): [RGB, RGB, RGB] {
  return [
    [90, 60, 200],
    [40, 80, 220],
    [120, 40, 180],
  ];
}

// ── Canvas renderer ────────────────────────────────────────────────

function startRenderer(canvas: HTMLCanvasElement, palette: [RGB, RGB, RGB]) {
  const ctx = canvas.getContext("2d")!;
  const [c1, c2, c3] = palette;
  let bass = 0,
    treble = 0;
  let rafId = 0;

  const unsub = subscribeToAudio((d) => {
    bass = d.bass;
    treble = d.treble;
  });

  function resize() {
    const scale = 0.5;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) {
      canvas.width = 0;
      canvas.height = 0;
    } else {
      canvas.width = Math.max(rect.width * scale, 400);
      canvas.height = Math.max(rect.height * scale, 300);
      ctx.scale(scale, scale);
      if (rafId === 0) {
        rafId = requestAnimationFrame(draw);
      }
    }
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  function draw() {
    if (document.hidden || !document.hasFocus()) {
      rafId = requestAnimationFrame(draw);
      return;
    }

    const W = canvas.offsetWidth,
      H = canvas.offsetHeight;
    // FIX: Completely abort RAF loop when hidden! ResizeObserver will restart it.
    if (W === 0 || H === 0) {
      rafId = 0;
      return;
    }

    const t = performance.now() * 0.001;
    ctx.clearRect(0, 0, W, H);

    // ── Layer 1: Lissajous orbs ──────────────────────────────────
    const orbs = [
      { c: c1, ax: 0.33, ay: 0.28, fx: 0.38, fy: 0.31, ph: 0, r: 0.52, a: 0.2 },
      { c: c2, ax: 0.28, ay: 0.24, fx: 0.27, fy: 0.55, ph: 2.09, r: 0.38, a: 0.14 },
      { c: c3, ax: 0.22, ay: 0.19, fx: 0.51, fy: 0.25, ph: 4.19, r: 0.28, a: 0.1 },
    ];

    for (const o of orbs) {
      const cx = W * (0.5 + Math.sin(t * o.fx + o.ph) * o.ax);
      const cy = H * (0.5 + Math.cos(t * o.fy + o.ph) * o.ay);
      const radius = Math.min(W, H) * (o.r + bass * 0.22);
      const alpha = o.a + bass * 0.14;

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, `rgba(${o.c[0]},${o.c[1]},${o.c[2]},${alpha.toFixed(3)})`);
      g.addColorStop(0.5, `rgba(${o.c[0]},${o.c[1]},${o.c[2]},${(alpha * 0.3).toFixed(3)})`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Layer 2: Rotating diagonal shimmer (treble-driven) ───────
    const angle = t * 0.08 + treble * 0.5;
    const shimAlpha = 0.04 + treble * 0.06;
    const cx2 = W * 0.5,
      cy2 = H * 0.5;
    const lg = ctx.createLinearGradient(
      cx2 + Math.cos(angle) * W,
      cy2 + Math.sin(angle) * H,
      cx2 - Math.cos(angle) * W,
      cy2 - Math.sin(angle) * H,
    );
    lg.addColorStop(0, `rgba(${c1[0]},${c1[1]},${c1[2]},${shimAlpha.toFixed(3)})`);
    lg.addColorStop(0.5, "transparent");
    lg.addColorStop(1, `rgba(${c3[0]},${c3[1]},${c3[2]},${shimAlpha.toFixed(3)})`);
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);

    rafId = requestAnimationFrame(draw);
  }

  rafId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    unsub();
  };
}

// ── Component ──────────────────────────────────────────────────────

export function TrackCanvas() {
  const { canvasEnabled } = useSettings();
  const { currentTrack } = usePlayback();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [visible, setVisible] = useState(false);
  const [trackKey, setTrackKey] = useState("");

  useEffect(() => {
    if (!canvasEnabled || !currentTrack) {
      setVisible(false);
      stopRef.current?.();
      stopRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    extractPalette(currentTrack.albumArt || "").then((palette) => {
      stopRef.current?.();
      stopRef.current = startRenderer(canvas, palette);
      setTrackKey(currentTrack.id);
      setVisible(true);
    });

    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [currentTrack?.id, canvasEnabled]);

  if (!canvasEnabled) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.canvas
          key={trackKey}
          ref={canvasRef}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}
          className="pointer-events-none fixed inset-0 h-full w-full hidden md:block"
          style={{ zIndex: -8, mixBlendMode: "screen" }}
        />
      )}
    </AnimatePresence>
  );
}
