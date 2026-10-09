// GC0: every call to the gov API goes through here.
//  - the access token lives in memory only (never in storage); the refresh token is an httpOnly cookie
//  - the CSRF token is kept in sessionStorage (one tab) and sent as x-csrf-token on every mutating call
//  - a 401 triggers ONE silent refresh and a retry; if that fails the person is sent to the login page
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8081').replace(/\/$/, '');

let accessToken = '';
let csrf = '';
try { csrf = sessionStorage.getItem('govcsrf') || ''; } catch { /* storage blocked: stay logged out on reload */ }
let onLoggedOut = () => {};
export const setLoggedOutHandler = (fn) => { onLoggedOut = fn; };

function remember(session) {
  accessToken = session.accessToken;
  csrf = session.csrfToken;
  try { sessionStorage.setItem('govcsrf', csrf); } catch { /* ignore */ }
}
function forget() {
  accessToken = '';
  csrf = '';
  try { sessionStorage.removeItem('govcsrf'); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.code = body?.code || 'ERROR';
    this.body = body || {};
  }
}

async function raw(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(method !== 'GET' && csrf ? { 'x-csrf-token': csrf } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { res, json };
}

let refreshing = null;
/** Exchanges the refresh cookie for a new access token. Resolves to the user, or null when logged out. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      if (!csrf) return null;
      try {
        const { res, json } = await raw('/api/auth/refresh', { method: 'POST', body: {} });
        if (res.ok && json?.accessToken) { remember(json); return json.user; }
      } catch { /* network down */ }
      forget();
      return null;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, opts = {}) {
  let { res, json } = await raw(path, opts);
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const user = await refreshSession();
    if (!user) { onLoggedOut(); throw new ApiError(401, json); }
    ({ res, json } = await raw(path, opts));
  }
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

export async function login(email, password) {
  const { res, json } = await raw('/api/auth/login', { method: 'POST', body: { email, password } });
  if (!res.ok) throw new ApiError(res.status, json);
  remember(json);
  return json.user;
}

export async function logout() {
  try { await raw('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ }
  forget();
}

/** Builds "?a=1&b=2" from an object, skipping empty values. */
export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Downloads a file from an authenticated endpoint (a plain link cannot carry our bearer token). */
export async function download(path, fallbackName) {
  const send = () => fetch(`${API_URL}${path}`, { credentials: 'include', headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });
  let res = await send();
  if (res.status === 401) {
    const user = await refreshSession();
    if (!user) { onLoggedOut(); throw new ApiError(401, null); }
    res = await send();
  }
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* not json */ }
    throw new ApiError(res.status, body);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
