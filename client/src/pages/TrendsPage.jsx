import React from 'react';
import {
  Outlet,
  useLocation,
  useNavigate
} from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Paper,
  Chip,
  Fade
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
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

  // Stopwords updates
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
    if (!p.get('scope')) p.set('scope', 'all');
    const search = p.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

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
      <Fade in timeout={500}>
        <Card 
          sx={{ 
            borderRadius: 4,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* 헤더 */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ mb: 4 }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                }}
              >
                <TrendingUpIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Typography 
                variant='h4' 
                sx={{ 
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                연구 트렌드
              </Typography>
            </Stack>

            {/* 필터 영역 */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                border: '1px solid',
                borderColor: 'divider',
                mb: 3,
              }}
            >
              <Stack spacing={2}>
                {/* 첫 번째 줄: Scope, Institute, Year */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Select
                    value={scope}
                    onChange={(e) => applyScope(e.target.value)}
                    size='small'
                    sx={{
                      flex: 1,
                      minWidth: 200,
                      borderRadius: 2,
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
                      },
                    }}
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
                    sx={{
                      flex: 1,
                      minWidth: 220,
                      borderRadius: 2,
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
                      },
                    }}
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
                    sx={{
                      flex: 1,
                      minWidth: 140,
                      borderRadius: 2,
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
                      },
                    }}
                  >
                    <MenuItem value=''>연도 전체</MenuItem>
                    {yearOptions.map((y) => (
                      <MenuItem key={y} value={String(y)}>{y}</MenuItem>
                    ))}
                  </Select>
                </Stack>

                {/* 두 번째 줄: 검색어 + 적용 버튼 */}
                <Stack direction="row" spacing={2}>
                  <TextField
                    size='small'
                    fullWidth
                    placeholder='검색어(키워드/제목)'
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyQuery(); }}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
                        },
                      }
                    }}
                  />

                  <Button
                    variant='contained'
                    size='small'
                    endIcon={<OpenInNewIcon />}
                    onClick={applyQuery}
                    sx={{
                      minWidth: 100,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                      },
                    }}
                  >
                    적용
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {/* 탭 네비게이션 */}
            <Stack spacing={2} sx={{ mb: 3 }}>
              <Select
                value={tabs[tabIndex].to}
                onChange={(e) => navigate({ pathname: e.target.value, search: location.search })}
                size="small"
                sx={{
                  borderRadius: 2,
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
                  },
                }}
              >
                {tabs.map((t) => (
                  <MenuItem key={t.to} value={t.to}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>

              <Stack direction="row" spacing={2} justifyContent="center">
                <Button
                  variant="outlined"
                  size="small"
                  disabled={tabIndex <= 0}
                  startIcon={<ArrowBackIcon />}
                  onClick={() => {
                    const prev = Math.max(0, tabIndex - 1);
                    navigate({ pathname: tabs[prev].to, search: location.search });
                  }}
                  sx={{
                    borderRadius: 2,
                    minWidth: 100,
                    borderColor: '#667eea',
                    color: '#667eea',
                    '&:hover': {
                      borderColor: '#5568d3',
                      background: 'rgba(102, 126, 234, 0.05)',
                    },
                  }}
                >
                  이전
                </Button>
                
                <Chip 
                  label={`${tabIndex + 1} / ${tabs.length}`}
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                  }}
                />
                
                <Button
                  variant="outlined"
                  size="small"
                  disabled={tabIndex >= tabs.length - 1}
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => {
                    const next = Math.min(tabs.length - 1, tabIndex + 1);
                    navigate({ pathname: tabs[next].to, search: location.search });
                  }}
                  sx={{
                    borderRadius: 2,
                    minWidth: 100,
                    borderColor: '#667eea',
                    color: '#667eea',
                    '&:hover': {
                      borderColor: '#5568d3',
                      background: 'rgba(102, 126, 234, 0.05)',
                    },
                  }}
                >
                  다음
                </Button>
              </Stack>
            </Stack>

            {/* 콘텐츠 */}
            <Box>
              <Outlet key={stopwordsVersion} context={{ trendFilters: filters }} />
            </Box>
          </CardContent>
        </Card>
      </Fade>
    </Box>
  );
}
