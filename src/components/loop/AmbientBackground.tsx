/**
 * AmbientBackground — dark minimalistic gradient aesthetic
 *
 * Design: Very dark navy base with VIVID, visible gradient orbs.
 * The key is strong orb opacity/chroma so they pierce the dark base.
 * - Top-left: electric blue-violet (dominant)
 * - Right-center: deep purple
 * - Bottom: violet fade-out prevents pure black
 * - Fine dot grid + film grain for premium texture
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        // Very dark navy base with subtle purple tint
        background: `
          radial-gradient(ellipse at 18% 12%,
            oklch(0.19 0.08 268) 0%,
            oklch(0.10 0.04 268) 40%,
            oklch(0.075 0.028 265) 100%)
        `,
      }}
    >
      {/* ── Top-left: Strong blue-violet primary orb ── */}
      <div
        className="absolute"
        style={{
          width: '140vw',
          height: '110vh',
          top: '-20%',
          left: '-20%',
          background: 'radial-gradient(circle at center, oklch(0.38 0.18 262 / 0.52) 0%, oklch(0.28 0.14 268 / 0.25) 40%, transparent 65%)',
          animation: 'amb-a 26s infinite alternate ease-in-out',
          willChange: 'transform',
        }}
      />

      {/* ── Right-center: Purple accent orb ── */}
      <div
        className="absolute"
        style={{
          width: '110vw',
          height: '110vh',
          top: '5%',
          right: '-25%',
          background: 'radial-gradient(circle at center, oklch(0.32 0.16 288 / 0.44) 0%, oklch(0.22 0.10 285 / 0.20) 45%, transparent 65%)',
          animation: 'amb-b 33s infinite alternate-reverse ease-in-out',
          willChange: 'transform',
        }}
      />

      {/* ── Center-low: Subtle violet bridge ── */}
      <div
        className="absolute"
        style={{
          width: '85vw',
          height: '75vh',
          top: '40%',
          left: '22%',
          background: 'radial-gradient(circle at center, oklch(0.22 0.10 276 / 0.28) 0%, transparent 70%)',
          animation: 'amb-c 21s infinite alternate ease-in-out',
          willChange: 'transform, opacity',
        }}
      />

      {/* ── Bottom: Fill glow — no black cutoff ── */}
      <div
        className="absolute"
        style={{
          width: '130vw',
          height: '70vh',
          bottom: '-25%',
          left: '-15%',
          background: 'radial-gradient(ellipse at 50% 90%, oklch(0.24 0.10 272 / 0.50) 0%, oklch(0.14 0.06 270 / 0.25) 50%, transparent 75%)',
        }}
      />

      {/* ── Bottom-right corner teal ── */}
      <div
        className="absolute"
        style={{
          width: '70vw',
          height: '50vh',
          bottom: '-10%',
          right: '-5%',
          background: 'radial-gradient(circle at center, oklch(0.20 0.09 252 / 0.32) 0%, transparent 65%)',
          animation: 'amb-a 19s 4s infinite alternate ease-in-out',
        }}
      />

      <style>{`
        @keyframes amb-a {
          0%   { transform: scale(1) translate(0, 0) rotate(0deg); opacity: 0.65; }
          100% { transform: scale(1.22) translate(8%, 5%) rotate(10deg); opacity: 0.95; }
        }
        @keyframes amb-b {
          0%   { transform: scale(1.1) translate(0, 0) rotate(0deg); opacity: 0.70; }
          100% { transform: scale(0.88) translate(-12%, -8%) rotate(-7deg); opacity: 1.0; }
        }
        @keyframes amb-c {
          0%   { transform: scale(0.85) translate(6%, -8%); opacity: 0.45; }
          100% { transform: scale(1.30) translate(-6%, 8%); opacity: 0.80; }
        }
      `}</style>

      {/* ── Fine dot grid ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(1 0 0 / 0.06) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, black 10%, transparent 80%)',
        }}
      />

      {/* ── Film grain ── */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  );
}