import { uniq } from './utils/tokenize.js';

function topNFromMap(map, n) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, value]) => ({ key, value }));
}

function normalizeScope(scope) {
  if (scope === 'local' || scope === 'national' || scope === 'all') return scope;
  return 'all';
}

function normalizeFilters({ scope = 'all', q = '', year, institute } = {}) {
  const s = normalizeScope(scope);
  const needle = String(q || '').trim().toLowerCase();
  const inst = String(institute || '').trim();

  let y;
  if (year !== undefined && year !== null && String(year).trim() !== '') {
    const n = Number(year);
    if (Number.isFinite(n)) y = Math.trunc(n);
  }

  return { scope: s, q: needle, year: y, institute: inst };
}

function selectReportsByScope(store, scope = 'all') {
  const s = normalizeScope(scope);
  if (s === 'local') return store.allReports.filter(r => r.scope === 'local');
  if (s === 'national') return store.allReports.filter(r => r.scope === 'national');
  return store.allReports;
}

function applyInstituteFilter(store, rows, institute) {
  const inst = String(institute || '').trim();
  if (!inst) return rows;

  // Special handling for national council-style filters used in the UI.
  // - NRC: nrc group
  // - NCT (user-facing label): nst group (data file uses "nst")
  const upper = inst.toUpperCase();
  const group = (upper === 'NRC') ? 'nrc' : (upper === 'NCT' || upper === 'NST') ? 'nst' : null;
  if (group) {
    return rows.filter(r => r.scope === 'national' && store.nationalGroupByInstitute?.get(r.institute) === group);
  }

  return rows.filter(r => r.institute === inst);
}

function applyNeedleFilter(store, rows, needle) {
  const n = String(needle || '').trim().toLowerCase();
  if (!n) return rows;
  return rows.filter(r => {
    const t = String(r.title || '').toLowerCase();
    if (t.includes(n)) return true;
    const toks = store.tokensById.get(r.id) || [];
    return toks.some(tok => tok.includes(n));
  });
}

function filterReports(store, filters) {
  const f = normalizeFilters(filters);
  let rows = selectReportsByScope(store, f.scope);
  if (f.year !== undefined) rows = rows.filter(r => r.year === f.year);
  if (f.institute) rows = applyInstituteFilter(store, rows, f.institute);
  if (f.q) rows = applyNeedleFilter(store, rows, f.q);
  return { filters: f, rows };
}

function cacheKeyForFilters(prefix, filters, extra = '') {
  const instKey = filters.institute ? filters.institute.toUpperCase() : '';
  const qKey = filters.q ? filters.q.slice(0, 80) : '';
  const yKey = (filters.year !== undefined) ? String(filters.year) : '';
  return `${prefix}:${filters.scope}:y=${yKey}:i=${encodeURIComponent(instKey)}:q=${encodeURIComponent(qKey)}${extra}`;
}

function getAgg(store, filters) {
  const f = normalizeFilters(filters);
  const cacheKey = cacheKeyForFilters('agg', f);
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const { rows: reports } = filterReports(store, f);

  const reportsPerYear = new Map();
  const reportsPerInstitute = new Map();
  const kwCount = new Map();
  const kwYearCount = new Map(); // kw -> Map(year -> count)

  for (const r of reports) {
    reportsPerYear.set(r.year, (reportsPerYear.get(r.year) || 0) + 1);
    reportsPerInstitute.set(r.institute, (reportsPerInstitute.get(r.institute) || 0) + 1);

    const set = store.tokenSetById.get(r.id) || new Set();
    for (const kw of set) {
      kwCount.set(kw, (kwCount.get(kw) || 0) + 1);
      if (!kwYearCount.has(kw)) kwYearCount.set(kw, new Map());
      const m = kwYearCount.get(kw);
      m.set(r.year, (m.get(r.year) || 0) + 1);
    }
  }

  // If a year is explicitly filtered, most visuals are more readable with a single-year axis.
  const years = (f.year !== undefined) ? [f.year] : store.years;

  const result = {
    filters: f,
    reports,
    years,
    reportsPerYear,
    reportsPerInstitute,
    kwCount,
    kwYearCount,
  };
  store.cache.set(cacheKey, result);
  return result;
}

export function getKeywordStats(store, { top = 200, scope = 'all', year, institute, q } = {}) {
  const t = Math.max(1, Math.min(5000, Number(top) || 200));
  const f = normalizeFilters({ scope, year, institute, q });

  const cacheKey = cacheKeyForFilters('kwStats', f, `:top=${t}`);
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const agg = getAgg(store, f);

  const result = {
    scope: f.scope,
    filters: f,
    topKeywords: topNFromMap(agg.kwCount, t),
    years: agg.years,
    reportsPerYear: agg.years.map(y => ({ year: y, count: agg.reportsPerYear.get(y) || 0 })),
    reportsPerInstitute: Array.from(agg.reportsPerInstitute.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([instituteName, count]) => ({ institute: instituteName, count })),
  };

  store.cache.set(cacheKey, result);
  return result;
}

