import { apiFetch, getToken } from "../api.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function chatStartDm(peer) {
  return apiFetch("/api/chat/start-dm", { method: "POST", body: { peer }, auth: true });
}

export async function chatListConversations() {
  return apiFetch("/api/chat/conversations", { auth: true });
}

export async function chatListMessages(conversationId, { afterId = 0, limit = 200 } = {}) {
  const qs = new URLSearchParams({
    conversationId: String(conversationId || ""),
    afterId: String(afterId || 0),
    limit: String(limit || 200),
  });
  return apiFetch(`/api/chat/messages?${qs.toString()}`, { auth: true });
}

export async function chatSend(conversationId, body) {
  return apiFetch("/api/chat/send", { method: "POST", body: { conversationId, body }, auth: true });
}

export async function chatListUsers() {
  return apiFetch("/api/chat/users", { auth: true });
}

// Upload attachment with progress callback.
// NOTE: fetch() does not reliably expose upload progress; use XMLHttpRequest.
export function chatUpload(conversationId, file, { onProgress } = {}) {
  const token = getToken();

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("conversationId", String(conversationId));
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/chat/upload`, true);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      if (typeof onProgress === "function") onProgress(pct);
    };

    xhr.onload = () => {
      try {
        const text = xhr.responseText || "";
        const json = text ? JSON.parse(text) : { ok: false, error: "empty_response" };
        if (xhr.status >= 200 && xhr.status < 300) return resolve(json);
        return reject(new Error(json?.error || json?.message || `${xhr.status}`));
      } catch (e) {
        return reject(new Error(`upload_parse_failed: ${String(e?.message || e)}`));
      }
    };
    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.ontimeout = () => reject(new Error("upload_timeout"));
    xhr.timeout = 30000;

    xhr.send(form);
  });
}

export async function chatDeleteConversation(conversationId) {
  return apiFetch("/api/chat/delete", { method: "POST", body: { conversationId }, auth: true });
}
