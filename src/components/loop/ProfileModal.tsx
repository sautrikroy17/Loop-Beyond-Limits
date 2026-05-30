/**
 * ProfileModal — Full-screen Library & Profile
 *
 * Library: Full-screen (w-full h-full), slides in from right
 *   - Liked / Recent / Playlists tabs
 *   - Playlist editor: cover art (edit via file picker), editable title,
 *     track list with duration, total runtime, "+ Add Songs" search
 *
 * Profile: Bottom sheet with user info, listening stats, top tracks
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Heart,
  Clock,
  ListMusic,
  Play,
  Trash2,
  Music2,
  User,
  Plus,
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  Search as SearchIcon,
  Check,
  Pencil,
  Loader2,
  Disc,
} from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePlayback, type Track } from "@/hooks/usePlayback";
import { useListeningIntelligence } from "@/hooks/useListeningIntelligence";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/supabase/auth";
import { LikeButton } from "./LikeButton";
import { AlbumModal } from "./AlbumModal";
import { hybridSearchFn } from "@/functions/search";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";

type ProfileTab = "liked" | "recent" | "playlists" | "albums" | "stats";

// ── Helpers ──────────────────────────────────────────────────────

function fmtMs(ms: number | undefined): string {
  if (!ms || isNaN(ms)) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function totalRuntime(tracks: Track[]): string {
  const total = tracks.reduce((acc, t) => acc + (t.durationMs || 0), 0);
  if (!total) return "";
  const m = Math.floor(total / 60000);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${rem}m` : `${m}m`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an image file to a base64 JPEG using the canvas API.
 * @param maxSize - max width/height in px (default 240)
 * @param quality - JPEG quality 0-1 (default 0.80)
 */
function compressImageToBase64(file: File, maxSize = 240, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Empty State ───────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/20">
      {icon}
      <p className="text-[13px]">{text}</p>
    </div>
  );
}

// ── Track Row ────────────────────────────────────────────────────

export function TrackRow({
  track,
  onPlay,
  showDuration = false,
  hideCover = false,
  children,
}: {
  track: Track;
  onPlay: () => void;
  showDuration?: boolean;
  hideCover?: boolean;
  children?: React.ReactNode;
}) {
  const { playlists, addTrackToPlaylist } = useUserProfile();
  const { user } = useAuth();
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showPicker]);

  return (
    <div className="group relative flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.035] transition-colors">
      {children}

      {/* Album art */}
      {!hideCover && (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
          {track.albumArt ? (
            <img src={track.albumArt} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music2 className="m-auto mt-2.5 h-5 w-5 text-white/20" />
          )}
          <button
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Play className="h-4 w-4 fill-white text-white" />
          </button>
        </div>
      )}

      {/* ── 3-column info: [Title] [Artist centered] [Duration] ── */}
      <div className="flex flex-1 min-w-0 items-center gap-2 cursor-pointer" onClick={onPlay}>
        {/* Song title — left */}
        <div className="flex-1 min-w-0 truncate text-[13px] font-medium text-white/90">
          {track.title}
        </div>
        {/* Artist — center */}
        <div className="w-[28%] shrink-0 truncate text-center text-[11px] text-white/45">
          {track.artist}
        </div>
        {/* Duration — right */}
        {showDuration && (
          <div className="w-10 shrink-0 text-right tabular-nums text-[11px] text-white/30">
            {fmtMs(track.durationMs)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="relative" ref={pickerRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPicker((v) => !v);
            }}
            className="p-1.5 rounded-full text-white/20 opacity-0 group-hover:opacity-100 hover:text-white/60 hover:bg-white/[0.06] transition-all"
            title="Add to playlist"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 4 }}
                className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-white/[0.08] shadow-xl overflow-hidden"
                style={{ background: "oklch(0.09 0.025 260)" }}
              >
                <div className="px-2 py-1.5 text-[9px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                  Add to playlist
                </div>
                {playlists.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-white/30 text-center">
                    No playlists yet
                  </div>
                ) : (
                  playlists.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addTrackToPlaylist(p.id, track, user?.id);
                        setShowPicker(false);
                      }}
                      className="flex items-center gap-2 w-full px-2.5 py-2 hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="h-7 w-7 shrink-0 rounded-md overflow-hidden bg-white/[0.05] flex items-center justify-center">
                        {p.coverArt ? (
                          <img src={p.coverArt} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-white/25">♪</span>
                        )}
                      </div>
                      <span className="truncate text-[11px] text-white/75">{p.name}</span>
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <LikeButton track={track} size="sm" />
      </div>
    </div>
  );
}

