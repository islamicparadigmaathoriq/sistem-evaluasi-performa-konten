import { CRITERIA, formatNum, getPerformanceLabel } from './logic.js';

// ─────────────────────────────────────────
//  NAVIGASI
// ─────────────────────────────────────────
export function showLoginPage() {
  document.getElementById('page-login').classList.add('active');
  document.getElementById('app-layout').classList.add('hidden');
}

export function showAppLayout() {
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('app-layout').classList.remove('hidden');
  navigateTo('page-dashboard');
}

export function navigateTo(pageId) {
  document.querySelectorAll('.inner-page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────
//  LOADING
// ─────────────────────────────────────────
export function showLoading(msg = 'Memuat…') {
  const overlay = document.getElementById('loading-overlay');
  const text    = document.getElementById('loading-text');
  if (text) text.textContent = msg;
  overlay?.classList.remove('hidden');
}

export function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden');
}

// ─────────────────────────────────────────
//  ERROR
// ─────────────────────────────────────────
export function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = '⚠ ' + msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

// ─────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────
export function renderSidebarUser(user, channelInfo) {
  const avatarEl = document.getElementById('sidebar-avatar');
  if (avatarEl) {
    avatarEl.innerHTML = user.picture
      ? `<img src="${user.picture}" alt="${user.name}" />`
      : user.name.charAt(0).toUpperCase();
  }
  const nameEl = document.getElementById('sidebar-username');
  if (nameEl) nameEl.textContent = channelInfo?.title || user.name;
  const roleEl = document.getElementById('sidebar-videocnt');
  if (roleEl) roleEl.textContent = `${channelInfo?.videoCount ?? '—'} video aktif`;
}

// ─────────────────────────────────────────
//  STAT CARDS
// ─────────────────────────────────────────
export function renderStatCards(summary, channelInfo) {
  const subEl = document.getElementById('dash-channel-sub');
  if (subEl) {
    const handle = channelInfo.customUrl
      ? `@${channelInfo.customUrl.replace('@', '')}`
      : channelInfo.title;
    const now = new Date();
    const waktu = now.toLocaleString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    subEl.textContent = `Saluran: ${handle} · Diperbarui ${waktu}`;
  }
  const badgeEl = document.getElementById('dash-video-badge');
  if (badgeEl) badgeEl.textContent = `${summary.videoCount} video terakhir`;

  _setInner('stat-views',     formatNum(summary.totalViews));
  _setInner('stat-watchtime', formatNum(summary.totalWatchTime) + ' mnt');
  _setInner('stat-subs',      formatNum(summary.subscriberCount));
  _setInner('stat-er',        summary.avgEngagementRate.toFixed(2) + '%');
}

// ─────────────────────────────────────────
//  VIDEO TABLE — 8 kolom sejajar
// ─────────────────────────────────────────
/**
 * @param {VideoData[]} videos
 * @param {function}    onRowClick
 */
export function renderVideoTable(videos, onRowClick) {
  const tbody = document.getElementById('video-table-body');
  if (!tbody) return;

  if (videos.length === 0) {
    tbody.innerHTML = '<div class="loading-row">Tidak ada video ditemukan.</div>';
    return;
  }

  tbody.innerHTML = videos.map((v, i) => `
    <div class="table-row tbl-main" data-idx="${i}" style="cursor:pointer" title="Klik untuk lihat detail">
      <div>${_rankBadge(i + 1, 'rank-n', i + 1)}</div>
      <div class="video-title-cell">
        <div class="thumb">
          ${v.thumbnail ? `<img src="${v.thumbnail}" alt="" loading="lazy" />` : '🎬'}
        </div>
        <span class="vid-name" title="${_esc(v.title)}">${_esc(v.title)}</span>
      </div>
      <div>${formatNum(v.views)}</div>
      <div>${formatNum(v.likes)}</div>
      <div>${formatNum(v.comments)}</div>
      <div>${formatNum(v.watchTimeMinutes)} <small style="color:var(--muted)">mnt</small></div>
      <div>${v.subscribersGained > 0 ? formatNum(v.subscribersGained) : '<span style="color:var(--muted)">—</span>'}</div>
      <div>${v.engagementRate.toFixed(2)}%</div>
    </div>
  `).join('');

  if (onRowClick) {
    tbody.querySelectorAll('.table-row').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.idx, 10);
        onRowClick(videos[idx]);
      });
    });
  }
}

