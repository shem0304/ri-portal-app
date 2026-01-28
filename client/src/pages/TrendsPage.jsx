import React from 'react';
import {
  Outlet,
  useLocation,
  useNavigate } from 'react-router-dom'; import {   Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { apiFetch } from '../api';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const tabs = [
  { label: '개요', to: '/trends' },
  { label: '키워드', to: '/trends/keywords' },
  { label: '주제·분포', to: '/trends/topics' },
  { label: '연도별 추이', to: '/trends/timeseries' },
  { label: '급상승·버스트', to: '/trends/rising' },
  { label: '워드클라우드', to: '/trends/wordcloud' },
  { label: '동시출연 네트워크', to: '/trends/network' },
  { label: '기관별 프로파일', to: '/trends/heatmap' },
  { label: '관련 보고서', to: '/trends/related' },
];

function matchTab(pathname) {
  const idx = tabs.findIndex(t => t.to === pathname);
  if (idx >= 0) return idx;
  const hit = tabs.findIndex(t => pathname.startsWith(t.to) && t.to !== '/trends');
  return hit >= 0 ? hit : 0;
}

function readParam(params, key) {
  const v = params.get(key);
  return v === null ? '' : v;
}

export default function TrendsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabIndex = matchTab(location.pathname);

// Stopwords updates (admin can change stopwords while users are connected)
const [stopwordsVersion, setStopwordsVersion] = React.useState('0');

React.useEffect(() => {
  let es = null;
  let timer = null;

  const startPolling = () => {
    const poll = async () => {
      try {
        const v = await apiFetch('/api/stopwords/version');
        if (v?.version) setStopwordsVersion(String(v.version));
      } catch {
        // ignore
      }
    };
    poll();
    timer = setInterval(poll, 30000);
  };

  try {
    es = new EventSource(`${API_BASE}/api/stopwords/stream`);
    es.onmessage = (e) => {
      try {
        const j = JSON.parse(e.data);
        if (j?.version) setStopwordsVersion(String(j.version));
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      try { es?.close(); } catch { /* ignore */ }
      es = null;
      if (!timer) startPolling();
    };
  } catch {
    startPolling();
  }

  return () => {
    try { es?.close(); } catch { /* ignore */ }
    if (timer) clearInterval(timer);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);

  const scope = React.useMemo(() => {
    const s = readParam(params, 'scope') || 'all';
    return (s === 'local' || s === 'national' || s === 'all') ? s : 'all';
  }, [params]);

  const institute = React.useMemo(() => readParam(params, 'institute'), [params]);
  const year = React.useMemo(() => readParam(params, 'year'), [params]);
  const q = React.useMemo(() => readParam(params, 'q'), [params]);

  const [qInput, setQInput] = React.useState(q);
  React.useEffect(() => setQInput(q), [q]);

  const [instOptions, setInstOptions] = React.useState([]);
  const [yearOptions, setYearOptions] = React.useState([]);

  const setSearchParams = React.useCallback((next) => {
    const p = new URLSearchParams(location.search);
    Object.entries(next).forEach(([k, v]) => {
      const s = String(v ?? '').trim();
      if (!s) p.delete(k);
      else p.set(k, s);
    });
    // Always keep scope explicit so tabs share the same filter context.
    if (!p.get('scope')) p.set('scope', 'all');
    const search = p.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // Keep option lists in sync with the selected scope.
  React.useEffect(() => {
    (async () => {
      try {
        if ((scope || 'all') === 'national') {
          setInstOptions(['NRC', 'NCT']);
        } else {
          const qs = new URLSearchParams();
          qs.set('top', '1');
          qs.set('scope', scope || 'all');
          const s = await apiFetch(`/api/trends/summary?${qs.toString()}`);
          setInstOptions((s.reportsPerInstitute || []).map(d => d.institute));
        }

        const qs2 = new URLSearchParams();
        qs2.set('top', '1');
        qs2.set('scope', scope || 'all');
        const s2 = await apiFetch(`/api/trends/summary?${qs2.toString()}`);
        const ys = (s2.reportsPerYear || [])
          .filter(d => (d?.count || 0) > 0)
          .map(d => d.year);
        setYearOptions(ys.slice().sort((a, b) => b - a));
      } catch {
        setInstOptions([]);
        setYearOptions([]);
      }
    })();
  }, [scope]);

  const applyScope = (nextScope) => {
    // Scope change resets other filters to avoid confusing empty outputs.
    setQInput('');
    setSearchParams({ scope: nextScope, institute: '', year: '', q: '' });
  };

  const applyInstitute = (nextInstitute) => {
    setSearchParams({ institute: nextInstitute });
  };

  const applyYear = (nextYear) => {
    setSearchParams({ year: nextYear });
  };

  const applyQuery = () => {
    setSearchParams({ q: qInput });
  };

  const filters = React.useMemo(() => ({
    scope: scope || 'all',
    institute: institute || '',
    year: year || '',
    q: q || '',
  }), [scope, institute, year, q]);

  return (
    <Box>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ position: 'relative', overflowX: 'hidden' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{ mb: 1, position: 'relative', zIndex: 20 }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant='h5' sx={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>연구 트렌드</Typography>
            </Box>

            {/* Common filters (same as Reports screen) */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
              <Select
                value={scope}
                onChange={(e) => applyScope(e.target.value)}
                size='small'
                sx={{ minWidth: 200 }}
                MenuProps={{ PaperProps: { sx: { zIndex: 3000 } } }}
              >
                <MenuItem value='all'>전체</MenuItem>
                <MenuItem value='local'>지자체연구기관</MenuItem>
                <MenuItem value='national'>정부출연연구기관</MenuItem>
              </Select>

              <Select
                value={institute}
                onChange={(e) => applyInstitute(e.target.value)}
                size='small'
                displayEmpty
                sx={{ minWidth: 220 }}
                MenuProps={{ PaperProps: { sx: { zIndex: 3000 } } }}
              >
                <MenuItem value=''>기관 전체</MenuItem>
                {instOptions.slice(0, 250).map((i) => (
                  <MenuItem key={i} value={i}>{i}</MenuItem>
                ))}
              </Select>

              <Select
                value={year}
                onChange={(e) => applyYear(e.target.value)}
                size='small'
                displayEmpty
                sx={{ minWidth: 140 }}
                MenuProps={{ PaperProps: { sx: { zIndex: 3000 } } }}
              >
                <MenuItem value=''>연도 전체</MenuItem>
                {yearOptions.map((y) => (
                  <MenuItem key={y} value={String(y)}>{y}</MenuItem>
                ))}
              </Select>

              <TextField
                size='small'
                placeholder='검색어(키워드/제목)'
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyQuery(); }}
                sx={{ minWidth: 260 }}
              />

              <Button
                variant='contained'
                size='small'
                endIcon={<OpenInNewIcon />}
                onClick={applyQuery}
              >
                적용
              </Button>
            </Stack>
          </Stack>

{/* 섹션 선택(탭 대체) */}
<Stack
  direction={{ xs: 'column', sm: 'row' }}
  spacing={1}
  alignItems={{ xs: 'stretch', sm: 'center' }}
  sx={{ mt: 1, position: 'relative', zIndex: 10 }}
>
  <Select
    value={tabs[tabIndex].to}
    onChange={(e) => navigate({ pathname: e.target.value, search: location.search })}
    size="small"
    sx={{ minWidth: { xs: '100%', sm: 260 } }}
    MenuProps={{ PaperProps: { sx: { zIndex: 3000 } } }}
  >
    {tabs.map((t) => (
      <MenuItem key={t.to} value={t.to}>
        {t.label}
      </MenuItem>
    ))}
  </Select>

  <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: 'space-between', sm: 'flex-start' } }}>
    <Button
      variant="outlined"
      size="small"
      disabled={tabIndex <= 0}
      onClick={() => {
        const prev = Math.max(0, tabIndex - 1);
        navigate({ pathname: tabs[prev].to, search: location.search });
      }}
    >
      이전
    </Button>
    <Button
      variant="outlined"
      size="small"
      disabled={tabIndex >= tabs.length - 1}
      onClick={() => {
        const next = Math.min(tabs.length - 1, tabIndex + 1);
        navigate({ pathname: tabs[next].to, search: location.search });
      }}
    >
      다음
    </Button>
  </Stack>
</Stack>


          <Box sx={{ mt: 2 }}>
            <Outlet key={stopwordsVersion} context={{ trendFilters: filters }} />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
