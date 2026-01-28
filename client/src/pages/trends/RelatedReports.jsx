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
  Stack,
} from '@mui/material';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../api';
import { useAuth } from '../../state/AuthContext.jsx';

export default function RelatedReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const keyword = (searchParams.get('keyword') || '').trim();
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState(null);

  const sortedItems = React.useMemo(() => {
    const items = Array.isArray(data?.items) ? [...data.items] : [];
    // sort: most recent year first, then title
    items.sort((a, b) => {
      const ya = Number(a?.year || 0);
      const yb = Number(b?.year || 0);
      if (yb !== ya) return yb - ya;
      const ta = String(a?.title || '');
      const tb = String(b?.title || '');
      return ta.localeCompare(tb, 'ko');
    });
    return items;
  }, [data]);

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
        if (keyword) params.set('keyword', keyword);
        if (f.q) params.set('q', f.q);
        if (f.scope) params.set('scope', f.scope);
        if (f.institute) params.set('institute', f.institute);
        if (f.year) params.set('year', f.year);
        params.set('limit', '100');
        params.set('offset', '0');

        const res = keyword
          ? await apiFetch(`/api/trends/related?${params.toString()}`, { auth: true })
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
  }, [user, keyword, f.scope, f.institute, f.year, f.q]);

  return (
    <Box>
      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1 }}>
          <Typography variant='subtitle1' sx={{ fontWeight: 800, flexGrow: 1 }}>
            {keyword ? '관련 보고서' : '보고서 목록'} (로그인 필요)
          </Typography>
          {keyword ? (
            <Button size='small' variant='outlined' onClick={() => navigate('/trends/related')}>키워드 해제</Button>
          ) : null}
        </Stack>
        <Typography variant='caption' color='text.secondary'>
          {keyword ? `선택 키워드(“${keyword}”)에 매칭되는 관련 보고서를 조회합니다.` : '상단의 공통 조회 조건(연구기관 구분/기관/연도/검색어)으로 보고서를 조회합니다.'}
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
                {sortedItems.map((r) => (
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
