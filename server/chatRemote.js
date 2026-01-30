// chatRemote.js - Node helper to call hosting PHP chat API
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";
import FormData from "form-data";
import fs from "node:fs";

const CHAT_REMOTE_URL = process.env.CHAT_REMOTE_URL || "";
const STORAGE_TOKEN = process.env.STORAGE_TOKEN || "";
const TIMEOUT_MS = parseInt(process.env.REMOTE_CHAT_TIMEOUT_MS || "5000", 10);

function pickRequester(url) {
  return url.protocol === "https:" ? httpsRequest : httpRequest;
}

async function requestJson({ url, method = "GET", headers = {}, body = null }) {
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
              reject(new Error(`chat remote error ${res.statusCode}: ${data}`));
              return;
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`chat remote parse error: ${String(e)} body=${(data || "").slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error("chat remote timeout")));
    if (body) req.write(body);
    req.end();
  });
}

function requireUrl() {
  if (!CHAT_REMOTE_URL) throw new Error("Missing env CHAT_REMOTE_URL");
  return CHAT_REMOTE_URL;
}

function absolutizeUrl(maybeRelative) {
  try {
    if (!maybeRelative) return maybeRelative;
    const base = requireUrl();
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}


export async function startDm({ userA, userB }) {
  const base = requireUrl();
  return await requestJson({
    url: `${base}?action=start_dm`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_a: userA, user_b: userB }),
  });
}

export async function listConversations({ user }) {
  const base = requireUrl();
  return await requestJson({ url: `${base}?action=conversations&user=${encodeURIComponent(user)}` });
}

export async function listMessages({ conversationId, afterId = 0, limit = 50 }) {
  const base = requireUrl();
  const qs = new URLSearchParams({
    action: "messages",
    conversation_id: String(conversationId),
    after_id: String(afterId),
    limit: String(limit),
  });
  const r = await requestJson({ url: `${base}?${qs.toString()}` });
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
  const base = requireUrl();
  return await requestJson({
    url: `${base}?action=send`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, sender_id: senderId, body }),
  });
}

export async function uploadAttachment({ conversationId, senderId, filePath, originalName, mime }) {
  const base = requireUrl();
  const u = new URL(`${base}?action=upload`);

  const form = new FormData();
  form.append("conversation_id", String(conversationId));
  form.append("sender_id", senderId);
  form.append("file", fs.createReadStream(filePath), { filename: originalName, contentType: mime });

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
              reject(new Error(`chat remote upload error ${res.statusCode}: ${data}`));
              return;
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`chat remote upload parse error: ${String(e)} body=${(data || "").slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(parseInt(process.env.REMOTE_CHAT_UPLOAD_TIMEOUT_MS || "15000", 10), () =>
      req.destroy(new Error("chat remote upload timeout"))
    );
    form.pipe(req);
  });
  if (r?.ok && r?.attachment && r.attachment.url) {
    r.attachment.url = absolutizeUrl(r.attachment.url);
  }
  return r;
}
