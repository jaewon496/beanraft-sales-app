import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const __require = createRequire(import.meta.url)
const __filename_local = fileURLToPath(import.meta.url)
const __dirname_local = path.dirname(__filename_local)

// 빌드 시 sw.js의 CACHE_VERSION 자동 교체 + index.html의 __BUILD_VERSION__ 치환 플러그인
// [2026-06-01] index.html 처리 추가: 고정 캐시플래그(bc_sw_reset_v2)가 한 번 박히면
//   새 배포가 와도 옛 캐시가 남아 구버전 화면이 뜨던 버그 → 빌드마다 버전 토큰 치환으로 자동 무효화.
function swVersionPlugin() {
  return {
    name: 'sw-version-stamp',
    writeBundle() {
      // 동일 buildVersion을 sw.js와 index.html에 함께 사용 (일관성)
      const buildVersion = Date.now()

      // 1) dist/sw.js의 CACHE_VERSION 교체
      const swPath = path.resolve(__dirname_local, 'dist', 'sw.js')
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8')
        content = content.replace(
          /const CACHE_VERSION = [^;]+;/,
          `const CACHE_VERSION = ${buildVersion};`
        )
        fs.writeFileSync(swPath, content, 'utf-8')
        console.log(`[sw-version-stamp] sw.js CACHE_VERSION → ${buildVersion}`)
      }

      // 2) dist/index.html의 __BUILD_VERSION__ 토큰 치환 (배포마다 캐시 자동 무효화)
      const htmlPath = path.resolve(__dirname_local, 'dist', 'index.html')
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf-8')
        if (html.includes('__BUILD_VERSION__')) {
          html = html.split('__BUILD_VERSION__').join(String(buildVersion))
          fs.writeFileSync(htmlPath, html, 'utf-8')
          console.log(`[sw-version-stamp] index.html __BUILD_VERSION__ → ${buildVersion}`)
        }
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

// 공공데이터 Store Radius API 로컬 프록시 미들웨어 (개발 서버 전용)
// 로컬에서 /.netlify/functions/store-radius-proxy 요청을 직접 처리
function storeRadiusProxyPlugin() {
  return {
    name: 'store-radius-local-proxy',
    configureServer(server) {
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

        if (req.method !== 'GET') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // 원본 URL에서 쿼리 파라미터 추출
        const fullUrl = req.originalUrl || req.url;
        const url = new URL(fullUrl, `http://${req.headers.host}`);
        const params = Object.fromEntries(url.searchParams.entries());

        // 필수 파라미터 확인
        const { cx, cy, radius, numOfRows, pageNo, indsLclsCd, indsMclsCd } = params;
        if (!cx || !cy) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'cx, cy parameters required' }));
          return;
        }

        try {
          // 공공데이터 API 호출용 쿼리 문자열 구성
          // type=json 자동 추가
          const queryParams = new URLSearchParams({
            cx,
            cy,
            radius: radius || '1000',
            numOfRows: numOfRows || '100',
            pageNo: pageNo || '1',
            indsLclsCd: indsLclsCd || 'I2',
            indsMclsCd: indsMclsCd || 'I212',
            type: 'json',
            serviceKey: '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb'
          });

          const targetUrl = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?${queryParams}`;
          console.log('[store-radius-local] proxying:', targetUrl.substring(0, 120) + '...');

          const apiRes = await fetch(targetUrl);

          if (!apiRes.ok) {
            res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
            const errorText = await apiRes.text();
            res.end(JSON.stringify({ error: `API returned ${apiRes.status}`, detail: errorText }));
            return;
          }

          const data = await apiRes.json();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        } catch (err) {
          console.error('[store-radius-local] error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      };

      // /.netlify/functions/store-radius-proxy 경로 처리
      server.middlewares.use('/.netlify/functions/store-radius-proxy', handler);
    }
  };
}

// KOSIS API 로컬 프록시 미들웨어 (개발 서버 전용)
// 로컬에서 /.netlify/functions/kosis-proxy 요청을 직접 처리
// 통계청 KOSIS / 한국부동산원 / 국세청 / 한국은행 등 외부 통계 호출
function kosisProxyPlugin() {
  return {
    name: 'kosis-local-proxy',
    configureServer(server) {
      // .env 로드하여 KOSIS_API_KEY를 process.env에 주입 (netlify function이 process.env 참조)
      const env = loadEnv('development', process.cwd(), '');
      if (env.KOSIS_API_KEY && !process.env.KOSIS_API_KEY) {
        process.env.KOSIS_API_KEY = env.KOSIS_API_KEY;
      }

      // netlify function 핸들러를 직접 require (CommonJS)
      let handler;
      try {
        const fnPath = path.resolve(__dirname_local, 'netlify/functions/kosis-proxy.js');
        delete __require.cache[fnPath];
        handler = __require(fnPath).handler;
      } catch (e) {
        console.error('[kosis-local] failed to load kosis-proxy.js:', e.message);
      }

      server.middlewares.use('/.netlify/functions/kosis-proxy', async (req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (!handler) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'kosis-proxy handler not loaded' }));
          return;
        }

        try {
          const fullUrl = req.originalUrl || req.url;
          const url = new URL(fullUrl, `http://${req.headers.host}`);
          const queryStringParameters = Object.fromEntries(url.searchParams.entries());

          // POST body 수집 (필요 시)
          let body = '';
          if (req.method === 'POST') {
            for await (const chunk of req) body += chunk;
          }

          // Netlify Function 이벤트 객체 시뮬레이션
          const event = {
            httpMethod: req.method,
            queryStringParameters,
            headers: req.headers,
            body: body || null,
            path: url.pathname,
          };

          console.log('[kosis-local]', queryStringParameters.mode || 'no-mode', queryStringParameters.key || '');

          const result = await handler(event, {});
          const statusCode = result.statusCode || 200;
          const resHeaders = result.headers || { 'Content-Type': 'application/json' };
          res.writeHead(statusCode, resHeaders);
          res.end(result.body || '');
        } catch (err) {
          console.error('[kosis-local] error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

// Netlify Function을 직접 로드해 로컬 미들웨어로 노출하는 공통 팩토리
// 로컬 netlify/functions/*.js 의 exports.handler를 그대로 호출.
// 프로덕션 배포가 안 됐거나 다른 버전인 함수도 로컬 코드 기준으로 응답.
function netlifyFnPlugin(fnName, opts = {}) {
  const route = `/.netlify/functions/${fnName}`;
  return {
    name: `${fnName}-local-proxy`,
    configureServer(server) {
      // .env 키들을 process.env에 주입 (이미 kosis 플러그인이 처리하지만 호출 순서 보장 위해 중복 안전)
      const env = loadEnv('development', process.cwd(), '');
      const envKeys = opts.envKeys || [];
      for (const k of envKeys) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }

      let handler;
      try {
        const fnPath = path.resolve(__dirname_local, `netlify/functions/${fnName}.js`);
        delete __require.cache[fnPath];
        handler = __require(fnPath).handler;
      } catch (e) {
        console.error(`[${fnName}-local] failed to load:`, e.message);
      }

      server.middlewares.use(route, async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (!handler) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `${fnName} handler not loaded` }));
          return;
        }

        try {
          const fullUrl = req.originalUrl || req.url;
          const url = new URL(fullUrl, `http://${req.headers.host}`);
          const queryStringParameters = Object.fromEntries(url.searchParams.entries());

          let body = '';
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            for await (const chunk of req) body += chunk;
          }

          const event = {
            httpMethod: req.method,
            queryStringParameters,
            headers: req.headers,
            body: body || null,
            path: url.pathname,
          };

          const hint = queryStringParameters.api || queryStringParameters.apiName || queryStringParameters.endpoint || queryStringParameters.mode || queryStringParameters.type || '';
          console.log(`[${fnName}-local]`, req.method, hint);

          const result = await handler(event, {});
          const statusCode = result.statusCode || 200;
          const resHeaders = result.headers || { 'Content-Type': 'application/json' };
          res.writeHead(statusCode, resHeaders);
          res.end(result.body || '');
        } catch (err) {
          console.error(`[${fnName}-local] error:`, err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
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
    ncpGeoProxyPlugin(),
    storeRadiusProxyPlugin(),
    kosisProxyPlugin(),
    netlifyFnPlugin('sbiz-proxy'),
    netlifyFnPlugin('sbiz-report-proxy'),
    netlifyFnPlugin('gemini-proxy', { envKeys: ['VITE_GEMINI_API_KEY', 'GEMINI_API_KEY'] }),
    netlifyFnPlugin('nicebizmap-proxy', { envKeys: ['NICEBIZMAP_SESSION_ID'] })
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
        // 로컬 미들웨어에서 처리하는 함수들은 프록시 바이패스
        bypass(req) {
          if (req.url && req.url.startsWith('/.netlify/functions/store-radius-proxy')) {
            return req.url;
          }
          if (req.url && req.url.startsWith('/.netlify/functions/kosis-proxy')) {
            return req.url;
          }
          if (req.url && req.url.startsWith('/.netlify/functions/sbiz-proxy')) {
            return req.url;
          }
          if (req.url && req.url.startsWith('/.netlify/functions/sbiz-report-proxy')) {
            return req.url;
          }
          if (req.url && req.url.startsWith('/.netlify/functions/gemini-proxy')) {
            return req.url;
          }
          if (req.url && req.url.startsWith('/.netlify/functions/nicebizmap-proxy')) {
            return req.url;
          }
          if (req.url && req.url.startsWith('/.netlify/functions/openub-proxy')) {
            return req.url;
          }
        }
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
        rewrite: (path) => path.replace(/^\/site/, ''),
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/css': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/js': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/fonts': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/images': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/uploads': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/data': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/umember': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/uevent': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/uboard': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/uproduct': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
      },
      '/ushop': {
        target: 'https://www.beancraft.co.kr',
        changeOrigin: true,
        cookieDomainRewrite: {
          'www.beancraft.co.kr': '',
          'beancraft.co.kr': '',
          '.beancraft.co.kr': ''
        }
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
