/**
 * CafeAuditLogic.js
 * 수집된 카페 데이터를 정밀 필터링하여 정확한 카페 수를 산출
 * - 하버사인 거리 필터링 (500m 이내)
 * - 상호명 유사도 기반 중복 제거
 * - 카테고리 오분류 필터
 */

import { haversineDistance } from './DataNormalizer.js';

// ═══════════════════════════════════════════════════════════════
// 문자열 유사도 (레벤슈타인 거리 기반, 0~1)
// ═══════════════════════════════════════════════════════════════
export function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const sa = a.replace(/\s/g, '').toUpperCase();
  const sb = b.replace(/\s/g, '').toUpperCase();
  if (sa === sb) return 1;
  if (sa.length === 0 || sb.length === 0) return 0;

  const lenA = sa.length;
  const lenB = sb.length;

  // 길이 차이가 극단적이면 빠르게 0 반환
  if (Math.abs(lenA - lenB) > Math.max(lenA, lenB) * 0.5) return 0;

  // 레벤슈타인 거리 (2행 DP)
  let prev = Array.from({ length: lenB + 1 }, (_, i) => i);
  let curr = new Array(lenB + 1);

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    for (let j = 1; j <= lenB; j++) {
      const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // 삭제
        curr[j - 1] + 1,   // 삽입
        prev[j - 1] + cost  // 교체
      );
    }
    [prev, curr] = [curr, prev];
  }

  const dist = prev[lenB];
  const maxLen = Math.max(lenA, lenB);
  return 1 - dist / maxLen;
}

// ═══════════════════════════════════════════════════════════════
// 거리 필터링 (하버사인 공식)
// ═══════════════════════════════════════════════════════════════
export function filterByDistance(cafes, centerLat, centerLng, radius) {
  if (!cafes || cafes.length === 0) return { inside: [], outside: [] };

  const inside = [];
  const outside = [];

  for (const cafe of cafes) {
    const lat = parseFloat(cafe.lat);
    const lng = parseFloat(cafe.lng);

    // 좌표가 없는 카페는 그대로 포함 (제외하지 않음)
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      inside.push(cafe);
      continue;
    }

    const dist = haversineDistance(centerLat, centerLng, lat, lng);
    if (dist <= radius) {
      inside.push({ ...cafe, _auditDist: dist });
    } else {
      outside.push({ ...cafe, _auditDist: dist, _excludeReason: 'distance_over_' + radius + 'm (actual: ' + dist + 'm)' });
    }
  }

  return { inside, outside };
}

// ═══════════════════════════════════════════════════════════════
// 중복 탐지 (상호명 유사도 90% + 좌표 오차 5m)
// ═══════════════════════════════════════════════════════════════
export function findDuplicates(cafes) {
  if (!cafes || cafes.length < 2) return { unique: cafes || [], duplicates: [] };

  const SIMILARITY_THRESHOLD = 0.9;
  const DISTANCE_THRESHOLD = 5; // 미터
  const duplicateIndices = new Set();
  const duplicates = [];

  for (let i = 0; i < cafes.length; i++) {
    if (duplicateIndices.has(i)) continue;

    for (let j = i + 1; j < cafes.length; j++) {
      if (duplicateIndices.has(j)) continue;

      const nameA = cafes[i].name || '';
      const nameB = cafes[j].name || '';
      const sim = stringSimilarity(nameA, nameB);

      if (sim >= SIMILARITY_THRESHOLD) {
        const latA = parseFloat(cafes[i].lat);
        const lngA = parseFloat(cafes[i].lng);
        const latB = parseFloat(cafes[j].lat);
        const lngB = parseFloat(cafes[j].lng);

        // 좌표가 둘 다 있으면 거리 체크, 하나라도 없으면 이름만으로 판단
        let coordClose = false;
        if (latA && lngA && latB && lngB) {
          const dist = haversineDistance(latA, lngA, latB, lngB);
          coordClose = dist <= DISTANCE_THRESHOLD;
        } else {
          // 좌표 없으면 이름 유사도만으로 판단 (95% 이상)
          coordClose = sim >= 0.95;
        }

        if (coordClose) {
          duplicateIndices.add(j);
          duplicates.push({
            kept: cafes[i].name,
            removed: cafes[j].name,
            similarity: Math.round(sim * 100) + '%',
            _excludeReason: 'duplicate (sim: ' + Math.round(sim * 100) + '%, name: ' + cafes[j].name + ' -> ' + cafes[i].name + ')'
          });
        }
      }
    }
  }

  const unique = cafes.filter((_, idx) => !duplicateIndices.has(idx));
  return { unique, duplicates };
}

