import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Paper, Stack, TextField, Typography } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { apiFetch } from '../../api';

export default function TimeSeries() {
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };
  const [top5, setTop5] = React.useState(null);
  const [kw, setKw] = React.useState('');
  const [kwSeries, setKwSeries] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      const params = new URLSearchParams();
      params.set('scope', f.scope || 'all');
      if (f.institute) params.set('institute', f.institute);
      if (f.year) params.set('year', f.year);
      if (f.q) params.set('q', f.q);
      const t = await apiFetch(`/api/trends/top5?${params.toString()}`);
      setTop5(t);
    })();
  }, [f.scope, f.institute, f.year, f.q]);

  async function loadKeyword() {
    const k = kw.trim();
    if (!k) return;
    const params = new URLSearchParams();
    params.set('keyword', k);
    params.set('scope', f.scope || 'all');
    if (f.institute) params.set('institute', f.institute);
    if (f.year) params.set('year', f.year);
    if (f.q) params.set('q', f.q);
    const s = await apiFetch(`/api/trends/keyword?${params.toString()}`);
    setKwSeries(s);
  }

  if (!top5) return <Typography>로딩 중…</Typography>;

  // Merge top5 series into a single array keyed by year for recharts
  const years = top5.series?.[0]?.data?.map(d => d.year) || [];
  const merged = years.map((y) => {
    const row = { year: y };
    for (const s of (top5.series || [])) {
      const hit = (s.data || []).find(d => d.year === y);
      row[s.keyword] = hit ? hit.count : 0;
    }
    return row;
  });

  const kwData = kwSeries?.data || [];

  return (
    <Box>
      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>키워드 연도별 추이 (상위 5개)</Typography>
        <Box sx={{ height: 360 }}>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={merged}>
              <XAxis dataKey='year' />
              <YAxis />
              <Tooltip />
              <Legend />
              {(top5.top5 || []).map((k) => (
                <Line key={k} type='monotone' dataKey={k} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Paper>

      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3, mt: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems='center' sx={{ mb: 1 }}>
          <Typography variant='subtitle1' sx={{ fontWeight: 700, flexGrow: 1 }}>키워드 직접 조회</Typography>
          <TextField
            label='키워드'
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadKeyword(); }}
          />
          <TextField
            label='조회'
            value='Enter'
            InputProps={{ readOnly: true }}
            sx={{ width: 90, display: { xs: 'none', md: 'block' } }}
          />
        </Stack>
        {kwSeries ? (
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={kwData}>
                <XAxis dataKey='year' />
                <YAxis />
                <Tooltip />
                <Line type='monotone' dataKey='count' strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Typography variant='body2' color='text.secondary'>키워드를 입력하고 Enter를 누르면 해당 키워드의 연도별 빈도를 표시합니다.</Typography>
        )}
      </Paper>
    </Box>
  );
}
