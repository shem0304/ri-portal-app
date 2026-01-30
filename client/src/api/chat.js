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

export async function chatUpload(conversationId, file) {
  const token = getToken();
  const form = new FormData();
  form.append("conversationId", String(conversationId));
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/chat/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error || j?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
