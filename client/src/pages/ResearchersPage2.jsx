import React from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Button, Card, CardContent, Chip, Divider, Grid, Link, LinearProgress, MenuItem,
  Pagination, Select, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { apiFetch } from '../api';
import { useNavigate } from 'react-router-dom';

function normalizeConfidenceToPct(conf) {
  if (conf === null || conf === undefined || Number.isNaN(conf)) return null;
  let c = Number(conf);
  // Accept both 0..1 and 0..100 inputs
  if (c > 1 && c <= 100) c = c / 100;
  // If some upstream score leaked in (e.g., 0..N), clamp to [0,1]
  c = Math.max(0, Math.min(1, c));
  return Math.round(c * 100);
}

function ResearcherCard({ item, highlightKeywords = [], currentScope = 'all', currentInstitute = '' }) {
  // NOTE: 이 컴포넌트는 “연구자 카드”를 메인 카드형 리스트 UI로 렌더링합니다.
  // 요청에 따라 (1) 키워드/최근 3건 리스트/버튼 컬럼을 제거하고
  // (2) 제목(연구자명) + 메타(연도/기관/구분) + 링크(→)의 단순 카드로 통일합니다.
  const match = item.match || null;
  const confPct = match ? normalizeConfidenceToPct(match.confidence) : null;

  // Prefer single institute object from server; fall back to legacy shapes.
  const instName =
    item?.institute?.name ||
    item?.instituteName ||
    (Array.isArray(item?.institutes) ? item.institutes[0] : '') ||
    '';
  // Render(프로덕션) 서버는 instituteLinks 형태로 내려올 수 있어 하위호환 처리
  const instUrl =
    item?.institute?.url ||
    item?.instituteUrl ||
    (Array.isArray(item?.instituteLinks)
      ? (item.instituteLinks.find((x) => String(x?.name || '').trim() === String(instName).trim())?.url || '')
      : '') ||
    '';
  const navigate = useNavigate();

  const handleReportsClick = React.useCallback(() => {
    const params = new URLSearchParams();
    const name = String(item?.name || '').trim();
    if (name) params.set('q', name);
    const s = currentScope || 'all';
    if (s !== 'all') params.set('scope', s);
    if (String(currentInstitute || '').trim()) params.set('institute', String(currentInstitute).trim());
    navigate(`/reports?${params.toString()}`);
  }, [navigate, item?.name, currentScope, currentInstitute]);

  return (
    <Card
      variant='outlined'
      sx={{
        borderRadius: 4,
        width: '100%',
        height: '100%',
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        // 스크린샷처럼 카드 높이를 일정하게
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        // 살짝 떠 보이는 느낌
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        borderColor: 'rgba(0,0,0,0.08)',
      }}
    >
      <CardContent sx={{ position: 'relative', p: 4, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Title */}
        <Typography
          variant='h6'
          sx={{
            fontWeight: 900,
            lineHeight: 1.25,
            minWidth: 0,
            // 제목이 길면 2줄까지
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={item?.name || ''}
        >
          {item?.name || ''}
        </Typography>

        {/* Meta (연도/기관/구분) */}
        <Stack direction='row' spacing={2} sx={{ mt: 2, color: 'text.secondary', fontWeight: 600, flexWrap: 'wrap' }}>
          <Typography variant='body2' color='text.secondary'>
            {item?.lastActiveYear || ''}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {instName || ''}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {item?.scope === 'local' ? '지자체' : item?.scope === 'national' ? '정부출연' : ''}
          </Typography>
        </Stack>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Link */}
        <Link
          component='button'
          underline='none'
          onClick={handleReportsClick}
          sx={{
            alignSelf: 'flex-start',
            fontWeight: 800,
            color: 'primary.main',
            fontSize: 18,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          링크 <span aria-hidden>→</span>
        </Link>

        {/* (선택) AI매칭 배지는 유지하되, 카드 상단을 어지럽히지 않게 숨김 처리 가능 */}
        {confPct !== null ? (
          <Tooltip title='AI 매칭 점수(전문분야·최근성·성과·협업신호 결합)'>
            <Box sx={{ position: 'absolute', top: 14, right: 18, opacity: 0.9 }}>
              <Chip size='small' label={`AI 매칭 ${confPct}%`} />
            </Box>
          </Tooltip>
        ) : null}
      </CardContent>
    </Card>
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
    <Box>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant='h5' sx={{ fontWeight: 800, mb: 2 }}>연구자 찾기</Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setInstitute('');
              }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value='all'>전체</MenuItem>
              <MenuItem value='local'>지자체연구기관</MenuItem>
              <MenuItem value='national'>정부출연연구기관</MenuItem>
            </Select>

            <Select value={institute} onChange={(e) => setInstitute(e.target.value)} displayEmpty sx={{ minWidth: 240 }}>
              <MenuItem value=''>기관 전체</MenuItem>
              {instOptions.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
            </Select>

            <Select value={sort} onChange={(e) => setSort(e.target.value)} sx={{ minWidth: 160 }}>
              <MenuItem value='relevance'>관련도</MenuItem>
              <MenuItem value='recent'>최신</MenuItem>
              <MenuItem value='outputs'>성과(보고서 수)</MenuItem>
            </Select>

            <TextField
              fullWidth
              placeholder='정책 과제/연구 주제/문제 상황을 문장으로 입력해도 됩니다 (예: 지방재정 건전성 강화 방안)'
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load({ offset: 0 }); }}
            />
            <Button
              variant='contained'
              startIcon={<SearchIcon />}
              onClick={() => load({ offset: 0 })}
              disabled={loading}
            >
              검색
            </Button>
          </Stack>

                    <Accordion sx={{ mb: 1, borderRadius: 3 }} elevation={0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle2' sx={{ fontWeight: 800 }}>“최적 연구자” 매칭 방식</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                단순 이름 검색이 아니라, 보고서 제목에서 추출한 키워드로 연구자별 “전문분야 프로파일(TF‑IDF)”을 만들고,
                질의(문장형 입력 포함)와의 유사도 + 최근 활동 + 성과(보고서 수) + 협업 신호를 결합해 순위를 계산합니다.
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                팁: “무슨 정책을 해결하고 싶은지”를 한 문장으로 쓰면 매칭 품질이 가장 좋아집니다.
              </Typography>
            </AccordionDetails>
          </Accordion>

          {(queryInfo?.suggestedKeywords || []).length ? (
            <Box sx={{ mb: 1 }}>
              <Typography variant='caption' color='text.secondary'>추천 키워드(클릭해서 재탐색)</Typography>
              <Stack direction='row' spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                {queryInfo.suggestedKeywords.map((k) => (
                  <Chip
                    key={k}
                    size='small'
                    label={k}
                    onClick={() => { setQ(k); setTimeout(() => load({ offset: 0 }), 0); }}
                    clickable
                  />
                ))}
              </Stack>
            </Box>
          ) : null}

{error ? (
            <Typography variant='body2' color='error' sx={{ mb: 1 }}>{error}</Typography>
          ) : null}
          <Typography variant='caption' color='text.secondary'>검색 결과: {meta.total}명</Typography>
          <Divider sx={{ my: 2 }} />

	          <Grid container spacing={3} alignItems='stretch'>
            {items.map((it) => (
              <Grid
                item
                // ✅ 카드 '가로 폭'이 제각각으로 보이지 않도록
                // 화면 크기별 컬럼 수를 명시적으로 고정합니다.
                // - xs(모바일): 1열
                // - sm(태블릿): 2열
                // - md(노트북): 3열
                // - lg+(대화면): 3열
                xs={12}
                sm={6}
                md={4}
	              lg={4}
	                // minWidth:0 is important so long titles don't push the grid item wider than its breakpoint width
	                sx={{ display: 'flex', minWidth: 0 }}
                key={it.id || `${it.name}-${it?.institute?.name || it?.instituteName || (Array.isArray(it?.institutes) ? it.institutes[0] : '-')}`}
              >
                <ResearcherCard item={it} highlightKeywords={(queryInfo.tokens || []).map(t => String(t).toLowerCase())} currentScope={scope} currentInstitute={institute} />
              </Grid>
            ))}
          </Grid>

          <Stack direction='row' justifyContent='center' sx={{ mt: 3 }}>
            <Pagination count={totalPages} page={page} onChange={(_, p) => load({ offset: (p - 1) * meta.limit })} />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
