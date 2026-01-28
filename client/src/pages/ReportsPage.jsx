import React from 'react';
import {
  Box, Button, Card, CardContent, Chip, Divider, Grid, MenuItem, Pagination, Select,
  Stack, TextField, Typography, Link
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { apiFetch } from '../api';

function ReportCard({ item }) {
  return (
    <Card variant='outlined' sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>{item.title}</Typography>
        <Stack direction='row' spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Chip size='small' label={item.year} />
          <Chip size='small' label={item.institute} />
          <Chip size='small' label={item.scope === 'local' ? '지자체' : '정부출연'} />
        </Stack>
        {item.authors?.length ? (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>저자: {item.authors.join(', ')}</Typography>
        ) : null}
        {item.url ? (
          <Link href={item.url} target='_blank' rel='noreferrer' sx={{ mt: 1, display: 'inline-block' }}>링크</Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [q, setQ] = React.useState('');
  const [scope, setScope] = React.useState('all');
  const [year, setYear] = React.useState('');
  const [institute, setInstitute] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [meta, setMeta] = React.useState({ total: 0, limit: 20, offset: 0 });
  const [items, setItems] = React.useState([]);
  const [instOptions, setInstOptions] = React.useState([]);
  const [yearOptions, setYearOptions] = React.useState([]);
  const page = Math.floor(meta.offset / meta.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  // Keep filter option lists in sync with the selected scope.
  // - all: local + national
  // - local: local only
  // - national: national only
  React.useEffect(() => {
    (async () => {
      // National scope uses council-style filters (NRC/NCT) rather than a long institute list.
      // Local/all scopes show institute names.
      if ((scope || 'all') === 'national') {
        setInstOptions(['NRC', 'NCT']);
      } else {
        const qs = new URLSearchParams();
        qs.set('top', '1');
        qs.set('scope', scope || 'all');
        const s = await apiFetch(`/api/trends/summary?${qs.toString()}`);
        setInstOptions((s.reportsPerInstitute || []).map(d => d.institute));

        // Only show years that actually exist in the selected scope.
        const ys = (s.reportsPerYear || [])
          .filter(d => (d?.count || 0) > 0)
          .map(d => d.year);
        setYearOptions(ys.slice().sort((a, b) => b - a));
        return;
      }

      // For national scope, year options are still derived from the scope-specific summary.
      const qs = new URLSearchParams();
      qs.set('top', '1');
      qs.set('scope', scope || 'all');
      const s = await apiFetch(`/api/trends/summary?${qs.toString()}`);
      const ys = (s.reportsPerYear || [])
        .filter(d => (d?.count || 0) > 0)
        .map(d => d.year);
      setYearOptions(ys.slice().sort((a, b) => b - a));
    })();
  }, [scope]);

  async function load({ offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (scope !== 'all') params.set('scope', scope);
    if (year) params.set('year', year);
    if (institute) params.set('institute', institute);
    params.set('limit', String(meta.limit));
    params.set('offset', String(offset));

    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/reports/search?${params.toString()}`, { auth: true });
      setItems(res.items || []);
      setMeta({ total: res.total, limit: res.limit, offset: res.offset });
    } catch (e) {
      setError(e?.message || '검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, year, institute]);

  return (
    <Box>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant='h5' sx={{ fontWeight: 800, mb: 2 }}>연구보고서</Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Select
              value={scope}
              onChange={(e) => {
                // Changing scope should also reset filters that might not exist in the new scope.
                // This prevents confusing empty screens.
                const next = e.target.value;
                setScope(next);
                setYear('');
                setInstitute('');
              }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value='all'>전체</MenuItem>
              <MenuItem value='local'>지자체연구기관</MenuItem>
              <MenuItem value='national'>정부출연연구기관</MenuItem>
            </Select>
            <Select value={institute} onChange={(e) => setInstitute(e.target.value)} displayEmpty sx={{ minWidth: 220 }}>
              <MenuItem value=''>기관 전체</MenuItem>
              {instOptions.slice(0, 250).map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
            </Select>
            <Select value={year} onChange={(e) => setYear(e.target.value)} displayEmpty sx={{ minWidth: 140 }}>
              <MenuItem value=''>연도 전체</MenuItem>
              {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
            <TextField fullWidth placeholder='검색어(키워드/제목)' value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load({ offset: 0 }); }} />
            <Button variant='contained' endIcon={<OpenInNewIcon />} onClick={() => load({ offset: 0 })} disabled={loading}>검색</Button>
          </Stack>

          {error ? (
            <Typography variant='body2' color='error' sx={{ mb: 1 }}>{error}</Typography>
          ) : null}
          <Typography variant='caption' color='text.secondary'>검색 결과: {meta.total}건</Typography>
          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            {items.map(it => (
              <Grid item xs={12} md={6} key={`${it.scope}-${it.id}`}>
                <ReportCard item={it} />
              </Grid>
            ))}
          </Grid>

          <Stack direction='row' justifyContent='center' sx={{ mt: 3 }}>
            <Pagination count={totalPages} page={page} onChange={(_, p) => load({ offset: (p - 1) * meta.limit })} />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
