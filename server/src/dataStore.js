import fs from 'node:fs';
import path from 'node:path';
import NodeCache from 'node-cache';
import { DATA_DIR } from './config.js';
import { tokenizeKoreanTitle, uniq } from './utils/tokenize.js';
import { getStopwordsSet } from './stopwords.js';

function readJson(p) {
  const txt = fs.readFileSync(p, 'utf-8');
  return JSON.parse(txt);
}

/**
 * Loads raw datasets and builds lightweight indices for fast aggregation.
 * This keeps only what we need for search/trend endpoints.
 */
export function loadDataStore() {
  const localInstitutes = readJson(path.join(DATA_DIR, 'local_institutes.json'));
  const nationalInstitutesRaw = readJson(path.join(DATA_DIR, 'national_institutes.json'));
  const localReports = readJson(path.join(DATA_DIR, 'local_reports.json'));
  const nationalReports = readJson(path.join(DATA_DIR, 'national_reports.json'));

  // National institutes JSON contains meta + groups.
  const nationalInstitutes = [];
  const nationalGroupByInstitute = new Map();
  for (const groupKey of Object.keys(nationalInstitutesRaw)) {
    if (Array.isArray(nationalInstitutesRaw[groupKey])) {
      for (const inst of nationalInstitutesRaw[groupKey]) {
        nationalInstitutes.push({ ...inst, group: groupKey });
        if (inst?.name) nationalGroupByInstitute.set(inst.name, groupKey);
      }
    }
  }

  // Quick lookup maps for institute homepage links.
  const localInstituteByName = new Map(
    (Array.isArray(localInstitutes) ? localInstitutes : [])
      .filter((x) => x && x.name)
      .map((x) => [String(x.name).trim(), x])
  );
  const nationalInstituteByName = new Map(
    (Array.isArray(nationalInstitutes) ? nationalInstitutes : [])
      .filter((x) => x && x.name)
      .map((x) => [String(x.name).trim(), x])
  );

  const allReports = [...localReports.map(r => ({ ...r, scope: 'local' })), ...nationalReports.map(r => ({ ...r, scope: 'national' }))];

  // Basic indices
  const years = Array.from(new Set(allReports.map(r => r.year))).sort((a, b) => a - b);
  const institutes = Array.from(new Set(allReports.map(r => r.institute))).sort();

  // Stopwords (admin-managed) are applied to ALL trend analytics.
  const stopwordsSet = getStopwordsSet();

  // Pre-tokenize titles (fast enough for ~25k rows)
  const tokensById = new Map();
  const tokenSetById = new Map();

  for (const r of allReports) {
    const toks = tokenizeKoreanTitle(r.title, { stopwords: stopwordsSet });
    tokensById.set(r.id, toks);
    tokenSetById.set(r.id, new Set(uniq(toks)));
  }

  // Global keyword counts and per-year counts
  const kwCount = new Map();
  const kwYearCount = new Map(); // kw -> Map(year -> count)
  const reportsPerYear = new Map();
  const reportsPerInstitute = new Map();

  for (const r of allReports) {
    reportsPerYear.set(r.year, (reportsPerYear.get(r.year) || 0) + 1);
    reportsPerInstitute.set(r.institute, (reportsPerInstitute.get(r.institute) || 0) + 1);
    const set = tokenSetById.get(r.id);
    for (const kw of set) {
      kwCount.set(kw, (kwCount.get(kw) || 0) + 1);
      if (!kwYearCount.has(kw)) kwYearCount.set(kw, new Map());
      const m = kwYearCount.get(kw);
      m.set(r.year, (m.get(r.year) || 0) + 1);
    }
  }

  const cache = new NodeCache({ stdTTL: 60 }); // 1 min cache for heavy endpoints

  return {
    localInstitutes,
    localInstituteByName,
    nationalInstitutesMeta: {
      updated_at: nationalInstitutesRaw.updated_at,
      sources: nationalInstitutesRaw.sources,
    },
    nationalInstitutes,
    nationalInstituteByName,
    nationalGroupByInstitute,
    localReports,
    nationalReports,
    allReports,
    years,
    institutes,
    tokensById,
    tokenSetById,
    stopwordsSet,
    kwCount,
    kwYearCount,
    reportsPerYear,
    reportsPerInstitute,
    cache,
  };
}


/**
 * Rebuilds token-based indices when stopwords are changed.
 * This updates maps in-place and clears caches so trend screens reflect changes immediately.
 */
export function rebuildTokenIndices(store) {
  const stopwordsSet = getStopwordsSet();
  store.stopwordsSet = stopwordsSet;

  store.tokensById = new Map();
  store.tokenSetById = new Map();
  store.kwCount = new Map();
  store.kwYearCount = new Map();

  for (const r of store.allReports) {
    const toks = tokenizeKoreanTitle(r.title, { stopwords: stopwordsSet });
    store.tokensById.set(r.id, toks);
    store.tokenSetById.set(r.id, new Set(uniq(toks)));

    const set = store.tokenSetById.get(r.id);
    for (const kw of set) {
      store.kwCount.set(kw, (store.kwCount.get(kw) || 0) + 1);
      if (!store.kwYearCount.has(kw)) store.kwYearCount.set(kw, new Map());
      const m = store.kwYearCount.get(kw);
      m.set(r.year, (m.get(r.year) || 0) + 1);
    }
  }

  if (store.cache && typeof store.cache.flushAll === 'function') store.cache.flushAll();
  return { ok: true, size: stopwordsSet.size };
}
