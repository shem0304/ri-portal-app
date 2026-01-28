import path from 'node:path';

export const PORT = process.env.PORT ? Number(process.env.PORT) : 5175;
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Press releases: defaults to Korea.kr press release RSS if not set.
const defaultRss = 'https://www.korea.kr/rss/pressrelease.xml';
const rssRaw = (process.env.GOV_PRESS_RSS && process.env.GOV_PRESS_RSS.trim()) ? process.env.GOV_PRESS_RSS : defaultRss;
export const GOV_PRESS_RSS = rssRaw.split(',').map(s => s.trim()).filter(Boolean);

export function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}