// ─────────────────────────────────────────
//  CRITERIA DRAG & DROP
// ─────────────────────────────────────────
let _currentOrder = CRITERIA.map(c => c.id);
export function getCurrentOrder() { return [..._currentOrder]; }

export function renderCriteriaPanel(onOrderChange) {
  const list = document.getElementById('criteria-list');
  if (!list) return;
  _renderCriteriaItems(list, onOrderChange);
}

function _renderCriteriaItems(list, onOrderChange) {
  const weights = _calcROCPreview(_currentOrder.length);
  list.innerHTML = _currentOrder.map((id, idx) => {
    const c   = CRITERIA.find(x => x.id === id);
    const pct = Math.round(weights[idx] * 100);
    return `
      <div class="criteria-item" draggable="true" data-id="${id}">
        <span class="drag-handle">⠿</span>
        <div class="criteria-rank">${idx + 1}</div>
        <div class="criteria-info">
          <div class="criteria-name">${c.name}</div>
          <div class="criteria-symbol">${c.id} — ${c.symbol}</div>
        </div>
        <div class="weight-bar-mini">
          <div class="weight-fill" style="width:${pct}%"></div>
        </div>
        <div class="criteria-weight">${pct}%</div>
      </div>
    `;
  }).join('');

  _setInner('total-weight-display', '100%');
  _initDragDrop(list, onOrderChange);
}

function _initDragDrop(list, onOrderChange) {
  let dragSrc = null;
  list.querySelectorAll('.criteria-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrc = item;
      e.dataTransfer.effectAllowed = 'move';
      item.style.opacity = '0.5';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      list.querySelectorAll('.criteria-item').forEach(i => i.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc === item) return;
      const fromIdx = _currentOrder.indexOf(dragSrc.dataset.id);
      const toIdx   = _currentOrder.indexOf(item.dataset.id);
      _currentOrder.splice(fromIdx, 1);
      _currentOrder.splice(toIdx, 0, dragSrc.dataset.id);
      _renderCriteriaItems(list, onOrderChange);
      if (onOrderChange) onOrderChange([..._currentOrder]);
    });
  });
}

function _calcROCPreview(n) {
  const w = [];
  for (let i = 1; i <= n; i++) {
    let sum = 0;
    for (let k = i; k <= n; k++) sum += 1 / k;
    w.push(sum / n);
  }
  return w;
}

// ─────────────────────────────────────────
//  NORMALIZATION TABLE
// ─────────────────────────────────────────
export function renderNormTable(result) {
  const table = document.getElementById('norm-table');
  if (!table) return;
  const { orderedCriteria, weightMap, ranking } = result;

  const th = `
    <thead>
      <tr>
        <th>Video</th>
        ${orderedCriteria.map(c => `<th>${c.id}<br><small>${c.name}</small></th>`).join('')}
        <th>Skor Vᵢ</th>
      </tr>
    </thead>`;

  const rows = ranking.map(rv => {
    const cells = orderedCriteria.map(c => {
      const val = rv.normValues[c.id];
      return `<td>${val === 1.0
        ? `<span class="hl">${val.toFixed(4)}</span>`
        : val.toFixed(4)}</td>`;
    }).join('');
    return `
      <tr>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${_esc(rv.videoTitle)}">${_esc(_truncate(rv.videoTitle, 28))}</td>
        ${cells}
        <td><span class="hl-best">${rv.score.toFixed(4)}</span></td>
      </tr>`;
  });

  const weightRow = `
    <tr style="border-top:1px solid var(--navy-500)">
      <td style="color:var(--muted);font-size:11px">Bobot (wⱼ)</td>
      ${orderedCriteria.map(c =>
        `<td style="color:var(--accent);font-family:var(--font-d);font-size:13px;font-weight:700">
          ${(weightMap[c.id] * 100).toFixed(1)}%
        </td>`
      ).join('')}
      <td></td>
    </tr>`;

  table.innerHTML = th + '<tbody>' + rows.join('') + weightRow + '</tbody>';
}

