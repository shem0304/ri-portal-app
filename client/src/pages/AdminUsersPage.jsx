import React from 'react';
import {
  Box, Card, CardContent, Typography, Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Divider, Fade, Paper, TableContainer
} from '@mui/material';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LockResetIcon from '@mui/icons-material/LockReset';
import { apiFetch } from '../api';
import { useAuth } from '../state/AuthContext';
import { Navigate } from 'react-router-dom';

function fmt(ts) {
  if (!ts) return '-';
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

function statusChip(status) {
  if (status === 'approved') 
    return <Chip size="small" label="승인" color="success" sx={{ fontWeight: 700 }} />;
  if (status === 'rejected') 
    return <Chip size="small" label="거절" color="error" sx={{ fontWeight: 700 }} />;
  return <Chip size="small" label="대기" color="warning" sx={{ fontWeight: 700 }} />;
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
    await apiFetch(`/api/admin/users/${pwUser.id}/password`, { 
      method: 'POST', 
      auth: true, 
      body: { newPassword: newPw } 
    });
    setPwOpen(false);
    refresh();
  }

  const pending = users.filter(u => (u.status || 'pending') === 'pending');
  const approved = users.filter(u => (u.status || 'pending') === 'approved');
  const rejected = users.filter(u => (u.status || 'pending') === 'rejected');

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 3 }}>
      <Fade in timeout={500}>
        <Box>
          {/* 헤더 */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={2}
            sx={{ mb: 4 }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              }}
            >
              <SupervisorAccountIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography 
              variant='h4' 
              sx={{ 
                fontWeight: 800,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              사용자 관리
            </Typography>
          </Stack>

          {error && (
            <Fade in>
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
            </Fade>
          )}

          {/* 승인 대기 카드 */}
          <Card 
            sx={{ 
              borderRadius: 4, 
              mb: 3,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                alignItems="center" 
                justifyContent="space-between" 
                sx={{ mb: 3 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  승인 대기 ({pending.length})
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<RefreshIcon />}
                  onClick={refresh} 
                  disabled={loading}
                  sx={{
                    mt: { xs: 2, sm: 0 },
                    borderRadius: 2,
                    borderColor: '#667eea',
                    color: '#667eea',
                    '&:hover': {
                      borderColor: '#5568d3',
                      background: 'rgba(102, 126, 234, 0.05)',
                    },
                  }}
                >
                  새로고침
                </Button>
              </Stack>

              {pending.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 6,
                    textAlign: 'center',
                    background: 'rgba(102, 126, 234, 0.05)',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    승인 대기 사용자가 없습니다.
                  </Typography>
                </Paper>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, background: 'rgba(102, 126, 234, 0.05)' } }}>
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
                        <TableRow 
                          key={u.id}
                          sx={{
                            '&:hover': {
                              background: 'rgba(102, 126, 234, 0.02)',
                            }
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600 }}>{u.name || '-'}</TableCell>
                          <TableCell>{u.org || '-'}</TableCell>
                          <TableCell>{u.email || u.username}</TableCell>
                          <TableCell>{statusChip(u.status)}</TableCell>
                          <TableCell>{fmt(u.last_login_at)}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button 
                                size="small" 
                                variant="contained" 
                                startIcon={<CheckCircleIcon />}
                                onClick={() => approve(u.id)}
                                sx={{
                                  borderRadius: 2,
                                  background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
                                  '&:hover': {
                                    background: 'linear-gradient(135deg, #43a047 0%, #388e3c 100%)',
                                  },
                                }}
                              >
                                승인
                              </Button>
                              <Button 
                                size="small" 
                                variant="outlined" 
                                color="error"
                                startIcon={<CancelIcon />}
                                onClick={() => reject(u.id)}
                                sx={{ borderRadius: 2 }}
                              >
                                거절
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* 전체 사용자 카드 */}
          <Card 
            sx={{ 
              borderRadius: 4,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
                전체 사용자
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, background: 'rgba(102, 126, 234, 0.05)' } }}>
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
                      <TableRow 
                        key={u.id}
                        sx={{
                          '&:hover': {
                            background: 'rgba(102, 126, 234, 0.02)',
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{u.name || '-'}</TableCell>
                        <TableCell>{u.org || '-'}</TableCell>
                        <TableCell>{u.email || u.username}</TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={u.role || 'user'} 
                            sx={{ 
                              fontWeight: 600,
                              background: u.role === 'admin' 
                                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' 
                                : 'rgba(102, 126, 234, 0.1)',
                              color: u.role === 'admin' ? 'white' : '#667eea',
                            }}
                          />
                        </TableCell>
                        <TableCell>{statusChip(u.status)}</TableCell>
                        <TableCell>{fmt(u.last_login_at)}</TableCell>
                        <TableCell align="right">
                          <Button 
                            size="small" 
                            variant="outlined"
                            startIcon={<LockResetIcon />}
                            onClick={() => openPw(u)}
                            sx={{
                              borderRadius: 2,
                              borderColor: '#667eea',
                              color: '#667eea',
                              '&:hover': {
                                borderColor: '#5568d3',
                                background: 'rgba(102, 126, 234, 0.05)',
                              },
                            }}
                          >
                            변경
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
                * 기본 관리자(admin/admin123!)는 서버 설정에 따라 users.json에 없을 수 있습니다. 
                비밀번호 변경을 누르면 users.json에 관리자 계정이 생성됩니다.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Fade>

      {/* 비밀번호 변경 다이얼로그 */}
      <Dialog 
        open={pwOpen} 
        onClose={() => setPwOpen(false)} 
        fullWidth 
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 3,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>비밀번호 변경</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            대상: {pwUser ? (pwUser.email || pwUser.username) : '-'}
          </Typography>
          <TextField
            label="새 비밀번호"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            fullWidth
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={() => setPwOpen(false)}
            sx={{ borderRadius: 2 }}
          >
            취소
          </Button>
          <Button 
            variant="contained" 
            onClick={savePw} 
            disabled={!newPw}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
              },
            }}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
