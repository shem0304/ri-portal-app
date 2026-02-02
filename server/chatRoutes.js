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

  // Remote `chat.php` has had multiple schema variants in the wild.
  // The client expects:
  // - /conversations -> { ok, conversations: [...] }
  // - /messages      -> { ok, messages: [...] }
  // And messages should expose `attachments` (array) when `file_url` exists.
  function normalizeConversations(resp) {
    if (!resp || typeof resp !== "object") return resp;
    if (Array.isArray(resp.conversations)) return resp;
    if (Array.isArray(resp.items)) {
      return { ...resp, conversations: resp.items };
    }
    return resp;
  }

  function normalizeMessages(resp) {
    if (!resp || typeof resp !== "object") return resp;
    const arr = Array.isArray(resp.messages) ? resp.messages : Array.isArray(resp.items) ? resp.items : null;
    if (!arr) return resp;

    const messages = arr.map((m) => {
      const fileUrl = m?.file_url || m?.fileUrl || "";
      const name = m?.file_name || m?.filename || (fileUrl ? String(fileUrl).split("/").pop() : "");
      const size = m?.file_size || m?.size;

      // If client expects `attachments`, synthesize from file_url.
      const attachments = Array.isArray(m?.attachments)
        ? m.attachments
        : fileUrl
          ? [{ id: "file", url: fileUrl, filename: name || "file", size }]
          : [];

      return {
        ...m,
        // Client renders body only; keep aliases.
        body: m?.body ?? m?.text ?? m?.message ?? "",
        text: m?.text ?? m?.body ?? "",
        message: m?.message ?? m?.body ?? "",
        file_url: fileUrl,
        fileUrl,
        attachments,
      };
    });

    return { ...resp, messages };
  }

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
      return res.json(normalizeConversations(r));
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
      return res.json(normalizeMessages(r));
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
      // 1) Upload to remote hosting (returns file_url)
      const up = await uploadAttachment({
        conversationId,
        senderId: userId,
        filePath: req.file.path,
        originalName: req.file.originalname,
        mime: req.file.mimetype,
      });

      if (up?.ok === false) return res.status(502).json(up);
      const fileUrl = up?.file_url || up?.fileUrl || "";
      if (!fileUrl) {
        return res.status(502).json({ ok: false, error: "upload_ok_but_missing_file_url" });
      }

      // Newer chat.php (attachments-enabled) creates the message + chat_attachments row
      // inside the remote `action=upload` and returns message_id / attachment_id.
      // If present, DO NOT create a second message here (avoid duplicates).
      const remoteMessageId = up?.message_id || up?.messageId || 0;
      const remoteAttachmentId = up?.attachment_id || up?.attachmentId || 0;
      if (remoteMessageId) {
        return res.json({
          ok: true,
          file_url: fileUrl,
          fileUrl,
          name: up?.name || req.file.originalname,
          size: up?.size || req.file.size,
          mime: up?.mime || req.file.mimetype,
          storage_path: up?.storage_path || up?.storagePath,
          message_id: remoteMessageId,
          attachment_id: remoteAttachmentId,
        });
      }

      // 2) Create a chat message that references that file.
      // The client does not send a separate `/send` call for attachments.
      const sent = await sendMessage({ conversationId, senderId: userId, body: "", fileUrl });
      if (sent?.ok === false) return res.status(502).json(sent);

      // Return a normalized payload the client can use immediately.
      return res.json({
        ok: true,
        file_url: fileUrl,
        fileUrl,
        name: up?.name || req.file.originalname,
        size: up?.size || req.file.size,
        message_id: sent?.id,
      });
    } catch (e) {
      return res.status(502).json({ ok: false, error: String(e?.message || e) });
    } finally {
      await fs.unlink(req.file.path).catch(() => {});
    }
  });

  return router;
}
