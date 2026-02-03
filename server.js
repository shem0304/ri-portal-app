import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createChatRouter } from "./server/chatRoutes.js";

// Resolve paths reliably on Render (working directory can vary)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from an env file for portability.
// - Default: "<project>/.env" (same folder as server.js)
// - Override: ENV_FILE=/absolute/path/to/.env
const ENV_FILE_PATH = process.env.ENV_FILE || path.join(__dirname, ".env");
const envResult = dotenv.config({ path: ENV_FILE_PATH });
if (envResult?.error) {
  console.warn(`[env] No .env loaded from ${ENV_FILE_PATH} (${envResult.error.message}); using process.env only`);
} else {
  console.log(`[env] Loaded environment from ${ENV_FILE_PATH}`);
}


const app = express();

// -----------------------------
// Config
// -----------------------------
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const CLIENT_DIST = path.resolve(__dirname, "client", "dist");

// -----------------------------
// Persistent data directory
// -----------------------------
// NOTE: In container platforms (e.g., Render free instances), the filesystem may be ephemeral.
// Set DATA_DIR (or SERVER_DATA_DIR / PERSIST_DIR) to a mounted persistent volume to keep admin changes across restarts.
function ensureWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const testPath = path.join(dir, ".write_test");
    fs.writeFileSync(testPath, "ok");
    fs.unlinkSync(testPath);
    return true;
  } catch {
    return false;
  }
}

const DATA_DIR_CANDIDATES = [
  process.env.DATA_DIR,
  process.env.SERVER_DATA_DIR,
  process.env.PERSIST_DIR,
  // Render Persistent Disk common mount (only works if you configured a disk)
  "/var/data/ri-portal-app",
  path.resolve(__dirname, "server", "data"),
  path.join(os.homedir(), ".ri-portal-app", "data"),
].filter(Boolean);

const DATA_DIR = DATA_DIR_CANDIDATES.find((d) => ensureWritableDir(d)) || path.resolve(__dirname, "server", "data");



// -----------------------------
// National institutes API endpoints (hardcoded fallback)
// NOTE: Replace the placeholder URLs below with your real API endpoints.
// You can still override these via Render Environment variables NRC_API_URL / NCT_API_URL if you later choose.
// -----------------------------
const NRC_API_URL = "";
const NCT_API_URL = "";
// -----------------------------
// Middleware
// -----------------------------
app.use(compression({
  filter: (req, res) => {
    if (req.path === "/api/stopwords/stream") return false;
    return compression.filter(req, res);
  },
}));
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

// -----------------------------
// Data loaders / caches
// -----------------------------
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

const cache = new Map();
const cacheGet = (key) => cache.get(key);
const cacheSet = (key, value) => {
  // Simple cap to avoid runaway memory
  if (cache.size > 100) cache.clear();
  cache.set(key, value);
  return value;
};

// Reports are large; load once.
const LOCAL_REPORTS_PATH = path.join(DATA_DIR, "local_reports.json");
const NATIONAL_REPORTS_PATH = path.join(DATA_DIR, "national_reports.json");
const LOCAL_REPORTS = fs.existsSync(LOCAL_REPORTS_PATH)
  ? readJson(LOCAL_REPORTS_PATH).map((r) => ({ ...r, __scope: 'local' }))
  : [];
const NATIONAL_REPORTS = fs.existsSync(NATIONAL_REPORTS_PATH)
  ? readJson(NATIONAL_REPORTS_PATH).map((r) => ({ ...r, __scope: 'national' }))
  : [];

// Institutes (for external homepage links)
const LOCAL_INSTITUTES_PATH = path.join(DATA_DIR, "local_institutes.json");
const NATIONAL_INSTITUTES_PATH = path.join(DATA_DIR, "national_institutes.json");
const LOCAL_INSTITUTES = fs.existsSync(LOCAL_INSTITUTES_PATH) ? readJson(LOCAL_INSTITUTES_PATH) : [];

function flattenNationalInstitutes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const items = [];
  for (const k of Object.keys(raw)) {
    if (k === 'updated_at' || k === 'sources') continue;
    const v = raw[k];
    if (Array.isArray(v)) items.push(...v);
  }
  return items;
}

const NATIONAL_INSTITUTES_RAW = fs.existsSync(NATIONAL_INSTITUTES_PATH) ? readJson(NATIONAL_INSTITUTES_PATH) : null;
const NATIONAL_INSTITUTES = flattenNationalInstitutes(NATIONAL_INSTITUTES_RAW);

const INSTITUTE_URL_MAP = new Map(
  [...LOCAL_INSTITUTES, ...NATIONAL_INSTITUTES]
    .filter((x) => x && x.name)
    .map((x) => [String(x.name).trim(), x.url || null])
);

function getReportsByScope(scope) {
  if (scope === "local") return LOCAL_REPORTS;
  if (scope === "national") return NATIONAL_REPORTS;
  return LOCAL_REPORTS.concat(NATIONAL_REPORTS);
}

