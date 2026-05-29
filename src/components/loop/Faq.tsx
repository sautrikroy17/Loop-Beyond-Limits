import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Reveal } from "./Reveal";
import { SectionShell } from "./SectionShell";
import { useTactileHover } from "@/hooks/useTactileHover";

const faqs = [
  {
    q: "What makes Loop different?",
    a: "Loop is a cinematic, reactive interface. The visuals, depth, and motion respond to the music in real time — so listening feels like being inside the song, not selecting it from a list.",
  },
  {
    q: "Is Loop really lossless?",
    a: "Yes. Every track on Plus and Infinite streams in studio-grade lossless quality, with optional spatial mixes from supporting artists and labels.",
  },
  {
    q: "Does it work on mobile?",
    a: "Loop is mobile-first. The atmospheric interface, spatial audio, and reactive visuals are tuned for both phones and desktop.",
  },
  {
    q: "Can I listen with friends?",
    a: "On Loop Infinite, synced rooms let you and friends listen to the same track in the same atmosphere — anywhere in the world.",
  },
  {
    q: "How does AI discovery work?",
    a: "Loop learns the texture of your taste — tempo, mood, density, color — and surfaces songs you'd love before you'd think to search for them.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <SectionShell id="faq" tone="violet" className="py-32">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <Reveal>
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Questions
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold">
              Everything, <span className="text-gradient">in tune.</span>
            </h2>
          </Reveal>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.05}>
                <FaqRow f={f} i={i} isOpen={isOpen} onToggle={() => setOpen(isOpen ? null : i)} />
              </Reveal>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}

function FaqRow({
  f,
  i,
  isOpen,
  onToggle,
}: {
  f: (typeof faqs)[number];
  i: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const tactile = useTactileHover({
    maxTilt: 8,
    spotlightStrength: 0.22,
    stiffness: 240,
    damping: 20,
  });

  return (
    <motion.div
      layout
      {...tactile.bind}
      style={{
        ...tactile.transformStyle,
        rotateX: tactile.rx,
        rotateY: tactile.ry,
      }}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
      className="glass overflow-hidden rounded-2xl relative"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
        style={{
          background: tactile.spotlightBg,
          opacity: tactile.spotlightOpacity,
        }}
      />

      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="font-display text-base sm:text-lg">{f.q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-base"
        >
          +
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden px-6 text-sm text-muted-foreground"
          >
            <div className="pb-6">{f.a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
