import React from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  TextField,
  Button,
  IconButton,
  Alert,
  Autocomplete,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";

import {
  chatListConversations,
  chatListMessages,
  chatSend,
  chatUpload,
  chatStartDm,
  chatListUsers,
} from "../../api/chat.js";

function convTitle(c) {
  // chat.php returns peer_id for dm; fall back gracefully
  return c?.peer_id || c?.title || `대화 #${c?.id ?? ""}`;
}

function displayName(u) {
  const org = String(u?.org || "").trim();
  const name = String(u?.name || "").trim();
  const fallback = String(u?.username || u?.email || u?.id || "").trim();
  const base = [org, name].filter(Boolean).join(" ");
  return base || fallback || "(알 수 없음)";
}

export default function Chat() {
  const [convs, setConvs] = React.useState([]);
  const [activeId, setActiveId] = React.useState(null);
  const [msgs, setMsgs] = React.useState([]);
  const [afterId, setAfterId] = React.useState(0);

  const [text, setText] = React.useState("");
  const [users, setUsers] = React.useState([]);
  const [peerUser, setPeerUser] = React.useState(null);

  const [error, setError] = React.useState("");
  const pollRef = React.useRef(null);
  const usersPollRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  const userLabelMap = React.useMemo(() => {
    const m = new Map();
    for (const u of users || []) {
      if (u?.id) m.set(String(u.id), displayName(u));
    }
    return m;
  }, [users]);

  const loadUsers = React.useCallback(async () => {
    try {
      const r = await chatListUsers();
      if (!r.ok) throw new Error(r.error || "사용자 목록 조회 실패");
      setUsers(r.users || []);
      setError("");
    } catch (e) {
      // Don't block the whole chat UI for this; but surface the error.
      setError(String(e?.message || e));
    }
  }, []);

  const loadConvs = React.useCallback(async () => {
    try {
      const r = await chatListConversations();
      if (!r.ok) throw new Error(r.error || "대화 목록 조회 실패");
      setConvs(r.conversations || []);
      setError("");
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, []);

  const loadMessages = React.useCallback(
    async (conversationId, { reset = false } = {}) => {
      try {
        const r = await chatListMessages(conversationId, { afterId: reset ? 0 : afterId, limit: 200 });
        if (!r.ok) throw new Error(r.error || "메시지 조회 실패");
        const newMsgs = r.messages || [];
        if (reset) setMsgs(newMsgs);
        else if (newMsgs.length) setMsgs((prev) => [...prev, ...newMsgs]);
        if (newMsgs.length) setAfterId(newMsgs[newMsgs.length - 1].id);
        setError("");
      } catch (e) {
        setError(String(e?.message || e));
      }
    },
    [afterId]
  );

  React.useEffect(() => {
    loadUsers();
    loadConvs();
  }, [loadUsers, loadConvs]);

  React.useEffect(() => {
    // refresh online status periodically
    if (usersPollRef.current) clearInterval(usersPollRef.current);
    usersPollRef.current = setInterval(() => loadUsers(), 7000);
    return () => {
      if (usersPollRef.current) clearInterval(usersPollRef.current);
      usersPollRef.current = null;
    };
  }, [loadUsers]);

  React.useEffect(() => {
    // polling (no websocket)
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeId) return undefined;
    pollRef.current = setInterval(() => loadMessages(activeId), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [activeId, loadMessages]);

  async function onSelectConversation(id) {
    setActiveId(id);
    setAfterId(0);
    await loadMessages(id, { reset: true });
  }

  async function onStartDm() {
    try {
      const peerId = String(peerUser?.id || "").trim();
      if (!peerId) return;

      const r = await chatStartDm(peerId);
      if (!r.ok) throw new Error(r.error || "대화 시작 실패");
      await loadConvs();
      if (r.conversation_id) await onSelectConversation(r.conversation_id);
      setPeerUser(null);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function onSend() {
    try {
      if (!activeId) return;
      const body = String(text || "").trim();
      if (!body) return;
      const r = await chatSend(activeId, body);
      if (!r.ok) throw new Error(r.error || "전송 실패");
      setText("");
      await loadMessages(activeId);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function onPickFile(e) {
    try {
      if (!activeId) return;
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) throw new Error("파일은 10MB 이하만 업로드할 수 있습니다.");
      const r = await chatUpload(activeId, file);
      if (!r.ok) throw new Error(r.error || "파일 업로드 실패");
      await loadMessages(activeId, { reset: true });
    } catch (e2) {
      setError(String(e2?.message || e2));
    }
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        채팅
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper sx={{ width: { xs: "100%", md: 360 }, p: 1 }}>
          <Typography variant="subtitle1" sx={{ px: 1, pb: 1 }}>
            대화
          </Typography>

          <Stack spacing={1} sx={{ px: 1, pb: 1 }}>
            <Autocomplete
              size="small"
              options={users || []}
              value={peerUser}
              onChange={(_e, v) => setPeerUser(v)}
              getOptionLabel={(o) => displayName(o)}
              isOptionEqualToValue={(o, v) => String(o?.id) === String(v?.id)}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: option.online ? "#2e7d32" : "#9e9e9e",
                        flex: "0 0 auto",
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {displayName(option)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                        {option.id}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              )}
              renderInput={(params) => <TextField {...params} placeholder="상대 선택 (승인된 사용자)" />}
            />
            <Button variant="contained" onClick={onStartDm} disabled={!peerUser?.id}>
              시작
            </Button>
          </Stack>

          <Divider />
          <List dense>
            {convs.map((c) => (
              <ListItemButton key={c.id} selected={activeId === c.id} onClick={() => onSelectConversation(c.id)}>
                <ListItemText
                  primary={convTitle(c)}
                  secondary={c.last_body ? `${c.last_body}` : undefined}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            ))}
            {!convs.length ? (
              <Typography variant="body2" sx={{ p: 2, color: "text.secondary" }}>
                대화가 없습니다.
              </Typography>
            ) : null}
          </List>
        </Paper>

        <Paper sx={{ flex: 1, p: 1, minHeight: 520, display: "flex", flexDirection: "column" }}>
          <Typography variant="subtitle1" sx={{ px: 1, pb: 1 }}>
            메시지
          </Typography>

          <Divider />
          <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
            {msgs.map((m) => {
              const senderId = String(m.sender_id || "");
              const senderLabel = userLabelMap.get(senderId) || senderId;
              return (
                <Box key={m.id} sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {senderLabel} · {m.created_at}
                  </Typography>
                  {m.body ? <Typography variant="body2">{m.body}</Typography> : null}
                  {Array.isArray(m.attachments) && m.attachments.length ? (
                    <Box sx={{ mt: 0.25 }}>
                      {m.attachments.map((a) => (
                        <Typography key={a.id} variant="body2">
                          📎{" "}
                          <a href={a.url} target="_blank" rel="noreferrer">
                            {a.filename}
                          </a>
                          {a.size ? ` (${Math.round(a.size / 1024)}KB)` : ""}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              );
            })}
            {!msgs.length ? (
              <Typography variant="body2" sx={{ p: 2, color: "text.secondary" }}>
                메시지가 없습니다.
              </Typography>
            ) : null}
          </Box>

          <Divider />
          <Stack direction="row" spacing={1} sx={{ p: 1, alignItems: "center" }}>
            <IconButton onClick={() => fileInputRef.current?.click()} disabled={!activeId}>
              <AttachFileIcon />
            </IconButton>
            <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={onPickFile} />
            <TextField
              size="small"
              placeholder={activeId ? "메시지 입력…" : "대화를 선택하세요"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              fullWidth
              disabled={!activeId}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <Button variant="contained" onClick={onSend} disabled={!activeId}>
              전송
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