// -----------------------------
// Helpers
// -----------------------------

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const https = require("https");
const http = require("http");
const { URL } = require("url");
function httpGetText(url, { timeoutMs = 12000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? http : https;

    const req = lib.request(
      {
        method: "GET",
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: u.pathname + (u.search || ""),
        servername: u.hostname, // SNI
        headers: {
          "User-Agent": "ri-portal-app/1.0 (+https://onrender.com)",
          "Accept": "application/rss+xml, application/xml;q=0.9, text/html;q=0.8, */*;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          ...headers,
        },
      },
      (res) => {
        // handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          return resolve(httpGetText(next, { timeoutMs, headers }));
        }

        const chunks = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          const raw = Buffer.concat(chunks);
          const enc = String(res.headers["content-encoding"] || "").toLowerCase().trim();

          const finish = (buf) => {
            try {
              const text = buf.toString("utf8");
              if (res.statusCode >= 200 && res.statusCode < 300) return resolve(text);
              return reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage} :: ${text.slice(0, 200)}`));
            } catch (e) {
              return reject(e);
            }
          };

          try {
            if (enc === "gzip") {
              const zlib = require("zlib");
              return zlib.gunzip(raw, (err, out) => (err ? reject(err) : finish(out)));
            }
            if (enc === "deflate") {
              const zlib = require("zlib");
              return zlib.inflate(raw, (err, out) => (err ? reject(err) : finish(out)));
            }
            if (enc === "br") {
              const zlib = require("zlib");
              return zlib.brotliDecompress(raw, (err, out) => (err ? reject(err) : finish(out)));
            }
            return finish(raw);
          } catch (e) {
            return reject(e);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Request timeout"));
    });
    req.end();
  });
}

async function fetchJson(url, { headers = {}, timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} :: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}


async function fetchText(url, { headers = {}, timeoutMs = 12000 } = {}) {
  return await httpGetText(url, { headers, timeoutMs });
}


const _koreaCache = {
  press: { ts: 0, items: [] },
  policy: { ts: 0, items: [] },
};
const KOREA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function extractKoreaLinks(html, kind) {
  const base = "https://www.korea.kr";
  const rePath =
    kind === "press"
      ? /\/briefing\/pressReleaseView\.do\?[^"'<>\s]+/g
      : /\/news\/policyNewsView\.do\?[^"'<>\s]+/g;

  const found = [];
  const seen = new Set();
  let m;
  while ((m = rePath.exec(html)) !== null) {
    const p = m[0];
    const url = p.startsWith("http") ? p : base + p;
    if (!seen.has(url)) {
      seen.add(url);
      found.push(url);
    }
  }

  // Fallback: sometimes URLs appear without leading slash in JS
  if (found.length === 0) {
    const re2 =
      kind === "press"
        ? /pressReleaseView\.do\?[^"'<>\s]+/g
        : /policyNewsView\.do\?[^"'<>\s]+/g;
    while ((m = re2.exec(html)) !== null) {
      const p = m[0].startsWith("/") ? m[0] : "/" + m[0];
      const url = base + p;
      if (!seen.has(url)) {
        seen.add(url);
        found.push(url);
      }
    }
  }

  return found;
}

function extractOgTitle(html) {
  const m1 = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (m1 && m1[1]) return m1[1].trim();

  const m2 = html.match(/<title>([^<]+)<\/title>/i);
  if (m2 && m2[1]) return m2[1].trim();

  return "";
}

function extractFirstDate(html) {
  const m = html.match(/\b(20\d{2}\.\d{2}\.\d{2})\b/);
  return m ? m[1] : null;
}

async function fetchKoreaLatest(kind, limit) {
  const listUrl =
    kind === "press"
      ? "https://www.korea.kr/briefing/pressReleaseList.do"
      : "https://www.korea.kr/news/policyNewsList.do";

  const cache = kind === "press" ? _koreaCache.press : _koreaCache.policy;
  const now = Date.now();
  if (cache.items.length && now - cache.ts < KOREA_CACHE_TTL_MS) {
    return { listUrl, items: cache.items.slice(0, limit), cached: true };
  }

  const listHtml = await fetchText(listUrl, { timeoutMs: 12000 });
  const links = extractKoreaLinks(listHtml, kind).slice(0, limit);

  // Fetch each article page to get stable title/date (more robust than parsing list snippets)
  const items = [];
  for (const link of links) {
    try {
      const html = await fetchText(link, { timeoutMs: 12000 });
      const title = decodeHtmlEntities(extractOgTitle(html) || link);
      const date = extractFirstDate(html);
      items.push({ title, link, date, source: "korea.kr" });
    } catch (e) {
      // keep item with link even if detail fetch fails
      items.push({ title: link, link, date: null, source: "korea.kr" });
    }
  }

  cache.ts = now;
  cache.items = items;

  return { listUrl, items: items.slice(0, limit), cached: false };
}

function stripCdata(s) {
  return String(s || "").replace("<![CDATA[", "").replace("]]>", "").trim();
}


function decodeHtmlEntities(s) {
  if (!s) return "";
  let out = String(s);

  // Decode repeatedly because some sources are double-encoded (e.g., &amp;quot; -> &quot; -> ")
  for (let i = 0; i < 3; i++) {
    const before = out;

    // 1) Decode numeric entities first (handles &#034;, &#039;, &#x22;, etc.)
    out = out.replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      if (!Number.isFinite(code)) return _;
      return String.fromCharCode(code);
    });
    out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      if (!Number.isFinite(code)) return _;
      return String.fromCharCode(code);
    });

    // 2) Decode &amp; early so double-encoded named/numeric entities can be decoded on next loop
    out = out.replace(/&amp;/g, "&");

    // 3) Decode common named entities
    out = out
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&middot;/g, "·")
      .replace(/&ndash;/g, "–")
      .replace(/&mdash;/g, "—")
      .replace(/&lsquo;/g, "‘")
      .replace(/&rsquo;/g, "’")
      .replace(/&ldquo;/g, "“")
      .replace(/&rdquo;/g, "”");

    if (out === before) break;
  }

  // cleanup
  return out.replace(/\s+/g, " ").trim();
}


function pickTag(itemXml, tag) {
  const reTag = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, "i");
  const m = itemXml.match(reTag);
  return m ? stripCdata(m[1]) : "";
}

function parseRssItems(xml) {
  const items = [];
  const parts = String(xml).split(/<item>/i);
  for (let i = 1; i < parts.length; i++) {
    const itemBlock = parts[i].split(/<\/item>/i)[0] || "";
    const title = pickTag(itemBlock, "title");
    const link = pickTag(itemBlock, "link");
    const pubDate = pickTag(itemBlock, "pubDate");
    const description = pickTag(itemBlock, "description");
    if (!title && !link) continue;
    items.push({ title, link, pubDate, description });
  }
  return items;
}

function toArrayPayload(x) {
  // Try common shapes returned by APIs
  if (Array.isArray(x)) return x;
  if (!x || typeof x !== "object") return [];
  const candidates = [
    x.items,
    x.data,
    x.result,
    x.results,
    x.rows,
    x.list,
    x.value,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function normalizeStr(v) {
  return String(v || "").trim();
}

function safeInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function titleText(r) {
  return normalizeStr(r.title || r.report_title || r.name || "");
}

function instituteName(r) {
  return normalizeStr(r.institute || r.institute_name || r.org || "");
}

function reportGroup(r) {
  // For national scope, some datasets label affiliation as NRC/NCT (or NST/NCT).
  return normalizeStr(
    r.group || r.cluster || r.type || r.category || r.institute_group || r.affiliation || r.parent || ""
  );
}

function reportYear(r) {
  const y = r.year ?? r.publish_year ?? r.pub_year ?? r.report_year;
  const n = Number(y);
  return Number.isFinite(n) ? n : null;
}

function reportUrl(r) {
  return normalizeStr(r.url || r.link || r.href || "");
}

function matchesQuery(r, q) {
  if (!q) return true;
  const t = `${titleText(r)} ${instituteName(r)}`.toLowerCase();
  return t.includes(q.toLowerCase());
}

function filterReports(reports, { institute, year, q }) {
  const inst = normalizeStr(institute);
  const y = normalizeStr(year);
  const query = normalizeStr(q);

  return reports.filter((r) => {
    if (inst) {
      const g = reportGroup(r);
      // If user selected an affiliation bucket (e.g., NRC/NCT), match by group when present.
      if ((inst === 'NRC' || inst === 'NCT' || inst === 'NST') && g) {
        if (g !== inst) return false;
      } else {
        if (instituteName(r) !== inst) return false;
      }
    }
    if (y) {
      const ry = reportYear(r);
      if (!ry || String(ry) !== y) return false;
    }
    if (!matchesQuery(r, query)) return false;
    return true;
  });
}

// A light tokenizer (title-based). This is intentionally simple so it works offline.
const STOP_BASE = new Set([
  "및",
  "등",
  "대한",
  "연구",
  "분석",
  "방안",
  "정책",
  "보고서",
  "사업",
  "활성화",
  "개선",
  "기반",
  "지역",
  "국가",
  "정부",
  "지자체",
  "협력",
  "지원",
  "현황",
  "사례",
  "조사",
  "전략",
  "계획",
  "발전",
  "효과",
  "평가",
  "추진",
  "체계",
  "모델",
  "제도",
  "운영",
  "관리",
  "활용",
  "혁신",
]);

function tokenizeTitle(t) {
  const s = normalizeStr(t)
    // keep Korean/English/numbers, split others
    .replace(/[^0-9A-Za-z\u3131-\uD79D]+/g, " ")
    .toLowerCase();
  const parts = s.split(/\s+/).filter(Boolean);
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length >= 2)
    .filter((p) => !STOP_BASE.has(p) && !STOP_EXTRA.has(p));
}

function keywordCounts(reports) {
  const m = new Map();
  for (const r of reports) {
    const toks = tokenizeTitle(titleText(r));
    for (const w of toks) m.set(w, (m.get(w) || 0) + 1);
  }
  return m;
}

// -----------------------------
// Auth
// -----------------------------
const STOPWORDS_PATH = path.join(DATA_DIR, "stopwords.json");

// -----------------------------
// Remote stopwords store (optional)
// -----------------------------
// If DEBUG_REMOTE_STOPWORDS=1 (or STOPWORDS_REMOTE_URL is set), stopwords are loaded/saved via a remote endpoint.
// Recommended: use a PHP proxy (stopword.php) that reads/writes stopwords.json on your storage host.
// The remote endpoint must support:
//   - GET  -> returns stopwords.json (either ["a","b"] or { words:["a","b"] })
//   - POST -> accepts a JSON body and persists it (recommended: write the raw body to stopwords.json)
// Auth: request header "X-Storage-Token" must match STORAGE_TOKEN on the Render server.
const REMOTE_STOPWORDS_ENABLED =
  process.env.DEBUG_REMOTE_STOPWORDS === "1" || Boolean(process.env.STOPWORDS_REMOTE_URL);

const STOPWORDS_REMOTE_URL = process.env.STOPWORDS_REMOTE_URL || "";
const STOPWORDS_REMOTE_WRITE_URL = process.env.STOPWORDS_REMOTE_WRITE_URL || STOPWORDS_REMOTE_URL;
let lastRemoteStopwordsFailureAt = 0;
const REMOTE_STOPWORDS_BACKOFF_MS = Number(process.env.REMOTE_STOPWORDS_BACKOFF_MS || 0);
const REMOTE_STOPWORDS_BACKOFF_TIMEOUT_MS = Number(process.env.REMOTE_STOPWORDS_BACKOFF_TIMEOUT_MS || 800);

function normalizeStopwordsPayload(v) {
  // Accept either array or { words: [...] }
  const arr = Array.isArray(v) ? v : Array.isArray(v?.words) ? v.words : [];
  return arr
    .map((x) => normalizeStr(x).toLowerCase())
    .filter(Boolean);
}

async function readStopwords() {
  // Remote first (when enabled)
  if (REMOTE_STOPWORDS_ENABLED && STOPWORDS_REMOTE_URL) {
    const token = process.env.STORAGE_TOKEN || "";
    const baseTimeout = Number(process.env.REMOTE_STOPWORDS_TIMEOUT_MS || 3000);
    const inBackoff =
      REMOTE_STOPWORDS_BACKOFF_MS > 0 && Date.now() - lastRemoteStopwordsFailureAt < REMOTE_STOPWORDS_BACKOFF_MS;
    const timeoutMs = inBackoff ? Math.min(baseTimeout, REMOTE_STOPWORDS_BACKOFF_TIMEOUT_MS) : baseTimeout;

    try {
      const raw = await httpRequestText("GET", STOPWORDS_REMOTE_URL, {
        timeoutMs,
        headers: token ? { "X-Storage-Token": token } : {},
      });
      const parsed = JSON.parse(raw || "[]");
      lastRemoteStopwordsFailureAt = 0;
      return normalizeStopwordsPayload(parsed);
    } catch (err) {
      lastRemoteStopwordsFailureAt = Date.now();
      console.warn("[stopwords] Remote readStopwords failed, falling back to local store:", err?.message || err);
      // fall through to local
    }
  }


  // Local fallback
  if (!fs.existsSync(STOPWORDS_PATH)) return [];
  const v = readJson(STOPWORDS_PATH);
  return normalizeStopwordsPayload(v);
}

async function writeStopwords(words) {
  // Always write normalized array
  const payload = JSON.stringify(words, null, 2);

  if (REMOTE_STOPWORDS_ENABLED && (STOPWORDS_REMOTE_WRITE_URL || STOPWORDS_REMOTE_URL)) {
    try {
      const token = process.env.STORAGE_TOKEN || "";
      // If someone mistakenly set STOPWORDS_REMOTE_WRITE_URL to a .json file, write via the proxy (.php) if available.
      const writeUrl =
        STOPWORDS_REMOTE_WRITE_URL && STOPWORDS_REMOTE_WRITE_URL.endsWith(".php")
          ? STOPWORDS_REMOTE_WRITE_URL
          : STOPWORDS_REMOTE_URL || STOPWORDS_REMOTE_WRITE_URL;

      if (!writeUrl) throw new Error("STOPWORDS_REMOTE_WRITE_URL is not set");

      await httpRequestText("POST", writeUrl, {
        timeoutMs: Number(process.env.REMOTE_STOPWORDS_WRITE_TIMEOUT_MS || 5000),
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...(token ? { "X-Storage-Token": token } : {}),
        },
        body: payload,
      });
      return true;
    } catch (err) {
      console.warn("[stopwords] Remote writeStopwords failed, falling back to local store:", err?.message || err);
      // fall through to local
    }
  }

  // Local fallback (best-effort)
  try {
    fs.mkdirSync(path.dirname(STOPWORDS_PATH), { recursive: true });
    const tmp = `${STOPWORDS_PATH}.tmp`;
    fs.writeFileSync(tmp, payload, "utf-8");
    fs.renameSync(tmp, STOPWORDS_PATH);
    return true;
  } catch {
    return false;
  }
}

// Stopwords change notification (for clients already connected)
let STOPWORDS_VERSION = String(Date.now());

const stopwordsStreams = new Set();
function broadcastStopwordsVersion() {
  const payload = JSON.stringify({ version: STOPWORDS_VERSION });
  for (const res of stopwordsStreams) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {
      // ignore
    }
  }
}

// dynamic stopwords loaded from store (remote/local)
let STOP_EXTRA = new Set();

async function reloadStopwords() {
  STOP_EXTRA = new Set(await readStopwords());
  STOPWORDS_VERSION = String(Date.now());
  // Stopwords affect trend-tokenization; invalidate caches immediately
  cache.clear();
  broadcastStopwordsVersion();
}

const USERS_PATH = path.join(DATA_DIR, "users.json");

// -----------------------------
// Remote users store (optional)
// -----------------------------
// If DEBUG_REMOTE_USERS=1 (or USERS_REMOTE_URL is set), users are loaded/saved via a remote endpoint.
// The remote endpoint must support:
//   - GET  -> returns users.json (either { users:[...] } or [...] )
//   - POST -> accepts raw JSON and overwrites users.json
// Provided users.php matches this contract and requires header: X-Storage-Token
const REMOTE_USERS_ENABLED =
  String(process.env.DEBUG_REMOTE_USERS || "").trim() === "1" || !!process.env.USERS_REMOTE_URL;

const REMOTE_USERS_URL = process.env.USERS_REMOTE_URL || ""; // e.g. http://.../storage/users.php
const REMOTE_USERS_WRITE_URL_RAW = process.env.USERS_REMOTE_WRITE_URL || ""; // optional override
const REMOTE_USERS_WRITE_URL =
  REMOTE_USERS_WRITE_URL_RAW && REMOTE_USERS_WRITE_URL_RAW.trim().toLowerCase().endsWith(".php")
    ? REMOTE_USERS_WRITE_URL_RAW
    : REMOTE_USERS_URL;

const STORAGE_TOKEN = process.env.STORAGE_TOKEN || "";
let lastRemoteUsersFailureAt = 0;
const REMOTE_USERS_BACKOFF_MS = Number(process.env.REMOTE_USERS_BACKOFF_MS || 0);
const REMOTE_USERS_BACKOFF_TIMEOUT_MS = Number(process.env.REMOTE_USERS_BACKOFF_TIMEOUT_MS || 800);

function parseUsersDoc(v) {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.users)) return v.users;
  return [];
}

function serializeUsersDoc(users) {
  // Persist as an object for forward-compatibility with older server code and your current remote users.json
  return JSON.stringify({ users }, null, 2);
}

function readUsersLocal() {
  if (!fs.existsSync(USERS_PATH)) return [];
  try {
    const v = readJson(USERS_PATH);
    return parseUsersDoc(v);
  } catch (err) {
    console.error("[auth] Failed to read users.json:", err?.message || err);
    return [];
  }
}

async function httpRequestText(method, url, { timeoutMs = 12000, headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? http : https;

    const req = lib.request(
      {
        method,
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: u.pathname + (u.search || ""),
        servername: u.hostname,
        headers: {
          "User-Agent": "ri-portal-app/1.0 (+https://onrender.com)",
          "Accept": "application/json, */*;q=0.8",
          "Accept-Encoding": "identity",
          "Connection": "close",
          ...headers,
        },
      },
      (res) => {
        // handle redirects (keep method/body for 307/308; downgrade to GET for 301/302/303)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          const keepMethod = res.statusCode === 307 || res.statusCode === 308;
          return resolve(
            httpRequestText(keepMethod ? method : "GET", next, { timeoutMs, headers, body: keepMethod ? body : null })
          );
        }

        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks);
          const enc = (res.headers["content-encoding"] || "").toLowerCase();

          const finish = (buf) => {
            const text = buf.toString("utf-8");
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve(text);
            const err = new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`);
            err.statusCode = res.statusCode;
            err.body = text;
            return reject(err);
          };

          try {
            if (enc === "gzip") {
              const zlib = require("zlib");
              return zlib.gunzip(raw, (err, out) => (err ? reject(err) : finish(out)));
            }
            if (enc === "deflate") {
              const zlib = require("zlib");
              return zlib.inflate(raw, (err, out) => (err ? reject(err) : finish(out)));
            }
          } catch {
            // fall through
          }
          return finish(raw);
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Timeout")));

    if (body != null) req.write(body);
    req.end();
  });
}

