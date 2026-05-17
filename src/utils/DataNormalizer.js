/**
 * DataNormalizer.js
 * API별 상이한 필드명/단위를 앱 표준 규격으로 변환
 */

// ─── 필드명 정규화 맵 ───
// 각 API 소스별로 표준 필드명에 대응하는 원본 필드명
const FIELD_MAP = {
  // 소상공인365 simpleAnls
  simpleAnls: {
    monthlySales: 'mthSalAmt',        // 월 매출액 (천원 단위 → 원 변환 필요)
    floatingPopulation: 'ftPplCnt',    // 유동인구
    residentPopulation: 'rsdPplCnt',   // 주거인구
    businessCount: 'storCnt',          // 업소 수
    openCount: 'opnCnt',              // 개업 수
    closeCount: 'clsCnt',             // 폐업 수
    districtName: 'guNm',             // 구 이름
    dongName: 'dongNm',              // 동 이름
    analysisNumber: 'analyNo',        // 분석 번호
  },
  // 나이스비즈맵
  nicebizmap: {
    monthlySales: 'monthAvgAmt',       // 월 평균 매출
    dailySales: 'dayAvgAmt',          // 일 평균 매출
    transactionCount: 'monthTrsCnt',   // 월 거래 건수
    averagePrice: 'avgPrice',          // 평균 결제 단가
    topMenu: 'risingMenuNm',          // 인기 메뉴명
  },
  // 오픈업
  openub: {
    monthlySales: 'monthlySales',
    dailySales: 'dailySales',
    weekdaySales: 'weekdaySales',
    weekendSales: 'weekendSales',
  },
  // 카카오
  kakao: {
    placeName: 'place_name',
    address: 'address_name',
    roadAddress: 'road_address_name',
    lat: 'y',
    lng: 'x',
    phone: 'phone',
    category: 'category_name',
    placeUrl: 'place_url',
  },
  // 공공데이터 storeRadius
  storeRadius: {
    storeName: 'bizesNm',
    address: 'lnoAdr',
    roadAddress: 'rdnmAdr',
    category: 'indsLclsNm',
    subCategory: 'indsMclsNm',
    detailCategory: 'indsSclsNm',
    lat: 'lat',
    lng: 'lon',
  },
};

/**
 * 소상공인365 간단분석(simpleAnls) 데이터 정규화
 * - mthSalAmt: 천원 단위 → 원(KRW) 변환
 * - 모든 숫자 Math.round() 적용
 */
export function normalizeSimpleAnls(rawData) {
  if (!rawData) return null;

  const result = {};

  // avgAmt (평균 매출) 정규화
  if (rawData.avgAmt) {
    result.avgAmt = {};
    for (const [key, value] of Object.entries(rawData.avgAmt)) {
      if (key === 'mthSalAmt' && typeof value === 'number') {
        // 천원 단위 → 원 변환
        result.avgAmt[key] = Math.round(value * 1000);
      } else if (typeof value === 'number') {
        result.avgAmt[key] = Math.round(value);
      } else {
        result.avgAmt[key] = value;
      }
    }
  }

  // population (유동인구) 정규화
  if (rawData.population) {
    result.population = {};
    for (const [key, value] of Object.entries(rawData.population)) {
      if (typeof value === 'number') {
        result.population[key] = Math.round(value);
      } else {
        result.population[key] = value;
      }
    }
  }

  return result;
}

/**
 * 나이스비즈맵 데이터 정규화
 * - 모든 금액 정수 처리
 */
export function normalizeNicebizmap(rawData) {
  if (!rawData) return null;

  const result = {};

  for (const [dongCd, dongData] of Object.entries(rawData)) {
    result[dongCd] = {};
    for (const [key, value] of Object.entries(dongData)) {
      if (typeof value === 'number') {
        result[dongCd][key] = Math.round(value);
      } else if (Array.isArray(value)) {
        result[dongCd][key] = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            const normalized = {};
            for (const [k, v] of Object.entries(item)) {
              normalized[k] = typeof v === 'number' ? Math.round(v) : v;
            }
            return normalized;
          }
          return item;
        });
      } else {
        result[dongCd][key] = value;
      }
    }
  }

  return result;
}

/**
 * 하버사인 공식: 두 좌표 간 거리 계산 (미터 단위)
 * d = 2r * arcsin(sqrt(sin^2(dphi/2) + cos(phi1)*cos(phi2)*sin^2(dlambda/2)))
 *
 * @param {number} lat1 - 위도1
 * @param {number} lng1 - 경도1
 * @param {number} lat2 - 위도2
 * @param {number} lng2 - 경도2
 * @returns {number} 거리 (미터)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 지구 반지름 (미터)
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.asin(Math.sqrt(a));

  return Math.round(R * c);
}

/**
 * 배달 수익성 산식
 * NetProfit = (Revenue x 0.932) - (DeliveryCount x 4000)
 * 0.932 = 배달앱 수수료 6.8% 공제
 * 4000 = 건당 배달비 추정
 *
 * @param {number} revenue - 배달 매출액 (원)
 * @param {number} deliveryCount - 배달 건수
 * @returns {number} 순이익 (원)
 */
export function calculateNetProfit(revenue, deliveryCount) {
  if (typeof revenue !== 'number' || typeof deliveryCount !== 'number') return 0;
  return Math.round((revenue * 0.932) - (deliveryCount * 4000));
}

/**
 * 한글 금액 변환
 * 180000000 → "1억 8,000만원"
 * 79150000  → "7,915만원"
 * 5000      → "5,000원"
 *
 * @param {number} number - 변환할 숫자 (원 단위)
 * @returns {string} 한글 금액 문자열
 */
export function toKoreanUnit(number) {
  if (typeof number !== 'number' || isNaN(number)) return '0원';

  const absNum = Math.abs(number);
  const sign = number < 0 ? '-' : '';

  if (absNum >= 100000000) {
    // 억 단위
    const eok = Math.floor(absNum / 100000000);
    const man = Math.floor((absNum % 100000000) / 10000);
    if (man > 0) {
      return `${sign}${eok}억 ${man.toLocaleString()}만원`;
    }
    return `${sign}${eok}억원`;
  }

  if (absNum >= 10000) {
    // 만 단위
    const man = Math.floor(absNum / 10000);
    return `${sign}${man.toLocaleString()}만원`;
  }

  // 만 미만
  return `${sign}${absNum.toLocaleString()}원`;
}

/**
 * 필드명 표준화
 * API 응답의 원본 필드명을 앱 표준 필드명으로 변환
 *
 * @param {object} data - API 원본 데이터
 * @param {string} sourceType - 소스 타입 ('simpleAnls' | 'nicebizmap' | 'openub' | 'kakao' | 'storeRadius')
 * @returns {object} 표준 필드명으로 변환된 데이터
 */
export function normalizeFieldNames(data, sourceType) {
  if (!data || !sourceType || !FIELD_MAP[sourceType]) return data;

  const map = FIELD_MAP[sourceType];
  const result = {};

  // 표준명 → 원본명 매핑의 역방향: 원본명 → 표준명
  const reverseMap = {};
  for (const [standardName, originalName] of Object.entries(map)) {
    reverseMap[originalName] = standardName;
  }

  for (const [key, value] of Object.entries(data)) {
    const standardKey = reverseMap[key] || key;
    result[standardKey] = value;
  }

  return result;
}

// FIELD_MAP export (외부 참조용)
export { FIELD_MAP };
