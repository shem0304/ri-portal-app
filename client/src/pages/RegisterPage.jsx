import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, TextField, Typography, Alert, Link } from '@mui/material';
import { useAuth } from '../state/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = React.useState('');
  const [org, setOrg] = React.useState('');
  const [email, setEmail] = React.useState(''); // email or username
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const navigate = useNavigate();

  function extractFieldError(details) {
    const fe = details?.fieldErrors || {};
    const order = ['name', 'org', 'username', 'email', 'password'];
    for (const k of order) {
      const arr = fe[k];
      if (Array.isArray(arr) && arr.length) return arr[0];
    }
    const form = details?.formErrors;
    if (Array.isArray(form) && form.length) return form[0];
    return '';
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const nm = name.trim();
      const og = org.trim();
      const em = email.trim();
      if (!nm) { setError('이름을 입력하세요.'); return; }
      if (!og) { setError('소속을 입력하세요.'); return; }
      if (em.length < 2) { setError('이메일(또는 아이디)를 2자 이상 입력하세요.'); return; }
      if (String(password || '').length < 6) { setError('비밀번호는 6자 이상 입력하세요.'); return; }

      const res = await register({ name, org, email, username: email, password });
      setSuccess(res?.note || '등록이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.');
      // go to login after a short moment (immediate navigation is also fine)
      setTimeout(() => navigate('/login', { replace: true }), 400);
    } catch (err) {
      setError(err.message || '등록 실패');
    }
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', mt: 6 }}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant='h5' sx={{ fontWeight: 800, mb: 1 }}>사용자 등록</Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            등록 후 <b>관리자 승인</b>이 완료되어야 로그인할 수 있습니다.
          </Typography>

          {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
          {success ? <Alert severity='success' sx={{ mb: 2 }}>{success}</Alert> : null}

          <Box component='form' onSubmit={onSubmit}>
            <Stack spacing={1.5}>
              <TextField label='이름' value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField label='소속' value={org} onChange={(e) => setOrg(e.target.value)} required />
              <TextField
                label='이메일(또는 아이디)'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder='예: user@example.com'
              />
              <TextField label='비밀번호' type='password' value={password} onChange={(e) => setPassword(e.target.value)} required />

              <Button type='submit' variant='contained' size='large'>등록 요청</Button>

              <Typography variant='caption' color='text.secondary'>
                이미 계정이 있나요?{' '}
                <Link component={RouterLink} to='/login'>로그인</Link>
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
