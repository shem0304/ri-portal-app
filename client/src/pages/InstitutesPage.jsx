import React from 'react';
import {
  Box, Card, CardContent, Grid, Link, MenuItem, Select, TextField, Typography, Button, Stack, Divider, LinearProgress, Chip, Fade, Container
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { apiFetch } from '../api';

// Accept common API shapes:
// - Plain array: [...]
// - Object with items: { items: [...] }
// - Buckets: { nrc: [...], nct: [...] }
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

function InstituteCard({ name, region, group, url, scope }) {
  const scopeLabel = scope === 'local' ? '지자체' : scope === 'national' ? '정부출연' : '';
  const g = group ? String(group).trim() : '';
  const normGroup = g ? (g.toUpperCase() === 'NRC' ? 'NRC' : g.toUpperCase() === 'NCT' ? 'NCT' : g) : '';
  const leftLabel = scope === 'national' ? (normGroup || '') : (region || '전체');
  
  return (
    <Fade in timeout={300}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 4,
          height: 180,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
          border: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(145deg, #ffffff 0%, #fafafa 100%)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            borderColor: 'primary.main',
          },
        }}
      >
        <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 상단 메타 정보 */}
          <Stack direction="row" spacing={1} alignItems="center">
            {scope === 'local' ? (
              <Chip
                icon={<LocationOnIcon sx={{ fontSize: 16 }} />}
                label={leftLabel}
                size="small"
                sx={{ 
                  height: 24,
                  backgroundColor: '#e3f2fd',
                  color: '#1976d2',
                  fontWeight: 600
                }}
              />
            ) : (
              <Chip
                icon={<BusinessIcon sx={{ fontSize: 16 }} />}
                label={leftLabel}
                size="small"
                sx={{ 
                  height: 24,
                  backgroundColor: '#f3e5f5',
                  color: '#7b1fa2',
                  fontWeight: 600
                }}
              />
            )}
            <Chip
              label={scopeLabel}
              size="small"
              variant="outlined"
              sx={{ height: 24, fontWeight: 500 }}
            />
          </Stack>

          {/* 기관명 */}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
            {url ? (
              <Link
                href={url}
                target="_blank"
                rel="noreferrer"
                underline="none"
                sx={{
                  color: 'text.primary',
                  '&:hover': { color: 'primary.main' },
                  transition: 'color 0.2s',
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}
                </Typography>
              </Link>
            ) : (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {name}
              </Typography>
            )}
          </Box>

          {/* 하단 링크 아이콘 */}
          {url && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <OpenInNewIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </Box>
          )}
        </CardContent>
      </Card>
    </Fade>
  );
}

function NewsCard({ title, link, index }) {
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
      onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
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
}

