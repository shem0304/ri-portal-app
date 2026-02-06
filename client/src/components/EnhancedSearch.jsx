import React from 'react';
import { Box, Stack, TextField, Select, MenuItem, InputAdornment, Paper } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

/**
 * 개선된 검색 바
 */
export function EnhancedSearchBar({ value, onChange, placeholder = '검색어 입력' }) {
  return (
    <TextField
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: 'action.active' }} />
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 3,
          backgroundColor: 'background.paper',
          transition: 'all 0.3s',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
          },
          '&.Mui-focused': {
            boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
            '& fieldset': {
              borderWidth: 2,
              borderColor: '#667eea',
            }
          }
        }
      }}
    />
  );
}

/**
 * 개선된 필터 셀렉트
 */
export function EnhancedFilterSelect({ value, onChange, options, label = '전체', icon: Icon }) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      displayEmpty
      startAdornment={
        Icon && (
          <InputAdornment position="start">
            <Icon sx={{ ml: 1, color: 'action.active' }} />
          </InputAdornment>
        )
      }
      sx={{
        minWidth: 180,
        borderRadius: 3,
        backgroundColor: 'background.paper',
        transition: 'all 0.3s',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
        },
        '&.Mui-focused': {
          boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderWidth: 2,
            borderColor: '#667eea',
          }
        }
      }}
    >
      <MenuItem value="">{label}</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}

/**
 * 검색 및 필터 컨테이너
 */
export function SearchFilterContainer({ children }) {
  return (
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
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        spacing={2}
        alignItems="stretch"
      >
        {children}
      </Stack>
    </Paper>
  );
}

export default {
  EnhancedSearchBar,
  EnhancedFilterSelect,
  SearchFilterContainer
};
