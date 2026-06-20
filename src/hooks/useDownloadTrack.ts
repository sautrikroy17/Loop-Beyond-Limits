import { useState, useEffect } from "react";
import { Track } from "./usePlayback";
import { getOfflineTrack, saveOfflineTrack, removeOfflineTrack } from "@/lib/offlineDB";
import { downloadAudioFn } from "@/functions/download";
import { toast } from "sonner";

export function useDownloadTrack(track: Track) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!track || !track.id) {
      setIsDownloaded(false);
      return;
    }
    getOfflineTrack(track.id).then((t) => setIsDownloaded(!!t)).catch(() => setIsDownloaded(false));
  }, [track?.id]);

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
      
      const base64Data = await downloadAudioFn({ data: { id: ytId } });
      
      // Convert base64 to Blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/mp4" });
      
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