async function readUsers() {
  if (REMOTE_USERS_ENABLED && REMOTE_USERS_URL && STORAGE_TOKEN) {
    const baseTimeout = Number(process.env.REMOTE_USERS_TIMEOUT_MS || 3000);
    const inBackoff = REMOTE_USERS_BACKOFF_MS > 0 && Date.now() - lastRemoteUsersFailureAt < REMOTE_USERS_BACKOFF_MS;
    const timeoutMs = inBackoff ? Math.min(baseTimeout, REMOTE_USERS_BACKOFF_TIMEOUT_MS) : baseTimeout;

    try {
      const text = await httpRequestText("GET", REMOTE_USERS_URL, {
        timeoutMs,
        headers: { "X-Storage-Token": STORAGE_TOKEN },
      });
      const v = JSON.parse(text);
      lastRemoteUsersFailureAt = 0;
      return parseUsersDoc(v);
    } catch (err) {
      lastRemoteUsersFailureAt = Date.now();
      console.error("[auth] Remote readUsers failed, falling back to local store:", err?.message || err);
      return readUsersLocal();
    }
  }
  return readUsersLocal();
}

async function writeUsers(users) {
  const payload = serializeUsersDoc(users);

  if (REMOTE_USERS_ENABLED && REMOTE_USERS_WRITE_URL && STORAGE_TOKEN) {
    try {
      await httpRequestText("POST", REMOTE_USERS_WRITE_URL, {
        timeoutMs: Number(process.env.REMOTE_USERS_WRITE_TIMEOUT_MS || 5000),
        headers: {
          "X-Storage-Token": STORAGE_TOKEN,
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(payload),
        },
        body: payload,
      });
      return true;
    } catch (err) {
      lastRemoteUsersFailureAt = Date.now();
      console.error("[auth] Remote writeUsers failed, falling back to local store:", err?.message || err);
      // fall through to local write (best-effort)
    }
  }

  // Best-effort local persistence. On some platforms (read-only FS) this will fail.
  try {
    fs.writeFileSync(USERS_PATH, payload, "utf-8");
    return true;
  } catch {
    return false;
  }
}

