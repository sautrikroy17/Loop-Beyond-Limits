/**
 * RecommendationFeed
 *
 * Replaces the old DiscoverySection with 6 real dynamic sections
 * powered by useDiscovery (YTM InnerTube + session history).
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Plus, Music2, Lock, LogIn, Activity } from "lucide-react";
import { usePlayback, type Track } from "@/hooks/usePlayback";
import { useDiscovery, type DiscoverySection } from "@/hooks/useDiscovery";
import { useAuth } from "@/hooks/useAuth";
import { LikeButton } from "./LikeButton";
import { Reveal } from "./Reveal";
import { DailyMix } from "./DailyMix";
import { AlbumModal } from "./AlbumModal";
import { AIHeroMix } from "./AIHeroMix";
import { TrendingNowHero } from "./TrendingNowHero";

// ─── Section icon map ─────────────────────────────────────────────

const SECTION_META: Record<string, { emoji: string; sub: string }> = {
  "for-you": { emoji: "✦", sub: "Picks based on what you're playing" },
  similar: { emoji: "◈", sub: "Sounds like your current track" },
  "late-night": { emoji: "◐", sub: "For dark rooms and headphones" },
  trending: { emoji: "↑", sub: "What's moving right now" },
  underground: { emoji: "⬡", sub: "Overlooked and underrated" },
  "based-on": { emoji: "⊕", sub: "Rooted in your listening session" },
};

// ─── Track Card ───────────────────────────────────────────────────

function TrackCard({ track, index = 0 }: { track: Track; index?: number }) {
  const { playTrack, addToQueue, currentTrack, isPlaying } = usePlayback();
  const isActive = currentTrack?.id === track.id;

  return (
    <motion.div
      initial={{ rotateX: -80, opacity: 0, y: -40, transformPerspective: 1200 }}
      whileInView={{ rotateX: 0, opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.8, type: "spring", bounce: 0.35, delay: index * 0.05 }}
      className="group relative w-44 shrink-0 select-none"
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl bg-white/[0.04]"
        style={
          isActive
            ? {
                boxShadow:
                  "0 0 0 1.5px oklch(0.72 0.23 290 / 0.65), 0 8px 28px -8px oklch(0.72 0.23 290 / 0.35)",
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
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (target.src.includes("maxresdefault.jpg")) {
                target.src = target.src.replace("maxresdefault.jpg", "hqdefault.jpg");
              }
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="h-8 w-8 text-white/10" />
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/70 via-transparent to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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

        {/* Playing indicator */}
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

      <div className="mt-3">
        <button className="w-full text-left" onClick={() => playTrack(track)}>
          <div className="truncate text-[13px] font-medium text-white/85 transition-colors group-hover:text-white">
            {track.title}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-white/35">{track.artist}</div>
        </button>
        {/* Micro-Label / Sonic Reasoning */}
        {track.microLabel && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-white/30" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40 mix-blend-screen">
              {track.microLabel}
            </span>
          </div>
        )}
        <div className="mt-1.5">
          <LikeButton track={track} size="sm" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Album Card ───────────────────────────────────────────────────

