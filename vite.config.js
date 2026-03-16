import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import https from 'https'

// 빌드 시 sw.js의 CACHE_VERSION을 타임스탬프로 자동 교체하는 플러그인
function swVersionPlugin() {
  return {
    name: 'sw-version-stamp',
    writeBundle() {
      const swPath = path.resolve(__dirname, 'dist', 'sw.js')
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8')
        const buildVersion = Date.now()
        content = content.replace(
          /const CACHE_VERSION = \d+;/,
          `const CACHE_VERSION = ${buildVersion};`
        )
        fs.writeFileSync(swPath, content, 'utf-8')
        console.log(`[sw-version-stamp] CACHE_VERSION → ${buildVersion}`)
      }
    }
  }
}

// OpenUB API 로컬 프록시 미들웨어 (개발 서버 전용)
// Netlify Functions가 없는 로컬 환경에서 openub-proxy를 직접 처리
function openubProxyPlugin() {
  const ALLOWED_ENDPOINTS = ['bd/hash', 'gp', 'bd/sales'];

  return {
    name: 'openub-local-proxy',
    configureServer(server) {
      server.middlewares.use('/.netlify/functions/openub-proxy', async (req, res, next) => {
        // OPTIONS (CORS preflight)
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          });
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // POST body 읽기
        let rawBody = '';
        for await (const chunk of req) {
          rawBody += chunk;
        }

        try {
          const { endpoint, body } = JSON.parse(rawBody);

          if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Endpoint not allowed: ${endpoint}` }));
            return;
          }

          const apiRes = await fetch(`https://api.openub.com/v2/${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept-Encoding': 'gzip, br',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Origin': 'https://openub.com',
              'Referer': 'https://openub.com/'
            },
            body: JSON.stringify(body)
          });

          if (!apiRes.ok) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'api_error',
              status: apiRes.status,
              message: `OpenUB API returned ${apiRes.status}`
            }));
            return;
          }

          const data = await apiRes.json();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        } catch (err) {
          console.warn('OpenUB local proxy error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

// NCP Geocoding/Reverse/Directions API 로컬 프록시 미들웨어 (개발 서버 전용)
// 로컬에서 /.netlify/functions/ncp-geo-proxy 및 /api/ncp-geo-proxy 요청을 직접 처리
function ncpGeoProxyPlugin() {
  return {
    name: 'ncp-geo-local-proxy',
    configureServer(server) {
      // .env 파일에서 환경변수를 명시적으로 로드 (process.env에 없을 수 있음)
      const env = loadEnv('development', process.cwd(), '');
      const ncpClientId = env.NCP_CLIENT_ID || env.VITE_NCP_CLIENT_ID || process.env.NCP_CLIENT_ID || process.env.VITE_NCP_CLIENT_ID;
      const ncpClientSecret = env.NCP_CLIENT_SECRET || env.VITE_NCP_CLIENT_SECRET || process.env.NCP_CLIENT_SECRET || process.env.VITE_NCP_CLIENT_SECRET;

      const handler = async (req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        // connect가 mount path를 제거하므로, req.originalUrl에서 전체 URL을 복원
        const fullUrl = req.originalUrl || req.url;
        const url = new URL(fullUrl, `http://${req.headers.host}`);
        const params = Object.fromEntries(url.searchParams.entries());
        const { type, query, start, goal, waypoints, option } = params;

        const clientId = ncpClientId;
        const clientSecret = ncpClientSecret;

        if (!clientId || !clientSecret) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'NCP API keys not configured' }));
          return;
        }

        try {
          let targetUrl;

          if (type === 'directions' || type === 'driving') {
            if (!start || !goal) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'start, goal required' }));
              return;
            }
            targetUrl = `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${start}&goal=${goal}&option=${option || 'trafast'}`;
            if (waypoints) {
              targetUrl += `&waypoints=${decodeURIComponent(waypoints)}`;
            }
          } else if (type === 'reverse') {
            const coords = params.coords;
            const output = params.output || 'json';
            const orders = params.orders || 'legalcode';
            if (!coords) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'coords required (lng,lat)' }));
              return;
            }
            targetUrl = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${coords}&output=${output}&orders=${orders}`;
          } else {
            if (!query) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'query required' }));
              return;
            }
            targetUrl = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`;
          }

          console.log('[ncp-geo-local]', type || 'geocode', targetUrl.substring(0, 120));

          const data = await new Promise((resolve, reject) => {
            const r = https.get(targetUrl, {
              headers: {
                'X-NCP-APIGW-API-KEY-ID': clientId,
                'X-NCP-APIGW-API-KEY': clientSecret
              },
              timeout: 10000
            }, (response) => {
              let body = '';
              response.on('data', chunk => body += chunk);
              response.on('end', () => {
                try {
                  resolve({ status: response.statusCode, data: JSON.parse(body) });
                } catch (e) {
                  resolve({ status: response.statusCode, data: body });
                }
              });
            });
            r.on('error', reject);
            r.on('timeout', () => { r.destroy(); reject(new Error('NCP API timeout')); });
          });

          res.writeHead(data.status === 200 ? 200 : data.status);
          res.end(JSON.stringify(data.status === 200 ? data.data : { error: `NCP API error: ${data.status}`, detail: data.data }));
        } catch (err) {
          console.error('[ncp-geo-local] error:', err.message);
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      };

      // /api/ncp-geo-proxy 경로 처리 (프론트엔드에서 사용)
      server.middlewares.use('/api/ncp-geo-proxy', handler);
      // /.netlify/functions/ncp-geo-proxy 경로도 처리
      server.middlewares.use('/.netlify/functions/ncp-geo-proxy', handler);
    }
  };
}

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
    }),
    swVersionPlugin(),
    openubProxyPlugin(),
    ncpGeoProxyPlugin()
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
        // ncp-geo-proxy는 로컬 미들웨어에서 처리하므로 프록시 바이패스
        bypass(req) {
          if (req.url && req.url.startsWith('/api/ncp-geo-proxy')) {
            return req.url;
          }
        }
      },
      '/site': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/site/, '')
      },
      '/css': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true
      },
      '/js': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true
      },
      '/fonts': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true
      },
      '/images': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true
      },
      '/uploads': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true
      },
      '/data': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true
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
