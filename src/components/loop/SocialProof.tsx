import { motion } from "framer-motion";
import { Reveal } from "./Reveal";
import { SectionShell } from "./SectionShell";
import { useTactileHover } from "@/hooks/useTactileHover";

const testimonials = [
  {
    name: "Maya R.",
    role: "Producer · Berlin",
    quote: "Loop doesn't play music — it stages it. I hear every layer.",
  },
  {
    name: "Kenji A.",
    role: "DJ · Tokyo",
    quote: "The interface moves like sound. It feels emotional, not technical.",
  },
  {
    name: "Ava L.",
    role: "Listener · NYC",
    quote: "I forgot I was using an app. I was just inside the song.",
  },
  {
    name: "Theo M.",
    role: "Artist · Lagos",
    quote: "Spatial mixes feel alive. Loop made my own tracks new again.",
  },
  {
    name: "Sora K.",
    role: "Composer · Seoul",
    quote: "Discovery that finally understands texture, not just genre.",
  },
  {
    name: "Iris D.",
    role: "Curator · Paris",
    quote: "The most cinematic listening experience on any device.",
  },
];

const stats = [
  { v: "12M+", l: "Listeners" },
  { v: "180M", l: "Tracks in lossless" },
  { v: "98%", l: "Stay past minute one" },
  { v: "60fps", l: "Reactive interface" },
];

export function SocialProof() {
  return (
    <SectionShell tone="pink" className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <Reveal>
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              A growing universe
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-[clamp(2rem,5vw,4rem)] font-semibold">
              The sound of <span className="text-gradient">a new era.</span>
            </h2>
          </Reveal>
        </div>

        <Reveal>
          <div className="glass mb-16 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/5 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.l} className="bg-background/60 p-8 text-center">
                <div className="text-gradient font-display text-4xl font-semibold">{s.v}</div>
                <div className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* marquee that carries momentum horizontally */}
      <div className="relative overflow-hidden py-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent" />
        <motion.div
          className="flex w-max gap-5"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        >
          {[...testimonials, ...testimonials].map((t, i) => (
            <TestimonialCard key={i} t={t} i={i} />
          ))}
        </motion.div>
      </div>
    </SectionShell>
  );
}

function TestimonialCard({ t, i }: { t: (typeof testimonials)[number]; i: number }) {
  const tactile = useTactileHover({
    maxTilt: 7,
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
      whileHover={{ y: -10, scale: 1.03 }}
      transition={{ type: "spring", stiffness: 250, damping: 20 }}
      className="glass w-[320px] shrink-0 rounded-2xl p-6 relative"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
        style={{
          background: tactile.spotlightBg,
          opacity: tactile.spotlightOpacity,
        }}
      />
      <div className="text-sm leading-relaxed text-foreground/90">"{t.quote}"</div>
      <div className="mt-5 flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-full"
          style={{
            background:
              "conic-gradient(from " +
              i * 60 +
              "deg, oklch(0.7 0.22 290), oklch(0.72 0.2 240), oklch(0.82 0.15 200))",
          }}
        />
        <div>
          <div className="text-sm font-medium">{t.name}</div>
          <div className="text-xs text-muted-foreground">{t.role}</div>
        </div>
      </div>
    </motion.div>
  );
}
