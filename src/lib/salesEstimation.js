/**
 * Multi-Layer Cafe Sales Estimation Engine
 *
 * Layers (ordered by accuracy):
 * L1: Single-cafe building -> direct monthSales from OpenUB (95% confidence)
 * L2: Multi-store building -> Zipf distribution from OpenUB (93% confidence)
 * L3: Multi-signal ensemble -> foot traffic + rent + features blending (up to 92% confidence)
 * L4: Independent cafe -> feature-based proxy (85% confidence)
 *
 * Priority: L1 > L2 > L3 > L4
 *
 * L1 and L2 require OpenUB building data (optional, no auth needed).
 * L4 always works with existing data.
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

// Dynamic Zipf exponent based on store composition
// - Cafe-only buildings: 0.5 (smaller sales gap between cafes)
// - Mixed cafe + non-cafe: 0.7 (cross-industry gap)
// - Default: 0.6
function getZipfExponent(stores) {
  if (!stores || stores.length === 0) return 0.6;

  const cafeCount = stores.filter(s => {
    const cat = s.category?.bg || s.category?.sm || '';
    return cat === 'A12' || cat === 'B0' || isCafeByName(s.storeNm);
  }).length;

  if (cafeCount === 0) return 0.6; // no cafe info, default
  if (cafeCount === stores.length) return 0.5; // all cafes
  return 0.7; // mixed: cafe + non-cafe
}


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
      // No per-store breakdown: smart dampening based on available info
      let dampening;
      const storeCount = stores.length;

      if (storeCount > 1) {
        // Use 1/storeCount as cafe's share (equal distribution assumption)
        dampening = Math.round((1 / storeCount) * 100) / 100;
        console.warn('[L2] A12 data unavailable, store-based dampening: ' + rawTotalSales + ' x' + dampening + ' (1/' + storeCount + ' stores) = ' + Math.round(rawTotalSales * dampening));
      } else {
        // Single store or unknown count: scale by building total revenue
        // rawTotalSales is in 만원 units
        if (rawTotalSales > 50000) {
          dampening = 0.15; // Large commercial (5억+): many tenants likely
        } else if (rawTotalSales > 20000) {
          dampening = 0.25; // Medium commercial (2~5억)
        } else if (rawTotalSales > 10000) {
          dampening = 0.35; // Small commercial (1~2억)
        } else {
          dampening = 0.5;  // Small building (<1억): cafe likely major tenant
        }
        console.warn('[L2] A12 data unavailable, revenue-based dampening: ' + rawTotalSales + ' x' + dampening + ' = ' + Math.round(rawTotalSales * dampening));
      }

      totalSales = Math.round(rawTotalSales * dampening);
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

  // Compute Zipf denominators with dynamic exponent
  const zipfExp = getZipfExponent(stores);
  let zipfSum = 0;
  for (let k = 1; k <= n; k++) {
    zipfSum += 1 / Math.pow(k, zipfExp);
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
  const estimate = Math.round(totalSales * (1 / Math.pow(targetRank, zipfExp)) / zipfSum);
  return estimate;
}

// ═══════════════════════════════════════════════════════════════
// L3-new: Multi-signal ensemble helpers
// ═══════════════════════════════════════════════════════════════

function getFacilityScore(fclty) {
  if (!fclty) return null;
  const subway = Number(fclty.SUBWAY_CNT || fclty.subway || 0);
  const bus = Number(fclty.BUS_CNT || fclty.bus || 0);
  const bank = Number(fclty.BANK_CNT || fclty.bank || 0);
  if (subway + bus + bank === 0) return null;
  return 0.5 + (subway * 0.3) + (bus * 0.1) + (bank * 0.1);
}

function getPopulationScore(repop) {
  if (!repop) return null;
  const pop = Number(repop.TOT_POPLTN || repop.population || 0);
  if (pop <= 0) return null;
  return Math.min(2.0, pop / 10000);
}

function getVitalityScore(apiData) {
  const storQq = apiData?.seoulStorQq;
  if (!storQq) return null;
  const openRate = Number(storQq.OPEN_RATE || storQq.openRate || 0);
  const closeRate = Number(storQq.CLOSE_RATE || storQq.closeRate || 0);
  if (openRate === 0 && closeRate === 0) return null;
  return 1.0 + (openRate - closeRate) * 0.5;
}

function getTrendScore(apiData) {
  const sls = apiData?.slsIndex;
  if (!sls) return null;
  if (Array.isArray(sls) && sls.length >= 2) {
    const recent = Number(sls[sls.length - 1]?.value || sls[sls.length - 1] || 0);
    const prev = Number(sls[0]?.value || sls[0] || 0);
    if (prev <= 0) return null;
    return Math.min(1.3, Math.max(0.7, recent / prev));
  }
  return null;
}

function getDeliveryBoost(baemin) {
  if (!baemin) return 1.0;
  const deliveryRatio = Number(baemin.DLVR_RATE || baemin.deliveryRate || 0);
  if (deliveryRatio > 0.3) return 1.25;
  if (deliveryRatio > 0.15) return 1.15;
  return 1.0;
}

function getTimeBoost(apiData) {
  const timeData = apiData?.cafeTimeData || apiData?.floatingTime;
  if (!timeData) return 1.0;
  return 1.0;
}

// ═══════════════════════════════════════════════════════════════
// L3-new: Signal A - Foot traffic estimation
// ═══════════════════════════════════════════════════════════════

function estimateFromFootTraffic(cafe, apiData, nearbyTotalCafes) {
  const flpop = apiData?.seoulFlpopDetail || apiData?.dynPplCmpr;
  if (!flpop) return null;

  let dailyFootTraffic = 0;
  if (flpop?.TOT_FLPOP_CO) dailyFootTraffic = Number(flpop.TOT_FLPOP_CO);
  else if (flpop?.PERSON_CNT) dailyFootTraffic = Number(flpop.PERSON_CNT);
  else if (Array.isArray(flpop)) {
    dailyFootTraffic = flpop.reduce((sum, item) => sum + (Number(item.TOT_FLPOP_CO || item.PERSON_CNT || 0)), 0);
  }
  if (dailyFootTraffic <= 0) return null;

  const cafeTargetRatio = 0.15;
  const captureRate = 0.03 / Math.sqrt(Math.max(nearbyTotalCafes, 1));
  const avgTicket = (cafe.americanoPrice || 4500) * 1.35;

  const monthlyRevenue = dailyFootTraffic * cafeTargetRatio * captureRate * avgTicket * 30;
  const monthlyWanWon = Math.round(monthlyRevenue / 10000);

  const isSeoul = !!apiData?.seoulFlpopDetail;
  return { estimate: monthlyWanWon, confidence: isSeoul ? 0.87 : 0.82, method: '유동인구 기반' };
}

// ═══════════════════════════════════════════════════════════════
// L3-new: Signal B - Rent-based estimation
// ═══════════════════════════════════════════════════════════════

function estimateFromRent(cafe, apiData) {
  const rent = apiData?.roneRent || apiData?.firebaseRent;
  if (!rent) return null;

  let monthlyRent = 0;
  if (rent?.MO_RENT_AMT) monthlyRent = Number(rent.MO_RENT_AMT);
  else if (rent?.rent) monthlyRent = Number(rent.rent);
  else if (rent?.monthlyRent) monthlyRent = Number(rent.monthlyRent);
  else if (typeof rent === 'number') monthlyRent = rent;
  if (monthlyRent <= 0) return null;

  const hasSubway = apiData?.seoulFclty?.subway > 0 || apiData?.seoulFclty?.SUBWAY_CNT > 0;
  const hasHighPop = apiData?.seoulRepop?.TOT_POPLTN > 10000;

  let rentRatio = 0.10;
  if (hasSubway) rentRatio = 0.12;
  else if (hasHighPop) rentRatio = 0.08;

  const monthlyRevenue = monthlyRent / rentRatio;
  const monthlyWanWon = Math.round(monthlyRevenue / 10000);

  const isDetailRent = !!apiData?.firebaseRent;
  return { estimate: monthlyWanWon, confidence: isDetailRent ? 0.85 : 0.80, method: '임대료 역산' };
}

// ═══════════════════════════════════════════════════════════════
// L3-new: Signal C - Multi-feature scoring
// ═══════════════════════════════════════════════════════════════

function estimateFromFeatures(cafe, apiData, dongAvgCafeSales, nearbyTotalCafes) {
  if (!dongAvgCafeSales || dongAvgCafeSales <= 0) return null;

  let totalScore = 0;
  let totalWeight = 0;
  let featureCount = 0;

  const features = [
    { name: 'americanoPrice', weight: 0.15, value: cafe.americanoPrice, baseline: 4500, scale: 1/2000 },
    { name: 'reviewCount', weight: 0.15, value: cafe.reviewCount, baseline: 100, scale: 1/200 },
    { name: 'rating', weight: 0.10, value: cafe.rating, baseline: 4.0, scale: 1/1.0 },
    { name: 'seatSize', weight: 0.10, value: cafe.seatSize, baseline: 30, scale: 1/30 },
    { name: 'competition', weight: 0.15, value: nearbyTotalCafes ? (1 / Math.sqrt(nearbyTotalCafes)) * 10 : null, baseline: 1.0, scale: 1 },
    { name: 'facilities', weight: 0.10, value: getFacilityScore(apiData?.seoulFclty), baseline: 1.0, scale: 1 },
    { name: 'population', weight: 0.10, value: getPopulationScore(apiData?.seoulRepop), baseline: 1.0, scale: 1 },
    { name: 'vitality', weight: 0.10, value: getVitalityScore(apiData), baseline: 1.0, scale: 1 },
    { name: 'trend', weight: 0.05, value: getTrendScore(apiData), baseline: 1.0, scale: 1 },
  ];

  for (const f of features) {
    if (f.value != null && f.value > 0) {
      const normalized = Math.max(0.3, Math.min(2.0, (f.value / f.baseline)));
      totalScore += normalized * f.weight;
      totalWeight += f.weight;
      featureCount++;
    }
  }

  if (featureCount < 2) return null;

  const avgScore = totalScore / totalWeight;
  const estimated = Math.round(dongAvgCafeSales * avgScore);
  const confidence = Math.min(0.88, 0.78 + 0.01 * featureCount);

  return { estimate: estimated, confidence, method: '다변수 분석' };
}

// ═══════════════════════════════════════════════════════════════
// L3-new: Signal blending (ensemble)
// ═══════════════════════════════════════════════════════════════

function blendSignals(signals) {
  const valid = signals.filter(s => s && s.estimate > 0);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  const estimates = valid.map(s => s.estimate);
  const sorted = [...estimates].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let totalWeighted = 0;
  let totalConfidence = 0;
  for (const s of valid) {
    let weight = s.confidence;
    if (s.estimate > median * 3 || s.estimate < median / 3) {
      weight *= 0.3;
    }
    totalWeighted += s.estimate * weight;
    totalConfidence += weight;
  }

  const blendedEstimate = Math.round(totalWeighted / totalConfidence);
  const maxConf = Math.max(...valid.map(s => s.confidence));
  const blendedConfidence = Math.min(0.92, maxConf + 0.02 * (valid.length - 1));

  return {
    estimate: blendedEstimate,
    confidence: blendedConfidence,
    method: valid.length >= 2 ? '종합 분석' : valid[0].method,
    signalCount: valid.length
  };
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
 * @param {number} totalNearbyCafes - Total cafes within 500m radius
 * @param {number} dongCafeCount - Dong-level total cafe count (optional)
 * @returns {number} Estimated monthly sales in 만원
 */
