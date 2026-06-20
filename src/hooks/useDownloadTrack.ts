import { useState, useEffect } from "react";
import { Track } from "./usePlayback";
import { getOfflineTrack, saveOfflineTrack, removeOfflineTrack } from "@/lib/offlineDB";
import { toast } from "sonner";

export function useDownloadTrack(track: Track) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    getOfflineTrack(track.id).then((t) => setIsDownloaded(!!t));
  }, [track.id]);

  const toggleDownload = async () => {
    if (isDownloaded) {
      await removeOfflineTrack(track.id);
      setIsDownloaded(false);
      toast.info(`Removed ${track.title} from Downloads`);
      return;
    }

    setIsDownloading(true);
    try {
      const ytId = track.youtubeId;
      if (!ytId) {
         throw new Error("Track not found on YouTube");
      }
      
      const res = await fetch(`/api/download?id=${ytId}`);
      if (!res.ok) throw new Error("Download failed");
      
      const blob = await res.blob();
      await saveOfflineTrack(track, blob);
      setIsDownloaded(true);
      toast.success(`Downloaded ${track.title} for offline playback`);
    } catch (e) {
      console.error(e);
      toast.error(`Failed to download ${track.title}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return { isDownloaded, isDownloading, toggleDownload };
}
