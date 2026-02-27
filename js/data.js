const YT_BASE      = 'https://www.googleapis.com/youtube/v3';
const YT_ANALYTICS = 'https://youtubeanalytics.googleapis.com/v2';

// ─────────────────────────────────────────
//  HELPER FETCH
// ─────────────────────────────────────────
async function ytFetch(endpoint, token) {
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `HTTP ${res.status}: Gagal mengambil data.`
    );
  }
  return res.json();
}

// ─────────────────────────────────────────
//  CHANNEL DATA
// ─────────────────────────────────────────
/**
 * @param {string} token
 * @returns {Promise<{ id, title, customUrl, subscriberCount, videoCount, thumbnail, uploadsPlaylistId }>}
 */
export async function fetchChannelInfo(token) {
  const url =
    `${YT_BASE}/channels` +
    `?part=snippet,statistics,contentDetails` +
    `&mine=true`;

  const data = await ytFetch(url, token);

  if (!data.items || data.items.length === 0) {
    throw new Error('Channel tidak ditemukan. Pastikan akun Google kamu memiliki channel YouTube.');
  }

  const ch = data.items[0];
  return {
    id:                ch.id,
    title:             ch.snippet.title,
    customUrl:         ch.snippet.customUrl || '',
    subscriberCount:   parseInt(ch.statistics.subscriberCount || '0', 10),
    videoCount:        parseInt(ch.statistics.videoCount      || '0', 10),
    thumbnail:         ch.snippet.thumbnails?.default?.url    || '',
    uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
  };
}

// ─────────────────────────────────────────
//  VIDEO IDs (dari Uploads Playlist)
// ─────────────────────────────────────────
/**
 * @param {string} token
 * @param {string} uploadsPlaylistId
 * @param {number} maxVideos - default 50
 * @returns {Promise<string[]>}
 */
export async function fetchVideoIds(token, uploadsPlaylistId, maxVideos = 50) {
  const videoIds = [];
  let pageToken  = '';
  const perPage  = Math.min(maxVideos, 50);

  do {
    const url =
      `${YT_BASE}/playlistItems` +
      `?part=contentDetails` +
      `&playlistId=${uploadsPlaylistId}` +
      `&maxResults=${perPage}` +
      (pageToken ? `&pageToken=${pageToken}` : '');

    const data = await ytFetch(url, token);
    if (!data.items) break;

    data.items.forEach(item => {
      const id = item.contentDetails?.videoId;
      if (id) videoIds.push(id);
    });

    pageToken = data.nextPageToken || '';
  } while (pageToken && videoIds.length < maxVideos);

  return videoIds.slice(0, maxVideos);
}

// ─────────────────────────────────────────
//  VIDEO STATISTICS (YouTube Data API v3)
// ─────────────────────────────────────────
async function _fetchVideoStatsBatch(token, videoIds) {
  const url =
    `${YT_BASE}/videos` +
    `?part=snippet,statistics,contentDetails` +
    `&id=${videoIds.join(',')}`;

  const data = await ytFetch(url, token);
  return data.items || [];
}

// ─────────────────────────────────────────
//  ANALYTICS DATA (YouTube Analytics API)
// ─────────────────────────────────────────
/**
 * @param {string}   token
 * @param {string[]} videoIds
 * @returns {Promise<Map<string, { watchTimeMinutes: number, subscribersGained: number }>>}
 */
async function _fetchAnalyticsBatch(token, videoIds) {
  const result    = new Map();
  const endDate   = new Date().toISOString().split('T')[0];
  const startDate = '2005-01-01';
  const BATCH = 200;

  for (let i = 0; i < videoIds.length; i += BATCH) {
    const batch     = videoIds.slice(i, i + BATCH);
    const filterStr = `video==${batch.join(',')}`;

    const url =
      `${YT_ANALYTICS}/reports` +
      `?ids=channel==MINE` +
      `&dimensions=video` +
      `&metrics=estimatedMinutesWatched,subscribersGained` +
      `&filters=${encodeURIComponent(filterStr)}` +
      `&startDate=${startDate}` +
      `&endDate=${endDate}` +
      `&maxResults=${BATCH}`;

    try {
      const data = await ytFetch(url, token);

      if (data.rows) {
        data.rows.forEach(([videoId, watchTime, subsGained]) => {
          result.set(videoId, {
            watchTimeMinutes:  Math.round(watchTime   || 0),
            subscribersGained: Math.round(subsGained  || 0),
          });
        });
      }
    } catch (err) {
      console.warn(`Analytics batch gagal (i=${i}):`, err.message);
    }
  }

  return result;
}

// ─────────────────────────────────────────
//  FETCH ALL + MERGE
// ─────────────────────────────────────────
/**
 * @param {string}   token
 * @param {string[]} videoIds
 * @returns {Promise<VideoData[]>}
 */
export async function fetchVideosData(token, videoIds) {
  const allItems = [];
  const BATCH_SIZE = 50;

  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE);
    const items = await _fetchVideoStatsBatch(token, batch);
    allItems.push(...items);
  }

  const analyticsMap = await _fetchAnalyticsBatch(token, videoIds);

  return allItems.map(item => {
    const base      = _cleanVideoData(item);
    const analytics = analyticsMap.get(item.id);

    if (analytics) {
      base.watchTimeMinutes  = analytics.watchTimeMinutes;
      base.subscribersGained = analytics.subscribersGained;
    }

    return base;
  });
}

// ─────────────────────────────────────────
//  DATA CLEANING
// ─────────────────────────────────────────
/**
 * @typedef {object} VideoData
 * @property {string}  id
 * @property {string}  title
 * @property {string}  thumbnail
 * @property {string}  publishedAt
 * @property {number}  views              C1
 * @property {number}  likes              C2
 * @property {number}  comments           C3
 * @property {number}  watchTimeMinutes   C4
 * @property {number}  subscribersGained  C5
 * @property {number}  engagementRate     C6
 */
function _cleanVideoData(item) {
  const stats   = item.statistics     || {};
  const snippet = item.snippet        || {};
  const content = item.contentDetails || {};

  const views    = _safeInt(stats.viewCount);
  const likes    = _safeInt(stats.likeCount);
  const comments = _safeInt(stats.commentCount);

  const durationSec     = _parseDuration(content.duration || 'PT0S');
  const watchTimeFallback = Math.round((durationSec / 60) * views * 0.4);

  const engagementRate = views > 0
    ? parseFloat(((likes + comments) / views * 100).toFixed(4))
    : 0;

  return {
    id:               item.id,
    title:            _cleanText(snippet.title),
    thumbnail:        snippet.thumbnails?.medium?.url
                   || snippet.thumbnails?.default?.url
                   || '',
    publishedAt:      snippet.publishedAt || '',
    views,
    likes,
    comments,
    watchTimeMinutes:  watchTimeFallback,
    subscribersGained: 0,
    engagementRate,
  };
}

// ─────────────────────────────────────────
//  HELPERS PRIVATE
// ─────────────────────────────────────────
function _safeInt(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function _cleanText(str) {
  return (str || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function _parseDuration(iso8601) {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}