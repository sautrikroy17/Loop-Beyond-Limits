import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Reveal } from "./Reveal";
import { useTactileHover } from "@/hooks/useTactileHover";

const panels = [
  {
    tag: "Atmosphere",
    title: "Rooms that breathe",
    desc: "Visual environments tuned to every track.",
  },
  { tag: "Discovery", title: "Curated by feel", desc: "AI that listens with you, not for you." },
  {
    tag: "Spatial",
    title: "Sound in dimensions",
    desc: "Lossless layers placed around your head.",
  },
  { tag: "Live", title: "Sessions in real time", desc: "Drop into artist sets as they happen." },
  { tag: "Together", title: "Listen as one", desc: "Synced rooms with friends across the world." },
];

export function Showcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["2%", "-72%"]);

  return (
    <section ref={ref} className="relative h-[320vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto mb-10 max-w-6xl px-6">
          <Reveal>
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              The showcase
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-[clamp(2rem,5vw,4.5rem)] font-semibold leading-[1.02]">
              A world that <span className="text-gradient">unfolds sideways.</span>
            </h2>
          </Reveal>
        </div>

        <motion.div style={{ x }} className="flex gap-6 pl-[10vw]">
          {panels.map((p, i) => (
            <PanelCard key={p.title} p={p} i={i} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function PanelCard({ p, i }: { p: (typeof panels)[number]; i: number }) {
  const tactile = useTactileHover({
    maxTilt: 8,
    spotlightStrength: 0.28,
    stiffness: 240,
    damping: 20,
  });

  return (
    <motion.div
      {...tactile.bind}
      style={{
        ...tactile.transformStyle,
        rotateX: tactile.rx,
        rotateY: tactile.ry,
      }}
      whileHover={{ y: -10 }}
      transition={{ type: "spring", stiffness: 250, damping: 20 }}
      className="glass relative h-[60vh] w-[80vw] max-w-[640px] shrink-0 overflow-hidden rounded-3xl p-8"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
        style={{
          background: tactile.spotlightBg,
          opacity: tactile.spotlightOpacity,
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-70"
        style={{
          background: `radial-gradient(circle at ${20 + i * 15}% 30%, oklch(0.5 0.22 ${
            260 + i * 20
          } / 0.55), transparent 70%)`,
        }}
      />
      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        0{i + 1} · {p.tag}
      </div>
      <div className="mt-auto" />
      <div className="absolute inset-x-8 bottom-8">
        <h3 className="font-display text-3xl font-semibold sm:text-4xl">{p.title}</h3>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{p.desc}</p>
      </div>
    </motion.div>
  );
}
