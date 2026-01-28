import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, TextField, Typography, Alert, Link } from '@mui/material';
import { useAuth } from '../state/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  function humanizeError(e) {
    // apiFetch throws Error(message) where message is usually server's {error} or {message}
    const msg = String(e?.message || '').trim();

    // Common server responses:
    // - 401: Invalid credentials
    // - 403: 승인 대기/거절 (server sends a Korean error message)
    if (!msg) return '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';

    if (msg.includes('Invalid credentials')) return '아이디 또는 비밀번호가 올바르지 않습니다.';
    if (msg.includes('승인 대기') || msg.includes('대기')) return msg; // already friendly
    if (msg.includes('거절')) return msg;
    if (msg.includes('Unauthorized')) return '인증 정보가 만료되었습니다. 다시 로그인해 주세요.';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return '서버에 연결할 수 없습니다. 네트워크/서버 상태를 확인해 주세요.';

    return msg;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const u = username.trim();
      if (u.length < 2) { setError('아이디를 2자 이상 입력하세요.'); return; }
      if (String(password || '').length < 6) { setError('비밀번호는 6자 이상 입력하세요.'); return; }

      await login(username, password);
      navigate('/', { replace: true });
    } catch (e2) {
      const msg = humanizeError(e2);
      // If it's a "pending approval" style message, show as info, not error
      if (msg.includes('승인') || msg.includes('대기')) setInfo(msg);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', mt: 6 }}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant='h5' sx={{ fontWeight: 800, mb: 1 }}>로그인</Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            연구보고서는 로그인 후 열람 가능합니다.
          </Typography>

          {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
          {info ? <Alert severity='info' sx={{ mb: 2 }}>{info}</Alert> : null}

          <Box component='form' onSubmit={onSubmit}>
            <Stack spacing={1.5}>
              <TextField
                label='아이디(이메일)'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete='username'
                required
              />
              <TextField
                label='비밀번호'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete='current-password'
                required
              />

              <Button type='submit' variant='contained' size='large' disabled={loading}>
                {loading ? '로그인 중…' : '로그인'}
              </Button>

              <Typography variant='caption' color='text.secondary'>
                계정이 없나요?{' '}
                <Link component={RouterLink} to='/register'>등록</Link>
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
