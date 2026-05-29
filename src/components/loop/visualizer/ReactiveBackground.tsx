/**
 * ReactiveBackground — Audio-reactive canvas, full-page
 *
 * Renders on top of AmbientBackground via screen blend.
 * Five elements driven by different audio bands:
 *
 *  1. Center radial pulse  — beat flash (white glow on kick)
 *  2. Violet bloom UL     — bass driven, large and atmospheric
 *  3. Electric blue UR    — treble driven
 *  4. Warm mid bloom BC   — mid/vocal driven, lower center
 *  5. Subtle scanlines    — loudness driven top→bottom gradient
 *
 * All at higher base alpha than before so they're visible at rest.
 * Screen blend means they ADD light, never wash out the dark base.
 */

import { subscribeToAudio } from "@/hooks/useAudioData";
import { useSettings } from "@/hooks/useSettings";
import { useRef, useEffect } from "react";

export function ReactiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { effectIntensity, premiumMode, immersiveEffects } = useSettings();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) {
        canvas.width = 0;
        canvas.height = 0;
      } else {
        // Render at half resolution for massive performance boost, CSS scales it up
        canvas.width = Math.max(rect.width / 2, 400);
        canvas.height = Math.max(rect.height / 2, 300);
      }
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    // Smoothed values — prevent jitter from individual frames
    let sBass = 0,
      sMid = 0,
      sTreble = 0,
      sBeat = 0,
      sLoud = 0,
      sIntensity = effectIntensity;

    const unsub = subscribeToAudio((d) => {
      if (!canvas || !ctx) return;
      const W = canvas.width,
        H = canvas.height;
      if (W === 0 || H === 0) return; // FIX: Abort expensive canvas rendering when hidden on mobile!

      // Smooth (different rates per band for natural feel)
      sBass += (d.bass - sBass) * 0.1;
      sMid += (d.mid - sMid) * 0.1;
      sTreble += (d.treble - sTreble) * 0.14;
      sBeat += (d.beat - sBeat) * 0.2;
      sLoud += (d.loudness - sLoud) * 0.08;
      sIntensity += (effectIntensity - sIntensity) * 0.04; // Smooth mode switching

      ctx.clearRect(0, 0, W, H);

      if (!immersiveEffects || premiumMode === "focus" || sIntensity < 0.01) return;

      const scale = sIntensity;

      // ── 1. Violet bass bloom — upper left ────────────────────────
      {
        const radius = W * (0.55 + sBass * 0.22);
        const cx = W * 0.08,
          cy = H * 0.12;
        const a0 = (0.1 + sBass * 0.32) * scale;
        const a1 = (0.02 + sBass * 0.1) * scale;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(110, 60, 255, ${a0.toFixed(3)})`);
        g.addColorStop(0.5, `rgba(90,  45, 220, ${a1.toFixed(3)})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ── 2. Electric blue treble bloom — upper right ───────────────
      {
        const radius = W * (0.42 + sTreble * 0.16);
        const cx = W * 0.92,
          cy = H * 0.1;
        const a0 = (0.08 + sTreble * 0.24) * scale;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(50, 120, 255, ${a0.toFixed(3)})`);
        g.addColorStop(0.5, `rgba(30,  90, 220, ${(a0 * 0.35).toFixed(3)})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ── 3. Vocal / mid glow — lower center ───────────────────────
      {
        const radius = W * (0.3 + sLoud * 0.1);
        const cx = W * 0.5,
          cy = H * 0.5;
        const a0 = (0.06 + sBeat * 0.25) * scale;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(180, 60, 255, ${a0.toFixed(3)})`);
        g.addColorStop(0.6, `rgba(100, 40, 200, ${(a0 * 0.3).toFixed(3)})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ── 4. Cyan accent — lower left ──────────────────────────────
      {
        const radius = W * (0.3 + sMid * 0.08);
        const cx = W * 0.12,
          cy = H * 0.82;
        const a0 = (0.04 + sMid * 0.12) * scale;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(30, 200, 255, ${a0.toFixed(3)})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ── 5. Beat flash — center radial white pulse ─────────────────
      if (sBeat > 0.2) {
        const a = ((sBeat - 0.2) / 0.8) * 0.055;
        const cx = W * 0.5,
          cy = H * 0.38;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.65);
        g.addColorStop(0, `rgba(255, 255, 255, ${a.toFixed(4)})`);
        g.addColorStop(0.5, `rgba(180, 150, 255, ${(a * 0.4).toFixed(4)})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ── 6. Top-edge vignette deepens with loudness ────────────────
      {
        const a = 0.04 + sLoud * 0.06;
        const g = ctx.createLinearGradient(0, 0, 0, H * 0.35);
        g.addColorStop(0, `rgba(20, 10, 50, ${a.toFixed(3)})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    });

    return unsub;
  }, [effectIntensity, premiumMode, immersiveEffects]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 hidden md:block"
      style={{ zIndex: -9, mixBlendMode: "screen" }}
    />
  );
}
