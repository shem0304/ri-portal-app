/**
 * ============================================================================
 * AppLayout - Atomic Design Pattern 적용
 * ============================================================================
 * 
 * 구조:
 * - Atoms: 기본 UI 요소 (LogoIcon, BadgeWrapper 등)
 * - Molecules: Atoms의 조합 (LogoSection, NavigationItem, UserProfile 등)
 * - Organisms: 복잡한 컴포넌트 (Sidebar, TopBar)
 * - Template: AppLayout (최종 레이아웃)
 * 
 * ============================================================================
 */

import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, 
  ListItemIcon, ListItemText, Toolbar, Typography, Avatar, Badge, Tooltip, Fade
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

const drawerWidth = 280;
const PORTAL_HOME_URL = 'https://ri-portal-app.onrender.com/';

// ============================================================================
// ATOMS - 기본 UI 요소
// ============================================================================

/**
 * Atom: LogoIcon
 * 포털 로고 아이콘
 */
const LogoIcon = React.memo(() => (
  <Box
    sx={{
      width: 52,
      height: 52,
      borderRadius: 2.5,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      boxShadow: '0 4px 16px rgba(102, 126, 234, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}
  >
    <Typography
      sx={{
        color: 'white',
        fontWeight: 900,
        fontSize: 20,
        letterSpacing: '1.5px',
        textShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      RI
    </Typography>
  </Box>
));

LogoIcon.displayName = 'LogoIcon';

/**
 * Atom: BadgeWrapper
 * 아이콘 뱃지 래퍼
 */
const BadgeWrapper = React.memo(({ children, count }) => {
  if (!count) return children;
  
  return (
    <Badge 
      badgeContent={count} 
      color='error'
      sx={{
        '& .MuiBadge-badge': {
          fontWeight: 700,
          fontSize: 11,
        }
      }}
    >
      {children}
    </Badge>
  );
});

BadgeWrapper.displayName = 'BadgeWrapper';

// ============================================================================
// MOLECULES - Atoms의 조합
// ============================================================================

/**
 * Molecule: LogoSection
 * 로고 + 타이틀 + 설명
 */
const LogoSection = React.memo(() => (
  <Fade in timeout={500}>
    <Box 
      component='a' 
      href={PORTAL_HOME_URL} 
      sx={{ 
        p: 3, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        color: 'inherit', 
        textDecoration: 'none',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%)',
        borderBottom: '1px solid rgba(102, 126, 234, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.06) 0%, rgba(118, 75, 162, 0.06) 100%)',
          borderBottomColor: 'rgba(102, 126, 234, 0.15)',
          '& .logo-icon': {
            transform: 'scale(1.05) rotate(2deg)',
            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
          }
        }
      }}
    >
      <Box className="logo-icon" sx={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <LogoIcon />
      </Box>
      <Box>
        <Typography 
          variant='h6' 
          sx={{ 
            fontWeight: 900, 
            lineHeight: 1.2,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: 18,
            letterSpacing: '-0.5px',
            mb: 0.5,
          }}
        >
          RI Portal
        </Typography>
        <Typography 
          variant='caption' 
          sx={{ 
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: '0.3px',
            display: 'block',
          }}
        >
          지자체연구원 통합 포털
        </Typography>
      </Box>
    </Box>
  </Fade>
));

LogoSection.displayName = 'LogoSection';

/**
 * Molecule: NavigationItem
 * 네비게이션 메뉴 아이템
 */
const NavigationItem = React.memo(({ 
  to, 
  icon: Icon, 
  primary, 
  secondary, 
  onClick, 
  badgeCount,
  isAdmin = false,
  end = false,
}) => {
  const activeColor = isAdmin ? '#764ba2' : '#667eea';
  const activeBg = isAdmin 
    ? 'linear-gradient(90deg, rgba(118, 75, 162, 0.1) 0%, rgba(118, 75, 162, 0.02) 100%)'
    : 'linear-gradient(90deg, rgba(102, 126, 234, 0.1) 0%, rgba(102, 126, 234, 0.02) 100%)';

  return (
    <ListItemButton 
      component={NavLink} 
      to={to}
      end={end}
      onClick={onClick}
      sx={{
        borderLeft: '4px solid transparent',
        pl: 2.5,
        py: 2,
        mb: 0.5,
        borderRadius: '0 16px 16px 0',
        mr: 1.5,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&.active': {
          background: activeBg,
          borderLeftColor: activeColor,
          '& .MuiListItemIcon-root': { color: activeColor },
          '& .MuiListItemText-primary': { 
            color: activeColor, 
            fontWeight: 800,
          },
          '& .MuiListItemText-secondary': { 
            color: activeColor,
            opacity: 0.75,
          },
        },
        '&:hover': {
          backgroundColor: 'rgba(102, 126, 234, 0.04)',
          transform: 'translateX(6px)',
          '& .MuiListItemIcon-root': {
            transform: 'scale(1.1)',
          }
        },
      }}
    >
      <ListItemIcon sx={{ 
        minWidth: 48, 
        color: '#666',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <BadgeWrapper count={badgeCount}>
          <Icon sx={{ fontSize: 24 }} />
        </BadgeWrapper>
      </ListItemIcon>
      <ListItemText 
        primary={primary} 
        secondary={secondary}
        primaryTypographyProps={{ 
          fontWeight: 700, 
          fontSize: 15, 
          color: '#333',
          letterSpacing: '-0.3px',
        }}
        secondaryTypographyProps={{ 
          fontSize: 12, 
          color: '#888',
          fontWeight: 500,
          mt: 0.3,
        }}
      />
    </ListItemButton>
  );
});

NavigationItem.displayName = 'NavigationItem';

/**
 * Molecule: SectionDivider
 * 섹션 구분선 + 라벨
 */
const SectionDivider = React.memo(({ label }) => (
  <Box sx={{ my: 2 }}>
    <Divider sx={{ 
      borderColor: 'rgba(102, 126, 234, 0.12)',
      mb: 1.5,
    }} />
    <Typography 
      variant="caption" 
      sx={{ 
        px: 2.5, 
        py: 1, 
        display: 'block', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: 800,
        fontSize: 11,
        letterSpacing: '1.2px',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </Typography>
  </Box>
));

SectionDivider.displayName = 'SectionDivider';

/**
 * Molecule: NotificationButton
 * 알림 버튼
 */
const NotificationButton = React.memo(({ unreadCount, onClick, notifPerm }) => {
  const hasNotif = notifPerm === 'granted';
  
  return (
    <Tooltip title={hasNotif ? '알림 활성화됨' : '알림 활성화'} arrow>
      <IconButton 
        onClick={onClick}
        sx={{
          color: hasNotif ? '#667eea' : 'text.secondary',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%)',
            transform: 'scale(1.08)',
          }
        }}
      >
        <BadgeWrapper count={unreadCount}>
          {hasNotif ? (
            <NotificationsActiveIcon sx={{ fontSize: 24 }} />
          ) : (
            <NotificationsNoneIcon sx={{ fontSize: 24 }} />
          )}
        </BadgeWrapper>
      </IconButton>
    </Tooltip>
  );
});

NotificationButton.displayName = 'NotificationButton';

/**
 * Molecule: UserProfile
 * 사용자 프로필 (로그인/로그아웃)
 */
const UserProfile = React.memo(({ user, onLogout, onLogin }) => {
  if (!user) {
    return (
      <Button 
        variant='outlined' 
        onClick={onLogin}
        sx={{
          borderRadius: 2.5,
          borderWidth: 2,
          borderColor: '#667eea',
          color: '#667eea',
          fontWeight: 700,
          textTransform: 'none',
          px: 3,
          py: 1,
          fontSize: 14,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            borderWidth: 2,
            borderColor: '#5568d3',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
          }
        }}
      >
        로그인
      </Button>
    );
  }

  const initial = (user.username || user.email || 'U')[0].toUpperCase();
  const displayName = user.username || user.email || '사용자';
  const subtitle = user.org || (user.role === 'admin' ? '관리자' : '일반 사용자');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Avatar 
        sx={{ 
          width: 38, 
          height: 38,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontWeight: 800,
          fontSize: 17,
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
        }}
      >
        {initial}
      </Avatar>
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Typography 
          variant='body2' 
          sx={{ 
            fontWeight: 700, 
            lineHeight: 1.2, 
            color: '#333',
            fontSize: 14,
          }}
        >
          {displayName}
        </Typography>
        <Typography 
          variant='caption' 
          sx={{ 
            color: '#888', 
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {subtitle}
        </Typography>
      </Box>
      <Button
        size='small'
        onClick={onLogout}
        sx={{
          minWidth: 'auto',
          px: 2,
          py: 0.75,
          borderRadius: 2,
          fontSize: 12,
          fontWeight: 700,
          color: '#666',
          textTransform: 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
            color: '#667eea',
            transform: 'translateY(-1px)',
          }
        }}
      >
        로그아웃
      </Button>
    </Box>
  );
});

UserProfile.displayName = 'UserProfile';

// ============================================================================
// ORGANISMS - 복합 컴포넌트
// ============================================================================

/**
 * Organism: Sidebar
 * 사이드바 전체 (로고 + 메뉴 리스트)
 */
const Sidebar = React.memo(({ user, unreadCount, onMarkAllSeen }) => {
  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
    }}>
      {/* 로고 섹션 */}
      <LogoSection />
      
      {/* 메뉴 리스트 */}
      <List sx={{ 
        p: 2, 
        flex: 1, 
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(102, 126, 234, 0.3)',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(102, 126, 234, 0.5)',
        },
      }}>
        <NavigationItem
          to='/'
          end
          icon={AccountBalanceIcon}
          primary='기관'
          secondary='지자체·정부출연'
        />
        
        <NavigationItem
          to='/trends'
          icon={TrendingUpIcon}
          primary='연구 트렌드'
          secondary='키워드·네트워크·버스트'
        />
        
        <NavigationItem
          to='/reports'
          icon={ScienceIcon}
          primary='연구보고서'
          secondary={user ? '검색 및 조회' : '로그인 필요'}
        />

        <NavigationItem
          to='/researchers'
          icon={PersonSearchIcon}
          primary='연구자 찾기'
          secondary='전문분야·기관·성과'
        />

        {user && (
          <NavigationItem
            to='/chat'
            icon={ChatIcon}
            primary='채팅'
            secondary='등록된 사용자 간 대화'
            badgeCount={unreadCount}
            onClick={onMarkAllSeen}
          />
        )}

        {/* 관리자 메뉴 */}
        {user && user.role === 'admin' && (
          <>
            <SectionDivider label='관리자 메뉴' />
            
            <NavigationItem
              to='/admin/users'
              icon={AdminPanelSettingsIcon}
              primary='사용자 관리'
              secondary='승인·역할 설정'
              isAdmin
            />
            
            <NavigationItem
              to='/admin/stopwords'
              icon={SpellcheckIcon}
              primary='불용어 관리'
              secondary='분석 제외 키워드'
              isAdmin
            />
          </>
        )}
      </List>

      {/* Footer */}
      <Box sx={{ 
        p: 2.5, 
        borderTop: '1px solid rgba(102, 126, 234, 0.08)',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(118, 75, 162, 0.02) 100%)',
      }}>
        <Typography 
          variant='caption' 
          sx={{ 
            display: 'block', 
            textAlign: 'center', 
            color: '#999',
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          © 2024 RI Portal · v1.0
        </Typography>
      </Box>
    </Box>
  );
});

