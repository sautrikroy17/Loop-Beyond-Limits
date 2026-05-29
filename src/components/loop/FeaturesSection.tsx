import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";
import { SectionShell } from "./SectionShell";

const features = [
  {
    title: "Lossless Spatial Audio",
    body: "Studio-grade fidelity rendered in three dimensions. Every instrument has a place — every place has a feeling.",
    icon: SpatialIcon,
    glow: "oklch(0.7 0.22 290 / 0.5)",
  },
  {
    title: "AI-Powered Discovery",
    body: "An adaptive intelligence that learns the texture of your taste and surfaces songs before you know you need them.",
    icon: SparkIcon,
    glow: "oklch(0.72 0.2 240 / 0.5)",
  },
  {
    title: "Reactive Immersive Listening",
    body: "The interface breathes with the music. Light, depth, and motion all respond to what plays.",
    icon: WaveIcon,
    glow: "oklch(0.82 0.15 200 / 0.45)",
  },
];

export function FeaturesSection() {
  return (
    <SectionShell id="features" tone="violet" className="py-32 sm:py-48">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <Reveal>
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              The experience
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-[1.02]">
              Built for the way <br className="hidden sm:block" />
              <span className="text-gradient">music makes you feel.</span>
            </h2>
          </Reveal>
        </div>

        <Stagger className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <FeatureCard {...f} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </SectionShell>
  );
}

function FeatureCard({ title, body, icon: Icon, glow }: (typeof features)[number]) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const hover = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-50, 50], [8, -8]), { stiffness: 150, damping: 15 });
  const ry = useSpring(useTransform(mx, [-50, 50], [-8, 8]), { stiffness: 150, damping: 15 });
  const hoverSpring = useSpring(hover, { stiffness: 260, damping: 22 });
  const gx = useTransform(mx, [-160, 160], [0, 100]);
  const gy = useTransform(my, [-160, 160], [0, 100]);
  const spotlightBg = useMotionTemplate`radial-gradient(closest-side at ${gx}% ${gy}%, ${glow}, transparent 70%)`;

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        mx.set(e.clientX - r.left - r.width / 2);
        my.set(e.clientY - r.top - r.height / 2);
      }}
      onMouseEnter={() => hover.set(1)}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
        hover.set(0);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      whileHover={{ y: -7, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="glass group relative h-full overflow-hidden rounded-3xl p-7"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
        style={{ background: spotlightBg, opacity: hoverSpring }}
      />
      <div
        className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, oklch(0.22 0.05 280), oklch(0.18 0.05 260))",
          boxShadow: `inset 0 0 0 1px oklch(1 0 0 / 0.08), 0 0 30px -10px ${glow}`,
        }}
      >
        <Icon />
      </div>
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px w-8 bg-gradient-to-r from-white/40 to-transparent" />
        Learn more
      </div>
    </motion.div>
  );
}

function SpatialIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M18 6l-4 4M10 14l-4 4"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function WaveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
