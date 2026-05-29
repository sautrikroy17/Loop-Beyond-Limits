// The Spotify Service handles server-to-server client credential flow
// and retrieves rich metadata for the Loop app.

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || import.meta.env?.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET =
  process.env.SPOTIFY_CLIENT_SECRET || import.meta.env?.VITE_SPOTIFY_CLIENT_SECRET;

let accessToken = "";
let tokenExpiration = 0;

/**
 * Retrieves and caches the Spotify Client Credentials Token.
 */
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiration) return accessToken;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Missing Spotify credentials");
  }

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString(
    "base64",
  );
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error_description);

  accessToken = data.access_token;
  // Expire 1 minute early to be safe
  tokenExpiration = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

/**
 * Perform a generic search across tracks on Spotify.
 */
export async function searchSpotifyTracks(query: string, limit = 20) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  return data.tracks?.items || [];
}

/**
 * Retrieve specific track details.
 */
export async function getTrackDetails(trackId: string) {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/**
 * Fetch track recommendations based on a seed track.
 * Powers the autoplay engine.
 */
export async function getRecommendations(seedTrackId: string, limit = 10) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://api.spotify.com/v1/recommendations?seed_tracks=${seedTrackId}&limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  return data.tracks || [];
}
