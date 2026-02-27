// ─────────────────────────────────────────
//  DEFINISI KRITERIA
// ─────────────────────────────────────────
/**
 * @type {Criterion[]}
 * @typedef {object} Criterion
 * @property {string} id
 * @property {string} name
 * @property {string} key
 * @property {string} symbol
 * @property {string} type
 */
export const CRITERIA = [
  { id:'C1', name:'Views',             key:'views',             symbol:'Jangkauan total tayangan',        type:'benefit' },
  { id:'C2', name:'Likes',             key:'likes',             symbol:'Apresiasi penonton',               type:'benefit' },
  { id:'C3', name:'Comments',          key:'comments',          symbol:'Keterlibatan aktif audiens',       type:'benefit' },
  { id:'C4', name:'Watch Time',        key:'watchTimeMinutes',  symbol:'Relevansi konten (menit)',         type:'benefit' },
  { id:'C5', name:'Subscribers Gained',key:'subscribersGained', symbol:'Konversi penonton → subscriber',  type:'benefit' },
  { id:'C6', name:'Engagement Rate',   key:'engagementRate',    symbol:'(Likes+Comments)/Views × 100%',   type:'benefit' },
];

// ─────────────────────────────────────────
//  ROC — RANK ORDER CENTROID
// ─────────────────────────────────────────
/**
 * @param {number} n
 * @returns {number[]}
 * @example
 */
export function calcROCWeights(n) {
  const weights = [];
  for (let i = 1; i <= n; i++) {
    let sum = 0;
    for (let k = i; k <= n; k++) {
      sum += 1 / k;
    }
    weights.push(sum / n);
  }
  return weights;
}

// ─────────────────────────────────────────
//  SAW — NORMALISASI MATRIKS KEPUTUSAN
// ─────────────────────────────────────────
/**
 * @param {VideoData[]} videos
 * @param {Criterion[]} orderedCriteria
 * @returns {NormMatrix}
 * @typedef {object} NormMatrix
 * @property {object[]} rows
 * @property {object}   maxValues
 */
export function buildNormMatrix(videos, orderedCriteria) {
  const maxValues = {};
  orderedCriteria.forEach(c => {
    maxValues[c.id] = Math.max(...videos.map(v => v[c.key] || 0));
  });

  const rows = videos.map(video => {
    const normValues = {};
    orderedCriteria.forEach(c => {
      const raw = video[c.key] || 0;
      const max = maxValues[c.id];
      normValues[c.id] = max > 0 ? parseFloat((raw / max).toFixed(4)) : 0;
    });
    return {
      videoId:    video.id,
      videoTitle: video.title,
      thumbnail:  video.thumbnail,
      rawValues:  orderedCriteria.reduce((acc, c) => {
        acc[c.id] = video[c.key] || 0;
        return acc;
      }, {}),
      normValues,
    };
  });

  return { rows, maxValues };
}

// ─────────────────────────────────────────
//  SAW — PERHITUNGAN SKOR PREFERENSI
// ─────────────────────────────────────────
/**
 * @param {NormMatrix}  normMatrix
 * @param {number[]}    rocWeights
 * @param {Criterion[]} orderedCriteria
 * @returns {RankedVideo[]}
 *
 * @typedef {object} RankedVideo
 * @property {number}  rank
 * @property {string}  videoId
 * @property {string}  videoTitle
 * @property {string}  thumbnail
 * @property {number}  score
 * @property {object}  normValues
 * @property {object}  rawValues
 * @property {object}  contributions
 */
export function calcSAWScores(normMatrix, rocWeights, orderedCriteria) {
  const ranked = normMatrix.rows.map(row => {
    let totalScore    = 0;
    const contributions = {};

    orderedCriteria.forEach((c, idx) => {
      const wj  = rocWeights[idx];
      const rij = row.normValues[c.id];
      const contrib = parseFloat((wj * rij).toFixed(4));
      contributions[c.id] = contrib;
      totalScore += contrib;
    });

    return {
      videoId:       row.videoId,
      videoTitle:    row.videoTitle,
      thumbnail:     row.thumbnail,
      score:         parseFloat(totalScore.toFixed(4)),
      normValues:    row.normValues,
      rawValues:     row.rawValues,
      contributions,
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  ranked.forEach((v, i) => { v.rank = i + 1; });

  return ranked;
}

// ─────────────────────────────────────────
//  MAIN ENTRY: HITUNG SEMUA SEKALIGUS
// ─────────────────────────────════════════
/**
 * @param {VideoData[]}  videos
 * @param {string[]}     priorityOrder
 * @returns {EvaluationResult}
 * @typedef {object} EvaluationResult
 * @property {Criterion[]}   orderedCriteria
 * @property {number[]}      rocWeights
 * @property {object}        weightMap
 * @property {NormMatrix}    normMatrix
 * @property {RankedVideo[]} ranking
 */
export function evaluate(videos, priorityOrder) {
  if (!videos || videos.length === 0) throw new Error('Tidak ada data video.');
  if (!priorityOrder || priorityOrder.length === 0) throw new Error('Urutan prioritas kosong.');

  const orderedCriteria = priorityOrder.map(id => {
    const found = CRITERIA.find(c => c.id === id);
    if (!found) throw new Error(`Kriteria ${id} tidak ditemukan.`);
    return found;
  });

  const rocWeights = calcROCWeights(orderedCriteria.length);

  const weightMap = {};
  orderedCriteria.forEach((c, i) => {
    weightMap[c.id] = parseFloat(rocWeights[i].toFixed(4));
  });

  const normMatrix = buildNormMatrix(videos, orderedCriteria);

  const ranking = calcSAWScores(normMatrix, rocWeights, orderedCriteria);

  return { orderedCriteria, rocWeights, weightMap, normMatrix, ranking };
}

// ─────────────────────────────────────────
//  HELPERS UNTUK UI
// ─────────────────────────────────────────
/**
 * @param {number} n
 * @returns {string}
 */
export function formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('id-ID');
}

/**
 * @param {number} score  0–1
 * @param {number} rank
 * @returns {{ label: string, cls: string }}
 */
export function getPerformanceLabel(score, rank) {
  if (rank === 1)      return { label:'🔥 Terbaik',         cls:'green' };
  if (score >= 0.75)   return { label:'↑ Sangat Baik',      cls:'green' };
  if (score >= 0.5)    return { label:'↑ Baik',             cls:'yellow' };
  if (score >= 0.3)    return { label:'◎ Cukup',            cls:'' };
  return               { label:'↓ Perlu Peningkatan',       cls:'red' };
}

/**
 * @param {VideoData[]} videos
 * @param {object} channelInfo
 * @returns {object}
 */
export function calcChannelSummary(videos, channelInfo) {
  const totalViews     = videos.reduce((s, v) => s + v.views, 0);
  const totalWatchTime = videos.reduce((s, v) => s + v.watchTimeMinutes, 0);
  const avgER          = videos.length > 0
    ? videos.reduce((s, v) => s + v.engagementRate, 0) / videos.length
    : 0;

  return {
    totalViews,
    totalWatchTime,
    subscriberCount: channelInfo.subscriberCount,
    avgEngagementRate: parseFloat(avgER.toFixed(2)),
    videoCount: videos.length,
  };
}