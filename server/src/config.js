import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Load .env for both local and Render.
 * Render itself doesn't auto-load .env; Node apps usually call dotenv.
 * We try multiple common locations so it works whether the process starts from:
 *  - repo root (node server/src/index.js)
 *  - server/ folder (npm start inside server)
 */
function loadDotenvOnce() {
  // If ENV_FILE is set, use it first.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const candidates = [
    process.env.ENV_FILE,
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'), // repo root from server/src
    path.resolve(__dirname, '..', '.env'),       // server/.env
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const out = dotenv.config({ path: p });
      if (!out?.error) return p;
    } catch {
      // keep trying
    }
  }
  return null;
}

// Run once on import
loadDotenvOnce();

export const PORT = process.env.PORT ? Number(process.env.PORT) : 5175;

// DATA_DIR default should work regardless of start directory.
// Prefer "<cwd>/data"; if not present but "<cwd>/server/data" exists, use that.
function defaultDataDir() {
  const cwd = process.cwd();
  const a = path.join(cwd, 'data');
  const b = path.join(cwd, 'server', 'data');
  if (fs.existsSync(a)) return a;
  if (fs.existsSync(b)) return b;
  return a;
}

export const DATA_DIR = process.env.DATA_DIR || defaultDataDir();
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// CORS:
// - local dev: set CORS_ORIGIN=http://localhost:5173
// - Render (static site -> API): set CORS_ORIGIN=https://<your-static>.onrender.com
// - If not set, allow all origins (no credentials).
export const CORS_ORIGIN = process.env.CORS_ORIGIN || true;

// Press releases: defaults to Korea.kr press release RSS if not set.
const defaultRss = 'https://www.korea.kr/rss/pressrelease.xml';
const rssRaw = (process.env.GOV_PRESS_RSS && process.env.GOV_PRESS_RSS.trim()) ? process.env.GOV_PRESS_RSS : defaultRss;
export const GOV_PRESS_RSS = rssRaw.split(',').map((s) => s.trim()).filter(Boolean);

export function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}