function estimateIndependent(cafe, dongAvgCafeSales, totalNearbyCafes, dongCafeCount, vitalityFactor = 1.0) {
  const baseEstimate = dongAvgCafeSales || 1800;

  // Competition factor: penalize for high density, bonus for low density
  // Dynamic baseline: dong-level count if available, else national median estimate (25)
  const NATIONAL_MEDIAN_CAFE_DENSITY = 25;
  const avgCafeDensity = (dongCafeCount && dongCafeCount > 0)
    ? dongCafeCount
    : NATIONAL_MEDIAN_CAFE_DENSITY;
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

  const estimated = Math.round(baseEstimate * competitionFactor * priceFactor * reviewFactor * vitalityFactor);
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
 * @param {number} params.nearbyTotalCafes - Total cafes in 500m radius
 * @param {number} params.dongCafeCount - Dong-level total cafe count (optional, for L4 dynamic density)
 * @returns {{ layer: string, estimated: number, confidence: number }}
 */
export function estimateCafeSales({
  cafe,
  building = null,
  dongAvgCafeSales = 1800,
  nearbyTotalCafes = 20,
  dongCafeCount = 0,
  vitalityFactor = 1.0,
  trendFactor = 1.0,
  apiData = {}
}) {
  let layer, estimated, confidence;
  // methodLabel: tracks the actual estimation method for UI display
  // (may differ from layer when blending is used)
  let methodLabel = null;

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
      // Fallback to L4
      layer = null;
    } else {
      confidence = 0.93;
    }
  }

  // L3-new: Multi-signal ensemble (when L1/L2 not matched)
  if (!layer && apiData) {
    const signals = [
      estimateFromFootTraffic(cafe, apiData, nearbyTotalCafes),
      estimateFromRent(cafe, apiData),
      estimateFromFeatures(cafe, apiData, dongAvgCafeSales, nearbyTotalCafes),
    ];

    const blended = blendSignals(signals);
    if (blended) {
      layer = 'L3';
      estimated = blended.estimate;
      confidence = blended.confidence;
      methodLabel = blended.method;

      // 배달 보정
      if (apiData?.baeminTpbiz) {
        const deliveryBoost = getDeliveryBoost(apiData.baeminTpbiz);
        estimated = Math.round(estimated * deliveryBoost);
      }

      // 시간대 보정
      const timeBoost = getTimeBoost(apiData);
      if (timeBoost !== 1.0) {
        estimated = Math.round(estimated * timeBoost);
      }

      console.warn('[Sales L3-new] ' + cafe.name + ': signals=' + JSON.stringify(signals.filter(Boolean).map(s => ({m:s.method, e:s.estimate, c:s.confidence}))) + ', blended=' + estimated);
    }
  }

  // L4: Independent cafe (ML regression if times7 available, else fallback)
  // trendFactor는 L4에만 적용 (비서울권 정확도 향상 목적)
  if (!layer) {
    layer = 'L4';
    const combinedVitality = vitalityFactor * trendFactor;
    if (canUseMLRegression(cafe)) {
      // ML regression with times7 data -> 85% confidence
      const { features } = buildMLFeatures(cafe, dongAvgCafeSales);
      estimated = Math.round(mlEstimateL4(features) * combinedVitality);
      confidence = 0.85;
    } else {
      // Fallback: competition-adjusted dong average -> 78% confidence
      estimated = estimateIndependent(cafe, dongAvgCafeSales, nearbyTotalCafes, dongCafeCount, combinedVitality);
      confidence = 0.78;
    }
  }

  // Range percentages per layer (dynamic for L4)
  let salesRange;
  let confidenceNote;
  if (layer === 'L1') {
    salesRange = 0.08;
    confidenceNote = '건물 매출 직접 데이터';
  } else if (layer === 'L2') {
    salesRange = 0.20;
    confidenceNote = '건물 매출 Zipf 분배 추정';
  } else if (layer === 'L3') {
    salesRange = 0.22;
    confidenceNote = methodLabel || '멀티시그널 종합 분석';
  } else {
    // L4: dynamic range based on data availability
    const hasTimes7 = !!(cafe.times7 && Array.isArray(cafe.times7) && cafe.times7.length >= 7);
    const hasReviews = !!(cafe.reviewCount && cafe.reviewCount > 0);
    if (hasTimes7) {
      salesRange = 0.25;
      confidenceNote = '요일별 매출 패턴 기반 추정';
    } else if (hasReviews) {
      salesRange = 0.30;
      confidenceNote = '리뷰/경쟁 기반 추정';
    } else {
      salesRange = 0.35;
      confidenceNote = '동 평균 기반 추정';
    }
  }
  const salesMin = Math.round(estimated * (1 - salesRange));
  const salesMax = Math.round(estimated * (1 + salesRange));

  return { layer, estimated, confidence, salesMin, salesMax, salesLayer: layer, salesRange, confidenceNote, methodLabel };
}