function isBcryptHash(v) {
  const s = String(v || "");
  return s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$");
}

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}


async function currentUserFromStore(sub) {
  const users = await readUsers();
  const u = users.find((x) => x.id === sub);
  if (u) return u;
  // Default admin fallback (when users.json not present)
  if (sub === "admin") return { id: "admin", username: "admin", role: "admin", status: "approved" };
  return null;
}

async function adminRequired(req, res, next) {
  try {
    const u = await currentUserFromStore(req.user?.sub);
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    if ((u.role || "user") !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.currentUser = u;
    return next();
  } catch (err) {
    console.error("[auth] adminRequired error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}

app.use("/data", express.static(path.resolve(__dirname, "server", "data")));

app.post("/api/auth/login", async (req, res) => {
  try {
  const username = normalizeStr(req.body?.username);
  const password = normalizeStr(req.body?.password);
  if (!username || !password) return res.status(400).json({ error: "username/password required" });

  const users = await readUsers();

    // ✅ Default admin fallback (admin/admin1234). Also accepts legacy admin/1234.
  // Ensures admin is persisted with a valid bcrypt hash to avoid 500 errors.
  if (username === "admin" && (password === "admin1234" || password === "1234")) {
    const now = new Date().toISOString();
    const users = await readUsers();
    let existing = users.find((u) => u.username === "admin" || u.id === "admin");
    const adminHash = bcrypt.hashSync("admin1234", 10);
    if (existing) {
      existing.password_hash = isBcryptHash(existing.password_hash) ? existing.password_hash : adminHash;
      existing.last_login_at = now;
      existing.updated_at = now;
      await writeUsers(users);
      const token = signToken(existing);
      return res.json({ token, user: { id: existing.id, username: existing.username, name: existing.name, role: existing.role || "admin" } });
    }

    const user = { id: "admin", username: "admin", email: "admin@example.com", name: "관리자", org: "RI Portal", role: "admin", status: "approved", last_login_at: now, created_at: now, updated_at: now };
    users.push({ ...user, password_hash: adminHash });
    await writeUsers(users);
    const token = signToken(user);
    return res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  }

  const user = users.find((u) => u.username === username || u.email === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  if ((user.status || "approved") !== "approved") {
    const st = user.status || "pending";
    const msg = st === "pending" ? "승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다."
      : st === "rejected" ? "승인 거절된 계정입니다."
      : "로그인할 수 없는 상태입니다.";
    return res.status(403).json({ error: msg, status: st });
  }

  if (!isBcryptHash(user.password_hash)) return res.status(401).json({ error: "Invalid credentials" });
  let ok = false;
  try {
    ok = await bcrypt.compare(password, user.password_hash);
  } catch {
    ok = false;
  }
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  // ✅ record last login
  const now = new Date().toISOString();
  user.last_login_at = now;
  user.updated_at = now;
  await writeUsers(users);

  const token = signToken(user);
  return res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role || "user" } });
  } catch (err) {
    console.error('[auth] login error:', err?.stack || err);
    return res.status(500).json({ error: 'Login failed (server error)' });
  }

});

app.post("/api/auth/register", async (req, res) => {
  const name = normalizeStr(req.body?.name);
  const org = normalizeStr(req.body?.org);
  const emailOrUsername = normalizeStr(req.body?.email || req.body?.username);
  const password = normalizeStr(req.body?.password);

  if (!name || !org || !emailOrUsername || !password) {
    return res.status(400).json({ error: "name/org/email/password required" });
  }

  const username = emailOrUsername; // treat email as login id
  const email = emailOrUsername.includes("@") ? emailOrUsername : normalizeStr(req.body?.email);

  const users = await readUsers();
  if (users.some((u) => u.username === username || (email && u.email === email))) {
    return res.status(409).json({ error: "User exists" });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    username,
    email: email || username,
    name,
    org,
    password_hash,
    role: "user",
    status: "pending", // ✅ admin approval required
    created_at: now,
    updated_at: now,
  };
  users.push(user);

  const persisted = await writeUsers(users);
  return res.status(201).json({
    user: { id: user.id, username: user.username, email: user.email, name: user.name, org: user.org, role: user.role, status: user.status },
    persisted,
    note: persisted ? "Registered. Waiting for admin approval." : "Registered (in-memory). Waiting for admin approval.",
  });
});

app.get("/__meta", (req, res) => {
  const indexPath = path.join(CLIENT_DIST, "index.html");
  res.json({
    dist: CLIENT_DIST,
    distExists: fs.existsSync(CLIENT_DIST),
    indexExists: fs.existsSync(indexPath),
  });
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const user = await currentUserFromStore(req.user?.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      org: user.org,
      role: user.role || "user",
      status: user.status || "approved",
    },
  });
});