// ── Sortable Track Row (for playlist editor) ──────────────────────

function SortableTrackRow({
  track,
  id,
  onPlay,
  onRemove,
}: {
  track: Track;
  id: string;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative" as const,
        zIndex: isDragging ? 10 : 1,
      }}
      className="flex items-center gap-1 group/row"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab p-1.5 text-white/10 hover:text-white/40 touch-none active:cursor-grabbing shrink-0"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <TrackRow track={track} onPlay={onPlay} showDuration={true} />
      </div>
      <button
        onClick={onRemove}
        className="p-2 opacity-0 group-hover/row:opacity-100 text-white/20 hover:text-red-400 transition-all shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Add-Songs Search (inside playlist editor) ─────────────────────

function AddSongsPanel({ playlistId, onClose }: { playlistId: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { addTrackToPlaylist, playlists, recentlyPlayed } = useUserProfile();
  const { user: panelUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Live search — history when empty, full catalog when typing
  useEffect(() => {
    if (!query.trim()) {
      setResults(recentlyPlayed.slice(0, 15));
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await hybridSearchFn({ data: query.trim() });
        setResults(res as Track[]);
      } catch {
        // Fallback to history filter
        const q = query.toLowerCase();
        setResults(
          recentlyPlayed
            .filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
            .slice(0, 20),
        );
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, recentlyPlayed]);

  const playlist = playlists.find((p) => p.id === playlistId);
  const addedIds = new Set(playlist?.tracks.map((t) => t.id) ?? []);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: "oklch(0.055 0.022 260)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.05] px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-white/30" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any song, artist..."
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/25 outline-none"
          />
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30 shrink-0" />}
        </div>
      </div>

      {/* Label */}
      <div className="px-6 py-2 text-[10px] uppercase tracking-[0.3em] text-white/25">
        {query ? `Results for "${query}"` : "Recent tracks"}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pb-3" style={{ scrollbarWidth: "none" }}>
        {results.length === 0 && !loading ? (
          <EmptyState
            icon={<Music2 className="h-7 w-7" />}
            text={query ? "No results found" : "No recent tracks"}
          />
        ) : (
          <div className="space-y-0.5">
            {results.map((track) => (
              <div
                key={track.id}
                className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.035] transition-colors"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                  {track.albumArt ? (
                    <img src={track.albumArt} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Music2 className="m-auto mt-2.5 h-5 w-5 text-white/20" />
                  )}
                </div>
                {/* 3-column info */}
                <div className="flex flex-1 min-w-0 items-center gap-2">
                  <div className="flex-1 min-w-0 truncate text-[13px] font-medium text-white/90">
                    {track.title}
                  </div>
                  <div className="w-[28%] shrink-0 truncate text-center text-[11px] text-white/45">
                    {track.artist}
                  </div>
                  <div className="w-10 shrink-0 text-right tabular-nums text-[11px] text-white/30">
                    {fmtMs(track.durationMs)}
                  </div>
                </div>
                <button
                  onClick={() => addTrackToPlaylist(playlistId, track, panelUser?.id)}
                  disabled={addedIds.has(track.id)}
                  className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                    addedIds.has(track.id)
                      ? "bg-white/[0.05] text-[oklch(0.72_0.26_248)] cursor-default"
                      : "border border-white/[0.12] text-white/40 hover:border-[oklch(0.72_0.26_248_/_0.5)] hover:text-[oklch(0.72_0.26_248)] hover:bg-[oklch(0.72_0.26_248_/_0.08)]"
                  }`}
                >
                  {addedIds.has(track.id) ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Create Playlist Modal ────────────────────────────────────────

function CreatePlaylistModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, coverArt?: string) => void;
}) {
  const [name, setName] = useState("");
  const [coverArt, setCoverArt] = useState<string | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    setCoverArt(dataUrl);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), coverArt);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex flex-col"
      style={{ background: "oklch(0.055 0.022 260)" }}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-[17px] font-bold text-white">New Playlist</h2>
        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: name.trim()
              ? "linear-gradient(135deg, oklch(0.72 0.26 248), oklch(0.68 0.24 286))"
              : undefined,
          }}
        >
          Create
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {/* Cover Art */}
        <div>
          <label className="mb-3 block text-[11px] font-medium uppercase tracking-[0.3em] text-white/35">
            Cover Art
          </label>
          <div
            className={`relative flex h-48 w-48 mx-auto cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
              dragOver
                ? "border-[oklch(0.72_0.26_248)] bg-[oklch(0.72_0.26_248_/_0.08)]"
                : "border-white/[0.12] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            {coverArt ? (
              <>
                <img
                  src={coverArt}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white mb-1.5" />
                  <span className="text-xs text-white font-medium">Change Photo</span>
                </div>
              </>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-white/25 mb-2" />
                <span className="text-xs text-white/40 font-medium">Click or drag to upload</span>
                <span className="mt-1 text-[10px] text-white/22">JPG, PNG, WEBP</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {/* Name */}
        <div>
          <label className="mb-3 block text-[11px] font-medium uppercase tracking-[0.3em] text-white/35">
            Playlist Name
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="My Playlist"
            className="w-full rounded-xl border border-white/[0.10] bg-white/[0.05] px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-white/25 outline-none focus:border-[oklch(0.72_0.26_248_/_0.5)] focus:ring-1 focus:ring-[oklch(0.72_0.26_248_/_0.3)] transition-all"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Playlist Editor ──────────────────────────────────────────────

function PlaylistEditor({ playlistId, onBack }: { playlistId: string; onBack: () => void }) {
  const {
    playlists,
    renamePlaylist,
    reorderPlaylist,
    removeTrackFromPlaylist,
    updatePlaylistCover,
  } = useUserProfile();
  const { playTrack } = usePlayback();
  const { user: editorUser } = useAuth();
  const playlist = playlists.find((p) => p.id === playlistId);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(playlist?.name ?? "");
  const [showAddSongs, setShowAddSongs] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!playlist) return null;

  const runtime = totalRuntime(playlist.tracks);

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = playlist!.tracks.findIndex((t) => t.id === active.id);
      const newIndex = playlist!.tracks.findIndex((t) => t.id === over.id);
      reorderPlaylist(playlist!.id, oldIndex, newIndex);
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await readFileAsDataUrl(f);
    updatePlaylistCover(playlist!.id, dataUrl, editorUser?.id);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="relative"
    >
      {/* Add Songs panel overlay */}
      <AnimatePresence>
        {showAddSongs && (
          <AddSongsPanel playlistId={playlistId} onClose={() => setShowAddSongs(false)} />
        )}
      </AnimatePresence>

      {/* Playlist Header — large cover + meta */}
      <div className="flex flex-col items-center pb-6 pt-2 text-center border-b border-white/[0.06] mb-4">
        <button
          onClick={onBack}
          className="self-start flex items-center gap-1.5 mb-4 p-1.5 rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[12px]">Playlists</span>
        </button>

        {/* Large cover art with edit overlay */}
        <div
          className="group relative mb-4 cursor-pointer"
          onClick={() => coverInputRef.current?.click()}
        >
          <div className="h-36 w-36 overflow-hidden rounded-2xl bg-white/[0.05] shadow-xl">
            {playlist.coverArt ? (
              <img src={playlist.coverArt} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ListMusic className="h-12 w-12 text-white/20" />
              </div>
            )}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-6 w-6 text-white mb-1" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
              Edit Cover
            </span>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
        </div>

        {/* Editable title */}
        {isEditingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => {
              if (nameInput.trim() && nameInput !== playlist.name)
                renamePlaylist(playlist.id, nameInput.trim(), editorUser?.id);
              setIsEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="mb-1.5 w-full max-w-xs bg-white/[0.05] rounded-lg px-3 py-2 text-center text-[18px] font-bold text-white outline-none ring-1 ring-[oklch(0.72_0.26_248)]"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="group/name mb-1.5 flex items-center gap-2 text-[18px] font-bold text-white hover:text-white/80 transition-colors"
          >
            {playlist.name}
            <Pencil className="h-3.5 w-3.5 opacity-0 group-hover/name:opacity-60 transition-opacity" />
          </button>
        )}

        <div className="text-[11px] text-white/30">
          {playlist.tracks.length} {playlist.tracks.length === 1 ? "track" : "tracks"}
          {runtime && ` · ${runtime}`}
        </div>

        {/* Add Songs button */}
        <button
          onClick={() => setShowAddSongs(true)}
          className="mt-4 flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-5 py-2 text-[12px] font-medium text-white/55 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Songs
        </button>
      </div>

      {/* Track list */}
      <div className="pb-4">
        {playlist.tracks.length === 0 ? (
          <EmptyState
            icon={<Music2 className="h-8 w-8" />}
            text="Add songs to start your playlist"
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={playlist.tracks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {playlist.tracks.map((track) => (
                  <SortableTrackRow
                    key={track.id}
                    id={track.id}
                    track={track}
                    onPlay={() => playTrack(track)}
                    onRemove={() => removeTrackFromPlaylist(playlist.id, track.id, editorUser?.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </motion.div>
  );
}

function ProfileTab({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { recentlyPlayed, customAvatarUrl, setCustomAvatarUrl } = useUserProfile();
  const { playTrack } = usePlayback();
  const { events, getTopGenres, getTasteIdentity } = useListeningIntelligence();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // ── Top Tracks: ranked by smart AI listening score ──────
  const trackScores = events.reduce(
    (acc, e) => {
      const key = e.trackId;
      let score = 0;
      if (e.completed) score += 3;
      else if (e.listenMs > 30000) score += 1;
      if (e.liked) score += 5;
      if (e.repeated) score += 2;
      if (e.skipped) score -= 1;
      
      acc[key] = (acc[key] || 0) + score;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Build a map of trackId → full Track object from recentlyPlayed
  const trackMap = recentlyPlayed.reduce(
    (acc, t) => {
      if (!acc[t.id]) acc[t.id] = t;
      return acc;
    },
    {} as Record<string, (typeof recentlyPlayed)[0]>,
  );

  const topTracks =
    Object.keys(trackScores).length > 0
      ? Object.entries(trackScores)
          .filter(([, score]) => score > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => trackMap[id])
          .filter(Boolean)
          .slice(0, 5)
      : recentlyPlayed.slice(0, 5);

  // ── Top Artists: ranked by smart AI score, with cover art from their most played track ─
  const artistData: Record<string, { score: number; coverArt?: string; displayName: string }> = {};
  for (const e of events) {
    const key = e.artist.split(/[,&]/)[0].trim().toLowerCase();
    const displayName = e.artist.split(/[,&]/)[0].trim();
    if (!artistData[key]) {
      artistData[key] = { score: 0, displayName };
    }
    
    let score = 0;
    if (e.completed) score += 3;
    else if (e.listenMs > 30000) score += 1;
    if (e.liked) score += 5;
    if (e.repeated) score += 2;
    if (e.skipped) score -= 1;

    artistData[key].score += score;
    // Grab cover art from the matching track in recentlyPlayed
    if (!artistData[key].coverArt) {
      const match = recentlyPlayed.find(
        (t) => t.artist.toLowerCase().startsWith(key) && t.albumArt,
      );
      if (match) artistData[key].coverArt = match.albumArt;
    }
  }

  // If no intelligence events yet, fall back to recentlyPlayed artist counting
  if (Object.keys(artistData).length === 0) {
    for (const t of recentlyPlayed) {
      const key = t.artist.split(/[,&]/)[0].trim().toLowerCase();
      const displayName = t.artist.split(/[,&]/)[0].trim();
      if (!artistData[key]) artistData[key] = { score: 0, displayName, coverArt: t.albumArt };
      artistData[key].score += 1;
    }
  }

  const topArtists = Object.entries(artistData)
    .filter(([, data]) => data.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([, data]) => data);

  const topGenre = getTopGenres(1)[0] || "Unknown";
  const vibe = getTasteIdentity() || "🎵 Balanced";

  // ── Avatar ────────────────────────────────────────────────────────
  // Priority: Supabase-stored custom avatar → Google OAuth avatar
  const avatarSrc = customAvatarUrl || user?.user_metadata?.avatar_url;

  const handleUpdateAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      // Compress image using canvas → max 240×240px JPEG at 80% quality
      const compressed = await compressImageToBase64(file, 240, 0.8);

      // Save to user_profiles table (syncs across all browsers)
      const { upsertUserProfile } = await import("@/lib/supabase/db");
      await upsertUserProfile(user.id, { avatar_url: compressed });

      // Update local state immediately (no page reload needed)
      setCustomAvatarUrl(compressed);
    } catch (err) {
      console.error("[avatar] upload failed:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {/* User card */}
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center">
        <div
          className="relative mb-4 group cursor-pointer"
          onClick={() => user && fileInputRef.current?.click()}
        >
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Profile"
              className="h-20 w-20 rounded-full border border-white/10 object-cover transition-opacity group-hover:opacity-50"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.06] transition-opacity group-hover:opacity-50">
              <User className="h-8 w-8 text-white/30" />
            </div>
          )}
          {user && (
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-full">
              {uploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <>
                  <Camera className="h-5 w-5 text-white mb-0.5" />
                  <span className="text-[9px] font-bold text-white uppercase tracking-wider">
                    Change
                  </span>
                </>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpdateAvatar}
          />
        </div>
        <h3 className="text-xl font-bold text-white">
          {user?.user_metadata?.full_name || "Guest User"}
        </h3>
        <p className="text-sm text-white/40">{user?.email || "Sign in to sync your profile"}</p>
        {user ? (
          <button
            onClick={async () => {
              try {
                await signOut();
              } catch {
                /* ignore */
              } finally {
                window.location.href = "/";
              }
            }}
            className="mt-5 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
          >
            Sign Out
          </button>
        ) : (
          <Link
            to="/login"
            onClick={onClose}
            className="mt-5 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, oklch(0.72 0.26 248), oklch(0.68 0.24 286))",
            }}
          >
            Continue with Google
          </Link>
        )}
      </div>

      {/* Taste */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-3">Music Taste</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-white/40 mb-1">Current Vibe</div>
            <div className="text-[14px] font-medium text-white">{vibe}</div>
          </div>
          <div>
            <div className="text-[11px] text-white/40 mb-1">Top Genre</div>
            <div className="text-[14px] font-medium text-white capitalize">{topGenre}</div>
          </div>
        </div>
      </div>

      {topTracks.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-3">
            Top Tracks
          </div>
          <div className="space-y-1">
            {topTracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                index={i}
                onPlay={() => {
                  playTrack(t);
                  onClose();
                }}
                showDuration={true}
              >
                <span className="w-4 text-center text-[10px] font-bold text-white/30">{i + 1}</span>
              </TrackRow>
            ))}
          </div>
        </div>
      )}

      {topArtists.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-3">
            Top Artists
          </div>
          <div className="space-y-2.5">
            {topArtists.map((artist, i) => (
              <div key={artist.displayName} className="flex items-center gap-3">
                {/* Artist cover art — album art from their most played track */}
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
                  {artist.coverArt ? (
                    <img
                      src={artist.coverArt}
                      alt={artist.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, oklch(0.72 0.26 ${248 + i * 15}), oklch(0.68 0.24 ${286 + i * 10}))`,
                      }}
                    >
                      {artist.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Rank badge */}
                  <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-black/70 text-[8px] font-black text-white">
                    {i + 1}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white/85">
                    {artist.displayName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export function ProfileModal({
  isOpen,
  onClose,
  mode = "library",
}: {
  isOpen: boolean;
  onClose: () => void;
  mode?: "library" | "profile";
}) {
  const [tab, setTab] = useState<ProfileTab>(mode === "profile" ? "stats" : "liked");
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const {
    likedTracks,
    recentlyPlayed,
    playlists,
    savedAlbums,
    deletePlaylist,
    createPlaylist,
    removeAlbum,
  } = useUserProfile();
  const { user } = useAuth();
  const { playTrack } = usePlayback();

  useEffect(() => {
    if (isOpen) {
      setTab(mode === "profile" ? "stats" : "liked");
      setActivePlaylistId(null);
      setShowCreatePlaylist(false);
    }
  }, [isOpen, mode]);

  // likedTracks now comes directly from the store (synced from Supabase)

  const ALL_TABS = [
    {
      id: "liked" as ProfileTab,
      label: "Liked",
      icon: <Heart className="h-3.5 w-3.5" />,
      count: likedTracks.length,
    },
    {
      id: "recent" as ProfileTab,
      label: "Recent",
      icon: <Clock className="h-3.5 w-3.5" />,
      count: Math.min(recentlyPlayed.length, 10),
    },
    {
      id: "playlists" as ProfileTab,
      label: "Playlists",
      icon: <ListMusic className="h-3.5 w-3.5" />,
      count: playlists.length,
    },
    {
      id: "albums" as ProfileTab,
      label: "Albums",
      icon: <Disc className="h-3.5 w-3.5" />,
      count: savedAlbums.length,
    },
    { id: "stats" as ProfileTab, label: "Profile", icon: <User className="h-3.5 w-3.5" /> },
  ];

  const TABS =
    mode === "library"
      ? ALL_TABS.filter((t) => t.id !== "stats")
      : ALL_TABS.filter((t) => t.id === "stats");

  // Library: full-width slide from right. Profile: bottom sheet.
  const panelClass =
    mode === "library"
      ? "h-full w-full border-l border-white/[0.06]" // full-screen
      : "mx-auto mt-auto h-[92vh] w-full max-w-lg rounded-t-3xl border-t border-white/[0.08]";

  const slideVariants =
    mode === "library"
      ? { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
      : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] flex"
          style={{ background: mode === "library" ? "rgba(0,0,0,0.70)" : "rgba(0,0,0,0.65)" }}
          onClick={onClose}
        >
          <motion.div
            {...slideVariants}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className={`relative flex flex-col overflow-hidden shadow-2xl ${panelClass}`}
            style={{ background: "oklch(0.055 0.022 260)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Overlays */}
            <AnimatePresence>
              {showCreatePlaylist && (
                <CreatePlaylistModal
                  onClose={() => setShowCreatePlaylist(false)}
                  onCreate={(name, coverArt) => createPlaylist(name, coverArt, user?.id)}
                />
              )}
            </AnimatePresence>

            {/* Handle for profile bottom sheet */}
            {mode !== "library" && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-white/15" />
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-[17px] font-bold text-white">
                  {mode === "library" ? "Your Library" : "Profile"}
                </h2>
                {mode === "library" && !activePlaylistId && (
                  <p className="text-xs text-white/30 mt-0.5">
                    {likedTracks.length} liked · {playlists.length} playlists
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-white/35 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs (hidden when inside playlist editor) */}
            {!activePlaylistId && (
              <div className="flex border-b border-white/[0.06] px-4">
                {TABS.map(({ id, label, icon, count }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                      tab === id
                        ? "border-[oklch(0.72_0.26_248)] text-white"
                        : "border-transparent text-white/30 hover:text-white/55"
                    }`}
                    style={{ marginBottom: "-1px" }}
                  >
                    {icon}
                    {label}
                    {count !== undefined && count > 0 && (
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
              <AnimatePresence mode="wait">
                {activePlaylistId ? (
                  <PlaylistEditor
                    key="editor"
                    playlistId={activePlaylistId}
                    onBack={() => setActivePlaylistId(null)}
                  />
                ) : (
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Liked */}
                    {tab === "liked" &&
                      (likedTracks.length > 0 ? (
                        <div className="space-y-0.5">
                          {likedTracks.map((t, i) => (
                            <TrackRow
                              key={t.id}
                              track={t}
                              index={i}
                              showDuration={true}
                              onPlay={() => {
                                playTrack(t);
                                onClose();
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={<Heart className="h-8 w-8" />}
                          text="Like songs to save them here"
                        />
                      ))}

                    {/* Recent */}
                    {tab === "recent" &&
                      (recentlyPlayed.length > 0 ? (
                        <div className="space-y-0.5">
                          {recentlyPlayed.slice(0, 10).map((t, i) => (
                            <TrackRow
                              key={t.id}
                              track={t}
                              index={i}
                              showDuration={true}
                              onPlay={() => {
                                playTrack(t);
                                onClose();
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={<Clock className="h-8 w-8" />}
                          text="Your listening history appears here"
                        />
                      ))}

                    {/* Playlists */}
                    {tab === "playlists" && (
                      <div>
                        <button
                          onClick={() => setShowCreatePlaylist(true)}
                          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.10] py-3.5 text-[12px] text-white/30 transition-colors hover:border-white/20 hover:text-white/55"
                        >
                          <Plus className="h-4 w-4" />
                          New Playlist
                        </button>

                        {playlists.length > 0 ? (
                          playlists.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => setActivePlaylistId(p.id)}
                              className="group mb-2 flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
                            >
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.06] flex items-center justify-center">
                                {p.coverArt ? (
                                  <img
                                    src={p.coverArt}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <ListMusic className="h-5 w-5 text-white/30" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-medium text-white/85">
                                  {p.name}
                                </div>
                                <div className="text-[11px] text-white/35">
                                  {p.tracks.length} tracks
                                  {totalRuntime(p.tracks) && ` · ${totalRuntime(p.tracks)}`}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePlaylist(p.id, user?.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 rounded-full p-1.5 text-white/25 hover:bg-red-500/10 hover:text-red-400/60 transition-all"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            icon={<ListMusic className="h-8 w-8" />}
                            text="Create your first playlist"
                          />
                        )}
                      </div>
                    )}

                    {/* Albums */}
                    {tab === "albums" && (
                      <div>
                        {savedAlbums.length > 0 ? (
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {savedAlbums.map((album) => (
                              <div
                                key={album.id}
                                onClick={() => setSelectedAlbum(album)}
                                className="group relative rounded-xl bg-white/[0.04] p-3 hover:bg-white/[0.06] transition-colors cursor-pointer"
                              >
                                <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-white/5">
                                  <img
                                    src={album.albumArt}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                  <button className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                                    <Play className="h-10 w-10 fill-white text-white" />
                                  </button>
                                </div>
                                <div className="truncate text-sm font-semibold text-white/90">
                                  {album.title}
                                </div>
                                <div className="truncate text-xs text-white/45">{album.artist}</div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeAlbum(album.id, user?.id);
                                  }}
                                  className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 rounded-full bg-black/60 p-1.5 text-white hover:bg-red-500/80 transition-all"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            icon={<Disc className="h-8 w-8" />}
                            text="Save albums to view them here"
                          />
                        )}
                      </div>
                    )}

                    {/* Profile */}
                    {tab === "stats" && <ProfileTab onClose={onClose} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
      {selectedAlbum && <AlbumModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}
    </AnimatePresence>
  );
}
