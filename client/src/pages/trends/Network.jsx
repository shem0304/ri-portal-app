import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Box, Button, Divider, Grid, Paper, Slider, Stack, Typography, FormControl, MenuItem, Select, TextField, Autocomplete } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ForceGraph2D from 'react-force-graph-2d';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { apiFetch } from '../../api';
import { colorForWord } from './color';
import { useAuth } from '../../state/AuthContext.jsx';

export default function Network() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };

  
  const relatedUrlForKeyword = React.useCallback((kw) => {
    const params = new URLSearchParams();
    params.set('keyword', String(kw || '').trim());
    // carry institute filter from the 2nd combo (기관) so RelatedReports can constrain results
    if (f.institute && f.institute !== '기관 전체') params.set('institute', f.institute);
    return `/trends/related?${params.toString()}`;
  }, [f.institute]);
const [topKeywords, setTopKeywords] = React.useState(120);
  const [edgeTop, setEdgeTop] = React.useState(400);
  const [net, setNet] = React.useState({ nodes: [], edges: [] });
  const [hover, setHover] = React.useState(null);
  const [selected, setSelected] = React.useState('');
  const [keywordInput, setKeywordInput] = React.useState('');
  const [keywordError, setKeywordError] = React.useState('');

  const keywordOptions = React.useMemo(() => {
    const nodes = Array.isArray(net?.nodes) ? net.nodes : [];
    return nodes.map((n) => String(n.id || '')).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [net]);

  const findNodeById = React.useCallback((id) => {
    const nodes = Array.isArray(net?.nodes) ? net.nodes : [];
    return nodes.find((n) => String(n.id) === String(id));
  }, [net]);

  const runKeywordSearch = React.useCallback((raw) => {
    const kw = String(raw || '').trim();
    if (!kw) return;
    const node = findNodeById(kw);
    if (!node) {
      setKeywordError('현재 그래프에 해당 키워드가 없습니다. (상단의 노드 수를 늘려보세요)');
      return;
    }
    setKeywordError('');
    setSelected(kw);
    requestAnimationFrame(() => {
      try {
        const fg = fgRef.current;
        if (!fg) return;
        fg.centerAt(node.x || 0, node.y || 0, 600);
        fg.zoom(2.2, 600);
      } catch {}
    });
  }, [findNodeById]);

  // Focus set: selected node + its 1-hop neighbors
  const selectedSet = React.useMemo(() => {
    if (!selected || !net) return new Set();
    const s = new Set([selected]);
    const edges = Array.isArray(net.edges) ? net.edges : [];
    for (const e of edges) {
      const a = e.source;
      const b = e.target;
      if (a === selected) s.add(b);
      else if (b === selected) s.add(a);
    }
    return s;
  }, [selected, net]);

  // Auto reset selection after 10 seconds (reduces visual clutter)
  React.useEffect(() => {
    if (!selected) return;
    const t = setTimeout(() => {
      setSelected(null);
      setHover((prev) => (prev === selected ? null : prev));
    }, 10_000);
    return () => clearTimeout(t);
  }, [selected]);


  const nodeAlpha = React.useCallback(
    (id) => {
      if (!selected) return 1;
      return selectedSet.has(id) ? 1 : 0.15;
    },
    [selected, selectedSet] );

  const linkAlpha = React.useCallback(
    (l) => {
      if (!selected) return 0.18;
      const a = typeof l.source === 'object' ? l.source.id : l.source;
      const b = typeof l.target === 'object' ? l.target.id : l.target;
      return a === selected || b === selected ? 0.65 : 0.06;
    },
    [selected] );
  const [series, setSeries] = React.useState(null);
  const [related, setRelated] = React.useState(null);
  const fgRef = React.useRef(null);

  // Lightweight collision force (no extra deps) to reduce node overlaps.
  // This is a small O(n^2) force; fine for our node counts (<= ~250).
  const forceCollideLite = React.useCallback((radiusFn, iterations = 2) => {
    let nodes = [];
    function force(alpha) {
      const n = nodes.length;
      if (!n) return;
      for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < n; i++) {
          const a = nodes[i];
          const ra = radiusFn(a);
          for (let j = i + 1; j < n; j++) {
            const b = nodes[j];
            const rb = radiusFn(b);
            let dx = (b.x || 0) - (a.x || 0);
            let dy = (b.y || 0) - (a.y || 0);
            let d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
            const min = ra + rb;
            if (d >= min) continue;
            const m = ((min - d) / d) * 0.5 * (alpha || 1);
            dx *= m;
            dy *= m;
            a.x = (a.x || 0) - dx;
            a.y = (a.y || 0) - dy;
            b.x = (b.x || 0) + dx;
            b.y = (b.y || 0) + dy;
          }
        }
      }
    }
    force.initialize = (_) => { nodes = _ || []; };
    return force;
  }, []);

  // Navigation UX for related reports
  // - select: only select node
  // - dblclick: double click navigates
  // - click: single click navigates (login required)
  const [navMode, setNavMode] = React.useState('click');

  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set('topKeywords', String(topKeywords));
        params.set('edgeTop', String(edgeTop));
        params.set('scope', f.scope || 'all');
        if (f.institute && f.institute !== '기관 전체') params.set('institute', f.institute);
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

  // Layout tuning (spread out + overlap reduction) to resemble the reference network view
  React.useEffect(() => {
    if (!net || !fgRef.current) return;
    const fg = fgRef.current;
    // link distance & strength
    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce.distance((l) => {
        const v = Number(l.value || 1);
        return 70 + Math.max(0, 40 - Math.log(1 + v) * 10);
      });
      linkForce.strength(0.7);
    }
    // charge (repulsion)
    const charge = fg.d3Force('charge');
    if (charge) charge.strength(-120);
    // collision to reduce overlaps
    const collide = forceCollideLite((n) => {
      const s = Number(n.size || 1);
      const r = 4 + Math.sqrt(s) * 2.2;
      return r + 8;
    }, 2);
    fg.d3Force('collide', collide);
    fg.d3ReheatSimulation();
  }, [net]);

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
        if (f.institute && f.institute !== '기관 전체') params.set('institute', f.institute);
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
          if (f.institute && f.institute !== '기관 전체') params.set('institute', f.institute);
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

  const paintNodeLabel = (node, ctx, globalScale) => {
    const id = String(node.id || '');
    if (!id) return;

    const s = Number(node.size || 1);
    const gs = Number(globalScale || 1);
    const x = node.x || 0;
    const y = node.y || 0;

    // Match node radius (keep consistent with node draw)
    const r = 4 + Math.sqrt(s) * 2.2;

    // Keep labels small so we can show more without turning into a blob.
    // IMPORTANT: do NOT scale font with 1/gs (that makes labels huge when zoomed out).
    const boost = node._boost ? 1.15 : 1;
    const fontSize = Math.max(5, Math.min(9, 9 / Math.max(gs, 1))) * boost;

    // Truncate very long labels a bit (helps density)
    const maxChars = gs < 1 ? 10 : 16;
    let label = id;
    if (label.length > maxChars) label = `${label.slice(0, maxChars - 1)}…`;

    ctx.font = `500 ${fontSize}px "Noto Sans KR", sans-serif`;

    // Default: try to place in the center
    let lx = x;
    let ly = y;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // If the text can't fit inside the node, place it just above the node (still no box)
    const textW = ctx.measureText(label).width;
    const fitsInside = textW <= r * 1.55;
    if (!fitsInside) {
      lx = x;
      ly = y - r - 2;
      ctx.textBaseline = 'bottom';
    }

    // NO strokeText / NO rectangles.
    // Use a subtle white glow (shadow) to stay readable over edges without "box" artifacts.
    ctx.save();
    ctx.fillStyle = '#111';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText(label, lx, ly);
    ctx.restore();
  };

  const graphData = React.useMemo(() => ({
    nodes: (net?.nodes || []).map((n) => ({ ...n })),
    links: (net?.edges || []).map((e) => ({ source: e.source, target: e.target, value: e.weight })),
  }), [net]);

  const maxNodeSize = React.useMemo(
    () => Math.max(1, ...graphData.nodes.map((n) => Number(n.size || 1))),
    [graphData] );

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

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mt: 1 }}>
              <Typography variant='caption' color='text.secondary' sx={{ minWidth: 120 }}>노드 클릭 동작</Typography>
              <FormControl size='small' sx={{ minWidth: 240 }}>
                <Select value={navMode} onChange={(e) => setNavMode(e.target.value)}>
                  <MenuItem value='select'>선택만</MenuItem>                  <MenuItem value='click'>클릭 시 관련보고서 이동</MenuItem>
                </Select>
              </FormControl>
              <Typography variant='caption' color='text.secondary'>줌을 확대하면 라벨이 더 많이 표시됩니다. (색상: 기본 노드=회색, 선택 노드=빨강 + Halo)</Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 1 }}>
              <Autocomplete
                freeSolo
                options={keywordOptions}
                inputValue={keywordInput}
                onInputChange={(_, v) => {
                  setKeywordInput(v);
                  if (keywordError) setKeywordError('');
                }}
                onChange={(_, v) => {
                  const kw = String(v || '').trim();
                  setKeywordInput(kw);
                  if (kw) runKeywordSearch(kw);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='키워드 입력'
                    placeholder='예: 발전방향'
                    size='small'
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') runKeywordSearch(keywordInput);
                    }}
                  />
                )}
                sx={{ minWidth: { xs: '100%', sm: 320 } }}
              />
              <Button size='small' variant='contained' onClick={() => runKeywordSearch(keywordInput)}>
                보기
              </Button>
              {keywordError ? (
                <Typography variant='caption' color='error.main' sx={{ display: 'block' }}>
                  {keywordError}
                </Typography>
              ) : null}
            </Stack>

            <Box sx={{ height: 520, mt: 1, borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default' }}>
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeCanvasObjectMode={() => 'replace'}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const id = node.id;
                  const s = Number(node.size || 1);
                  const baseR = 4 + Math.sqrt(s) * 2.2;
                  const isSelected = id === selected;
                  const isFocus = !selected || selectedSet.has(id);
                  const r = isSelected ? baseR * 1.35 : baseR;
                  const x = node.x || 0;
                  const y = node.y || 0;

                  // Dim non-focused nodes
                  ctx.save();
                  ctx.globalAlpha = isFocus ? 1 : 0.08;

                  // Node circle
                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, 2 * Math.PI, false);
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fill();
                  ctx.lineWidth = isSelected ? 1.2 : 0.7;
                  ctx.strokeStyle = '#9E9E9E';
                  ctx.stroke();                  // Labels: keep readable even when non-focused nodes are dimmed
                  const _prevAlpha = ctx.globalAlpha;
                  ctx.globalAlpha = isFocus ? 1 : 0.35;
                  paintNodeLabel({ ...node, _boost: isSelected }, ctx, globalScale);
                  ctx.globalAlpha = _prevAlpha;
                  ctx.restore();
                }}
                nodeColor={() => '#FFFFFF'}
                linkColor={(l) => `rgba(0,0,0,${linkAlpha(l)})`}
                nodeRelSize={4}
                nodeVal={(n) => n.size || 1}
                linkWidth={(l) => {
                  const base = Math.max(0.6, Math.log(1 + (l.value || 1)) * 0.6);
                  if (!selected) return base;
                  const a = typeof l.source === 'object' ? l.source.id : l.source;
                  const b = typeof l.target === 'object' ? l.target.id : l.target;
                  const isFocus = a === selected || b === selected;
                  return isFocus ? base * 1.8 : base * 0.7;
                }}
                enableNodeDrag={false}
                cooldownTime={1200}
                d3AlphaDecay={0.06}
                onNodeHover={(n) => {
                  const id = n ? n.id : null;
                  setHover((prev) => (prev === id ? prev : id));
                }}
                onNodeClick={(n, evt) => {
                  const id = n?.id;
                  if (!id) return;
                  setSelected(id);
                  const isLoggedIn = !!user;
                  if (!isLoggedIn) return;
                  if (navMode === 'click') {
                    navigate(relatedUrlForKeyword(id));
                    return;
                  }
                  if (navMode === 'dblclick') {
                    const clicks = evt?.detail || 1;
                    if (clicks >= 2) navigate(relatedUrlForKeyword(id));
                  }
                }}
              />
            </Box>

            <Stack direction='row' spacing={1} alignItems='center' sx={{ mt: 1 }}>
              <Typography variant='caption' color='text.secondary' sx={{ flexGrow: 1 }}>
                Hover: {hover || '-'} · Click: {selected || '-'}
              </Typography>
              {selected && user ? (
                <Button size='small' variant='outlined' onClick={() => navigate(relatedUrlForKeyword(selected))}>
                  관련 보고서 바로가기
                </Button> ) : null}
            </Stack>
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
                </Box> ) : (
                <Typography variant='body2' color='text.secondary'>로딩 중…</Typography> ) ) : (
              <Typography variant='body2' color='text.secondary'>왼쪽 그래프에서 노드를 클릭하세요.</Typography> )}
          </Paper>

          <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 800, mb: 1 }}>
              관련 보고서 (로그인 필요)
            </Typography>
            {!selected ? (
              <Typography variant='body2' color='text.secondary'>키워드를 선택하면 관련 보고서를 보여줍니다.</Typography> ) : !user ? (
              <Stack spacing={1}>
                <Typography variant='body2' color='text.secondary'>관련 보고서 목록은 로그인 후 열람할 수 있습니다.</Typography>
                <Button variant='contained' href='/login'>로그인</Button>
              </Stack> ) : (
              <Box>
                {related?.items?.length ? (
                  <Box>
                    {related.items.slice(0, 10).map((r) => (
                      <Box key={r.id} sx={{ mb: 1 }}>
                        {r.url ? (
                          <a href={r.url} target='_blank' rel='noreferrer' style={{ textDecoration: 'none' }}>
                            <Typography variant='body2' sx={{ fontWeight: 700 }}>{r.title}</Typography>
                          </a> ) : (
                          <Typography variant='body2' sx={{ fontWeight: 700 }}>{r.title}</Typography> )}
                        <Typography variant='caption' color='text.secondary'>{r.year} · {r.institute}</Typography>
                        <Divider sx={{ mt: 1 }} />
                      </Box> ))}
                    <Button size='small' onClick={() => navigate(relatedUrlForKeyword(selected))} sx={{ mt: 1 }}>전체 보기</Button>
                  </Box> ) : (
                  <Typography variant='body2' color='text.secondary'>해당 키워드로 매칭되는 보고서가 없습니다.</Typography> )}
              </Box> )}
          </Paper>
        </Grid>
      </Grid>
    </Box> );
}
