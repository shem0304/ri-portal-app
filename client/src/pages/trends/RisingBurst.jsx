import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Grid, Paper, Typography, List, ListItemButton, ListItemText } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import { apiFetch } from '../../api';

export default function RisingBurst() {
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };

  const [rising, setRising] = React.useState(null);
  const [burst, setBurst] = React.useState(null);
  const [selected, setSelected] = React.useState('');
  const [series, setSeries] = React.useState(null);
  const [seriesLoading, setSeriesLoading] = React.useState(false);
  const [seriesError, setSeriesError] = React.useState('');

  React.useEffect(() => {
    (async () => {
      const p = new URLSearchParams();
      p.set('top', '20');
      p.set('scope', f.scope || 'all');
      if (f.institute && f.institute !== '기관 전체') p.set('institute', f.institute);
      if (f.year) p.set('year', f.year);
      if (f.q) p.set('q', f.q);

      const [r, b] = await Promise.all([
        apiFetch(`/api/trends/rising?${p.toString()}`),
        apiFetch(`/api/trends/burst?${p.toString()}`),
      ]);
      setRising(r);
      setBurst(b);
    })();
  }, [f.scope, f.institute, f.year, f.q]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selected) return;
      setSeries(null);
      setSeriesError('');
      setSeriesLoading(true);
      try {
        const p = new URLSearchParams();
        p.set('keyword', selected);
        p.set('scope', f.scope || 'all');
        if (f.institute && f.institute !== '기관 전체') p.set('institute', f.institute);
        if (f.year) p.set('year', f.year);
        if (f.q) p.set('q', f.q);
        // cache-bust to avoid 304 / stale data
        p.set('_ts', String(Date.now()));
        const s = await apiFetch(`/api/trends/keyword?${p.toString()}`, { cache: 'no-store' });
        const norm = Array.isArray(s?.data)
          ? s.data.map((d) => ({ year: String(d?.year ?? ''), count: Number(d?.count ?? 0) }))
          : [];
        if (!cancelled) setSeries({ ...s, data: norm });
      } catch (e) {
        if (!cancelled) setSeriesError(e?.message || '시계열 데이터를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setSeriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, f.scope, f.institute, f.year, f.q]);

  if (!rising || !burst) return <Typography>로딩 중…</Typography>;

  const risingData = (rising.items || []).map(d => ({ keyword: d.keyword, growth: Number(d.growth.toFixed(2)), compare: d.compareCount, base: d.baseCount }));
  const burstData = (burst.items || []).map(d => ({ keyword: d.keyword, z: Number(d.z.toFixed(2)), count: d.lastVal }));

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>급상승 키워드 Top 20</Typography>
            <Typography variant='caption' color='text.secondary'>최근 2개 연도 비교: {rising.baseYear} → {rising.compareYear}</Typography>
            <Box sx={{ height: 320, mt: 1 }}>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={risingData} layout='vertical' margin={{ left: 20 }}>
                  <XAxis type='number' />
                  <YAxis type='category' dataKey='keyword' width={120} />
                  <Tooltip />
                  <Bar dataKey='growth' />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>신규·급증 키워드(버스트) Top 20</Typography>
            <Typography variant='caption' color='text.secondary'>최근연도({burst.year}) z-score 기준</Typography>
            <Box sx={{ height: 320, mt: 1 }}>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={burstData} layout='vertical' margin={{ left: 20 }}>
                  <XAxis type='number' />
                  <YAxis type='category' dataKey='keyword' width={120} />
                  <Tooltip />
                  <Bar dataKey='z' />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>버스트 키워드 시계열 그래프</Typography>
            <Typography variant='body2' color='text.secondary'>아래 목록에서 키워드를 선택하면 연도별 추이를 표시합니다.</Typography>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={4}>
                <List dense>
                  {(burst.items || []).map(it => (
                    <ListItemButton key={it.keyword} selected={selected === it.keyword} onClick={() => setSelected(it.keyword)}>
                      <ListItemText primary={it.keyword} secondary={`z=${it.z.toFixed(2)} · ${burst.year}=${it.lastVal}`} />
                    </ListItemButton>
                  ))}
                </List>
              </Grid>
              <Grid item xs={12} md={8}>
                {seriesLoading ? (
                  <Typography variant='body2' color='text.secondary'>불러오는 중…</Typography>
                ) : seriesError ? (
                  <Typography variant='body2' color='error.main'>{seriesError}</Typography>
                ) : !selected ? (
                  <Typography variant='body2' color='text.secondary'>키워드를 선택하세요.</Typography>
                ) : (
                  <>
                    {(series?.data || []).length === 0 ? (
                      <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                        선택 키워드(“{selected}”)의 시계열 데이터가 없습니다.
                      </Typography>
                    ) : null}
                    <Box sx={{ height: 320, minHeight: 320 }}>
                      <ResponsiveContainer width='100%' height='100%'>
                        <LineChart data={series?.data || []} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                          <XAxis dataKey='year' />
                          <YAxis domain={[0, 'dataMax']} allowDecimals={false} />
                          <Tooltip />
                          <Line type='monotone' dataKey='count' stroke='#d32f2f' strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>

                    {/* Debug preview (helps verify data in production) */}
                    <Box sx={{ mt: 1 }}>
                      <Typography variant='caption' color='text.secondary'>
                        데이터 포인트: {(series?.data || []).length} · resolved: {series?.resolvedKeyword || '-'}
                      </Typography>
                    </Box>
                  </>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