// -----------------------------
// Chat API (proxy to hosting PHP)
// -----------------------------
const chatRouter = createChatRouter({
  getSessionUserId: (req) => req.user?.sub || req.user?.id || req.user?.username,
  // For the DM user combobox
  listUsers: async () => await readUsers(),
});
app.use("/api/chat", authRequired, chatRouter);



app.get("/api/admin/users", authRequired, adminRequired, async (req, res) => {
  const status = normalizeStr(req.query.status); // optional
  // NOTE: Avoid `await readUsers().filter(...)` precedence pitfall.
  // `await readUsers().filter(...)` tries to access `.filter` on a Promise.
  const allUsers = await readUsers();
  const users = allUsers
    .filter((u) => (status ? (u.status || "approved") === status : true))
    .map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      org: u.org,
      role: u.role || "user",
      status: u.status || "approved",
      created_at: u.created_at,
      updated_at: u.updated_at,
      last_login_at: u.last_login_at || null,
    }));
  return res.json({ users });
});

app.post("/api/admin/users/:id/approve", authRequired, adminRequired, async (req, res) => {
  const id = req.params.id;
  const users = await readUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return res.status(404).json({ error: "User not found" });
  u.status = "approved";
  u.updated_at = new Date().toISOString();
  const persisted = await writeUsers(users);
  return res.json({ ok: true, persisted, user: { id: u.id, username: u.username, status: u.status } });
});

app.post("/api/admin/users/:id/reject", authRequired, adminRequired, async (req, res) => {
  const id = req.params.id;
  const users = await readUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return res.status(404).json({ error: "User not found" });
  u.status = "rejected";
  u.updated_at = new Date().toISOString();
  const persisted = await writeUsers(users);
  return res.json({ ok: true, persisted, user: { id: u.id, username: u.username, status: u.status } });
});

app.post("/api/admin/users/:id/password", authRequired, adminRequired, async (req, res) => {
  const id = req.params.id;
  const newPassword = normalizeStr(req.body?.newPassword);
  if (!newPassword) return res.status(400).json({ error: "newPassword required" });

  const users = await readUsers();
  let u = users.find((x) => x.id === id);

  // allow setting password for default admin even if not in file yet
  if (!u && id === "admin") {
    u = { id: "admin", username: "admin", email: "admin", name: "관리자", org: "RI Portal", role: "admin", status: "approved", created_at: new Date().toISOString() };
    users.push(u);
  }
  if (!u) return res.status(404).json({ error: "User not found" });

  u.password_hash = await bcrypt.hash(newPassword, 10);
  u.updated_at = new Date().toISOString();
  const persisted = await writeUsers(users);
  return res.json({ ok: true, persisted });
});



// Stopwords version (used to refresh trend screens without a full reload)
app.get("/api/stopwords/version", (req, res) => {
  return res.json({ version: STOPWORDS_VERSION });
});

// Server-Sent Events stream: pushes stopwords version changes to connected clients.
app.get("/api/stopwords/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  stopwordsStreams.add(res);
  // send current version immediately
  res.write(`data: ${JSON.stringify({ version: STOPWORDS_VERSION })}\n\n`);

  // Keep-alive comment to prevent some proxies from closing the connection
  const keepAlive = setInterval(() => {
    try {
      res.write(": keep-alive\n\n");
    } catch {
      // ignore
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    stopwordsStreams.delete(res);
  });
});

app.get("/api/admin/stopwords", authRequired, adminRequired, async (req, res) => {
  const words = (await readStopwords()).sort();
  STOP_EXTRA = new Set(words);
  return res.json({ words });
});

app.post("/api/admin/stopwords/add", authRequired, adminRequired, async (req, res) => {
  const raw = req.body?.words ?? req.body?.word ?? "";
  const add = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean);

  const next = new Set(STOP_EXTRA);
  for (const w of add) next.add(normalizeStr(w).toLowerCase());
  const words = [...next].filter(Boolean).sort();

  const persisted = await writeStopwords(words);
  await reloadStopwords();
  return res.json({ ok: true, persisted, words });
});

app.post("/api/admin/stopwords/remove", authRequired, adminRequired, async (req, res) => {
  const raw = req.body?.words ?? req.body?.word ?? "";
  const remove = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean);

  const next = new Set(STOP_EXTRA);
  for (const w of remove) next.delete(normalizeStr(w).toLowerCase());
  const words = [...next].filter(Boolean).sort();

  const persisted = await writeStopwords(words);
  await reloadStopwords();
  return res.json({ ok: true, persisted, words });
});

app.put("/api/admin/stopwords", authRequired, adminRequired, async (req, res) => {
  const raw = req.body?.words ?? [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/);
  const words = arr.map((x) => normalizeStr(x).toLowerCase()).filter(Boolean);
  // de-dup
  const uniq = [...new Set(words)].sort();
  const persisted = await writeStopwords(uniq);
  await reloadStopwords();
  return res.json({ ok: true, persisted, words: uniq });
});

// -----------------------------
// Static data APIs
// -----------------------------
app.get("/api/institutes/local", (req, res) => {
  const p = path.join(DATA_DIR, "local_institutes.json");
  return res.json(fs.existsSync(p) ? readJson(p) : []);
});

/**
 * National institutes (정부출연) endpoints
 * - /api/institutes/national         => NRC + NCT combined (items)
 * - /api/institutes/national/nrc     => NRC only (items)
 * - /api/institutes/national/nct     => NCT only (items)
 *
 * Data sources:
 * 1) If URLs are configured (Render env OR hardcoded constants), the server will fetch from APIs.
 * 2) Otherwise it falls back to DATA_DIR/national_institutes.json.
 */
async function loadNationalBuckets() {
  const nrcUrl = (process.env.NRC_API_URL || NRC_API_URL || "").trim();
  const nctUrl = (process.env.NCT_API_URL || NCT_API_URL || "").trim();

  // ---- Fallback: local JSON file ----
  const nationalFile = path.join(DATA_DIR, "national_institutes.json");
  const apiConfigured = Boolean(nrcUrl) && Boolean(nctUrl);

  if (!apiConfigured) {
    if (fs.existsSync(nationalFile)) {
      const parsed = readJson(nationalFile);

      // Accept common shapes:
      // - { nrc:[], nct:[] }
      // - { nst:[], nct:[] }  (legacy key nst treated as nrc if nrc missing)
      // - { items:[...] } or plain array [...]
      const nrc = Array.isArray(parsed?.nrc)
        ? parsed.nrc
        : (Array.isArray(parsed?.nst) ? parsed.nst : []);
      const nct = Array.isArray(parsed?.nct) ? parsed.nct : [];

      const items = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.items) ? parsed.items : [...nrc, ...nct]);

      return {
        updated_at: parsed?.updated_at ?? null,
        sources: parsed?.sources ?? [{ file: "national_institutes.json" }],
        nrc,
        nct,
        items,
        note: "Loaded from local JSON (API URLs not configured).",
      };
    }

    return {
      updated_at: null,
      sources: [],
      nrc: [],
      nct: [],
      items: [],
      note: "API URLs not configured and national_institutes.json not found.",
    };
  }

  // ---- Primary: remote APIs ----
  const headers = process.env.API_KEY
    ? { Authorization: `Bearer ${process.env.API_KEY}` }
    : {};

  const [nrcRaw, nctRaw] = await Promise.all([
    fetchJson(nrcUrl, { headers }),
    fetchJson(nctUrl, { headers }),
  ]);

  const nrcArr = toArrayPayload(nrcRaw);
  const nctArr = toArrayPayload(nctRaw);

  const pickName = (i) => i?.name ?? i?.instNm ?? i?.institute_name ?? i?.orgName ?? i?.title ?? "";
  const pickUrl  = (i) => i?.url ?? i?.homepage ?? i?.homePage ?? i?.site ?? i?.link ?? "";
  const pickDesc = (i) => i?.desc ?? i?.description ?? i?.summary ?? "";

  const normalize = (arr, group) =>
    arr
      .map((i) => ({
        name: String(pickName(i) || "").trim(),
        url: String(pickUrl(i) || "").trim(),
        desc: String(pickDesc(i) || "").trim(),
        region: "정부출연",
        group, // "NRC" | "NCT"
      }))
      .filter((x) => x.name);

  const nrc = normalize(nrcArr, "NRC");
  const nct = normalize(nctArr, "NCT");

  return {
    updated_at: new Date().toISOString(),
    sources: [{ nrcUrl }, { nctUrl }],
    nrc,
    nct,
    items: [...nrc, ...nct],
  };
}

