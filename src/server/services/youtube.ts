// The YouTube Service resolves audio playback IDs for headless player usage.

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || import.meta.env?.VITE_YOUTUBE_API_KEY;

/**
 * Resolves a highly optimized YouTube video ID for a track.
 * Used for background/headless audio playback in the Loop player.
 */
export async function resolveYouTubePlayback(
  trackName: string,
  artistName: string,
  isRemix = false,
) {
  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing YouTube API Key");
  }

  // Construct a query optimized for high-quality audio
  const modifier = isRemix ? "remix" : "official audio";
  const query = `${artistName} ${trackName} ${modifier}`;

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=1&key=${YOUTUBE_API_KEY}`,
  );

  const data = await res.json();
  if (data.items && data.items.length > 0) {
    return data.items[0].id.videoId;
  }

  // Fallback to broader search if category 10 (Music) yields no results
  const fallbackRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`,
  );
  const fallbackData = await fallbackRes.json();
  if (fallbackData.items && fallbackData.items.length > 0) {
    return fallbackData.items[0].id.videoId;
  }

  return null;
}