/**
 * Estimate sales for all cafes.
 *
 * @param {Object} params
 * @param {Array} params.cafes - Array of { name, brand, isFranchise, americanoPrice, reviewCount, addr }
 * @param {Object|null} params.openubData - { buildings, buildingSales } or null
 * @param {number} params.dongAvgCafeSales - Dong average in 만원
 * @param {number} params.nearbyTotalCafes - Total cafe count in 500m
 * @param {number} params.dongCafeCount - Dong-level total cafe count (optional)
 * @returns {Array} Array of { name, layer, estimated, confidence, isFranchise }
 */
export function estimateAllCafeSales({
  cafes,
  openubData = null,
  dongAvgCafeSales = 1800,
  nearbyTotalCafes = 20,
  dongCafeCount = 0,
  marketVitality = null,
  trendData = null,
  apiData = {}
}) {
  // Compute vitalityFactor from seoulStorQq data (±10% cap)
  let vitalityFactor = 1.0;
  if (marketVitality && (marketVitality.openRate || marketVitality.closeRate)) {
    const openRate = parseFloat(marketVitality.openRate) || 0;
    const closeRate = parseFloat(marketVitality.closeRate) || 0;
    const diff = openRate - closeRate; // positive = growing, negative = declining
    // Scale: each 1% diff -> ~1% factor change, capped at ±10%
    vitalityFactor = Math.max(0.9, Math.min(1.1, 1.0 + diff / 100));
    console.warn('[매출추정] 상권활성도 반영: 개업률 ' + openRate + '%, 폐업률 ' + closeRate + '% -> vitalityFactor=' + vitalityFactor.toFixed(3));
  }

  // Compute trendFactor from slsIndex data (±15% cap)
  let trendFactor = 1.0;
  try {
    if (trendData && Array.isArray(trendData) && trendData.length >= 2) {
      // slsIndex: 분기별 매출지수 배열, 최근 분기 vs 과거 평균
      const indices = trendData
        .map(d => parseFloat(d.slsIdx || d.mmavgSlsIdx || d.value || 0))
        .filter(v => v > 0);
      if (indices.length >= 2) {
        const recentQuarter = indices[indices.length - 1];
        const pastAvg = indices.slice(0, -1).reduce((a, b) => a + b, 0) / (indices.length - 1);
        if (pastAvg > 0) {
          const rawFactor = recentQuarter / pastAvg;
          // ±15% 제한
          trendFactor = Math.max(0.85, Math.min(1.15, rawFactor));
          console.warn('[매출추정] 매출추이(slsIndex) 반영: 최근 ' + recentQuarter.toFixed(1) + ' / 과거평균 ' + pastAvg.toFixed(1) + ' -> trendFactor=' + trendFactor.toFixed(3));
        }
      }
    }
  } catch (e) {
    // trendFactor 계산 실패 시 1.0 유지 (영향 없음)
    console.warn('[매출추정] trendFactor 계산 실패, 1.0 유지:', e.message);
    trendFactor = 1.0;
  }
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

    }

    const result = estimateCafeSales({
      cafe,
      building,
      dongAvgCafeSales,
      nearbyTotalCafes,
      dongCafeCount,
      vitalityFactor,
      trendFactor,
      apiData
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

// ═══════════════════════════════════════════════════════════════
// dongCd → ADSTRD_CD 변환 유틸
// ═══════════════════════════════════════════════════════════════

/**
 * 소상공인365 dongCd(10자리) → 서울 열린데이터 ADSTRD_CD(8자리) 변환
 * @param {string} dongCd - 소상공인365 행정동 코드 (10자리)
 * @returns {string|null} 서울 열린데이터 ADSTRD_CD (8자리), 또는 null
 */
export function dongCdToAdstrdCd(dongCd) {
  return dongCd ? dongCd.substring(0, 8) : null;
}

/**
 * 서울 지역인지 판별 (dongCd 또는 ADSTRD_CD 기준)
 * 서울: 코드가 '11'로 시작
 * @param {string} code - dongCd 또는 ADSTRD_CD
 * @returns {boolean}
 */
export function isSeoulByCode(code) {
  return code ? code.startsWith('11') : false;
}

// ═══════════════════════════════════════════════════════════════
// 반경 내 카페 평균매출 계산 (의뢰인 모드)
// ═══════════════════════════════════════════════════════════════

const SBIZ_PROXY_BASE = '/.netlify/functions/sbiz-proxy';

// ═══════════════════════════════════════════════════════════════
// API 타임아웃 + 재시도 유틸
// ═══════════════════════════════════════════════════════════════

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      console.warn('[매출추정] API 타임아웃:', url.substring(0, 80));
    }
    throw e;
  }
}

