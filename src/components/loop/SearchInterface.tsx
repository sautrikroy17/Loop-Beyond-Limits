import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Play } from "lucide-react";
import { usePlayback, type Track } from "@/hooks/usePlayback";
import { hybridSearchFn } from "@/functions/search";

export function SearchInterface() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { playTrack } = usePlayback();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.length > 2) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          const res = await hybridSearchFn({ data: query });
          setResults(res);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [query]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Search universe...</span>
        <kbd className="ml-2 hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center pt-24 sm:pt-32 px-4 bg-background/80 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="glass-strong relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-[0_0_80px_oklch(0.7_0.22_290_/_0.2)]"
            >
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search Justin Bieber, Shawn Mendes, 1D..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {isSearching && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Searching network...
                  </div>
                )}
                {!isSearching && results.length === 0 && query.length > 2 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No signals found.
                  </div>
                )}
                {!isSearching && results.length > 0 && (
                  <div className="space-y-1">
                    {results.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => {
                          playTrack(track);
                          setIsOpen(false);
                        }}
                        className="group flex w-full items-center gap-4 rounded-xl p-2 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/10">
                          {track.albumArt && (
                            <img
                              src={track.albumArt}
                              alt={track.title}
                              className="h-full w-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <Play className="h-5 w-5 fill-white text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{track.title}</div>
                          <div className="truncate text-sm text-muted-foreground">
                            {track.artist}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {!isSearching && query.length <= 2 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Type to discover audio...
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
