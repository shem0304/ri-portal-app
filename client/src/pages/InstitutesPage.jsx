import React from 'react';
import {
  Box, Card, CardContent, Grid, Link, MenuItem, Select, TextField, Typography, Button, Stack, Divider, LinearProgress, Chip, Fade, Container
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FilterListIcon from '@mui/icons-material/FilterList';
import { apiFetch } from '../api';
import { EnhancedInstituteCard } from '../components/EnhancedCards';

// ============================================
// 🚀 성능 최적화 유틸리티
// ============================================

// 디바운스 훅 - 검색어 입력 성능 개선 (300ms 지연)
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// 뉴스 캐시 관리 - localStorage 활용 (5분간 캐싱)
const CACHE_DURATION = 5 * 60 * 1000; // 5분

function getCachedData(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // 캐시 실패는 무시 (용량 초과 등)
  }
}

// ============================================
// 데이터 정규화 함수
// ============================================

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.nrc)) return payload.nrc;
  if (payload && Array.isArray(payload.nct)) return payload.nct;
  if (payload && Array.isArray(payload.nst)) return payload.nst;
  return [];
}

function breakTitleByLength(title, maxLen = 50) {
  if (!title) return '';
  const t = String(title).trim();
  if (t.length <= maxLen) return t;

  const left = t.lastIndexOf(' ', maxLen);
  const right = t.indexOf(' ', maxLen + 1);
  const cut =
    left >= Math.floor(maxLen * 0.6)
      ? left
      : (right !== -1 && right <= maxLen + 12 ? right : maxLen);

  return t.slice(0, cut).trimEnd() + '\n' + t.slice(cut).trimStart();
}

// ============================================
// 🎯 최적화된 컴포넌트
// ============================================

