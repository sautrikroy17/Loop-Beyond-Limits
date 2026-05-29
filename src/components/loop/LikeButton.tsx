import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useListeningIntelligence } from "@/hooks/useListeningIntelligence";
import { useAuth } from "@/hooks/useAuth";
import type { Track } from "@/hooks/usePlayback";

interface Props {
  track: Track;
  size?: "sm" | "md";
  className?: string;
}

export function LikeButton({ track, size = "sm", className = "" }: Props) {
  const { likedTrackIds, likeTrack, unlikeTrack } = useUserProfile();
  const { markLiked } = useListeningIntelligence();
  const { user } = useAuth();
  const liked = likedTrackIds.includes(track.id);
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (liked) {
          unlikeTrack(track.id, user?.id);
        } else {
          likeTrack(track, user?.id);
          markLiked(track.id);
        }
      }}
      className={`relative flex items-center justify-center rounded-full transition-colors ${
        size === "sm" ? "h-8 w-8" : "h-9 w-9"
      } ${liked ? "text-pink-400" : "text-white/30 hover:text-white/70"} ${className}`}
      title={liked ? "Unlike" : "Like"}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={liked ? "liked" : "unliked"}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Heart className={iconSize} style={liked ? { fill: "currentColor" } : {}} />
        </motion.span>
      </AnimatePresence>

      <AnimatePresence>
        {liked && (
          <motion.span
            key="burst"
            initial={{ scale: 0.5, opacity: 0.7 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute inset-0 rounded-full border border-pink-400/50"
          />
        )}
      </AnimatePresence>
    </button>
  );
}
