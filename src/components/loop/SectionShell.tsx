import { motion, useScroll, useTransform } from "framer-motion";
import type { ReactNode } from "react";
import { useRef } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

type Tone = "violet" | "blue" | "pink";

const toneMap: Record<Tone, { glow: string; accent: string }> = {
  violet: {
    glow: "oklch(0.7 0.22 290 / 0.28)",
    accent: "oklch(0.7 0.22 290 / 0.75)",
  },
  blue: {
    glow: "oklch(0.72 0.2 240 / 0.26)",
    accent: "oklch(0.72 0.2 240 / 0.7)",
  },
  pink: {
    glow: "oklch(0.75 0.22 340 / 0.24)",
    accent: "oklch(0.75 0.22 340 / 0.7)",
  },
};

export function SectionShell({
  id,
  children,
  className = "",
  tone = "violet",
  withTopWave = true,
  withBottomWave = true,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: Tone;
  withTopWave?: boolean;
  withBottomWave?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [32, -32]);
  const depth = useTransform(scrollYProgress, [0, 1], [0.96, 1.02]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.35, 0.8, 1], [0.08, 0.32, 0.18, 0.04]);

  const { glow, accent } = toneMap[tone];

  return (
    <section
      id={id}
      ref={ref}
      className={`relative overflow-hidden ${className}`}
    >
      {/* atmospheric gradient that softly blends sections */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          opacity: glowOpacity,
          background: `radial-gradient(120% 140% at 10% 0%, ${glow}, transparent 55%), radial-gradient(110% 130% at 90% 100%, ${accent}, transparent 60%)`,
        }}
      />

      {/* soft wave-inspired divider at top */}
      {withTopWave && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24"
          initial={{ opacity: 0, y: -24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1.1, ease }}
          style={{
            background:
              "radial-gradient(120% 160% at 50% 0%, oklch(0.12 0.03 270 / 0) 0%, oklch(0.18 0.04 270 / 0.12) 45%, transparent 70%)",
          }}
        />
      )}

      {/* soft wave-inspired divider at bottom */}
      {withBottomWave && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1.2, ease }}
          style={{
            background:
              "radial-gradient(120% 160% at 50% 100%, transparent 15%, oklch(0.08 0.02 270 / 0.12) 55%, transparent 80%)",
          }}
        />
      )}

      {/* main content with gentle scroll-linked depth */}
      <motion.div
        style={{ y, scale: depth }}
        transition={{ duration: 0.9, ease }}
        className="relative"
      >
        {children}
      </motion.div>
    </section>
  );
}

