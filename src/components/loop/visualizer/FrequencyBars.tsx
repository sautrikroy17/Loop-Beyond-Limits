/**
 * FrequencyBars — Apple Music / Spotify-style waveform player visualizer
 *
 * Renders two zones like the reference screenshot:
 *
 *  PLAYED zone (left of playhead):
 *    - Tall rounded bars reacting to actual audio
 *    - Gradient: electric blue → violet tip
 *    - Peak hold dots with slow decay
 *
 *  FUTURE zone (right of playhead):
 *    - Small fixed-height dots / tiny bars
 *    - Very subtle, low opacity
 *    - Slight shimmer animation (idle)
 *
 * The split point is driven by the `progress` prop (0-1).
 * Falls back to full audio-reactive mode if progress not provided.
 *
 * Pure canvas RAF — zero React state in draw loop.
 * DPR-aware, ResizeObserver for dynamic width.
 */

import { useEffect, useRef } from "react";
import { subscribeToAudio, type AudioData } from "@/hooks/useAudioData";

import { usePlayback } from "@/hooks/usePlayback";

interface Props {
  height?: number;
  numBars?: number;
  className?: string;
}

export function FrequencyBars({ height = 52, numBars = 56, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedRef = useRef<Float32Array>(new Float32Array(numBars));
  const peakRef = useRef<Float32Array>(new Float32Array(numBars));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas) return;
      const w = canvas.parentElement?.offsetWidth ?? 320;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const smoothed = smoothedRef.current;
    const peak = peakRef.current;

    // Pseudo-random waveform shape for future bars (seeded per-bar, stable)
    const futureShape = Float32Array.from({ length: numBars }, (_, i) => {
      const x = Math.sin(i * 2.4 + 1.7) * Math.cos(i * 0.8 + 0.3);
      return 0.08 + Math.abs(x) * 0.3; // 0.08–0.38 range
    });

    let shimmerT = 0;

    const unsub = subscribeToAudio((data: AudioData) => {
      if (!canvas || !ctx) return;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const { progress, duration } = usePlayback.getState();
      const pct = duration > 0 ? progress / duration : 0; // 0–1

      ctx.clearRect(0, 0, W, H);
      shimmerT += 0.04;

      const gap = 2.5;
      const barW = Math.max(2, (W - gap * (numBars - 1)) / numBars);
      const playheadX = pct * W;

      for (let i = 0; i < numBars; i++) {
        const x = i * (barW + gap);
        const barCx = x + barW / 2;
        const isPlayed = barCx <= playheadX;

        if (isPlayed) {
          // ── PLAYED: audio-reactive bar ──────────────────────────
          const t = Math.sqrt(i / (numBars - 1));
          const srcIdx = Math.floor(t * (data.freqBins.length - 1));
          const target = data.freqBins[srcIdx];

          // Asymmetric smoothing: fast attack, slow release
          smoothed[i] +=
            target > smoothed[i] ? (target - smoothed[i]) * 0.4 : (target - smoothed[i]) * 0.08;

          // Peak hold
          if (smoothed[i] > peak[i]) {
            peak[i] = smoothed[i];
          } else {
            peak[i] = Math.max(0, peak[i] - 0.0035);
          }

          const alpha = data.isActive ? 1 : 0.25;
          const barH = Math.max(3, smoothed[i] * H * 0.9);
          const y = H - barH;
          const r = Math.min(barW / 2, 3.5);

          // Blue → violet gradient
          const grad = ctx.createLinearGradient(0, y, 0, H);
          grad.addColorStop(0, `rgba(255, 255, 255, ${(0.92 * alpha).toFixed(3)})`);
          grad.addColorStop(0.25, `rgba(160, 140, 255, ${(0.85 * alpha).toFixed(3)})`);
          grad.addColorStop(0.65, `rgba(90,  80,  255, ${(0.7 * alpha).toFixed(3)})`);
          grad.addColorStop(1, `rgba(60,  40,  200, ${(0.4 * alpha).toFixed(3)})`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, barW, barH, [r, r, 0, 0]);
          } else {
            ctx.rect(x, y, barW, barH);
          }
          ctx.fill();

          // Peak dot
          if (peak[i] > 0.05 && data.isActive) {
            const peakY = H - peak[i] * H * 0.9 - 2;
            ctx.fillStyle = `rgba(200, 190, 255, ${(0.7 * alpha).toFixed(3)})`;
            ctx.fillRect(x, peakY, barW, 1.5);
          }
        } else {
          // ── FUTURE: tiny static dots that shimmer slightly ──────
          const baseH = futureShape[i] * H * 0.28;
          const shimmer = 1 + Math.sin(shimmerT + i * 0.4) * 0.12;
          const dotH = Math.max(2, baseH * shimmer);
          const dotY = H - dotH;
          const alpha = data.isActive ? 0.2 : 0.12;

          ctx.fillStyle = `rgba(120, 100, 200, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          const r = Math.min(barW / 2, 2);
          if (ctx.roundRect) {
            ctx.roundRect(x, dotY, barW, dotH, [r, r, 0, 0]);
          } else {
            ctx.rect(x, dotY, barW, dotH);
          }
          ctx.fill();
        }
      }

      // Playhead line — glowing vertical marker
      if (pct > 0 && pct < 1) {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(120, 160, 255, 0)");
        grad.addColorStop(0.2, "rgba(120, 160, 255, 0.55)");
        grad.addColorStop(0.8, "rgba(100, 100, 255, 0.35)");
        grad.addColorStop(1, "rgba(100, 100, 255, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(playheadX - 0.75, 0, 1.5, H);
      }
    });

    return () => {
      unsub();
      ro.disconnect();
    };
  }, [height, numBars]);

  return <canvas ref={canvasRef} className={`block ${className}`} />;
}
