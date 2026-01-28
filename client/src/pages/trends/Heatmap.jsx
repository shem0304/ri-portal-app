import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Paper, Slider, Stack, Typography } from '@mui/material';
import { apiFetch } from '../../api';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function labelScope(scope) {
  if (scope === 'local') return '지자체연구기관';
  if (scope === 'national') return '정부출연연구기관';
  return '전체';
}

export default function Heatmap() {
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };
  const [topKeywords, setTopKeywords] = React.useState(30);
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      params.set('topKeywords', String(topKeywords));
      params.set('scope', f.scope || 'all');
      if (f.institute) params.set('institute', f.institute);
      if (f.year) params.set('year', f.year);
      if (f.q) params.set('q', f.q);

      const res = await apiFetch(`/api/trends/heatmap?${params.toString()}`);
      if (alive) setData(res);
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [topKeywords, f.scope, f.institute, f.year, f.q]);

  if (!data) return <Typography>로딩 중…</Typography>;

  const keywords = data.keywords || [];
  const rows = data.rows || [];

  // compute max for scaling
  let vmax = 0;
  for (const r of rows) {
    for (const k of keywords) vmax = Math.max(vmax, Number(r[k] || 0));
  }
  vmax = vmax || 1;

  const filterSummary = `구분: ${labelScope(f.scope || 'all')}`
    + (f.institute ? ` · 기관: ${f.institute}` : ' · 기관: 전체')
    + (f.year ? ` · 연도: ${f.year}` : ' · 연도: 전체')
    + (f.q ? ` · 검색어: ${f.q}` : '');

  return (
    <Box>
      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        {/* Header: title (left) + active filters (right) */}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', md: 'flex-start' }}
          justifyContent='space-between'
          sx={{ mb: 1, flexWrap: 'wrap' }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 260 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>기관별 키워드 프로파일(히트맵)</Typography>
            <Typography variant='caption' color='text.secondary'>기관 내 보고서 수로 정규화한 키워드 출현 비율(0~1)입니다.</Typography>
          </Box>

          <Typography
            variant='caption'
            sx={{
              ml: { md: 2 },
              textAlign: { xs: 'left', md: 'right' },
              color: 'text.secondary',
              whiteSpace: 'normal',
              wordBreak: 'keep-all',
              flexShrink: 0,
              maxWidth: { md: 520 },
            }}
          >
            {filterSummary}
          </Typography>
        </Stack>

        <Box>
          <Typography variant='caption'>표시 키워드 수: {topKeywords}</Typography>
          <Slider value={topKeywords} min={10} max={60} step={5} onChange={(_, v) => setTopKeywords(v)} />
        </Box>

        <Box sx={{ mt: 2, overflow: 'auto', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ minWidth: 900 }}>
            {/* Header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: `220px repeat(${keywords.length}, 90px)`, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ p: 1, fontWeight: 800, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 3 }}>기관</Box>
              {keywords.map(k => (
                <Box key={k} sx={{ p: 1, fontSize: 12, fontWeight: 700, borderLeft: '1px solid', borderColor: 'divider' }}>{k}</Box>
              ))}
            </Box>

            {/* Rows */}
            {rows.map((r) => (
              <Box key={r.institute} sx={{ display: 'grid', gridTemplateColumns: `220px repeat(${keywords.length}, 90px)`, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ p: 1, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, fontSize: 13, fontWeight: 700, borderRight: '1px solid', borderColor: 'divider' }}>{r.institute}</Box>
                {keywords.map((k) => {
                  const v = Number(r[k] || 0);
                  const a = clamp01(v / vmax);
                  return (
                    <Box
                      key={k}
                      title={`${k}: ${(v * 100).toFixed(2)}%`}
                      sx={{
                        p: 1,
                        borderLeft: '1px solid',
                        borderColor: 'divider',
                        bgcolor: `rgba(25, 118, 210, ${0.05 + 0.85 * a})`,
                        color: a > 0.55 ? 'white' : 'rgba(0,0,0,0.85)',
                        fontSize: 12,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {(v * 100).toFixed(1)}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
