// OpenUB API 프록시 - bd/sales 병렬 호출 방식
// 좌표+반경 → S2 셀 → bd/hash(건물 rdnu 목록) → bd/sales 병렬(15개씩) → 카페 필터링

import { S2 } from 's2-geometry';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip',
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/',
  'Access-Token': process.env.OPENUB_ACCESS_TOKEN || ''
};

const S2_LEVEL = 14;
const CONCURRENCY_LIMIT = 50;
const PER_CALL_TIMEOUT = 8000;
const TOTAL_TIMEOUT = 24000;
const BATCH_DELAY_MS = 200;
const BD_SALES_CATEGORY = 'A0:B0:C0:D0:F0:G0';

const FRANCHISE_BRANDS = ['스타벅스','투썸플레이스','이디야','메가엠지씨커피','메가MGC커피','메가커피','빽다방','할리스','커피빈','공차','바나프레소','컴포즈커피','더벤티','매머드','폴바셋','파스쿠찌','엔제리너스','카페베네','탐앤탐스','드롭탑','커피나무','블루보틀','커피나인','설빙','디저트39','텐퍼센트','파리바게뜨','뚜레쥬르','파리크라상','브레댄코','노티드','던킨','크리스피크림','배스킨라빈스'];

function detectFranchise(name) {
  if (!name) return null;
  const upper = name.replace(/\s/g, '').toUpperCase();
  for (const brand of FRANCHISE_BRANDS) {
    if (upper.includes(brand.replace(/\s/g, '').toUpperCase())) return brand;
  }
  // 영문 별칭
  const aliases = { 'STARBUCKS': '스타벅스', 'TWOSOME': '투썸플레이스', 'EDIYA': '이디야', 'MEGA': '메가커피', 'PAIK': '빽다방', 'HOLLYS': '할리스', 'COFFEEBEAN': '커피빈', 'GONGCHA': '공차', 'COMPOSE': '컴포즈커피', 'THEVENTI': '더벤티', 'PAULBASSETT': '폴바셋', 'PASCUCCI': '파스쿠찌', 'ANGELINUS': '엔제리너스', 'BLUEBOTTLE': '블루보틀', 'DUNKIN': '던킨', 'KRISPY': '크리스피크림', 'BASKIN': '배스킨라빈스', 'PARIS': '파리바게뜨' };
  for (const [eng, brand] of Object.entries(aliases)) {
    if (upper.includes(eng)) return brand;
  }
  return null;
}

// ─── S2 셀 토큰 생성 ───

function latLngToToken(lat, lng, level) {
  const key = S2.latLngToKey(lat, lng, level);
  const id = S2.keyToId(key);
  const hex = BigInt(id).toString(16).padStart(16, '0');
  let end = hex.length;
  while (end > 1 && hex[end - 1] === '0') end--;
  return hex.substring(0, end);
}

function latLngToS2Tokens(lat, lng, radiusMeters, level) {
  const earthArea = 4 * Math.PI * 6371000 * 6371000;
  const cellArea = earthArea / (6 * Math.pow(4, level));
  const cellEdge = Math.sqrt(cellArea);

  const gridHalf = Math.ceil(radiusMeters / cellEdge) + 1;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
  const tokens = new Set();

  for (let di = -gridHalf; di <= gridHalf; di++) {
    for (let dj = -gridHalf; dj <= gridHalf; dj++) {
      const dx = di * cellEdge;
      const dy = dj * cellEdge;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radiusMeters + cellEdge * 1.5) {
        const ptLat = lat + (di * cellEdge) / mPerDegLat;
        const ptLng = lng + (dj * cellEdge) / mPerDegLng;
        tokens.add(latLngToToken(ptLat, ptLng, level));
      }
    }
  }

  try {
    const neighbors = S2.latLngToNeighborKeys(lat, lng, level);
    for (const nKey of neighbors) {
      const nId = S2.keyToId(nKey);
      const hex = BigInt(nId).toString(16).padStart(16, '0');
      let end = hex.length;
      while (end > 1 && hex[end - 1] === '0') end--;
      tokens.add(hex.substring(0, end));
    }
  } catch (e) { /* ignore near-pole errors */ }

  return Array.from(tokens);
}

