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
  Avatar,
  Badge,
  Chip,
  Container,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import ChatIcon from "@mui/icons-material/Chat";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AddCommentIcon from "@mui/icons-material/AddComment";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloseIcon from "@mui/icons-material/Close";

// Used to derive "my user id" from the auth token, so we can style messages.
// (We never display raw UUIDs on the UI.)
import { getToken } from "../../api.js";

import {
  chatListConversations,
  chatListMessages,
  chatSend,
  chatUpload,
  chatStartDm,
  chatListUsers,
  chatDeleteConversation,
} from "../../api/chat.js";

function displayName(u) {
  const org = String(u?.org || "").trim();
  const name = String(u?.name || "").trim();
  const fallback = String(u?.username || u?.email || u?.id || "").trim();
  const base = [org, name].filter(Boolean).join(" ");
  return base || fallback || "(알 수 없음)";
}

function formatKoreanYMDHM(ts) {
  const s = String(ts || "").trim();
  if (!s) return "";
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}년 ${mm}월 ${dd}일 ${hh}시 ${mi}분`;
}

function formatShortTime(ts) {
  const s = String(ts || "").trim();
  if (!s) return "";
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function deriveMyUserId() {
  try {
    const t = String(getToken?.() || "").trim();
    if (!t) return "";
    const parts = t.split(".");
    if (parts.length === 3) {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
      const json = JSON.parse(decodeURIComponent(escape(atob(padded))));
      return String(json.sub || json.user_id || json.userId || json.id || json.uid || "").trim();
    }
    return t;
  } catch {
    return "";
  }
}

function convLabel(c, userLabelMap) {
  const peerId = String(c?.peer_id || c?.peerId || "").trim();
  const label = peerId ? String(userLabelMap.get(peerId) || "").trim() : "";
  return label || c?.title || "대화";
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
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
  const messagesEndRef = React.useRef(null);

  const [uploading, setUploading] = React.useState(false);

  const myUserId = React.useMemo(() => deriveMyUserId(), []);

  const userLabelMap = React.useMemo(() => {
    const m = new Map();
    for (const u of users || []) {
      if (u?.id) m.set(String(u.id), displayName(u));
    }
    return m;
  }, [users]);

  const activeConv = React.useMemo(() => {
    return convs.find(c => c.id === activeId) || null;
  }, [convs, activeId]);

  const activePeerName = React.useMemo(() => {
    if (!activeConv) return "";
    const peerId = String(activeConv?.peer_id || activeConv?.peerId || "").trim();
    return userLabelMap.get(peerId) || "대화";
  }, [activeConv, userLabelMap]);

  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [msgs, scrollToBottom]);

  const loadUsers = React.useCallback(async () => {
    try {
      const r = await chatListUsers();
      if (!r.ok) throw new Error(r.error || "사용자 목록 조회 실패");
      setUsers(r.users || []);
      setError("");
    } catch (e) {
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
    if (usersPollRef.current) clearInterval(usersPollRef.current);
    usersPollRef.current = setInterval(() => loadUsers(), 7000);
    return () => {
      if (usersPollRef.current) clearInterval(usersPollRef.current);
      usersPollRef.current = null;
    };
  }, [loadUsers]);

  React.useEffect(() => {
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

async function onDeleteConversation(conversationId) {
  const cid = parseInt(String(conversationId || "0"), 10);
  if (!cid) return;

  const ok = window.confirm("이 대화를 삭제할까요?\n삭제하면 복구할 수 없습니다.");
  if (!ok) return;

  try {
    const r = await chatDeleteConversation(cid);
    if (r?.ok === false) throw new Error(r?.error || "delete_failed");

    // If the active conversation was deleted, reset message pane.
    setConvs((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== cid) : prev));
    if (activeId === cid) {
      setActiveId(null);
      setMsgs([]);
      setAfterId(0);
    }
  } catch (e) {
    setError(String(e?.message || e));
  }
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
      setUploading(true);
      const r = await chatUpload(activeId, file);
      if (!r.ok) throw new Error(r.error || "파일 업로드 실패");
      await loadMessages(activeId, { reset: true });
    } catch (e2) {
      setError(String(e2?.message || e2));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Box sx={{ backgroundColor: '#f5f7fa', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        {/* 헤더 */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: '#003d82',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChatIcon sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant='h5' sx={{ fontWeight: 900, color: '#003d82', lineHeight: 1.2 }}>
              채팅
            </Typography>
            <Typography variant='caption' sx={{ color: '#666', fontWeight: 600 }}>
              등록된 사용자 간 실시간 메시지
            </Typography>
          </Box>
        </Stack>

        {error ? (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2, 
              borderRadius: 2,
              border: '1px solid #ef5350',
            }}
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        ) : null}

        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          {/* 왼쪽: 대화 목록 */}
          <Paper 
            sx={{ 
              width: { xs: "100%", md: 400 }, 
              borderRadius: 3,
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            {/* 새 대화 시작 */}
            <Box sx={{ p: 2.5, backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <AddCommentIcon sx={{ fontSize: 20, color: '#003d82' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#003d82' }}>
                  새 대화 시작
                </Typography>
              </Stack>
              
              <Stack spacing={1.5}>
                <Autocomplete
                  size="small"
                  options={users || []}
                  value={peerUser}
                  onChange={(_e, v) => setPeerUser(v)}
                  getOptionLabel={(o) => displayName(o)}
                  isOptionEqualToValue={(o, v) => String(o?.id) === String(v?.id)}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: "100%" }}>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <FiberManualRecordIcon 
                              sx={{ 
                                fontSize: 10, 
                                color: option.online ? '#2e7d32' : '#9e9e9e' 
                              }} 
                            />
                          }
                        >
                          <Avatar 
                            sx={{ 
                              width: 32, 
                              height: 32, 
                              backgroundColor: '#003d82',
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {getInitials(displayName(option))}
                          </Avatar>
                        </Badge>
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>
                          {displayName(option)}
                        </Typography>
                        {option.online && (
                          <Chip 
                            label="온라인" 
                            size="small" 
                            sx={{ 
                              height: 20, 
                              fontSize: 10,
                              backgroundColor: '#e8f5e9',
                              color: '#2e7d32',
                              fontWeight: 700,
                            }} 
                          />
                        )}
                      </Stack>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      placeholder="상대 선택 (승인된 사용자)"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'white',
                          borderRadius: 1,
                        },
                      }}
                    />
                  )}
                />
                <Button 
                  variant="contained" 
                  onClick={onStartDm} 
                  disabled={!peerUser?.id}
                  sx={{
                    backgroundColor: '#003d82',
                    fontWeight: 700,
                    borderRadius: 1,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: '#002a5c',
                      boxShadow: 'none',
                    },
                  }}
                >
                  대화 시작
                </Button>
              </Stack>
            </Box>

            {/* 대화 목록 */}
            <Box>
              <Box sx={{ p: 2, backgroundColor: 'white', borderBottom: '1px solid #e0e0e0' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ChatIcon sx={{ fontSize: 18, color: '#666' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#333' }}>
                    대화 목록
                  </Typography>
                  <Chip 
                    label={convs.length} 
                    size="small" 
                    sx={{ 
                      height: 20, 
                      minWidth: 20,
                      backgroundColor: '#003d82',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 11,
                    }} 
                  />
                </Stack>
              </Box>
              
              <List sx={{ p: 0, maxHeight: 500, overflow: 'auto' }}>
                {convs.map((c) => {
                  const peerName = convLabel(c, userLabelMap);
                  const lastTime = c?.last_at || c?.lastAt || c?.updated_at || c?.updatedAt || "";
                  
                  return (
                    <ListItemButton
                      key={c.id}
                      selected={activeId === c.id}
                      onClick={() => onSelectConversation(c.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        py: 2,
                        px: 2.5,
                        borderLeft: '3px solid transparent',
                        '&.Mui-selected': {
                          backgroundColor: '#f0f4f8',
                          borderLeftColor: '#003d82',
                        },
                        '&:hover': {
                          backgroundColor: '#f8f9fa',
                        },
                      }}
                    >
                      <Avatar 
                        sx={{ 
                          width: 40, 
                          height: 40, 
                          mr: 2,
                          backgroundColor: activeId === c.id ? '#003d82' : '#e0e0e0',
                          color: activeId === c.id ? 'white' : '#666',
                          fontWeight: 700,
                        }}
                      >
                        {getInitials(peerName)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                      <ListItemText
                        primary={peerName}
                        secondary={
                          <Stack spacing={0.5}>
                            {c.last_body && (
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: '#666',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {c.last_body}
                              </Typography>
                            )}
                            {lastTime && (
                              <Typography variant="caption" sx={{ color: '#999' }}>
                                {formatShortTime(lastTime)}
                              </Typography>
                            )}
                          </Stack>
                        }
                        primaryTypographyProps={{ 
                          fontWeight: 700,
                          fontSize: 15,
                          color: '#333',
                        }}
                      />
                      </Box>
                      <IconButton
                        aria-label="delete-conversation"
                        size="small"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        sx={{
                          ml: 1,
                          color: "#999",
                          "&:hover": { color: "#d32f2f", backgroundColor: "rgba(211,47,47,0.08)" },
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  );
                })}
                {!convs.length ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <ChatIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                    <Typography variant="body2" sx={{ color: '#999' }}>
                      대화가 없습니다.
                    </Typography>
                  </Box>
                ) : null}
              </List>
            </Box>
          </Paper>

          {/* 오른쪽: 메시지 영역 */}
          <Paper 
            sx={{ 
              flex: 1, 
              borderRadius: 3,
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              display: "flex", 
              flexDirection: "column",
              overflow: 'hidden',
              minHeight: 600,
            }}
          >
            {/* 메시지 헤더 */}
            <Box 
              sx={{ 
                p: 2.5, 
                backgroundColor: '#003d82',
                borderBottom: '1px solid #002a5c',
              }}
            >
              {activeId ? (
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar 
                    sx={{ 
                      width: 40, 
                      height: 40,
                      backgroundColor: 'white',
                      color: '#003d82',
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(activePeerName)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>
                      {activePeerName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      {msgs.length}개의 메시지
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <PersonIcon sx={{ color: 'rgba(255,255,255,0.8)' }} />
                  <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                    대화를 선택하세요
                  </Typography>
                </Stack>
              )}
            </Box>

            {/* 메시지 목록 */}
            <Box 
              sx={{ 
                flex: 1, 
                overflow: "auto", 
                p: 3,
                backgroundColor: '#fafafa',
              }}
            >
              {msgs.map((m) => {
                const senderId = String(m.sender_id || "");
                const senderLabel = userLabelMap.get(senderId) || "(알 수 없음)";
                const isMine = myUserId && senderId && senderId === String(myUserId);

                return (
                  <Box
                    key={m.id}
                    sx={{
                      mb: 2,
                      display: 'flex',
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Box sx={{ maxWidth: '70%' }}>
                      {/* 발신자 정보 */}
                      {!isMine && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, ml: 1 }}>
                          <Avatar 
                            sx={{ 
                              width: 24, 
                              height: 24,
                              backgroundColor: '#003d82',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {getInitials(senderLabel)}
                          </Avatar>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600 }}>
                            {senderLabel}
                          </Typography>
                        </Stack>
                      )}

                      {/* 메시지 버블 */}
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          backgroundColor: isMine ? '#003d82' : 'white',
                          border: isMine ? 'none' : '1px solid #e0e0e0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                      >
                        {m.body && (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: isMine ? 'white' : '#333',
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.5,
                            }}
                          >
                            {m.body}
                          </Typography>
                        )}

                        {/* 첨부파일 */}
                        {Array.isArray(m.attachments) && m.attachments.length ? (
                          <Box sx={{ mt: m.body ? 1 : 0 }}>
                            {m.attachments.map((a) => (
                              <Box
                                key={a.id}
                                component="a"
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  p: 1,
                                  borderRadius: 1,
                                  backgroundColor: isMine ? 'rgba(255,255,255,0.15)' : '#f8f9fa',
                                  textDecoration: 'none',
                                  '&:hover': {
                                    backgroundColor: isMine ? 'rgba(255,255,255,0.25)' : '#e9ecef',
                                  },
                                }}
                              >
                                <InsertDriveFileIcon 
                                  sx={{ 
                                    fontSize: 18, 
                                    color: isMine ? 'white' : '#003d82' 
                                  }} 
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      color: isMine ? 'white' : '#003d82',
                                      fontWeight: 600,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {a.filename}
                                  </Typography>
                                  {a.size && (
                                    <Typography 
                                      variant="caption" 
                                      sx={{ color: isMine ? 'rgba(255,255,255,0.8)' : '#666' }}
                                    >
                                      {Math.round(a.size / 1024)}KB
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        ) : null}
                      </Box>

                      {/* 시간 */}
                      <Stack 
                        direction="row" 
                        alignItems="center" 
                        spacing={0.5}
                        sx={{ 
                          mt: 0.5, 
                          mx: 1,
                          justifyContent: isMine ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <AccessTimeIcon sx={{ fontSize: 12, color: '#999' }} />
                        <Typography variant="caption" sx={{ color: '#999' }}>
                          {formatShortTime(m.created_at)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
              <div ref={messagesEndRef} />
              
              {!msgs.length && activeId ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <ChatIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: '#999', fontWeight: 600 }}>
                    메시지가 없습니다.
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#bbb', mt: 0.5 }}>
                    첫 메시지를 보내보세요!
                  </Typography>
                </Box>
              ) : null}

              {!activeId ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <ChatIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: '#999', fontWeight: 600 }}>
                    대화를 선택하세요
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#bbb', mt: 0.5 }}>
                    왼쪽 목록에서 대화를 선택하거나 새로운 대화를 시작하세요
                  </Typography>
                </Box>
              ) : null}
            </Box>

            {/* 입력 영역 */}
            <Box 
              sx={{ 
                p: 2.5, 
                backgroundColor: 'white',
                borderTop: '2px solid #e0e0e0',
              }}
            >
              {uploading && (
                <Box 
                  sx={{ 
                    mb: 1, 
                    p: 1, 
                    backgroundColor: '#e3f2fd',
                    borderRadius: 1,
                    border: '1px solid #90caf9',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#003d82', fontWeight: 600 }}>
                    📎 첨부 업로드 중...
                  </Typography>
                </Box>
              )}
              
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <IconButton 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={!activeId || uploading}
                  sx={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: '#e9ecef',
                    },
                    '&.Mui-disabled': {
                      backgroundColor: '#f5f5f5',
                    },
                  }}
                >
                  <AttachFileIcon sx={{ color: '#666' }} />
                </IconButton>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={onPickFile} />
                
                <TextField
                  size="small"
                  placeholder={activeId ? "메시지 입력..." : "대화를 선택하세요"}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  fullWidth
                  multiline
                  maxRows={4}
                  disabled={!activeId || uploading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1,
                      backgroundColor: activeId ? 'white' : '#f5f5f5',
                    },
                  }}
                />
                
                <Button 
                  variant="contained" 
                  onClick={onSend} 
                  disabled={!activeId || uploading || !text.trim()}
                  endIcon={<SendIcon />}
                  sx={{
                    minWidth: 100,
                    backgroundColor: '#003d82',
                    fontWeight: 700,
                    borderRadius: 1,
                    textTransform: 'none',
                    boxShadow: 'none',
                    py: 1.1,
                    '&:hover': {
                      backgroundColor: '#002a5c',
                      boxShadow: 'none',
                    },
                    '&.Mui-disabled': {
                      backgroundColor: '#e0e0e0',
                    },
                  }}
                >
                  전송
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
