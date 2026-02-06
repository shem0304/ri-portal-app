import React from 'react';
import {
  Box, Button, Card, CardContent, Divider, MenuItem, Pagination, Select,
  Stack, TextField, Typography, Chip, CircularProgress, InputAdornment, Fade, Paper, Container
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BusinessIcon from '@mui/icons-material/Business';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FilterListIcon from '@mui/icons-material/FilterList';
import { apiFetch } from '../api';

function ReportCard({ item, index }) {
  const year = item?.year ?? '';
  const inst = item?.institute ?? '';
  const scopeLabel = item?.scope === 'local' ? '지자체' : item?.scope === 'national' ? '정부출연' : '';
  const metaParts = [year, inst, scopeLabel].filter(Boolean);
  const authorsArr = Array.isArray(item?.authors)
    ? item.authors
    : (typeof item?.authors === 'string' && item.authors.trim())
      ? item.authors.split(/[;,·|/]+/g).map(s => s.trim()).filter(Boolean)
      : (typeof item?.authorsText === 'string' && item.authorsText.trim())
        ? item.authorsText.split(/[;,·|/]+/g).map(s => s.trim()).filter(Boolean)
        : [];

  const scopeColor = item?.scope === 'local' ? '#1976d2' : '#9c27b0';
  const scopeBgColor = item?.scope === 'local' ? '#e3f2fd' : '#f3e5f5';

  return (
    <Fade in timeout={300 + index * 50}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 4,
          height: 260,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          border: '2px solid',
          borderColor: 'divider',
          // 연구보고서 종이 느낌의 배경
          background: `
            linear-gradient(to right, #f8f9fa 1px, transparent 1px),
            linear-gradient(to bottom, #f8f9fa 1px, transparent 1px),
            linear-gradient(145deg, #ffffff 0%, #fafafa 100%)
          `,
          backgroundSize: '20px 20px, 20px 20px, 100% 100%',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: item?.scope === 'local'
              ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
              : 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
            transform: 'scaleX(0)',
            transformOrigin: 'left',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          '&:hover': {
            transform: 'translateY(-6px)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.15)',
            borderColor: item?.scope === 'local' ? '#667eea' : '#f093fb',
            '&::before': {
              transform: 'scaleX(1)',
            }
          },
        }}
      >
        <CardContent
          sx={{
            p: 3,
            pt: 2.5,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
            '&:last-child': { pb: 3 },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {/* 상단 메타 태그 */}
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {year && (
                <Chip
                  icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
                  label={year}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: scopeBgColor,
                    color: scopeColor,
                  }}
                />
              )}
              {scopeLabel && (
                <Chip
                  label={scopeLabel}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: scopeBgColor,
                    color: scopeColor,
                  }}
                />
              )}
            </Stack>

            {/* 제목 */}
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
                color: 'text.primary',
              }}
              title={item?.title || ''}
            >
              {item?.title || '-'}
            </Typography>

            {/* 기관명 */}
            {inst && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <BusinessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {inst}
                </Typography>
              </Stack>
            )}

            {/* 저자 */}
            {authorsArr.length > 0 && (
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
                <PersonIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.2 }} />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    flex: 1,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: 500,
                  }}
                  title={`저자: ${authorsArr.join(', ')}`}
                >
                  {authorsArr.join(', ')}
                </Typography>
              </Stack>
            )}
          </Box>

          {/* 하단 버튼 */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            {item?.url ? (
              <Button
                variant="contained"
                size="small"
                component="a"
                href={item.url}
                target="_blank"
                rel="noreferrer"
                endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                sx={{
                  borderRadius: 2,
                  px: 2.5,
                  py: 0.75,
                  fontWeight: 700,
                  fontSize: 13,
                  textTransform: 'none',
                  backgroundColor: scopeColor,
                  '&:hover': {
                    backgroundColor: scopeColor,
                    filter: 'brightness(0.9)',
                  },
                }}
              >
                보고서 열기
              </Button>
            ) : (
              <Chip
                label="링크 없음"
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
        </CardContent>
      </Card>
    </Fade>
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
  const [meta, setMeta] = React.useState({ total: 0, limit: 21, offset: 0 });
  const [items, setItems] = React.useState([]);
  const [instOptions, setInstOptions] = React.useState([]);
  const [yearOptions, setYearOptions] = React.useState([]);
  const page = Math.floor(meta.offset / meta.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  const hydratedFromUrlRef = React.useRef(false);

  React.useEffect(() => {
    (async () => {
      if ((scope || 'all') === 'national') {
        setInstOptions(['NRC', 'NCT']);
      } else {
        const qs = new URLSearchParams();
        qs.set('top', '1');
        qs.set('scope', scope || 'all');
        const s = await apiFetch(`/api/trends/summary?${qs.toString()}`);
        setInstOptions((s.reportsPerInstitute || []).map(d => d.institute));

        const ys = (s.reportsPerYear || [])
          .filter(d => (d?.count || 0) > 0)
          .map(d => d.year);
        setYearOptions(ys.slice().sort((a, b) => b - a));
        return;
      }

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
    <Box sx={{ backgroundColor: '#f8f9fa', minHeight: '100vh', py: 4 }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: 3 }}>
        <Card
          sx={{
            borderRadius: 4,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
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
                <DescriptionOutlinedIcon sx={{ fontSize: 32, color: 'white' }} />
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
                연구보고서
              </Typography>
            </Stack>

            {/* 필터 섹션 */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                border: '1px solid',
                borderColor: 'divider',
                mb: 4,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <FilterListIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  검색 필터
                </Typography>
              </Stack>

              <Stack spacing={2}>
                {/* 첫 번째 줄: Scope, 기관, 연도 */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Select
                    value={scope}
                    onChange={(e) => {
                      const next = e.target.value;
                      setScope(next);
                      setYear('');
                      setInstitute('');
                    }}
                    sx={{
                      minWidth: 200,
                      backgroundColor: 'white',
                      borderRadius: 2,
                    }}
                  >
                    <MenuItem value="all">전체</MenuItem>
                    <MenuItem value="local">지자체연구기관</MenuItem>
                    <MenuItem value="national">정부출연연구기관</MenuItem>
                  </Select>
                  <Select
                    value={institute}
                    onChange={(e) => setInstitute(e.target.value)}
                    displayEmpty
                    sx={{
                      minWidth: 250,
                      backgroundColor: 'white',
                      borderRadius: 2,
                    }}
                  >
                    <MenuItem value="">기관 전체</MenuItem>
                    {instOptions.slice(0, 250).map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                  </Select>
                  <Select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    displayEmpty
                    sx={{
                      minWidth: 150,
                      backgroundColor: 'white',
                      borderRadius: 2,
                    }}
                  >
                    <MenuItem value="">연도 전체</MenuItem>
                    {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </Select>
                </Stack>

                {/* 두 번째 줄: 검색어 + 버튼 */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    fullWidth
                    placeholder="검색어(키워드/제목/연구자)"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') load({ offset: 0 }); }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      backgroundColor: 'white',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<SearchIcon />}
                    onClick={() => load({ offset: 0 })}
                    disabled={loading}
                    sx={{
                      minWidth: 140,
                      borderRadius: 2,
                      fontWeight: 700,
                      px: 4,
                    }}
                  >
                    검색
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {/* 에러 메시지 */}
            {error && (
              <Box
                sx={{
                  backgroundColor: '#ffebee',
                  borderRadius: 2,
                  p: 2,
                  mb: 2,
                }}
              >
                <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                  {error}
                </Typography>
              </Box>
            )}

            {/* 검색 결과 수 */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Chip
                label={`총 ${meta.total.toLocaleString()}건`}
                color="primary"
                sx={{ fontWeight: 700 }}
              />
              {loading && <CircularProgress size={20} />}
            </Stack>

            <Divider sx={{ mb: 3 }} />

            {/* 로딩 상태 */}
            {loading && items.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 8,
                  gap: 2,
                }}
              >
                <CircularProgress size={60} thickness={4} />
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                  검색 중...
                </Typography>
              </Box>
            ) : items.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 8,
                }}
              >
                <DescriptionIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                  검색 결과가 없습니다
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  다른 검색어나 필터를 사용해보세요
                </Typography>
              </Box>
            ) : (
              <>
                {/* 보고서 카드 그리드 */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 400px))',
                    gap: 3,
                    mb: 4,
                    justifyContent: 'start',
                  }}
                >
                  {items.map((it, idx) => (
                    <Box key={`${it.scope}-${it.id}`} sx={{ minWidth: 0 }}>
                      <ReportCard item={it} index={idx} />
                    </Box>
                  ))}
                </Box>

                {/* 페이지네이션 */}
                <Stack direction="row" justifyContent="center" sx={{ mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, p) => load({ offset: (p - 1) * meta.limit })}
                    color="primary"
                    size="large"
                    sx={{
                      '& .MuiPaginationItem-root': {
                        fontWeight: 600,
                      },
                    }}
                  />
                </Stack>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
