// GC0: every call to the gov API goes through here.
//  - the access token lives in memory only (never in storage); the refresh token is an httpOnly cookie
//  - the CSRF token is kept in localStorage so EVERY tab sees the latest one. The refresh cookie and the CSRF cookie
//    are shared by all tabs and rotate on every refresh; a per-tab copy would go stale and sign that tab out.
//  - a 401 triggers ONE silent refresh and a retry; if that fails the person is sent to the login page
//  - refreshes take a browser-wide lock (Web Locks), so two tabs never refresh at the same moment (the server
//    would read the second one as a stolen token and end the whole session)
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8081').replace(/\/$/, '');

const CSRF_KEY = 'govcsrf';
let accessToken = '';
let csrfMemory = ''; // fallback when storage is blocked (then only this tab works, as before)
const getCsrf = () => {
  try { return localStorage.getItem(CSRF_KEY) || csrfMemory; } catch { return csrfMemory; }
};
let onLoggedOut = () => {};
export const setLoggedOutHandler = (fn) => { onLoggedOut = fn; };

function remember(session) {
  accessToken = session.accessToken;
  csrfMemory = session.csrfToken;
  try { localStorage.setItem(CSRF_KEY, session.csrfToken); } catch { /* ignore */ }
}
function forget() {
  accessToken = '';
  csrfMemory = '';
  try { localStorage.removeItem(CSRF_KEY); } catch { /* ignore */ }
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
      ...(method !== 'GET' && getCsrf() ? { 'x-csrf-token': getCsrf() } : {}),
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
    const run = async () => {
      if (!getCsrf()) return null;
      try {
        const { res, json } = await raw('/api/auth/refresh', { method: 'POST', body: {} });
        if (res.ok && json?.accessToken) { remember(json); return json.user; }
        if (res.status === 401 || res.status === 403) forget(); // the session is really over (all tabs)
      } catch { /* network down: keep the CSRF token so the next try can succeed */ }
      return null;
    };
    // One refresh at a time across ALL tabs (the browser queues the others, which then use the new cookie).
    refreshing = (navigator.locks?.request ? navigator.locks.request('gov-session-refresh', run) : run()).finally(() => { refreshing = null; });
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
