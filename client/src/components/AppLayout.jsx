import React from 'react';
import { Link as RouterLink, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Avatar
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ScienceIcon from '@mui/icons-material/Science';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import ChatIcon from '@mui/icons-material/Chat';
import { useAuth } from '../state/AuthContext';

const drawerWidth = 260;

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

        {user ? (
          <ListItemButton component={NavLink} to='/chat'>
            <ListItemIcon><ChatIcon /></ListItemIcon>
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
