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

const PORTAL_HOME_URL = 'https://ri-portal-app.onrender.com/';

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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
      <Box 
        component='a' 
        href={PORTAL_HOME_URL} 
        sx={{ 
          p: 2.5, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          color: 'inherit', 
          textDecoration: 'none',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease',
          '&:hover': {
            background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          }
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1,
            background: 'linear-gradient(135deg, #003d82 0%, #0051a8 100%)',
            boxShadow: '0 2px 4px rgba(0,61,130,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              color: 'white',
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: '1px'
            }}
          >
            RI
          </Typography>
        </Box>
        <Box>
          <Typography 
            variant='subtitle1' 
            sx={{ 
              fontWeight: 900, 
              lineHeight: 1.2,
              color: '#003d82',
              fontSize: 15,
              letterSpacing: '-0.3px'
            }}
          >
            RI Portal
          </Typography>
          <Typography 
            variant='caption' 
            sx={{ 
              color: '#666',
              fontWeight: 500,
              fontSize: 10,
              letterSpacing: '0.3px'
            }}
          >
            지자체연구원 통합 포털
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: '#e0e0e0' }} />
      <List sx={{ p: 1, flex: 1 }}>
        <ListItemButton 
          component={NavLink} 
          to='/' 
          end
          sx={{
            borderLeft: '4px solid transparent',
            pl: 2,
            py: 1.5,
            mb: 0.5,
            '&.active': {
              backgroundColor: '#f0f4f8',
              borderLeftColor: '#003d82',
              '& .MuiListItemIcon-root': { color: '#003d82' },
              '& .MuiListItemText-primary': { color: '#003d82', fontWeight: 700 },
            },
            '&:hover': {
              backgroundColor: '#f8f9fa',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <ListItemIcon sx={{ minWidth: 44, color: '#666' }}>
            <AccountBalanceIcon sx={{ fontSize: 24 }} />
          </ListItemIcon>
          <ListItemText 
            primary='기관' 
            secondary='지자체·정부출연'
            primaryTypographyProps={{ fontWeight: 600, fontSize: 15, color: '#333' }}
            secondaryTypographyProps={{ fontSize: 13, color: '#888' }}
          />
        </ListItemButton>
        <ListItemButton 
          component={NavLink} 
          to='/trends'
          sx={{
            borderLeft: '4px solid transparent',
            pl: 2,
            py: 1.5,
            mb: 0.5,
            '&.active': {
              backgroundColor: '#f0f4f8',
              borderLeftColor: '#003d82',
              '& .MuiListItemIcon-root': { color: '#003d82' },
              '& .MuiListItemText-primary': { color: '#003d82', fontWeight: 700 },
            },
            '&:hover': {
              backgroundColor: '#f8f9fa',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <ListItemIcon sx={{ minWidth: 44, color: '#666' }}>
            <TrendingUpIcon sx={{ fontSize: 24 }} />
          </ListItemIcon>
          <ListItemText 
            primary='연구 트렌드' 
            secondary='키워드·네트워크·버스트'
            primaryTypographyProps={{ fontWeight: 600, fontSize: 15, color: '#333' }}
            secondaryTypographyProps={{ fontSize: 13, color: '#888' }}
          />
        </ListItemButton>
        <ListItemButton 
          component={NavLink} 
          to='/reports'
          sx={{
            borderLeft: '4px solid transparent',
            pl: 2,
            py: 1.5,
            mb: 0.5,
            '&.active': {
              backgroundColor: '#f0f4f8',
              borderLeftColor: '#003d82',
              '& .MuiListItemIcon-root': { color: '#003d82' },
              '& .MuiListItemText-primary': { color: '#003d82', fontWeight: 700 },
            },
            '&:hover': {
              backgroundColor: '#f8f9fa',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <ListItemIcon sx={{ minWidth: 44, color: '#666' }}>
            <ScienceIcon sx={{ fontSize: 24 }} />
          </ListItemIcon>
          <ListItemText 
            primary='연구보고서' 
            secondary={user ? '로그인됨' : '로그인 필요'}
            primaryTypographyProps={{ fontWeight: 600, fontSize: 15, color: '#333' }}
            secondaryTypographyProps={{ fontSize: 13, color: '#888' }}
          />
        </ListItemButton>

        <ListItemButton 
          component={NavLink} 
          to='/researchers'
          sx={{
            borderLeft: '4px solid transparent',
            pl: 2,
            py: 1.5,
            mb: 0.5,
            '&.active': {
              backgroundColor: '#f0f4f8',
              borderLeftColor: '#003d82',
              '& .MuiListItemIcon-root': { color: '#003d82' },
              '& .MuiListItemText-primary': { color: '#003d82', fontWeight: 700 },
            },
            '&:hover': {
              backgroundColor: '#f8f9fa',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <ListItemIcon sx={{ minWidth: 44, color: '#666' }}>
            <PersonSearchIcon sx={{ fontSize: 24 }} />
          </ListItemIcon>
          <ListItemText 
            primary='연구자 찾기' 
            secondary='전문분야·기관·성과'
            primaryTypographyProps={{ fontWeight: 600, fontSize: 15, color: '#333' }}
            secondaryTypographyProps={{ fontSize: 13, color: '#888' }}
          />
        </ListItemButton>

        {user ? (
          <ListItemButton 
            component={NavLink} 
            to='/chat' 
            onClick={() => { markAllSeen(); }}
            sx={{
              borderLeft: '4px solid transparent',
              pl: 2,
              py: 1.5,
              mb: 0.5,
              '&.active': {
                backgroundColor: '#f0f4f8',
                borderLeftColor: '#003d82',
                '& .MuiListItemIcon-root': { color: '#003d82' },
                '& .MuiListItemText-primary': { color: '#003d82', fontWeight: 700 },
              },
              '&:hover': {
                backgroundColor: '#f8f9fa',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <ListItemIcon sx={{ minWidth: 44, color: '#666' }}>
              <Badge badgeContent={unreadCount} color='error' invisible={!unreadCount}>
                <ChatIcon sx={{ fontSize: 24 }} />
              </Badge>
            </ListItemIcon>
            <ListItemText 
              primary='채팅' 
              secondary='등록된 사용자 간 대화'
              primaryTypographyProps={{ fontWeight: 600, fontSize: 15, color: '#333' }}
              secondaryTypographyProps={{ fontSize: 13, color: '#888' }}
            />
          </ListItemButton>
        ) : null}

        {user && (user.role || 'user') === 'admin' ? (
          <>
            <Divider sx={{ my: 1.5, borderColor: '#e0e0e0' }} />
            <Typography 
              variant="caption" 
              sx={{ 
                px: 2, 
                py: 1, 
                display: 'block', 
                color: '#999',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.5px'
              }}
            >
              관리자 메뉴
            </Typography>
          </>
        ) : null}

{user && (user.role || 'user') === 'admin' ? (
  <ListItemButton 
    component={NavLink} 
    to='/admin/users'
    sx={{
      borderLeft: '4px solid transparent',
      pl: 2,
      py: 1.5,
      mb: 0.5,
      '&.active': {
        backgroundColor: '#f3e5f5',
        borderLeftColor: '#7b1fa2',
        '& .MuiListItemIcon-root': { color: '#7b1fa2' },
        '& .MuiListItemText-primary': { color: '#7b1fa2', fontWeight: 700 },
      },
      '&:hover': {
        backgroundColor: '#f8f9fa',
      },
      transition: 'all 0.2s ease',
    }}
  >
    <ListItemIcon sx={{ minWidth: 44, color: '#666' }}>
      <AdminPanelSettingsIcon sx={{ fontSize: 24 }} />
    </ListItemIcon>
    <ListItemText 
      primary='관리자' 
      secondary='사용자 승인·관리'
      primaryTypographyProps={{ fontWeight: 600, fontSize: 15, color: '#333' }}
      secondaryTypographyProps={{ fontSize: 13, color: '#888' }}
    />
  </ListItemButton>
) : null}

{user && (user.role || 'user') === 'admin' ? (
  <ListItemButton 
    component={NavLink} 
    to='/admin/stopwords'
    sx={{
      borderLeft: '4px solid transparent',
      pl: 2,
      py: 1.5,
      mb: 0.5,
      '&.active': {
        backgroundColor: '#f3e5f5',
        borderLeftColor: '#7b1fa2',
        '& .MuiListItemIcon-root': { color: '#7b1fa2' },
        '& .MuiListItemText-primary': { color: '#7b1fa2', fontWeight: 700 },
      },
      '&:hover': {
        backgroundColor: '#f8f9fa',
      },
      transition: 'all 0.2s ease',
    }}
  >
    <ListItemIcon sx={{ minWidth: 44, color: '#666' }}>
      <SpellcheckIcon sx={{ fontSize: 24 }} />
    </ListItemIcon>
    <ListItemText 
      primary='불용어 관리' 
      secondary='트렌드 분석 제외어'
      primaryTypographyProps={{ fontWeight: 600, fontSize: 15, color: '#333' }}
      secondaryTypographyProps={{ fontSize: 13, color: '#888' }}
    />
  </ListItemButton>
) : null}

      </List>
      <Divider sx={{ borderColor: '#e0e0e0' }} />
      <Box 
        sx={{ 
          p: 2,
          backgroundColor: '#f8f9fa',
          borderTop: '1px solid #e0e0e0'
        }}
      >
        <Typography 
          variant='caption' 
          sx={{ 
            color: '#666',
            display: 'block',
            fontWeight: 600,
            textAlign: 'center',
            fontSize: 11
          }}
        >
          © 2026 RI Portal
        </Typography>
        <Typography 
          variant='caption' 
          sx={{ 
            color: '#999',
            display: 'block',
            fontSize: 10,
            textAlign: 'center',
            mt: 0.5
          }}
        >
          Local Research Institute Portal
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar 
        position='fixed' 
        sx={{ 
          zIndex: (t) => t.zIndex.drawer + 1,
          backgroundColor: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        }} 
        elevation={0}
      >
        <Toolbar sx={{ minHeight: 64 }}>
          <IconButton 
            edge='start' 
            onClick={toggle} 
            sx={{ 
              mr: 2, 
              display: { md: 'none' },
              color: '#003d82',
              '&:hover': { backgroundColor: 'rgba(0,61,130,0.05)' }
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            component='a' 
            href={PORTAL_HOME_URL} 
            variant='h6' 
            sx={{ 
              flexGrow: 1, 
              color: '#003d82', 
              textDecoration: 'none',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              '&:hover': { color: '#0051a8' },
              transition: 'color 0.2s'
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #003d82 0%, #0051a8 100%)',
                boxShadow: '0 2px 4px rgba(0,61,130,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AccountBalanceIcon sx={{ fontSize: 24, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, color: '#003d82', lineHeight: 1, fontSize: 18 }}>
                지자체연구원 통합 포털
              </Typography>
              <Typography variant="caption" sx={{ color: '#666', fontSize: 11, fontWeight: 500 }}>
                Local Research Institute Portal
              </Typography>
            </Box>
          </Typography>
          {user ? (
            <Tooltip title={unreadCount ? `새 채팅 ${unreadCount}건` : '채팅'}>
              <IconButton
                onClick={async () => {
                  navigate('/chat');
                  await markAllSeen();
                }}
                data-chat-badge
                sx={{ 
                  mr: 1,
                  color: '#003d82',
                  '&:hover': { backgroundColor: 'rgba(0,61,130,0.05)' }
                }}
              >
                <Badge badgeContent={unreadCount} color='error' invisible={!unreadCount}>
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
                  onClick={enableNotifications}
                  disabled={!('Notification' in window) || notifPerm === 'granted'}
                  sx={{ 
                    mr: 2,
                    color: notifPerm === 'granted' ? '#003d82' : '#999',
                    '&:hover': { backgroundColor: 'rgba(0,61,130,0.05)' },
                    '&.Mui-disabled': { color: '#ccc' }
                  }}
                  aria-label='채팅 알림'
                >
                  {notifPerm === 'granted' ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}

          {user ? (
            <>
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1, 
                  mr: 2,
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: '#e0e0e0',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <Avatar 
                  sx={{ 
                    width: 28, 
                    height: 28,
                    background: 'linear-gradient(135deg, #003d82 0%, #0051a8 100%)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 13
                  }}
                >
                  {((user.name || user.username || 'U')[0] || 'U').toUpperCase()}
                </Avatar>
                <Typography 
                  variant='body2' 
                  sx={{ 
                    fontWeight: 600,
                    color: '#333'
                  }}
                >
                  {user.name || user.username}
                </Typography>
              </Box>
              <Button 
                variant='outlined' 
                onClick={() => { logout(); navigate('/'); }}
                sx={{
                  borderColor: '#003d82',
                  color: '#003d82',
                  fontWeight: 700,
                  borderRadius: 1,
                  px: 2,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: '#003d82',
                    backgroundColor: '#f0f4f8',
                  }
                }}
              >
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Button 
                component={RouterLink} 
                to='/login' 
                variant='outlined' 
                sx={{ 
                  mr: 1,
                  borderColor: '#003d82',
                  color: '#003d82',
                  fontWeight: 700,
                  borderRadius: 1,
                  px: 2.5,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: '#003d82',
                    backgroundColor: '#f0f4f8',
                  }
                }}
              >
                로그인
              </Button>
              <Button 
                component={RouterLink} 
                to='/register' 
                variant='contained'
                sx={{
                  background: 'linear-gradient(135deg, #003d82 0%, #0051a8 100%)',
                  color: 'white',
                  fontWeight: 700,
                  borderRadius: 1,
                  px: 2.5,
                  textTransform: 'none',
                  boxShadow: '0 2px 4px rgba(0,61,130,0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #002a5c 0%, #003d82 100%)',
                    boxShadow: '0 3px 6px rgba(0,61,130,0.4)',
                  }
                }}
              >
                회원가입
              </Button>
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
          sx={{ 
            display: { xs: 'block', md: 'none' }, 
            '& .MuiDrawer-paper': { 
              width: drawerWidth,
              boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
              backgroundColor: 'white',
            } 
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant='permanent'
          sx={{ 
            display: { xs: 'none', md: 'block' }, 
            '& .MuiDrawer-paper': { 
              width: drawerWidth, 
              boxSizing: 'border-box',
              borderRight: '1px solid #e0e0e0',
              backgroundColor: 'white',
            } 
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box 
        component='main' 
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          mt: '64px',
          backgroundColor: '#f5f7fa',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}