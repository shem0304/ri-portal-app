import React from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { apiFetch } from '../../api';
import { useAuth } from '../../state/AuthContext.jsx';

export default function RelatedReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState(null);

  const urlParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);

const keywordFromUrl = React.useMemo(() => {
  return (urlParams.get('keyword') || '').trim();
}, [urlParams]);

// Carry over Network combo selections via URL (1st/2nd/3rd combos: scope/institute/year)
const scopeFromUrl = React.useMemo(() => (urlParams.get('scope') || '').trim(), [urlParams]);
const instituteFromUrl = React.useMemo(() => (urlParams.get('institute') || '').trim(), [urlParams]);
const yearFromUrl = React.useMemo(() => (urlParams.get('year') || '').trim(), [urlParams]);
const qFromUrl = React.useMemo(() => (urlParams.get('q') || '').trim(), [urlParams]);

const effectiveScope = React.useMemo(() => {
  // If scope is present in URL (even empty), prefer it; otherwise fallback to global filters.
  if (urlParams.has('scope')) return scopeFromUrl || 'all';
  return f.scope || 'all';
}, [urlParams, scopeFromUrl, f.scope]);

const effectiveInstitute = React.useMemo(() => {
  if (urlParams.has('institute')) return instituteFromUrl;
  return f.institute || '';
}, [urlParams, instituteFromUrl, f.institute]);

const effectiveYear = React.useMemo(() => {
  if (urlParams.has('year')) return yearFromUrl;
  return f.year || '';
}, [urlParams, yearFromUrl, f.year]);

const effectiveQ = React.useMemo(() => {
  if (urlParams.has('q')) return qFromUrl;
  return f.q || '';
}, [urlParams, qFromUrl, f.q]);


  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        setData(null);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (effectiveQ) params.set('q', effectiveQ);
        params.set('scope', effectiveScope || 'all');
        // Only constrain by institute when a specific institute is selected (not '기관 전체')
        if (effectiveInstitute && effectiveInstitute !== '기관 전체') params.set('institute', effectiveInstitute);
        if (effectiveYear) params.set('year', effectiveYear);

        params.set('limit', '100');
        params.set('offset', '0');

        // If navigated from Network (keyword selected), show only reports matched to that keyword.
        const res = keywordFromUrl
          ? await apiFetch(`/api/trends/related?keyword=${encodeURIComponent(keywordFromUrl)}&${params.toString()}`, { auth: true })
          : await apiFetch(`/api/reports/search?${params.toString()}`, { auth: true });
        if (!alive) return;
        setData(res);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || '조회 중 오류가 발생했습니다.');
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [user, keywordFromUrl, effectiveScope, effectiveInstitute, effectiveYear, effectiveQ]);

  return (
    <Box>
      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant='subtitle1' sx={{ fontWeight: 800, mb: 1 }}>
          보고서 목록 (로그인 필요)
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          네트워크 화면에서 넘어온 조회 조건(연구기관 구분/기관/연도/검색어)을 적용해 보고서를 조회합니다.
          {` (구분: ${effectiveScope || 'all'}${effectiveInstitute ? `, 기관: ${effectiveInstitute}` : ''}${effectiveYear ? `, 연도: ${effectiveYear}` : ''}${effectiveQ ? `, 검색어: ${effectiveQ}` : ''})`}{keywordFromUrl ? ` (선택 키워드: ${keywordFromUrl})` : ''}
        </Typography>

        {!user ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
              보고서 목록은 로그인 후 열람할 수 있습니다.
            </Typography>
            <Button variant='contained' onClick={() => navigate('/login')}>
              로그인
            </Button>
          </Box>
        ) : error ? (
          <Typography sx={{ mt: 2 }} color='error' variant='body2'>
            {error}
          </Typography>
        ) : loading ? (
          <Typography sx={{ mt: 2 }} variant='body2' color='text.secondary'>
            로딩 중…
          </Typography>
        ) : data?.items?.length ? (
          <Box sx={{ mt: 2, overflow: 'auto', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Table size='small' sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>연도</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>연구기관</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>보고서명</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>링크</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.year}</TableCell>
                    <TableCell>{r.institute}</TableCell>
                    <TableCell sx={{ maxWidth: 520 }}>{r.title}</TableCell>
                    <TableCell>
                      {r.url ? (
                        <a href={r.url} target='_blank' rel='noreferrer'>열기</a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Typography sx={{ mt: 2 }} variant='body2' color='text.secondary'>
            조건에 맞는 보고서가 없습니다.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
