const API_BASE = window.API_BASE || 'http://localhost:3000/api';

function getToken()         { return localStorage.getItem('wms_token'); }
function getRefreshToken()  { return localStorage.getItem('wms_refresh_token'); }
function setToken(t)        { localStorage.setItem('wms_token', t); }
function setRefreshToken(t) { localStorage.setItem('wms_refresh_token', t); }

function clearSession() {
  localStorage.removeItem('wms_token');
  localStorage.removeItem('wms_refresh_token');
  localStorage.removeItem('wms_user');
}

// Shared promise so concurrent 401s only trigger one refresh call.
let _refreshPromise = null;

async function tryRefreshToken() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setToken(data.token);
      return true;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

async function apiRequest(path, options = {}, _isRetry = false) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // On 401, attempt a silent token refresh once before giving up.
  if (response.status === 401 && !_isRetry && !path.startsWith('/auth/')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return apiRequest(path, options, true);
    clearSession();
    window.location.href = 'login.html';
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json'))     payload = await response.json();
  else if (contentType.includes('application/pdf')) payload = await response.blob();
  else                                               payload = await response.text();

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.');
  }
  return payload;
}

window.API_BASE        = API_BASE;
window.apiRequest      = apiRequest;
window.getToken        = getToken;
window.getRefreshToken = getRefreshToken;
window.setToken        = setToken;
window.setRefreshToken = setRefreshToken;
window.clearSession    = clearSession;
