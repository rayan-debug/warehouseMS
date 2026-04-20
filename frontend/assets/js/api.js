const API_BASE = window.API_BASE || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('wms_token');
}

function setToken(token) {
  localStorage.setItem('wms_token', token);
}

function clearSession() {
  localStorage.removeItem('wms_token');
  localStorage.removeItem('wms_user');
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let payload = null;

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else if (contentType.includes('application/pdf')) {
    payload = await response.blob();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const message = payload?.message || 'Request failed.';
    throw new Error(message);
  }

  return payload;
}

window.API_BASE = API_BASE;
window.apiRequest = apiRequest;
window.getToken = getToken;
window.setToken = setToken;
window.clearSession = clearSession;