export default function InstitutesPage() {
  const [query, setQuery] = React.useState('');
  const [scope, setScope] = React.useState('all');
  const [region, setRegion] = React.useState('전체');
  const [local, setLocal] = React.useState([]);
  const [localLoading, setLocalLoading] = React.useState(true);
  const [national, setNational] = React.useState([]);
  const [nationalLoading, setNationalLoading] = React.useState(true);
  const [press, setPress] = React.useState([]);
  const [pressLoading, setPressLoading] = React.useState(true);
  const [pressNote, setPressNote] = React.useState('');
  const PRESS_MORE_URL = 'https://www.korea.kr/briefing/pressReleaseList.do';
  const POLICY_MORE_URL = 'https://www.korea.kr/news/policyNewsList.do';
  const [policyNews, setPolicyNews] = React.useState([]);
  const [policyLoading, setPolicyLoading] = React.useState(true);
  const [policyNote, setPolicyNote] = React.useState('');
  const [nationalGroup, setNationalGroup] = React.useState('전체');

  React.useEffect(() => {
    (async () => {
      setLocalLoading(true);
      setPressLoading(true);
      setPolicyLoading(true);
      try {
        const [l, p, n] = await Promise.all([
          apiFetch('/api/institutes/local'),
          apiFetch('/api/press/latest?limit=10', { cache: 'no-store' }),
          apiFetch('/api/news/policy/latest?limit=10', { cache: 'no-store' }),
        ]);
        setLocal(normalizeItems(l));
        setPress(normalizeItems(p));
        setPressNote((p && p.note) || '');
        setPolicyNews(normalizeItems(n));
        setPolicyNote((n && n.note) || '');
        setLocalLoading(false);
        setPressLoading(false);
        setPolicyLoading(false);
      } catch (e) {
        console.error(e);
        setLocalLoading(false);
        setPressLoading(false);
        setPolicyLoading(false);
      }
    })();
  }, []);

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
        setNationalLoading(false);
      } catch (e) {
        console.error(e);
        setNational([]);
        setNationalLoading(false);
      }
    })();
  }, [scope, nationalGroup]);

  React.useEffect(() => {
    if (scope !== 'national') setNationalGroup('전체');
  }, [scope]);

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

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [merged, query, region, scope]);

  const localFiltered = filtered.filter(i => i.scope === 'local');
  const nationalFiltered = filtered.filter(i => i.scope === 'national');

  return (
    <Box sx={{ backgroundColor: '#f8f9fa', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        {/* 상단 뉴스 섹션 */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* 보도자료 */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                borderRadius: 4,
                height: '100%',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
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
                      <NewsCard key={i} title={it.title} link={it.link} index={i} />
                    ))
                  )}
                </Stack>

                {press.length === 0 && !pressLoading ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                    데이터를 불러오지 못했습니다.
                  </Typography>
                ) : null}
                {pressNote ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    {pressNote}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          </Grid>

          {/* 정책뉴스 */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                borderRadius: 4,
                height: '100%',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'secondary.main' }}>
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
                      <NewsCard key={i} title={it.title} link={it.link} index={i} />
                    ))
                  )}
                </Stack>

                {policyNews.length === 0 && !policyLoading ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                    데이터를 불러오지 못했습니다.
                  </Typography>
                ) : null}
                {policyNote ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    {policyNote}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 메인 연구기관 섹션 */}
        <Card
          sx={{
            borderRadius: 4,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* 타이틀 */}
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, color: 'text.primary' }}>
              🏢 연구기관 검색
            </Typography>

            {/* 검색 및 필터 */}
            <Stack spacing={2} sx={{ mb: 4 }}>
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

            <Divider sx={{ mb: 4 }} />

            {/* 연구기관 목록 */}
            {scope === 'all' ? (
              <Box>
                {/* 지자체 */}
                <Box sx={{ mb: 5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: 'primary.main' }}>
                    지자체 연구기관
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: 3,
                    }}
                  >
                    {localLoading ? (
                      <Box sx={{ gridColumn: '1 / -1', py: 4, textAlign: 'center' }}>
                        <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          지자체 연구기관 데이터를 불러오는 중…
                        </Typography>
                      </Box>
                    ) : localFiltered.length > 0 ? (
                      localFiltered.map((it) => (
                        <InstituteCard
                          key={`local-${it.name}`}
                          name={it.name}
                          region={it.region}
                          url={it.homepage || it.url}
                          scope="local"
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                        지자체 연구기관 데이터가 없습니다.
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* 정부출연 */}
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: 'secondary.main' }}>
                    정부출연기관
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: 3,
                    }}
                  >
                    {nationalLoading ? (
                      <Box sx={{ gridColumn: '1 / -1', py: 4, textAlign: 'center' }}>
                        <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          정부출연기관 데이터를 불러오는 중…
                        </Typography>
                      </Box>
                    ) : nationalFiltered.length > 0 ? (
                      nationalFiltered.map((it) => (
                        <InstituteCard
                          key={`national-${it.name}`}
                          name={it.name}
                          group={it.group || it.category || it.type}
                          url={it.homepage || it.url}
                          scope="national"
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                        정부출연기관 데이터가 없습니다.
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 3,
                }}
              >
                {scope === 'local' && localLoading ? (
                  <Box sx={{ gridColumn: '1 / -1', py: 4, textAlign: 'center' }}>
                    <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      지자체 연구기관 데이터를 불러오는 중…
                    </Typography>
                  </Box>
                ) : null}

                {scope === 'national' && nationalLoading ? (
                  <Box sx={{ gridColumn: '1 / -1', py: 4, textAlign: 'center' }}>
                    <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      정부출연기관 데이터를 불러오는 중…
                    </Typography>
                  </Box>
                ) : null}

                {scope === 'local' && !localLoading
                  ? localFiltered.map((it) => (
                      <InstituteCard
                        key={`local-${it.name}`}
                        name={it.name}
                        region={it.region}
                        url={it.homepage || it.url}
                        scope="local"
                      />
                    ))
                  : null}

                {scope === 'national' && !nationalLoading
                  ? nationalFiltered.map((it) => (
                      <InstituteCard
                        key={`national-${it.name}`}
                        name={it.name}
                        group={it.group || it.category || it.type}
                        url={it.homepage || it.url}
                        scope="national"
                      />
                    ))
                  : null}

                {scope === 'local' && !localLoading && localFiltered.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                    검색 결과가 없습니다.
                  </Typography>
                ) : null}

                {scope === 'national' && !nationalLoading && nationalFiltered.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                    검색 결과가 없습니다.
                  </Typography>
                ) : null}
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
