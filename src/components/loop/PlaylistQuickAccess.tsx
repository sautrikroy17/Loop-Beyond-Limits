/**
 * PlaylistQuickAccess — floating sidebar showing top 3 playlists
 *
 * Positioned on the right side of the viewport (fixed, centered vertically).
 * Each card shows: cover art + name + track count.
 * Clicking a card opens an animated panel with the track list.
 * Only visible on xl+ screens (≥1280px).
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListMusic, Play, X, Music2, ChevronRight } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePlayback, type Track } from "@/hooks/usePlayback";

function fmtMs(ms: number | undefined): string {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ── Expanded track list panel ─────────────────────────────────────

function PlaylistPanel({
  playlist,
  onClose,
}: {
  playlist: { id: string; name: string; coverArt?: string; tracks: Track[] };
  onClose: () => void;
}) {
  const { playTrack } = usePlayback();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", h), 100);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className="absolute right-0 top-0 w-72 overflow-hidden rounded-2xl border border-white/[0.09] shadow-2xl"
      style={{
        background: "oklch(0.07 0.028 260 / 0.97)",
        backdropFilter: "blur(32px) saturate(180%)",
      }}
    >
      {/* Header */}
      <div
        className="relative flex items-end gap-3 p-4 pb-3"
        style={{
          background: playlist.coverArt
            ? `linear-gradient(to bottom, transparent 0%, oklch(0.07 0.028 260 / 0.85) 100%)`
            : undefined,
        }}
      >
        {playlist.coverArt && (
          <div
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage: `url(${playlist.coverArt})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(20px) brightness(0.25)",
            }}
          />
        )}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
          {playlist.coverArt ? (
            <img src={playlist.coverArt} alt="" className="h-full w-full object-cover" />
          ) : (
            <ListMusic className="m-auto mt-4 h-6 w-6 text-white/25" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-white">{playlist.name}</div>
          <div className="text-[11px] text-white/40">{playlist.tracks.length} tracks</div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-white/30 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.06] mx-4" />

      {/* Track list */}
      <div className="max-h-72 overflow-y-auto py-1" style={{ scrollbarWidth: "none" }}>
        {playlist.tracks.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-white/25">No tracks yet</div>
        ) : (
          playlist.tracks.map((track, i) => (
            <motion.button
              key={track.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              onClick={() => {
                playTrack(track);
                onClose();
              }}
              className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                {track.albumArt ? (
                  <img src={track.albumArt} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Music2 className="m-auto mt-2 h-4 w-4 text-white/20" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <Play className="h-3.5 w-3.5 fill-white text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white/90">{track.title}</div>
                <div className="truncate text-[10px] text-white/40">{track.artist}</div>
              </div>
              {track.durationMs && (
                <span className="shrink-0 tabular-nums text-[10px] text-white/28">
                  {fmtMs(track.durationMs)}
                </span>
              )}
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ── Playlist card ─────────────────────────────────────────────────

function PlaylistCard({
  playlist,
  isOpen,
  onClick,
}: {
  playlist: { id: string; name: string; coverArt?: string; tracks: Track[] };
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`relative flex items-center gap-3 w-full rounded-2xl border p-3 text-left transition-all ${
        isOpen
          ? "border-white/[0.14] bg-white/[0.08]"
          : "border-white/[0.07] bg-white/[0.04] hover:border-white/[0.11] hover:bg-white/[0.07]"
      }`}
      style={{ backdropFilter: "blur(16px)" }}
    >
      {/* Cover art */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
        {playlist.coverArt ? (
          <img src={playlist.coverArt} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, oklch(0.72 0.26 ${248 + playlist.name.length * 8}) 0%, oklch(0.68 0.24 ${286 + playlist.name.length * 6}) 100%)`,
            }}
          >
            <ListMusic className="h-5 w-5 text-white/70" />
          </div>
        )}
        {/* Subtle overlay on the cover */}
        {playlist.coverArt && (
          <div
            className="absolute inset-0 rounded-xl opacity-60"
            style={{
              background: `linear-gradient(135deg, oklch(0.72 0.26 248 / 0.15), oklch(0.68 0.24 286 / 0.15))`,
            }}
          />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-white/90">{playlist.name}</div>
        <div className="text-[10px] text-white/35">
          {playlist.tracks.length} {playlist.tracks.length === 1 ? "track" : "tracks"}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight
        className={`h-3.5 w-3.5 shrink-0 transition-transform text-white/25 ${isOpen ? "rotate-180 text-white/50" : ""}`}
      />
    </motion.button>
  );
}

// ── Main export ───────────────────────────────────────────────────

export function PlaylistQuickAccess() {
  const { playlists } = useUserProfile();
  const [openId, setOpenId] = useState<string | null>(null);

  // Show top 3 playlists
  const top3 = playlists.slice(0, 3);

  if (top3.length === 0) return null;

  const openPlaylist = top3.find((p) => p.id === openId);

  return (
    // Fixed, right side of screen, vertically centered
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-30 hidden xl:flex flex-col gap-3 w-56">
      {/* Playlist cards */}
      {top3.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <PlaylistCard
            playlist={p}
            isOpen={openId === p.id}
            onClick={() => setOpenId(openId === p.id ? null : p.id)}
          />

          {/* Expanded panel — positioned to the left of the card */}
          <div className="absolute right-full top-0 mr-3 w-72">
            <AnimatePresence>
              {openId === p.id && openPlaylist && (
                <PlaylistPanel playlist={openPlaylist} onClose={() => setOpenId(null)} />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ))}

      {/* "Your Playlists" label above */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="absolute -top-7 left-0 right-0 text-center text-[9px] uppercase tracking-[0.35em] text-white/22"
      >
        Your Playlists
      </motion.div>
    </div>
  );
}
