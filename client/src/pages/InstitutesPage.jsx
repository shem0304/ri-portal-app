import React from 'react';
import {
  Box, Card, CardContent, Grid, Link, MenuItem, Select, TextField, Typography, Button, Stack, Divider
} from '@mui/material';
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
  if (payload && Array.isArray(payload.nst)) return payload.nst; // legacy fallback
  return [];
}


function breakTitleByLength(title, maxLen = 50) {
  if (!title) return '';
  const t = String(title).trim();
  if (t.length <= maxLen) return t;

  // Prefer breaking at a space near maxLen for nicer wrapping
  const left = t.lastIndexOf(' ', maxLen);
  const right = t.indexOf(' ', maxLen + 1);
  const cut =
    left >= Math.floor(maxLen * 0.6)
      ? left
      : (right !== -1 && right <= maxLen + 12 ? right : maxLen);

  return t.slice(0, cut).trimEnd() + '\n' + t.slice(cut).trimStart();
}


function InstituteCard({ name, region, group, url, scope }) {
  // Avoid duplicated labels like "정부출연 정부출연".
  // For national institutes, show NRC/NCT (group) instead of repeating the same word twice.
  const scopeLabel = scope === 'local' ? '지자체' : scope === 'national' ? '정부출연' : '';
  const leftLabel = scope === 'national' ? (group || '') : (region || '전체');
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        p: 2,
        height: 160,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {url ? (
          <Link href={url} target="_blank" rel="noreferrer" underline="hover">
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minHeight: 44,
              }}
            >
              {name}
            </Typography>
          </Link>
        ) : (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minHeight: 44,
            }}
          >
            {name}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, color: 'text.secondary', fontSize: 14 }}>
        {leftLabel ? <span>{leftLabel}</span> : null}
        {scopeLabel ? <span>{scopeLabel}</span> : null}
      </Box>
    </Card>
  );
}

export default function InstitutesPage() {
  const [query, setQuery] = React.useState('');
  const [scope, setScope] = React.useState('all'); // all | local | national
  const [region, setRegion] = React.useState('전체');
  const [local, setLocal] = React.useState([]);
  const [national, setNational] = React.useState([]);
  const [press, setPress] = React.useState([]);
  const [pressNote, setPressNote] = React.useState('');
  const PRESS_MORE_URL = 'https://www.korea.kr/briefing/pressReleaseList.do';
  const POLICY_MORE_URL = 'https://www.korea.kr/news/policyNewsList.do';
  const [policyNews, setPolicyNews] = React.useState([]);
  const [policyNote, setPolicyNote] = React.useState('');

    const [nationalGroup, setNationalGroup] = React.useState('전체'); // 전체 | NRC | NCT
  React.useEffect(() => {
  (async () => {
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
    } catch (e) {
      // Keep page usable even if external news fetch fails
      console.error(e);
    }
  })();
}, []);
React.useEffect(() => {
  if (scope !== 'national' && scope !== 'all') return;

  (async () => {
    const endpoint =
      scope === 'all'
        ? '/api/institutes/national'
        : (nationalGroup === 'NRC'
            ? '/api/institutes/national/nrc'
            : nationalGroup === 'NCT'
              ? '/api/institutes/national/nct'
              : '/api/institutes/national');

    const data = await apiFetch(endpoint);
    const items = normalizeItems(data);
    // Some endpoints return items without explicit group info.
    // When user selected NRC/NCT, stamp the group so the card can show it.
    const stamped = (nationalGroup === 'NRC' || nationalGroup === 'NCT')
      ? items.map((it) => ({ ...it, group: it.group || it.category || it.type || nationalGroup }))
      : items;
    setNational(stamped);
  })();
}, [scope, nationalGroup]);

React.useEffect(() => {
  if (scope !== 'national') setNationalGroup('전체');
}, [scope]);