async function fetchWithRetry(url, options = {}, { timeoutMs = 8000, retries = 2, backoffMs = 1000 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, backoffMs * (i + 1)));
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 전국 카페 평균 (최종 안전장치)
// ═══════════════════════════════════════════════════════════════

const NATIONAL_CAFE_AVG_MONTHLY = 1850; // 만원 (2024 소상공인 통계 기준)

// ═══════════════════════════════════════════════════════════════
// 공정위 지역별 업종별 매출 API (L2 fallback)
// ═══════════════════════════════════════════════════════════════

/**
 * 시도명 → 공정위 API areaGbn 코드 매핑
 */
const SIDO_CODES = [
  '11', '26', '27', '28', '29', '30', '31', '36',
  '41', '42', '43', '44', '45', '46', '47', '48', '50'
];

/**
 * 공정위 지역별 업종별 평균 매출 조회
 * @param {string} dongCd - 행정동 코드 (시도 코드 추출용)
 * @returns {Promise<number|null>} 평균 매출 (만원) 또는 null
 */
async function fetchFftcAreaSales(dongCd) {
  if (!dongCd || dongCd.length < 2) return null;

  const sidoCode = dongCd.substring(0, 2);
  if (!SIDO_CODES.includes(sidoCode)) return null;

  try {
    const params = new URLSearchParams({
      api: 'fftc',
      operation: 'getAreaIndutyAvrOutStats',
      areaCd: sidoCode,
      indutyLclsCd: 'Q',
      indutySclsCd: 'Q12',
      numOfRows: '100'
    });

    const res = await fetchWithRetry(
      `${SBIZ_PROXY_BASE}?${params.toString()}`,
      {},
      { timeoutMs: 8000, retries: 1, backoffMs: 1000 }
    );

    if (!res.ok) {
      console.warn('[매출추정] 공정위 API 응답 실패:', res.status);
      return null;
    }

    const json = await res.json();
    const items = json?.data?.response?.body?.items?.item
      || json?.data?.items?.item
      || json?.data?.items
      || [];

    if (!Array.isArray(items) || items.length === 0) {
      console.warn('[매출추정] 공정위 API 데이터 없음: 시도코드=' + sidoCode);
      return null;
    }

    // 해당 지역 매출 데이터에서 평균 추출 (금액 단위: 만원으로 변환)
    let totalSales = 0;
    let count = 0;
    for (const item of items) {
      const sales = Number(item.avrOutAmt || item.avrWhrtAmt || item.avrSrvcAmt || 0);
      if (sales > 0) {
        totalSales += sales;
        count++;
      }
    }

    if (count === 0) return null;

    // API 응답 단위가 원 단위이면 만원으로 변환
    let avgSales = Math.round(totalSales / count);
    if (avgSales > 100000) {
      avgSales = Math.round(avgSales / 10000);
    }

    console.log('[매출추정] 공정위 API 성공: 시도=' + sidoCode + ' 카페 평균매출=' + avgSales + '만원 (' + count + '건)');
    return avgSales;
  } catch (err) {
    console.warn('[매출추정] 공정위 API 오류:', err.message);
    return null;
  }
}

