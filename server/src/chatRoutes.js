// chatRoutes.js - Express routes that proxy to hosting chat.php
import express from "express";
import multer from "multer";
import os from "node:os";
import fs from "node:fs/promises";

import { startDm, listConversations, listMessages, sendMessage, uploadAttachment } from "./chatRemote.js";

export function createChatRouter({ getSessionUserId }) {
  const router = express.Router();
  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  router.get("/conversations", async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    try {
      const r = await listConversations({ user: userId });
      res.json(r);
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  router.post("/start-dm", express.json(), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    const peer = req.body?.peer;
    if (!peer) return res.status(400).json({ ok: false, error: "missing peer" });
    try {
      const r = await startDm({ userA: userId, userB: peer });
      res.json(r);
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  router.get("/messages", async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const conversationId = parseInt(req.query.conversationId || "0", 10);
    const afterId = parseInt(req.query.afterId || "0", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    if (!conversationId) return res.status(400).json({ ok: false, error: "invalid conversationId" });

    try {
      const r = await listMessages({ conversationId, afterId, limit });
      res.json(r);
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  router.post("/send", express.json(), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const conversationId = parseInt(req.body?.conversationId || "0", 10);
    const body = String(req.body?.body || "");
    if (!conversationId) return res.status(400).json({ ok: false, error: "invalid conversationId" });

    try {
      const r = await sendMessage({ conversationId, senderId: userId, body });
      res.json(r);
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  router.post("/upload", upload.single("file"), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const conversationId = parseInt(req.body?.conversationId || "0", 10);
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
      res.json(r);
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    } finally {
      await fs.unlink(req.file.path).catch(() => {});
    }
  });

  return router;
}
