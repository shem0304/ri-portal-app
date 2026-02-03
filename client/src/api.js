const API_BASE = import.meta.env.VITE_API_BASE || '';

export function getToken() {
  return localStorage.getItem('riportal_token');
}

export function setToken(token) {
  if (!token) localStorage.removeItem('riportal_token');
  else localStorage.setItem('riportal_token', token);
}

export async function apiFetch(path, { method = 'GET', headers, body, auth = false, cache } = {}) {
  const h = { 'Content-Type': 'application/json', ...(headers || {}) };
  if (auth) {
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    ...(cache ? { cache } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error || msg;
      // attach server payload for richer UI messages
      // eslint-disable-next-line no-param-reassign
      var __payload = j;
    } catch {
      // ignore
    }
    const err = new Error(msg);
    err.status = res.status;
    if (typeof __payload !== 'undefined') err.data = __payload;
    throw err;
  }
  return res.json();
}
