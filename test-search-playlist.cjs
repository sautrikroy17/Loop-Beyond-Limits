const INNERTUBE_BASE = 'https://music.youtube.com/youtubei/v1';
const INNERTUBE_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-OJKKU-lia6';
const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20231101.01.00',
    hl: 'en',
    gl: 'US',
  },
};
const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'X-YouTube-Client-Name': '67',
  'X-YouTube-Client-Version': '1.20231101.01.00',
  Origin: 'https://music.youtube.com',
};

function dig(obj, ...path) {
  return path.reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
}

async function findPlaylist(query) {
  const data = await fetch(`${INNERTUBE_BASE}/search?key=${INNERTUBE_KEY}`, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({ 
      context: INNERTUBE_CONTEXT, 
      query,
      params: 'EgWKAQIQAWoKEAoQAxAEEAkQBQ==' // Playlists filter
    }),
  }).then(r => r.json());
  
  const tabs = dig(data, 'contents', 'tabbedSearchResultsRenderer', 'tabs') ?? [];
  const sectionList = dig(tabs, 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents') ?? [];
  
  for (const section of sectionList) {
    const items = dig(section, 'musicShelfRenderer', 'contents') ?? [];
    for (const item of items) {
       const r = item.musicResponsiveListItemRenderer;
       const title = r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
       const browseId = r?.navigationEndpoint?.browseEndpoint?.browseId;
       if (browseId && !browseId.startsWith('UC')) return browseId; // Ignore artist profiles
    }
  }
  return null;
}

async function run() {
  const q = ['Bollywood Hits', 'Punjabi Hits', 'Viral Hits', 'Top 50 Global', 'R&B Essentials', 'EDM Hits'];
  for (const query of q) {
     const id = await findPlaylist(query);
     console.log(query, '->', id);
  }
}
run();