/**
 * 서울 열린데이터 VwsmAdstrdSelngW API를 ADSTRD_CD 코드로 조회
 * @param {string[]} adstrdCodes - 8자리 ADSTRD_CD 코드 배열
 * @param {string} [quarter] - 기준 분기 (예: '20253')
 * @returns {Object} { [adstrdCd]: { avgSales, totalSales, storeCount, rows } }
 */
async function fetchSeoulSalesByAdstrdCd(adstrdCodes, quarter) {
  if (!adstrdCodes || adstrdCodes.length === 0) return {};

  try {
    const params = new URLSearchParams({
      api: 'seoul',
      service: 'VwsmAdstrdSelngW',
      ADSTRD_CD: adstrdCodes.join(',')
    });
    if (quarter) params.append('stdrYyquCd', quarter);

    const res = await fetchWithRetry(
      `${SBIZ_PROXY_BASE}?${params.toString()}`,
      {},
      { timeoutMs: 10000, retries: 2, backoffMs: 1000 }
    );
    if (!res.ok) {
      console.warn('[매출추정] 서울 매출 API 실패:', res.status);
      return {};
    }

    const json = await res.json();
    const rows = json?.data?.filteredRows || [];

    // 행정동별로 그룹핑하여 카페(커피) 업종 매출 합산
    const dongSalesMap = {};
    for (const row of rows) {
      const code = row.ADSTRD_CD;
      if (!code) continue;

      // 커피/음료 업종 필터 (SVC_INDUTY_CD: CS100006=커피전문점, CS100005=음료)
      const industryCd = row.SVC_INDUTY_CD || '';
      const isCafeIndustry = industryCd === 'CS100006' || industryCd === 'CS100005';

      if (!isCafeIndustry) continue;

      if (!dongSalesMap[code]) {
        dongSalesMap[code] = { totalSales: 0, storeCount: 0, rows: [] };
      }

      // VwsmAdstrdSelngW는 분기 단위 데이터 — 모든 금액 필드가 분기 합계
      // THSMON_SELNG_AMT = 당월매출금액(원) — 실제로는 분기 합계이므로 /3으로 월 환산
      // fallback: MDWK_SELNG_AMT + WKEND_SELNG_AMT = 분기 전체 매출(원) → /3으로 월 환산
      const thsmon = Number(row.THSMON_SELNG_AMT || 0);
      const monthSales = thsmon > 0
        ? thsmon / 3
        : (Number(row.MDWK_SELNG_AMT || 0) + Number(row.WKEND_SELNG_AMT || 0)) / 3;
      dongSalesMap[code].totalSales += monthSales;
      // STOR_CO가 VwsmAdstrdSelngW API에 없을 수 있음 → 0이면 추후 cafesByDong 카운트로 대체
      const storCo = Number(row.STOR_CO || 0);
      dongSalesMap[code].storeCount += storCo;
      dongSalesMap[code].rows.push(row);
    }

    // 평균 매출 계산 (만원 단위)
    // storeCount=0이면 STOR_CO 필드가 API에 없었다는 뜻 → avgSales는 caller에서 cafesByDong으로 재계산
    for (const code of Object.keys(dongSalesMap)) {
      const d = dongSalesMap[code];
      if (d.storeCount > 0) {
        d.avgSales = Math.round(d.totalSales / d.storeCount / 10000);
      } else {
        // storeCount 미제공 → totalSales(원)만 보존, avgSales는 0으로 두고 caller에서 처리
        d.avgSales = 0;
        console.warn(`[매출추정] 서울 열린데이터 STOR_CO 없음 (${code}): totalSales=${Math.round(d.totalSales/10000)}만원, rows=${d.rows.length}개`);
      }
    }

    return dongSalesMap;
  } catch (err) {
    console.warn('[매출추정] 서울 매출 API 오류:', err.message);
    return {};
  }
}

