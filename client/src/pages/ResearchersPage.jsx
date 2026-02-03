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

function normalizeConfidenceToPct(conf) {
  if (conf === null || conf === undefined || Number.isNaN(conf)) return null;
  let c = Number(conf);
  // Accept both 0..1 and 0..100 inputs
  if (c > 1 && c <= 100) c = c / 100;
  // If some upstream score leaked in (e.g., 0..N), clamp to [0,1]
  c = Math.max(0, Math.min(1, c));
  return Math.round(c * 100);
}

function ResearcherCard({ item, highlightKeywords = [] }) {
  const match = item.match || null;
  const confPct = match ? normalizeConfidenceToPct(match.confidence) : null;
  const reasons = (match?.reasons || []).slice(0, 3);
  const matchedKeywords = (match?.matchedKeywords || []).slice(0, 6);

  return (
    <Card variant='outlined' sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent>
        <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 0.5, flexWrap: 'wrap' }}>
          <Typography variant='subtitle1' sx={{ fontWeight: 800, lineHeight: 1.2 }}>{item.name}</Typography>

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

        <Typography variant='body2' color='text.secondary'>
          {(item.institutes || []).slice(0, 2).join(' · ') || '소속 정보 없음'}
        </Typography>

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
            href={`https://ri-portal-app.onrender.com/reports?q=${encodeURIComponent(item.name || '')}`}
            sx={{ cursor: 'pointer' }}
            label={`보고서 ${item.reportCount || 0}건`}
          />
          {item.scope && item.scope !== 'all' ? (
            <Chip size='small' variant='outlined' label={item.scope === 'local' ? '지자체' : '정부출연'} />
          ) : null}
        </Stack>

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
          <Box sx={{ mt: 1.5 }}>
            <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 0.5 }}>
              <Typography variant='caption' color='text.secondary'>연구보고서 (최근 3건)</Typography>
            </Stack>

            <Stack spacing={0.75}>
              {uniq.map((r) => (
                <Stack key={r.id} direction='row' spacing={1} alignItems='center' justifyContent='space-between'>
                  <Typography
                    variant='body2'
                    sx={{
                      fontWeight: 650,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      pr: 1,
                      flex: 1,
                    }}
                    title={`${r.year ? `[${r.year}] ` : ''}${r.title}`}
                  >
                    {r.year ? `[${r.year}] ` : ''}{r.title}
                  </Typography>

                  <Button
                    size='small'
                    variant='outlined'
                    endIcon={<OpenInNewIcon fontSize='small' />}
                    component='a'
                    href={r.url || '#'}
                    target='_blank'
                    rel='noreferrer'
                    disabled={!r.url}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    열기
                  </Button>
                </Stack>
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

          <Grid container spacing={2}>
            {items.map((it) => (
              <Grid item xs={12} md={6} lg={4} key={it.id || `${it.name}-${(it.institutes || ['-'])[0]}`}> 
                <ResearcherCard item={it} highlightKeywords={(queryInfo.tokens || []).map(t => String(t).toLowerCase())} />
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
