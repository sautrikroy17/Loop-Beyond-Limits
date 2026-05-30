import { motion, useScroll, useTransform } from "framer-motion";
import { Search, Settings, User, Library, LogIn, Home } from "lucide-react";
import { useListeningIntelligence } from "@/hooks/useListeningIntelligence";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { LoopLogo } from "./LoopLogo";
import { signInWithGoogle } from "@/lib/supabase/auth";

const GENRE_ICONS: Record<string, string> = {
  "Dark R&B": "🖤",
  "Atmospheric Trap": "🌌",
  "Sad Girl Pop": "💧",
  Shoegaze: "🎸",
  "Bollywood Romance": "🌊",
  "Punjabi Heat": "🌶️",
  "Desi Trap": "🔥",
  "Lo-Fi Study": "☕",
  Phonk: "🚗",
  Hyperpop: "⚡",
  Pop: "✨",
  "Hip-Hop": "🎤",
  House: "🪩",
};

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase(),
  );
}

interface NavbarProps {
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
  onProfileOpen: () => void;
  onLibraryOpen: () => void;
}

export function Navbar({
  onSearchOpen,
  onSettingsOpen,
  onProfileOpen,
  onLibraryOpen,
}: NavbarProps) {
  const { scrollY } = useScroll();

  const pillBg = useTransform(
    scrollY,
    [0, 60],
    ["oklch(0.07 0.028 260 / 0.30)", "oklch(0.07 0.028 260 / 0.88)"],
  );
  const pillBorder = useTransform(scrollY, [0, 60], ["oklch(1 0 0 / 0.05)", "oklch(1 0 0 / 0.10)"]);
  const pillBlur = useTransform(
    scrollY,
    [0, 60],
    ["blur(12px) saturate(140%)", "blur(24px) saturate(180%)"],
  );

  const intel = useListeningIntelligence();
  const identity = intel.getTasteIdentity();
  
  // Assign icons based on the identity string
  let vibeIcon = "🎵";
  if (identity.includes("Bollywood") || identity.includes("Desi")) vibeIcon = "🌊";
  else if (identity.includes("Punjabi")) vibeIcon = "🌶️";
  else if (identity.includes("Dark R&B") || identity.includes("Addict")) vibeIcon = "🖤";
  else if (identity.includes("Sad Girl")) vibeIcon = "💧";
  else if (identity.includes("Trap") || identity.includes("Drill")) vibeIcon = "🔥";
  else if (identity.includes("Dark Pop")) vibeIcon = "🦇";
  else if (identity.includes("Midnight") || identity.includes("Dreamer")) vibeIcon = "🌌";
  else if (identity.includes("K-Pop") || identity.includes("Viral")) vibeIcon = "✨";
  
  const moodBadge = identity !== "New Explorer" ? `${vibeIcon} ${identity}` : "";
  const hasData = intel.events.length > 0;
  const { user } = useAuth();
  const { customAvatarUrl } = useUserProfile();

  return (
    <>
      {/* ── Desktop Top Navbar & Mobile Top Header ── */}
      <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
        <motion.nav
          style={{
            background: pillBg,
            borderColor: pillBorder,
            backdropFilter: pillBlur,
            WebkitBackdropFilter: pillBlur as unknown as string,
          }}
          className="flex w-full max-w-5xl items-center justify-between rounded-2xl border px-4 py-2.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]"
        >
          {/* Logo */}
          <a href="#top" className="flex items-center gap-0 shrink-0">
            <LoopLogo size={28} showText={true} textSize="text-[15px]" />
          </a>

          {/* Center nav — Home · Discover · Mood pill · Library */}
          <div className="hidden items-center gap-0.5 md:flex">
            <NavLink href="#top">Home</NavLink>
            <NavLink href="#discover">Discover</NavLink>

            {/* Vibe badge */}
            {hasData && moodBadge && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className="ml-1 rounded-full px-3 py-1 text-[11px] font-medium"
                style={{
                  background: "oklch(0.72 0.26 248 / 0.10)",
                  color: "oklch(0.82 0.20 248)",
                  border: "1px solid oklch(0.72 0.26 248 / 0.20)",
                }}
              >
                {moodBadge}
              </motion.span>
            )}

            {/* Library — right beside the mood pill in center nav */}
            <button
              onClick={onLibraryOpen}
              className="ml-1 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-white/45 transition-all hover:bg-white/[0.06] hover:text-white/80 border border-transparent hover:border-white/[0.08]"
              title="Your Library"
            >
              <Library className="h-3.5 w-3.5" />
              <span>Library</span>
            </button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Enlarged search bar (Desktop Only) */}
            <button
              onClick={onSearchOpen}
              id="navbar-search-btn"
              className="hidden md:flex items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.05] px-4 py-2 text-white/45 transition-all hover:bg-white/[0.10] hover:text-white/75 hover:border-white/[0.14] min-w-[200px]"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left text-[12px]">Search anything...</span>
              <kbd className="hidden rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/30 sm:inline-block shrink-0">
                ⌘K
              </kbd>
            </button>

            {/* Guest: Login / Logged in: Profile (Desktop Only) */}
            <div className="hidden md:block">
              {!user ? (
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    borderColor: "oklch(0.72 0.26 248 / 0.35)",
                    background:
                      "linear-gradient(135deg, oklch(0.72 0.26 248 / 0.15), oklch(0.68 0.24 286 / 0.15))",
                    color: "oklch(0.85 0.20 248)",
                  }}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Login
                </button>
              ) : (
                <button
                  onClick={onProfileOpen}
                  className="relative flex h-8 w-8 items-center justify-center rounded-xl border transition-all hover:text-white/80 overflow-hidden"
                  style={{
                    borderColor: hasData ? "oklch(0.72 0.26 248 / 0.35)" : "oklch(1 0 0 / 0.08)",
                    background: hasData ? "oklch(0.72 0.26 248 / 0.10)" : "oklch(1 0 0 / 0.04)",
                    color: hasData ? "oklch(0.82 0.22 248)" : "oklch(1 0 0 / 0.45)",
                  }}
                  title="Profile & Stats"
                >
                  {customAvatarUrl || user?.user_metadata?.avatar_url ? (
                    <img
                      src={customAvatarUrl || user.user_metadata?.avatar_url}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Settings (Visible on Mobile & Desktop) */}
            <button
              onClick={onSettingsOpen}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/45 transition-all hover:bg-white/[0.09] hover:text-white/80"
              title="Settings (,)"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.nav>
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden border-t border-white/[0.05] bg-[oklch(0.07_0.024_260)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl">
        <div className="flex items-center justify-around px-2 py-3">
          <a
            href="#top"
            className="flex flex-col items-center gap-1 text-white/40 hover:text-white active:text-white transition-colors"
          >
            <Home className="h-[22px] w-[22px]" />
            <span className="text-[10px] font-medium">Home</span>
          </a>

          <button
            onClick={onSearchOpen}
            className="flex flex-col items-center gap-1 text-white/40 hover:text-white active:text-white transition-colors"
          >
            <Search className="h-[22px] w-[22px]" />
            <span className="text-[10px] font-medium">Search</span>
          </button>

          <button
            onClick={onLibraryOpen}
            className="flex flex-col items-center gap-1 text-white/40 hover:text-white active:text-white transition-colors"
          >
            <Library className="h-[22px] w-[22px]" />
            <span className="text-[10px] font-medium">Library</span>
          </button>

          {!user ? (
            <button
              onClick={signInWithGoogle}
              className="flex flex-col items-center gap-1 text-white/40 hover:text-white active:text-white transition-colors"
            >
              <LogIn className="h-[22px] w-[22px]" />
              <span className="text-[10px] font-medium">Log In</span>
            </button>
          ) : (
            <button
              onClick={onProfileOpen}
              className="flex flex-col items-center gap-1 text-white/40 hover:text-white active:text-white transition-colors"
            >
              {customAvatarUrl || user.user_metadata?.avatar_url ? (
                <img
                  src={customAvatarUrl || user.user_metadata?.avatar_url}
                  className="h-[22px] w-[22px] rounded-full object-cover border border-white/20"
                  alt="Profile"
                />
              ) : (
                <User className="h-[22px] w-[22px]" />
              )}
              <span className="text-[10px] font-medium">Profile</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-lg px-3 py-1.5 text-sm text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white"
    >
      {children}
    </a>
  );
}
