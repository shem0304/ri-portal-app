import React from 'react';
import { Card, CardContent, Stack, Link, Fade, Box, Typography, Chip } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/**
 * 개선된 연구기관 카드 컴포넌트
 * InstitutesPage에서 사용
 */
export function EnhancedInstituteCard({ name, region, group, url, scope }) {
  const scopeLabel = scope === 'local' ? '지자체' : scope === 'national' ? '정부출연' : '';
  const normGroup = group ? String(group).toUpperCase() : '';
  const leftLabel = scope === 'national' ? (normGroup || '') : (region || '전체');
  
  return (
    <Fade in timeout={300}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 3,
          height: 200,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '2px solid',
          borderColor: 'divider',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: scope === 'local' 
              ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
              : 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
            transform: 'scaleX(0)',
            transformOrigin: 'left',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          '&:hover': {
            transform: 'translateY(-8px)',
            boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
            borderColor: scope === 'local' ? '#667eea' : '#f093fb',
            '&::before': {
              transform: 'scaleX(1)',
            }
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
                  height: 26,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  '& .MuiChip-icon': {
                    color: 'white',
                  }
                }}
              />
            ) : (
              <Chip
                icon={<BusinessIcon sx={{ fontSize: 16 }} />}
                label={leftLabel}
                size="small"
                sx={{ 
                  height: 26,
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  '& .MuiChip-icon': {
                    color: 'white',
                  }
                }}
              />
            )}
            <Chip
              label={scopeLabel}
              size="small"
              sx={{ 
                height: 26, 
                fontWeight: 600,
                borderWidth: 2,
                borderColor: scope === 'local' ? '#667eea' : '#f093fb',
              }}
              variant="outlined"
            />
          </Stack>

          {/* 기관명 */}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
            <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: '1.1rem',
                }}
              >
                {name}
              </Typography>
          </Box>

          {/* 하단 링크 */}
          {url && (
            <Link
              href={url}
              target="_blank"
              rel="noreferrer"
              underline="none"
              sx={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <Stack 
              direction="row" 
              spacing={0.5} 
              alignItems="center" 
              sx={{ 
                color: scope === 'local' ? '#667eea' : '#f093fb',
                transition: 'transform 0.3s',
                '&:hover': {
                  transform: 'translateX(4px)',
                }
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                홈페이지 방문
              </Typography>
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </Stack>
            </Link>
          )}
        </CardContent>
      </Card>
    </Fade>
  );
}

/**
 * 개선된 뉴스 카드 컴포넌트
 */
export function EnhancedNewsCard({ title, link, index }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
          transform: 'scaleY(0)',
          transformOrigin: 'top',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        '&:hover': {
          backgroundColor: 'rgba(102, 126, 234, 0.04)',
          transform: 'translateX(8px)',
          borderColor: '#667eea',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
          '&::before': {
            transform: 'scaleY(1)',
          }
        },
      }}
      onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
    >
      <CardContent sx={{ py: 2, px: 3 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            sx={{
              minWidth: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: 2,
              fontWeight: 800,
              fontSize: '0.875rem',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            }}
          >
            {index + 1}
          </Box>
          <Typography
            sx={{
              fontWeight: 600,
              flex: 1,
              fontSize: '0.95rem',
              lineHeight: 1.6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {title}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default {
  EnhancedInstituteCard,
  EnhancedNewsCard
};
