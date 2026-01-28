import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Paper, Stack, TextField, Typography } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { apiFetch } from '../../api';

export default function Keywords() {
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };
  const [top, setTop] = React.useState(200);
  const [query, setQuery] = React.useState('');
  const [data, setData] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      const params = new URLSearchParams();
      params.set('top', String(top));
      params.set('scope', f.scope || 'all');
      if (f.institute) params.set('institute', f.institute);
      if (f.year) params.set('year', f.year);
      if (f.q) params.set('q', f.q);
      const s = await apiFetch(`/api/trends/summary?${params.toString()}`);
      setData(s.topKeywords || []);
    })();
  }, [top, f.scope, f.institute, f.year, f.q]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(d => String(d.key || '').includes(q));
  }, [data, query]);

  const chartData = filtered.slice(0, 30).map(d => ({ name: d.key, value: d.value }));

  return (
    <Box>
      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems='center' sx={{ mb: 2 }}>
          <Typography variant='subtitle1' sx={{ fontWeight: 700, flexGrow: 1 }}>키워드 목록</Typography>
          <TextField label='키워드 필터' value={query} onChange={(e) => setQuery(e.target.value)} />
          <TextField
            label='불러올 상위 N'
            type='number'
            value={top}
            onChange={(e) => setTop(Math.max(50, Math.min(2000, Number(e.target.value) || 200)))}
            sx={{ width: 160 }}
          />
        </Stack>
        <Typography variant='caption' color='text.secondary'>표시는 상위 30개(필터 적용 후)만 시각화합니다.</Typography>
        <Box sx={{ height: 360, mt: 1.5 }}>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={chartData}>
              <XAxis dataKey='name' interval={0} angle={-30} textAnchor='end' height={90} />
              <YAxis />
              <Tooltip />
              <Bar dataKey='value' />
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <Box sx={{ mt: 2 }}>
          {filtered.slice(0, 80).map(d => (
            <Typography key={d.key} variant='body2' sx={{ display: 'inline-block', mr: 1.5, mb: 0.5 }}>
              <strong>{d.key}</strong> ({d.value})
            </Typography>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
