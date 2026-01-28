import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import { apiFetch } from '../../api';

export default function Overview() {
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      const params = new URLSearchParams();
      params.set('top', '100');
      params.set('scope', f.scope || 'all');
      if (f.institute) params.set('institute', f.institute);
      if (f.year) params.set('year', f.year);
      if (f.q) params.set('q', f.q);
      const s = await apiFetch(`/api/trends/summary?${params.toString()}`);
      setData(s);
    })();
  }, [f.scope, f.institute, f.year, f.q]);

  if (!data) return <Typography>로딩 중…</Typography>;

  const reportsPerYear = (data.reportsPerYear || []).slice().sort((a, b) => a.year - b.year);
  const topInstitutes = (data.reportsPerInstitute || []).slice(0, 12);
  const topKeywords = (data.topKeywords || []).slice(0, 15).map(d => ({ name: d.key, value: d.value }));

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>연도별 보고서 발행량</Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart data={reportsPerYear}>
                  <XAxis dataKey='year' />
                  <YAxis />
                  <Tooltip />
                  <Line type='monotone' dataKey='count' strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>기관별 보고서 발행량 (Top 12)</Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={topInstitutes} layout='vertical' margin={{ left: 50 }}>
                  <XAxis type='number' />
                  <YAxis type='category' dataKey='institute' width={140} />
                  <Tooltip />
                  <Bar dataKey='count' />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>키워드 빈도 (Top 15)</Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={topKeywords}>
                  <XAxis dataKey='name' interval={0} angle={-25} textAnchor='end' height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey='value' />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