// ─────────────────────────────────────────
//  RANKING TABLE
// ─────────────────────────────────────────
export function renderRankingTable(ranking, onRowClick) {
  const tbody = document.getElementById('ranking-table-body');
  if (!tbody) return;

  tbody.innerHTML = ranking.map(rv => {
    const perf     = getPerformanceLabel(rv.score, rv.rank);
    const rankCls  = rv.rank <= 3 ? `rank-${rv.rank}` : 'rank-n';
    const barWidth = Math.round(rv.score * 100);
    return `
      <div class="table-row tbl-rank" data-rank-idx="${rv.rank - 1}" style="cursor:pointer" title="Klik untuk lihat detail">
        <div>${_rankBadge(rv.rank, rankCls, rv.rank)}</div>
        <div class="video-title-cell">
          <div class="thumb">
            ${rv.thumbnail ? `<img src="${rv.thumbnail}" alt="" loading="lazy" />` : '🎬'}
          </div>
          <span class="vid-name" title="${_esc(rv.videoTitle)}">${_esc(rv.videoTitle)}</span>
        </div>
        <div class="score-bar-wrap">
          <div class="score-bar"><div class="score-fill" style="width:${barWidth}%"></div></div>
          <div class="score-val">${rv.score.toFixed(4)}</div>
        </div>
        <div><span class="tag ${perf.cls}">${perf.label}</span></div>
      </div>`;
  }).join('');

  if (onRowClick) {
    tbody.querySelectorAll('.table-row').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.rankIdx, 10);
        onRowClick(ranking[idx]);
      });
    });
  }

  const resultsEl = document.getElementById('ranking-results');
  if (resultsEl) {
    resultsEl.classList.remove('hidden');
    resultsEl.classList.add('results-ready');
    setTimeout(() => resultsEl.classList.remove('results-ready'), 1800);
  }

  const btnCalc = document.getElementById('btn-calculate');
  if (btnCalc) {
    btnCalc.textContent = '✓ Selesai Dihitung';
    btnCalc.style.background = 'linear-gradient(90deg,#00C853,#1DE9B6)';
    btnCalc.style.boxShadow  = '0 4px 16px rgba(0,200,83,.4)';
    setTimeout(() => {
      btnCalc.textContent = 'Hitung SAW‑ROC';
      btnCalc.style.background = '';
      btnCalc.style.boxShadow  = '';
    }, 2500);
  }

  _showToast(`✓ Ranking selesai dihitung — ${ranking.length} video diurutkan`, 'green');
}

// ─────────────────────────────────────────
//  DETAIL VIDEO — dari Hasil Ranking Final
//  Menampilkan: thumbnail, skor SAW, rank,
//  6 stat card + normalisasi, tabel kontribusi
// ─────────────────────────────────────────
/**
 * @param {RankedVideo} rv
 * @param {Criterion[]} orderedCriteria
 * @param {object}      weightMap
 */
