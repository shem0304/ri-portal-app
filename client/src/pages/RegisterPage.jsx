import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, TextField, Typography, Alert, Link, Fade, keyframes } from '@mui/material';
import { useAuth } from '../state/AuthContext';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import BusinessIcon from '@mui/icons-material/Business';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = React.useState('');
  const [org, setOrg] = React.useState('');
  const [email, setEmail] = React.useState('');
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
      setTimeout(() => navigate('/login', { replace: true }), 400);
    } catch (err) {
      setError(err.message || '등록 실패');
    }
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
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
                background: 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
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
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(240, 147, 251, 0.4)',
                  }}
                >
                  <PersonAddIcon sx={{ fontSize: 40, color: 'white' }} />
                </Box>
              </Box>

              <Typography 
                variant='h4' 
                sx={{ 
                  fontWeight: 800, 
                  mb: 1, 
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                사용자 등록
              </Typography>
              
              <Typography 
                variant='body2' 
                color='text.secondary' 
                sx={{ mb: 4, textAlign: 'center' }}
              >
                등록 후 <strong>관리자 승인</strong>이 완료되어야 로그인할 수 있습니다.
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
              
              {success && (
                <Fade in>
                  <Alert 
                    severity='success' 
                    sx={{ 
                      mb: 2,
                      borderRadius: 2,
                      '& .MuiAlert-icon': {
                        fontSize: 24,
                      }
                    }}
                  >
                    {success}
                  </Alert>
                </Fade>
              )}

              <Box component='form' onSubmit={onSubmit}>
                <Stack spacing={2.5}>
                  <TextField 
                    label='이름' 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                    InputProps={{
                      startAdornment: <PersonOutlineIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.15)',
                        },
                        '&.Mui-focused': {
                          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.25)',
                        }
                      }
                    }}
                  />
                  
                  <TextField 
                    label='소속' 
                    value={org} 
                    onChange={(e) => setOrg(e.target.value)} 
                    required 
                    InputProps={{
                      startAdornment: <BusinessIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.15)',
                        },
                        '&.Mui-focused': {
                          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.25)',
                        }
                      }
                    }}
                  />
                  
                  <TextField
                    label='이메일(또는 아이디)'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder='예: user@example.com'
                    InputProps={{
                      startAdornment: <EmailOutlinedIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.15)',
                        },
                        '&.Mui-focused': {
                          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.25)',
                        }
                      }
                    }}
                  />
                  
                  <TextField 
                    label='비밀번호' 
                    type='password' 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    InputProps={{
                      startAdornment: <LockOutlinedIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.15)',
                        },
                        '&.Mui-focused': {
                          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.25)',
                        }
                      }
                    }}
                  />

                  <Button 
                    type='submit' 
                    variant='contained' 
                    size='large'
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      boxShadow: '0 4px 15px rgba(240, 147, 251, 0.4)',
                      transition: 'all 0.3s',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #e082ea 0%, #e4465b 100%)',
                        boxShadow: '0 6px 20px rgba(240, 147, 251, 0.6)',
                        transform: 'translateY(-2px)',
                      },
                      '&:active': {
                        transform: 'translateY(0)',
                      }
                    }}
                  >
                    등록 요청
                  </Button>

                  <Box sx={{ textAlign: 'center', pt: 1 }}>
                    <Typography variant='body2' color='text.secondary'>
                      이미 계정이 있나요?{' '}
                      <Link 
                        component={RouterLink} 
                        to='/login'
                        sx={{
                          fontWeight: 600,
                          color: '#f093fb',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          }
                        }}
                      >
                        로그인
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
