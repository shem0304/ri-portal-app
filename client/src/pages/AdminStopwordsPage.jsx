import React from 'react';
import {
  Box, Card, CardContent, Typography, Alert, Button, Stack, TextField, Chip, Divider, Fade, Paper
} from '@mui/material';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { apiFetch } from '../api';
import { useAuth } from '../state/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AdminStopwordsPage() {
  const { user } = useAuth();
  const [words, setWords] = React.useState([]);
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const [addText, setAddText] = React.useState('');

  async function refresh() {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/stopwords', { auth: true });
      setWords(res.words || []);
    } catch (e) {
      setError(e.message || '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { refresh(); }, []);

  if (!user) return <Navigate to="/login" replace />;
  if ((user.role || 'user') !== 'admin') return <Navigate to="/" replace />;

  async function add() {
    setError('');
    setInfo('');
    const raw = addText.trim();
    if (!raw) return;
    try {
      const res = await apiFetch('/api/admin/stopwords/add', {
        method: 'POST',
        auth: true,
        body: { words: raw },
      });
      setWords(res.words || []);
      setAddText('');
      setInfo('불용어가 추가되었습니다.');
    } catch (e) {
      setError(e.message || '추가 실패');
    }
  }

  async function remove(word) {
    setError('');
    setInfo('');
    try {
      const res = await apiFetch('/api/admin/stopwords/remove', {
        method: 'POST',
        auth: true,
        body: { word },
      });
      setWords(res.words || []);
      setInfo('불용어가 삭제되었습니다.');
    } catch (e) {
      setError(e.message || '삭제 실패');
    }
  }

  async function replaceAll() {
    setError('');
    setInfo('');
    try {
      const res = await apiFetch('/api/admin/stopwords', {
        method: 'PUT',
        auth: true,
        body: { words },
      });
      setWords(res.words || []);
      setInfo('불용어 목록이 저장되었습니다.');
    } catch (e) {
      setError(e.message || '저장 실패');
    }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', mt: 3 }}>
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
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(240, 147, 251, 0.3)',
              }}
            >
              <SpellcheckIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography 
              variant='h4' 
              sx={{ 
                fontWeight: 800,
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              불용어 관리
            </Typography>
          </Stack>

          {error && (
            <Fade in>
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
            </Fade>
          )}
          
          {info && (
            <Fade in>
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{info}</Alert>
            </Fade>
          )}

          {/* 추가 카드 */}
          <Card 
            sx={{ 
              borderRadius: 4, 
              mb: 3,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                불용어 추가
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                쉼표/공백/줄바꿈으로 여러 개를 한 번에 입력할 수 있습니다. (예: "성과, 추진, 활성화")
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="추가할 불용어"
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="예: 연구, 분석, 방안"
                  onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(240, 147, 251, 0.1)',
                      },
                      '&.Mui-focused': {
                        boxShadow: '0 4px 16px rgba(240, 147, 251, 0.2)',
                      }
                    }
                  }}
                />
                <Button 
                  variant="contained" 
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={add} 
                  disabled={!addText.trim() || loading}
                  sx={{
                    minWidth: 120,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #e082ea 0%, #e4465b 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(240, 147, 251, 0.4)',
                    },
                  }}
                >
                  추가
                </Button>
                <Button 
                  variant="outlined" 
                  startIcon={<RefreshIcon />}
                  onClick={refresh} 
                  disabled={loading}
                  sx={{
                    minWidth: 120,
                    borderRadius: 2,
                    borderColor: '#f093fb',
                    color: '#f093fb',
                    '&:hover': {
                      borderColor: '#e082ea',
                      background: 'rgba(240, 147, 251, 0.05)',
                    },
                  }}
                >
                  새로고침
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* 목록 카드 */}
          <Card 
            sx={{ 
              borderRadius: 4,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                justifyContent="space-between" 
                alignItems={{ sm: 'center' }} 
                sx={{ mb: 3 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  등록된 불용어 ({words.length})
                </Typography>
                <Button 
                  variant="contained" 
                  startIcon={<SaveIcon />}
                  onClick={replaceAll} 
                  disabled={loading}
                  sx={{
                    mt: { xs: 2, sm: 0 },
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                    },
                  }}
                >
                  목록 저장
                </Button>
              </Stack>

              <Divider sx={{ mb: 3 }} />

              {words.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 6,
                    textAlign: 'center',
                    background: 'rgba(240, 147, 251, 0.05)',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    등록된 불용어가 없습니다.
                  </Typography>
                </Paper>
              ) : (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {words.map((w) => (
                    <Chip
                      key={w}
                      label={w}
                      onDelete={() => remove(w)}
                      sx={{
                        mb: 1,
                        borderRadius: 2,
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, rgba(240, 147, 251, 0.1) 0%, rgba(245, 87, 108, 0.1) 100%)',
                        border: '1px solid rgba(240, 147, 251, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, rgba(240, 147, 251, 0.2) 0%, rgba(245, 87, 108, 0.2) 100%)',
                        },
                      }}
                    />
                  ))}
                </Stack>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
                * 불용어는 '연구 트렌드'의 키워드/버스트 분석에서 제외됩니다.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Fade>
    </Box>
  );
}
