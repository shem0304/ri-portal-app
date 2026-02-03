import { uniq, tokenizeKoreanTitle } from './utils/tokenize.js';

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

// -----------------------------
// Researchers (derived from reports: authors)
// High-signal matching: expertise profiling (TF-IDF), recency, productivity, collaboration, and explainability.
// -----------------------------
function normalizeAuthors(a) {
  if (!a) return [];
  let arr = [];
  if (Array.isArray(a)) arr = a.map(x => String(x || '').trim()).filter(Boolean);
  else {
    const s = String(a || '').trim();
    if (!s) return [];
    arr = s.split(/[;,/|\n]+/g).map(x => String(x || '').trim()).filter(Boolean);
  }
  // De-duplicate within a report to avoid double-counting (case-insensitive)
  const seen = new Set();
  const out = [];
  for (const name of arr) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function tokenizeQuery(store, q) {
  const raw = String(q || '').trim();
  if (!raw) return [];
  // Reuse the same tokenizer/stopwords as trend features so the vocabulary is consistent.
  const toks = tokenizeKoreanTitle(raw, { stopwords: store.stopwordsSet });
  return uniq(toks);
}

function buildCooccurrenceForScope(store, scope = 'all', topKeywords = 2000) {
  const s = normalizeScope(scope);
  const cacheKey = `researchersCooc:${s}:top=${topKeywords}`;
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  // Limit to the most frequent keywords to keep this lightweight.
  const top = Array.from(store.kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topKeywords)
    .map(([kw]) => kw);
  const topSet = new Set(top);

  const cooc = new Map(); // kw -> Map(other -> count)
  const rows = selectReportsByScope(store, s);
  for (const r of rows) {
    const kws = Array.from(store.tokenSetById.get(r.id) || []).filter(k => topSet.has(k));
    if (kws.length < 2) continue;
    const u = uniq(kws);
    for (let i = 0; i < u.length; i++) {
      const a = u[i];
      if (!cooc.has(a)) cooc.set(a, new Map());
      const m = cooc.get(a);
      for (let j = 0; j < u.length; j++) {
        if (i === j) continue;
        const b = u[j];
        m.set(b, (m.get(b) || 0) + 1);
      }
    }
  }

  store.cache.set(cacheKey, { cooc, topSet });
  return { cooc, topSet };
}

function expandQueryTokens(store, scope, tokens, maxExpand = 6) {
  if (!tokens.length) return { expanded: [], expansions: [] };
  const { cooc } = buildCooccurrenceForScope(store, scope);
  const expansions = [];
  const expandedSet = new Set(tokens);

  for (const t of tokens) {
    const m = cooc.get(t);
    if (!m) continue;
    const add = Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k)
      .filter(k => !expandedSet.has(k));

    for (const k of add) {
      if (expandedSet.size >= tokens.length + maxExpand) break;
      expandedSet.add(k);
      expansions.push({ from: t, to: k });
    }
    if (expandedSet.size >= tokens.length + maxExpand) break;
  }

  const expanded = Array.from(expandedSet.values());
  return { expanded, expansions };
}

function computeIdfFromResearchers(researchers) {
  const df = new Map();
  for (const r of researchers) {
    for (const [kw] of (r.__kwCounts || new Map()).entries()) {
      df.set(kw, (df.get(kw) || 0) + 1);
    }
  }
  const N = Math.max(1, researchers.length);
  const idf = new Map();
  for (const [kw, d] of df.entries()) {
    // Smooth IDF: always > 0
    const val = Math.log((N + 1) / (d + 1)) + 1;
    idf.set(kw, val);
  }
  return { idf, df, N };
}

function buildTfIdfVector(kwCounts, idf, topK = 220) {
  const w = [];
  for (const [kw, tf] of kwCounts.entries()) {
    const idfVal = idf.get(kw) || 0;
    if (!idfVal) continue;
    const tfVal = 1 + Math.log(1 + tf);
    const weight = tfVal * idfVal;
    w.push([kw, weight]);
  }
  w.sort((a, b) => b[1] - a[1]);
  const kept = w.slice(0, topK);

  let norm2 = 0;
  const vec = new Map();
  for (const [kw, weight] of kept) {
    vec.set(kw, weight);
    norm2 += weight * weight;
  }
  const norm = Math.sqrt(norm2) || 1;
  return { vec, norm, top: kept.map(([kw]) => kw) };
}

function cosineSimilarity(aVec, aNorm, bVec, bNorm) {
  if (!aVec || !bVec) return 0;
  let dot = 0;
  // Iterate smaller map for speed
  const [small, big] = (aVec.size <= bVec.size) ? [aVec, bVec] : [bVec, aVec];
  for (const [k, w] of small.entries()) {
    const v = big.get(k);
    if (v) dot += w * v;
  }
  const denom = (aNorm || 1) * (bNorm || 1);
  return denom ? (dot / denom) : 0;
}

