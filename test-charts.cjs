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
  
  console.log(JSON.stringify(r.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.map(c => {
    return {
      title: c.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text,
      browseId: c.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
    };
  }), null, 2));
}

getCharts().catch(console.error);