/**
 * 최근 분기 코드 생성 (예: 2025년 3분기 → '20253')
 * @returns {string}
 */
function getRecentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // 데이터 공개 지연(약 2분기)을 고려하여 2분기 전 데이터 요청
  let quarter = Math.ceil(month / 3);
  let qYear = year;
  quarter -= 2;
  if (quarter <= 0) {
    quarter += 4;
    qYear -= 1;
  }
  return `${qYear}${quarter}`;
}

/**
 * 카페를 동별로 그룹핑
 * @param {Array} cafes - [{name, lat, lng, dongCd, ...}]
 * @returns {Object} { [adstrdCd8]: [cafe1, cafe2, ...] }
 */
function groupCafesByDong(cafes) {
  const groups = {};
  for (const cafe of cafes) {
    const adstrdCd = dongCdToAdstrdCd(cafe.dongCd);
    if (!adstrdCd) continue;
    if (!groups[adstrdCd]) groups[adstrdCd] = [];
    groups[adstrdCd].push(cafe);
  }
  return groups;
}

/**
 * 공정위 전국 데이터 기반 시/도 단위 보정 계수
 * 서울 평균 대비 각 시도의 카페 매출 비율 (근사치)
 */
const SIDO_CORRECTION_FACTORS = {
  '11': 1.00,  // 서울
  '26': 0.85,  // 부산
  '27': 0.80,  // 대구
  '28': 0.88,  // 인천
  '29': 0.78,  // 광주
  '30': 0.82,  // 대전
  '31': 0.80,  // 울산
  '36': 0.85,  // 세종
  '41': 0.92,  // 경기
  '42': 0.75,  // 강원
  '43': 0.72,  // 충북
  '44': 0.75,  // 충남
  '45': 0.70,  // 전북
  '46': 0.68,  // 전남
  '47': 0.72,  // 경북
  '48': 0.75,  // 경남
  '50': 0.80,  // 제주
};

function getSidoCorrectionFactor(dongCd) {
  if (!dongCd || dongCd.length < 2) return 0.80;
  const sidoCode = dongCd.substring(0, 2);
  return SIDO_CORRECTION_FACTORS[sidoCode] || 0.80;
}

/**
 * 반경 내 카페 평균매출 계산 (의뢰인 모드용)
 *
 * @param {Object} params
 * @param {number} params.lat - 중심 위도
 * @param {number} params.lng - 중심 경도
 * @param {number} params.radius - 반경 (미터)
 * @param {Array} params.cafes - 반경 내 카페 목록 [{name, lat, lng, dongCd, ...}]
 * @param {Array} params.nearbyDongs - 인접 동 목록 [{dongCd, dongNm, ...}]
 * @param {number} [params.dongAvgCafeSales] - 소상공인365 동 평균 매출 (만원, fallback용)
 * @param {number} [params.openubDongAvg] - OpenUB 건물별 매출 기반 동 평균 (만원, 가장 신뢰도 높음)
 * @returns {Promise<Object>} { avgSales, dongSalesMap, confidence, sources, details }
 */