// React.memo로 불필요한 리렌더링 방지
const NewsCard = React.memo(({ title, link, index }) => {
  // useCallback으로 onClick 함수 메모이제이션
  const handleClick = React.useCallback(() => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  }, [link]);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderLeft: '3px solid transparent',
        '&:hover': {
          borderLeftColor: 'primary.main',
          backgroundColor: 'action.hover',
          transform: 'translateX(4px)',
        },
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ py: 2, px: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Typography
            variant="caption"
            sx={{
              minWidth: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'primary.main',
              color: 'white',
              borderRadius: 1,
              fontWeight: 700,
            }}
          >
            {index + 1}
          </Typography>
          <Typography
            sx={{
              fontWeight: 600,
              flex: 1,
              whiteSpace: 'pre-line',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {breakTitleByLength(title, 50)}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
});

NewsCard.displayName = 'NewsCard';

const InstituteCard = EnhancedInstituteCard;

// ============================================
// 📄 메인 페이지 컴포넌트
// ============================================

export default function InstitutesPage() {
  const [query, setQuery] = React.useState('');
  const [scope, setScope] = React.useState('all');
  const [region, setRegion] = React.useState('전체');
  const [local, setLocal] = React.useState([]);
  const [localLoading, setLocalLoading] = React.useState(true);
  const [national, setNational] = React.useState([]);
  const [nationalLoading, setNationalLoading] = React.useState(true);
  const [press, setPress] = React.useState([]);
  const [pressLoading, setPressLoading] = React.useState(false);
  const [pressNote, setPressNote] = React.useState('');
  const PRESS_MORE_URL = 'https://www.korea.kr/briefing/pressReleaseList.do';
  const POLICY_MORE_URL = 'https://www.korea.kr/news/policyNewsList.do';
  const [policyNews, setPolicyNews] = React.useState([]);
  const [policyLoading, setPolicyLoading] = React.useState(false);
  const [policyNote, setPolicyNote] = React.useState('');
  const [nationalGroup, setNationalGroup] = React.useState('전체');

  // 🚀 디바운스된 검색어 (300ms 지연)
  const debouncedQuery = useDebounce(query, 300);

  // ============================================
  // 📡 데이터 로딩 - 우선순위별 분리
  // ============================================

  // 1️⃣ 최우선: 지자체 기관 데이터 (가장 먼저 로드)
  React.useEffect(() => {
    (async () => {
      setLocalLoading(true);
      try {
        const l = await apiFetch('/api/institutes/local');
        setLocal(normalizeItems(l));
      } catch (e) {
        console.error('지자체 기관 로딩 실패:', e);
      } finally {
        setLocalLoading(false);
      }
    })();
  }, []);

  // 2️⃣ 지연 로딩: 뉴스 데이터 (캐시 우선, 100ms 후)
  React.useEffect(() => {
    const loadNews = async () => {
      // 캐시된 데이터 먼저 표시
      const cachedPress = getCachedData('institutes_press_latest');
      const cachedPolicy = getCachedData('institutes_policy_latest');

      if (cachedPress) {
        setPress(normalizeItems(cachedPress.data));
        setPressNote(cachedPress.note || '');
      }
      if (cachedPolicy) {
        setPolicyNews(normalizeItems(cachedPolicy.data));
        setPolicyNote(cachedPolicy.note || '');
      }

      // 캐시가 있으면 로딩 표시 안 함, 없으면 표시
      setPressLoading(!cachedPress);
      setPolicyLoading(!cachedPolicy);

      try {
        // 백그라운드에서 최신 데이터 가져오기
        const [p, n] = await Promise.all([
          apiFetch('/api/press/latest?limit=10', { cache: 'no-store' }),
          apiFetch('/api/news/policy/latest?limit=10', { cache: 'no-store' }),
        ]);

        setPress(normalizeItems(p));
        setPressNote((p && p.note) || '');
        setPolicyNews(normalizeItems(n));
        setPolicyNote((n && n.note) || '');

        // 캐시에 저장 (5분간 유효)
        setCachedData('institutes_press_latest', { data: p, note: p?.note });
        setCachedData('institutes_policy_latest', { data: n, note: n?.note });
      } catch (e) {
        console.error('뉴스 로딩 실패:', e);
      } finally {
        setPressLoading(false);
        setPolicyLoading(false);
      }
    };

    // 100ms 후에 뉴스 로드 (기관 데이터 우선)
    const timer = setTimeout(loadNews, 100);
    return () => clearTimeout(timer);
  }, []);

  // 3️⃣ 정부출연 기관 로딩 (scope 변경 시)
  React.useEffect(() => {
    if (scope !== 'national' && scope !== 'all') return;

    (async () => {
      setNationalLoading(true);
      const endpoint =
        scope === 'all'
          ? '/api/institutes/national'
          : (nationalGroup === 'NRC'
              ? '/api/institutes/national/nrc'
              : nationalGroup === 'NCT'
                ? '/api/institutes/national/nct'
                : '/api/institutes/national');

      try {
        const data = await apiFetch(endpoint);
        const items = normalizeItems(data);
        const stamped = (nationalGroup === 'NRC' || nationalGroup === 'NCT')
          ? items.map((it) => ({ ...it, group: it.group || it.category || it.type || nationalGroup }))
          : items;
        setNational(stamped);
      } catch (e) {
        console.error('정부출연 기관 로딩 실패:', e);
        setNational([]);
      } finally {
        setNationalLoading(false);
      }
    })();
  }, [scope, nationalGroup]);

  React.useEffect(() => {
    if (scope !== 'national') setNationalGroup('전체');
  }, [scope]);

  // ============================================
  // 🧮 useMemo로 계산 최적화
  // ============================================

  const regions = React.useMemo(() => {
    const set = new Set(local.map(i => i.region).filter(Boolean));
    return ['전체', ...Array.from(set)];
  }, [local]);

  const merged = React.useMemo(() => {
    const all = [];
    if (scope === 'all' || scope === 'local') {
      for (const i of local) all.push({ ...i, scope: 'local' });
    }
    if (scope === 'all' || scope === 'national') {
      for (const i of national) {
        const group = i.group || i.category || i.type || '';
        const region = i.region || '';
        all.push({ ...i, group, region, scope: 'national' });
      }
    }
    return all;
  }, [local, national, scope]);

  // 디바운스된 검색어로 필터링 (타이핑 중엔 계산 안 함)
  const filtered = React.useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let base = merged;
    if (scope === 'local' && region !== '전체') {
      base = base.filter(i => i.region === region);
    }
    if (!q) return base;
    return base.filter(i => {
      const name = (i.name || '').toLowerCase();
      const reg = (i.region || '').toLowerCase();
      const grp = (i.group || '').toLowerCase();
      return name.includes(q) || reg.includes(q) || grp.includes(q);
    });
  }, [merged, debouncedQuery, region, scope]);

  // 필터링 결과를 useMemo로 캐싱
  const localFiltered = React.useMemo(() => 
    filtered.filter(i => i.scope === 'local'),
    [filtered]
  );
  
  const nationalFiltered = React.useMemo(() => 
    filtered.filter(i => i.scope === 'national'),
    [filtered]
  );

  return (
    <Box sx={{ backgroundColor: '#f8f9fa', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        {/* 상단 뉴스 섹션 */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* 보도자료 */}
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 4, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    📰 정부 보도자료
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => window.open(PRESS_MORE_URL, '_blank', 'noopener,noreferrer')}
                    sx={{ borderRadius: 2 }}
                  >
                    더보기
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  {pressLoading ? (
                    <Box sx={{ py: 2 }}>
                      <LinearProgress sx={{ borderRadius: 1 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                        보도자료를 불러오는 중…
                      </Typography>
                    </Box>
                  ) : (
                    press.slice(0, 10).map((it, i) => (
                      <NewsCard key={`press-${i}`} title={it.title} link={it.link} index={i} />
                    ))
                  )}
                </Stack>

                {press.length === 0 && !pressLoading && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                    데이터를 불러오지 못했습니다.
                  </Typography>
                )}
                {pressNote && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    {pressNote}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 정책뉴스 */}
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 4, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    📋 정책뉴스
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => window.open(POLICY_MORE_URL, '_blank', 'noopener,noreferrer')}
                    sx={{ borderRadius: 2 }}
                  >
                    더보기
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  {policyLoading ? (
                    <Box sx={{ py: 2 }}>
                      <LinearProgress sx={{ borderRadius: 1 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                        정책뉴스를 불러오는 중…
                      </Typography>
                    </Box>
                  ) : (
                    policyNews.slice(0, 10).map((it, i) => (
                      <NewsCard key={`policy-${i}`} title={it.title} link={it.link} index={i} />
                    ))
                  )}
                </Stack>

                {policyNews.length === 0 && !policyLoading && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                    데이터를 불러오지 못했습니다.
                  </Typography>
                )}
                {policyNote && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    {policyNote}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 연구기관 검색 */}
        <Card sx={{ borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, color: 'text.primary' }}>
              🏢 연구기관 검색
            </Typography>

            {/* 검색 및 필터 */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <FilterListIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  검색 필터
                </Typography>
              </Stack>
              
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    fullWidth
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="예: 경기, 전남, 연구원 이름…"
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                      },
                    }}
                  />
                  <Select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    sx={{ minWidth: 160, borderRadius: 3 }}
                  >
                    <MenuItem value="all">전체</MenuItem>
                    <MenuItem value="local">지자체</MenuItem>
                    <MenuItem value="national">정부출연</MenuItem>
                  </Select>
                  {scope === 'national' ? (
                    <Select
                      value={nationalGroup}
                      onChange={(e) => setNationalGroup(e.target.value)}
                      sx={{ minWidth: 160, borderRadius: 3 }}
                    >
                      <MenuItem value="전체">전체</MenuItem>
                      <MenuItem value="NRC">NRC</MenuItem>
                      <MenuItem value="NCT">NCT</MenuItem>
                    </Select>
                  ) : (
                    <Select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      sx={{ minWidth: 160, borderRadius: 3 }}
                    >
                      {regions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  )}
                </Stack>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip
                    label={`총 ${filtered.length}개`}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    기관 데이터: local_institutes.json(지자체), national_institutes.json(정부출연)
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Divider sx={{ mb: 4 }} />

            {/* 연구기관 목록 */}
            {scope === 'all' ? (
              <Box>
                {/* 지자체 */}
                <Box sx={{ mb: 5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: 'primary.main' }}>
                    지자체 연구기관
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 380px))', gap: 3, justifyContent: 'center' }}>
                    {localLoading ? (
                      <Box sx={{ gridColumn: '1 / -1', py: 4 }}>
                        <LinearProgress sx={{ borderRadius: 1 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                          지자체 연구기관을 불러오는 중…
                        </Typography>
                      </Box>
                    ) : localFiltered.length === 0 ? (
                      <Typography variant="body1" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                        검색 결과가 없습니다.
                      </Typography>
                    ) : (
                      localFiltered.map((inst) => (
                        <InstituteCard
                          key={inst.name}
                          name={inst.name}
                          region={inst.region}
                          group={inst.group}
                          url={inst.homepage || inst.url}
                          scope={inst.scope}
                        />
                      ))
                    )}
                  </Box>
                </Box>

                {/* 정부출연 */}
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: 'secondary.main' }}>
                    정부출연연구기관
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 380px))', gap: 3, justifyContent: 'center' }}>
                    {nationalLoading ? (
                      <Box sx={{ gridColumn: '1 / -1', py: 4 }}>
                        <LinearProgress sx={{ borderRadius: 1 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                          정부출연연구기관을 불러오는 중…
                        </Typography>
                      </Box>
                    ) : nationalFiltered.length === 0 ? (
                      <Typography variant="body1" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                        검색 결과가 없습니다.
                      </Typography>
                    ) : (
                      nationalFiltered.map((inst) => (
                        <InstituteCard
                          key={inst.name}
                          name={inst.name}
                          region={inst.region}
                          group={inst.group}
                          url={inst.homepage || inst.url}
                          scope={inst.scope}
                        />
                      ))
                    )}
                  </Box>
                </Box>
              </Box>
            ) : scope === 'local' ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 380px))', gap: 3, justifyContent: 'center' }}>
                {localLoading ? (
                  <Box sx={{ gridColumn: '1 / -1', py: 4 }}>
                    <LinearProgress sx={{ borderRadius: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                      지자체 연구기관을 불러오는 중…
                    </Typography>
                  </Box>
                ) : localFiltered.length === 0 ? (
                  <Typography variant="body1" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                    검색 결과가 없습니다.
                  </Typography>
                ) : (
                  localFiltered.map((inst) => (
                    <InstituteCard
                      key={inst.name}
                      name={inst.name}
                      region={inst.region}
                      group={inst.group}
                      url={inst.homepage || inst.url}
                      scope={inst.scope}
                    />
                  ))
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 380px))', gap: 3, justifyContent: 'center' }}>
                {nationalLoading ? (
                  <Box sx={{ gridColumn: '1 / -1', py: 4 }}>
                    <LinearProgress sx={{ borderRadius: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                      정부출연연구기관을 불러오는 중…
                    </Typography>
                  </Box>
                ) : nationalFiltered.length === 0 ? (
                  <Typography variant="body1" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                    검색 결과가 없습니다.
                  </Typography>
                ) : (
                  nationalFiltered.map((inst) => (
                    <InstituteCard
                      key={inst.name}
                      name={inst.name}
                      region={inst.region}
                      group={inst.group}
                      url={inst.homepage || inst.url}
                      scope={inst.scope}
                    />
                  ))
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
