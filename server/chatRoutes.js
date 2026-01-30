// server/chatRoutes.js - Express routes that proxy to hosting chat.php
import express from "express";
import multer from "multer";
import os from "node:os";
import fs from "node:fs/promises";

import { startDm, listConversations, listMessages, sendMessage, uploadAttachment } from "./chatRemote.js";

// In-memory online presence (best-effort).
// - Updated when a user hits any chat endpoint.
// - Consider a user "online" if they were seen within the last ONLINE_TTL_MS.
const lastSeenMap = new Map();
const ONLINE_TTL_MS = parseInt(process.env.CHAT_ONLINE_TTL_MS || "60000", 10);

function touch(userId) {
  if (!userId) return;
  lastSeenMap.set(String(userId), Date.now());
}

function isOnline(userId) {
  const t = lastSeenMap.get(String(userId));
  if (!t) return false;
  return Date.now() - t < ONLINE_TTL_MS;
}

/**
 * Create chat router.
 *
 * Required:
 * - getSessionUserId(req): returns current logged-in user id (string)
 *
 * Optional:
 * - listUsers(): returns array of users from your auth store (used for DM user combo)
 *   Expected shape: [{ id, username, email, name, org, status, role }]
 */
export function createChatRouter({ getSessionUserId, listUsers } = {}) {
  const router = express.Router();

  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  // Approved user list for DM combobox
  router.get("/users", async (req, res) => {
    const userId = getSessionUserId?.(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    touch(userId);

    if (typeof listUsers !== "function") {
      return res.status(500).json({ ok: false, error: "server missing listUsers()" });
    }

    try {
      const all = await listUsers();

      const users = (Array.isArray(all) ? all : [])
        .filter((u) => (u.status || "approved") === "approved")
        .map((u) => ({
          id: u.id || u.username || u.email,
          username: u.username,
          email: u.email,
          name: u.name,
          org: u.org,
          role: u.role || "user",
          status: u.status || "approved",
          online: isOnline(u.id || u.username || u.email),
        }))
        .filter((u) => u.id) // must have an id
        .sort((a, b) => String(a.org || "").localeCompare(String(b.org || "")) || String(a.name || "").localeCompare(String(b.name || "")));

      return res.json({ ok: true, users });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  router.get("/conversations", async (req, res) => {
    const userId = getSessionUserId?.(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    touch(userId);

    try {
      const r = await listConversations({ user: userId });
      if (r?.ok === false) return res.status(502).json(r);
      return res.json(r);
    } catch (e) {
      return res.status(502).json({ ok: false, error: String(e?.message || e) });
    }
  });

  router.post("/start-dm", express.json(), async (req, res) => {
    const userId = getSessionUserId?.(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    touch(userId);

    const peer = String(req.body?.peer || "").trim();
    if (!peer) return res.status(400).json({ ok: false, error: "missing peer" });

    try {
      const r = await startDm({ userA: userId, userB: peer });
      if (r?.ok === false) return res.status(502).json(r);
      return res.json(r);
    } catch (e) {
      return res.status(502).json({ ok: false, error: String(e?.message || e) });
    }
  });

  router.get("/messages", async (req, res) => {
    const userId = getSessionUserId?.(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    touch(userId);

    const conversationId = parseInt(String(req.query.conversationId || "0"), 10);
    const afterId = parseInt(String(req.query.afterId || "0"), 10);
    const limit = Math.max(1, Math.min(200, parseInt(String(req.query.limit || "50"), 10)));

    if (!conversationId) return res.status(400).json({ ok: false, error: "invalid conversationId" });

    try {
      const r = await listMessages({ conversationId, afterId, limit });
      if (r?.ok === false) return res.status(502).json(r);
      return res.json(r);
    } catch (e) {
      return res.status(502).json({ ok: false, error: String(e?.message || e) });
    }
  });

  router.post("/send", express.json(), async (req, res) => {
    const userId = getSessionUserId?.(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    touch(userId);

    const conversationId = parseInt(String(req.body?.conversationId || "0"), 10);
    const body = String(req.body?.body || "");
    if (!conversationId) return res.status(400).json({ ok: false, error: "invalid conversationId" });

    try {
      const r = await sendMessage({ conversationId, senderId: userId, body });
      if (r?.ok === false) return res.status(502).json(r);
      return res.json(r);
    } catch (e) {
      return res.status(502).json({ ok: false, error: String(e?.message || e) });
    }
  });

  router.post("/upload", upload.single("file"), async (req, res) => {
    const userId = getSessionUserId?.(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    touch(userId);

    const conversationId = parseInt(String(req.body?.conversationId || "0"), 10);
    if (!conversationId) return res.status(400).json({ ok: false, error: "invalid conversationId" });
    if (!req.file) return res.status(400).json({ ok: false, error: "missing file" });

    try {
      const r = await uploadAttachment({
        conversationId,
        senderId: userId,
        filePath: req.file.path,
        originalName: req.file.originalname,
        mime: req.file.mimetype,
      });
      if (r?.ok === false) return res.status(502).json(r);
      return res.json(r);
    } catch (e) {
      return res.status(502).json({ ok: false, error: String(e?.message || e) });
    } finally {
      await fs.unlink(req.file.path).catch(() => {});
    }
  });

  return router;
}
