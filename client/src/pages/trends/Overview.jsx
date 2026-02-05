import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Grid, Paper, Typography, CircularProgress, Stack, Fade, Card, CardContent } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Cell } from 'recharts';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BusinessIcon from '@mui/icons-material/Business';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import DescriptionIcon from '@mui/icons-material/Description';
import { apiFetch } from '../../api';

// 차트 색상 팔레트
const CHART_COLORS = {
  primary: '#1976d2',
  secondary: '#9c27b0',
  gradient: ['#1976d2', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9'],
  bars: ['#1976d2', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9', '#bbdefb', '#1565c0', '#1e88e5', '#1976d2', '#2196f3', '#42a5f5', '#64b5f6'],
};

// 통계 카드 컴포넌트
function StatCard({ title, value, icon: Icon, color }) {
  return (
    <Fade in timeout={500}>
      <Card
        sx={{
          borderRadius: 3,
          background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
          border: '1px solid',
          borderColor: `${color}30`,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: `0 8px 24px ${color}30`,
          },
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color, mt: 0.5 }}>
                {value?.toLocaleString() || 0}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                backgroundColor: `${color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon sx={{ fontSize: 32, color }} />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Fade>
  );
}

// 커스텀 툴팁
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid #e0e0e0',
          borderRadius: 2,
          p: 1.5,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
          {label}
        </Typography>
        {payload.map((entry, index) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color }}>
            {entry.name}: <strong>{entry.value?.toLocaleString()}</strong>
          </Typography>
        ))}
      </Box>
    );
  }
  return null;
}

export default function Overview() {
  const { trendFilters } = useOutletContext();
  const f = trendFilters || { scope: 'all', institute: '', year: '', q: '' };
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('top', '100');
        params.set('scope', f.scope || 'all');
        if (f.institute) params.set('institute', f.institute);
        if (f.year) params.set('year', f.year);
        if (f.q) params.set('q', f.q);
        const s = await apiFetch(`/api/trends/summary?${params.toString()}`);
        setData(s);
      } catch (error) {
        console.error('데이터 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [f.scope, f.institute, f.year, f.q]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          gap: 2,
        }}
      >
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
          데이터를 불러오는 중...
        </Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          데이터를 불러올 수 없습니다.
        </Typography>
      </Box>
    );
  }

  const reportsPerYear = (data.reportsPerYear || []).slice().sort((a, b) => a.year - b.year);
  const topInstitutes = (data.reportsPerInstitute || []).slice(0, 12);
  const topKeywords = (data.topKeywords || []).slice(0, 15).map(d => ({ name: d.key, value: d.value }));

  // 통계 계산
  const totalReports = reportsPerYear.reduce((sum, item) => sum + (item.count || 0), 0);
  const totalInstitutes = (data.reportsPerInstitute || []).length;
  const totalKeywords = (data.topKeywords || []).length;
  const avgReportsPerYear = reportsPerYear.length > 0 
    ? Math.round(totalReports / reportsPerYear.length) 
    : 0;

  return (
    <Box>
      {/* 통계 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="총 보고서 수"
            value={totalReports}
            icon={DescriptionIcon}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="참여 기관 수"
            value={totalInstitutes}
            icon={BusinessIcon}
            color="#9c27b0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="키워드 수"
            value={totalKeywords}
            icon={LocalOfferIcon}
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="연평균 발행"
            value={avgReportsPerYear}
            icon={TrendingUpIcon}
            color="#388e3c"
          />
        </Grid>
      </Grid>

      {/* 차트 섹션 */}
      <Grid container spacing={3}>
        {/* 연도별 보고서 */}
        <Grid item xs={12} md={6}>
          <Fade in timeout={700}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 4,
                height: '100%',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #ffffff 0%, #fafafa 100%)',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <TrendingUpIcon sx={{ color: CHART_COLORS.primary }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  연도별 보고서 발행량
                </Typography>
              </Stack>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportsPerYear} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis
                      dataKey="year"
                      stroke="#666"
                      style={{ fontSize: '12px', fontWeight: 600 }}
                    />
                    <YAxis
                      stroke="#666"
                      style={{ fontSize: '12px', fontWeight: 600 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={3}
                      dot={{ fill: CHART_COLORS.primary, r: 5 }}
                      activeDot={{ r: 7, fill: CHART_COLORS.primary }}
                      name="발행량"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Fade>
        </Grid>

        {/* 기관별 보고서 */}
        <Grid item xs={12} md={6}>
          <Fade in timeout={900}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 4,
                height: '100%',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #ffffff 0%, #fafafa 100%)',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <BusinessIcon sx={{ color: CHART_COLORS.secondary }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  기관별 보고서 발행량 (Top 12)
                </Typography>
              </Stack>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topInstitutes}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      stroke="#666"
                      style={{ fontSize: '12px', fontWeight: 600 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="institute"
                      width={140}
                      stroke="#666"
                      style={{ fontSize: '11px', fontWeight: 600 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} name="발행량">
                      {topInstitutes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS.bars[index % CHART_COLORS.bars.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Fade>
        </Grid>

        {/* 키워드 빈도 */}
        <Grid item xs={12}>
          <Fade in timeout={1100}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 4,
                background: 'linear-gradient(145deg, #ffffff 0%, #fafafa 100%)',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <LocalOfferIcon sx={{ color: '#f57c00' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  키워드 빈도 (Top 15)
                </Typography>
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topKeywords} margin={{ top: 5, right: 10, left: 10, bottom: 80 }}>
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      stroke="#666"
                      style={{ fontSize: '11px', fontWeight: 600 }}
                    />
                    <YAxis
                      stroke="#666"
                      style={{ fontSize: '12px', fontWeight: 600 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} name="빈도">
                      {topKeywords.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS.gradient[index % CHART_COLORS.gradient.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
}