export function getKeywordSeries(store, keyword, { scope = 'all', year, institute, q } = {}) {
  const kwRaw = String(keyword || '').trim();
  if (!kwRaw) return { keyword: '', data: [] };

  // Robust keyword normalization: handle whitespace/punctuation variants.
  const normalizeKey = (s) => String(s || '')
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[\(\)\[\]\{\}<>\"'`]/g, ' ')
    .replace(/[\.,;:!?·…]/g, ' ')
    .replace(/[\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[_\-]/g, '');

  const kwLower = kwRaw.toLowerCase();
  const kwNorm = normalizeKey(kwRaw);

  const f = normalizeFilters({ scope, year, institute, q });
  const cacheKey = cacheKeyForFilters('kwSeries', f, `:kw=${encodeURIComponent(kwNorm || kwLower)}`);
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const agg = getAgg(store, f);

  // Try direct hits first
  let resolved = '';
  let m = agg.kwYearCount.get(kwRaw) || agg.kwYearCount.get(kwLower) || null;
  if (m) {
    resolved = agg.kwYearCount.has(kwRaw) ? kwRaw : kwLower;
  } else {
    // Fuzzy/normalized match (handles cases like '발전 방향' vs '발전방향', hyphens, etc.)
    for (const k of agg.kwYearCount.keys()) {
      if (normalizeKey(k) === kwNorm) {
        resolved = k;
        m = agg.kwYearCount.get(k);
        break;
      }
    }
  }
  if (!m) m = new Map();

  const result = {
    keyword: kwRaw,
    resolvedKeyword: resolved,
    data: agg.years.map(y => ({ year: y, count: m.get(y) || 0 })),
  };

  store.cache.set(cacheKey, result);
  return result;
}

export function getTop5KeywordTrends(store, { scope = 'all', year, institute, q } = {}) {
  const f = normalizeFilters({ scope, year, institute, q });
  const cacheKey = cacheKeyForFilters('top5Trends', f);
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const agg = getAgg(store, f);
  const top5 = Array.from(agg.kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kw]) => kw);

  const series = top5.map(kw => {
    const m = agg.kwYearCount.get(kw) || new Map();
    return {
      keyword: kw,
      data: agg.years.map(y => ({ year: y, count: m.get(y) || 0 })),
    };
  });

  const result = { scope: f.scope, filters: f, top5, series };
  store.cache.set(cacheKey, result);
  return result;
}

export function getRisingKeywords(store, { top = 20, scope = 'all', year, institute, q } = {}) {
  const t = Math.max(1, Math.min(200, Number(top) || 20));
  const f = normalizeFilters({ scope, year, institute, q });

  const cacheKey = cacheKeyForFilters('rising', f, `:top=${t}`);
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const agg = getAgg(store, f);
  const years = agg.years;
  if (years.length < 2) return { baseYear: years[0] || null, compareYear: null, items: [] };

  const y2 = years[years.length - 1];
  const y1 = years[years.length - 2];

  const items = [];
  for (const [kw, m] of agg.kwYearCount.entries()) {
    const c2 = m.get(y2) || 0;
    const c1 = m.get(y1) || 0;
    if (c2 < 3) continue;
    const growth = (c2 + 1) / (c1 + 1);
    items.push({ keyword: kw, baseYear: y1, baseCount: c1, compareYear: y2, compareCount: c2, growth });
  }

  items.sort((a, b) => b.growth - a.growth);
  const result = { scope: f.scope, filters: f, baseYear: y1, compareYear: y2, items: items.slice(0, t) };
  store.cache.set(cacheKey, result);
  return result;
}

export function getWordCloud(store, { top = 50, scope = 'all', year, institute, q } = {}) {
  const t = Math.max(1, Math.min(500, Number(top) || 50));
  const f = normalizeFilters({ scope, year, institute, q });
  const agg = getAgg(store, f);
  return { scope: f.scope, filters: f, items: topNFromMap(agg.kwCount, t).map(d => ({ text: d.key, value: d.value })) };
}

