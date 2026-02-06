import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, TextField, Typography, Alert, Link, Fade, keyframes } from '@mui/material';
import { useAuth } from '../state/AuthContext';
import LoginIcon from '@mui/icons-material/Login';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  function humanizeError(e) {
    const msg = String(e?.message || '').trim();
    if (!msg) return '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    if (msg.includes('Invalid credentials')) return '아이디 또는 비밀번호가 올바르지 않습니다.';
    if (msg.includes('승인 대기') || msg.includes('대기')) return msg;
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
      if (msg.includes('승인') || msg.includes('대기')) setInfo(msg);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        }
      }}
    >
      {/* Floating shapes */}
      <Box
        sx={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          top: '10%',
          left: '10%',
          animation: `${float} 6s ease-in-out infinite`,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          bottom: '15%',
          right: '15%',
          animation: `${float} 8s ease-in-out infinite`,
          animationDelay: '1s',
        }}
      />

      <Fade in timeout={800}>
        <Box sx={{ maxWidth: 480, width: '100%', mx: 2, position: 'relative', zIndex: 1 }}>
          <Card 
            sx={{ 
              borderRadius: 4,
              backdropFilter: 'blur(20px)',
              background: 'rgba(255, 255, 255, 0.95)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              overflow: 'hidden',
            }}
          >
            {/* Header gradient bar */}
            <Box
              sx={{
                height: 6,
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                animation: `${shimmer} 3s infinite linear`,
                backgroundSize: '1000px 100%',
              }}
            />

            <CardContent sx={{ p: 5 }}>
              {/* Logo/Icon */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  mb: 3 
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                  }}
                >
                  <LoginIcon sx={{ fontSize: 40, color: 'white' }} />
                </Box>
              </Box>

              <Typography 
                variant='h4' 
                sx={{ 
                  fontWeight: 800, 
                  mb: 1, 
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                로그인
              </Typography>
              
              <Typography 
                variant='body2' 
                color='text.secondary' 
                sx={{ mb: 4, textAlign: 'center' }}
              >
                연구보고서는 로그인 후 열람 가능합니다.
              </Typography>

              {error && (
                <Fade in>
                  <Alert 
                    severity='error' 
                    sx={{ 
                      mb: 2,
                      borderRadius: 2,
                      '& .MuiAlert-icon': {
                        fontSize: 24,
                      }
                    }}
                  >
                    {error}
                  </Alert>
                </Fade>
              )}
              
              {info && (
                <Fade in>
                  <Alert 
                    severity='info' 
                    sx={{ 
                      mb: 2,
                      borderRadius: 2,
                      '& .MuiAlert-icon': {
                        fontSize: 24,
                      }
                    }}
                  >
                    {info}
                  </Alert>
                </Fade>
              )}

              <Box component='form' onSubmit={onSubmit}>
                <Stack spacing={2.5}>
                  <TextField
                    label='아이디(이메일)'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete='username'
                    required
                    InputProps={{
                      startAdornment: <PersonOutlineIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                        },
                        '&.Mui-focused': {
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
                        }
                      }
                    }}
                  />
                  
                  <TextField
                    label='비밀번호'
                    type='password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete='current-password'
                    required
                    InputProps={{
                      startAdornment: <LockOutlinedIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                        },
                        '&.Mui-focused': {
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
                        }
                      }
                    }}
                  />

                  <Button 
                    type='submit' 
                    variant='contained' 
                    size='large' 
                    disabled={loading}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                      transition: 'all 0.3s',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)',
                        transform: 'translateY(-2px)',
                      },
                      '&:active': {
                        transform: 'translateY(0)',
                      },
                      '&.Mui-disabled': {
                        background: '#cccccc',
                        color: '#ffffff',
                      }
                    }}
                  >
                    {loading ? '로그인 중…' : '로그인'}
                  </Button>

                  <Box sx={{ textAlign: 'center', pt: 1 }}>
                    <Typography variant='body2' color='text.secondary'>
                      계정이 없나요?{' '}
                      <Link 
                        component={RouterLink} 
                        to='/register'
                        sx={{
                          fontWeight: 600,
                          color: '#667eea',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          }
                        }}
                      >
                        등록
                      </Link>
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Fade>
    </Box>
  );
}