function focusScoreFromCounts(kwCounts) {
  // 0..1 : 1 means "focused"; 0 means "very diffuse"
  const items = Array.from(kwCounts.values());
  const sum = items.reduce((a, b) => a + b, 0) || 1;
  const probs = items.map(v => v / sum).filter(v => v > 0);
  const H = -probs.reduce((acc, p) => acc + p * Math.log(p), 0);
  const Hmax = Math.log(Math.max(1, probs.length));
  if (!Hmax) return 0.5;
  const normH = H / Hmax; // 0..1
  return 1 - normH;
}

function buildResearcherModel(store, scope = 'all') {
  const s = normalizeScope(scope);
  const cacheKey = `researchersModel:${s}:byInstitute`;
  const cached = store.cache.get(cacheKey);
  if (cached) return cached;

  const rows = selectReportsByScope(store, s);

  // Collaboration signal is still computed at the "person(name)" level so it works across institutes.
  const collaborators = new Map(); // nameKey -> Set(nameKey)

  // Key idea: build *profiles* per (name, institute) so same-name researchers in different institutes
  // appear as distinct candidates with their own report counts/titles.
  const byProfile = new Map(); // profileKey -> obj

  for (const r of rows) {
    const authors = normalizeAuthors(r.authors || r.author || r.writers || r.writer);
    if (!authors.length) continue;

    // Co-author network (name-level)
    const authorKeys = authors
      .map(a => String(a || '').trim())
      .filter(Boolean)
      .map(a => a.toLowerCase());
    for (let i = 0; i < authorKeys.length; i++) {
      for (let j = 0; j < authorKeys.length; j++) {
        if (i === j) continue;
        const a = authorKeys[i];
        const b = authorKeys[j];
        if (!collaborators.has(a)) collaborators.set(a, new Set());
        collaborators.get(a).add(b);
      }
    }

    const inst = String(r.institute || '').trim() || '-';
    const group = (r.scope === 'national') ? (store.nationalGroupByInstitute?.get(inst) || '') : '';
    const toks = Array.from(store.tokenSetById.get(r.id) || []);

    for (const nameRaw of authors) {
      const name = String(nameRaw || '').trim();
      if (!name) continue;

      const nameKey = name.toLowerCase();
      const profileKey = `${nameKey}||${inst}`;

      let o = byProfile.get(profileKey);
      if (!o) {
        o = {
          id: profileKey,
          name,
          nameKey,
          institute: inst,
          groups: new Set(),
          scopes: new Set(),
          reportCount: 0,
          __reportIds: new Set(),
          lastActiveYear: null,
          __kwCounts: new Map(),
          __recentReports: [],
          __coauthorDegree: 0,
        };
        byProfile.set(profileKey, o);
      }

      if (group) o.groups.add(group);
      o.scopes.add(r.scope || 'all');
      // Count each report at most once per researcher-profile (avoid duplicates & duplicate author listings)
      if (!o.__reportIds.has(r.id)) {
        o.__reportIds.add(r.id);
        o.reportCount += 1;
        if (r.year && (!o.lastActiveYear || r.year > o.lastActiveYear)) o.lastActiveYear = r.year;

        for (const t of toks) o.__kwCounts.set(t, (o.__kwCounts.get(t) || 0) + 1);

        o.__recentReports.push({
          id: r.id,
          year: r.year,
          title: r.title,
          url: r.url,
          institute: inst,
          scope: r.scope,
        });
      }
    }
  }

  // Convert to list + attach collaboration degree (name-level)
  const rawResearchers = [];
  for (const o of byProfile.values()) {
    o.__recentReports.sort((a, b) => (b.year || 0) - (a.year || 0));
    const recentReports = o.__recentReports.slice(0, 5);

    const scopeLabel = (o.scopes.size === 1) ? Array.from(o.scopes)[0] : 'all';
    const collabSet = collaborators.get(o.nameKey) || new Set();
    const coauthorDegree = collabSet.size;

    rawResearchers.push({
      id: o.id,
      name: o.name,
      institute: o.institute,
      groups: Array.from(o.groups.values()),
      scope: scopeLabel,
      reportCount: o.reportCount,
      lastActiveYear: o.lastActiveYear,
      recentReports,
      __kwCounts: o.__kwCounts,
      __coauthorDegree: coauthorDegree,
      __focus: focusScoreFromCounts(o.__kwCounts),
    });
  }

  // TF-IDF model over profiles
  const { idf, N } = computeIdfFromResearchers(rawResearchers);

  const researchers = rawResearchers.map(r => {
    const { vec, norm, top } = buildTfIdfVector(r.__kwCounts, idf, 240);
    const keywords = top.slice(0, 16);

    const searchText = `${r.name} ${r.institute} ${keywords.join(' ')} ${r.recentReports.slice(0, 5).map(x => x.title).join(' ')}`.toLowerCase();
    return {
      ...r,
      keywords,
      __vec: vec,
      __norm: norm,
      __searchText: searchText,
    };
  });

  const model = { scope: s, N, idf, researchers };
  store.cache.set(cacheKey, model);
  return model;
}