app.get("/api/institutes/national", async (req, res) => {
  try {
    const data = await loadNationalBuckets();
    return res.json(data);
  } catch (e) {
    console.error("Failed to load national institutes:", e?.message || e);
    return res.status(502).json({
      error: "Failed to load national institutes",
      detail: String(e?.message || e),
      nrc: [],
      nct: [],
      items: [],
    });
  }
});

app.get("/api/institutes/national/nrc", async (req, res) => {
  try {
    const data = await loadNationalBuckets();
    return res.json({ items: data.nrc || [] });
  } catch (e) {
    console.error("Failed to load NRC institutes:", e?.message || e);
    return res.status(502).json({ error: "Failed to load NRC institutes", items: [] });
  }
});

app.get("/api/institutes/national/nct", async (req, res) => {
  try {
    const data = await loadNationalBuckets();
    return res.json({ items: data.nct || [] });
  } catch (e) {
    console.error("Failed to load NCT institutes:", e?.message || e);
    return res.status(502).json({ error: "Failed to load NCT institutes", items: [] });
  }
});


app.get("/api/press/latest", async (req, res) => {
  // Prevent browser/CDN caching so latest items show without hard refresh
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  const limit = Math.max(1, Math.min(20, parseInt(req.query.limit || "10", 10)));
  try {
    const out = await fetchKoreaLatest("press", limit);
    return res.json({
      more_url: out.listUrl,
      items: out.items,
      cached: out.cached,
    });
  } catch (e) {
    return res.status(502).json({
      error: "Failed to fetch press releases",
      detail: String(e?.message || e),
      more_url: "https://www.korea.kr/briefing/pressReleaseList.do",
      items: [],
    });
  }
});

app.get("/api/health/rss", async (req, res) => {
  try {
    const a = await fetchText("https://www.korea.kr/briefing/pressReleaseList.do", { timeoutMs: 12000 });
    const b = await fetchText("https://www.korea.kr/news/policyNewsList.do", { timeoutMs: 12000 });
    const pressLinks = extractKoreaLinks(a, "press").slice(0, 3);
    const policyLinks = extractKoreaLinks(b, "policy").slice(0, 3);
    return res.json({ ok: true, press_html_len: a.length, policy_html_len: b.length, pressLinks, policyLinks });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e?.message || e) });
  }
});


app.get("/api/news/policy/latest", async (req, res) => {
  // Prevent browser/CDN caching so latest items show without hard refresh
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  const limit = Math.max(1, Math.min(20, parseInt(req.query.limit || "10", 10)));
  try {
    const out = await fetchKoreaLatest("policy", limit);
    return res.json({
      more_url: out.listUrl,
      items: out.items,
      cached: out.cached,
    });
  } catch (e) {
    return res.status(502).json({
      error: "Failed to fetch policy news",
      detail: String(e?.message || e),
      more_url: "https://www.korea.kr/news/policyNewsList.do",
      items: [],
    });
  }
});

// -----------------------------
// Researchers search (derived from report authors)
// -----------------------------

