// server/chatRemote.js
// Robust HTTP client for calling remote PHP (chat.php) even when hosting sends malformed chunked responses.
// - Forces 'Accept-Encoding: identity' and 'Connection: close'
// - Uses insecureHTTPParser to tolerate some broken chunked encodings on old/proxied servers
// - Retries https->http when 443 is refused
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const DEFAULT_TIMEOUT_MS = Number(process.env.REMOTE_CHAT_TIMEOUT_MS || 5000);
const DEFAULT_UPLOAD_TIMEOUT_MS = Number(process.env.REMOTE_CHAT_UPLOAD_TIMEOUT_MS || 15000);

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
          "Accept-Encoding": "identity", // avoid gzip/chunk mishaps
          "Connection": "close",         // avoid keep-alive chunk parser issues
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
          resolve({
            status: res.statusCode || 0,
            headers: res.headers || {},
            text,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Remote request timeout after ${timeoutMs}ms`));
    });
    req.on("error", (err) => reject(err));

    if (body) req.write(body);
    req.end();
  });
}

function safeJsonParse(text) {
  // Some hosts prepend BOM/whitespace or PHP warnings. Try to recover by extracting the first JSON object/array.
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const firstBrace = trimmed.indexOf("{");
    const firstBracket = trimmed.indexOf("[");
    const idx = [firstBrace, firstBracket].filter((n) => n >= 0).sort((a,b)=>a-b)[0];
    if (idx === undefined) throw new Error("Invalid JSON from remote");
    const candidate = trimmed.slice(idx);
    return JSON.parse(candidate);
  }
}

export function getChatRemoteUrl() {
  const url = process.env.CHAT_REMOTE_URL;
  if (!url) throw new Error("Missing env CHAT_REMOTE_URL");
  return url;
}

export async function chatRemoteJson(action, payload, { isUpload=false } = {}) {
  const baseUrl = getChatRemoteUrl();
  const token = process.env.STORAGE_TOKEN || "";
  const timeoutMs = isUpload ? DEFAULT_UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  const url = new URL(baseUrl);
  url.searchParams.set("action", action);

  const body = JSON.stringify(payload ?? {});
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body).toString(),
    ...(token ? { "X-Storage-Token": token } : {}),
  };

  const attempt = async (u) => {
    const resp = await requestText(u.toString(), { method: "POST", headers, body, timeoutMs });
    if (resp.status >= 400) {
      throw new Error(`Remote ${action} failed: HTTP ${resp.status} ${resp.text?.slice(0,200) || ""}`);
    }
    return safeJsonParse(resp.text || "{}");
  };

  try {
    return await attempt(url);
  } catch (err) {
    // Common: ECONNREFUSED to 443 when https isn't actually supported
    const msg = String(err?.message || err);
    if (url.protocol === "https:" && (msg.includes("ECONNREFUSED") || msg.includes(":443"))) {
      const httpUrl = new URL(url.toString());
      httpUrl.protocol = "http:";
      return await attempt(httpUrl);
    }
    // If this is the chunk-size parse error, it's often a broken chunked response; the insecure parser + identity helps,
    // but if still failing, surface a clearer hint.
    if (msg.includes("Invalid character in chunk size") || msg.includes("Parse Error")) {
      throw new Error(
        "Remote response is malformed (chunked encoding). " +
        "Fix by disabling compression / output buffering in chat.php (see provided patch) or serve over plain http."
      );
    }
    throw err;
  }
}
