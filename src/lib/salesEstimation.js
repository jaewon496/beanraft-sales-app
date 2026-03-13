/**
 * Multi-Layer Cafe Sales Estimation Engine
 *
 * Layers (ordered by accuracy):
 * L1: Single-cafe building -> direct monthSales from OpenUB (95% confidence)
 * L2: Multi-store building -> Zipf distribution from OpenUB (93% confidence)
 * L3: Franchise brand match -> dampened brand average (90% confidence)
 * L4: Independent cafe -> feature-based proxy (85% confidence)
 *
 * L1 and L2 require OpenUB building data (optional, no auth needed).
 * L3 and L4 always work with existing data.
 *
 * Overall target: ~90% weighted accuracy
 */
import { canUseMLRegression, buildMLFeatures, mlEstimateL4, extractTimes7 } from './mlRegression';

// Cafe archetype day-of-week pattern (Mon-Sun, sum=1.0)
// Lower Monday, steady weekdays, higher weekends
const CAFE_ARCHETYPE_PATTERN = [0.125, 0.135, 0.14, 0.14, 0.145, 0.165, 0.15];

function patternSimilarity(patternA, patternB) {
  if (!patternA || !patternB || patternA.length < 7 || patternB.length < 7) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < 7; i++) {
    dotProduct += patternA[i] * patternB[i];
    normA += patternA[i] * patternA[i];
    normB += patternB[i] * patternB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizePattern(arr) {
  if (!arr || arr.length < 7) return null;
  const sum = arr.reduce((s, v) => s + (v || 0), 0);
  if (sum === 0) return null;
  return arr.map(v => (v || 0) / sum);
}

// ═══════════════════════════════════════════════════════════════
// Zipf Distribution (L2)
// ═══════════════════════════════════════════════════════════════

/**
 * Zipf distribution for multi-store buildings.
 *
 * Given total building sales and N stores, estimate individual store sales
 * by ranking stores and applying Zipf's law:
 *   store_k_sales = total * (1/k^s) / sum(1/i^s for i=1..n)
 *   where s ~ 0.8 for retail
 *
 * Category weights for ranking (higher = likely higher revenue):
 */
const CATEGORY_WEIGHTS = {
  'A0': 6,  // 음식점 (restaurant)
  'B0': 5,  // 카페/음료 (cafe/beverage)
  'C0': 4,  // 소매 (retail)
  'D0': 3,  // 서비스 (service)
  'F0': 2,  // 의료 (medical)
  'G0': 1,  // 기타 (other)
};

const ZIPF_EXPONENT = 0.8; // Standard retail Zipf exponent


const CAFE_NAME_KEYWORDS = [
  '커피', '카페', 'cafe', 'coffee',
  '메가', '컴포즈', '빽다방', '더벤티', '이디야', '투썸', '할리스',
  '스타벅스', '폴바셋', '매머드', '감성', '만랩', '블루보틀',
  '카페베네', '탐앤탐스', '파스쿠찌', '하삼동', '앤제리너스',
  '드롭탑', '토프레소', '전광수', 'starbucks', 'ediya', 'mega',
  '라떼', '에스프레소', '로스터', 'roast', 'brew'
];

function isCafeByName(storeNm) {
  if (!storeNm) return false;
  const lower = storeNm.toLowerCase();
  return CAFE_NAME_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Apply Zipf distribution to estimate individual store sales from building total.
 *
 * @param {Object} buildingSales - from bd/sales: { monthSales, stores, data }
 * @param {Object} targetCafe - { name, addr, brand, isFranchise }
 * @returns {number|null} Estimated monthly sales in 만원, or null if not estimable
 */
function zipfDistribution(buildingSales, targetCafe) {
  if (!buildingSales || !buildingSales.stores || buildingSales.stores.length === 0) {
    return null;
  }

  const stores = buildingSales.stores;
  const rawTotalSales = buildingSales.monthSales || 0;
  if (rawTotalSales <= 0) return null;

  // ── L2 Improvement 1: A12 Category Separation ──
  // Use cafe-only (A12/B0) sales when available to avoid non-cafe inflation
  let totalSales = rawTotalSales;
  const A12_DAMPENING = 0.6;

  const cafeStoresInBuilding = stores.filter(s => {
    const cat = s.category?.bg || s.category?.sm || '';
    return cat === 'A12' || cat === 'B0' || isCafeByName(s.storeNm);
  });

  if (cafeStoresInBuilding.length > 0 && cafeStoresInBuilding.length < stores.length) {
    // Mixed building: cafes + non-cafes
    const cafeStoreSalesSum = cafeStoresInBuilding.reduce((sum, s) => sum + (s.monthSales || 0), 0);
    if (cafeStoreSalesSum > 0) {
      // Per-store sales available: use cafe-only total
      totalSales = cafeStoreSalesSum;
      console.warn('[L2] A12 cafe filter: total ' + rawTotalSales + ' -> cafe-only ' + totalSales + ' (' + cafeStoresInBuilding.length + '/' + stores.length + ' stores)');
    } else {
      // No per-store breakdown: dampen total by 0.6x
      totalSales = Math.round(rawTotalSales * A12_DAMPENING);
      console.warn('[L2] A12 data unavailable, dampening: ' + rawTotalSales + ' x' + A12_DAMPENING + ' = ' + totalSales);
    }
  }
  // If all stores are cafes or only 1 store, use rawTotalSales as-is

  const n = stores.length;
  if (n === 1) return totalSales; // L1 case

  // ── L2 Improvement 2: Review-based Zipf Ranking ──
  // Check if any stores have review data for review-based ranking
  const storesWithReviews = stores.filter(s =>
    (s.reviewCount && s.reviewCount > 0) || (s.reviews && s.reviews > 0)
  );
  const useReviewRanking = storesWithReviews.length >= 2; // Need at least 2 stores with reviews

  let ranked;
  if (useReviewRanking) {
    // Review-based ranking: more reviews = higher rank = larger Zipf share
    ranked = stores.map((store, idx) => {
      const reviews = store.reviewCount || store.reviews || 0;
      const nameIsCafe = isCafeByName(store.storeNm);
      return { store, weight: reviews, nameIsCafe, patternScore: 0, originalIndex: idx };
    }).sort((a, b) => b.weight - a.weight);
    console.warn('[L2] Review-based Zipf ranking (' + storesWithReviews.length + '/' + n + ' stores with reviews)');
  } else {
    // Fallback: Original category weight + name detection + pattern ranking
    ranked = stores.map((store, idx) => {
    const catKey = store.category?.bg || 'G0';
    let weight = CATEGORY_WEIGHTS[catKey] || 1;

    // Bonus: If store name matches cafe keywords, boost weight
    const nameIsCafe = isCafeByName(store.storeNm);
    if (nameIsCafe && catKey !== 'B0') {
      weight = Math.max(weight, CATEGORY_WEIGHTS['B0']);
    }

    // Enhanced: Use times[7] pattern similarity to cafe archetype
    let patternScore = 0;
    if (store.times && Array.isArray(store.times) && store.times.length >= 7) {
      const normalized = normalizePattern(store.times.slice(0, 7));
      if (normalized) {
        patternScore = patternSimilarity(normalized, CAFE_ARCHETYPE_PATTERN);
        // Pattern similarity 0-1, weight as 0-2 bonus
        // High similarity (>0.98) = likely cafe, full bonus
        // Low similarity (<0.90) = likely not cafe, minimal bonus
        const patternBonus = Math.max(0, (patternScore - 0.90) / 0.10) * 2;
        weight += patternBonus;
      }
    }

    return { store, weight, nameIsCafe, patternScore, originalIndex: idx };
    }).sort((a, b) => b.weight - a.weight);
  }

  // Compute Zipf denominators
  let zipfSum = 0;
  for (let k = 1; k <= n; k++) {
    zipfSum += 1 / Math.pow(k, ZIPF_EXPONENT);
  }

  // Find the target cafe's rank (match by name/brand similarity)
  const targetName = (targetCafe.name || '').replace(/\s/g, '').toUpperCase();
  const targetBrand = (targetCafe.brand || '').replace(/\s/g, '').toUpperCase();
  let targetRank = -1;

  for (let k = 0; k < ranked.length; k++) {
    const storeName = (ranked[k].store.storeNm || '').replace(/\s/g, '').toUpperCase();
    if (!storeName) continue;
    if (storeName === targetName) { targetRank = k + 1; break; }
    if (storeName.includes(targetName) || targetName.includes(storeName)) { targetRank = k + 1; break; }
    // Brand match for franchises
    if (targetBrand && targetBrand.length > 1 &&
        (storeName.includes(targetBrand) || targetBrand.includes(storeName))) {
      targetRank = k + 1; break;
    }
  }

  // Enhanced fallback: use cafe store identification
  if (targetRank < 0) {
    const cafeStoreCount = ranked.filter(r => r.nameIsCafe || r.store.category?.bg === 'B0').length;
    if (cafeStoreCount > 0 && cafeStoreCount < n) {
      // Pick median rank among identified cafe stores
      const cafeRanks = ranked.map((r, i) => ({
        isCafe: r.nameIsCafe || r.store.category?.bg === 'B0', rank: i + 1
      })).filter(r => r.isCafe).map(r => r.rank);
      targetRank = cafeRanks[Math.floor(cafeRanks.length / 2)];
    } else {
      targetRank = Math.max(1, Math.ceil(n * 0.4));
    }
  }

  // Zipf estimate: store_k = total * (1/k^s) / sum
  const estimate = Math.round(totalSales * (1 / Math.pow(targetRank, ZIPF_EXPONENT)) / zipfSum);
  return estimate;
}

// ═══════════════════════════════════════════════════════════════
// Franchise dampening (L3)
// ═══════════════════════════════════════════════════════════════

const NATIONAL_CAFE_AVG = 1800; // 만원/월 (전국 카페 평균)

/**
 * Estimate franchise cafe sales using brand average dampened by local conditions.
 *
 * estimated = brand_avg * (1 + (dong_factor - 1) * 0.3)
 * where dong_factor = dong_cafe_avg / national_cafe_avg
 *
 * The 0.3 dampening means franchise sales are 70% brand-driven, 30% location-driven.
 *
 * @param {Object} franchiseInfo - { 연평균매출 } from FRANCHISE_DATA (만원/year)
 * @param {number} dongAvgCafeSales - Dong-level average cafe monthly sales (만원)
 * @param {number} nationalAvg - National cafe monthly average (만원, default 1800)
 * @returns {number} Estimated monthly sales in 만원
 */
function estimateFranchise(franchiseInfo, dongAvgCafeSales, nationalAvg = NATIONAL_CAFE_AVG) {
  // FRANCHISE_DATA stores 연평균매출 (annual), convert to monthly
  const brandMonthlyAvg = (franchiseInfo.연평균매출 || 0) / 12;
  if (brandMonthlyAvg <= 0) return 0;

  const dongFactor = (dongAvgCafeSales || nationalAvg) / nationalAvg;
  const estimated = Math.round(brandMonthlyAvg * (1 + (dongFactor - 1) * 0.3));
  return Math.max(0, estimated);
}

// ═══════════════════════════════════════════════════════════════
// Independent cafe proxy (L4)
// ═══════════════════════════════════════════════════════════════

/**
 * Estimate independent cafe sales using competition-adjusted dong average.
 *
 * Factors:
 * - Competition density: more cafes = lower per-cafe sales
 * - Price positioning: higher americano price suggests premium segment
 * - Review ratio: more reviews relative to avg suggests higher traffic
 *
 * estimated = dong_avg * competitionFactor * priceFactor * reviewFactor
 *
 * @param {Object} cafe - { name, americanoPrice, reviewCount }
 * @param {number} dongAvgCafeSales - Dong average cafe monthly sales (만원)
 * @param {number} totalNearbyChafes - Total cafes within 500m radius
 * @returns {number} Estimated monthly sales in 만원
 */
function estimateIndependent(cafe, dongAvgCafeSales, totalNearbyCafes) {
  const baseEstimate = dongAvgCafeSales || NATIONAL_CAFE_AVG;

  // Competition factor: penalize for high density, bonus for low density
  // At 20 cafes: neutral; at 40: ~0.85; at 10: ~1.15
  const avgCafeDensity = 20; // baseline density in 500m radius
  const competitionFactor = totalNearbyCafes > 0
    ? Math.pow(avgCafeDensity / totalNearbyCafes, 0.3)
    : 1.0;

  // Price factor: higher americano price correlates with higher revenue per customer
  // Base: 4500 won; at 5500: ~1.08; at 3000: ~0.92
  const basePrice = 4500;
  const americanoPrice = cafe.americanoPrice || basePrice;
  const priceFactor = Math.pow(americanoPrice / basePrice, 0.35);

  // Review factor (if available): proxy for traffic volume
  // Normalized to baseline of 100 reviews
  let reviewFactor = 1.0;
  if (cafe.reviewCount && cafe.reviewCount > 0) {
    const baseReviews = 100;
    reviewFactor = Math.pow(cafe.reviewCount / baseReviews, 0.15);
    // Cap between 0.7 and 1.4
    reviewFactor = Math.max(0.7, Math.min(1.4, reviewFactor));
  }

  const estimated = Math.round(baseEstimate * competitionFactor * priceFactor * reviewFactor);
  return Math.max(0, estimated);
}

// ═══════════════════════════════════════════════════════════════
// Haversine distance (meters) between two lat/lng points
// ═══════════════════════════════════════════════════════════════

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ═══════════════════════════════════════════════════════════════
// Building-to-cafe matching (coordinate-based + address fallback)
// ═══════════════════════════════════════════════════════════════

/**
 * Match cafes to buildings using coordinate-based distance matching.
 * Falls back to address string matching when coordinates are unavailable.
 *
 * @param {Array} cafes - [{ name, addr, lat?, lng? }]
 * @param {Object} buildings - { buildingId: { ROAD_ADDR, center: [lng, lat] } }
 * @returns {Object} { cafeName: { buildingId, confidence, matchMethod } }
 */
function matchCafesToBuildings(cafes, buildings) {
  if (!cafes || !buildings) return {};

  const matches = {};
  const COORD_MATCH_RADIUS = 30; // meters

  // Pre-compute building coordinate list for fast iteration
  const buildingList = [];
  for (const [id, info] of Object.entries(buildings)) {
    if (info.center && Array.isArray(info.center) && info.center.length >= 2) {
      buildingList.push({
        id,
        lat: info.center[1],  // center = [lng, lat]
        lng: info.center[0],
        addr: (info.ROAD_ADDR || '').replace(/\s/g, '')
      });
    }
  }

  // Also build address index for fallback
  const buildingByAddr = {};
  for (const [id, info] of Object.entries(buildings)) {
    const addr = (info.ROAD_ADDR || '').replace(/\s/g, '');
    if (addr) {
      buildingByAddr[addr] = id;
      const shortAddr = addr.replace(/\d+-\d+$/, '').replace(/\d+$/, '');
      if (shortAddr && !buildingByAddr[shortAddr]) {
        buildingByAddr[shortAddr] = id;
      }
    }
  }

  let coordMatchCount = 0;
  let addrMatchCount = 0;
  let noMatchCount = 0;

  for (const cafe of cafes) {
    let matchedId = null;
    let matchMethod = null;
    let confidence = 0;

    // === PRIMARY: Coordinate-based matching ===
    const cafeLat = cafe.lat || (cafe.y ? parseFloat(cafe.y) : null);
    const cafeLng = cafe.lng || (cafe.x ? parseFloat(cafe.x) : null);

    if (cafeLat && cafeLng && buildingList.length > 0) {
      let bestDist = Infinity;
      let bestId = null;

      for (const bld of buildingList) {
        const dist = haversineDistance(cafeLat, cafeLng, bld.lat, bld.lng);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = bld.id;
        }
      }

      if (bestId && bestDist <= COORD_MATCH_RADIUS) {
        matchedId = bestId;
        matchMethod = 'coord';
        // Closer = higher confidence: 0m -> 0.95, 30m -> 0.80
        confidence = 0.95 - (bestDist / COORD_MATCH_RADIUS) * 0.15;
        coordMatchCount++;
      }
    }

    // === FALLBACK: Address string matching ===
    if (!matchedId) {
      const cafeAddr = (cafe.addr || '').replace(/\s/g, '');
      if (cafeAddr) {
        // Exact match
        matchedId = buildingByAddr[cafeAddr];

        // Partial match (street-level)
        if (!matchedId) {
          const cafeParts = cafeAddr.split(/[,]/);
          for (const part of cafeParts) {
            const trimmed = part.replace(/\s/g, '');
            if (buildingByAddr[trimmed]) {
              matchedId = buildingByAddr[trimmed];
              break;
            }
          }
        }

        // Substring matching
        if (!matchedId) {
          for (const [addr, id] of Object.entries(buildingByAddr)) {
            if (cafeAddr.includes(addr) || addr.includes(cafeAddr)) {
              matchedId = id;
              break;
            }
          }
        }

        if (matchedId) {
          matchMethod = 'addr';
          confidence = 0.75;
          addrMatchCount++;
        }
      }
    }

    if (matchedId) {
      matches[cafe.name] = { buildingId: matchedId, confidence, matchMethod };
    } else {
      noMatchCount++;
    }
  }

  const total = cafes.length;
  const matchTotal = coordMatchCount + addrMatchCount;
  const pct = total > 0 ? Math.round(matchTotal / total * 100) : 0;
  console.log('[매출추정] 좌표 매칭: ' + coordMatchCount + '/' + total + ' 성공, 주소 매칭: ' + addrMatchCount + '/' + total + ' 성공 (전체 ' + pct + '% 매칭률)');

  return matches;
}


// ================================================================
// Enhanced franchise matching using bd/sales storeNm (L3)
// ================================================================

function matchFranchiseFromBdSales(cafe, FRANCHISE_DATA_REF) {
  const bdName = cafe.bdSalesStoreNm;
  if (!bdName) return null;
  const upperBdName = bdName.replace(/\s/g, '').toUpperCase();
  for (const [brand, data] of Object.entries(FRANCHISE_DATA_REF)) {
    const upperBrand = brand.replace(/\s/g, '').toUpperCase();
    if (upperBdName.includes(upperBrand) || upperBrand.includes(upperBdName)) {
      return { brand, data };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Main estimation function
// ═══════════════════════════════════════════════════════════════

/**
 * Estimate sales for a single cafe using the multi-layer approach.
 *
 * @param {Object} params
 * @param {Object} params.cafe - { name, brand, isFranchise, americanoPrice, reviewCount, addr }
 * @param {Object|null} params.building - from bd/sales or null
 * @param {number} params.dongAvgCafeSales - Dong average cafe monthly sales (만원)
 * @param {Object|null} params.franchiseData - FRANCHISE_DATA entry for this brand
 * @param {number} params.nearbyTotalCafes - Total cafes in 500m radius
 * @param {number} params.nationalCafeAvg - National average (default 1800)
 * @returns {{ layer: string, estimated: number, confidence: number }}
 */
export function estimateCafeSales({
  cafe,
  building = null,
  dongAvgCafeSales = NATIONAL_CAFE_AVG,
  franchiseData = null,
  nearbyTotalCafes = 20,
  nationalCafeAvg = NATIONAL_CAFE_AVG,
  FRANCHISE_DATA_REF = {}
}) {
  let layer, estimated, confidence;

  // L1: Single-cafe building (direct from OpenUB)
  if (building && building.stores?.length === 1 && building.monthSales > 0) {
    layer = 'L1';
    estimated = building.monthSales;
    confidence = 0.95;
  }
  // L2: Multi-store building with Zipf distribution
  else if (building && building.stores?.length > 1 && building.monthSales > 0) {
    layer = 'L2';
    estimated = zipfDistribution(building, cafe);
    if (estimated === null || estimated <= 0) {
      // Fallback to L3 or L4
      layer = null;
    } else {
      confidence = 0.93;
    }
  }

  // L3: Franchise brand average (dampened by location)
  if (!layer) {
    // Enhanced L3: Try bd/sales storeNm matching if no franchise data found
    let resolvedFranchiseData = franchiseData;
    if (!resolvedFranchiseData && cafe.bdSalesStoreNm) {
      const bdMatch = matchFranchiseFromBdSales(cafe, FRANCHISE_DATA_REF);
      if (bdMatch) {
        resolvedFranchiseData = bdMatch.data;
        console.warn('[L3-enhanced] bd/sales storeNm match: "' + cafe.name + '" -> "' + bdMatch.brand + '" via "' + cafe.bdSalesStoreNm + '"');
      }
    }
    if ((cafe.isFranchise || resolvedFranchiseData) && resolvedFranchiseData && resolvedFranchiseData.연평균매출 > 0) {
      layer = 'L3';
      estimated = estimateFranchise(resolvedFranchiseData, dongAvgCafeSales, nationalCafeAvg);
      confidence = 0.90;
    }
  }

  // L4: Independent cafe (ML regression if times7 available, else fallback)
  if (!layer) {
    layer = 'L4';
    if (canUseMLRegression(cafe)) {
      // ML regression with times7 data -> 85% confidence
      const { features } = buildMLFeatures(cafe, dongAvgCafeSales);
      estimated = mlEstimateL4(features);
      confidence = 0.85;
    } else {
      // Fallback: competition-adjusted dong average -> 78% confidence
      estimated = estimateIndependent(cafe, dongAvgCafeSales, nearbyTotalCafes);
      confidence = 0.78;
    }
  }

  // Range percentages per layer
  const LAYER_RANGE = { L1: 0.08, L2: 0.15, L3: 0.12, L4: 0.20 };
  const salesRange = LAYER_RANGE[layer] || 0.20;
  const salesMin = Math.round(estimated * (1 - salesRange));
  const salesMax = Math.round(estimated * (1 + salesRange));

  return { layer, estimated, confidence, salesMin, salesMax, salesLayer: layer, salesRange };
}

/**
 * Estimate sales for all cafes.
 *
 * @param {Object} params
 * @param {Array} params.cafes - Array of { name, brand, isFranchise, americanoPrice, reviewCount, addr }
 * @param {Object|null} params.openubData - { buildings, buildingSales } or null
 * @param {number} params.dongAvgCafeSales - Dong average in 만원
 * @param {Object} params.FRANCHISE_DATA_REF - Reference to FRANCHISE_DATA
 * @param {number} params.nearbyTotalCafes - Total cafe count in 500m
 * @returns {Array} Array of { name, layer, estimated, confidence, isFranchise }
 */
export function estimateAllCafeSales({
  cafes,
  openubData = null,
  dongAvgCafeSales = NATIONAL_CAFE_AVG,
  FRANCHISE_DATA_REF = {},
  nearbyTotalCafes = 20
}) {
  // Step 1: Match cafes to buildings (if OpenUB data available)
  let cafeToBuilding = {};
  if (openubData && openubData.buildings && openubData.buildingSales) {
    cafeToBuilding = matchCafesToBuildings(cafes, openubData.buildings);
    const matchCount = Object.keys(cafeToBuilding).length;
    const buildingCount = Object.keys(openubData.buildings).length;
    const salesCount = Object.keys(openubData.buildingSales).length;
    console.log('[매출추정] OpenUB 매칭: 건물 ' + buildingCount + '개, 매출데이터 ' + salesCount + '개, 카페-건물 매칭 ' + matchCount + '/' + cafes.length + '개');
    if (matchCount === 0 && buildingCount > 0) {
      console.warn('[매출추정] OpenUB 건물은 있지만 카페-건물 매칭 0건 (주소 형식 불일치 가능)');
    }
  } else {
    console.warn('[매출추정] OpenUB 데이터 없음 (L1/L2 불가)', openubData ? 'buildings=' + !!openubData.buildings + ', sales=' + !!openubData.buildingSales : 'openubData=null');
  }

  // Step 2: Estimate each cafe
  const results = [];
  for (const cafe of cafes) {
    // Resolve building data for this cafe (if matched)
    let building = null;
    const match = cafeToBuilding[cafe.name];
    if (match && openubData?.buildingSales?.[match.buildingId]) {
      building = openubData.buildingSales[match.buildingId];

      // Extract times7 data from building for ML regression (L4)
      const times7 = extractTimes7(building);
      if (times7) {
        cafe.times7 = times7;
      }

      // Extract bd/sales storeNm for enhanced L3 franchise matching
      if (building?.stores && !cafe.bdSalesStoreNm) {
        const cafeName = (cafe.name || '').replace(/\s/g, '').toUpperCase();
        const cafeBrand = (cafe.brand || '').replace(/\s/g, '').toUpperCase();
        for (const store of building.stores) {
          const sn = (store.storeNm || '').replace(/\s/g, '').toUpperCase();
          if (sn && (sn.includes(cafeName) || cafeName.includes(sn) ||
                     (cafeBrand && cafeBrand.length > 1 && (sn.includes(cafeBrand) || cafeBrand.includes(sn))))) {
            cafe.bdSalesStoreNm = store.storeNm;
            break;
          }
        }
      }
    }

    // Resolve franchise data
    let franchiseData = null;
    if (cafe.isFranchise && cafe.brand) {
      franchiseData = FRANCHISE_DATA_REF[cafe.brand] || null;
      // Try partial match
      if (!franchiseData) {
        const brandKey = Object.keys(FRANCHISE_DATA_REF).find(k =>
          k.includes(cafe.brand) || cafe.brand.includes(k)
        );
        if (brandKey) {
          franchiseData = FRANCHISE_DATA_REF[brandKey];
          console.warn('[L3] 부분매칭: "' + cafe.brand + '" -> "' + brandKey + '"');
        }
      }
      if (!franchiseData) {
        console.warn('[L3] 프랜차이즈 매칭 실패: brand="' + cafe.brand + '", name="' + cafe.name + '" (FRANCHISE_DATA에 없음)');
      } else if (!franchiseData.연평균매출 || franchiseData.연평균매출 <= 0) {
        console.warn('[L3] 연평균매출 없음: brand="' + cafe.brand + '" (L4로 폴백)');
      }
    }

    const result = estimateCafeSales({
      cafe,
      building,
      dongAvgCafeSales,
      franchiseData,
      nearbyTotalCafes,
      FRANCHISE_DATA_REF
    });

    results.push({
      name: cafe.name,
      brand: cafe.brand || null,
      isFranchise: !!cafe.isFranchise,
      addr: cafe.addr || '',
      ...result
    });
  }

  return results;
}
