/**
 * LoopLogo — Filled fluid waveform logo (matches reference image exactly)
 *
 * The reference image shows a FILLED wave shape:
 *  - A horizontal baseline extends left and right at the vertical center
 *  - The wave rises into peaks and valleys at various horizontal positions
 *  - The FILL below/above the curve is colored with a spectral gradient
 *  - Colors: yellow(left) → orange → red/pink → magenta → purple → blue → cyan(right)
 *  - The peaks have a glowing bloom effect
 *  - Tapers to thin line at edges (like a waveform)
 *
 * Two forms:
 *  1. LoopLogoSVG — static SVG (for favicon/OG)
 *  2. LoopLogoCanvas — animated, audio-reactive
 *  3. LoopLogo — canvas + optional wordmark
 */

import { useEffect, useRef } from "react";
import { subscribeToAudio } from "@/hooks/useAudioData";

interface LogoProps {
  size?: number;
  showText?: boolean;
  textSize?: string;
  className?: string;
}

// Spectral color stops: yellow → orange → red → magenta → violet → blue → cyan
const SPECTRUM_COLORS = [
  { r: 255, g: 220, b: 50 }, // 0.00 — yellow
  { r: 255, g: 160, b: 20 }, // 0.18 — orange
  { r: 255, g: 60, b: 80 }, // 0.36 — red-pink
  { r: 200, g: 30, b: 180 }, // 0.52 — magenta
  { r: 130, g: 40, b: 255 }, // 0.68 — violet
  { r: 60, g: 90, b: 255 }, // 0.82 — blue
  { r: 20, g: 210, b: 255 }, // 1.00 — cyan
];

function spectrumColor(t: number, alpha = 1): string {
  t = Math.max(0, Math.min(1, t));
  const scaled = t * (SPECTRUM_COLORS.length - 1);
  const idx = Math.min(Math.floor(scaled), SPECTRUM_COLORS.length - 2);
  const f = scaled - idx;
  const a = SPECTRUM_COLORS[idx];
  const b = SPECTRUM_COLORS[idx + 1];
  const r = Math.round(a.r + (b.r - a.r) * f);
  const g = Math.round(a.g + (b.g - a.g) * f);
  const bl = Math.round(a.b + (b.b - a.b) * f);
  return `rgba(${r},${g},${bl},${alpha})`;
}

// ── Static SVG ──────────────────────────────────────────────────────

export function LoopLogoSVG({ size = 28 }: { size?: number }) {
  // We draw the wave as an SVG path with a linear gradient fill
  // The path traces a waveform shape then closes below
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Loop"
    >
      <defs>
        {/* Horizontal spectral gradient */}
        <linearGradient id="lg-spec" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffdc32" />
          <stop offset="18%" stopColor="#ffa014" />
          <stop offset="36%" stopColor="#ff3c50" />
          <stop offset="52%" stopColor="#c81eb4" />
          <stop offset="68%" stopColor="#8228ff" />
          <stop offset="82%" stopColor="#3c5aff" />
          <stop offset="100%" stopColor="#14d2ff" />
        </linearGradient>
        {/* Glow filter */}
        <filter id="logo-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Filled waveform — matches reference image shape */}
      {/* Wave goes flat at edges, peaks in the middle sections */}
      <path
        d="M 0,25
           L 8,25
           C 12,25 12,16 16,12
           C 20,8  22,8  24,14
           C 26,20 26,30 28,36
           C 30,42 32,42 34,36
           C 36,30 36,12 40,10
           C 44,8  46,8  48,18
           C 50,28 50,38 54,40
           C 58,42 60,38 62,28
           C 64,18 64,8  68,8
           C 72,8  74,14 76,22
           C 78,30 78,36 80,32
           C 82,28 84,26 88,25
           L 100,25
           L 100,25
           L 88,25
           L 80,25
           L 68,25
           L 54,25
           L 40,25
           L 28,25
           L 16,25
           L 8,25
           Z"
        fill="url(#lg-spec)"
        filter="url(#logo-glow)"
        opacity="0.95"
      />

      {/* Baseline — horizontal line through center */}
      <line
        x1="0"
        y1="25"
        x2="100"
        y2="25"
        stroke="url(#lg-spec)"
        strokeWidth="0.8"
        opacity="0.45"
      />

      {/* White core highlight on peaks */}
      <path
        d="M 0,25
           L 8,25
           C 12,25 12,16 16,12
           C 20,8  22,8  24,14
           C 26,20 26,30 28,36
           C 30,42 32,42 34,36
           C 36,30 36,12 40,10
           C 44,8  46,8  48,18
           C 50,28 50,38 54,40
           C 58,42 60,38 62,28
           C 64,18 64,8  68,8
           C 72,8  74,14 76,22
           C 78,30 78,36 80,32
           C 82,28 84,26 88,25
           L 100,25"
        stroke="white"
        strokeWidth="0.7"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}