export async function calculateRadiusAvgSales({
  lat,
  lng,
  radius = 500,
  cafes = [],
  nearbyDongs = [],
  dongAvgCafeSales = 0,
  openubDongAvg = 0
}) {
  const result = {
    avgSales: 0,
    dongSalesMap: {},
    confidence: 'C',
    sources: [],
    details: {}
  };

  if (!cafes || cafes.length === 0) {
    result.avgSales = dongAvgCafeSales || 0;
    result.sources = dongAvgCafeSales ? ['sbiz'] : [];
    return result;
  }

  // 1. 카페를 동별로 그룹핑
  const cafesByDong = groupCafesByDong(cafes);
  const adstrdCodes = Object.keys(cafesByDong);

  // nearbyDongs에서 추가 코드 수집 (카페가 없는 동도 포함 가능하지만, 가중평균에는 카페 있는 동만 사용)
  const allDongCodes = [...new Set([
    ...adstrdCodes,
    ...nearbyDongs.map(d => dongCdToAdstrdCd(d.dongCd)).filter(Boolean)
  ])];

  // 2. 서울 여부 판별
  const primaryDongCd = cafes[0]?.dongCd || nearbyDongs[0]?.dongCd || '';
  const isSeoul = isSeoulByCode(primaryDongCd);

  let seoulSalesMap = {};
  let hasSeoulData = false;

  // 3. 서울이면 열린데이터 API로 동별 매출 조회
  if (isSeoul && adstrdCodes.length > 0) {
    try {
      const quarter = getRecentQuarter();
      seoulSalesMap = await fetchSeoulSalesByAdstrdCd(adstrdCodes, quarter);
      hasSeoulData = Object.keys(seoulSalesMap).length > 0;

      if (!hasSeoulData) {
        // 분기를 하나 더 이전으로 시도
        const fallbackQuarter = `${parseInt(quarter.substring(0, 4)) - (parseInt(quarter[4]) <= 1 ? 1 : 0)}${parseInt(quarter[4]) <= 1 ? parseInt(quarter[4]) + 3 : parseInt(quarter[4]) - 1}`;
        seoulSalesMap = await fetchSeoulSalesByAdstrdCd(adstrdCodes, fallbackQuarter);
        hasSeoulData = Object.keys(seoulSalesMap).length > 0;
      }

      if (hasSeoulData) {
        result.sources.push('seoul_opendata');
        console.log('[매출추정-반경] 서울 열린데이터 조회 성공:', Object.keys(seoulSalesMap).length, '개 동');
      }
    } catch (err) {
      console.warn('[매출추정-반경] 서울 열린데이터 조회 실패:', err.message);
    }
  }

  // 3-2. 공정위 지역별 매출 API 조회 (L2 - 서울/비서울 공통)
  let fftcAvgSales = null;
  let hasFftcData = false;

  try {
    fftcAvgSales = await fetchFftcAreaSales(primaryDongCd);
    hasFftcData = fftcAvgSales != null && fftcAvgSales > 0;
    if (hasFftcData) {
      result.sources.push('fftc');
      console.log('[매출추정-반경] 공정위 API 성공: 평균매출=' + fftcAvgSales + '만원');
    }
  } catch (err) {
    console.warn('[매출추정-반경] 공정위 API 조회 실패:', err.message);
  }

  // 4. 다중 소스 가중 블렌딩 매출 계산
  // 기존: L1 > L2 > L3 단일 소스 선택 → 문제: 한 소스가 비정상이면 전체 왜곡
  // 개선: 여러 소스의 가중평균으로 안정적 결과 도출
  let weightedSum = 0;
  let totalCafeCount = 0;
  const dongDetails = {};

  // 사용 가능한 소스별 동 평균 후보 수집
  const referenceAvgs = [];
  if (openubDongAvg > 0) referenceAvgs.push(openubDongAvg);
  if (hasFftcData && fftcAvgSales > 0) referenceAvgs.push(fftcAvgSales);
  if (dongAvgCafeSales > 0) referenceAvgs.push(dongAvgCafeSales);
  const referenceMedian = referenceAvgs.length > 0
    ? referenceAvgs.sort((a, b) => a - b)[Math.floor(referenceAvgs.length / 2)]
    : 0;

  for (const [adstrdCd, dongCafes] of Object.entries(cafesByDong)) {
    const cafeCount = dongCafes.length;
    let dongAvg = 0;
    let source = 'none';

    // L1: 서울 열린데이터
    let seoulAvg = 0;
    if (hasSeoulData && seoulSalesMap[adstrdCd]) {
      const seoulEntry = seoulSalesMap[adstrdCd];
      if (seoulEntry.avgSales > 0) {
        seoulAvg = seoulEntry.avgSales;
      } else if (seoulEntry.totalSales > 0 && seoulEntry.storeCount > 0) {
        // STOR_CO가 있으면 API의 점포 수로 나눔 (수집 카페 수가 아님)
        seoulAvg = Math.round(seoulEntry.totalSales / seoulEntry.storeCount / 10000);
        console.log(`[매출추정-반경] 서울 열린데이터 per-store: totalSales=${Math.round(seoulEntry.totalSales/10000)}만원 / STOR_CO=${seoulEntry.storeCount}개 = ${seoulAvg}만원`);
      } else if (seoulEntry.totalSales > 0 && cafeCount > 0) {
        // STOR_CO도 없음 → 수집 카페 수로 나눔 (최후 수단)
        seoulAvg = Math.round(seoulEntry.totalSales / cafeCount / 10000);
        console.log(`[매출추정-반경] 서울 열린데이터 per-cafe 추정: totalSales=${Math.round(seoulEntry.totalSales/10000)}만원 / ${cafeCount}개 = ${seoulAvg}만원`);
      }

      // 신뢰성 검증: 다른 소스 대비 50% 미만이면 서울 데이터 폐기
      if (seoulAvg > 0 && referenceMedian > 0 && seoulAvg < referenceMedian * 0.5) {
        console.warn(`[매출추정-반경] 서울 열린데이터 비정상 낮음: ${seoulAvg}만원 vs 참조중앙값 ${referenceMedian}만원 → 서울 데이터 무시`);
        seoulAvg = 0;
      }
    }

    // 다중 소스 가중 블렌딩
    // 가중치: OpenUB 0.5 (건물별 실매출, 최고 신뢰도), 서울열린데이터 0.15, 공정위 0.15, 소상공인365 0.2
    const sources = [];
    if (openubDongAvg > 0) sources.push({ avg: openubDongAvg, weight: 0.5, name: 'openub' });
    if (seoulAvg > 0) sources.push({ avg: seoulAvg, weight: 0.15, name: 'seoul_opendata' });
    if (hasFftcData && fftcAvgSales > 0) sources.push({ avg: fftcAvgSales, weight: 0.15, name: 'fftc' });
    if (dongAvgCafeSales > 0) {
      let sbizAvg = dongAvgCafeSales;
      if (!isSeoul) {
        const correction = getSidoCorrectionFactor(adstrdCd);
        sbizAvg = Math.round(dongAvgCafeSales * correction);
      }
      sources.push({ avg: sbizAvg, weight: 0.2, name: isSeoul ? 'sbiz' : 'sbiz_corrected' });
    }

    if (sources.length > 0) {
      // 가중치 정규화 후 가중평균
      const totalWeight = sources.reduce((s, src) => s + src.weight, 0);
      dongAvg = Math.round(sources.reduce((s, src) => s + src.avg * (src.weight / totalWeight), 0));
      source = sources.map(s => s.name).join('+');
      console.log('[매출추정-반경] 동 ' + adstrdCd + ' 블렌딩: ' + sources.map(s => s.name + '=' + s.avg + '만원(w' + (s.weight/totalWeight*100).toFixed(0) + '%)').join(', ') + ' -> ' + dongAvg + '만원');
    }

    if (dongAvg > 0) {
      weightedSum += dongAvg * cafeCount;
      totalCafeCount += cafeCount;
    }

    dongDetails[adstrdCd] = {
      dongNm: nearbyDongs.find(d => dongCdToAdstrdCd(d.dongCd) === adstrdCd)?.dongNm || adstrdCd,
      cafeCount,
      avgSales: dongAvg,
      source
    };
  }

  result.dongSalesMap = dongDetails;

  // 가중평균 계산
  if (totalCafeCount > 0) {
    result.avgSales = Math.round(weightedSum / totalCafeCount);
  } else if (dongAvgCafeSales > 0) {
    result.avgSales = dongAvgCafeSales;
  }

  // 소스 목록 추가
  if (openubDongAvg > 0 && !result.sources.includes('openub')) {
    result.sources.push('openub');
  }
  if (dongAvgCafeSales > 0 && !result.sources.includes('sbiz')) {
    result.sources.push('sbiz');
  }

  // 5. 신뢰도 정량화 (confidenceScore 0~1)
  const dongCoverage = Object.values(dongDetails).filter(d => d.avgSales > 0).length;
  const totalDongs = Object.keys(dongDetails).length;

  let confidenceScore = 0;

  // 기본 점수: 소스별
  if (openubDongAvg > 0) confidenceScore += 0.35;
  if (hasSeoulData) confidenceScore += 0.15;
  if (hasFftcData) confidenceScore += 0.15;
  if (dongAvgCafeSales > 0) confidenceScore += 0.1;

  // 동 커버리지 보너스
  if (totalDongs > 0) {
    confidenceScore += (dongCoverage / totalDongs) * 0.2;
  }

  // OpenUB 매칭률 보너스 (details에서 추후 활용 가능하도록 계산)
  // 현재 calculateRadiusAvgSales에서는 매칭률 직접 계산하지 않으므로 0
  // estimateAllCafeSales에서 별도로 반영 가능
  // 여기서는 카페 데이터 보유 여부로 근사
  const hasGoodCafeData = cafes.some(c => c.reviewCount > 0 || c.americanoPrice > 0);
  if (hasGoodCafeData) confidenceScore += 0.05;

  // 상권활성도 데이터 보너스
  // (calculateRadiusAvgSales는 apiData를 직접 받지 않으므로, 소스 다양성으로 대체)
  if (result.sources.length >= 2) confidenceScore += 0.05;

  // 점수 clamp
  confidenceScore = Math.min(1.0, Math.max(0, confidenceScore));

  // 등급 매핑
  if (confidenceScore >= 0.7) {
    result.confidence = 'A';
  } else if (confidenceScore >= 0.4) {
    result.confidence = 'B';
  } else {
    result.confidence = 'C';
  }

  result.confidenceScore = Math.round(confidenceScore * 100) / 100;

  result.details = {
    totalCafes: cafes.length,
    totalDongs: totalDongs,
    dongCoverage,
    isSeoul,
    radius,
    hasFftcData,
    fftcAvgSales
  };

  // 6. 최종 안전장치: 모든 소스 실패 시 전국 카페 평균 (0원 방지)
  if (!result.avgSales || result.avgSales <= 0) {
    result.avgSales = NATIONAL_CAFE_AVG_MONTHLY;
    result.confidence = 'C';
    result.confidenceScore = 0.3;
    result.sources.push('national_fallback');
    console.warn('[매출추정] 모든 소스 실패 -> 전국 평균 적용:', NATIONAL_CAFE_AVG_MONTHLY, '만원');
  }

  console.log('[매출추정-반경] 결과: 평균매출=' + result.avgSales + '만원, 신뢰도=' + result.confidence + '(' + result.confidenceScore + '), 소스=' + result.sources.join('+') + ', 동=' + dongCoverage + '/' + totalDongs);

  return result;
}

