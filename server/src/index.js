import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { PORT, CORS_ORIGIN } from './config.js';
import { loadDataStore } from './dataStore.js';
import {
  authMiddleware,
  requireAuth,
  requireAdmin,
  login,
  register,
  me,
  listPendingUsers,
  listUsers,
  approveUser,
  rejectUser,
  setUserPassword,
} from './auth.js';
import {
  getKeywordStats,
  getKeywordSeries,
  getTop5KeywordTrends,
  getRisingKeywords,
  getWordCloud,
  getBurstKeywords,
  searchReports,
  buildCooccurrenceNetwork,
  instituteKeywordHeatmap,
  relatedReportsByKeyword,
} from './analytics.js';
import { getLatestPress } from './press.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = loadDataStore();

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(authMiddleware);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- Auth
app.post('/api/auth/login', login);
app.post('/api/auth/register', register);
app.get('/api/auth/me', me);

// --- Admin
// Legacy approval endpoints (kept for compatibility)
app.get('/api/admin/pending-users', requireAuth, requireAdmin, listPendingUsers);
app.post('/api/admin/approve', requireAuth, requireAdmin, approveUser);

// Admin user management (used by AdminUsersPage)
app.get('/api/admin/users', requireAuth, requireAdmin, listUsers);
app.post('/api/admin/users/:id/approve', requireAuth, requireAdmin, approveUser);
app.post('/api/admin/users/:id/reject', requireAuth, requireAdmin, rejectUser);
app.post('/api/admin/users/:id/password', requireAuth, requireAdmin, setUserPassword);

// --- Public data
app.get('/api/institutes/local', (req, res) => res.json({ items: store.localInstitutes }));
app.get('/api/institutes/national', (req, res) => res.json({ meta: store.nationalInstitutesMeta, items: store.nationalInstitutes }));

// --- Public trend endpoints (aggregates only)
// All trend endpoints support the same common filters used by the Reports screen:
//   scope: all | local | national
//   institute: institute name (local/all) or NRC/NCT (national)
//   year: number
//   q: free-text search over title/tokens
app.get('/api/trends/summary', (req, res) => {
  const top = Number(req.query.top || 200);
  const { scope = 'all', year, institute, q } = req.query;
  res.json(getKeywordStats(store, { top, scope, year, institute, q }));
});

app.get('/api/trends/top5', (req, res) => {
  const { scope = 'all', year, institute, q } = req.query;
  res.json(getTop5KeywordTrends(store, { scope, year, institute, q }));
});

app.get('/api/trends/keyword', (req, res) => {
  // Prevent 304/ETag caching: this endpoint should always return fresh series.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const keyword = req.query.keyword || '';
  const { scope = 'all', year, institute, q } = req.query;
  res.json(getKeywordSeries(store, keyword, { scope, year, institute, q }));
});

app.get('/api/trends/rising', (req, res) => {
  const top = Number(req.query.top || 20);
  const { scope = 'all', year, institute, q } = req.query;
  res.json(getRisingKeywords(store, { top, scope, year, institute, q }));
});

app.get('/api/trends/wordcloud', (req, res) => {
  const top = Number(req.query.top || 50);
  const { scope = 'all', year, institute, q } = req.query;
  res.json(getWordCloud(store, { top, scope, year, institute, q }));
});

app.get('/api/trends/burst', (req, res) => {
  const top = Number(req.query.top || 20);
  const { scope = 'all', year, institute, q } = req.query;
  res.json(getBurstKeywords(store, { top, scope, year, institute, q }));
});

app.get('/api/trends/network', (req, res) => {
  const topKeywords = Number(req.query.topKeywords || 120);
  const edgeTop = Number(req.query.edgeTop || 400);
  const { scope = 'all', year, institute, q } = req.query;
  res.json(buildCooccurrenceNetwork(store, { topKeywords, edgeTop, scope, year, institute, q }));
});

app.get('/api/trends/heatmap', (req, res) => {
  const topKeywords = Number(req.query.topKeywords || 30);
  const { scope = 'all', year, institute, q } = req.query;
  res.json(instituteKeywordHeatmap(store, { topKeywords, scope, year, institute, q }));
});

app.get('/api/trends/related', requireAuth, (req, res) => {
  const keyword = req.query.keyword || '';
  const year = req.query.year ? Number(req.query.year) : undefined;
  const limit = Number(req.query.limit || 50);
  const { scope = 'all', institute, q } = req.query;
  res.json(relatedReportsByKeyword(store, { keyword, year, limit, scope, institute, q }));
});

// --- Press releases
app.get('/api/press/latest', async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const data = await getLatestPress({ limit });
  res.json(data);
});

// --- Protected reports
app.get('/api/reports/search', requireAuth, (req, res) => {
  const { q, scope, year, institute, limit, offset } = req.query;
  res.json(searchReports(store, { q, scope, year, institute, limit, offset }));
});

// --- Static client (production)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));

  // SPA fallback: for non-API routes, return index.html so refresh/deep-link works on Render.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(clientDist, 'index.html');
    return res.sendFile(indexPath);
  });

  // API 404 (prevents returning index.html for unknown /api paths)
  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });
} else {
  console.log('[RI Portal] client/dist not found. Run the client dev server (npm run dev) for the UI.');
}


app.listen(PORT, () => {
  console.log(`RI Portal server listening on http://localhost:${PORT}`);
});
