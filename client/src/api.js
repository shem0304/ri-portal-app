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

  // Some production setups (e.g., misconfigured rewrites) may return HTML (index.html)
  // for API routes. Parsing that as JSON throws: Unexpected token '<' ...
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  // No content
  if (res.status === 204) return null;

  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      if (contentType.includes('application/json')) {
        const j = await res.json();
        msg = j?.error || msg;
        // attach server payload for richer UI messages
        // eslint-disable-next-line no-param-reassign
        var __payload = j;
      } else {
        const t = await res.text();
        const snippet = t?.slice?.(0, 200)?.replace?.(/\s+/g, ' ')?.trim?.() || '';
        msg = `${msg} (non-JSON response: ${contentType || 'unknown'})${snippet ? `: ${snippet}` : ''}`;
      }
    } catch {
      // ignore
    }
    const err = new Error(msg);
    err.status = res.status;
    if (typeof __payload !== 'undefined') err.data = __payload;
    throw err;
  }

  if (!contentType.includes('application/json')) {
    const t = await res.text();
    const snippet = t?.slice?.(0, 200)?.replace?.(/\s+/g, ' ')?.trim?.() || '';
    const err = new Error(
      `Expected JSON but received ${contentType || 'unknown'} from ${path}. ` +
        `This usually means /api is being rewritten to index.html on the server. ` +
        (snippet ? `Response starts with: ${snippet}` : '')
    );
    err.status = res.status;
    throw err;
  }

  return res.json();
}
