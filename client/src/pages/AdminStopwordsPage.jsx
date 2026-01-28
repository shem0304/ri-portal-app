import React from 'react';
import {
  Box, Card, CardContent, Typography, Alert, Button, Stack, TextField, Chip, Divider
} from '@mui/material';
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
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>관리자 · 불용어 등록</Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {info ? <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert> : null}

      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>불용어 추가</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            쉼표/공백/줄바꿈으로 여러 개를 한 번에 입력할 수 있습니다. (예: “성과, 추진, 활성화”)
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <TextField
              fullWidth
              label="추가할 불용어"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="예: 연구, 분석, 방안"
            />
            <Button variant="contained" onClick={add} disabled={!addText.trim() || loading}>
              추가
            </Button>
            <Button variant="outlined" onClick={refresh} disabled={loading}>
              새로고침
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>등록된 불용어 ({words.length})</Typography>
            <Button variant="outlined" onClick={replaceAll} disabled={loading}>
              목록 저장
            </Button>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {words.length === 0 ? (
            <Typography variant="body2" color="text.secondary">등록된 불용어가 없습니다.</Typography>
          ) : (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {words.map((w) => (
                <Chip
                  key={w}
                  label={w}
                  onDelete={() => remove(w)}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            * 불용어는 ‘연구 트렌드’의 키워드/버스트 분석에서 제외됩니다.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