// Simple burst scoring: z-score of last year vs mean+std of prior years
export function getBurstKeywords(store, { top = 20, scope = 'all', year, institute, q } = {}) {
  const t = Math.max(1, Math.min(200, Number(top) || 20));
  const f = normalizeFilters({ scope, year, institute, q });

  const cacheKey = cacheKeyForFilters('burst', f, `:top=${t}`);
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const agg = getAgg(store, f);
  const years = agg.years;
  const last = years[years.length - 1];
  const priorYears = years.slice(0, -1);

  const scored = [];
  for (const [kw, m] of agg.kwYearCount.entries()) {
    const lastVal = m.get(last) || 0;
    if (lastVal < 3) continue;
    const arr = priorYears.map(y => m.get(y) || 0);
    const mean = arr.reduce((sum, v) => sum + v, 0) / Math.max(1, arr.length);
    const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, arr.length);
    const std = Math.sqrt(variance) || 1;
    const z = (lastVal - mean) / std;
    if (z > 2) scored.push({ keyword: kw, year: last, z, lastVal, mean });
  }

  scored.sort((a, b) => b.z - a.z);
  const result = { scope: f.scope, filters: f, year: last, items: scored.slice(0, t) };
  store.cache.set(cacheKey, result);
  return result;
}

export function searchReports(store, { q = '', scope = 'all', year, institute, limit = 50, offset = 0 } = {}) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);

  const { rows } = filterReports(store, { q, scope, year, institute });

  const total = rows.length;
  const page = rows.slice(off, off + lim).map(r => ({
    id: r.id,
    year: r.year,
    title: r.title,
    authors: r.authors,
    institute: r.institute,
    url: r.url,
    scope: r.scope,
  }));

  return { total, limit: lim, offset: off, items: page };
}

export function buildCooccurrenceNetwork(store, { topKeywords = 120, edgeTop = 400, scope = 'all', year, institute, q } = {}) {
  const tkw = Math.max(10, Math.min(1000, Number(topKeywords) || 120));
  const et = Math.max(10, Math.min(5000, Number(edgeTop) || 400));
  const f = normalizeFilters({ scope, year, institute, q });

  const cacheKey = cacheKeyForFilters('net', f, `:tkw=${tkw}:et=${et}`);
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const agg = getAgg(store, f);
  const top = Array.from(agg.kwCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, tkw).map(([kw]) => kw);
  const topSet = new Set(top);

  const edgeMap = new Map();
  for (const r of agg.reports) {
    const kws = Array.from(store.tokenSetById.get(r.id) || []).filter(k => topSet.has(k));
    if (kws.length < 2) continue;
    const u = uniq(kws);
    for (let i = 0; i < u.length; i++) {
      for (let j = i + 1; j < u.length; j++) {
        const a = u[i];
        const b = u[j];
        const key = a < b ? `${a}||${b}` : `${b}||${a}`;
        edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      }
    }
  }

  const edges = Array.from(edgeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, et)
    .map(([k, w]) => {
      const [source, target] = k.split('||');
      return { source, target, weight: w };
    });

  const nodes = top.map(k => ({ id: k, size: agg.kwCount.get(k) || 1 }));

  const result = { scope: f.scope, filters: f, nodes, edges };
  store.cache.set(cacheKey, result);
  return result;
}

export function instituteKeywordHeatmap(store, { topKeywords = 30, scope = 'all', year, institute, q } = {}) {
  const tkw = Math.max(5, Math.min(200, Number(topKeywords) || 30));
  const f = normalizeFilters({ scope, year, institute, q });

  const cacheKey = cacheKeyForFilters('heat', f, `:tkw=${tkw}`);
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const agg = getAgg(store, f);
  const keywords = Array.from(agg.kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, tkw)
    .map(([kw]) => kw);
  const kwSet = new Set(keywords);

  const matrix = new Map();
  for (const r of agg.reports) {
    if (!matrix.has(r.institute)) matrix.set(r.institute, new Map());
    const m = matrix.get(r.institute);
    for (const kw of store.tokenSetById.get(r.id) || []) {
      if (!kwSet.has(kw)) continue;
      m.set(kw, (m.get(kw) || 0) + 1);
    }
  }

  const out = [];
  for (const instName of Array.from(matrix.keys()).sort()) {
    const total = agg.reportsPerInstitute.get(instName) || 1;
    const m = matrix.get(instName);
    const row = { institute: instName };
    for (const kw of keywords) {
      row[kw] = (m.get(kw) || 0) / total;
    }
    out.push(row);
  }

  const result = { scope: f.scope, filters: f, keywords, rows: out };
  store.cache.set(cacheKey, result);
  return result;
}

export function relatedReportsByKeyword(store, { keyword, year, limit = 50, scope = 'all', institute, q } = {}) {
  const kw = String(keyword || '').trim().toLowerCase();
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  if (!kw) return { keyword: '', items: [] };

  const { rows } = filterReports(store, { scope, year, institute, q });

  const items = [];
  for (const r of rows) {
    const set = store.tokenSetById.get(r.id);
    if (set && set.has(kw)) {
      items.push({ year: r.year, institute: r.institute, title: r.title, url: r.url, scope: r.scope, id: r.id });
    }
  }

  items.sort((a, b) => b.year - a.year);
  return { keyword: kw, items: items.slice(0, lim) };
}
