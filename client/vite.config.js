import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages(프로젝트 페이지) 배포 경로
// https://shem0304.github.io/ri-portal-app/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    plugins: [react()],
    //base: '/ri-portal-app/',
    base: '/',

    // ✅ 개발 서버(vite dev)에서만 /api -> 로컬 백엔드로 프록시
    server: isDev
      ? {
          proxy: {
            '/api': {
              target: 'http://localhost:5175',
              changeOrigin: true,
              // 필요하면 아래 주석 해제해서 경로 가공도 가능
              // rewrite: (path) => path.replace(/^\/api/, '/api'),
            },
          },
        }
      : undefined,

    // ✅ vite preview(빌드 결과 로컬 확인)에서도 프록시가 필요하면 사용
    preview: {
      proxy: {
        '/api': {
          target: 'http://localhost:5175',
          changeOrigin: true,
        },
      },
    },
  }
})
