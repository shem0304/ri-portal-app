const API_BASE = import.meta.env.VITE_API_BASE || '';

export function getToken() {
  return localStorage.getItem('riportal_token');
}

export function setToken(token) {
  if (!token) localStorage.removeItem('riportal_token');
  else localStorage.setItem('riportal_token', token);
}

function isJsonResponse(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return ct.includes('application/json') || ct.includes('+json');
}

export async function apiFetch(path, { method = 'GET', headers, body, auth = false, cache } = {}) {
  const h = { 'Content-Type': 'application/json', ...(headers || {}) };
  if (auth) {
    const token = getToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: h,
    ...(cache ? { cache } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });

  // Non-2xx: try to parse JSON error payload first, then fall back to text.
  if (!res.ok) {
    let msg = `${res.status}`;
    let payload;
    try {
      if (isJsonResponse(res)) payload = await res.json();
      else payload = { error: (await res.text()).slice(0, 500) };
      msg = payload?.error || payload?.message || msg;
    } catch {
      // ignore
    }
    const err = new Error(msg);
    err.status = res.status;
    if (payload) err.data = payload;
    err.url = url;
    throw err;
  }

  // 2xx but not JSON => most often SPA index.html served for /api because API_BASE is wrong.
  if (!isJsonResponse(res)) {
    const text = await res.text().catch(() => '');
    const err = new Error(
      'API 응답이 JSON이 아닙니다. (Render 배포에서 /api 요청이 index.html로 라우팅되는 경우가 흔합니다)\n' +
        `요청: ${url}\n` +
        `Content-Type: ${(res.headers.get('content-type') || '')}\n` +
        `응답 시작: ${text.slice(0, 80)}`
    );
    err.status = res.status;
    err.url = url;
    throw err;
  }

  return res.json();
}
