import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { JWT_SECRET, JWT_EXPIRES_IN, DATA_DIR, ensureDataDir } from './config.js';

const USERS_FILE = process.env.USERS_FILE || path.join(DATA_DIR, 'users.json');

export function readUsers() {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) {
    const hash = bcrypt.hashSync('admin1234', 10);
    const seed = {
      users: [
        {
          id: 'u_admin',
          username: 'admin',
          password_hash: hash,
          role: 'admin',
          approved: true,
          created_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: 'system',
        },
      ],
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  const raw = fs.readFileSync(USERS_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  // Backward/forward compatible: allow either { users: [...] } or plain [...]
  if (Array.isArray(parsed)) return { users: parsed };
  if (parsed && Array.isArray(parsed.users)) return parsed;
  return { users: [] };
}

function writeUsers(doc) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(doc, null, 2), 'utf-8');
}

export function issueToken(user) {
  // Only include safe fields in JWT.
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || '';
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
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