Sidebar.displayName = 'Sidebar';

/**
 * Organism: TopBar
 * 상단 앱바
 */
const TopBar = React.memo(({ 
  user, 
  unreadCount, 
  notifPerm,
  onMenuToggle, 
  onNotificationClick, 
  onLogout,
  onLogin 
}) => {
  return (
    <AppBar 
      position='fixed' 
      elevation={0}
      sx={{ 
        width: { md: `calc(100% - ${drawerWidth}px)` }, 
        ml: { md: `${drawerWidth}px` },
        background: 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        borderBottom: '1px solid rgba(102, 126, 234, 0.08)',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, sm: 70 } }}>
        {/* 모바일 메뉴 버튼 */}
        <IconButton
          edge='start'
          onClick={onMenuToggle}
          sx={{ 
            mr: 2, 
            display: { md: 'none' },
            color: '#667eea',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              transform: 'rotate(90deg)',
            }
          }}
        >
          <MenuIcon />
        </IconButton>
        
        <Box sx={{ flexGrow: 1 }} />
        
        {/* 알림 버튼 */}
        {user && (
          <NotificationButton
            unreadCount={unreadCount}
            onClick={onNotificationClick}
            notifPerm={notifPerm}
          />
        )}
        
        {/* 사용자 프로필 */}
        <Box sx={{ ml: 1 }}>
          <UserProfile 
            user={user} 
            onLogout={onLogout}
            onLogin={onLogin}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
});