React.useEffect(() => {
  // leaving national scope -> reset second combo
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
      // national has group + desc
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


    return merged.filter(it => {
      if (region !== '전체' && it.scope === 'local' && it.region !== region) return false;
      if (q) {
        const hay = `${it.name} ${it.region || ''} ${it.homepage || it.url || ''}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [merged, query, region]);

  const localFiltered = React.useMemo(
    () => filtered.filter((it) => it.scope === 'local'),
    [filtered]
  );
  const nationalFiltered = React.useMemo(
    () => filtered.filter((it) => it.scope === 'national'),
    [filtered]
  );


  return (
    <Box>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant='h6' sx={{ fontWeight: 800 }}>기관</Typography>
          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>

<Grid container spacing={2} sx={{ mb: 2 }}>
  <Grid item xs={12} md={6}>
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>최신 정부 보도자료</Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => window.open(PRESS_MORE_URL, '_blank', 'noopener,noreferrer')}
          >
            더보기
          </Button>
        </Stack>

        <Stack spacing={1}>
          {press.slice(0, 10).map((it, i) => (
            <Card
              key={i}
              variant="outlined"
              sx={{ borderRadius: 3, cursor: 'pointer' }}
              onClick={() => it.link && window.open(it.link, '_blank', 'noopener,noreferrer')}
            >
              <CardContent sx={{ py: 1.5 }}>
                <Typography sx={{ fontWeight: 700, whiteSpace: 'pre-line', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {breakTitleByLength(it.title, 50)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {press.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            데이터를 불러오지 못했습니다. (서버 /api/press/latest 확인)
          </Typography>
        ) : null}
        {pressNote ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {pressNote}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={12} md={6}>
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>최신 정책뉴스</Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => window.open(POLICY_MORE_URL, '_blank', 'noopener,noreferrer')}
          >
            더보기
          </Button>
        </Stack>

        <Stack spacing={1}>
          {policyNews.slice(0, 10).map((it, i) => (
            <Card
              key={i}
              variant="outlined"
              sx={{ borderRadius: 3, cursor: 'pointer' }}
              onClick={() => it.link && window.open(it.link, '_blank', 'noopener,noreferrer')}
            >
              <CardContent sx={{ py: 1.5 }}>
                <Typography sx={{ fontWeight: 700, whiteSpace: 'pre-line', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {breakTitleByLength(it.title, 50)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {policyNews.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            데이터를 불러오지 못했습니다. (서버 /api/news/policy/latest 확인)
          </Typography>
        ) : null}
        {policyNote ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {policyNote}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  </Grid>
</Grid>


              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='예: 경기, 전남, 연구원 이름…'
                />
                <Select value={scope} onChange={(e) => setScope(e.target.value)} sx={{ minWidth: 160 }}>
                  <MenuItem value='all'>전체</MenuItem>
                  <MenuItem value='local'>지자체</MenuItem>
                  <MenuItem value='national'>정부출연</MenuItem>
                </Select>
                {scope === 'national' ? (
                  <Select value={nationalGroup} onChange={(e) => setNationalGroup(e.target.value)} sx={{ minWidth: 160 }}>
                    <MenuItem value='전체'>전체</MenuItem>
                    <MenuItem value='NRC'>NRC</MenuItem>
                    <MenuItem value='NCT'>NCT</MenuItem>
                  </Select>
                ) : (
                  <Select value={region} onChange={(e) => setRegion(e.target.value)} sx={{ minWidth: 160 }}>
                    {regions.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                )}
              </Stack>

              {/* 지역 퀵필터(전체, 서울, 경기...) 버튼은 제거 (요청사항) */}

              <Typography variant='caption' color='text.secondary'>기관 데이터는 local_institutes.json(지자체), national_institutes.json(정부출연)에서 로딩합니다.</Typography>
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>현재 {filtered.length}개</Typography>

              {/* 초기 진입(전체)에서는 지자체 → 정부출연 순서로 노출 */}
              {scope === 'all' ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
                    지자체 연구기관
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                      columnGap: 3,
                      rowGap: 7,
                      py: 2,
                    }}
                  >
                    {localFiltered.map((it) => (
                      <InstituteCard key={`local-${it.name}`} {...it} />
                    ))}
                    {localFiltered.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        지자체 연구기관 데이터가 없습니다.
                      </Typography>
                    ) : null}
                  </Box>

                  <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 3, mb: 1 }}>
                    정부출연기관
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                      columnGap: 3,
                      rowGap: 7,
                      py: 2,
                    }}
                  >
                    {nationalFiltered.map((it) => (
                      <InstituteCard key={`national-${it.name}`} {...it} />
                    ))}
                    {nationalFiltered.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        정부출연기관 데이터가 없습니다.
                      </Typography>
                    ) : null}
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    columnGap: 3,
                    rowGap: 7,
                    mt: 2,
                    py: 2,
                  }}
                >
                  {(scope === 'local' ? localFiltered : nationalFiltered).map((it) => (
                    <InstituteCard key={`${it.scope}-${it.name}`} {...it} />
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}