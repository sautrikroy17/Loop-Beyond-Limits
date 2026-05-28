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

async function getPlaylist(browseId) {
  const r = await fetch(`${INNERTUBE_BASE}/browse?key=${INNERTUBE_KEY}`, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({ context: INNERTUBE_CONTEXT, browseId }),
  }).then((r) => r.json());
  
  // Try twoColumnBrowseResultsRenderer (playlists/albums)
  let contents = r.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents;
  if (!contents) {
     contents = r.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents;
  }
  
  console.log('Found tracks:', contents?.length || 0);
  if (contents) {
     for (let i=0; i<3; i++) {
        const item = contents[i]?.musicResponsiveListItemRenderer;
        if (item) {
           const title = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
           console.log(' -', title);
        }
     }
  }
}

getPlaylist('VLPL4fGSI1pDJn49TUu37nJoN2QTeYuRwmNv').catch(console.error);
