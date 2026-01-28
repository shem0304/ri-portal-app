import React from 'react';
import {
  Box, Card, CardContent, Typography, Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip
} from '@mui/material';
import { apiFetch } from '../api';
import { useAuth } from '../state/AuthContext';
import { Navigate } from 'react-router-dom';

function fmt(ts) {
  if (!ts) return '-';
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

function statusChip(status) {
  if (status === 'approved') return <Chip size="small" label="승인" color="success" />;
  if (status === 'rejected') return <Chip size="small" label="거절" color="error" />;
  return <Chip size="small" label="대기" color="warning" />;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = React.useState([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const [pwOpen, setPwOpen] = React.useState(false);
  const [pwUser, setPwUser] = React.useState(null);
  const [newPw, setNewPw] = React.useState('');

  async function refresh() {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/users', { auth: true });
      setUsers(res.users || []);
    } catch (e) {
      setError(e.message || '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { refresh(); }, []);

  if (!user) return <Navigate to="/login" replace />;
  if ((user.role || 'user') !== 'admin') return <Navigate to="/" replace />;

  async function approve(id) {
    await apiFetch(`/api/admin/users/${id}/approve`, { method: 'POST', auth: true });
    refresh();
  }
  async function reject(id) {
    await apiFetch(`/api/admin/users/${id}/reject`, { method: 'POST', auth: true });
    refresh();
  }

  function openPw(u) {
    setPwUser(u);
    setNewPw('');
    setPwOpen(true);
  }

  async function savePw() {
    if (!pwUser) return;
    await apiFetch(`/api/admin/users/${pwUser.id}/password`, { method: 'POST', auth: true, body: { newPassword: newPw } });
    setPwOpen(false);
    refresh();
  }

  const pending = users.filter(u => (u.status || 'pending') === 'pending');
  const approved = users.filter(u => (u.status || 'pending') === 'approved');
  const rejected = users.filter(u => (u.status || 'pending') === 'rejected');

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>관리자 · 사용자 승인/관리</Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>승인 대기 ({pending.length})</Typography>
            <Button variant="outlined" onClick={refresh} disabled={loading}>새로고침</Button>
          </Stack>

          {pending.length === 0 ? (
            <Typography variant="body2" color="text.secondary">승인 대기 사용자가 없습니다.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>이름</TableCell>
                  <TableCell>소속</TableCell>
                  <TableCell>이메일/아이디</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>최근 로그인</TableCell>
                  <TableCell align="right">조치</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pending.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name || '-'}</TableCell>
                    <TableCell>{u.org || '-'}</TableCell>
                    <TableCell>{u.email || u.username}</TableCell>
                    <TableCell>{statusChip(u.status)}</TableCell>
                    <TableCell>{fmt(u.last_login_at)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="contained" onClick={() => approve(u.id)}>승인</Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => reject(u.id)}>거절</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>전체 사용자</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>이름</TableCell>
                <TableCell>소속</TableCell>
                <TableCell>이메일/아이디</TableCell>
                <TableCell>권한</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>최근 로그인</TableCell>
                <TableCell align="right">비밀번호</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.name || '-'}</TableCell>
                  <TableCell>{u.org || '-'}</TableCell>
                  <TableCell>{u.email || u.username}</TableCell>
                  <TableCell>{u.role || 'user'}</TableCell>
                  <TableCell>{statusChip(u.status)}</TableCell>
                  <TableCell>{fmt(u.last_login_at)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => openPw(u)}>변경</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            * 기본 관리자(admin/admin123!)는 서버 설정에 따라 users.json에 없을 수 있습니다. 비밀번호 변경을 누르면 users.json에 관리자 계정이 생성됩니다.
          </Typography>
        </CardContent>
      </Card>

      <Dialog open={pwOpen} onClose={() => setPwOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>비밀번호 변경</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            대상: {pwUser ? (pwUser.email || pwUser.username) : '-'}
          </Typography>
          <TextField
            label="새 비밀번호"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwOpen(false)}>취소</Button>
          <Button variant="contained" onClick={savePw} disabled={!newPw}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
