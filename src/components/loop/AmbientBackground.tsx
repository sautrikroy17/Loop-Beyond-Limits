/**
 * AmbientBackground — premium cinematic gradient atmosphere
 *
 * Restores the original rich purple/blue gradient aesthetic
 * with brighter orbs, smooth fade-outs, and no black cutoffs.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 20% 15%,
            oklch(0.22 0.09 265) 0%,
            oklch(0.13 0.05 265) 45%,
            oklch(0.09 0.025 260) 100%)
        `,
      }}
    >
      {/* ── Top-left vibrant blue-violet glow ── */}
      <div
        className="absolute"
        style={{
          width: '130vw',
          height: '130vh',
          top: '-15%',
          left: '-15%',
          background: 'radial-gradient(circle at center, oklch(0.32 0.14 265 / 0.38) 0%, transparent 58%)',
          animation: 'amb-mesh-a 25s infinite alternate ease-in-out',
          willChange: 'transform',
        }}
      />

      {/* ── Right-center purple accent ── */}
      <div
        className="absolute"
        style={{
          width: '100vw',
          height: '100vh',
          top: '10%',
          right: '-20%',
          background: 'radial-gradient(circle at center, oklch(0.28 0.12 290 / 0.28) 0%, transparent 55%)',
          animation: 'amb-mesh-b 32s infinite alternate-reverse ease-in-out',
          willChange: 'transform',
        }}
      />

      {/* ── Center violet accent — main body glow ── */}
      <div
        className="absolute"
        style={{
          width: '90vw',
          height: '80vh',
          top: '25%',
          left: '20%',
          background: 'radial-gradient(circle at center, oklch(0.24 0.10 278 / 0.22) 0%, transparent 65%)',
          animation: 'amb-mesh-c 22s infinite alternate ease-in-out',
          willChange: 'transform, opacity',
        }}
      />

      {/* ── Bottom glow — prevents pure black ── */}
      <div
        className="absolute"
        style={{
          width: '120vw',
          height: '70vh',
          bottom: '-20%',
          left: '-10%',
          background: 'radial-gradient(ellipse at 50% 80%, oklch(0.20 0.07 270 / 0.42) 0%, transparent 65%)',
          animation: 'amb-mesh-b 28s infinite alternate ease-in-out',
          willChange: 'transform',
        }}
      />

      {/* ── Bottom-right teal accent ── */}
      <div
        className="absolute"
        style={{
          width: '80vw',
          height: '60vh',
          bottom: '-5%',
          right: '-5%',
          background: 'radial-gradient(circle at center, oklch(0.18 0.08 250 / 0.25) 0%, transparent 60%)',
        }}
      />

      <style>{`
        @keyframes amb-mesh-a {
          0%   { transform: scale(1) translate(0, 0) rotate(0deg); opacity: 0.6; }
          100% { transform: scale(1.25) translate(8%, 6%) rotate(12deg); opacity: 0.9; }
        }
        @keyframes amb-mesh-b {
          0%   { transform: scale(1.1) translate(0, 0) rotate(0deg); opacity: 0.7; }
          100% { transform: scale(0.85) translate(-12%, -8%) rotate(-8deg); opacity: 1.0; }
        }
        @keyframes amb-mesh-c {
          0%   { transform: scale(0.85) translate(8%, -8%); opacity: 0.4; }
          100% { transform: scale(1.35) translate(-8%, 8%); opacity: 0.75; }
        }
      `}</style>

      {/* ── Fine dot grid for spatial depth ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(1 0 0 / 0.055) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, black 10%, transparent 80%)',
        }}
      />

      {/* ── Film grain — premium feel ── */}
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