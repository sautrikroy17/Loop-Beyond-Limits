const INNERTUBE_BASE = 'https://music.youtube.com/youtubei/v1';
const INNERTUBE_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-OJKKU-lia6';
const INNERTUBE_CONTEXT = { client: { clientName: 'WEB_REMIX', clientVersion: '1.20231101.01.00' } };
const BASE_HEADERS = { 'Content-Type': 'application/json' };

async function post(endpoint, body) {
  const r = await fetch(`${INNERTUBE_BASE}/${endpoint}?key=${INNERTUBE_KEY}`, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({ context: INNERTUBE_CONTEXT, ...body }),
  });
  return r.json();
}

function dig(obj, ...path) {
  return path.reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
}

async function test() {
  const data = await post('search', { query: 'Weeknd albums', params: 'EgWKAQIYAWoKEAoQAxAEEAkQBQ==' });
  
  const tabs = dig(data, 'contents', 'tabbedSearchResultsRenderer', 'tabs') ?? [];
  const sectionList = dig(tabs, 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents') ?? [];
  
  for (const section of sectionList) {
    const items = dig(section, 'musicShelfRenderer', 'contents') ?? [];
    if (items.length > 0) {
      const item = items[0].musicResponsiveListItemRenderer;
      const browseId = dig(item, 'navigationEndpoint', 'browseEndpoint', 'browseId');
      const title = dig(item, 'flexColumns', 0, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs', 0, 'text');
      console.log('Found Album:', { browseId, title });
      
      if (browseId) {
        const albumData = await post('browse', { browseId });
        const contents = dig(albumData, 'contents', 'twoColumnBrowseResultsRenderer', 'secondaryContents', 'sectionListRenderer', 'contents', 0, 'musicShelfRenderer', 'contents') ?? [];
        console.log('Tracks in Album:', contents.length);
        if (contents.length > 0) {
          const track = contents[0].musicResponsiveListItemRenderer;
          console.log('First track videoId:', dig(track, 'playlistItemData', 'videoId'));
        }
      }
      break;
    }
  }
}
test().catch(console.error);
