export function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export function uniq(arr) {
  return Array.from(new Set(arr));
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function nowIso() {
  return new Date().toISOString();
}
