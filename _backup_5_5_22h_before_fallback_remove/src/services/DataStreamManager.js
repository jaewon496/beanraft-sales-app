/**
 * DataStreamManager.js
 * 모든 API 호출 통합 관리 + 장애 대응 (Plan A/B/C)
 *
 * Plan A: 실시간 API 호출 (5초 타임아웃)
 * Plan B: localStorage 캐시에서 마지막 성공 데이터 로드
 * Plan C: standard_gangnam.json 표준 스켈레톤 반환
 */

import standardGangnam from '../assets/data/standard_gangnam.json';

// ─── API 엔드포인트 정의 ───
const API_ENDPOINTS = {
  // 카카오 그룹
  kakaoKeyword: (query, size = 15) =>
    `/.netlify/functions/kakao-proxy?type=keyword&query=${encodeURIComponent(query)}&size=${size}`,

  // 소상공인365 그룹
  storeRadius: (lng, lat, radius = 550) =>
    `/.netlify/functions/store-radius-proxy?cx=${lng}&cy=${lat}&radius=${radius}&numOfRows=500&pageNo=1&indsLclsCd=I2&indsMclsCd=I212`,
  simpleAnls: (dongCd, simpleLoc) =>
    `/.netlify/functions/sbiz-proxy?api=simpleAnls&dongCd=${dongCd}&simpleLoc=${simpleLoc}`,

  // 나이스비즈맵 그룹
  nicebizmap: () => '/.netlify/functions/nicebizmap-proxy',

  // 오픈업 그룹
  openubSales: () => '/.netlify/functions/openub-sales-proxy',

  // Gemini 그룹
  gemini: () => '/.netlify/functions/gemini-proxy',

  // 네이버 그룹
  naverArticle: (cortarNo, lat, lon, page = 1) =>
    `/.netlify/functions/naver-proxy?type=article&cortarNo=${cortarNo}&lat=${lat}&lon=${lon}&z=14&page=${page}`,
  naverDetail: (articleId) =>
    `/.netlify/functions/naver-proxy?type=detail&articleId=${articleId}`,
};

// ─── 캐시 키 프리픽스 ───
const CACHE_PREFIX = 'dsm_cache_';

/**
 * 개별 API 호출 + Plan B(캐시) + Plan C(표준 데이터) 폴백
 * @param {string} url - 요청 URL
 * @param {string} cacheKey - 캐시 식별 키
 * @param {number} timeout - 타임아웃 (ms), 기본 5000
 * @param {object} options - fetch 옵션 (method, body, headers 등)
 * @returns {Promise<{sourceId: string, timestamp: number, data: any, source: string}>}
 */
export async function fetchWithFallback(url, cacheKey, timeout = 5000, options = {}) {
  const fullCacheKey = CACHE_PREFIX + cacheKey;

  // Plan A: 실시간 API 호출
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const fetchOptions = {
      ...options,
      signal: controller.signal,
    };

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // 성공 시 캐시 저장
    try {
      localStorage.setItem(fullCacheKey, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (e) {
      // localStorage 용량 초과 등 무시
    }

    return {
      sourceId: cacheKey,
      timestamp: Date.now(),
      data,
      source: 'live',
    };
  } catch (err) {
    // Plan A 실패 로그
    console.warn(`[DataStreamManager] Plan A 실패 (${cacheKey}):`, err.message);
  }

  // Plan B: localStorage 캐시
  try {
    const cached = localStorage.getItem(fullCacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      console.warn(`[DataStreamManager] Plan B 적용 (${cacheKey}): 캐시 사용 (${new Date(parsed.timestamp).toLocaleString()})`);
      return {
        sourceId: cacheKey,
        timestamp: parsed.timestamp,
        data: parsed.data,
        source: 'cache',
      };
    }
  } catch (e) {
    // 캐시 파싱 실패
  }

  // Plan C: 표준 데이터
  console.warn(`[DataStreamManager] Plan C 적용 (${cacheKey}): 표준 데이터 로드`);
  return {
    sourceId: cacheKey,
    timestamp: Date.now(),
    data: standardGangnam,
    source: 'fallback',
  };
}

/**
 * 전체 API 병렬 호출 후 통합 결과 반환
 * Promise.allSettled로 하나 실패해도 나머지는 정상 반환
 *
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radius - 반경 (미터), 기본 550
 * @returns {Promise<object>} - 그룹별 API 응답 통합 객체
 */
export async function fetchAllData(lat, lng, radius = 550) {
  const locationKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;

  // API 호출 그룹 정의
  const apiCalls = [
    {
      key: 'storeRadius',
      promise: fetchWithFallback(
        API_ENDPOINTS.storeRadius(lng, lat, radius),
        `storeRadius_${locationKey}`,
        5000
      ),
    },
    {
      key: 'kakaoKeyword',
      promise: fetchWithFallback(
        API_ENDPOINTS.kakaoKeyword('카페', 15),
        `kakao_keyword_${locationKey}`,
        5000
      ),
    },
  ];

  // Promise.allSettled: 하나 실패해도 나머지 정상 반환
  const results = await Promise.allSettled(apiCalls.map(c => c.promise));

  const output = {};
  results.forEach((result, idx) => {
    const { key } = apiCalls[idx];
    if (result.status === 'fulfilled') {
      output[key] = result.value;
    } else {
      console.warn(`[DataStreamManager] ${key} 최종 실패:`, result.reason);
      output[key] = {
        sourceId: key,
        timestamp: Date.now(),
        data: null,
        source: 'error',
        error: result.reason?.message || 'Unknown error',
      };
    }
  });

  return output;
}

/**
 * 캐시 초기화
 * @param {string} [specificKey] - 특정 키만 삭제. 미지정 시 전체 DSM 캐시 삭제
 */
export function clearCache(specificKey) {
  if (specificKey) {
    localStorage.removeItem(CACHE_PREFIX + specificKey);
    return;
  }

  // 전체 DSM 캐시 삭제
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  console.log(`[DataStreamManager] 캐시 ${keysToRemove.length}건 삭제 완료`);
}

// API 엔드포인트 맵 export (외부에서 URL 빌드 시 사용 가능)
export { API_ENDPOINTS };
