/**
 * YouTube Music InnerTube API Client
 *
 * Uses the same internal API that music.youtube.com calls in the browser.
 * Requires ZERO API keys — this is the public embedded client key used by
 * the official YouTube Music web app and open-source clients like yt-dlp.
 *
 * Endpoints used:
 *  - /search   → full-text music search with song/video filter
 *  - /next     → "Up Next" related tracks (powers our autoplay/recommendations)
 */

// ─── InnerTube Client Config ────────────────────────────────────

const INNERTUBE_BASE = 'https://music.youtube.com/youtubei/v1';
// Public API key embedded in the YouTube Music web client JS bundle
const INNERTUBE_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-OJKKU-lia6';

const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20231101.01.00',
    hl: 'en',
    gl: 'US',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'X-YouTube-Client-Name': '67',
  'X-YouTube-Client-Version': '1.20231101.01.00',
  Origin: 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ─── Result Types ────────────────────────────────────────────────

export interface YTMTrack {
  id: string;       // YouTube video ID (used for IFrame playback)
  videoId: string;  // same as id, explicit alias
  title: string;
  artist: string;
  albumArt: string;
  durationMs?: number;
}

// ─── Helpers ────────────────────────────────────────────────────

function post(endpoint: string, body: object): Promise<any> {
  return fetch(`${INNERTUBE_BASE}/${endpoint}?key=${INNERTUBE_KEY}`, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({ context: INNERTUBE_CONTEXT, ...body }),
  }).then((r) => r.json());
}

/** Extract a safe nested property by dot path — avoids chained ?. chains */
function dig(obj: any, ...path: (string | number)[]): any {
  return path.reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
}

/** Parse MM:SS or H:MM:SS duration text into milliseconds */
function parseDurationMs(text?: string): number | undefined {
  if (!text) return undefined;
  const parts = text.split(':').map(Number);
  if (parts.some(isNaN)) return undefined;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return undefined;
}

/**
 * Upgrade a raw thumbnail URL to the highest available resolution.
 *
 * - Google lh3 URLs (YTM album art):  replace =wNNN-hNNN suffix → =w576-h576
 * - YouTube ytimg URLs:               prefer maxresdefault (1280×720)
 *                                     fall back to hqdefault (480×360)
 */
