// server/chatRemote.js - Node helper to call hosting PHP chat API (MySQL via PHP)
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";
import FormData from "form-data";
import fs from "node:fs";

const CHAT_REMOTE_URL = process.env.CHAT_REMOTE_URL || "";
const STORAGE_TOKEN = process.env.STORAGE_TOKEN || "";
const TIMEOUT_MS = parseInt(process.env.REMOTE_CHAT_TIMEOUT_MS || "5000", 10);

function getBaseUrl() {
  const base = String(CHAT_REMOTE_URL || "").trim();
  return base ? base : null;
}

function pickRequester(url) {
  return url.protocol === "https:" ? httpsRequest : httpRequest;
}

function isConnRefused(err) {
  const code = err?.code || "";
  const msg = String(err?.message || "");
  return code === "ECONNREFUSED" || msg.includes("ECONNREFUSED");
}

function withHttpFallback(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return null;
    u.protocol = "http:";
    u.port = ""; // default 80
    return u.toString();
  } catch {
    return null;
  }
}

function absolutizeUrl(maybeRelative) {
  try {
    if (!maybeRelative) return maybeRelative;
    const base = getBaseUrl();
    if (!base) return maybeRelative;
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

async function requestJsonOnce({ url, method = "GET", headers = {}, body = null, timeoutMs = TIMEOUT_MS }) {
  const u = new URL(url);
  const reqFn = pickRequester(u);

  return await new Promise((resolve, reject) => {
    const req = reqFn(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          Connection: "close",
          ...(STORAGE_TOKEN ? { "X-Storage-Token": STORAGE_TOKEN } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            if (!res.statusCode || res.statusCode >= 400 || parsed.ok === false) {
              const e = new Error(`chat remote error ${res.statusCode}: ${(data || "").slice(0, 300)}`);
              // @ts-ignore
              e.statusCode = res.statusCode;
              throw e;
            }
            resolve(parsed);
          } catch (e) {
            // If we threw above, pass through; otherwise parse error
            // @ts-ignore
            if (e?.statusCode) return reject(e);
            reject(new Error(`chat remote parse error: ${String(e)} body=${(data || "").slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("chat remote timeout")));

    if (body != null) req.write(body);
    req.end();
  });
}

async function requestJson(opts) {
  // Retry strategy:
  // - If base URL is https but the hosting only serves http, Node will throw ECONNREFUSED :443.
  //   In that case, retry once with http://... (same host/path).
  try {
    return await requestJsonOnce(opts);
  } catch (err) {
    const fallback = withHttpFallback(opts.url);
    if (fallback && isConnRefused(err)) {
      return await requestJsonOnce({ ...opts, url: fallback });
    }
    throw err;
  }
}

export async function startDm({ userA, userB }) {
  const base = getBaseUrl();
  if (!base) return { ok: false, error: "CHAT_REMOTE_URL is not set" };

  return await requestJson({
    url: `${base}?action=start_dm`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_a: userA, user_b: userB }),
  });
}

export async function listConversations({ user }) {
  const base = getBaseUrl();
  if (!base) return { ok: false, error: "CHAT_REMOTE_URL is not set" };

  return await requestJson({ url: `${base}?action=conversations&user=${encodeURIComponent(user)}` });
}

export async function listMessages({ conversationId, afterId = 0, limit = 50 }) {
  const base = getBaseUrl();
  if (!base) return { ok: false, error: "CHAT_REMOTE_URL is not set" };

  const qs = new URLSearchParams({
    action: "messages",
    conversation_id: String(conversationId),
    after_id: String(afterId),
    limit: String(limit),
  });

  const r = await requestJson({ url: `${base}?${qs.toString()}` });

  // Make attachment URLs absolute for the browser
  if (r?.ok && Array.isArray(r.messages)) {
    for (const msg of r.messages) {
      if (Array.isArray(msg.attachments)) {
        for (const a of msg.attachments) {
          a.url = absolutizeUrl(a.url);
        }
      }
    }
  }

  return r;
}

export async function sendMessage({ conversationId, senderId, body }) {
  const base = getBaseUrl();
  if (!base) return { ok: false, error: "CHAT_REMOTE_URL is not set" };

  return await requestJson({
    url: `${base}?action=send`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, sender_id: senderId, body }),
  });
}

async function uploadOnce({ url, timeoutMs, form }) {
  const u = new URL(url);
  const reqFn = pickRequester(u);

  return await new Promise((resolve, reject) => {
    const req = reqFn(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          ...form.getHeaders(),
          Accept: "application/json",
          "Accept-Encoding": "identity",
          Connection: "close",
          ...(STORAGE_TOKEN ? { "X-Storage-Token": STORAGE_TOKEN } : {}),
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            if (!res.statusCode || res.statusCode >= 400 || parsed.ok === false) {
              const e = new Error(`chat remote upload error ${res.statusCode}: ${(data || "").slice(0, 300)}`);
              // @ts-ignore
              e.statusCode = res.statusCode;
              throw e;
            }
            resolve(parsed);
          } catch (e) {
            // @ts-ignore
            if (e?.statusCode) return reject(e);
            reject(new Error(`chat remote upload parse error: ${String(e)} body=${(data || "").slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("chat remote upload timeout")));

    form.pipe(req);
  });
}

export async function uploadAttachment({ conversationId, senderId, filePath, originalName, mime }) {
  const base = getBaseUrl();
  if (!base) return { ok: false, error: "CHAT_REMOTE_URL is not set" };

  const url = `${base}?action=upload`;
  const form = new FormData();
  form.append("conversation_id", String(conversationId));
  form.append("sender_id", String(senderId));
  form.append("file", fs.createReadStream(filePath), { filename: originalName, contentType: mime });

  const timeoutMs = parseInt(process.env.REMOTE_CHAT_UPLOAD_TIMEOUT_MS || "15000", 10);

  try {
    const r = await uploadOnce({ url, timeoutMs, form });
    if (r?.ok && r?.attachment?.url) r.attachment.url = absolutizeUrl(r.attachment.url);
    return r;
  } catch (err) {
    const fallback = withHttpFallback(url);
    if (fallback && isConnRefused(err)) {
      const r = await uploadOnce({ url: fallback, timeoutMs, form });
      if (r?.ok && r?.attachment?.url) r.attachment.url = absolutizeUrl(r.attachment.url);
      return r;
    }
    throw err;
  }
}
