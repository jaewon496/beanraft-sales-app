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

// ─── 캐시 제외 목록 (검색마다 라이브 호출, 응답 큰 것) ───
// kosisExternal: 13종 응답 수 MB. 검색마다 라이브 호출하므로 캐시 불필요. localStorage quota 보호.
const CACHE_EXCLUDE_PREFIXES = ['kosisExternal', 'kosis_external', 'kosisAll'];

// ─── 캐시 TTL (오래된 캐시는 무시하고 새로 호출) ───
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

/**
 * URL을 짧은 해시 문자열로 변환 (캐시 키 좌표 구분용)
 * 호출 URL에 좌표/dongCd가 들어 있으므로, URL 해시를 캐시 키에 붙이면
 * 같은 cacheKey라도 좌표가 다르면 다른 캐시 슬롯을 쓰게 된다.
 */
function hashUrl(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * 응답 데이터가 의미있는 값인지 판정 (빈 응답 캐시 고착 방지)
 * strict 검증 금지 (원칙 9): 키가 하나라도 의미있게 있으면 정상으로 본다.
 * 진짜 빈 것(null/undefined/빈 배열/빈 객체)만 false.
 */
function isMeaningfulData(data) {
  if (data === null || data === undefined) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') return Object.keys(data).length > 0;
  // 원시값(문자열/숫자/불리언)은 의미있는 값으로 본다
  return true;
}

/**
 * 개별 API 호출 + Plan B(캐시) + Plan C(표준 데이터) 폴백
 * @param {string} url - 요청 URL
 * @param {string} cacheKey - 캐시 식별 키
 * @param {number} timeout - 타임아웃 (ms), 기본 5000
 * @param {object} options - fetch 옵션 (method, body, headers 등)
 * @returns {Promise<{sourceId: string, timestamp: number, data: any, source: string}>}
 */
export async function fetchWithFallback(url, cacheKey, timeout = 5000, options = {}) {
  // 캐시 키에 URL+body 해시를 붙여 좌표/파라미터별로 분리.
  // 같은 cacheKey('storeRadius' 등)라도 좌표가 다르면 다른 캐시 슬롯 사용 →
  // 이전 지역 캐시가 새 지역 검색에 잘못 재사용되는 문제 차단.
  const keyMaterial = url + (options && options.body ? '|' + options.body : '');
  const fullCacheKey = CACHE_PREFIX + cacheKey + '_' + hashUrl(keyMaterial);

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

    // 성공 시 캐시 저장 (제외 목록은 건너뜀)
    // 빈 응답(빈 배열/빈 객체/null)은 캐시에 저장하지 않는다.
    // 토큰 만료 직전·한도 차감·네트워크 일시 오류로 빈 응답이 와도
    // 그것을 캐시에 박아두면 이후 같은 좌표 호출이 영구히 빈 응답으로 고착된다.
    const isExcluded = CACHE_EXCLUDE_PREFIXES.some(prefix => cacheKey.startsWith(prefix));
    if (!isExcluded) {
      if (isMeaningfulData(data)) {
        try {
          localStorage.setItem(fullCacheKey, JSON.stringify({
            data,
            timestamp: Date.now(),
          }));
        } catch (e) {
          // localStorage 용량 초과 등 무시
        }
      } else {
        console.warn(`[DataStreamManager] 빈 응답 - 캐시 저장 안 함 (${cacheKey})`);
      }
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
      const age = Date.now() - (parsed.timestamp || 0);
      // TTL 초과 캐시는 폐기 → Plan C로
      if (age > CACHE_TTL_MS) {
        console.warn(`[DataStreamManager] 캐시 만료 (${cacheKey}): ${Math.round(age / 60000)}분 경과 - 폐기`);
        localStorage.removeItem(fullCacheKey);
      } else if (!isMeaningfulData(parsed.data)) {
        // 캐시된 값이 비어 있으면 캐시 미스로 처리 (빈 응답 고착 방지)
        console.warn(`[DataStreamManager] 캐시 값이 빈 응답 (${cacheKey}) - 폐기`);
        localStorage.removeItem(fullCacheKey);
      } else {
        console.warn(`[DataStreamManager] Plan B 적용 (${cacheKey}): 캐시 사용 (${new Date(parsed.timestamp).toLocaleString()})`);
        return {
          sourceId: cacheKey,
          timestamp: parsed.timestamp,
          data: parsed.data,
          source: 'cache',
        };
      }
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
  // specificKey 지정 시: 해당 cacheKey로 시작하는 모든 슬롯 삭제.
  // 캐시 키에 URL 해시 접미사가 붙으므로 정확 일치가 아닌 접두사 매칭으로 삭제한다.
  const matchPrefix = specificKey ? (CACHE_PREFIX + specificKey) : CACHE_PREFIX;
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(matchPrefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  console.log(`[DataStreamManager] 캐시 ${keysToRemove.length}건 삭제 완료`);
}

// API 엔드포인트 맵 export (외부에서 URL 빌드 시 사용 가능)
export { API_ENDPOINTS };
