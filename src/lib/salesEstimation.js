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
  const totalSales = buildingSales.monthSales || 0;
  if (totalSales <= 0) return null;

  const n = stores.length;
  if (n === 1) return totalSales; // L1 case

  // Rank stores by category weight (descending)
  const ranked = stores.map((store, idx) => {
    // Extract major category from store.category (e.g., {bg: "A0", mi: "...", sl: "..."})
    const catKey = store.category?.bg || 'G0';
    const weight = CATEGORY_WEIGHTS[catKey] || 1;
    return { store, weight, originalIndex: idx };
  }).sort((a, b) => b.weight - a.weight);

  // Compute Zipf denominators
  let zipfSum = 0;
  for (let k = 1; k <= n; k++) {
    zipfSum += 1 / Math.pow(k, ZIPF_EXPONENT);
  }

  // Find the target cafe's rank (match by name similarity)
  const targetName = (targetCafe.name || '').replace(/\s/g, '').toUpperCase();
  let targetRank = -1;

  for (let k = 0; k < ranked.length; k++) {
    const storeName = (ranked[k].store.storeNm || '').replace(/\s/g, '').toUpperCase();
    if (storeName === targetName || storeName.includes(targetName) || targetName.includes(storeName)) {
      targetRank = k + 1; // 1-indexed
      break;
    }
  }

  // If we can't find the exact cafe, assume it's in the middle rank
  if (targetRank < 0) {
    // Cafes (B0 category) are typically in the upper-middle range
    targetRank = Math.max(1, Math.ceil(n * 0.4));
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
// Building-to-cafe matching
// ═══════════════════════════════════════════════════════════════

/**
 * Match cafes to buildings by road address.
 * Returns a map of cafe name -> buildingId.
 *
 * @param {Array} cafes - [{ name, addr }]
 * @param {Object} buildings - { buildingId: { ROAD_ADDR, center: [lng, lat] } }
 * @returns {Object} { cafeName: { buildingId, confidence } }
 */
function matchCafesToBuildings(cafes, buildings) {
  if (!cafes || !buildings) return {};

  const matches = {};

  // Build an index of building addresses for fast lookup
  const buildingByAddr = {};
  for (const [id, info] of Object.entries(buildings)) {
    const addr = (info.ROAD_ADDR || '').replace(/\s/g, '');
    if (addr) {
      buildingByAddr[addr] = id;
      // Also index by shortened address (without building detail number)
      const shortAddr = addr.replace(/\d+-\d+$/, '').replace(/\d+$/, '');
      if (shortAddr && !buildingByAddr[shortAddr]) {
        buildingByAddr[shortAddr] = id;
      }
    }
  }

  for (const cafe of cafes) {
    const cafeAddr = (cafe.addr || '').replace(/\s/g, '');
    if (!cafeAddr) continue;

    // Try exact match first
    let matchedId = buildingByAddr[cafeAddr];

    // Try partial match (street-level)
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

    // Try substring matching as fallback
    if (!matchedId) {
      for (const [addr, id] of Object.entries(buildingByAddr)) {
        if (cafeAddr.includes(addr) || addr.includes(cafeAddr)) {
          matchedId = id;
          break;
        }
      }
    }

    if (matchedId) {
      matches[cafe.name] = { buildingId: matchedId, confidence: 0.8 };
    }
  }

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
  nationalCafeAvg = NATIONAL_CAFE_AVG
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
  if (!layer && cafe.isFranchise && franchiseData && franchiseData.연평균매출 > 0) {
    layer = 'L3';
    estimated = estimateFranchise(franchiseData, dongAvgCafeSales, nationalCafeAvg);
    confidence = 0.90;
  }

  // L4: Independent cafe proxy
  if (!layer) {
    layer = 'L4';
    estimated = estimateIndependent(cafe, dongAvgCafeSales, nearbyTotalCafes);
    confidence = 0.85;
  }

  return { layer, estimated, confidence };
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
  }

  // Step 2: Estimate each cafe
  const results = [];
  for (const cafe of cafes) {
    // Resolve building data for this cafe (if matched)
    let building = null;
    const match = cafeToBuilding[cafe.name];
    if (match && openubData?.buildingSales?.[match.buildingId]) {
      building = openubData.buildingSales[match.buildingId];
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
        if (brandKey) franchiseData = FRANCHISE_DATA_REF[brandKey];
      }
    }

    const result = estimateCafeSales({
      cafe,
      building,
      dongAvgCafeSales,
      franchiseData,
      nearbyTotalCafes
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
