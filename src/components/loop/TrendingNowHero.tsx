import { motion } from "framer-motion";
import { Play, TrendingUp } from "lucide-react";
import { usePlayback, type Track } from "@/hooks/usePlayback";
import { Reveal } from "./Reveal";

interface TrendingNowHeroProps {
  section: {
    id: string;
    title: string;
    tracks: Track[];
  };
}

export function TrendingNowHero({ section }: TrendingNowHeroProps) {
  const { playTrack, addToQueue } = usePlayback();

  if (!section || !section.tracks || section.tracks.length === 0) return null;

  const coverArt = section.tracks[0]?.albumArt;

  const handlePlayMix = () => {
    // Play first track, queue the rest
    playTrack(section.tracks[0]);
    section.tracks.slice(1, 10).forEach((t) => addToQueue(t));
  };

  return (
    <Reveal delay={0.2}>
      <div
        className="group relative mt-16 mb-16 overflow-hidden rounded-3xl border border-white/5 bg-black/20"
        style={{ transformStyle: "preserve-3d", perspective: "1200px" }}
      >
        {/* Animated Background */}
        <div
          className="absolute inset-0 z-0 scale-110 blur-3xl opacity-40 transition-transform duration-1000 group-hover:scale-125 saturate-200"
          style={{
            backgroundImage: `url(${coverArt})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-tr from-black/90 via-black/60 to-transparent" />

        {/* Main Content */}
        <div className="relative z-10 flex flex-col items-start p-8 sm:p-12 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 rounded-full bg-red-500/10 px-4 py-1.5 backdrop-blur-md border border-red-500/20 w-fit">
              <TrendingUp className="h-4 w-4 text-red-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-100">
                Trending Now
              </span>
            </div>

            <h2 className="mb-4 font-display text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.1] tracking-tight text-white drop-shadow-2xl">
              {section.title}
            </h2>
            <p className="text-sm md:text-base text-white/60 max-w-md font-medium leading-relaxed">
              The pulse of what music lovers are obsessed with right now. Verified global chart data
              and viral culture movements.
            </p>

            <div className="mt-8 flex gap-4">
              <button
                onClick={handlePlayMix}
                className="flex items-center gap-2 rounded-full px-8 py-4 font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-2xl"
                style={{
                  background: "linear-gradient(135deg, oklch(0.6 0.25 20), oklch(0.5 0.2 300))",
                }}
              >
                <Play className="h-5 w-5 fill-current" />
                Play Chart
              </button>
            </div>
          </div>

          {/* Trending Ladder */}
          <div className="mt-12 md:mt-0 flex flex-col gap-3 w-full md:w-80 lg:w-96 shrink-0">
            {section.tracks.slice(0, 4).map((t, i) => (
              <button
                key={t.id}
                onClick={() => playTrack(t)}
                className="group/track flex items-center gap-4 rounded-xl bg-white/5 p-3 backdrop-blur-sm transition-colors hover:bg-white/10 text-left border border-white/5"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
                  <img
                    src={t.albumArt}
                    alt={t.title}
                    className="h-full w-full object-cover transition-transform group-hover/track:scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/track:opacity-100">
                    <Play className="h-5 w-5 fill-white text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[13px] font-bold text-white/90 group-hover/track:text-white">
                    {t.title}
                  </div>
                  <div className="truncate text-[11px] font-medium text-white/40">{t.artist}</div>
                </div>
                <div className="text-[10px] font-mono font-bold text-white/20">#{i + 1}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
