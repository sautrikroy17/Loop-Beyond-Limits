import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Plus, Loader2, Music2 } from "lucide-react";
import { usePlayback, type Track } from "@/hooks/usePlayback";
import { hybridSearchFn } from "@/functions/search";
import { Reveal } from "./Reveal";

const GENRES = [
  { label: "Phonk", query: "phonk drift 2024" },
  { label: "Slowed + Reverb", query: "slowed reverb trending" },
  { label: "Lofi", query: "lofi hip hop chill beats" },
  { label: "Rap", query: "rap 2024 top hits" },
  { label: "R&B", query: "rnb soul 2024" },
  { label: "Electronic", query: "electronic music 2024" },
  { label: "Indie", query: "indie alternative 2024" },
  { label: "Jazz", query: "jazz vibes nocturnal" },
  { label: "Trending", query: "trending songs 2024" },
];

// ─── Track Card ───────────────────────────────────────────────────

function TrackCard({ track }: { track: Track }) {
  const { playTrack, addToQueue, currentTrack, isPlaying } = usePlayback();
  const isActive = currentTrack?.id === track.id;

  return (
    <div className="group relative w-44 shrink-0 select-none">
      {/* Art */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl bg-white/[0.04]"
        style={
          isActive
            ? {
                boxShadow:
                  "0 0 0 1.5px oklch(0.72 0.23 290 / 0.7), 0 8px 32px -8px oklch(0.72 0.23 290 / 0.4)",
              }
            : {}
        }
      >
        {track.albumArt ? (
          <img
            src={track.albumArt}
            alt={track.title}
            className="h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="h-8 w-8 text-white/10" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addToQueue(track);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <Plus className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={() => playTrack(track)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, oklch(0.72 0.23 290), oklch(0.70 0.20 242))",
            }}
          >
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </button>
        </div>

        {/* Playing badge */}
        {isActive && isPlaying && (
          <div className="absolute left-2 top-2 flex items-end gap-px rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[2px] rounded-full bg-[oklch(0.80_0.22_290)]"
                style={{
                  animation: `loop-eq ${0.5 + i * 0.2}s ease-in-out ${i * 0.08}s infinite alternate`,
                  minHeight: 3,
                  maxHeight: 10,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <button className="mt-3 w-full text-left" onClick={() => playTrack(track)}>
        <div className="truncate text-[13px] font-medium text-white/85 transition-colors group-hover:text-white">
          {track.title}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-white/35">{track.artist}</div>
      </button>
    </div>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="w-44 shrink-0">
          <div className="aspect-square w-full animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-white/[0.04]" />
          <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded-full bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}

// ─── Track row ────────────────────────────────────────────────────

function TrackRow({ title, query, showDot }: { title: string; query: string; showDot?: boolean }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTracks([]);
    hybridSearchFn({ data: query })
      .then((res) => {
        if (!cancelled) setTracks((res as Track[]).slice(0, 14));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div>
      {title && (
        <div className="mb-5 flex items-center gap-2.5">
          {showDot && (
            <span className="h-[7px] w-[7px] rounded-full bg-[oklch(0.72_0.23_290)] shadow-[0_0_10px_oklch(0.70_0.23_290_/_0.9)]" />
          )}
          <h3 className="text-base font-semibold text-white/90">{title}</h3>
        </div>
      )}
      {loading ? (
        <SkeletonRow />
      ) : tracks.length === 0 ? (
        <div className="py-4 text-sm text-white/20">No tracks found</div>
      ) : (
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-4 pb-2">
            {tracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      className="h-px w-full"
      style={{
        background:
          "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.06) 20%, oklch(1 0 0 / 0.06) 80%, transparent)",
      }}
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export function DiscoverySection() {
  const { currentTrack } = usePlayback();
  const [activeGenre, setActiveGenre] = useState(GENRES[0]);

  return (
    <section id="discover" className="relative px-6 py-28">
      <div className="mx-auto max-w-6xl space-y-20">
        {/* ── Header ── */}
        <Reveal>
          <div className="flex items-end justify-between">
            <div>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.4em] text-white/25">
                Discover
              </p>
              <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[1.06] tracking-tight text-white">
                Your music universe.
              </h2>
            </div>
          </div>
        </Reveal>

        <Divider />

        {/* ── Genre pills ── */}
        <Reveal delay={0.05}>
          <div>
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.4em] text-white/22">
              Browse by mood
            </p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const active = activeGenre.label === g.label;
                return (
                  <button
                    key={g.label}
                    onClick={() => setActiveGenre(g)}
                    className="rounded-full px-4 py-2 text-xs font-medium transition-all duration-200"
                    style={
                      active
                        ? {
                            background:
                              "linear-gradient(135deg, oklch(0.68 0.23 290), oklch(0.65 0.21 244))",
                            color: "white",
                            boxShadow: "0 0 24px -4px oklch(0.68 0.23 290 / 0.55)",
                          }
                        : {
                            border: "1px solid oklch(1 0 0 / 0.08)",
                            background: "oklch(1 0 0 / 0.03)",
                            color: "oklch(1 0 0 / 0.42)",
                          }
                    }
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* ── Active genre ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGenre.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <TrackRow title={activeGenre.label} query={activeGenre.query} />
          </motion.div>
        </AnimatePresence>

        <Divider />

        {/* ── Trending ── */}
        <Reveal delay={0.08}>
          <TrackRow title="Trending Now" query="trending songs 2024 top hits" />
        </Reveal>

        {/* ── Recommendations when playing ── */}
        <AnimatePresence>
          {currentTrack && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Divider />
              <div className="mt-20">
                <TrackRow
                  key={currentTrack.id}
                  title={`More like ${currentTrack.artist}`}
                  query={`${currentTrack.artist} songs similar`}
                  showDot
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
