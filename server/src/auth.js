import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { JWT_SECRET, JWT_EXPIRES_IN, DATA_DIR, ensureDataDir } from './config.js';

// Parse cookies without external deps
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of String(cookieHeader).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

const USERS_FILE = process.env.USERS_FILE || path.join(DATA_DIR, 'users.json');

// Remote user storage (recommended for Render free tier)
const DEBUG_REMOTE_USERS = process.env.DEBUG_REMOTE_USERS === '1';
const STORAGE_TOKEN = process.env.STORAGE_TOKEN || process.env.USERS_STORAGE_TOKEN || '';
const RAW_REMOTE_READ = process.env.USERS_REMOTE_URL || '';
const RAW_REMOTE_WRITE = process.env.USERS_REMOTE_WRITE_URL || '';

let USERS_REMOTE_READ_URL = RAW_REMOTE_READ;
let USERS_REMOTE_WRITE_URL = RAW_REMOTE_WRITE;

// Fix common misconfiguration: READ=php, WRITE=json -> swap to READ=json, WRITE=php
if (USERS_REMOTE_READ_URL && USERS_REMOTE_WRITE_URL) {
  const readIsPhp = /\.php(\?|#|$)/i.test(USERS_REMOTE_READ_URL);
  const writeIsJson = /\.json(\?|#|$)/i.test(USERS_REMOTE_WRITE_URL);
  const readIsJson = /\.json(\?|#|$)/i.test(USERS_REMOTE_READ_URL);
  const writeIsPhp = /\.php(\?|#|$)/i.test(USERS_REMOTE_WRITE_URL);
  if (readIsPhp && writeIsJson) {
    const tmp = USERS_REMOTE_READ_URL;
    USERS_REMOTE_READ_URL = USERS_REMOTE_WRITE_URL;
    USERS_REMOTE_WRITE_URL = tmp;
  } else if (readIsJson && writeIsPhp) {
    // ok
  }
}

// If only one is set, use it for both (php can handle GET/POST)
if (!USERS_REMOTE_READ_URL && USERS_REMOTE_WRITE_URL) USERS_REMOTE_READ_URL = USERS_REMOTE_WRITE_URL;
if (!USERS_REMOTE_WRITE_URL && USERS_REMOTE_READ_URL) USERS_REMOTE_WRITE_URL = USERS_REMOTE_READ_URL;

function logRemote(...args) {
  try { if (DEBUG_REMOTE_USERS) console.log('[users/remote]', ...args); } catch {}
}

// Always print config once at startup so you can verify envs are applied
console.log('[users/remote] auth.js loaded', {
  readUrl: USERS_REMOTE_READ_URL || '(empty)',
  writeUrl: USERS_REMOTE_WRITE_URL || '(empty)',
  token: STORAGE_TOKEN ? 'set' : 'missing',
  localFile: USERS_FILE,
});

function curlJson(method, url, body) {
  try {
    const args = ['-sS', '-L', '--max-time', '10', '-w', '
%{http_code}'];
    if (method && method !== 'GET') args.push('-X', method);
    if (STORAGE_TOKEN) args.push('-H', `X-Storage-Token: ${STORAGE_TOKEN}`);
    if (body != null) {
      args.push('-H', 'Content-Type: application/json');
      args.push('--data-binary', JSON.stringify(body));
    }
    args.push(url);

    logRemote('curl', method, url, { hasToken: !!STORAGE_TOKEN, bytes: body != null ? JSON.stringify(body).length : 0 });
    const out = execFileSync('curl', args, { encoding: 'utf-8' });

    const i = out.lastIndexOf('
');
    const text = i >= 0 ? out.slice(0, i) : out;
    const code = i >= 0 ? Number(out.slice(i + 1).trim()) : 0;

    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }

    logRemote('curl:resp', method, url, { status: code, ok: code >= 200 && code < 300 });
    return { ok: code >= 200 && code < 300, status: code, data: parsed, raw: text };
  } catch (e) {
    logRemote('curl:error', method, url, String(e && e.message ? e.message : e));
    return { ok: false, status: 0, data: null, raw: null };
  }
}

function normalizeUsersDoc(parsed) {
  if (Array.isArray(parsed)) return { users: parsed };
  if (parsed && Array.isArray(parsed.users)) return parsed;
  return { users: [] };
}

function seedAdminDoc() {
  const hash = bcrypt.hashSync('admin1234', 10);
  return {
    users: [
      {
        id: 'u_admin',
        username: 'admin',
        password_hash: hash,
        role: 'admin',
        approved: true,
        created_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        approved_by: 'seed',
        status: 'approved',
      },
    ],
  };
}


export function readUsers() {
  ensureDataDir();

  // Prefer remote storage when configured
  if (USERS_REMOTE_READ_URL) {
    const r = curlJson('GET', USERS_REMOTE_READ_URL);
    if (r.ok && r.status === 200) {
      const doc = normalizeUsersDoc(r.data);
      logRemote('readUsers:remote:ok', { status: r.status, users: (doc.users || []).length });
      return doc;
    }

    // If remote doesn't exist yet, seed admin and attempt to write once
    if (r.status === 404 || r.data == null) {
      const seed = seedAdminDoc();
      if (USERS_REMOTE_WRITE_URL) {
        const w = curlJson('POST', USERS_REMOTE_WRITE_URL, seed);
        logRemote('writeUsers:remote:seed', { status: w.status, ok: w.ok });
      }
      return seed;
    }

    logRemote('readUsers:remote:fail', { status: r.status });
    // fall back to local
  }

  // Local fallback
  if (!fs.existsSync(USERS_FILE)) {
    const seed = seedAdminDoc();
    fs.writeFileSync(USERS_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }

  const raw = fs.readFileSync(USERS_FILE, 'utf-8');
  const parsed = raw ? JSON.parse(raw) : null;
  return normalizeUsersDoc(parsed);
}

function writeUsers(doc) {
  ensureDataDir();

  if (USERS_REMOTE_WRITE_URL) {
    const r = curlJson('POST', USERS_REMOTE_WRITE_URL, doc);
    if (r.ok) {
      logRemote('writeUsers:remote:ok', { status: r.status, users: (doc && doc.users ? doc.users.length : 0) });
      return;
    }
    logRemote('writeUsers:remote:fail', { status: r.status });
  }

  fs.writeFileSync(USERS_FILE, JSON.stringify(doc, null, 2), 'utf-8');
}

export function issueToken(user) {
  // Only include safe fields in JWT.
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function authMiddleware(req, res, next) {
  try {
    const authHdr = req.headers.authorization || '';
    let token = '';
    const m = authHdr.match(/^Bearer\s+(.+)$/i);
    if (m) token = m[1].trim();

    if (!token) token = String(req.headers['x-access-token'] || req.headers['x-auth-token'] || '').trim();

    if (!token) {
      const cookies = parseCookies(req.headers.cookie || '');
      token = (cookies.token || cookies.authToken || cookies.access_token || '').trim();
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
  } catch {
    req.user = null;
  }
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });
  return next();
}

const LoginSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6).max(200),
});

const RegisterSchema = z.object({
  // Allow email/username/korean etc. (admin approval still required)
  username: z.string().min(2).max(120),
  password: z.string().min(6).max(200),
  name: z.string().min(1).max(120).optional(),
  org: z.string().min(1).max(200).optional(),
});

export function login(req, res) {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

  const { username, password } = parsed.data;
  const doc = readUsers();
  const user = doc.users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  // Approval gate (non-admin)
  const status = user.status || (user.approved === true ? 'approved' : 'pending');
  if (user.role !== 'admin') {
    if (status === 'rejected') return res.status(403).json({ error: 'REJECTED' });
    if (user.approved === false && status !== 'approved') return res.status(403).json({ error: 'NOT_APPROVED' });
  }

  // Record last login
  user.last_login_at = new Date().toISOString();
  writeUsers(doc);

  const token = issueToken(user);
  return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
}

export function register(req, res) {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

  const { username, password, name, org } = parsed.data;
  const doc = readUsers();
  if (doc.users.some(u => u.username === username)) return res.status(409).json({ error: 'USERNAME_TAKEN' });

  const id = `u_${Date.now()}`;
  const password_hash = bcrypt.hashSync(password, 10);
  const user = {
    id,
    username,
    name: name || '',
    org: org || '',
    password_hash,
    role: 'user',
    approved: false,
    created_at: new Date().toISOString(),
  };
  doc.users.push(user);
  writeUsers(doc);

  return res.status(201).json({ pending: true, user: { id: user.id, username: user.username, role: user.role } });
}

export function me(req, res) {
  if (!req.user) return res.json({ user: null });
  return res.json({ user: req.user });
}

// --- Admin helpers

export function listPendingUsers(req, res) {
  const doc = readUsers();
  const items = (doc.users || [])
    .filter(u => u.role !== 'admin')
    .filter(u => {
      const status = u.status || (u.approved === true ? 'approved' : 'pending');
      return status === 'pending' && u.approved === false;
    })
    .map(u => ({
      id: u.id,
      username: u.username,
      email: u.email || '',
      name: u.name || '',
      org: u.org || '',
      created_at: u.created_at,
      last_login_at: u.last_login_at,
    }));
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return res.json({ items });
}

export function approveUser(req, res) {
  // Accept either body.userId (legacy) or URL param :id
  const userId = req.params?.id || req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'INVALID_INPUT', details: { userId: ['Required'] } });

  const doc = readUsers();
  const user = doc.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
  if (user.role === 'admin') return res.status(400).json({ error: 'CANNOT_APPROVE_ADMIN' });

  user.approved = true;
  user.status = 'approved';
  user.approved_at = new Date().toISOString();
  user.approved_by = req.user?.username || 'admin';
  delete user.rejected_at;
  delete user.rejected_by;
  writeUsers(doc);

  return res.json({ ok: true });
}

function getUserStatus(u) {
  if ((u.role || 'user') === 'admin') return 'approved';
  if (u.status === 'rejected') return 'rejected';
  if (u.approved === true || u.status === 'approved') return 'approved';
  return 'pending';
}

export function listUsers(req, res) {
  const doc = readUsers();
  const users = (doc.users || []).map(u => ({
    id: u.id,
    username: u.username,
    email: u.email || '',
    name: u.name || '',
    org: u.org || '',
    role: u.role || 'user',
    status: getUserStatus(u),
    created_at: u.created_at,
    approved_at: u.approved_at,
    rejected_at: u.rejected_at,
    last_login_at: u.last_login_at,
  }));
  // Newest first
  users.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return res.json({ users });
}

export function rejectUser(req, res) {
  const userId = req.params?.id || req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'INVALID_INPUT', details: { userId: ['Required'] } });

  const doc = readUsers();
  const user = doc.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
  if (user.role === 'admin') return res.status(400).json({ error: 'CANNOT_REJECT_ADMIN' });

  user.approved = false;
  user.status = 'rejected';
  user.rejected_at = new Date().toISOString();
  user.rejected_by = req.user?.username || 'admin';
  writeUsers(doc);

  return res.json({ ok: true });
}

export function setUserPassword(req, res) {
  const userId = req.params?.id;
  const schema = z.object({ newPassword: z.string().min(6).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!userId) return res.status(400).json({ error: 'INVALID_INPUT', details: { userId: ['Required'] } });
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

  const doc = readUsers();
  const user = doc.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'NOT_FOUND' });

  user.password_hash = bcrypt.hashSync(parsed.data.newPassword, 10);
  user.password_updated_at = new Date().toISOString();
  writeUsers(doc);

  return res.json({ ok: true });
}