// ── Animated canvas version ─────────────────────────────────────────

export function LoopLogoCanvas({ size = 28 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const W = size;
    const H = size;
    const CY = H / 2;
    const maxAmp = H * 0.45;
    const NUM_BARS = 40;

    let t = 0;
    let sBass = 0;
    let sBeat = 0;
    let rafId = 0;
    let freqData: any = new Float32Array(NUM_BARS);
    const smoothed = new Float32Array(NUM_BARS);

    const unsub = subscribeToAudio((d) => {
      sBass += (d.bass - sBass) * 0.15;
      sBeat += (d.beat - sBeat) * 0.25;
      freqData = d.freqBins;
    });

    function frame() {
      if (document.hidden || !document.hasFocus()) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      ctx.clearRect(0, 0, W, H);
      t += 0.025;

      const surge = Math.max(0, (sBeat - 0.5) * maxAmp * 0.5);

      for (let i = 0; i < NUM_BARS; i++) {
        let target = 0;
        if (freqData.length > 1) {
          const srcIdx = Math.floor(Math.pow(i / (NUM_BARS - 1), 0.8) * (freqData.length - 1));
          target = Math.pow(freqData[srcIdx], 0.7) * 1.5;
        } else {
          target = Math.sin(t + i * 0.1) * 0.1 + 0.1; // idle
        }
        smoothed[i] += (target - smoothed[i]) * 0.15;
      }

      // ── Create horizontal spectral gradient ──
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      SPECTRUM_COLORS.forEach((c, i) => {
        grad.addColorStop(i / (SPECTRUM_COLORS.length - 1), `rgb(${c.r},${c.g},${c.b})`);
      });

      const NUM_STRINGS = 3;

      for (let s = 0; s < NUM_STRINGS; s++) {
        const pts: [number, number][] = [];
        const phase = s * Math.PI * 0.8;
        const speed = 1.2 + s * 0.3;
        const freq = 1 + s * 0.5;

        for (let i = 0; i < NUM_BARS; i++) {
          const xFraction = i / (NUM_BARS - 1);
          const x = xFraction * W;

          const envelope = Math.pow(Math.sin(xFraction * Math.PI), 1.5);
          const amp = (smoothed[i] * maxAmp + surge) * envelope;
          const modulation = Math.sin(t * speed + i * 0.1 * freq + phase);

          const y = CY - amp * modulation * (s === 0 ? 1 : 0.65);
          pts.push([x, y]);
        }

        // Glow outline
        ctx.save();
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else {
            const [px, py] = pts[i - 1];
            ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
          }
        });

        ctx.globalCompositeOperation = "screen";
        ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
        ctx.shadowBlur = 4 + sBass * 4;
        ctx.strokeStyle = grad;
        ctx.lineWidth = s === 0 ? 2 : 1;
        ctx.globalAlpha = 0.9;
        ctx.stroke();

        // White core highlight
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = s === 0 ? 1 : 0.5;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.restore();
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      unsub();
    };
  }, [size]);

  return <canvas ref={canvasRef} aria-label="Loop" style={{ display: "block" }} />;
}

// ── Full logo: canvas + optional wordmark ───────────────────────────

export function LoopLogo({
  size = 28,
  showText = true,
  textSize = "text-lg",
  className = "",
}: LogoProps) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LoopLogoCanvas size={size} />
      {showText && (
        <span className={`font-semibold tracking-tight text-white ${textSize}`}>Loop</span>
      )}
    </span>
  );
}
