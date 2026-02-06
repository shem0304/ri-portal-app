import React from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Button, Card, CardContent, Chip, Divider, Link, MenuItem,
  Pagination, Select, Stack, TextField, Typography, LinearProgress, Container, InputAdornment, Fade, Paper
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonIcon from '@mui/icons-material/Person';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DescriptionIcon from '@mui/icons-material/Description';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FilterListIcon from '@mui/icons-material/FilterList';
import { apiFetch } from '../api';
import { useNavigate } from 'react-router-dom';

function ResearcherCard({ item, currentScope = 'all', currentInstitute = '', index = 0 }) {
  const instName =
    item?.institute?.name ||
    item?.instituteName ||
    (Array.isArray(item?.institutes) ? item.institutes[0] : '') ||
    '';

  const scopeLabel = item?.scope === 'local' ? '지자체' : item?.scope === 'national' ? '정부출연' : '';
  const year = item?.lastActiveYear || '';
  const matchPct = Math.round(((item?.match?.confidence || 0) * 100));

  const instUrl =
    item?.institute?.url ||
    item?.instituteUrl ||
    (Array.isArray(item?.instituteLinks) ? item.instituteLinks.find((x) => x?.name === instName)?.url || item.instituteLinks[0]?.url : null);

  const navigate = useNavigate();

  const handleLinkClick = React.useCallback((e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const name = String(item?.name || '').trim();
    if (name) params.set('q', name);
    const s = currentScope || 'all';
    if (s !== 'all') params.set('scope', s);
    if (String(currentInstitute || '').trim()) params.set('institute', String(currentInstitute).trim());
    navigate(`/reports?${params.toString()}`);
  }, [navigate, item?.name, currentScope, currentInstitute]);

  return (
    <Fade in timeout={300 + index * 50}>
      <Card
        variant='outlined'
        sx={{
          borderRadius: 3,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          border: '2px solid',
          borderColor: '#e0e0e0',
          backgroundColor: 'white',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: '#003d82',
            boxShadow: '0 8px 20px rgba(0,61,130,0.15)',
            transform: 'translateY(-4px)',
          },
        }}
      >
        <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 상단: 이름 + AI 매칭 */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  }}
                >
                  <PersonIcon sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: '#003d82',
                      lineHeight: 1.2,
                      mb: 0.5,
                    }}
                  >
                    {item?.name || '-'}
                  </Typography>
                  {instName && (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <BusinessIcon sx={{ fontSize: 14, color: '#666' }} />
                      {instUrl ? (
                        <Link
                          href={instUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          underline='hover'
                          sx={{ fontSize: 14, fontWeight: 600, color: '#666' }}
                        >
                          {instName}
                        </Link>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#666' }}>
                          {instName}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Box>
              </Stack>

              <Chip
                label={`AI 매칭 ${matchPct}%`}
                size="small"
                sx={{
                  height: 28,
                  fontWeight: 700,
                  background: matchPct >= 70 
                    ? 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)'
                    : matchPct >= 50
                    ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                    : 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                  color: 'white',
                }}
              />
            </Stack>

            {/* 매칭 진행바 */}
            <Box
              sx={{
                mt: 1.5,
                height: 6,
                borderRadius: 1,
                backgroundColor: '#e0e0e0',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, matchPct))}%`,
                  backgroundColor: matchPct >= 70 ? '#003d82' : matchPct >= 50 ? '#0051a8' : '#6b9bd1',
                  transition: 'width 0.5s ease',
                }}
              />
            </Box>
          </Box>

          {/* 메타 정보 */}
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
            {year && (
              <Chip
                icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
                label={`최근 ${year}`}
                size="small"
                variant="outlined"
                sx={{ 
                  borderColor: '#003d82', 
                  color: '#003d82',
                  fontWeight: 600,
                }}
              />
            )}
            {scopeLabel && (
              <Chip
                label={scopeLabel}
                size="small"
                variant="outlined"
                sx={{ 
                  borderColor: '#003d82', 
                  color: '#003d82',
                  fontWeight: 600,
                }}
              />
            )}
          </Stack>

          {/* 매칭 이유 */}
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 2,
              backgroundColor: '#f8f9fa',
              borderLeft: '3px solid #003d82',
            }}
          >
            <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, display: 'block', mb: 0.5 }}>
              매칭 근거
            </Typography>
            <Typography variant="body2" sx={{ color: '#333', fontSize: 13 }}>
              {(item?.match?.reasons || []).join(' · ') || '성과(보고서) 다수'}
            </Typography>
          </Box>

          {/* 키워드 */}
          {(item?.keywords || []).length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#666', fontWeight: 700, display: 'block', mb: 1 }}>
                주요 키워드
              </Typography>
              <Stack direction='row' spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {item.keywords.slice(0, 10).map((k, idx) => (
                  <Chip
                    key={k}
                    label={k}
                    size='small'
                    sx={{
                      backgroundColor: idx < 3 ? '#e3f2fd' : '#f5f5f5',
                      color: idx < 3 ? '#003d82' : '#666',
                      fontWeight: idx < 3 ? 700 : 500,
                      fontSize: 11,
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* 보고서 수 */}
          <Box sx={{ mb: 2 }}>
            <Chip
              icon={<DescriptionIcon sx={{ fontSize: 16 }} />}
              label={`보고서 ${(item?.reportCount || 0)}건`}
              size='small'
              clickable
              onClick={handleLinkClick}
              sx={{
                backgroundColor: '#003d82',
                color: 'white',
                fontWeight: 700,
                '&:hover': {
                  backgroundColor: '#002a5c',
                },
              }}
            />
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* 최근 보고서 */}
          <Box sx={{ flex: 1 }}>
            <Typography variant='subtitle2' sx={{ fontWeight: 800, mb: 1.5, color: '#333', fontSize: 14 }}>
              주요 연구보고서
            </Typography>

            <Stack spacing={1.5}>
              {(item?.recentReports || []).slice(0, 3).map((r, idx) => (
                <Box
                  key={r.id || `${r.year}-${r.title}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e0e0e0',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: '#e9ecef',
                      borderColor: '#003d82',
                    },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: '#333',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                      title={r.title}
                    >
                      {r.title}
                    </Typography>
                    {r.year && (
                      <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, mt: 0.5, display: 'block' }}>
                        {r.year}년
                      </Typography>
                    )}
                  </Box>

                  {r.url && (
                    <Button
                      variant='outlined'
                      size='small'
                      component="a"
                      href={r.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                      sx={{
                        minWidth: 80,
                        height: 32,
                        borderColor: '#003d82',
                        color: '#003d82',
                        fontWeight: 700,
                        fontSize: 11,
                        borderRadius: 1,
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#003d82',
                          backgroundColor: '#f0f4f8',
                        },
                      }}
                    >
                      보기
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Fade>
  );
}