function buildQueryVector(tokens, idf) {(tokens, idf) {
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  const vec = new Map();
  let norm2 = 0;
  for (const [t, tf] of counts.entries()) {
    const idfVal = idf.get(t) || 0;
    if (!idfVal) continue;
    const w = (1 + Math.log(1 + tf)) * idfVal;
    vec.set(t, w);
    norm2 += w * w;
  }
  const norm = Math.sqrt(norm2) || 1;
  return { vec, norm };
}


function getInstituteUrlByNameMap(store) {
  if (store.__instUrlByName && store.__instUrlByName instanceof Map) return store.__instUrlByName;
  const m = new Map();

  const add = (name, url) => {
    const n = String(name || '').trim();
    const u = String(url || '').trim();
    if (!n || !u) return;
    m.set(n, u);
    m.set(n.replace(/\s+/g, ''), u);
  };

  try {
    for (const it of (store.localInstitutes || [])) add(it?.name, it?.url);
    for (const it of (store.nationalInstitutes || [])) add(it?.name, it?.url);

    const raw = store.nationalInstitutesRaw;
    if (raw && typeof raw === 'object') {
      for (const k of Object.keys(raw)) {
        if (Array.isArray(raw[k])) for (const it of raw[k]) add(it?.name, it?.url);
      }
    }
  } catch (e) {
    // ignore
  }

  store.__instUrlByName = m;
  return m;
}


function normalize0to1(x, lo, hi) {
  if (hi <= lo) return 0;
  const v = (x - lo) / (hi - lo);
  return Math.max(0, Math.min(1, v));
}

export function searchResearchers(store, { q = '', scope = 'all', institute, sort = 'relevance', limit = 24, offset = 0 } = {}) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 24));
  const off = Math.max(0, Number(offset) || 0);
  const s = normalizeScope(scope);
  const inst = String(institute || '').trim();

  const model = buildResearcherModel(store, s);
  let rows = model.researchers;

  // Facets (scope-level)
  const instCounts = new Map();
  for (const it of rows) {
    const n = String(it.institute || '').trim();
    if (!n) continue;
    instCounts.set(n, (instCounts.get(n) || 0) + 1);
  }
  const facets = {
    institutes: Array.from(instCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 400),
  };

  // Institute filter
  if (inst) {
    const upper = inst.toUpperCase();
    const group = (upper === 'NRC') ? 'nrc' : (upper === 'NCT' || upper === 'NST') ? 'nst' : null;
    if (group) rows = rows.filter(r => (r.groups || []).includes(group));
    else rows = rows.filter(r => r.institute === inst);
  }


  const instUrlByName = getInstituteUrlByNameMap(store);

  // Attach institute homepage url (if available) for hyperlinking in UI.
  rows = rows.map((r) => {
    const name = String(r.institute || '').trim();
    return {
      ...r,
      instituteUrl: name ? (instUrlByName.get(name) || instUrlByName.get(name.replace(/\s+/g, '')) || '') : '',
    };
  });

  // Query analysis (supports sentence-style input)
  const qRaw = String(q || '').trim();
  const needle = qRaw.toLowerCase();
  const baseTokens = tokenizeQuery(store, qRaw);

  const { expanded: expandedTokens, expansions } = expandQueryTokens(store, s, baseTokens, 6);
  const { vec: qVec, norm: qNorm } = buildQueryVector(expandedTokens, model.idf);

  // If user typed a name, keep strong exact/partial boosts.
  const nameNeedle = needle.replace(/\s+/g, '');

  const tokensForCoverage = baseTokens.length ? baseTokens : expandedTokens;

  const scored = rows.map(r => {
    const nameLower = String(r.name || '').toLowerCase();
    const nameCompact = nameLower.replace(/\s+/g, '');
    const sim = cosineSimilarity(qVec, qNorm, r.__vec, r.__norm); // 0..1-ish

    // Coverage: how many user-intent tokens appear in the researcher's top keywords
    const kwSet = new Set((r.keywords || []).map(k => String(k).toLowerCase()));
    let covered = 0;
    for (const t of tokensForCoverage) if (kwSet.has(String(t).toLowerCase())) covered += 1;
    const coverage = tokensForCoverage.length ? (covered / tokensForCoverage.length) : 0;

    // Signals
    const productivity = Math.log(1 + (r.reportCount ?? 0)); // ~0..?
    const recency = r.lastActiveYear ? (r.lastActiveYear - 2000) : 0;
    const collab = Math.log(1 + (r.__coauthorDegree || 0));
    const focus = r.__focus ?? 0.5;

    // Name matching boosts
    let nameBoost = 0;
    if (nameNeedle && nameCompact === nameNeedle) nameBoost = 3.0;
    else if (nameNeedle && nameCompact.includes(nameNeedle)) nameBoost = 1.6;

    // Relevance score (hybrid, explainable)
    // - sim: strongest (semantic expertise match)
    // - coverage: "query terms reflected in expertise profile"
    // - productivity/recency/collab/focus: quality signals
    const score =
      (sim * 7.0) +
      (coverage * 2.0) +
      (productivity * 0.55) +
      (recency * 0.03) +
      (collab * 0.25) +
      (focus * 0.35) +
      nameBoost;

    // Matched keywords for explanation
    const matched = [];
    if (expandedTokens.length) {
      for (const t of expandedTokens) {
        const w = r.__vec.get(t);
        if (w) matched.push([t, w]);
      }
      matched.sort((a, b) => b[1] - a[1]);
    }

    const reasons = [];
    if (nameBoost >= 1.6) reasons.push('이름 매칭');
    if (sim >= 0.25) reasons.push('전문분야 유사도 높음');
    if (coverage >= 0.5 && tokensForCoverage.length) reasons.push('질의 키워드 커버리지 높음');
    if (((r.reportCount ?? 0)) >= 5) reasons.push('성과(보고서) 다수');
    if (r.lastActiveYear && r.lastActiveYear >= 2022) reasons.push('최근 활동');

    // Confidence: 0..1 (relative)
    // Calibrate to typical similarity ranges; keep conservative.
    const conf = Math.max(
      normalize0to1(sim, 0.05, 0.55) * 0.65 + normalize0to1(coverage, 0.1, 0.8) * 0.25 + normalize0to1(productivity, 0.5, 2.5) * 0.10,
      0
    );

    return {
      ...r,
      __score: score,
      __sim: sim,
      __coverage: coverage,
      __confidence: Math.max(0, Math.min(1, conf)),
      __matchedKeywords: matched.slice(0, 6).map(([k]) => k),
      __reasons: reasons,
    };
  });

  // Sorting modes
  // - match: AI 매칭(신뢰도/유사도) 높은 순
  // - recent: 최근 활동 우선
  // - outputs: 성과(보고서 수) 우선
  // - relevance: 혼합 점수(__score) 우선
  const mode = String(sort || 'relevance');
  if (mode === 'match' || mode === 'ai') {
    scored.sort((a, b) =>
      (b.__confidence || 0) - (a.__confidence || 0) ||
      (b.__sim || 0) - (a.__sim || 0) ||
      (b.__score || 0) - (a.__score || 0) ||
      (b.lastActiveYear || 0) - (a.lastActiveYear || 0) ||
      a.name.localeCompare(b.name)
    );
  } else if (mode === 'recent') {
    scored.sort((a, b) => (b.lastActiveYear || 0) - (a.lastActiveYear || 0) || (b.reportCount || 0) - (a.reportCount || 0) || a.name.localeCompare(b.name));
  } else if (mode === 'outputs') {
    scored.sort((a, b) => (b.reportCount || 0) - (a.reportCount || 0) || (b.lastActiveYear || 0) - (a.lastActiveYear || 0) || a.name.localeCompare(b.name));
  } else {
    scored.sort((a, b) => (b.__score || 0) - (a.__score || 0) || (b.lastActiveYear || 0) - (a.lastActiveYear || 0) || a.name.localeCompare(b.name));
  }

  const total = scored.length;

  // For UI: provide suggested keywords (query expansion "to" terms)
  const suggestedKeywords = Array.from(new Set(expansions.map(x => x.to))).slice(0, 8);

  const items = scored.slice(off, off + lim).map(r => ({
    id: r.id,
    name: r.name,
    institute: {
      name: r.institute || '',
      url: r.instituteUrl || '',
    },
    instituteName: r.institute || '',
    reportCount: r.reportCount || 0,
    lastActiveYear: r.lastActiveYear,
    scope: r.scope,
    keywords: r.keywords,
    recentReports: r.recentReports,
    match: {
      similarity: Number((r.__sim || 0).toFixed(4)),
      coverage: Number((r.__coverage || 0).toFixed(4)),
      confidence: Number((r.__confidence || 0).toFixed(4)),
      matchedKeywords: r.__matchedKeywords || [],
      reasons: r.__reasons || [],
    },
  }));

  return {
    total,
    limit: lim,
    offset: off,
    items,
    facets,
    queryAnalysis: {
      raw: qRaw,
      tokens: baseTokens,
      expandedTokens,
      suggestedKeywords,
    },
  };
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
