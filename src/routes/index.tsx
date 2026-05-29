import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AudioEngine } from "@/components/loop/player/AudioEngine";
import { AmbientBackground } from "@/components/loop/AmbientBackground";
import { ReactiveBackground } from "@/components/loop/visualizer/ReactiveBackground";
import { TrackCanvas } from "@/components/loop/TrackCanvas";
import { Navbar } from "@/components/loop/Navbar";
import { Hero } from "@/components/loop/Hero";
import { RecommendationFeed } from "@/components/loop/RecommendationFeed";
import { Footer } from "@/components/loop/Footer";
import { PlayerBar } from "@/components/loop/player/PlayerBar";
import { FullPlayer } from "@/components/loop/player/FullPlayer";
import { KaraokeMode } from "@/components/loop/KaraokeMode";
import { SearchModal } from "@/components/loop/SearchModal";
import { SettingsPanel } from "@/components/loop/SettingsPanel";
import { ProfileModal } from "@/components/loop/ProfileModal";
import { usePlayback } from "@/hooks/usePlayback";
import { useAudioEngine } from "@/hooks/useAudioData";
import { initProfileSync } from "@/hooks/useUserProfile";
import { initSettings, useSettings } from "@/hooks/useSettings";
import { initListeningIntelligence } from "@/hooks/useListeningIntelligence";
import { PlaylistQuickAccess } from "@/components/loop/PlaylistQuickAccess";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loop — Beyond Limits" },
      {
        name: "description",
        content:
          "Search and stream any song. Synced lyrics, real playback, and algorithmic discovery.",
      },
    ],
  }),
  component: Index,
});

// One-time app initialization
initProfileSync();
initSettings();
initListeningIntelligence();

function Index() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [karaokeOpen, setKaraokeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const { currentTrack } = usePlayback();

  // Single RAF audio engine — shared by all reactive consumers
  useAudioEngine();

  // Global shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key.toLowerCase() === "k" && !e.metaKey && !e.ctrlKey) setKaraokeOpen((o) => !o);
      if (e.key.toLowerCase() === ",") setSettingsOpen((o) => !o);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const karaokeAutoOpen = useSettings((state) => state.karaokeAutoOpen);
  const sleepTimerTarget = useSettings((state) => state.sleepTimerTarget);
  const setSleepTimer = useSettings((state) => state.setSleepTimer);
  const pause = usePlayback((state) => state.pause);

  // ── Karaoke Auto-Open Engine ──
  useEffect(() => {
    if (karaokeAutoOpen && currentTrack) {
      setKaraokeOpen(true);
    }
  }, [currentTrack?.id, karaokeAutoOpen]);

  // ── Sleep Timer Engine ──
  useEffect(() => {
    if (!sleepTimerTarget) return;

    const interval = setInterval(() => {
      if (Date.now() >= sleepTimerTarget) {
        pause();
        setSleepTimer(null); // Reset timer
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerTarget, pause, setSleepTimer]);

  return (
    <main className="relative min-h-screen text-foreground">
      {/* Headless YouTube audio driver */}
      <AudioEngine />

      {/* Background layers (back to front): CSS orbs → canvas → reactive */}
      <AmbientBackground />
      <TrackCanvas />
      <ReactiveBackground />

      {/* Navigation */}
      <Navbar
        onSearchOpen={() => setSearchOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onProfileOpen={() => setProfileOpen(true)}
        onLibraryOpen={() => setLibraryOpen(true)}
      />

      {/* Top 3 playlists — right side quick access (xl+ screens) */}
      <PlaylistQuickAccess />

      {/* Page content — pb accounts for fixed player bar at bottom */}
      <div className={currentTrack ? "pb-28" : "pb-0"}>
        <Hero onSearchOpen={() => setSearchOpen(true)} />
        <RecommendationFeed />
        <Footer />
      </div>

      {/* ── Player layer ─────────────────────────────────────────── */}
      <PlayerBar onExpand={() => setPlayerOpen(true)} onKaraoke={() => setKaraokeOpen(true)} />
      <FullPlayer isOpen={playerOpen} onClose={() => setPlayerOpen(false)} />

      {/* ── Overlay layer ────────────────────────────────────────── */}
      {/* Karaoke — z-60 (above FullPlayer at z-50) */}
      <KaraokeMode isOpen={karaokeOpen} onClose={() => setKaraokeOpen(false)} />

      {/* Search */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Settings panel — slides in from right, z-55 */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Library modal — slides up from bottom, z-55 */}
      <ProfileModal isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} mode="library" />

      {/* Profile stats modal — slides up from bottom, z-55 */}
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} mode="profile" />
    </main>
  );
}
