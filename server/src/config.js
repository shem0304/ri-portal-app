import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PORT = process.env.PORT ? Number(process.env.PORT) : 5175;

function existsFile(p) {
  try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; }
}
function existsDir(p) {
  try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); } catch { return false; }
}
function dirHasAny(dir, files) {
  for (const f of files) {
    if (existsFile(path.join(dir, f))) return true;
  }
  return false;
}

const EXPECT_FILES = [
  'local_institutes.json',
  'national_institutes.json',
  'local_reports.json',
  'national_reports.json',
];

export const DATA_DIR = (() => {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;

  // Render persistent disk commonly mounted at /var/data (if configured)
  if (existsDir('/var/data')) return '/var/data';

  // Resolve paths relative to this file (robust regardless of Start Command / cwd)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);           // .../server/src
  const serverDir = path.resolve(__dirname, '..');      // .../server
  const repoRoot = path.resolve(serverDir, '..');       // repo root

  const candidates = [
    path.join(repoRoot, 'data'),
    path.join(serverDir, 'data'),
    path.join(repoRoot, 'server', 'data'),
    path.join(repoRoot, 'client', 'public', 'data'),
    path.join(process.cwd(), 'data'),
  ];

  for (const d of candidates) {
    if (existsDir(d) && dirHasAny(d, EXPECT_FILES)) return d;
  }
  // fallback to first existing dir
  for (const d of candidates) {
    if (existsDir(d)) return d;
  }
  // last resort
  return path.join(serverDir, 'data');
})();

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Startup diagnostics (always)
try {
  console.log('[config] DATA_DIR =', DATA_DIR);
  const checks = {};
  for (const f of EXPECT_FILES) {
    checks[f] = existsFile(path.join(DATA_DIR, f));
  }
  console.log('[config] DATA_DIR files =', checks);
} catch {}
