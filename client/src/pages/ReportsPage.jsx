import React from 'react';
import {
  Box, Button, Card, CardContent, Divider, MenuItem, Pagination, Select,
  Stack, TextField, Typography, Link
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../api';

function ReportCard({ item }) {
  const year = item?.year ?? '';
  const inst = item?.institute ?? '';
  const scopeLabel = item?.scope === 'local' ? '지자체' : item?.scope === 'national' ? '정부출연' : '';
  const metaParts = [year, inst, scopeLabel].filter(Boolean);

  return (
    <Card
      variant='outlined'
      sx={{
        borderRadius: 3,
        height: 220,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      }}
    >
      <CardContent
        sx={{
          p: 3,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
          '&:last-child': { pb: 3 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {/* 제목: 최대 3줄 */}
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 800,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minHeight: 72,
              mb: 1.5,
            }}
            title={item?.title || ''}
          >
            {item?.title || '-'}
          </Typography>

          {/* 메타 */}
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              mb: item?.authors?.length ? 1 : 0,
            }}
          >
            {metaParts.map((t, idx) => (
              <span key={`${t}-${idx}`}>{t}</span>
            ))}
          </Typography>

          {/* 저자 */}
          {item?.authors?.length ? (
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={`저자: ${item.authors.join(', ')}`}
            >
              저자: {item.authors.join(', ')}
            </Typography>
          ) : null}
        </Box>

        {/* 하단 링크 */}
        {item?.url ? (
          <Link
            href={item.url}
            target='_blank'
            rel='noreferrer'
            underline='hover'
            sx={{
              fontSize: 14,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mt: 2,
            }}
          >
            링크 →
          </Link>
        ) : (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
            링크 없음
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const location = useLocation();
  const [q, setQ] = React.useState('');
  const [scope, setScope] = React.useState('all');
  const [year, setYear] = React.useState('');
  const [institute, setInstitute] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [meta, setMeta] = React.useState({ total: 0, limit: 20, offset: 0 });
  const [items, setItems] = React.useState([]);
  const [instOptions, setInstOptions] = React.useState([]);
  const [yearOptions, setYearOptions] = React.useState([]);
  const page = Math.floor(meta.offset / meta.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  // Hydrate filters from URL query params (e.g., /reports?q=<researcher name>)
  // so deep links from the Researcher page automatically run.
  const hydratedFromUrlRef = React.useRef(false);

  // Keep filter option lists in sync with the selected scope.
  // - all: local + national
  // - local: local only
  // - national: national only
  React.useEffect(() => {
    (async () => {
      // National scope uses council-style filters (NRC/NCT) rather than a long institute list.
      // Local/all scopes show institute names.
      if ((scope || 'all') === 'national') {
        setInstOptions(['NRC', 'NCT']);
      } else {
        const qs = new URLSearchParams();
        qs.set('top', '1');
        qs.set('scope', scope || 'all');
        const s = await apiFetch(`/api/trends/summary?${qs.toString()}`);
        setInstOptions((s.reportsPerInstitute || []).map(d => d.institute));

        // Only show years that actually exist in the selected scope.
        const ys = (s.reportsPerYear || [])
          .filter(d => (d?.count || 0) > 0)
          .map(d => d.year);
        setYearOptions(ys.slice().sort((a, b) => b - a));
        return;
      }

      // For national scope, year options are still derived from the scope-specific summary.
      const qs = new URLSearchParams();
      qs.set('top', '1');
      qs.set('scope', scope || 'all');
      const s = await apiFetch(`/api/trends/summary?${qs.toString()}`);
      const ys = (s.reportsPerYear || [])
        .filter(d => (d?.count || 0) > 0)
        .map(d => d.year);
      setYearOptions(ys.slice().sort((a, b) => b - a));
    })();
  }, [scope]);

  async function load({ offset = 0, qOverride, scopeOverride, yearOverride, instituteOverride } = {}) {
    const qVal = (qOverride !== undefined) ? qOverride : q;
    const scopeVal = (scopeOverride !== undefined) ? scopeOverride : scope;
    const yearVal = (yearOverride !== undefined) ? yearOverride : year;
    const instituteVal = (instituteOverride !== undefined) ? instituteOverride : institute;

    const params = new URLSearchParams();
    if (String(qVal || '').trim()) params.set('q', String(qVal || '').trim());
    if ((scopeVal || 'all') !== 'all') params.set('scope', scopeVal);
    if (yearVal) params.set('year', yearVal);
    if (instituteVal) params.set('institute', instituteVal);
    params.set('limit', String(meta.limit));
    params.set('offset', String(offset));

    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/reports/search?${params.toString()}`, { auth: true });
      setItems(res.items || []);
      setMeta({ total: res.total, limit: res.limit, offset: res.offset });
    } catch (e) {
      setError(e?.message || '검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    // If deep-link query params exist, let the URL-hydration effect trigger the first load
    // to avoid an initial unfiltered flash.
    const sp = new URLSearchParams(location.search || '');
    const hasUrlFilters = Boolean(sp.get('q') || sp.get('scope') || sp.get('institute') || sp.get('year'));
    if (!hydratedFromUrlRef.current && hasUrlFilters) return;

    load({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, year, institute]);

  React.useEffect(() => {
    if (hydratedFromUrlRef.current) return;
    const sp = new URLSearchParams(location.search || '');
    const qp = (sp.get('q') || '').trim();
    const scopeP = (sp.get('scope') || '').trim();
    const safeScope = (scopeP === 'local' || scopeP === 'national' || scopeP === 'all') ? scopeP : '';
    const yearP = (sp.get('year') || '').trim();
    const instP = (sp.get('institute') || '').trim();

    const hasUrlFilters = Boolean(qp || scopeP || yearP || instP);
    if (hasUrlFilters) {
      hydratedFromUrlRef.current = true;

      if (qp) setQ(qp);
      if (safeScope) setScope(safeScope);
      if (yearP) setYear(yearP);
      if (instP) setInstitute(instP);

      // Trigger a search with the URL values immediately (without waiting for state flush).
      load({
        offset: 0,
        qOverride: qp,
        scopeOverride: safeScope || 'all',
        yearOverride: yearP || '',
        instituteOverride: instP || '',
      });
    } else {
      hydratedFromUrlRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  return (
    <Box>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant='h5' sx={{ fontWeight: 800, mb: 2 }}>연구보고서</Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Select
              value={scope}
              onChange={(e) => {
                // Changing scope should also reset filters that might not exist in the new scope.
                // This prevents confusing empty screens.
                const next = e.target.value;
                setScope(next);
                setYear('');
                setInstitute('');
              }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value='all'>전체</MenuItem>
              <MenuItem value='local'>지자체연구기관</MenuItem>
              <MenuItem value='national'>정부출연연구기관</MenuItem>
            </Select>
            <Select value={institute} onChange={(e) => setInstitute(e.target.value)} displayEmpty sx={{ minWidth: 220 }}>
              <MenuItem value=''>기관 전체</MenuItem>
              {instOptions.slice(0, 250).map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
            </Select>
            <Select value={year} onChange={(e) => setYear(e.target.value)} displayEmpty sx={{ minWidth: 140 }}>
              <MenuItem value=''>연도 전체</MenuItem>
              {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
            <TextField fullWidth placeholder='검색어(키워드/제목/연구자)' value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load({ offset: 0 }); }} />
            <Button variant='contained' endIcon={<OpenInNewIcon />} onClick={() => load({ offset: 0 })} disabled={loading}>검색</Button>
          </Stack>

          {error ? (
            <Typography variant='body2' color='error' sx={{ mb: 1 }}>{error}</Typography>
          ) : null}
          <Typography variant='caption' color='text.secondary'>검색 결과: {meta.total}건</Typography>
          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              columnGap: 3,
              rowGap: 7,
              py: 4,
              mt: 3,
              mb: 4,
            }}
          >
            {items.map((it) => (
              <Box key={`${it.scope}-${it.id}`} sx={{ minWidth: 0 }}>
                <ReportCard item={it} />
              </Box>
            ))}
          </Box>

          <Stack direction='row' justifyContent='center' sx={{ mt: 3 }}>
            <Pagination count={totalPages} page={page} onChange={(_, p) => load({ offset: (p - 1) * meta.limit })} />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