function buildResearcherIndex(scope = 'all') {
  const key = `researchers:index:${scope}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const reports = getReportsByScope(scope);
  const byName = new Map();

  for (const r of reports) {
    const authors = Array.isArray(r.authors) ? r.authors : [];
    if (!authors.length) continue;

    const inst = instituteName(r) || '';
    const year = reportYear(r) || null;
    const title = titleText(r) || '';
    const url = reportUrl(r) || '';
    const toks = tokenizeTitle(title);

    for (const rawName of authors) {
      const name = String(rawName || '').trim();
      if (!name) continue;
      let rec = byName.get(name);
      if (!rec) {
        rec = {
          name,
          institutes: new Set(),
          reportCount: 0,
          lastActiveYear: null,
          tokenCounts: new Map(),
          recentReports: [],
        };
        byName.set(name, rec);
      }

      rec.reportCount += 1;
      if (inst) rec.institutes.add(inst);
      if (year && (!rec.lastActiveYear || year > rec.lastActiveYear)) rec.lastActiveYear = year;

      // Token profile
      for (const t of toks) rec.tokenCounts.set(t, (rec.tokenCounts.get(t) || 0) + 1);

      // Keep up to 10 recent reports (sorted later)
      rec.recentReports.push({
        id: r.id || r.report_id || `${name}-${rec.reportCount}`,
        year,
        title,
        url,
      });
    }
  }

  const researchers = [...byName.values()].map((r) => {
    // sort recent reports by year desc
    r.recentReports.sort((a, b) => (b.year || 0) - (a.year || 0));
    r.recentReports = r.recentReports.slice(0, 10);
    return r;
  });

  // Build IDF over researchers
  const df = new Map();
  for (const r of researchers) {
    for (const t of r.tokenCounts.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = Math.max(1, researchers.length);

  // Build tf-idf vectors and norms
  for (const r of researchers) {
    const vec = new Map();
    let norm2 = 0;
    const maxTf = Math.max(1, ...[...r.tokenCounts.values()]);
    for (const [t, tf] of r.tokenCounts.entries()) {
      const idf = Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
      const w = (tf / maxTf) * idf;
      vec.set(t, w);
      norm2 += w * w;
    }
    r._tfidf = vec;
    r._norm = Math.sqrt(norm2) || 1;
  }

  const index = { researchers, df, N };
  return cacheSet(key, index);
}

function scoreResearcher(index, researcher, qTokens) {
  const qSet = new Set(qTokens);
  if (!qTokens.length) {
    // No query: rank by outputs + recency
    const rec = researcher.lastActiveYear ? Math.min(1, Math.max(0, (researcher.lastActiveYear - 2000) / 30)) : 0;
    const out = Math.min(1, Math.log(1 + (researcher.reportCount || 0)) / Math.log(1 + 50));
    const confidence = Math.max(0, Math.min(1, 0.55 * out + 0.45 * rec));
    return { confidence, similarity: 0, coverage: 0, matchedKeywords: [], reasons: buildReasons(researcher, confidence) };
  }

  // Build query vector (idf only)
  const qVec = new Map();
  let qNorm2 = 0;
  for (const t of qSet) {
    const idf = Math.log((index.N + 1) / ((index.df.get(t) || 0) + 1)) + 1;
    qVec.set(t, idf);
    qNorm2 += idf * idf;
  }
  const qNorm = Math.sqrt(qNorm2) || 1;

  // Cosine similarity
  let dot = 0;
  const contrib = [];
  for (const [t, qw] of qVec.entries()) {
    const rw = researcher._tfidf.get(t) || 0;
    if (rw) {
      const c = rw * qw;
      dot += c;
      contrib.push({ t, c });
    }
  }
  const similarity = dot / (researcher._norm * qNorm);
  const matched = contrib.sort((a, b) => b.c - a.c).slice(0, 8).map((x) => x.t);
  const coverage = qSet.size ? matched.length / qSet.size : 0;

  const rec = researcher.lastActiveYear ? Math.min(1, Math.max(0, (researcher.lastActiveYear - 2000) / 30)) : 0;
  const out = Math.min(1, Math.log(1 + (researcher.reportCount || 0)) / Math.log(1 + 50));

  // Hybrid confidence (0..1)
  const confidence = Math.max(0, Math.min(1, 0.70 * similarity + 0.15 * coverage + 0.10 * rec + 0.05 * out));
  return { confidence, similarity, coverage, matchedKeywords: matched, reasons: buildReasons(researcher, confidence) };
}

function buildReasons(r, confidence) {
  const reasons = [];
  if (confidence >= 0.75) reasons.push('전문분야 유사도 높음');
  else if (confidence >= 0.55) reasons.push('관련 주제 다수');
  if (r.lastActiveYear) reasons.push(`최근 활동 ${r.lastActiveYear}`);
  if ((r.reportCount || 0) >= 10) reasons.push(`보고서 ${r.reportCount}건`);
  return reasons.slice(0, 3);
}

app.get('/api/researchers/search', (req, res) => {
  const scope = normalizeStr(req.query.scope) || 'all';
  const institute = normalizeStr(req.query.institute);
  const q = normalizeStr(req.query.q) || '';
  const sort = normalizeStr(req.query.sort) || 'match';
  const limit = Math.min(200, Math.max(1, safeInt(req.query.limit, 24)));
  const offset = Math.max(0, safeInt(req.query.offset, 0));

  const idx = buildResearcherIndex(scope);
  const qTokens = tokenizeTitle(q);

  let list = idx.researchers;
  if (institute) {
    list = list.filter((r) => r.institutes.has(institute));
  }

  const scored = list.map((r) => {
    const match = scoreResearcher(idx, r, qTokens);
    const institutesArr = [...r.institutes];
    const instituteLinks = institutesArr.map((name) => ({ name, url: INSTITUTE_URL_MAP.get(name) || null }));
    return {
      id: r.name,
      name: r.name,
      scope,
      institutes: institutesArr,
      instituteLinks,
      reportCount: r.reportCount,
      lastActiveYear: r.lastActiveYear,
      keywords: [...r.tokenCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t),
      recentReports: r.recentReports.slice(0, 10),
      match,
    };
  });

  // Sorting
  const sorted = scored.slice().sort((a, b) => {
    if (sort === 'recent') {
      return (b.lastActiveYear || 0) - (a.lastActiveYear || 0) || (b.reportCount || 0) - (a.reportCount || 0);
    }
    if (sort === 'outputs') {
      return (b.reportCount || 0) - (a.reportCount || 0) || (b.lastActiveYear || 0) - (a.lastActiveYear || 0);
    }
    // default: AI match desc
    const bc = Number(b.match?.confidence || 0);
    const ac = Number(a.match?.confidence || 0);
    if (bc !== ac) return bc - ac;
    const bs = Number(b.match?.similarity || 0);
    const as = Number(a.match?.similarity || 0);
    if (bs !== as) return bs - as;
    return String(a.name).localeCompare(String(b.name));
  });

  // Facets: institute counts (top 300)
  const facetMap = new Map();
  for (const it of sorted) {
    for (const inst of it.institutes || []) facetMap.set(inst, (facetMap.get(inst) || 0) + 1);
  }
  const facets = {
    institutes: [...facetMap.entries()]
      .map(([name, count]) => ({ name, count, url: INSTITUTE_URL_MAP.get(name) || null }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 300),
  };

  const total = sorted.length;
  const items = sorted.slice(offset, offset + limit);
  return res.json({ items, total, limit, offset, facets, queryAnalysis: { raw: q, tokens: qTokens } });
});

// -----------------------------
// Reports search
// -----------------------------
app.get("/api/reports/search", (req, res) => {
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);
  const limit = Math.min(200, Math.max(1, safeInt(req.query.limit, 50)));
  const offset = Math.max(0, safeInt(req.query.offset, 0));

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });
  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);
  const items = page.map((r, idx) => ({
    id: r.id || r.report_id || `${scope}-${offset + idx}`,
    year: reportYear(r) || "-",
    institute: instituteName(r) || "-",
    title: titleText(r) || "-",
    url: reportUrl(r) || "",
    scope: r.__scope || scope,
  }));

  return res.json({ items, total, limit, offset });
});

// -----------------------------
// Trends
// -----------------------------
app.get("/api/trends/summary", (req, res) => {
  const top = Math.min(2000, Math.max(1, safeInt(req.query.top, 200))); // for topKeywords
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const key = `summary:${top}:${scope}:${institute}:${year}:${q}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });

  const byInst = new Map();
  const byYear = new Map();
  for (const r of filtered) {
    const inst = instituteName(r) || "-";
    byInst.set(inst, (byInst.get(inst) || 0) + 1);
    const yv = reportYear(r);
    if (yv) byYear.set(yv, (byYear.get(yv) || 0) + 1);
  }

  const reportsPerInstitute = [...byInst.entries()]
    .map(([k, v]) => ({ institute: k, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 500);

  const reportsPerYear = [...byYear.entries()]
    .map(([k, v]) => ({ year: Number(k), count: v }))
    .sort((a, b) => a.year - b.year);

  // ✅ Add topKeywords for the Keywords screen
  const counts = keywordCounts(filtered);
  const topKeywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([key, value]) => ({ key, value }));

  return res.json(
    cacheSet(key, {
      totalReports: filtered.length,
      reportsPerInstitute,
      reportsPerYear,
      topKeywords,
    })
  );
});

app.get("/api/trends/top5", (req, res) => {
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const key = `top5:${scope}:${institute}:${year}:${q}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });

  // Count keywords overall, pick top 5
  const counts = keywordCounts(filtered);
  const top5 = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  // Build year series per keyword
  const years = [...new Set(filtered.map(reportYear).filter(Boolean))].sort((a, b) => a - b);
  const series = top5.map((kw) => {
    const ymap = new Map(years.map((y) => [y, 0]));
    for (const r of filtered) {
      const y = reportYear(r);
      if (!y) continue;
      const toks = tokenizeTitle(titleText(r));
      if (toks.includes(kw)) ymap.set(y, (ymap.get(y) || 0) + 1);
    }
    return { keyword: kw, data: years.map((y) => ({ year: y, count: ymap.get(y) || 0 })) };
  });

  return res.json(cacheSet(key, { top5, series }));
});

app.get("/api/trends/keyword", (req, res) => {
  const keyword = normalizeStr(req.query.keyword);
  if (!keyword) return res.status(400).json({ message: "keyword required" });

  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const key = `kw:${keyword}:${scope}:${institute}:${year}:${q}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });
  const byYear = new Map();
  for (const r of filtered) {
    const yv = reportYear(r);
    if (!yv) continue;
    const toks = tokenizeTitle(titleText(r));
    if (!toks.includes(keyword.toLowerCase())) continue;
    byYear.set(yv, (byYear.get(yv) || 0) + 1);
  }
  const data = [...byYear.entries()]
    .map(([y, c]) => ({ year: Number(y), count: c }))
    .sort((a, b) => a.year - b.year);

  return res.json(cacheSet(key, { keyword, data }));
});

