import React from 'react';
import { Link as RouterLink, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Avatar, Badge, Tooltip
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ScienceIcon from '@mui/icons-material/Science';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import ChatIcon from '@mui/icons-material/Chat';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { chatListConversations } from '../api/chat.js';
import { useAuth } from '../state/AuthContext';

const drawerWidth = 260;

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // --- Chat unread badge (polling-based, no permission needed) ---
  const [unreadCount, setUnreadCount] = React.useState(0);
  const pollRef = React.useRef(null);

  // Window focus tracking (helps notify when user is working in another app)
  const focusedRef = React.useRef(true);
  React.useEffect(() => {
    const onFocus = () => { focusedRef.current = true; };
    const onBlur = () => { focusedRef.current = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Browser notifications (optional; user can enable)
  const [notifPerm, setNotifPerm] = React.useState(() => (
    (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'default'
  ));

  const enableNotifications = React.useCallback(async () => {
    if (!('Notification' in window)) return;
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
    } catch {
      // ignore
    }
  }, []);

  const storageKey = React.useMemo(() => {
    const uid = String(user?.id || user?.user_id || user?.userId || user?.username || 'anon');
    return `ri.chat.lastSeen.${uid}`;
  }, [user]);

  const notifyKey = React.useMemo(() => {
    const uid = String(user?.id || user?.user_id || user?.userId || user?.username || 'anon');
    return `ri.chat.lastNotified.${uid}`;
  }, [user]);

  const normalizeTs = React.useCallback((ts) => {
    const s = String(ts || '').trim();
    if (!s) return '';
    // MySQL DATETIME -> ISO-ish
    return s.includes('T') ? s : s.replace(' ', 'T');
  }, []);

  const readLastSeen = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [storageKey]);

  const readLastNotified = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(notifyKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [notifyKey]);

  const writeLastNotified = React.useCallback((obj) => {
    try {
      localStorage.setItem(notifyKey, JSON.stringify(obj || {}));
    } catch {
      // ignore
    }
  }, [notifyKey]);

  const writeLastSeen = React.useCallback((obj) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(obj || {}));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const markAllSeen = React.useCallback(async () => {
    try {
      const r = await chatListConversations();
      const convs = r?.conversations || r?.items || [];
      const next = {};
      for (const c of convs) {
        const id = String(c?.id || '');
        if (!id) continue;
        const ts = normalizeTs(c?.last_at || c?.lastAt || c?.updated_at || c?.updatedAt || c?.created_at || c?.createdAt || '');
        if (ts) next[id] = ts;
      }
      writeLastSeen(next);
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, [normalizeTs, writeLastSeen]);

  const pollUnread = React.useCallback(async () => {
    if (!user) return;
    try {
      const r = await chatListConversations();
      const convs = r?.conversations || r?.items || [];
      const seen = readLastSeen();
      const notified = readLastNotified();

      // If user is currently on chat screen and tab is visible, treat as 'seen'
      const onChatScreen = String(location?.pathname || '').startsWith('/chat');
      const tabVisible = document.visibilityState === 'visible';

      if (onChatScreen && tabVisible) {
        const next = {};
        for (const c of convs) {
          const id = String(c?.id || '');
          if (!id) continue;
          const ts = normalizeTs(c?.last_at || c?.lastAt || c?.updated_at || c?.updatedAt || c?.created_at || c?.createdAt || '');
          if (ts) next[id] = ts;
        }
        writeLastSeen(next);
        setUnreadCount(0);
        document.title = '지자체연구원 통합 포털';
        return;
      }

      let unread = 0;
      const willNotify = (
        notifPerm === 'granted' &&
        !onChatScreen &&
        (document.visibilityState !== 'visible' || focusedRef.current === false)
      );

      const nextNotified = { ...notified };

      for (const c of convs) {
        const id = String(c?.id || '');
        if (!id) continue;
        const ts = normalizeTs(c?.last_at || c?.lastAt || c?.updated_at || c?.updatedAt || c?.created_at || c?.createdAt || '');
        if (!ts) continue;
        const prev = seen[id];
        let isNew = false;
        if (!prev) {
          unread += 1; // new chat session
          isNew = true;
        } else {
          const a = new Date(ts).getTime();
          const b = new Date(prev).getTime();
          if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) {
            unread += 1;
            isNew = true;
          }
        }

        // Optional OS-level notification when user is not looking at the portal
        if (willNotify && isNew) {
          const lastNotiTs = normalizeTs(nextNotified[id] || '');
          const a = new Date(ts).getTime();
          const b = lastNotiTs ? new Date(lastNotiTs).getTime() : 0;
          if (!Number.isNaN(a) && (Number.isNaN(b) || a > b)) {
            const body = String(
              c?.lastMessage?.text || c?.lastMessage?.body || c?.last_body || ''
            ).slice(0, 120);
            const n = new Notification('새 채팅 메시지', {
              body: body || '새 메시지가 도착했습니다.',
              tag: `ri-chat-${id}`,
              renotify: false,
            });
            n.onclick = async () => {
              try { window.focus(); } catch { /* ignore */ }
              navigate('/chat');
              await markAllSeen();
              try { n.close(); } catch { /* ignore */ }
            };
            nextNotified[id] = ts;
          }
        }
      }

      writeLastNotified(nextNotified);

      setUnreadCount(unread);
      document.title = unread > 0 ? `(${unread}) 지자체연구원 통합 포털` : '지자체연구원 통합 포털';
    } catch {
      // ignore polling errors
    }
  }, [user, location, notifPerm, normalizeTs, readLastSeen, readLastNotified, writeLastSeen, writeLastNotified, navigate, markAllSeen]);

  React.useEffect(() => {
    // Keep permission state in sync if user changes it in browser settings
    if ('Notification' in window) {
      setNotifPerm(Notification.permission);
    }
    if (pollRef.current) clearInterval(pollRef.current);
    if (!user) {
      setUnreadCount(0);
      document.title = '지자체연구원 통합 포털';
      return undefined;
    }
    // initial + periodic polling
    pollUnread();
    pollRef.current = setInterval(pollUnread, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [user, pollUnread]);

  const toggle = () => setMobileOpen(v => !v);

  const drawer = (
    <Box sx={{ height: '100%' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36 }}>RI</Avatar>
        <Box>
          <Typography variant='subtitle1' sx={{ fontWeight: 700, lineHeight: 1.2 }}>RI Portal</Typography>
          <Typography variant='caption' color='text.secondary'>지자체연구원 통합 포털</Typography>
        </Box>
      </Box>
      <Divider />
      <List sx={{ p: 1 }}>
        <ListItemButton component={NavLink} to='/' end>
          <ListItemIcon><AccountBalanceIcon /></ListItemIcon>
          <ListItemText primary='기관' secondary='지자체·정부출연' />
        </ListItemButton>
        <ListItemButton component={NavLink} to='/trends'>
          <ListItemIcon><TrendingUpIcon /></ListItemIcon>
          <ListItemText primary='연구 트렌드' secondary='키워드·네트워크·버스트' />
        </ListItemButton>
        <ListItemButton component={NavLink} to='/reports'>
          <ListItemIcon><ScienceIcon /></ListItemIcon>
          <ListItemText primary='연구보고서' secondary={user ? '로그인됨' : '로그인 필요'} />
        </ListItemButton>

        <ListItemButton component={NavLink} to='/researchers'>
          <ListItemIcon><PersonSearchIcon /></ListItemIcon>
          <ListItemText primary='연구자 찾기' secondary='전문분야·기관·성과' />
        </ListItemButton>

        {user ? (
          <ListItemButton component={NavLink} to='/chat' onClick={() => { markAllSeen(); }}>
            <ListItemIcon>
              <Badge badgeContent={unreadCount} color='primary' invisible={!unreadCount}>
                <ChatIcon />
              </Badge>
            </ListItemIcon>
            <ListItemText primary='채팅' secondary='등록된 사용자 간 대화' />
          </ListItemButton>
        ) : null}

{user && (user.role || 'user') === 'admin' ? (
  <ListItemButton component={NavLink} to='/admin/users'>
    <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
    <ListItemText primary='관리자' secondary='사용자 승인·관리' />
  </ListItemButton>
) : null}

{user && (user.role || 'user') === 'admin' ? (
  <ListItemButton component={NavLink} to='/admin/stopwords'>
    <ListItemIcon><SpellcheckIcon /></ListItemIcon>
    <ListItemText primary='불용어 관리' secondary='트렌드 분석 제외어' />
  </ListItemButton>
) : null}

      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant='caption' color='text.secondary'>© 2026 RI Portal</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position='fixed' sx={{ zIndex: (t) => t.zIndex.drawer + 1 }} color='default' elevation={0}>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={toggle} sx={{ mr: 1, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant='h6' sx={{ flexGrow: 1 }}>지자체연구원 통합 포털</Typography>
          {user ? (
            <Tooltip title={unreadCount ? `새 채팅 ${unreadCount}건` : '채팅'}>
              <IconButton
                color='inherit'
                onClick={async () => {
                  navigate('/chat');
                  await markAllSeen();
                }}
                data-chat-badge
                sx={{ mr: 1 }}
              >
                <Badge badgeContent={unreadCount} color='primary' invisible={!unreadCount}>
                  <ChatIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          ) : null}

          {user ? (
            <Tooltip
              title={
                !('Notification' in window)
                  ? '이 브라우저는 알림을 지원하지 않습니다'
                  : notifPerm === 'granted'
                    ? '채팅 알림 켜짐'
                    : '채팅 알림 켜기(권한 필요)'
              }
            >
              <span>
                <IconButton
                  color='inherit'
                  onClick={enableNotifications}
                  disabled={!('Notification' in window) || notifPerm === 'granted'}
                  sx={{ mr: 1 }}
                  aria-label='채팅 알림'
                >
                  {notifPerm === 'granted' ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}

          {user ? (
            <>
              <Avatar sx={{ width: 28, height: 28, mr: 1 }}>{((user.name || user.username || 'U')[0] || 'U').toUpperCase()}</Avatar>
              <Typography variant='body2' sx={{ mr: 2 }}>{user.name || user.username}</Typography>
              <Button variant='outlined' onClick={() => { logout(); navigate('/'); }}>로그아웃</Button>
            </>
          ) : (
            <>
              <Button component={RouterLink} to='/login' variant='outlined' sx={{ mr: 1 }}>로그인</Button>
              <Button component={RouterLink} to='/register' variant='contained'>등록</Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Box component='nav' sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant='temporary'
          open={mobileOpen}
          onClose={toggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant='permanent'
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component='main' sx={{ flexGrow: 1, p: 2.5, mt: 8, backgroundColor: '#f6f7fb' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