function AlbumCard({
  album,
  index = 0,
  onClick,
}: {
  album: any;
  index?: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ rotateX: -80, opacity: 0, y: -40, transformPerspective: 1200 }}
      whileInView={{ rotateX: 0, opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.8, type: "spring", bounce: 0.35, delay: index * 0.05 }}
      className="group relative w-48 shrink-0 select-none cursor-pointer"
      style={{ transformStyle: "preserve-3d" }}
      onClick={onClick}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white/[0.04]">
        {album.albumArt ? (
          <img
            src={album.albumArt}
            alt={album.title}
            className="h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (target.src.includes("maxresdefault.jpg")) {
                target.src = target.src.replace("maxresdefault.jpg", "hqdefault.jpg");
              }
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="h-8 w-8 text-white/10" />
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-white/10 p-3 backdrop-blur-md">
              <Play className="ml-1 h-6 w-6 text-white" />
            </div>
            <span className="text-xs font-semibold text-white tracking-widest uppercase">
              View Tracks
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="w-full text-left">
          <div className="truncate text-[14px] font-semibold text-white/90 transition-colors group-hover:text-white">
            {album.title}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-white/40">{album.artist}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="w-44 shrink-0">
          <div
            className="aspect-square w-full animate-pulse rounded-xl bg-white/[0.04]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
          <div
            className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-white/[0.04]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
          <div
            className="mt-2 h-2.5 w-1/2 animate-pulse rounded-full bg-white/[0.04]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Section row ──────────────────────────────────────────────────

function SectionRow({
  section,
  delay = 0,
  onAlbumClick,
}: {
  section: DiscoverySection;
  delay?: number;
  onAlbumClick: (album: any) => void;
}) {
  const meta = SECTION_META[section.id] ?? { emoji: "○", sub: "" };

  return (
    <Reveal delay={delay}>
      <div>
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-white/30">{meta.emoji}</span>
              <h3 className="text-base font-semibold text-white/90">{section.title}</h3>
            </div>
            {meta.sub && <p className="mt-0.5 pl-5 text-[11px] text-white/28">{meta.sub}</p>}
          </div>
        </div>

        {/* Horizontal scroll */}
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-4 pb-2">
            {section.tracks.map((track, i) =>
              section.type === "albums" || section.type === "playlists" ? (
                <AlbumCard
                  key={track.id}
                  album={track}
                  index={i}
                  onClick={() => onAlbumClick(track)}
                />
              ) : (
                <TrackCard key={track.id} track={track as Track} index={i} />
              ),
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// ─── Divider ─────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      className="h-px w-full"
      style={{
        background:
          "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.055) 20%, oklch(1 0 0 / 0.055) 80%, transparent)",
      }}
    />
  );
}

// ─── Guest Mode Gate ──────────────────────────────────────────────

function GuestGate() {
  return (
    <Reveal>
      <div
        className="relative overflow-hidden rounded-3xl border border-white/[0.07] p-8 sm:p-12 text-center"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.09 0.025 265 / 0.9), oklch(0.06 0.020 255 / 0.95))",
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 -z-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, oklch(0.65 0.22 290 / 0.4) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
            <Lock className="h-7 w-7 text-white/60" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">Unlock Your Taste</h3>
          <p className="mb-6 text-sm text-white/40 max-w-xs mx-auto leading-relaxed">
            Log in to get personalised mixes, AI recommendations, and a feed that truly knows you.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-white shadow-xl transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, oklch(0.72 0.23 290), oklch(0.65 0.21 244))",
            }}
          >
            <LogIn className="h-4 w-4" />
            Log in to Loop
          </a>
        </div>
      </div>
    </Reveal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export function RecommendationFeed() {
  const { sections, isLoading, hasLoaded } = useDiscovery();
  const { currentTrack } = usePlayback();
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);

  const aiMixSection = sections.find((s) => s.id === "ai-mix");
  const trendingSection = sections.find((s) => s.id === "chart-0");
  const otherSections = sections.filter((s) => s.id !== "ai-mix" && s.id !== "chart-0");

  return (
    <section id="discover" className="relative px-4 sm:px-6 py-16 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-14 sm:space-y-20">
        {/* Header */}
        <Reveal>
          <div>
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.4em] text-white/22">
              Discover
            </p>
            <h2 className="font-display text-[clamp(1.8rem,5vw,3.2rem)] font-semibold leading-[1.06] tracking-tight text-white">
              {currentTrack
                ? `Deep in ${currentTrack.artist}'s world.`
                : "Tracks you didn't know you needed."}
            </h2>
            <p className="mt-3 text-[13px] text-white/28 font-normal max-w-md">
              {currentTrack
                ? "Tracks that share the same energy, texture, and late-night feel."
                : "From underground selectors to cinematic drops — curated for your state of mind."}
            </p>
          </div>
        </Reveal>

        {/* Guest mode — show login gate instead of personalised AI mix */}
        {!authLoading && !isLoggedIn && <GuestGate />}

        {/* Logged-in personalised sections */}
        {!authLoading && isLoggedIn && aiMixSection && <AIHeroMix section={aiMixSection as any} />}

        {trendingSection && <TrendingNowHero section={trendingSection as any} />}

        {isLoggedIn && <DailyMix />}

        <Divider />

        {/* Loading state */}
        {isLoading && !hasLoaded && (
          <div className="space-y-16">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="mb-5">
                  <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.04]" />
                  <div className="mt-2 h-3 w-48 animate-pulse rounded-full bg-white/[0.04]" />
                </div>
                <SkeletonRow />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && hasLoaded && sections.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-sm text-white/25">Search for a track to start discovering music</p>
          </div>
        )}

        {/* Sections */}
        <AnimatePresence mode="wait">
          {otherSections.length > 0 && (
            <motion.div
              key={currentTrack?.id ?? "default"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-20"
            >
              {otherSections.map((section, i) => (
                <div key={section.id}>
                  <SectionRow section={section} delay={i * 0.06} onAlbumClick={setSelectedAlbum} />
                  {i < otherSections.length - 1 && (
                    <div className="mt-20">
                      <Divider />
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedAlbum && <AlbumModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}
    </section>
  );
}