// ─── 거리 계산 (Haversine) ───

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── OpenUB API 호출 (타임아웃 포함) ───

async function callOpenUB(endpoint, body, timeout = PER_CALL_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`https://api.openub.com/v2/${endpoint}`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenUB ${endpoint} returned ${res.status}: ${text.substring(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── gp 분할 호출 (셀 5개씩 배치) ───

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function callGpBatched(cellTokens, categories, batchSize = 5) {
  const chunks = chunkArray(cellTokens, batchSize);
  const results = await Promise.all(
    chunks.map(chunk => callOpenUB('gp', { hashKeys: chunk, globalParam: { categories }, login: true }, 10000))
  );
  const merged = {};
  for (const result of results) {
    if (!result || typeof result !== 'object') continue;
    for (const [cellKey, cellData] of Object.entries(result)) {
      if (!merged[cellKey]) merged[cellKey] = {};
      Object.assign(merged[cellKey], cellData);
    }
  }
  return merged;
}

// ─── bd/hash 응답에서 건물 rdnu 추출 ───

function parseBdHashResponse(hashResult, centerLat, centerLng, radiusMeters) {
  const bd = hashResult?.bd;
  if (!bd || typeof bd !== 'object') return [];

  const buildings = [];
  for (const [rdnu, info] of Object.entries(bd)) {
    if (!info || typeof info !== 'object') continue;

    const center = info.center;
    const bLat = Array.isArray(center) ? center[1] : null;
    const bLng = Array.isArray(center) ? center[0] : null;

    if (bLat && bLng) {
      const dist = haversineDistance(centerLat, centerLng, bLat, bLng);
      if (dist > radiusMeters) continue;
    }

    buildings.push({
      rdnu,
      lat: bLat,
      lng: bLng,
      address: info.ROAD_ADDR || info.ADDR || ''
    });
  }

  return buildings;
}

// ─── 카페 업종 필터 ───

// 매장명 기반 제외 키워드
const NAME_EXCLUDE_KEYWORDS = ['에스테틱', '액세서리', '홀릭', '빈대떡', '떡갈비', '냉면', '김밤', '치킨', '고기'];

function isCafeCategory(category, storeName) {
  if (!category) return false;
  const mi = (category.mi || '');
  const sl = (category.sl || '');

  // 매장명 기반 제외
  if (storeName) {
    for (const kw of NAME_EXCLUDE_KEYWORDS) {
      if (storeName.includes(kw)) return false;
    }
  }

  // category.sl 기반 제외
  if (sl === '떡/한과 전문점' || sl === '테이크아웃음료/과일 전문점') return false;

  // 포함 조건 1: category.mi가 "카페/커피/찻집" → 무조건 포함
  if (mi.includes('카페') || mi.includes('커피') || mi.includes('찻집')) return true;

  // 포함 조건 2: category.mi가 "제과제빵떡케익" → sl도 "제과제빵떡케익"인 것만 (실제 베이커리)
  if (mi.includes('제과제빵떡케익')) {
    return sl.includes('제과제빵떡케익');
  }

  return false;
}

// ─── bd/sales 배치 호출 (50개씩 + 200ms 딜레이 + 실패 1회 재시도) ───

async function fetchBdSalesParallel(rdnus, totalDeadline) {
  const results = [];
  const failedRdnus = [];

  for (let i = 0; i < rdnus.length; i += CONCURRENCY_LIMIT) {
    if (Date.now() >= totalDeadline) {
      console.log(`[openub] Total timeout reached at batch ${Math.floor(i / CONCURRENCY_LIMIT)}, processed ${i}/${rdnus.length} rdnus`);
      break;
    }

    const batch = rdnus.slice(i, i + CONCURRENCY_LIMIT);
    const remaining = totalDeadline - Date.now();
    const timeout = Math.min(PER_CALL_TIMEOUT, remaining);

    const promises = batch.map(rdnu =>
      callOpenUB('bd/sales', {
        login: true,
        rdnu,
        category: BD_SALES_CATEGORY
      }, timeout).then(data => ({ rdnu, data, ok: true }))
        .catch(err => ({ rdnu, error: err.message, ok: false }))
    );

    const batchResults = await Promise.allSettled(promises);
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        if (r.value.ok) {
          results.push(r.value);
        } else {
          failedRdnus.push(r.value.rdnu);
          results.push(r.value);
        }
      }
    }

    // 배치 간 딜레이 (마지막 배치 제외)
    if (i + CONCURRENCY_LIMIT < rdnus.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // 실패한 건물 재시도 1회 (시간 여유가 있을 때만)
  const retryBudget = totalDeadline - Date.now();
  if (failedRdnus.length > 0 && retryBudget > 3000) {
    console.log(`[openub] Retrying ${failedRdnus.length} failed rdnus (${retryBudget}ms remaining)`);
    const retryBatchSize = Math.min(failedRdnus.length, CONCURRENCY_LIMIT);

    for (let i = 0; i < failedRdnus.length; i += retryBatchSize) {
      if (Date.now() >= totalDeadline) break;

      const batch = failedRdnus.slice(i, i + retryBatchSize);
      const remaining = totalDeadline - Date.now();
      const timeout = Math.min(PER_CALL_TIMEOUT, remaining);

      const promises = batch.map(rdnu =>
        callOpenUB('bd/sales', {
          login: true,
          rdnu,
          category: BD_SALES_CATEGORY
        }, timeout).then(data => ({ rdnu, data, ok: true }))
          .catch(err => ({ rdnu, error: err.message, ok: false }))
      );

      const retryResults = await Promise.allSettled(promises);
      for (const r of retryResults) {
        if (r.status === 'fulfilled' && r.value.ok) {
          // 기존 실패 결과를 성공으로 교체
          const idx = results.findIndex(x => x.rdnu === r.value.rdnu && !x.ok);
          if (idx !== -1) results[idx] = r.value;
        }
      }

      if (i + retryBatchSize < failedRdnus.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    const retryRecovered = failedRdnus.filter(rdnu => results.find(x => x.rdnu === rdnu && x.ok)).length;
    console.log(`[openub] Retry recovered: ${retryRecovered}/${failedRdnus.length}`);
  }

  return results;
}

// ─── bd/sales 응답에서 카페 추출 ───

function extractCafesFromBdSales(bdSalesResult, building) {
  const cafes = [];
  const { rdnu, data } = bdSalesResult;
  if (!data || !bdSalesResult.ok) return cafes;

  // bd/sales 응답에서 stores 탐색
  const stores = data.stores || data.result?.stores || [];
  if (Array.isArray(stores)) {
    for (const store of stores) {
      const name1 = store.storeNm || store.name || '';
      if (!isCafeCategory(store.category, name1)) continue;
      cafes.push({
        storeId: store.storeId || store.id || '',
        storeNm: name1,
        category: store.category,
        address: store.roadAddr || store.siteAddr || store.address || building?.address || '',
        coord: store.coord || store.center || (building && building.lat && building.lng ? [building.lng, building.lat] : null),
        isNewOpen: store.isNewOpen || false,
        floor: store.floor || null,
        rdnu
      });
    }
  }

  // bd 키 안에 stores가 있는 경우
  const bdMap = data.bd || data.result?.bd || {};
  if (typeof bdMap === 'object' && !Array.isArray(bdMap)) {
    for (const [bdRdnu, bdInfo] of Object.entries(bdMap)) {
      if (!bdInfo || typeof bdInfo !== 'object') continue;
      const bdStores = bdInfo.stores || [];
      if (!Array.isArray(bdStores)) continue;

      for (const store of bdStores) {
        const name2 = store.storeNm || store.name || '';
        if (!isCafeCategory(store.category, name2)) continue;
        cafes.push({
          storeId: store.storeId || store.id || '',
          storeNm: store.storeNm || store.name || '',
          category: store.category,
          address: bdInfo.roadAddr || bdInfo.siteAddr || store.address || building?.address || '',
          coord: store.coord || bdInfo.center || (building && building.lat && building.lng ? [building.lng, building.lat] : null),
          isNewOpen: store.isNewOpen || false,
          floor: store.floor || null,
          rdnu: bdRdnu || rdnu
        });
      }
    }
  }

  return cafes;
}

// ─── 메인 핸들러 ───

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const reqBody = JSON.parse(event.body);

    // ── 기존 단순 프록시 모드 (하위 호환) ──
    if (reqBody.endpoint) {
      const { endpoint, body } = reqBody;
      const ALLOWED = ['bd/hash', 'gp', 'bd/sales'];
      if (!ALLOWED.includes(endpoint)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: `Endpoint not allowed: ${endpoint}` })
        };
      }
      const data = await callOpenUB(endpoint, body);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(data)
      };
    }

    // ── gp-count 모드: gp 엔드포인트로 빠른 카페/베이커리 카운팅 ──
    if (reqBody.mode === 'gp-count') {
      const { lat, lng, radius = 500 } = reqBody;
      if (!lat || !lng) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'lat, lng are required' })
        };
      }

      const effectiveRadius = Math.min(radius, 1000);
      const t0 = Date.now();

      // 1) S2 셀 토큰 생성
      const cellTokens = latLngToS2Tokens(lat, lng, effectiveRadius, S2_LEVEL);
      console.log(`[openub:gp-count] S2 tokens: ${cellTokens.length} cells for ${effectiveRadius}m radius`);

      // 2) bd/hash → 건물 좌표 + gp(A8) + gp(AW) 병렬 호출 (gp는 셀 5개씩 분할)
      const [hashResult, gpA8Result, gpAWResult] = await Promise.all([
        callOpenUB('bd/hash', { cellTokens }, 10000),
        callGpBatched(cellTokens, 'A8'),
        callGpBatched(cellTokens, 'AW')
      ]);

      // 3) bd/hash에서 반경 내 건물 좌표 추출
      const nearbyBuildings = parseBdHashResponse(hashResult, lat, lng, effectiveRadius);
      const coordMap = {}; // rdnu → { lat, lng }
      for (const b of nearbyBuildings) {
        coordMap[b.rdnu] = { lat: b.lat, lng: b.lng };
      }
      const nearbyRdnuSet = new Set(nearbyBuildings.map(b => b.rdnu));

      // 4) gp 응답 파싱 헬퍼
      function parseGpResponse(gpResult) {
        const byRdnu = {}; // rdnu → { sales, count, isNewOpen }
        if (!gpResult || typeof gpResult !== 'object') return byRdnu;

        for (const [cellKey, cellData] of Object.entries(gpResult)) {
          // cellKey = "cellToken|A8" or "cellToken|AW"
          if (!cellData || typeof cellData !== 'object') continue;
          for (const [rdnu, info] of Object.entries(cellData)) {
            if (!info || typeof info !== 'object') continue;
            // 반경 내 건물만 포함
            if (!nearbyRdnuSet.has(rdnu)) continue;
            // 중복 제거: 같은 rdnu가 여러 셀에 나올 수 있음
            if (!byRdnu[rdnu]) {
              byRdnu[rdnu] = {
                sales: info.sales || 0,
                count: info.count || 0,
                isNewOpen: info.isNewOpen || false
              };
            }
          }
        }
        return byRdnu;
      }

      const cafeByRdnu = parseGpResponse(gpA8Result);
      const bakeryByRdnu = parseGpResponse(gpAWResult);

      // 5) 집계
      let cafeCount = 0;
      let bakeryCount = 0;
      let newOpenCount = 0;
      const buildings = {};

      // 카페 건물
      for (const [rdnu, info] of Object.entries(cafeByRdnu)) {
        cafeCount += info.count;
        if (info.isNewOpen) newOpenCount++;
        const coord = coordMap[rdnu] || {};
        buildings[rdnu] = {
          sales: info.sales,
          cafeCount: info.count,
          bakeryCount: 0,
          isNewOpen: info.isNewOpen,
          lat: coord.lat || null,
          lng: coord.lng || null
        };
      }

      // 베이커리 건물
      for (const [rdnu, info] of Object.entries(bakeryByRdnu)) {
        bakeryCount += info.count;
        if (buildings[rdnu]) {
          buildings[rdnu].bakeryCount = info.count;
          buildings[rdnu].sales = Math.max(buildings[rdnu].sales, info.sales);
        } else {
          const coord = coordMap[rdnu] || {};
          buildings[rdnu] = {
            sales: info.sales,
            cafeCount: 0,
            bakeryCount: info.count,
            isNewOpen: info.isNewOpen || false,
            lat: coord.lat || null,
            lng: coord.lng || null
          };
        }
      }

      const elapsed = Date.now() - t0;
      console.log(`[openub:gp-count] Done: cafe=${cafeCount} (${Object.keys(cafeByRdnu).length} bldgs), bakery=${bakeryCount} (${Object.keys(bakeryByRdnu).length} bldgs) in ${elapsed}ms`);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          cafeCount,
          cafeBuildings: Object.keys(cafeByRdnu).length,
          bakeryCount,
          bakeryBuildings: Object.keys(bakeryByRdnu).length,
          newOpenCount,
          buildings,
          meta: {
            s2Level: S2_LEVEL,
            s2Cells: cellTokens.length,
            totalBuildings: nearbyBuildings.length,
            radiusUsed: effectiveRadius,
            elapsedMs: elapsed
          }
        })
      };
    }

    // ── gp-cafes 모드: bd/hash → 전수 bd/sales → 카페 필터 (gp 미사용) ──
    if (reqBody.mode === 'gp-cafes') {
      const { lat, lng, radius = 500 } = reqBody;
      if (!lat || !lng) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'lat, lng are required' })
        };
      }

      const effectiveRadius = Math.min(radius, 1000);
      const t0 = Date.now();
      const totalDeadline = t0 + TOTAL_TIMEOUT;
      const GP_CAFES_CONCURRENCY = 100;
      const GP_CAFES_DELAY = 100;

      // 1) S2 셀 토큰 생성
      const cellTokens = latLngToS2Tokens(lat, lng, effectiveRadius, S2_LEVEL);
      console.log(`[openub:gp-cafes] S2 tokens: ${cellTokens.length} cells for ${effectiveRadius}m radius`);

      // 2) bd/hash → 반경 내 건물 목록
      const hashResult = await callOpenUB('bd/hash', { cellTokens }, 10000);
      const nearbyBuildings = parseBdHashResponse(hashResult, lat, lng, effectiveRadius);
      const buildingMap = {};
      for (const b of nearbyBuildings) {
        buildingMap[b.rdnu] = b;
      }
      const allRdnus = nearbyBuildings.map(b => b.rdnu);

      console.log(`[openub:gp-cafes] Buildings in ${effectiveRadius}m: ${allRdnus.length}, calling bd/sales for all`);

      // 3) 모든 건물에 bd/sales 배치 호출 (100개씩 병렬, 24초 제한)
      const bdSalesResults = [];
      const failedRdnus = [];
      let processedCount = 0;

      for (let i = 0; i < allRdnus.length; i += GP_CAFES_CONCURRENCY) {
        if (Date.now() >= totalDeadline) {
          console.log(`[openub:gp-cafes] Timeout at batch ${Math.floor(i / GP_CAFES_CONCURRENCY)}, processed ${i}/${allRdnus.length}`);
          break;
        }

        const batch = allRdnus.slice(i, i + GP_CAFES_CONCURRENCY);
        const remaining = totalDeadline - Date.now();
        const timeout = Math.min(PER_CALL_TIMEOUT, remaining);

        const promises = batch.map(rdnu =>
          callOpenUB('bd/sales', { login: true, rdnu, category: BD_SALES_CATEGORY }, timeout)
            .then(data => ({ rdnu, data, ok: true }))
            .catch(err => ({ rdnu, error: err.message, ok: false }))
        );
        const batchResults = await Promise.allSettled(promises);
        for (const r of batchResults) {
          if (r.status === 'fulfilled') {
            if (r.value.ok) {
              bdSalesResults.push(r.value);
            } else {
              failedRdnus.push(r.value.rdnu);
            }
          }
        }
        processedCount = i + batch.length;

        if (i + GP_CAFES_CONCURRENCY < allRdnus.length) {
          await new Promise(r => setTimeout(r, GP_CAFES_DELAY));
        }
      }

      // 재시도: 시간 여유 있으면 실패분 1회 재시도
      const retryBudget = totalDeadline - Date.now();
      let retryRecovered = 0;
      if (failedRdnus.length > 0 && retryBudget > 3000) {
        console.log(`[openub:gp-cafes] Retrying ${failedRdnus.length} failed (${retryBudget}ms remaining)`);
        const retryBatch = failedRdnus.slice(0, GP_CAFES_CONCURRENCY);
        const remaining = totalDeadline - Date.now();
        const timeout = Math.min(PER_CALL_TIMEOUT, remaining);

        const promises = retryBatch.map(rdnu =>
          callOpenUB('bd/sales', { login: true, rdnu, category: BD_SALES_CATEGORY }, timeout)
            .then(data => ({ rdnu, data, ok: true }))
            .catch(err => ({ rdnu, error: err.message, ok: false }))
        );
        const retryResults = await Promise.allSettled(promises);
        for (const r of retryResults) {
          if (r.status === 'fulfilled' && r.value.ok) {
            bdSalesResults.push(r.value);
            retryRecovered++;
          }
        }
        console.log(`[openub:gp-cafes] Retry recovered: ${retryRecovered}/${retryBatch.length}`);
      }

      // 4) bd/sales 응답에서 카페/베이커리 추출 + 프랜차이즈 판별
      const allCafes = [];
      const bakeries = [];
      let cafeCount = 0;
      let bakeryCount = 0;
      let newOpenCount = 0;
      const seenStoreIds = new Set();

      for (const result of bdSalesResults) {
        if (!result.ok) continue;
        const cafes = extractCafesFromBdSales(result, buildingMap[result.rdnu]);
        for (const cafe of cafes) {
          // 중복 제거
          const storeKey = cafe.storeId || `${cafe.storeNm}_${cafe.rdnu}_${cafe.floor || ''}`;
          if (seenStoreIds.has(storeKey)) continue;
          seenStoreIds.add(storeKey);

          const name = cafe.storeNm || '';
          const brand = detectFranchise(name);
          const mi = (cafe.category?.mi || '');

          // 베이커리 분류: mi에 "제과제빵떡케익" 포함
          const isBakery = mi.includes('제과제빵떡케익');

          const entry = {
            name,
            address: cafe.address || '',
            isNewOpen: cafe.isNewOpen || false,
            isFranchise: !!brand,
            brand: brand || null,
            category: cafe.category || null,
            lat: (Array.isArray(cafe.coord) && cafe.coord[1]) ? cafe.coord[1] : null,
            lng: (Array.isArray(cafe.coord) && cafe.coord[0]) ? cafe.coord[0] : null,
            rdnu: cafe.rdnu || result.rdnu,
            floor: cafe.floor || null,
            source: 'openub'
          };

          if (isBakery) {
            bakeryCount++;
            bakeries.push(entry);
          } else {
            cafeCount++;
            if (entry.isNewOpen) newOpenCount++;
            allCafes.push(entry);
          }
        }
      }

      const elapsed = Date.now() - t0;
      const successCount = bdSalesResults.length;
      console.log(`[openub:gp-cafes] Done: ${cafeCount} cafes, ${bakeryCount} bakeries, ${newOpenCount} newOpen, processed ${processedCount}/${allRdnus.length} buildings in ${elapsed}ms`);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          cafeCount,
          bakeryCount,
          newOpenCount,
          cafes: allCafes,
          bakeries,
          meta: {
            s2Level: S2_LEVEL,
            s2Cells: cellTokens.length,
            totalBuildings: nearbyBuildings.length,
            processedBuildings: processedCount,
            bdSalesSuccess: successCount,
            bdSalesFirstPassFailed: failedRdnus.length,
            bdSalesRetryRecovered: retryRecovered,
            radiusUsed: effectiveRadius,
            elapsedMs: elapsed
          }
        })
      };
    }

    // ── 통합 카페 수집 모드 ──
    const { lat, lng, radius = 500 } = reqBody;
    if (!lat || !lng) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'lat, lng are required' })
      };
    }

    const effectiveRadius = Math.min(radius, 1000);
    const t0 = Date.now();
    const totalDeadline = t0 + TOTAL_TIMEOUT;

    // 1) S2 셀 토큰 생성
    const cellTokens = latLngToS2Tokens(lat, lng, effectiveRadius, S2_LEVEL);
    console.log(`[openub] S2 tokens: ${cellTokens.length} cells (level ${S2_LEVEL}) for ${effectiveRadius}m radius`);

    // 2) bd/hash로 건물 목록 조회 → 반경 내 rdnu 추출
    const hashResult = await callOpenUB('bd/hash', { cellTokens }, 10000);
    const nearbyBuildings = parseBdHashResponse(hashResult, lat, lng, effectiveRadius);
    const rdnus = nearbyBuildings.map(b => b.rdnu);
    const buildingMap = {};
    for (const b of nearbyBuildings) {
      buildingMap[b.rdnu] = b;
    }

    console.log(`[openub] Buildings in ${effectiveRadius}m radius: ${nearbyBuildings.length} rdnus`);

    // 3) bd/sales 배치 호출 (50개씩, 배치간 200ms 딜레이, 전체 24초 제한)
    const bdSalesResults = await fetchBdSalesParallel(rdnus, totalDeadline);

    const successCount = bdSalesResults.filter(r => r.ok).length;
    const failCount = bdSalesResults.filter(r => !r.ok).length;
    const failSamples = bdSalesResults.filter(r => !r.ok).slice(0, 3).map(r => r.error);
    console.log(`[openub] bd/sales results: ${successCount} ok, ${failCount} failed out of ${rdnus.length} rdnus`);
    if (failSamples.length > 0) console.log(`[openub] fail samples: ${JSON.stringify(failSamples)}`);

    // 4) 카페 추출 (각 매장을 개별 카운트)
    const allCafes = [];

    for (const result of bdSalesResults) {
      if (!result.ok) continue;

      const cafes = extractCafesFromBdSales(result, buildingMap[result.rdnu]);
      allCafes.push(...cafes);
    }

    const elapsed = Date.now() - t0;
    console.log(`[openub] Done: ${allCafes.length} cafes from ${successCount} bd/sales calls (${rdnus.length} rdnus) in ${elapsed}ms`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        cafes: allCafes,
        totalCafes: allCafes.length,
        buildingsSearched: rdnus.length,
        meta: {
          s2Level: S2_LEVEL,
          s2Cells: cellTokens.length,
          totalBuildings: nearbyBuildings.length,
          rdnuCount: rdnus.length,
          bdSalesSuccess: successCount,
          bdSalesFailed: failCount,
          failSamples,
          radiusUsed: effectiveRadius,
          elapsedMs: elapsed
        }
      })
    };

  } catch (error) {
    console.warn('[openub] proxy error:', error.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message })
    };
  }
}
