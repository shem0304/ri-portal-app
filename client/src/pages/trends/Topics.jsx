import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Paper, Slider, Stack, Typography, Divider } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { apiFetch } from '../../api';

function connectedComponents(nodes, edges, minW) {
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (e.weight < minW) continue;
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source).push(e.target);
      adj.get(e.target).push(e.source);
    }
  }
  const seen = new Set();
  const comps = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const stack = [n.id];
    const comp = [];
    seen.add(n.id);
    while (stack.length) {
      const v = stack.pop();
      comp.push(v);
      for (const nb of (adj.get(v) || [])) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

export default function Topics() {
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };
  const [net, setNet] = React.useState(null);
  const [minW, setMinW] = React.useState(6);

  React.useEffect(() => {
    (async () => {
      const params = new URLSearchParams();
      params.set('topKeywords', '160');
      params.set('edgeTop', '900');
      params.set('scope', f.scope || 'all');
      if (f.institute) params.set('institute', f.institute);
      if (f.year) params.set('year', f.year);
      if (f.q) params.set('q', f.q);
      const n = await apiFetch(`/api/trends/network?${params.toString()}`);
      setNet(n);
    })();
  }, [f.scope, f.institute, f.year, f.q]);

  if (!net) return <Typography>로딩 중…</Typography>;

  const nodeSize = new Map((net.nodes || []).map(n => [n.id, n.size || 1]));
  const comps = connectedComponents(net.nodes || [], net.edges || [], minW);

  // Build topic-like clusters
  const clusters = comps.map((ids) => {
    const score = ids.reduce((s, id) => s + (nodeSize.get(id) || 1), 0);
    const top = ids
      .map(id => ({ id, size: nodeSize.get(id) || 1 }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 8)
      .map(x => x.id);
    return { size: ids.length, score, topKeywords: top };
  }).sort((a, b) => b.score - a.score);

  const chartData = clusters.slice(0, 12).map((c, idx) => ({
    topic: `Topic ${idx + 1}`,
    score: Math.round(c.score),
    size: c.size,
    top: c.topKeywords.join(', '),
  }));

  return (
    <Box>
      <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>주제 분포(근사)</Typography>
        <Typography variant='body2' color='text.secondary'>동시출연 네트워크에서 연결요소(connected components)를 주제로 간주한 간이 분포입니다.</Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
          <Typography variant='body2' sx={{ width: 160 }}>엣지 최소 가중치</Typography>
          <Slider value={minW} onChange={(_, v) => setMinW(v)} min={2} max={20} step={1} valueLabelDisplay='auto' sx={{ flexGrow: 1 }} />
          <Typography variant='caption' color='text.secondary'>클러스터 수: {clusters.length}</Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ height: 320 }}>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={chartData} layout='vertical' margin={{ left: 20 }}>
              <XAxis type='number' />
              <YAxis type='category' dataKey='topic' width={90} />
              <Tooltip />
              <Bar dataKey='score' />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Typography variant='subtitle2' sx={{ fontWeight: 700, mt: 2 }}>상위 토픽의 대표 키워드</Typography>
        {chartData.map((d) => (
          <Box key={d.topic} sx={{ mt: 1 }}>
            <Typography variant='body2'><b>{d.topic}</b> (노드 {d.size}개): {d.top}</Typography>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
