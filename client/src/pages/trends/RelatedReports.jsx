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
  const outlet = useOutletContext();
  const { trendFilters, setTrendFilters } = outlet || {};
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState(null);

  const keywordFromUrl = React.useMemo(() => {
    const p = new URLSearchParams(location.search);
    return (p.get('keyword') || '').trim();
  }, [location.search]);

  const urlFilters = React.useMemo(() => {
    const p = new URLSearchParams(location.search);
    const scope = (p.get('scope') || '').trim();
    const institute = (p.get('institute') || '').trim();
    const year = (p.get('year') || '').trim();
    const q = (p.get('q') || '').trim();
    return { scope, institute, year, q };
  }, [location.search]);

  const effectiveFilters = React.useMemo(() => {
    // URL params (when provided) override shared filters so navigation from Network is consistent
    const ef = { ...f };
    if (urlFilters.q !== '') ef.q = urlFilters.q;
    if (urlFilters.scope !== '') ef.scope = urlFilters.scope;
    if (urlFilters.institute !== '') ef.institute = urlFilters.institute;
    if (urlFilters.year !== '') ef.year = urlFilters.year;
    return ef;
  }, [f, urlFilters]);

  const syncedRef = React.useRef(false);
  React.useEffect(() => {
    // Sync combo-box state (shared header filters) with URL params when arriving from Network
    if (syncedRef.current) return;
    const hasUrl = Object.values(urlFilters).some((v) => v !== '');
    if (!hasUrl) return;
    if (typeof setTrendFilters !== 'function') return;

    syncedRef.current = true;
    setTrendFilters((prev) => ({
      ...(prev || {}),
      ...(urlFilters.q !== '' ? { q: urlFilters.q } : {}),
      ...(urlFilters.scope !== '' ? { scope: urlFilters.scope } : {}),
      ...(urlFilters.institute !== '' ? { institute: urlFilters.institute } : {}),
      ...(urlFilters.year !== '' ? { year: urlFilters.year } : {}),
    }));
  }, [setTrendFilters, urlFilters]);

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
        if (effectiveFilters.q) params.set('q', effectiveFilters.q);
        if (effectiveFilters.scope) params.set('scope', effectiveFilters.scope);
        // Only constrain by institute when a specific institute is selected (not '기관 전체')
        if (effectiveFilters.institute && effectiveFilters.institute !== '기관 전체') params.set('institute', effectiveFilters.institute);
        if (effectiveFilters.year) params.set('year', effectiveFilters.year);
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
  }, [user, keywordFromUrl, effectiveFilters.scope, effectiveFilters.institute, effectiveFilters.year, effectiveFilters.q]);

  return (
    <Box>
      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant='subtitle1' sx={{ fontWeight: 800, mb: 1 }}>
          보고서 목록 (로그인 필요)
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          상단의 공통 조회 조건(연구기관 구분/기관/연도/검색어)으로 보고서를 조회합니다.
          {keywordFromUrl ? ` (선택 키워드: ${keywordFromUrl})` : ''}
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
