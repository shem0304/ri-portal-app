import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import cloud from 'd3-cloud';
import { apiFetch } from '../../api';

function useElementSize() {
  const ref = React.useRef(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: Math.floor(cr.width), height: Math.floor(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

function fontSizeScale(v, vMin, vMax) {
  if (vMax <= vMin) return 28;
  const t = (v - vMin) / (vMax - vMin);
  return Math.floor(14 + t * 46);
}

function colorForWord(text) {
  // Deterministic vivid color per word.
  const s = String(text || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

export default function WordCloud() {
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };

  const [top, setTop] = React.useState(50);
  const [input, setInput] = React.useState('50');
  const [data, setData] = React.useState(null);
  const [layout, setLayout] = React.useState(null);
  const [wrapRef, size] = useElementSize();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async (n) => {
    const safe = Math.max(1, Math.min(500, Number(n) || 50));
    setTop(safe);
    setLayout(null);
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('top', String(safe));
      params.set('scope', f.scope || 'all');
      if (f.institute) params.set('institute', f.institute);
      if (f.year) params.set('year', f.year);
      if (f.q) params.set('q', f.q);
      const res = await apiFetch(`/api/trends/wordcloud?${params.toString()}`);
      setData(res);
    } catch (e) {
      setData(null);
      setError(e?.message || '워드클라우드 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [f.scope, f.institute, f.year, f.q]);

  React.useEffect(() => {
    load(top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.scope, f.institute, f.year, f.q]);

  React.useEffect(() => {
    if (!data?.items?.length) return;
    if (size.width < 240 || size.height < 240) return;

    const words = data.items.slice(0, top);
    const values = words.map((w) => w.value);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);

    const layouter = cloud()
      .size([size.width, size.height])
      .words(words.map((w) => ({ text: w.text, value: w.value })))
      .padding(2)
      .rotate(() => 0)
      .font('sans-serif')
      .fontSize((d) => fontSizeScale(d.value, vMin, vMax))
      .on('end', (out) => setLayout(out));

    layouter.start();
    return () => {
      try { layouter.stop(); } catch { /* ignore */ }
    };
  }, [data, size.width, size.height, top]);

  return (
    <Box>
      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
        >
          <Typography variant='subtitle1' sx={{ fontWeight: 800, flex: 1 }}>
            워드 클라우드 (Top N)
          </Typography>
          <TextField
            size='small'
            label='Top N (1~500)'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            sx={{ width: 160 }}
          />
          <Button variant='contained' onClick={() => load(input)} disabled={loading}>
            적용
          </Button>
        </Stack>
        <Typography variant='caption' color='text.secondary'>
          제목 토큰 기반 빈도 가중치로 단어 크기를 결정합니다.
        </Typography>

        <Box
          ref={wrapRef}
          sx={{ mt: 2, height: 520, position: 'relative', overflow: 'hidden' }}
        >
          {error ? (
            <Typography variant='body2' color='error'>
              {error}
            </Typography>
          ) : layout ? (
            <svg width={size.width} height={size.height}>
              <g transform={`translate(${size.width / 2},${size.height / 2})`}>
                {layout.map((w, idx) => (
                  <text
                    key={`${w.text}-${idx}`}
                    textAnchor='middle'
                    transform={`translate(${w.x},${w.y}) rotate(${w.rotate})`}
                    fontSize={w.size}
                    fill={colorForWord(w.text)}
                    style={{ cursor: 'default', userSelect: 'none' }}
                  >
                    {w.text}
                  </text>
                ))}
              </g>
            </svg>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              {loading ? '로딩 중…' : '표시할 데이터가 없습니다.'}
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
