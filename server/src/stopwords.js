import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

/**
 * Stopwords are persisted in DATA_DIR/stopwords.json
 * Supported formats:
 *  - {"words":[...]}
 *  - [...]
 */
export function normalizeStopword(w) {
  return String(w || '')
    .trim()
    .toLowerCase();
}

export function readStopwords() {
  const p = path.join(DATA_DIR, 'stopwords.json');
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf-8');
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.words) ? parsed.words : []);
  return arr.map(normalizeStopword).filter(Boolean);
}

export function writeStopwords(words) {
  const p = path.join(DATA_DIR, 'stopwords.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const uniq = Array.from(new Set((words || []).map(normalizeStopword).filter(Boolean))).sort();
  fs.writeFileSync(p, JSON.stringify({ words: uniq }, null, 2));
  return uniq;
}

export function getStopwordsSet(extra = []) {
  const base = readStopwords();
  const merged = [...base, ...(extra || [])].map(normalizeStopword).filter(Boolean);
  return new Set(merged);
}

export function getStopwordsVersion() {
  const p = path.join(DATA_DIR, 'stopwords.json');
  try {
    if (!fs.existsSync(p)) return String(0);
    return String(fs.statSync(p).mtimeMs);
  } catch {
    return String(Date.now());
  }
}