// ═══════════════════════════════════════════════════════════════
// 버퍼존 카페 분리 (반경 내 vs 도보 3분 240m 버퍼존)
// ═══════════════════════════════════════════════════════════════

/**
 * 버퍼존 카페 필터링 - 반경 바깥이지만 도보 3분(240m) 이내 카페
 * @param {number} centerLat - 중심 위도
 * @param {number} centerLng - 중심 경도
 * @param {number} radius - 사용자 설정 반경 (미터)
 * @param {Array} allCafes - 전체 수집된 카페 (반경+버퍼존 포함)
 * @returns {Object} { innerCafes: [...], bufferCafes: [...] }
 */
export function separateBufferZoneCafes(centerLat, centerLng, radius, allCafes) {
  const BUFFER_DISTANCE = 240; // 도보 3분
  const innerCafes = [];
  const bufferCafes = [];

  if (!allCafes || allCafes.length === 0) {
    return { innerCafes, bufferCafes };
  }

  for (const cafe of allCafes) {
    const cafeLat = cafe.lat || (cafe.y ? parseFloat(cafe.y) : null);
    const cafeLng = cafe.lng || (cafe.x ? parseFloat(cafe.x) : null);

    if (cafeLat == null || cafeLng == null) {
      // 좌표 없는 카페는 반경 내로 간주 (보수적 처리)
      innerCafes.push(cafe);
      continue;
    }

    const dist = haversineDistance(centerLat, centerLng, cafeLat, cafeLng);

    if (dist <= radius) {
      innerCafes.push({ ...cafe, _distFromCenter: dist });
    } else if (dist <= radius + BUFFER_DISTANCE) {
      bufferCafes.push({ ...cafe, _distFromCenter: dist });
    }
    // radius + 240m 초과 → 제외
  }

  console.log('[버퍼존] 전체 ' + allCafes.length + '개 -> 반경 내 ' + innerCafes.length + '개, 버퍼존 ' + bufferCafes.length + '개, 제외 ' + (allCafes.length - innerCafes.length - bufferCafes.length) + '개');

  return { innerCafes, bufferCafes };
}
