import { motion } from "framer-motion";

/** Animated equalizer bars / waveform. */
export function Waveform({
  bars = 48,
  className = "",
  height = 80,
  isPlaying = true,
}: {
  bars?: number;
  className?: string;
  height?: number;
  isPlaying?: boolean;
}) {
  return (
    <div className={`flex items-center justify-center gap-[3px] ${className}`} style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const seed = (Math.sin(i * 1.3) + 1) / 2;
        const base = 0.25 + seed * 0.75;
        return (
          <motion.span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              background: "linear-gradient(180deg, oklch(0.85 0.18 290), oklch(0.65 0.22 240))",
              boxShadow: "0 0 8px oklch(0.7 0.22 290 / 0.6)",
            }}
            animate={
              isPlaying
                ? {
                    height: [
                      `${base * 30}%`,
                      `${Math.min(100, base * 110)}%`,
                      `${base * 50}%`,
                      `${base * 90}%`,
                      `${base * 30}%`,
                    ],
                  }
                : { height: "10%" }
            }
            transition={{
              duration: 1.4 + (i % 7) * 0.12,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.03,
            }}
          />
        );
      })}
    </div>
  );
}