TopBar.displayName = 'TopBar';

// ============================================================================
// TEMPLATE - AppLayout
// ============================================================================

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Chat unread badge
  const [unreadCount, setUnreadCount] = React.useState(0);
  const pollRef = React.useRef(null);

  // Window focus tracking
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

  // Browser notifications
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

  const writeLastSeen = React.useCallback((obj) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(obj || {}));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const writeLastNotified = React.useCallback((obj) => {
    try {
      localStorage.setItem(notifyKey, JSON.stringify(obj || {}));
    } catch {
      // ignore
    }
  }, [notifyKey]);

  const markAllSeen = React.useCallback(async () => {
    try {
      const r = await chatListConversations();
      if (!r.ok) return;
      const convs = r.conversations || [];
      const seen = {};
      for (const c of convs) {
        const id = String(c.id || '');
        const ts = normalizeTs(c.updated_at || c.updatedAt || '');
        if (id && ts) seen[id] = ts;
      }
      writeLastSeen(seen);
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, [normalizeTs, writeLastSeen]);

  const pollUnread = React.useCallback(async () => {
    if (!user) return;
    if (location.pathname === '/chat') {
      await markAllSeen();
      return;
    }

    try {
      const r = await chatListConversations();
      if (!r.ok) return;
      const convs = r.conversations || [];
      const lastSeen = readLastSeen();
      const lastNotified = readLastNotified();
      const nextNotified = { ...lastNotified };
      let unread = 0;

      for (const c of convs) {
        const id = String(c.id || '');
        const ts = normalizeTs(c.updated_at || c.updatedAt || '');
        const seenTs = lastSeen[id] || '';
        if (ts && seenTs && ts > seenTs) {
          unread++;
          if (notifPerm === 'granted' && !focusedRef.current) {
            if (!lastNotified[id] || ts > lastNotified[id]) {
              const peerName = c.peer_name || c.peerName || 'Unknown';
              const n = new Notification(`새 메시지: ${peerName}`, {
                body: '새로운 채팅 메시지가 도착했습니다.',
                icon: '/favicon.ico',
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
      }

      writeLastNotified(nextNotified);
      setUnreadCount(unread);
      document.title = unread > 0 ? `(${unread}) 지자체연구원 통합 포털` : '지자체연구원 통합 포털';
    } catch {
      // ignore polling errors
    }
  }, [user, location, notifPerm, normalizeTs, readLastSeen, readLastNotified, writeLastSeen, writeLastNotified, navigate, markAllSeen]);

  React.useEffect(() => {
    if ('Notification' in window) {
      setNotifPerm(Notification.permission);
    }
    if (pollRef.current) clearInterval(pollRef.current);
    if (!user) {
      setUnreadCount(0);
      document.title = '지자체연구원 통합 포털';
      return undefined;
    }
    pollUnread();
    pollRef.current = setInterval(pollUnread, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [user, pollUnread]);

  const toggleMobile = () => setMobileOpen(v => !v);
  const handleLogin = () => navigate('/login');
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fafbfc' }}>
      {/* 상단 앱바 */}
      <TopBar
        user={user}
        unreadCount={unreadCount}
        notifPerm={notifPerm}
        onMenuToggle={toggleMobile}
        onNotificationClick={enableNotifications}
        onLogout={handleLogout}
        onLogin={handleLogin}
      />
      
      {/* 사이드바 */}
      <Box
        component='nav'
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant='temporary'
          open={mobileOpen}
          onClose={toggleMobile}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
            },
          }}
        >
          <Sidebar user={user} unreadCount={unreadCount} onMarkAllSeen={markAllSeen} />
        </Drawer>
        
        {/* Desktop drawer */}
        <Drawer
          variant='permanent'
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: '1px solid rgba(102, 126, 234, 0.08)',
              boxShadow: '2px 0 12px rgba(0,0,0,0.02)',
            },
          }}
          open
        >
          <Sidebar user={user} unreadCount={unreadCount} onMarkAllSeen={markAllSeen} />
        </Drawer>
      </Box>
      
      {/* 메인 컨텐츠 */}
      <Box
        component='main'
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 70 } }} />
        <Fade in timeout={400}>
          <Box>
            <Outlet />
          </Box>
        </Fade>
      </Box>
    </Box>
  );
}
