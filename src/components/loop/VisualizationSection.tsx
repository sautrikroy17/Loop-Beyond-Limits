import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Reveal } from "./Reveal";
import { SectionShell } from "./SectionShell";

export function VisualizationSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y1 = useTransform(scrollYProgress, [0, 1], [80, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [40, -60]);
  const rot = useTransform(scrollYProgress, [0, 1], [-6, 6]);

  return (
    <SectionShell id="experience" tone="blue" className="py-32 sm:py-48">
      <div ref={ref} className="mx-auto max-w-6xl px-6 text-center">
        <Reveal>
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Inside the sound
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-display text-[clamp(2.25rem,6vw,5rem)] font-semibold leading-[1.02]">
            Step inside the <span className="text-gradient">waveform.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
            Every track becomes a space. Light bends with the melody, layers breathe with the
            rhythm, and the room moves with you.
          </p>
        </Reveal>
      </div>

      {/* Layered SVG wave system that bridges into the next section */}
      <div className="relative mt-20 h-[420px] w-full">
        <motion.div style={{ y: y1, rotate: rot }} className="absolute inset-0">
          <WaveLayer color="oklch(0.7 0.22 290 / 0.55)" amp={60} freq={0.6} dy={120} />
        </motion.div>
        <motion.div style={{ y: y2 }} className="absolute inset-0">
          <WaveLayer color="oklch(0.72 0.2 240 / 0.5)" amp={80} freq={0.45} dy={180} />
        </motion.div>
        <div className="absolute inset-0">
          <WaveLayer color="oklch(0.82 0.15 200 / 0.4)" amp={50} freq={0.8} dy={240} />
        </div>
        {/* particles */}
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/70"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              boxShadow: "0 0 8px oklch(0.85 0.18 290)",
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 4 + (i % 5),
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </SectionShell>
  );
}

function WaveLayer({
  color,
  amp,
  freq,
  dy,
}: {
  color: string;
  amp: number;
  freq: number;
  dy: number;
}) {
  // Build a sinusoidal path
  const w = 1200;
  const points = Array.from({ length: 60 }, (_, i) => {
    const x = (i / 59) * w;
    const y = Math.sin(i * freq) * amp + 200;
    return `${x},${y}`;
  }).join(" L");
  const d = `M0,${dy} L${points} L${w},420 L0,420 Z`;
  const path = `M0,200 L${points}`;
  return (
    <svg viewBox="0 0 1200 420" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={`g-${dy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        animate={{
          d: [
            path,
            path.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, (_m, x, y) => {
              const ny = Number(y) + Math.sin(Number(x) * 0.02) * 12;
              return `${x},${ny}`;
            }),
            path,
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: "drop-shadow(0 0 8px " + color + ")" }}
      />
      <path d={d} fill={`url(#g-${dy})`} opacity="0.4" />
    </svg>
  );
}
