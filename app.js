import { initAuth, loginWithGoogle, logout, getToken } from './js/auth.js';
import { fetchChannelInfo, fetchVideoIds, fetchVideosData } from './js/data.js';
import { evaluate, calcChannelSummary, formatNum } from './js/logic.js';
import {
  showLoginPage, showAppLayout, navigateTo,
  showLoading, hideLoading, showLoginError,
  renderSidebarUser, renderStatCards, renderVideoTable,
  renderCriteriaPanel, renderNormTable, renderRankingTable,
  getCurrentOrder,
  exportCSV, exportXLSX,
  formatVideosForExport, formatRankingForExport,
  renderDetailFromRanking,
} from './js/ui.js';

// ─────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────
let _videos      = [];
let _channelInfo = null;
let _lastResult  = null;

// ─────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────
async function boot() {
  showLoading('Mempersiapkan aplikasi…');
  try {
    await initAuth();
  } catch (err) {
    showLoginError('Gagal memuat Google Auth: ' + err.message);
  } finally {
    hideLoading();
  }
  showLoginPage();
  _bindEvents();
}

// ─────────────────────────────────────────
//  EVENT LISTENERS
// ─────────────────────────────────────────
function _bindEvents() {
  document.getElementById('btn-login')?.addEventListener('click', handleLogin);
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-calculate')?.addEventListener('click', handleCalculate);

  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  document.querySelectorAll('.section-link[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    exportCSV(formatVideosForExport(_videos), 'ytrank-videos.csv');
  });
  document.getElementById('btn-export-xlsx')?.addEventListener('click', () => {
    exportXLSX(formatVideosForExport(_videos), 'ytrank-videos.xlsx', 'Semua Video');
  });

  document.getElementById('btn-export-ranking-csv')?.addEventListener('click', () => {
    if (!_lastResult) { alert('Hitung ranking dulu.'); return; }
    exportCSV(
      formatRankingForExport(_lastResult.ranking, _lastResult.weightMap, _lastResult.orderedCriteria),
      'ytrank-ranking.csv'
    );
  });
  document.getElementById('btn-export-ranking-xlsx')?.addEventListener('click', () => {
    if (!_lastResult) { alert('Hitung ranking dulu.'); return; }
    exportXLSX(
      formatRankingForExport(_lastResult.ranking, _lastResult.weightMap, _lastResult.orderedCriteria),
      'ytrank-ranking.xlsx',
      'Ranking SAW'
    );
  });
}

// ─────────────────────────────────────────
//  HANDLER: LOGIN
// ─────────────────────────────────────────
async function handleLogin() {
  const btnLogin = document.getElementById('btn-login');
  try {
    if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = 'Menunggu…'; }
    showLoading('Membuka popup Google…');

    const { user } = await loginWithGoogle();

    showLoading('Mengambil data channel YouTube…');
    _channelInfo = await fetchChannelInfo(getToken());

    showLoading('Mengambil daftar video…');
    const videoIds = await fetchVideoIds(getToken(), _channelInfo.uploadsPlaylistId, 50);

    showLoading(`Mengambil statistik ${videoIds.length} video…`);
    _videos = await fetchVideosData(getToken(), videoIds);

    showLoading('Menyiapkan dashboard…');
    const summary = calcChannelSummary(_videos, _channelInfo);

    renderSidebarUser(user, _channelInfo);
    renderStatCards(summary, _channelInfo);
    renderVideoTable(_videos, _onVideoRowClick);
    renderCriteriaPanel(null);
    showAppLayout();

  } catch (err) {
    console.error('Login error:', err);
    showLoginError(err.message || 'Terjadi kesalahan saat login.');
  } finally {
    hideLoading();
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Masuk dengan Google`;
    }
  }
}

// ─────────────────────────────────────────
//  HANDLER: LOGOUT
// ─────────────────────────────────────────
function handleLogout() {
  logout();
  _videos = []; _channelInfo = null; _lastResult = null;
  showLoginPage();
}

// ─────────────────────────────────────────
//  HANDLER: HITUNG SAW-ROC
// ─────────────────────────────────────────
function handleCalculate() {
  if (_videos.length === 0) {
    alert('Tidak ada data video. Silakan login terlebih dahulu.');
    return;
  }
  try {
    showLoading('Menghitung SAW-ROC…');
    const priorityOrder = getCurrentOrder();
    _lastResult = evaluate(_videos, priorityOrder);
    renderNormTable(_lastResult);
    renderRankingTable(_lastResult.ranking, _onRankingRowClick);
  } catch (err) {
    console.error('Calculation error:', err);
    alert('Terjadi kesalahan saat perhitungan: ' + err.message);
  } finally {
    hideLoading();
  }
}

// ─────────────────────────────────────────
//  HANDLER: KLIK BARIS VIDEO → Detail Page
// ─────────────────────────────────────────
function _onRankingRowClick(rankedVideo) {
  if (!_lastResult) return;
  renderDetailFromRanking(
    rankedVideo,
    _lastResult.orderedCriteria,
    _lastResult.weightMap
  );
  navigateTo('page-detail');
}

function _onVideoRowClick(video) {
  _renderDetailPage(video);
  navigateTo('page-detail');
}

function _renderDetailPage(v) {
  const container = document.getElementById('detail-content');
  if (!container) return;

  const pubDate = v.publishedAt
    ? new Date(v.publishedAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—';

  container.innerHTML = `
    <div class="detail-hero">
      <div class="detail-thumb">
        ${v.thumbnail
          ? `<img src="${v.thumbnail}" alt="${_esc(v.title)}" />`
          : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:40px">🎬</div>'}
      </div>
      <div class="detail-meta">
        <div class="detail-title">${_esc(v.title)}</div>
        <div class="detail-date">📅 Diunggah: ${pubDate}</div>
        <div class="detail-stats">
          <div class="detail-stat">
            <div class="detail-stat-label">Views (C1)</div>
            <div class="detail-stat-value">${formatNum(v.views)}</div>
            <div class="detail-stat-sub">Total tayangan</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Likes (C2)</div>
            <div class="detail-stat-value">${formatNum(v.likes)}</div>
            <div class="detail-stat-sub">Apresiasi penonton</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Comments (C3)</div>
            <div class="detail-stat-value">${formatNum(v.comments)}</div>
            <div class="detail-stat-sub">Keterlibatan aktif</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Watch Time (C4)</div>
            <div class="detail-stat-value">${formatNum(v.watchTimeMinutes)}</div>
            <div class="detail-stat-sub">menit ditonton</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Subs Gained (C5)</div>
            <div class="detail-stat-value">${v.subscribersGained > 0 ? formatNum(v.subscribersGained) : '—'}</div>
            <div class="detail-stat-sub">Subscriber baru</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Engagement Rate (C6)</div>
            <div class="detail-stat-value">${v.engagementRate.toFixed(2)}%</div>
            <div class="detail-stat-sub">(Likes+Comments)/Views</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function _esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

boot();