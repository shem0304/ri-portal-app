// server/chatRemote.js
// Proxy client to hosting PHP chat.php (robust for legacy hosting / PHP 5.2)
// Key points:
// - Uses application/x-www-form-urlencoded for non-upload calls (avoids json_decode dependency on PHP side)
// - Upload uses multipart/form-data via form-data package
// - Forces identity encoding + close connection to avoid broken chunked responses
// - Uses insecureHTTPParser for tolerance

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import fs from "node:fs";
import FormData from "form-data";

const DEFAULT_TIMEOUT_MS = Number(process.env.REMOTE_CHAT_TIMEOUT_MS || 8000);
const DEFAULT_UPLOAD_TIMEOUT_MS = Number(process.env.REMOTE_CHAT_UPLOAD_TIMEOUT_MS || 20000);

function getBaseUrl() {
  const u = process.env.CHAT_REMOTE_URL;
  if (!u) throw new Error("Missing env CHAT_REMOTE_URL");
  return u;
}

function toFormBody(obj) {
  const p = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    p.set(k, String(v));
  });
  return p.toString();
}

function requestText(urlStr, { method="GET", headers={}, body=null, timeoutMs=DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Accept-Encoding": "identity",
          "Connection": "close",
          ...headers,
        },
        timeout: timeoutMs,
        insecureHTTPParser: true,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          resolve({ status: res.statusCode || 0, headers: res.headers || {}, text });
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error(`Remote request timeout after ${timeoutMs}ms`)));
    req.on("error", reject);

    // IMPORTANT:
    // - Strings/Buffers can be written via req.write.
    // - `form-data` instances are streams. They must be piped, not written.
    //   Otherwise Node throws:
    //   "The 'chunk' argument must be of type string or an instance of Buffer... Received an instance of FormData"
    if (body && typeof body.pipe === "function") {
      body.on?.("error", reject);
      body.pipe(req);
      return;
    }

    if (body) req.write(body);
    req.end();
  });
}

function safeJsonParse(text) {
  const trimmed = (text || "").replace(/^\uFEFF/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Try to salvage: find first { or [
    const bi = trimmed.indexOf("{");
    const ai = trimmed.indexOf("[");
    const idx = [bi, ai].filter((n) => n >= 0).sort((a,b)=>a-b)[0];
    if (idx === undefined) throw e;
    return JSON.parse(trimmed.slice(idx));
  }
}

async function postForm(action, fields) {
  const token = process.env.STORAGE_TOKEN || "";
  const base = new URL(getBaseUrl());
  base.searchParams.set("action", action);

  const body = toFormBody(fields);
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    "Content-Length": Buffer.byteLength(body).toString(),
    ...(token ? { "X-Storage-Token": token } : {}),
  };

  const attempt = async (u) => {
    const resp = await requestText(u.toString(), { method: "POST", headers, body, timeoutMs: DEFAULT_TIMEOUT_MS });
    if (resp.status >= 400) {
      throw new Error(`chat remote error ${resp.status}: ${resp.text || ""}`);
    }
    return safeJsonParse(resp.text || "{}");
  };

  try {
    return await attempt(base);
  } catch (err) {
    const msg = String(err?.message || err);
    if (base.protocol === "https:" && (msg.includes("ECONNREFUSED") || msg.includes(":443"))) {
      const httpUrl = new URL(base.toString());
      httpUrl.protocol = "http:";
      return await attempt(httpUrl);
    }
    if (msg.includes("Invalid character in chunk size") || msg.includes("Parse Error")) {
      throw new Error("Remote response is malformed (chunked encoding). Ensure chat.php has display_errors=0 and gzip disabled.");
    }
    throw err;
  }
}

export async function startDm({ userA, userB }) {
  // chat.php expects user_a/user_b
  return postForm("start_dm", { user_a: userA, user_b: userB });
}

export async function listConversations({ user }) {
  return postForm("conversations", { user });
}

export async function listMessages({ conversationId, afterId = 0, limit = 200 }) {
  // chat.php expects conversation_id, after_id
  return postForm("messages", { conversation_id: conversationId, after_id: afterId, limit });
}

export async function sendMessage({ conversationId, senderId, body, text, fileUrl }) {
  // chat.php expects conversation_id, sender_id, text, file_url
  const msgText = (text ?? body ?? "").toString();
  return postForm("send", {
    conversation_id: conversationId,
    sender_id: senderId,
    text: msgText,
    file_url: fileUrl || "",
  });
}

export async function uploadAttachment({ conversationId, senderId, filePath, originalName, mime }) {
  const token = process.env.STORAGE_TOKEN || "";
  const base = new URL(getBaseUrl());
  base.searchParams.set("action", "upload");

  const form = new FormData();
  form.append("conversation_id", String(conversationId));
  form.append("sender_id", String(senderId));
  form.append("file", fs.createReadStream(filePath), { filename: originalName || "file", contentType: mime || "application/octet-stream" });

  const headers = {
    ...form.getHeaders(),
    ...(token ? { "X-Storage-Token": token } : {}),
    "Accept-Encoding": "identity",
    "Connection": "close",
  };

  const attempt = async (u) => {
    const resp = await requestText(u.toString(), { method: "POST", headers, body: form, timeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS });
    if (resp.status >= 400) throw new Error(`chat remote error ${resp.status}: ${resp.text || ""}`);
    return safeJsonParse(resp.text || "{}");
  };

  try {
    return await attempt(base);
  } catch (err) {
    const msg = String(err?.message || err);
    if (base.protocol === "https:" && (msg.includes("ECONNREFUSED") || msg.includes(":443"))) {
      const httpUrl = new URL(base.toString());
      httpUrl.protocol = "http:";
      return await attempt(httpUrl);
    }
    throw err;
  }
}

export async function deleteConversation({ conversationId, userId }) {
  return postForm("delete_conversation", { conversation_id: conversationId, user_id: userId });
}