export default function ResearchersPage() {
  const [q, setQ] = React.useState('');
  const [scope, setScope] = React.useState('all');
  const [institute, setInstitute] = React.useState('');
  const [sort, setSort] = React.useState('relevance');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [meta, setMeta] = React.useState({ total: 0, limit: 24, offset: 0 });
  const [items, setItems] = React.useState([]);
  const [instOptions, setInstOptions] = React.useState([]);
  const [queryInfo, setQueryInfo] = React.useState({ raw: '', tokens: [], expandedTokens: [], suggestedKeywords: [] });

  const page = Math.floor(meta.offset / meta.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  async function load({ offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (scope && scope !== 'all') params.set('scope', scope);
    if (institute) params.set('institute', institute);
    if (sort) params.set('sort', sort);
    params.set('limit', String(meta.limit));
    params.set('offset', String(offset));

    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/researchers/search?${params.toString()}`);
      setItems(res.items || []);
      setMeta({ total: res.total || 0, limit: res.limit || meta.limit, offset: res.offset || 0 });
      const opts = (res.facets?.institutes || []).map((d) => d.name).filter(Boolean);
      setInstOptions(opts.slice(0, 300));
      setQueryInfo(res.queryAnalysis || { raw: q.trim(), tokens: [], expandedTokens: [], suggestedKeywords: [] });
    } catch (e) {
      setError(e?.message || '검색에 실패했습니다.');
      setItems([]);
      setMeta((m) => ({ ...m, total: 0, offset: 0 }));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, institute, sort]);

  return (
    <Box sx={{ backgroundColor: '#f5f7fa', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        <Card
          sx={{
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e0e0e0',
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
                <PersonSearchIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Box>
                <Typography 
                  variant='h4' 
                  sx={{ 
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: 1.2,
                    mb: 0.5,
                  }}
                >
                  연구자 검색
                </Typography>
                <Typography variant='body2' sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  AI 기반 전문분야 매칭 시스템
                </Typography>
              </Box>
            </Stack>

            {/* 검색 영역 */}
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
              {/* 검색 필터 라벨 */}
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <FilterListIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  검색 필터
                </Typography>
              </Stack>

              <Stack spacing={2}>
                {/* 첫 번째 줄: 필터 */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Select
                    value={scope}
                    onChange={(e) => {
                      setScope(e.target.value);
                      setInstitute('');
                    }}
                    sx={{
                      minWidth: 180,
                      backgroundColor: 'white',
                      borderRadius: 1,
                    }}
                  >
                    <MenuItem value='all'>전체</MenuItem>
                    <MenuItem value='local'>지자체연구기관</MenuItem>
                    <MenuItem value='national'>정부출연연구기관</MenuItem>
                  </Select>

                  <Select
                    value={institute}
                    onChange={(e) => setInstitute(e.target.value)}
                    displayEmpty
                    sx={{
                      minWidth: 260,
                      backgroundColor: 'white',
                      borderRadius: 1,
                    }}
                  >
                    <MenuItem value=''>기관 전체</MenuItem>
                    {instOptions.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                  </Select>

                  <Select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    sx={{
                      minWidth: 160,
                      backgroundColor: 'white',
                      borderRadius: 1,
                    }}
                  >
                    <MenuItem value='relevance'>관련도</MenuItem>
                    <MenuItem value='recent'>최신</MenuItem>
                    <MenuItem value='outputs'>성과(보고서 수)</MenuItem>
                  </Select>
                </Stack>

                {/* 두 번째 줄: 검색어 */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    fullWidth
                    placeholder='정책 과제/연구 주제/문제 상황을 문장으로 입력해도 됩니다 (예: 지방재정 건전성 강화 방안)'
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') load({ offset: 0 }); }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#666' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      backgroundColor: 'white',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                      },
                    }}
                  />
                  <Button
                    variant='contained'
                    size="large"
                    endIcon={<SearchIcon />}
                    onClick={() => load({ offset: 0 })}
                    disabled={loading}
                    sx={{
                      minWidth: 140,
                      backgroundColor: '#003d82',
                      fontWeight: 700,
                      borderRadius: 1,
                      textTransform: 'none',
                      px: 4,
                      boxShadow: 'none',
                      '&:hover': {
                        backgroundColor: '#002a5c',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    검색
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {/* 매칭 방식 설명 */}
            <Accordion
              sx={{
                mb: 2,
                borderRadius: 2,
                border: '1px solid #e0e0e0',
                '&:before': { display: 'none' },
              }}
              elevation={0}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#667eea' }} />}
                sx={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoOutlinedIcon sx={{ fontSize: 20, color: '#667eea' }} />
                  <Typography variant='subtitle2' sx={{ fontWeight: 800, color: '#003d82' }}>
                    "최적 연구자" 매칭 방식
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: 'white', pt: 2 }}>
                <Typography variant='body2' sx={{ mb: 1.5, lineHeight: 1.7, color: '#333' }}>
                  단순 이름 검색이 아니라, 보고서 제목에서 추출한 키워드로 연구자별 <strong>"전문분야 프로파일(TF‑IDF)"</strong>을 만들고
                  질의(문장형 입력 포함)와의 <strong>전문분야 유사도</strong>·<strong>키워드 커버리지</strong>를 기본으로,
                  <strong>최근 활동</strong>과 <strong>성과(보고서 수)</strong>를 보조 신호로 결합해 순위를 계산합니다.
	                  또한 동일 보고서 내에서 <strong>연구책임자(첫 번째 저자) 기여</strong>는 참여연구진보다 더 크게 반영되도록(예: 연구책임자 1.6, 참여연구진 1.0 가중치) 설계되어
                  실제 과제 수행 경험이 많은 연구자가 상단에 노출될 가능성이 높습니다.
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: '#e3f2fd',
                    borderLeft: '3px solid #003d82',
                  }}
                >
                  <Typography variant='body2' sx={{ fontWeight: 700, color: '#003d82' }}>
                    💡 팁: "무슨 정책을 해결하고 싶은지"를 한 문장으로 쓰면 매칭 품질이 가장 좋아집니다.
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* 추천 키워드 */}
            {(queryInfo?.suggestedKeywords || []).length > 0 && (
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e0e0e0',
                }}
              >
                <Typography variant='caption' sx={{ color: '#666', fontWeight: 700, display: 'block', mb: 1 }}>
                  추천 키워드 (클릭해서 재탐색)
                </Typography>
                <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {queryInfo.suggestedKeywords.map((k) => (
                    <Chip
                      key={k}
                      label={k}
                      size='small'
                      onClick={() => { setQ(k); setTimeout(() => load({ offset: 0 }), 0); }}
                      clickable
                      sx={{
                        backgroundColor: 'white',
                        border: '1px solid #003d82',
                        color: '#003d82',
                        fontWeight: 600,
                        '&:hover': {
                          backgroundColor: '#003d82',
                          color: 'white',
                        },
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* 에러 메시지 */}
            {error && (
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: '#ffebee',
                  border: '1px solid #ef5350',
                }}
              >
                <Typography variant='body2' sx={{ color: '#c62828', fontWeight: 600 }}>
                  {error}
                </Typography>
              </Box>
            )}

            {/* 검색 결과 수 */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <Chip
                icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
                label={`총 ${meta.total.toLocaleString()}명`}
                sx={{
                  backgroundColor: '#003d82',
                  color: 'white',
                  fontWeight: 700,
                }}
              />
              {loading && <LinearProgress sx={{ flex: 1, maxWidth: 200, borderRadius: 1 }} />}
            </Stack>

            <Divider sx={{ mb: 3 }} />

            {/* 로딩 상태 */}
            {loading && items.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <LinearProgress sx={{ mb: 2, borderRadius: 1, maxWidth: 400, mx: 'auto' }} />
                <Typography variant='h6' sx={{ color: '#666', fontWeight: 600 }}>
                  연구자를 검색하는 중...
                </Typography>
              </Box>
            ) : items.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <PersonIcon sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
                <Typography variant='h6' sx={{ color: '#666', fontWeight: 600, mb: 1 }}>
                  검색 결과가 없습니다
                </Typography>
                <Typography variant='body2' sx={{ color: '#999' }}>
                  다른 검색어나 필터를 사용해보세요
                </Typography>
              </Box>
            ) : (
              <>
                {/* 연구자 카드 그리드 */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 440px))',
                    gap: 3,
                    mb: 4,
                    justifyContent: 'start',
                  }}
                >
                  {items.map((it, idx) => (
                    <ResearcherCard
                      key={it.id || `${it.name}-${it?.institute?.name || it?.instituteName || (Array.isArray(it?.institutes) ? it.institutes[0] : '-')}`}
                      item={it}
                      currentScope={scope}
                      currentInstitute={institute}
                      index={idx}
                    />
                  ))}
                </Box>

                {/* 페이지네이션 */}
                <Stack direction='row' justifyContent='center' sx={{ mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, p) => load({ offset: (p - 1) * meta.limit })}
                    color="primary"
                    size="large"
                    sx={{
                      '& .MuiPaginationItem-root': {
                        fontWeight: 600,
                        color: '#003d82',
                      },
                      '& .Mui-selected': {
                        backgroundColor: '#003d82',
                        color: 'white',
                        '&:hover': {
                          backgroundColor: '#002a5c',
                        },
                      },
                    }}
                  />
                </Stack>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