export function renderDetailFromRanking(rv, orderedCriteria, weightMap) {
  const container = document.getElementById('detail-content');
  if (!container) return;

  const criteriaIcons = { C1:'', C2:'', C3:'', C4:'', C5:'', C6:'' };
  const criteriaUnits = { C1:'', C2:'', C3:'', C4:' mnt', C5:'', C6:'%' };
  const criteriaGrad  = {
    C1: '#FF1744,#FF4081', C2: '#7C4DFF,#E040FB',
    C3: '#00BCD4,#00E5FF', C4: '#FF6F00,#FFD600',
    C5: '#00E676,#1DE9B6', C6: '#FF4081,#F48FB1',
  };

  const perf = getPerformanceLabel(rv.score, rv.rank);

  const statCards = CRITERIA.map(c => {
    const raw  = rv.rawValues[c.id];
    const norm = rv.normValues?.[c.id];
    const unit = criteriaUnits[c.id] || '';
    const grad = criteriaGrad[c.id];
    const icon = criteriaIcons[c.id];
    const normLabel = norm !== undefined
      ? `Normalisasi: <span style="color:var(--red);font-weight:700">${norm.toFixed(3)}</span>${norm >= 0.999 ? ' <span style="color:var(--green);font-size:10px">(tertinggi)</span>' : ''}`
      : '';
    return `
      <div class="detail-stat" style="position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${grad});border-radius:10px 10px 0 0"></div>
        <div class="detail-stat-label">${icon} ${c.name} <span style="opacity:.5;font-size:9px">${c.id}</span></div>
        <div class="detail-stat-value">${formatNum(raw)}${unit === '%' ? '' : ''}<span style="font-size:13px;font-weight:400;color:var(--muted)">${unit}</span></div>
        <div class="detail-stat-sub" style="margin-top:4px">${normLabel}</div>
      </div>`;
  }).join('');

  const contribRows = orderedCriteria.map(c => {
    const raw    = rv.rawValues[c.id];
    const norm   = rv.normValues?.[c.id] ?? '—';
    const weight = weightMap[c.id] ?? '—';
    const contrib= rv.contributions?.[c.id];
    const unit   = criteriaUnits[c.id] || '';
    return `
      <tr>
        <td>${c.id} — ${c.name}</td>
        <td>${formatNum(raw)}${unit}</td>
        <td>${typeof norm === 'number' ? norm.toFixed(3) : norm}</td>
        <td>${typeof weight === 'number' ? weight.toFixed(3) : weight}</td>
        <td style="color:var(--accent);font-family:var(--font-d);font-weight:700;font-size:14px">${typeof contrib === 'number' ? contrib.toFixed(4) : contrib}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div style="margin-bottom:16px">
      <a class="section-link" data-page="page-ranking" style="font-size:12px;cursor:pointer">← Kembali</a>
    </div>

    <!-- Hero -->
    <div class="table-card" style="padding:24px;margin-bottom:20px">
      <div style="display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:start">
        <div class="detail-thumb" style="aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:var(--navy-600)">
          ${rv.thumbnail
            ? `<img src="${rv.thumbnail}" style="width:100%;height:100%;object-fit:cover" alt="" />`
            : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:32px">🎬</div>'}
        </div>
        <div>
          <div style="font-family:var(--font-d);font-size:22px;font-weight:700;line-height:1.3;margin-bottom:8px">${_esc(rv.videoTitle)}</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px">
            <div style="background:rgba(255,23,68,.1);border:1px solid rgba(255,23,68,.3);border-radius:8px;padding:8px 14px;font-size:13px">
              Skor SAW: <span style="font-family:var(--font-d);font-size:18px;font-weight:700;color:var(--red)">${rv.score.toFixed(4)}</span>
            </div>
            <div style="background:var(--navy-600);border:1px solid var(--navy-500);border-radius:8px;padding:8px 14px;font-size:13px">
              Rank <strong style="color:var(--accent)">#${rv.rank}</strong> dari semua video
            </div>
            <span class="tag ${perf.cls}">${perf.label}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 6 Stat Cards -->
    <div class="detail-stats" style="margin-bottom:20px">
      ${statCards}
    </div>

    <!-- Tabel Kontribusi SAW -->
    <div class="table-card">
      <div style="padding:16px 20px;border-bottom:1px solid var(--navy-500)">
        <div class="section-title">Detail Perhitungan SAW</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Vᵢ = Σ (wⱼ × rᵢⱼ) — Total skor preferensi berdasarkan bobot ROC dan nilai normalisasi</div>
      </div>
      <div style="overflow-x:auto">
        <table class="norm-table" style="width:100%">
          <thead>
            <tr>
              <th>Kriteria</th>
              <th>Nilai Asli (xᵢⱼ)</th>
              <th>Normalisasi (rᵢⱼ)</th>
              <th>Bobot ROC (wⱼ)</th>
              <th>Kontribusi (wⱼ × rᵢⱼ)</th>
            </tr>
          </thead>
          <tbody>
            ${contribRows}
            <tr style="border-top:1px solid var(--navy-500)">
              <td colspan="4" style="text-align:right;color:var(--muted);font-size:12px;padding-right:16px">Total Vᵢ =</td>
              <td style="color:var(--red);font-family:var(--font-d);font-size:16px;font-weight:700">${rv.score.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('[data-page]')?.addEventListener('click', (e) => {
    navigateTo(e.currentTarget.dataset.page);
  });
}

// ─────────────────────────────────────────
//  EXPORT — CSV
// ─────────────────────────────────────────
/**
 * @param {object[]} rows
 * @param {string}   filename
 */
export function exportCSV(rows, filename = 'data.csv') {
  if (!rows || rows.length === 0) { alert('Tidak ada data untuk diekspor.'); return; }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '').replace(/"/g, '""');
        return val.includes(',') || val.includes('\n') ? `"${val}"` : val;
      }).join(',')
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  _triggerDownload(blob, filename);
}

// ─────────────────────────────────────────
//  EXPORT — XLSX
//  Menggunakan SheetJS (dimuat dinamis dari CDN)
// ─────────────────────────────────────────
/**
 * @param {object[]} rows
 * @param {string}   filename
 * @param {string}   sheetName
 */
export async function exportXLSX(rows, filename = 'data.xlsx', sheetName = 'Data') {
  if (!rows || rows.length === 0) { alert('Tidak ada data untuk diekspor.'); return; }
  if (!window.XLSX) {
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ─────────────────────────────────────────
//  EXPORT FORMATTERS
// ─────────────────────────────────────────
/**
 * @param {VideoData[]} videos
 * @returns {object[]}
 */
export function formatVideosForExport(videos) {
  return videos.map((v, i) => ({
    'No':                        i + 1,
    'Judul Video':               v.title,
    'Views (C1)':                v.views,
    'Likes (C2)':                v.likes,
    'Comments (C3)':             v.comments,
    'Watch Time mnt (C4)':       v.watchTimeMinutes,
    'Subscribers Gained (C5)':   v.subscribersGained,
    'Engagement Rate % (C6)':    v.engagementRate,
    'Tanggal Upload':            v.publishedAt
      ? new Date(v.publishedAt).toLocaleDateString('id-ID')
      : '—',
  }));
}

/**
 * @param {RankedVideo[]} ranking
 * @param {object}        weightMap
 * @param {Criterion[]}   orderedCriteria
 * @returns {object[]}
 */
export function formatRankingForExport(ranking, weightMap, orderedCriteria) {
  return ranking.map(rv => {
    const row = {
      'Rank':            rv.rank,
      'Judul Video':     rv.videoTitle,
      'Skor SAW (Vi)':   rv.score,
    };
    orderedCriteria.forEach(c => {
      row[`${c.name} - Raw`]         = rv.rawValues[c.id];
      row[`${c.name} - Norm (rij)`]  = rv.normValues[c.id];
      row[`${c.name} - Bobot (wj)`]  = weightMap[c.id];
      row[`${c.name} - Kontribusi`]  = rv.contributions[c.id];
    });
    return row;
  });
}

// ─────────────────────────────────────────
//  PRIVATE HELPERS
// ─────────────────────────────────────────
function _setInner(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function _esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _truncate(str, max) {
  return str && str.length > max ? str.slice(0, max) + '…' : str;
}

function _rankBadge(rank, cls, label) {
  return `<span class="rank-badge ${cls}">${label}</span>`;
}

function _triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Gagal memuat ' + src));
    document.head.appendChild(s);
  });
}

// ─────────────────────────────────────────
//  TOAST NOTIFICATION
// ─────────────────────────────────────────
/**
 * @param {string} msg
 * @param {'green'|'red'|'yellow'|''} type
 * @param {number} duration ms
 */
export function _showToast(msg, type = '', duration = 3500) {
  document.getElementById('ytrank-toast')?.remove();

  const colorMap = {
    green:  { bg: 'rgba(0,200,83,.15)',  border: 'rgba(0,200,83,.4)',  icon: '✓' },
    red:    { bg: 'rgba(255,23,68,.15)', border: 'rgba(255,23,68,.4)', icon: '✕' },
    yellow: { bg: 'rgba(255,214,0,.12)', border: 'rgba(255,214,0,.4)', icon: '!' },
    '':     { bg: 'rgba(45,58,82,.8)',   border: 'rgba(61,79,110,.8)', icon: 'ℹ' },
  };
  const c = colorMap[type] || colorMap[''];

  const toast = document.createElement('div');
  toast.id = 'ytrank-toast';
  toast.innerHTML = `<span style="font-size:16px">${c.icon}</span><span>${msg}</span>`;
  Object.assign(toast.style, {
    position:     'fixed',
    bottom:       '32px',
    right:        '32px',
    zIndex:       '99999',
    display:      'flex',
    alignItems:   'center',
    gap:          '10px',
    background:   c.bg,
    border:       `1px solid ${c.border}`,
    borderRadius: '12px',
    padding:      '14px 20px',
    fontSize:     '13px',
    fontFamily:   'var(--font-b, sans-serif)',
    color:        '#E8EDF5',
    backdropFilter: 'blur(12px)',
    boxShadow:    '0 8px 32px rgba(0,0,0,.4)',
    animation:    'toastIn .3s ease both',
    maxWidth:     '360px',
  });

  if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
      @keyframes toastIn  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes toastOut { from{opacity:1;transform:translateY(0)}    to{opacity:0;transform:translateY(16px)} }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}