// ═══════════════════════════════════════════════════════════════
// 카테고리 필터 (카페가 아닌 점포 제외)
// ═══════════════════════════════════════════════════════════════
const NOT_CAFE_KEYWORDS = [
  '편의점', 'CU', 'GS25', 'GS 25', '세븐일레븐', '이마트24', '미니스톱',
  '음식점', '식당', '분식', '치킨', '피자', '족발', '곱창', '삼겹살',
  '약국', '병원', '의원', '치과', '한의원', '안과', '피부과',
  '미용실', '헤어', '네일', '에스테틱',
  '세탁', '빨래', '코인워시',
  '부동산', '공인중개사',
  '마트', '슈퍼', '하나로마트',
  '주유소', '충전소',
  '노래방', '코인노래방', 'PC방', '피씨방',
  '고시원', '고시텔', '모텔', '호텔'
];

function isMisclassifiedCafe(cafe) {
  const name = (cafe.name || '').toUpperCase();
  const category = (cafe.category || cafe.categoryName || cafe.indsSclsNm || '').toUpperCase();

  // 이름이나 카테고리에 비카페 키워드가 있으면 제외
  for (const kw of NOT_CAFE_KEYWORDS) {
    const kwUpper = kw.toUpperCase();
    if (name.includes(kwUpper) || category.includes(kwUpper)) {
      // 단, "카페" 키워드도 동시에 포함하면 카페로 유지
      if (name.includes('카페') || name.includes('CAFE') || name.includes('커피') || name.includes('COFFEE')) {
        continue;
      }
      return kw; // 제외 사유 반환
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 메인 감사 함수
// ═══════════════════════════════════════════════════════════════
export function auditCafes(cafes, centerLat, centerLng, radius = 500) {
  if (!cafes || cafes.length === 0) {
    return {
      filtered: [],
      excluded: [],
      duplicates: [],
      summary: { total: 0, filtered: 0, excluded: 0, duplicateCount: 0, distanceExcluded: 0, categoryExcluded: 0 }
    };
  }

  const excluded = [];
  const totalBefore = cafes.length;

  // STEP 1: 거리 필터링
  const { inside, outside } = filterByDistance(cafes, centerLat, centerLng, radius);
  outside.forEach(c => excluded.push({ name: c.name, reason: c._excludeReason, type: 'distance' }));
  const distanceExcluded = outside.length;

  // STEP 2: 카테고리 필터
  const categoryFiltered = [];
  let categoryExcluded = 0;
  for (const cafe of inside) {
    const misclassReason = isMisclassifiedCafe(cafe);
    if (misclassReason) {
      excluded.push({ name: cafe.name, reason: 'category_mismatch: ' + misclassReason, type: 'category' });
      categoryExcluded++;
    } else {
      categoryFiltered.push(cafe);
    }
  }

  // STEP 3: 중복 제거
  const { unique, duplicates } = findDuplicates(categoryFiltered);
  duplicates.forEach(d => excluded.push({ name: d.removed, reason: d._excludeReason, type: 'duplicate' }));

  const filtered = unique;

  const summary = {
    total: totalBefore,
    filtered: filtered.length,
    excluded: excluded.length,
    duplicateCount: duplicates.length,
    distanceExcluded,
    categoryExcluded
  };

  return { filtered, excluded, duplicates, summary };
}
