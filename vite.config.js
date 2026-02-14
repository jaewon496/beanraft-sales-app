import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // automatic JSX 런타임 사용 (React 17+)
      jsxRuntime: 'automatic',
      // Babel 설정 명시
      babel: {
        plugins: [],
        babelrc: false,
        configFile: false
      }
    })
  ],
  build: {
    outDir: 'dist',
    // 소스맵 비활성화
    sourcemap: false,
    // 모듈 프리로드 폴리필 비활성화 (호환성 문제 방지)
    modulePreload: {
      polyfill: false
    },
    // Rollup 옵션
    rollupOptions: {
      output: {
        // 파일명에 해시 포함 (캐시 무효화)
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // 수동 청크 분할로 React 분리
        manualChunks: {
          'react-vendor': ['react', 'react-dom']
        }
      }
    },
    // 타겟 브라우저
    target: 'es2015',
    // 최소화 옵션
    minify: 'esbuild'
  },
  // 개발 서버 옵션
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/.netlify/functions': {
        target: 'https://beancraft-sales.netlify.app',
        changeOrigin: true,
        secure: true,
      },
      '/api': {
        target: 'https://beancraft-sales.netlify.app',
        changeOrigin: true,
        secure: true,
      }
    }
  },
  // 의존성 최적화
  optimizeDeps: {
    include: ['react', 'react-dom', 'firebase/compat/app', 'firebase/compat/auth', 'firebase/compat/database'],
    esbuildOptions: {
      target: 'es2015'
    }
  },
  // 환경 변수 접두사
  envPrefix: 'VITE_'
})
