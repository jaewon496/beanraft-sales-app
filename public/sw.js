/**
 * 빈크래프트 Service Worker v2
 * - 앱 설치(A2HS) 지원
 * - 오프라인 폴백
 * - JS/HTML/CSS: 네트워크 우선 (Network First) → 캐시 폴백
 * - 이미지/폰트: 캐시 우선 (Cache First) → 네트워크 폴백
 * - API: 네트워크만 (No Cache)
 *
 * CACHE_VERSION: 빌드 시 vite 플러그인이 자동 교체함.
 *   수동 배포 시에는 아래 숫자를 올리면 구버전 캐시가 삭제됨.
 */

const CACHE_VERSION = 2; // ← 빌드 시 자동 교체됨 (vite plugin)
const CACHE_NAME = 'beancraft-v' + CACHE_VERSION;
const OFFLINE_URL = '/offline.html';

// 프리캐시 대상 (정적 셸)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/logo.png',
  '/offline.html'
];

// ─── 유틸: 요청 유형 판별 ─────────────────────────────
function isNavigationOrDocument(request) {
  return request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html');
}

function isCodeAsset(url) {
  return /\.(js|css|mjs)(\?|$)/.test(url.pathname);
}

function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|otf)(\?|$)/.test(url.pathname);
}

function isApiRequest(url) {
  return url.pathname.startsWith('/.netlify/') ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('naver') ||
    url.hostname.includes('gemini');
}

// ─── Install: 프리캐시 + skipWaiting ──────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Install — cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache partial fail:', err);
      });
    })
  );
  // 새 SW를 즉시 활성화 (대기 건너뜀)
  self.skipWaiting();
});

// ─── Activate: 구버전 캐시 전부 삭제 + claim ──────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate — purging old caches');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // 모든 열린 탭에 즉시 새 SW 적용
      return self.clients.claim();
    })
  );
});

// ─── Fetch: 유형별 캐싱 전략 ──────────────────────────
self.addEventListener('fetch', (event) => {
  // GET 이외 무시
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1) API 요청 → 네트워크만 (캐시 안 함)
  if (isApiRequest(url)) {
    return; // 브라우저 기본 fetch로 위임
  }

  // 2) 이미지/폰트 → 캐시 우선 (Cache First)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 3) HTML, JS, CSS → 네트워크 우선 (Network First)
  //    Vite 빌드 JS에 해시가 있지만, index.html이 구 캐시면 구 해시 JS를 요청하게 됨
  //    따라서 HTML과 JS 모두 네트워크 우선이어야 React #310 방지
  event.respondWith(networkFirst(event.request));
});

// ─── 전략: Network First ──────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // 정상 응답이면 캐시 갱신
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // 네트워크 실패 → 캐시 폴백
    const cached = await caches.match(request);
    if (cached) return cached;

    // HTML 요청이면 오프라인 페이지
    if (isNavigationOrDocument(request)) {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// ─── 전략: Cache First ────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// ─── Push 알림 (추후 확장) ────────────────────────────
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title || '빈크래프트', {
      body: data.body || '',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      vibrate: [200, 100, 200],
      data: data.url ? { url: data.url } : {}
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
