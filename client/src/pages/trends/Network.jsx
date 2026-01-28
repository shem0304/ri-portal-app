import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Box, Button, Divider, Grid, Paper, Slider, Stack, Typography } from '@mui/material';
import ForceGraph2D from 'react-force-graph-2d';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { apiFetch } from '../../api';
import { useAuth } from '../../state/AuthContext.jsx';

export default function Network() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };

  const [topKeywords, setTopKeywords] = React.useState(120);
  const [edgeTop, setEdgeTop] = React.useState(400);
  const [net, setNet] = React.useState(null);
  const [hover, setHover] = React.useState(null);
  const [selected, setSelected] = React.useState('');
  const [series, setSeries] = React.useState(null);
  const [related, setRelated] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set('topKeywords', String(topKeywords));
        params.set('edgeTop', String(edgeTop));
        params.set('scope', f.scope || 'all');
        if (f.institute) params.set('institute', f.institute);
        if (f.year) params.set('year', f.year);
        if (f.q) params.set('q', f.q);
        const res = await apiFetch(`/api/trends/network?${params.toString()}`);
        if (alive) setNet(res);
      } catch {
        if (alive) setNet({ nodes: [], edges: [] });
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [topKeywords, edgeTop, f.scope, f.institute, f.year, f.q]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!selected) {
        setSeries(null);
        setRelated(null);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set('keyword', selected);
        params.set('scope', f.scope || 'all');
        if (f.institute) params.set('institute', f.institute);
        if (f.year) params.set('year', f.year);
        if (f.q) params.set('q', f.q);
        const s = await apiFetch(`/api/trends/keyword?${params.toString()}`);
        if (alive) setSeries(s);
      } catch {
        if (alive) setSeries(null);
      }

      if (user) {
        try {
          const params = new URLSearchParams();
          params.set('keyword', selected);
          params.set('limit', '50');
          params.set('scope', f.scope || 'all');
          if (f.institute) params.set('institute', f.institute);
          if (f.year) params.set('year', f.year);
          if (f.q) params.set('q', f.q);
          const rr = await apiFetch(`/api/trends/related?${params.toString()}`, { auth: true });
          if (alive) setRelated(rr);
        } catch {
          if (alive) setRelated(null);
        }
      } else {
        setRelated(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selected, user, f.scope, f.institute, f.year, f.q]);

  if (!net) return <Typography>로딩 중…</Typography>;

  const graphData = {
    nodes: (net.nodes || []).map((n) => ({ ...n })),
    links: (net.edges || []).map((e) => ({ source: e.source, target: e.target, value: e.weight })),
  };

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>
              키워드 동시출연 네트워크
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              보고서 제목 토큰의 동시출연(보고서 단위)으로 키워드 네트워크를 구성했습니다.
            </Typography>

            <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} sx={{ mt: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant='caption'>노드 수(상위 키워드): {topKeywords}</Typography>
                <Slider value={topKeywords} min={40} max={250} step={10} onChange={(_, v) => setTopKeywords(v)} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant='caption'>엣지 수(상위 동시출연): {edgeTop}</Typography>
                <Slider value={edgeTop} min={100} max={1200} step={50} onChange={(_, v) => setEdgeTop(v)} />
              </Box>
            </Stack>

            <Box sx={{ height: 520, mt: 1, borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default' }}>
              <ForceGraph2D
                graphData={graphData}
                nodeRelSize={4}
                nodeVal={(n) => n.size || 1}
                linkWidth={(l) => Math.max(1, Math.log(1 + (l.value || 1)))}
                onNodeHover={(n) => setHover(n ? n.id : null)}
                onNodeClick={(n) => setSelected(n.id)}
              />
            </Box>

            <Typography variant='caption' color='text.secondary'>
              Hover: {hover || '-'} · Click: {selected || '-'}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3, mb: 2 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 800, mb: 1 }}>
              선택 키워드 추이
            </Typography>
            {selected ? (
              series ? (
                <Box sx={{ height: 240 }}>
                  <ResponsiveContainer width='100%' height='100%'>
                    <LineChart data={series.data || []}>
                      <XAxis dataKey='year' />
                      <YAxis />
                      <Tooltip />
                      <Line type='monotone' dataKey='count' strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography variant='body2' color='text.secondary'>로딩 중…</Typography>
              )
            ) : (
              <Typography variant='body2' color='text.secondary'>왼쪽 그래프에서 노드를 클릭하세요.</Typography>
            )}
          </Paper>

          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 800, mb: 1 }}>
              관련 보고서 (로그인 필요)
            </Typography>
            {!selected ? (
              <Typography variant='body2' color='text.secondary'>키워드를 선택하면 관련 보고서를 보여줍니다.</Typography>
            ) : !user ? (
              <Stack spacing={1}>
                <Typography variant='body2' color='text.secondary'>관련 보고서 목록은 로그인 후 열람할 수 있습니다.</Typography>
                <Button variant='contained' href='/login'>로그인</Button>
              </Stack>
            ) : (
              <Box>
                {related?.items?.length ? (
                  <Box>
                    {related.items.slice(0, 10).map((r) => (
                      <Box key={r.id} sx={{ mb: 1 }}>
                        <Typography variant='body2' sx={{ fontWeight: 700 }}>{r.title}</Typography>
                        <Typography variant='caption' color='text.secondary'>{r.year} · {r.institute}</Typography>
                        <Divider sx={{ mt: 1 }} />
                      </Box>
                    ))}
                    <Button
                      size='small'
                      onClick={() => {
                        const p = new URLSearchParams();
                        p.set('keyword', selected);
                        p.set('scope', f.scope || 'all');
                        // Only constrain by institute when a specific institute is selected (not '기관 전체')
                        if (f.institute && f.institute !== '기관 전체') p.set('institute', f.institute);
                        if (f.year) p.set('year', f.year);
                        if (f.q) p.set('q', f.q);
                        navigate(`/trends/related?${p.toString()}`);
                      }}
                      sx={{ mt: 1 }}
                    >
                      전체 보기
                    </Button>
                  </Box>
                ) : (
                  <Typography variant='body2' color='text.secondary'>해당 키워드로 매칭되는 보고서가 없습니다.</Typography>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