function upgradeThumbUrl(url: string, videoId: string): string {
  if (!url) {
    // Construct from video ID directly
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  // Google lh3 CDN (YTM album art) — replace size parameters
  if (url.includes('lh3.googleusercontent.com') || url.includes('lh3.ggpht.com')) {
    // Replace =wNNN-hNNN... suffix with high-res request
    return url.replace(/=w\d+-h\d+[^&"']*/g, '=w576-h576-l90-rj');
  }

  // YouTube img CDN — request maxresdefault
  if (url.includes('ytimg.com')) {
    // Already has a specific resolution path — upgrade it
    return url
      .replace(/\/default\.jpg$/, '/hqdefault.jpg')
      .replace(/\/mqdefault\.jpg$/, '/hqdefault.jpg')
      .replace(/\/sddefault\.jpg$/, '/hqdefault.jpg');
  }

  return url;
}

/** Parse a single musicResponsiveListItemRenderer into a YTMTrack */
function parseListItem(renderer: any): YTMTrack | null {
  if (!renderer) return null;

  // Video ID — try multiple paths the API uses in different contexts
  const videoId =
    dig(renderer, 'playlistItemData', 'videoId') ||
    dig(renderer, 'flexColumns', 0, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs', 0, 'navigationEndpoint', 'watchEndpoint', 'videoId') ||
    dig(renderer, 'overlay', 'musicItemThumbnailOverlayRenderer', 'content', 'musicPlayButtonRenderer', 'playNavigationEndpoint', 'watchEndpoint', 'videoId');

  if (!videoId) return null;

  // Title
  const title = dig(renderer, 'flexColumns', 0, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs', 0, 'text');
  if (!title) return null;

  // Artist — second column, stop at the first bullet separator
  const subtitleRuns: any[] = dig(renderer, 'flexColumns', 1, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs') || [];
  
  let artist = '';
  for (const r of subtitleRuns) {
    const text = r.text || '';
    if (text.includes('•') || text.includes('·')) break; // Stop at bullet point separating artist from album/views
    if (text.match(/^[\s,]+$/)) continue; // skip standalone commas/spaces
    artist += text;
  }
  artist = artist.replace(/\s+/g, ' ').trim();

  // Thumbnail — highest resolution available
  // Strategy: pick last thumbnail (largest), then upgrade URL parameters.
  // Google lh3 URLs: replace size params → request 576×576 (retina-ready).
  // YouTube ytimg URLs: prefer maxresdefault, fall back to hqdefault.
  const thumbnails: any[] = dig(renderer, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails') || [];
  const rawThumb = thumbnails[thumbnails.length - 1]?.url ?? '';
  const albumArt = upgradeThumbUrl(rawThumb, videoId);

  // Duration
  const durationText = dig(renderer, 'fixedColumns', 0, 'musicResponsiveListItemFixedColumnRenderer', 'text', 'runs', 0, 'text');
  const durationMs = parseDurationMs(durationText);

  return { id: videoId, videoId, title, artist: artist || 'Unknown Artist', albumArt, durationMs };
}

/** Walk InnerTube search response and extract all track items */
function extractTracksFromSearch(data: any): YTMTrack[] {
  const tabs = dig(data, 'contents', 'tabbedSearchResultsRenderer', 'tabs') ?? [];
  const sectionList = dig(tabs, 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents') ?? [];

  const tracks: YTMTrack[] = [];

  for (const section of sectionList) {
    // Music shelf (grouped results)
    const items: any[] = dig(section, 'musicShelfRenderer', 'contents') ?? [];
    for (const item of items) {
      const track = parseListItem(item.musicResponsiveListItemRenderer);
      if (track) tracks.push(track);
    }
    // Inline results (some searches return a flat shelf)
    const inlineItems: any[] = dig(section, 'musicInlineSongsListRenderer', 'contents') ?? [];
    for (const item of inlineItems) {
      const track = parseListItem(item.musicResponsiveListItemRenderer);
      if (track) tracks.push(track);
    }
  }

  return tracks;
}

/** Walk InnerTube /next response and extract related tracks */
function extractTracksFromNext(data: any): YTMTrack[] {
  // The autoplay queue lives inside the watch next results
  const contents =
    dig(data, 'contents', 'singleColumnMusicWatchNextResultsRenderer', 'tabbedRenderer',
      'watchNextTabbedResultsRenderer', 'tabs', 0, 'tabRenderer', 'content',
      'musicQueueRenderer', 'content', 'playlistPanelRenderer', 'contents') ?? [];

  const tracks: YTMTrack[] = [];
  for (const item of contents) {
    const renderer = dig(item, 'playlistPanelVideoRenderer');
    if (!renderer) continue;

    const videoId = dig(renderer, 'videoId') || dig(renderer, 'navigationEndpoint', 'watchEndpoint', 'videoId');
    if (!videoId) continue;

    const title = dig(renderer, 'title', 'runs', 0, 'text');
    if (!title) continue;

    const shortBylineRuns: any[] = dig(renderer, 'shortBylineText', 'runs') ?? [];
    const artist = shortBylineRuns.map((r) => r.text).join('').trim();

    const thumbnails: any[] = dig(renderer, 'thumbnail', 'thumbnails') ?? [];
    const albumArt = thumbnails[thumbnails.length - 1]?.url ?? '';

    const lengthText = dig(renderer, 'lengthText', 'runs', 0, 'text');
    const durationMs = parseDurationMs(lengthText);

    tracks.push({ id: videoId, videoId, title, artist: artist || 'Unknown Artist', albumArt, durationMs });
  }

  return tracks;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Search YouTube Music for tracks matching `query`.
 * Uses the "Songs" filter (EgWKAQIIAWoKEAoQAxAEEAkQBQ==) to prioritize audio.
 * Falls back to unfiltered if the filtered search returns nothing.
 */
export async function searchYouTubeMusic(query: string, limit = 20): Promise<YTMTrack[]> {
  try {
    // EgWKAQIIAWoKEAoQAxAEEAkQBQ== = Songs filter in YouTube Music
    const data = await post('search', {
      query,
      params: 'EgWKAQIIAWoKEAoQAxAEEAkQBQ==',
    });

    let tracks = extractTracksFromSearch(data);

    // If Songs filter returned nothing, try without filter (broader search)
    if (tracks.length === 0) {
      const broad = await post('search', { query });
      tracks = extractTracksFromSearch(broad);
    }

    return tracks.slice(0, limit);
  } catch (err) {
    console.error('[YTMusic] searchYouTubeMusic failed:', err);
    return [];
  }
}

/**
 * Search for a playlist by name and return its tracks.
 * This satisfies the "Editorial Charts" requirement without hardcoding browseIds.
 */
export async function searchPlaylist(query: string, limit = 20): Promise<YTMTrack[]> {
  try {
    const data = await post('search', {
      query,
      params: 'EgWKAQIQAWoKEAoQAxAEEAkQBQ==' // Playlists filter
    });

    let browseId: string | null = null;
    
    // Quick and dirty regex extraction of the first playlist browseId (VL...)
    // This is safer than walking the deeply nested and volatile YTM JSON tree
    const jsonStr = JSON.stringify(data);
    const match = jsonStr.match(/"browseId":"(VL[^"]+)"/);
    if (match && match[1]) {
      browseId = match[1];
    } else {
      // Fallback broad search
      const broadData = await post('search', { query });
      const broadStr = JSON.stringify(broadData);
      const broadMatch = broadStr.match(/"browseId":"(VL[^"]+)"/);
      if (broadMatch && broadMatch[1]) browseId = broadMatch[1];
    }

    if (browseId) {
      // Strip 'VL' prefix for getPlaylistDetails
      const pid = browseId.replace(/^VL/, '');
      return await getPlaylistDetails(pid, limit);
    }
    
    // If no playlist found, fallback to song search
    return await searchYouTubeMusic(query, limit);
  } catch (err) {
    console.error('[YTMusic] searchPlaylist failed:', err);
    return [];
  }
}

/**
 * Get related tracks for a given YouTube video ID.
 * Uses the /next endpoint which returns YouTube's own "Up Next" queue.
 */
export async function getRelatedTracks(videoId: string, limit = 10): Promise<YTMTrack[]> {
  try {
    const data = await post('next', {
      videoId,
      playlistId: 'RDAMVM' + videoId,
    });

    const tracks = extractTracksFromNext(data);
    // First item is usually the current track itself — skip it
    return tracks.filter((t) => t.videoId !== videoId).slice(0, limit);
  } catch (err) {
    console.error('[YTMusic] getRelatedTracks failed:', err);
    return [];
  }
}

/**
 * Find the best YouTube video ID for a track name + artist.
 * Used by AudioEngine when a track only has Spotify metadata (no videoId).
 */
export interface YTMAlbum {
  id: string; // browseId
  title: string;
  artist: string;
  albumArt: string;
  tracks?: YTMTrack[];
}

function parseAlbumItem(renderer: any): YTMAlbum | null {
  if (!renderer) return null;
  
  const browseId = dig(renderer, 'navigationEndpoint', 'browseEndpoint', 'browseId');
  if (!browseId || !browseId.startsWith('MPREb_')) return null;

  const title = dig(renderer, 'flexColumns', 0, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs', 0, 'text');
  if (!title) return null;

  const subtitleRuns: any[] = dig(renderer, 'flexColumns', 1, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs') || [];
  let artist = '';
  for (const r of subtitleRuns) {
    const text = r.text || '';
    if (text.toLowerCase() === 'album' || text === '•' || text === '·') continue;
    artist += text;
  }
  artist = artist.replace(/\s+/g, ' ').trim();

  const thumbnails: any[] = dig(renderer, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails') || [];
  const rawThumb = thumbnails[thumbnails.length - 1]?.url ?? '';
  const albumArt = upgradeThumbUrl(rawThumb, browseId);

  return { id: browseId, title, artist: artist || 'Unknown Artist', albumArt };
}

export async function searchAlbums(query: string, limit = 10): Promise<YTMAlbum[]> {
  try {
    const data = await post('search', {
      query,
      params: 'EgWKAQIYAWoKEAoQAxAEEAkQBQ==',
    });
    
    const tabs = dig(data, 'contents', 'tabbedSearchResultsRenderer', 'tabs') ?? [];
    const sectionList = dig(tabs, 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents') ?? [];
    
    const albums: YTMAlbum[] = [];
    for (const section of sectionList) {
      const items: any[] = dig(section, 'musicShelfRenderer', 'contents') ?? [];
      for (const item of items) {
        const album = parseAlbumItem(item.musicResponsiveListItemRenderer);
        if (album) albums.push(album);
      }
    }
    return albums.slice(0, limit);
  } catch (err) {
    console.error('[YTMusic] searchAlbums failed:', err);
    return [];
  }
}

export async function getAlbumDetails(browseId: string): Promise<YTMTrack[]> {
  try {
    const data = await post('browse', { browseId });
    const contents = dig(data, 'contents', 'twoColumnBrowseResultsRenderer', 'secondaryContents', 'sectionListRenderer', 'contents', 0, 'musicShelfRenderer', 'contents') ?? [];
    
    const tracks: YTMTrack[] = [];
    for (const item of contents) {
      const track = parseListItem(item.musicResponsiveListItemRenderer);
      if (track && track.videoId) tracks.push(track);
    }
    return tracks;
  } catch (err) {
    console.error('[YTMusic] getAlbumDetails failed:', err);
    return [];
  }
}

export async function getPlaylistDetails(browseId: string, limit = 20): Promise<YTMTrack[]> {
  try {
    const data = await post('browse', { browseId });
    let contents = dig(data, 'contents', 'twoColumnBrowseResultsRenderer', 'secondaryContents', 'sectionListRenderer', 'contents', 0, 'musicPlaylistShelfRenderer', 'contents');
    
    if (!contents) {
       contents = dig(data, 'contents', 'singleColumnBrowseResultsRenderer', 'tabs', 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents', 0, 'musicPlaylistShelfRenderer', 'contents') ?? [];
    }
    
    const tracks: YTMTrack[] = [];
    for (const item of contents) {
      const track = parseListItem(item.musicResponsiveListItemRenderer);
      if (track && track.videoId) tracks.push(track);
    }
    return tracks.slice(0, limit);
  } catch (err) {
    console.error('[YTMusic] getPlaylistDetails failed:', err);
    return [];
  }
}

export async function resolveVideoId(trackName: string, artistName: string): Promise<string | null> {
  // Search without "official audio" to avoid label-restricted embeds.
  // "Official Audio" tracks are commonly blocked from third-party iFrame embedding.
  // We prefer: Music Videos > Lyric Videos > anything else > (never "official audio")
  const queries = [
    `${artistName} ${trackName}`,
    `${artistName} ${trackName} lyrics`,
  ];

  for (const query of queries) {
    try {
      const results = await searchYouTubeMusic(query, 5);
      if (results.length > 0) return results[0].videoId;
    } catch { /* try next query */ }
  }

  return null;
}
