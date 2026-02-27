const CLIENT_ID = '709060091126-44eit4senc0hi4hv16rdbam2ldo7navm.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'openid',
  'profile',
].join(' ');

// ─────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────
let _tokenClient = null;
let _accessToken = null;
let _userProfile = null;

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
export function initAuth() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      _setupTokenClient();
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload  = () => { _setupTokenClient(); resolve(); };
    script.onerror = () => reject(new Error('Gagal memuat Google Identity Services.'));
    document.head.appendChild(script);
  });
}

function _setupTokenClient() {
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope:     SCOPES,
    callback:  () => {},
  });
}

// ─────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────
export function loginWithGoogle() {
  return new Promise((resolve, reject) => {
    if (!_tokenClient) {
      reject(new Error('Auth belum diinisialisasi. Panggil initAuth() dulu.'));
      return;
    }

    _tokenClient.callback = async (tokenResponse) => {
      if (tokenResponse.error) {
        reject(new Error(tokenResponse.error_description || tokenResponse.error));
        return;
      }

      _accessToken = tokenResponse.access_token;

      try {
        _userProfile = await _fetchUserProfile(_accessToken);
        resolve({ accessToken: _accessToken, user: _userProfile });
      } catch (err) {
        reject(err);
      }
    };

    _tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

async function _fetchUserProfile(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Gagal mengambil profil pengguna.');
  const data = await res.json();
  return {
    name:    data.name    || 'Pengguna',
    picture: data.picture || '',
    email:   data.email   || '',
  };
}

// ─────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────
export function logout() {
  if (_accessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(_accessToken, () => {});
  }
  _accessToken = null;
  _userProfile = null;
}

// ─────────────────────────────────────────
//  GETTERS
// ─────────────────────────────────────────
export const getToken   = () => _accessToken;
export const getUser    = () => _userProfile;
export const isLoggedIn = () => !!_accessToken;