app.get("/api/trends/wordcloud", (req, res) => {
  const top = Math.min(500, Math.max(1, safeInt(req.query.top, 50)));
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const key = `wc:${top}:${scope}:${institute}:${year}:${q}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });
  const counts = keywordCounts(filtered);
  const items = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([text, value]) => ({ text, value }));

  return res.json(cacheSet(key, { items }));
});

app.get("/api/trends/network", (req, res) => {
  const topKeywords = Math.min(300, Math.max(20, safeInt(req.query.topKeywords, 120)));
  const edgeTop = Math.min(2000, Math.max(50, safeInt(req.query.edgeTop, 400)));
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const key = `net:${topKeywords}:${edgeTop}:${scope}:${institute}:${year}:${q}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });
  const counts = keywordCounts(filtered);

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topKeywords)
    .map(([w, c]) => ({ w, c }));
  const topSet = new Set(top.map((t) => t.w));

  const edgeMap = new Map();
  for (const r of filtered) {
    const toks = [...new Set(tokenizeTitle(titleText(r)).filter((t) => topSet.has(t)))];
    if (toks.length < 2) continue;
    toks.sort();
    for (let i = 0; i < toks.length; i++) {
      for (let j = i + 1; j < toks.length; j++) {
        const k = `${toks[i]}||${toks[j]}`;
        edgeMap.set(k, (edgeMap.get(k) || 0) + 1);
      }
    }
  }

  const edges = [...edgeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, edgeTop)
    .map(([k, weight]) => {
      const [source, target] = k.split("||");
      return { source, target, weight };
    });
  const nodes = top.map(({ w, c }) => ({ id: w, size: c }));

  return res.json(cacheSet(key, { nodes, edges }));
});

app.get("/api/trends/heatmap", (req, res) => {
  const topKeywords = Math.min(80, Math.max(10, safeInt(req.query.topKeywords, 30)));
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const key = `hm:${topKeywords}:${scope}:${institute}:${year}:${q}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });
  const counts = keywordCounts(filtered);
  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topKeywords)
    .map(([w]) => w);
  const kwSet = new Set(keywords);

  const instTotals = new Map();
  const instKw = new Map(); // inst -> Map(kw -> count)
  for (const r of filtered) {
    const inst = instituteName(r) || "-";
    instTotals.set(inst, (instTotals.get(inst) || 0) + 1);
    const toks = tokenizeTitle(titleText(r));
    let m = instKw.get(inst);
    if (!m) {
      m = new Map();
      instKw.set(inst, m);
    }
    for (const t of toks) {
      if (!kwSet.has(t)) continue;
      m.set(t, (m.get(t) || 0) + 1);
    }
  }

  const rows = [...instTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120)
    .map(([inst, total]) => {
      const row = { institute: inst };
      const m = instKw.get(inst) || new Map();
      for (const kw of keywords) {
        const c = m.get(kw) || 0;
        row[kw] = total ? c / total : 0;
      }
      return row;
    });

  return res.json(cacheSet(key, { keywords, rows }));
});

app.get("/api/trends/related", authRequired, (req, res) => {
  const keyword = normalizeStr(req.query.keyword);
  if (!keyword) return res.status(400).json({ message: "keyword required" });

  const limit = Math.min(200, Math.max(1, safeInt(req.query.limit, 50)));
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });
  const kwLower = keyword.toLowerCase();
  const items = [];
  for (let i = 0; i < filtered.length && items.length < limit; i++) {
    const r = filtered[i];
    const toks = tokenizeTitle(titleText(r));
    if (!toks.includes(kwLower)) continue;
    items.push({
      id: r.id || r.report_id || `${scope}-${i}`,
      year: reportYear(r) || "-",
      institute: instituteName(r) || "-",
      title: titleText(r) || "-",
      url: reportUrl(r) || "",
    });
  }
  return res.json({ keyword, items });
});

app.get("/api/trends/rising", (req, res) => {
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });
  const years = [...new Set(filtered.map(reportYear).filter(Boolean))].sort((a, b) => a - b);
  const baseYear = years.at(-2) ?? years.at(-1) ?? null;
  const compareYear = years.at(-1) ?? null;
  if (!baseYear || !compareYear || baseYear === compareYear) return res.json({ baseYear, compareYear, items: [] });

  const baseReports = filtered.filter((r) => reportYear(r) === baseYear);
  const compareReports = filtered.filter((r) => reportYear(r) === compareYear);
  const baseCounts = keywordCounts(baseReports);
  const compareCounts = keywordCounts(compareReports);

  const allKeys = new Set([...baseCounts.keys(), ...compareCounts.keys()]);
  const items = [...allKeys]
    .map((k) => {
      const baseCount = baseCounts.get(k) || 0;
      const compareCount = compareCounts.get(k) || 0;
      const growth = (compareCount - baseCount) / Math.max(1, baseCount);
      return { keyword: k, baseCount, compareCount, growth };
    })
    .filter((x) => x.compareCount >= 2) // avoid noise
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 20);

  return res.json({ baseYear, compareYear, items });
});

app.get("/api/trends/burst", (req, res) => {
  // Simple burst: z-score of last-year count vs historical mean/std.
  const scope = normalizeStr(req.query.scope) || "all";
  const institute = normalizeStr(req.query.institute);
  const year = normalizeStr(req.query.year);
  const q = normalizeStr(req.query.q);

  const base = getReportsByScope(scope);
  const filtered = filterReports(base, { institute, year, q });
  const years = [...new Set(filtered.map(reportYear).filter(Boolean))].sort((a, b) => a - b);
  const lastYear = years.at(-1);
  if (!lastYear) return res.json({ lastYear: null, items: [] });

  // Build per-year keyword counts for a moderate set of keywords
  const overall = keywordCounts(filtered);
  const topKeywords = [...overall.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200)
    .map(([k]) => k);
  const kwSet = new Set(topKeywords);

  const perYear = new Map(); // year -> Map(kw->count)
  for (const y of years) perYear.set(y, new Map());
  for (const r of filtered) {
    const y = reportYear(r);
    if (!y) continue;
    const m = perYear.get(y);
    for (const t of tokenizeTitle(titleText(r))) {
      if (!kwSet.has(t)) continue;
      m.set(t, (m.get(t) || 0) + 1);
    }
  }

  const items = topKeywords
    .map((kw) => {
      const series = years.map((y) => perYear.get(y).get(kw) || 0);
      const lastVal = series.at(-1) || 0;
      const hist = series.slice(0, -1);
      const mean = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
      const variance = hist.length
        ? hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length
        : 0;
      const std = Math.sqrt(variance) || 1;
      const z = (lastVal - mean) / std;
      return { keyword: kw, z, lastVal };
    })
    .filter((x) => x.lastVal >= 2)
    .sort((a, b) => b.z - a.z)
    .slice(0, 20);

  return res.json({ lastYear, items });
});


// -----------------------------
// Health check
// -----------------------------
app.get("/health", (req, res) => res.status(200).send("ok"));
// -----------------------------
// Static hosting (SPA)
// -----------------------------
app.use(express.static(CLIENT_DIST));

// SPA fallback
app.get("*", (req, res) => {
  const indexPath = path.join(CLIENT_DIST, "index.html");
  if (!fs.existsSync(indexPath)) {
    return res.status(503).send("Client build not found. Did you run the client build on deploy?");
  }
  return res.sendFile(indexPath);
});

async function bootstrap() {
  console.log(`[storage] users remote: ${REMOTE_USERS_ENABLED ? "on" : "off"} url=${REMOTE_USERS_URL || "-"} write=${REMOTE_USERS_WRITE_URL || "-"}`);
  console.log(`[storage] stopwords remote: ${REMOTE_STOPWORDS_ENABLED ? "on" : "off"} url=${STOPWORDS_REMOTE_URL || "-"} write=${STOPWORDS_REMOTE_WRITE_URL || "-"}`);

  try {
    await reloadStopwords();
  } catch (err) {
    console.warn("[stopwords] Initial load failed:", err?.message || err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RI Portal server listening on port ${PORT}`);
  });
}

bootstrap();
