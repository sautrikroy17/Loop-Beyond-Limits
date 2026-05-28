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

async function getCharts() {
  const r = await fetch(`${INNERTUBE_BASE}/browse?key=${INNERTUBE_KEY}`, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({ context: INNERTUBE_CONTEXT, browseId: 'FEmusic_charts' }),
  }).then((r) => r.json());
  
  const shelves = r.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  
  for (const s of shelves) {
     const shelf = s.musicCarouselShelfRenderer;
     if (!shelf) continue;
     const title = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text || "NO TITLE";
     console.log('SHELF:', title);
     for (const item of shelf.contents || []) {
        const tr = item.musicTwoRowItemRenderer;
        if (tr) {
          const itemTitle = tr.title?.runs?.[0]?.text;
          const browseId = tr.navigationEndpoint?.browseEndpoint?.browseId;
          console.log('  -', itemTitle, browseId);
        }
     }
  }
}

getCharts().catch(console.error);
