import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "./Reveal";
import { Waveform } from "./Waveform";
import { SectionShell } from "./SectionShell";
import { useTactileHover } from "@/hooks/useTactileHover";
import { usePlayback } from "@/hooks/usePlayback";
import { GripVertical, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function formatDuration(ms?: number) {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

const lyrics = [
  "I got my peaches out in Georgia",
  "I get my weed from California",
  "I took my chick up to the North, yeah",
  "I get my light right from the source, yeah",
];

// ── Drag-and-drop queue item ───────────────────────────────────────

function SortableQueueItem({ track, index, uniqueId }: { track: any; index: number; uniqueId: string }) {
  const { removeFromQueue } = usePlayback();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uniqueId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2.5 group border-b border-white/[0.05] last:border-0"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-white/20 hover:text-white/55 transition-colors touch-none"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Album art */}
      <div
        className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-white/10 bg-cover bg-center"
        style={{
          backgroundImage: track.albumArt ? `url(${track.albumArt})` : undefined,
          background: !track.albumArt
            ? `linear-gradient(135deg, oklch(0.5 0.2 ${260 + index * 25}), oklch(0.25 0.06 280))`
            : undefined,
        }}
      />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white">{track.title}</div>
        <div className="truncate text-xs text-white/40">{track.artist}</div>
      </div>

      {/* Duration */}
      {track.durationMs ? (
        <span className="text-xs tabular-nums text-white/30 shrink-0">
          {formatDuration(track.durationMs)}
        </span>
      ) : null}

      {/* Remove */}
      <button
        onClick={() => removeFromQueue(index)}
        className="shrink-0 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove from queue"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function PlayerSection() {
  const {
    currentTrack, queue, isPlaying, isAutoplay,
    isShuffle, repeatMode,
    togglePlayPause, nextTrack, prevTrack, toggleShuffle, toggleRepeat,
    reorderQueue,
  } = usePlayback();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Build stable unique IDs for sortable
  const sortableIds = queue.map((t, i) => `${t.id}-${i}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sortableIds.indexOf(String(active.id));
    const newIdx = sortableIds.indexOf(String(over.id));
    if (oldIdx !== -1 && newIdx !== -1) reorderQueue(oldIdx, newIdx);
  }

  return (
    <SectionShell id="player" tone="violet" className="py-32 sm:py-48">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <Reveal>
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              The player
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-[clamp(2rem,5vw,4rem)] font-semibold leading-[1.02]">
              Not an interface. <span className="text-gradient">An atmosphere.</span>
            </h2>
          </Reveal>
        </div>

        <Reveal>
          <div className="glass-strong relative overflow-hidden rounded-[2rem] p-6 shadow-[0_40px_120px_-30px_oklch(0_0_0_/_0.8),0_0_120px_-40px_oklch(0.7_0.22_290_/_0.4)] sm:p-10">
            {/* ambient glow inside player */}
            <div className="pointer-events-none absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full blur-[120px]"
              style={{ background: "oklch(0.55 0.22 290 / 0.4)" }} />

            <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr]">
              {/* album + waveform */}
              <div>
                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="relative mx-auto aspect-square w-full max-w-md"
                >
                  <div
                    className="absolute inset-0 rounded-[2rem] blur-2xl opacity-80"
                    style={{
                      background: "conic-gradient(from 0deg, oklch(0.7 0.22 290), oklch(0.72 0.2 240), oklch(0.82 0.15 200), oklch(0.7 0.22 290))",
                    }}
                  />
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={currentTrack?.id || "empty"}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                      className="absolute inset-0 h-full w-full rounded-[2rem] ring-1 ring-white/15 overflow-hidden"
                      style={{
                        background: currentTrack?.albumArt
                          ? `url(${currentTrack.albumArt}) center/cover`
                          : "radial-gradient(circle at 30% 30%, oklch(0.55 0.22 290), oklch(0.18 0.05 280) 70%)",
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-6 left-6 right-6">
                        <div className="font-display text-xl font-semibold truncate text-white">
                          {currentTrack?.title || "Peaches"}
                        </div>
                        <div className="text-sm text-white/70 truncate">
                          {currentTrack?.artist || "Justin Bieber"}
                        </div>
                      </div>
                      <div className="absolute right-6 top-6 h-3 w-3 rounded-full bg-white/80 shadow-[0_0_18px_white]" />
                    </motion.div>
                  </AnimatePresence>
                </motion.div>

                <div className="mt-8">
                  <Waveform bars={64} height={80} isPlaying={isPlaying} />
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <Ctrl onClick={prevTrack}>⏮</Ctrl>
                  <Ctrl onClick={toggleShuffle} active={isShuffle}>🔀</Ctrl>
                  <PlayBtn isPlaying={isPlaying} onClick={togglePlayPause} />
                  <Ctrl onClick={toggleRepeat} active={repeatMode !== 'none'}>
                    {repeatMode === 'one' ? '🔂' : '🔁'}
                  </Ctrl>
                  <Ctrl onClick={nextTrack}>⏭</Ctrl>
                </div>
              </div>

              {/* lyrics + queue */}
              <div className="flex flex-col gap-6">
                <div className="glass rounded-2xl p-6">
                  <div className="mb-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Live lyrics
                  </div>
                  <div className="space-y-3">
                    {lyrics.map((l, i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: i === 1 ? 1 : 0.35, x: i === 1 ? 6 : 0 }}
                        transition={{ duration: 0.8 }}
                        className={`font-display text-lg ${i === 1 ? "text-foreground" : "text-muted-foreground"}`}
                        style={i === 1 ? { textShadow: "0 0 24px oklch(0.7 0.22 290 / 0.6)" } : undefined}
                      >
                        {l}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Queue with drag & drop */}
                <div className="glass rounded-2xl p-6">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    <span>Up next</span>
                    <div className="flex items-center gap-1.5">
                      {queue.length > 0 && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
                          {queue.length}
                        </span>
                      )}
                      <span>Queue</span>
                    </div>
                  </div>

                  {queue.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="text-sm text-muted-foreground">Queue is empty.</div>
                      <div className="mt-1 text-[11px] text-white/25">
                        {isAutoplay
                          ? "Autoplay will pick the next song."
                          : "Autoplay is off — music stops here."}
                      </div>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                        <div className="max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                          {queue.slice(0, 20).map((track, i) => (
                            <SortableQueueItem
                              key={sortableIds[i]}
                              track={track}
                              index={i}
                              uniqueId={sortableIds[i]}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

function Ctrl({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  const tactile = useTactileHover({ maxTilt: 8, spotlightStrength: 0.28, stiffness: 260, damping: 20 });
  return (
    <motion.button
      onClick={onClick}
      {...tactile.bind}
      style={{ ...tactile.transformStyle, rotateX: tactile.rx, rotateY: tactile.ry }}
      whileHover={{ scale: 1.12, y: -3 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`glass flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-xs relative overflow-hidden transition-colors ${active ? 'text-white bg-white/10' : 'text-foreground/80'}`}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full"
        style={{ background: tactile.spotlightBg, opacity: tactile.spotlightOpacity }}
      />
      {children}
    </motion.button>
  );
}

function PlayBtn({ isPlaying, onClick }: { isPlaying?: boolean; onClick?: () => void }) {
  const tactile = useTactileHover({ maxTilt: 9, spotlightStrength: 0.34, stiffness: 260, damping: 20 });
  return (
    <motion.button
      onClick={onClick}
      {...tactile.bind}
      style={{
        ...tactile.transformStyle, rotateX: tactile.rx, rotateY: tactile.ry,
        background: "linear-gradient(135deg, oklch(0.78 0.22 290), oklch(0.72 0.2 240))",
        boxShadow: "0 0 60px -5px oklch(0.7 0.22 290 / 0.85)",
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.94 }}
      className="relative flex h-16 w-16 items-center justify-center rounded-full"
      transition={{ type: "spring", stiffness: 270, damping: 20 }}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full"
        style={{ background: tactile.spotlightBg, opacity: tactile.spotlightOpacity }}
      />
      <span className={isPlaying ? "text-xl text-primary-foreground" : "ml-1 text-xl text-primary-foreground"}>
        {isPlaying ? '⏸' : '▶'}
      </span>
    </motion.button>
  );
}