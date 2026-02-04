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
  const match = item.match || null;
  const confPct = match ? normalizeConfidenceToPct(match.confidence) : null;
  const reasons = (match?.reasons || []).slice(0, 3);
  const matchedKeywords = (match?.matchedKeywords || []).slice(0, 6);

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
        borderRadius: 3,
        width: '100%',
        height: '100%',
        // Prevent long text (e.g., report titles) from forcing Grid items to expand
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        minHeight: 380,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 0 }}>
        <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 0.5, flexWrap: 'wrap' }}>
          <Typography variant='subtitle1' sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {item.name}
            {instName ? (
              <>
                {' '}
                <Typography component='span' sx={{ fontWeight: 700 }} color='text.secondary'>
                  ·
                </Typography>
                {' '}
                {instUrl ? (
                  <Link
                    href={instUrl}
                    target='_blank'
                    rel='noreferrer'
                    underline='hover'
                    sx={{ fontWeight: 700 }}
                  >
                    {instName}
                  </Link>
                ) : (
                  <Typography component='span' sx={{ fontWeight: 700 }} color='text.secondary'>
                    {instName}
                  </Typography>
                )}
              </>
            ) : null}
          </Typography>

          {confPct !== null ? (
            <Tooltip title='전문분야(키워드 프로파일)·최근성·성과·협업신호를 결합해 매칭한 점수입니다.'>
              <Chip size='small' label={`AI 매칭 ${confPct}%`} />
            </Tooltip>
          ) : null}

          {item.lastActiveYear ? (
            <Chip size='small' variant='outlined' label={`최근 ${item.lastActiveYear}`} />
          ) : null}
        </Stack>

        {confPct !== null ? (
          <Box sx={{ mb: 1 }}>
            <LinearProgress variant='determinate' value={Math.max(0, Math.min(100, confPct))} />
            {(reasons || []).length ? (
              <Typography variant='caption' color='text.secondary' sx={{ mt: 0.5, display: 'block' }}>
                {reasons.join(' · ')}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        {/* 기관명은 카드 상단(이름 옆)에서만 1회 표시 */}

        {(matchedKeywords || []).length ? (
          <Stack direction='row' spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            {matchedKeywords.map((k) => (
              <Chip key={k} size='small' label={k} />
            ))}
          </Stack>
        ) : null}

        {(item.keywords || []).length ? (
          <Stack direction='row' spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            {item.keywords.slice(0, 8).map((k) => {
              const isHi = highlightKeywords.includes(String(k).toLowerCase());
              return (
                <Chip key={k} size='small' variant={isHi ? 'filled' : 'outlined'} label={k} />
              );
            })}
          </Stack>
        ) : null}

        <Stack direction='row' spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
          <Chip
            size='small'
            variant='outlined'
            clickable
            component='a'
            sx={{ cursor: 'pointer' }}
            label={`보고서 ${item.reportCount || 0}건`}
            clickable
            onClick={handleReportsClick}
          />
          {item.scope && item.scope !== 'all' ? (
            <Chip size='small' variant='outlined' label={item.scope === 'local' ? '지자체' : '정부출연'} />
          ) : null}
        </Stack>

        {/* 카드 높이는 minHeight로 통일하고, 섹션 사이 불필요한 공백은 최소화 */}

        {(() => {
          const raw = Array.isArray(item.recentReports) ? item.recentReports : [];
          const uniq = [];
          const seen = new Set();
          for (const r of raw) {
            const k = String(r?.id || r?.title || '').trim();
            if (!k || seen.has(k)) continue;
            seen.add(k);
            uniq.push(r);
            if (uniq.length >= 3) break;
          }

          return uniq.length ? (
          <Box sx={{ mt: 1.25 }}>
            <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 0.5 }}>
              <Typography variant='caption' color='text.secondary'>연구보고서 (최근 3건)</Typography>
            </Stack>

            {/*
              NOTE: 카드 폭이 들쭉날쭉해 보이는 원인은 긴 텍스트가 flex item의 최소 너비를 밀어내는 경우가 많습니다.
              각 행을 "1fr(제목) + 고정 액션 컬럼" grid로 고정해, 버튼 컬럼 시작점과 간격을 항상 동일하게 유지합니다.
            */}
            {/* Stretch children so each row takes the full card width */}
            <Stack spacing={0.75} sx={{ alignItems: 'stretch', width: '100%' }}>
              {uniq.map((r) => (
                <Box
                  key={r.id}
                  sx={{
                    width: '100%',
                    minWidth: 0,
                    display: 'grid',
                    // 1fr(제목) + 고정 액션 컬럼(버튼)
                    gridTemplateColumns: 'minmax(0, 1fr) 112px',
                    columnGap: 1.5,
                    alignItems: 'start',
                  }}
                >
                  <Typography
                    variant='body2'
                    component='div'
                    sx={{
                      fontWeight: 650,
                      lineHeight: 1.3,
                      // Grid/Flex 환경에서 텍스트가 폭을 밀어내지 않도록
                      minWidth: 0,
                      width: '100%',
                      maxWidth: '100%',
                      // ✅ 프로덕션에서 white-space: nowrap 류가 덮어써져 줄바꿈이 막히는 케이스 방지
                      whiteSpace: 'normal !important',
                      // ✅ 한글/영문 혼합 긴 제목도 강제로 줄바꿈
                      wordBreak: 'break-all',
                      overflowWrap: 'anywhere',
                      // ✅ 최대 2줄까지만 표시(브라우저 호환 위해 Webkit + 표준 속성 동시 적용)
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      lineClamp: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      // 2줄 높이 확보(행 간 카드 레이아웃 흔들림 방지)
                      minHeight: '2.6em',
                    }}
                    title={`${r.year ? `[${r.year}] ` : ''}${r.title}`}
                  >
                    {`${r.year ? `[${r.year}] ` : ''}${r.title || ''}`.trim()}
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      justifySelf: 'end',
                      width: 112,
                      minWidth: 112,
                    }}
                  >
                    <Button
                      size='small'
                      variant='outlined'
                      endIcon={<OpenInNewIcon fontSize='small' />}
                      component='a'
                      href={r.url || '#'}
                      target='_blank'
                      rel='noreferrer'
                      disabled={!r.url}
                      sx={{
                        whiteSpace: 'nowrap',
                        width: '100%',
                        minWidth: 0,
                      }}
                    >
                      열기
                    </Button>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
          ) : null;
        })()}
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

	          <Grid container spacing={2} alignItems='stretch'>
            {items.map((it) => (
              <Grid
                item
                // ✅ 카드 '가로 폭'이 제각각으로 보이지 않도록
                // 화면 크기별 컬럼 수를 명시적으로 고정합니다.
                // - xs(모바일): 1열
                // - sm(태블릿): 2열
                // - md(노트북): 3열
                // - lg+(대화면): 4열
                xs={12}
                sm={6}
                md={4}
                lg={3}
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
