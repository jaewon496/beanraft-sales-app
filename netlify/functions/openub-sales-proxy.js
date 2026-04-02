// OpenUB Sales Data 프록시 - bd/sales 병렬 호출 → salesData 합산 전용
// openub-proxy.js에서 분리된 salesData 수집 전용 함수

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

// ─── bd/sales 배치 호출 (카페 건물 대상, 50개씩 + 200ms 딜레이 + 실패 1회 재시도) ───

async function fetchBdSalesParallel(rdnus, totalDeadline) {
  const results = [];
  const failedRdnus = [];

  for (let i = 0; i < rdnus.length; i += CONCURRENCY_LIMIT) {
    if (Date.now() >= totalDeadline) {
      console.log(`[openub-sales] Total timeout reached at batch ${Math.floor(i / CONCURRENCY_LIMIT)}, processed ${i}/${rdnus.length} rdnus`);
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

    if (i + CONCURRENCY_LIMIT < rdnus.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // 실패한 건물 재시도 1회
  const retryBudget = totalDeadline - Date.now();
  if (failedRdnus.length > 0 && retryBudget > 3000) {
    console.log(`[openub-sales] Retrying ${failedRdnus.length} failed rdnus (${retryBudget}ms remaining)`);
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
          const idx = results.findIndex(x => x.rdnu === r.value.rdnu && !x.ok);
          if (idx !== -1) results[idx] = r.value;
        }
      }

      if (i + retryBatchSize < failedRdnus.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    const retryRecovered = failedRdnus.filter(rdnu => results.find(x => x.rdnu === rdnu && x.ok)).length;
    console.log(`[openub-sales] Retry recovered: ${retryRecovered}/${failedRdnus.length}`);
  }

  return results;
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
    console.log(`[openub-sales] S2 tokens: ${cellTokens.length} cells for ${effectiveRadius}m radius`);

    // 2) bd/hash + gp(A8 카페) 병렬 호출 → 카페가 있는 건물만 bd/sales 호출
    const [hashResult, gpA8Result] = await Promise.all([
      callOpenUB('bd/hash', { cellTokens }, 10000),
      callOpenUB('gp', { hashKeys: cellTokens, globalParam: { categories: 'A8' }, login: true }, 10000)
    ]);

    // 3) 반경 내 건물 추출
    const nearbyBuildings = parseBdHashResponse(hashResult, lat, lng, effectiveRadius);
    const nearbyRdnuSet = new Set(nearbyBuildings.map(b => b.rdnu));

    // 4) gp 응답 파싱 → 카페 건물 rdnu 추출
    function parseGpResponseForCafes(gpResult) {
      const byRdnu = {};
      if (!gpResult || typeof gpResult !== 'object') return byRdnu;
      for (const [cellKey, cellData] of Object.entries(gpResult)) {
        if (!cellData || typeof cellData !== 'object') continue;
        for (const [rdnu, info] of Object.entries(cellData)) {
          if (!info || typeof info !== 'object') continue;
          if (!nearbyRdnuSet.has(rdnu)) continue;
          if (!byRdnu[rdnu]) {
            byRdnu[rdnu] = { sales: info.sales || 0, count: info.count || 0 };
          }
        }
      }
      return byRdnu;
    }

    const cafeByRdnu = parseGpResponseForCafes(gpA8Result);
    const cafeRdnus = Object.keys(cafeByRdnu);
    console.log(`[openub-sales] cafe buildings: ${cafeRdnus.length}`);

    // 5) 카페 건물 대상 bd/sales 호출
    const bdSalesResults = await fetchBdSalesParallel(cafeRdnus, totalDeadline);

    // 6) bd/sales 응답의 data 필드에서 합산 (times, gender, weekday, age, type, holiday 등)
    const aggregatedData = {};
    let successCount = 0;

    for (const result of bdSalesResults) {
      if (!result.ok) continue;
      successCount++;

      // bd/sales 응답의 data 필드에서 합산 가능한 모든 하위 필드 합산
      const bdData = result.data?.data || result.data?.result?.data || null;
      if (bdData && typeof bdData === 'object') {
        const SKIP_KEYS = ['stores', 'bd', 'storeCount', 'rdnu'];
        for (const [key, val] of Object.entries(bdData)) {
          if (SKIP_KEYS.includes(key)) continue;
          if (val === null || val === undefined) continue;

          // 숫자 배열인 경우: 인덱스별 합산
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'number') {
            if (!aggregatedData[key]) aggregatedData[key] = new Array(val.length).fill(0);
            for (let k = 0; k < val.length; k++) {
              aggregatedData[key][k] = (aggregatedData[key][k] || 0) + (val[k] || 0);
            }
          }
          // 객체인 경우: 키별 합산
          else if (typeof val === 'object' && !Array.isArray(val)) {
            if (!aggregatedData[key]) aggregatedData[key] = {};
            for (const [subKey, subVal] of Object.entries(val)) {
              if (typeof subVal === 'number') {
                aggregatedData[key][subKey] = (aggregatedData[key][subKey] || 0) + subVal;
              } else if (Array.isArray(subVal) && subVal.length > 0 && typeof subVal[0] === 'number') {
                if (!aggregatedData[key][subKey]) aggregatedData[key][subKey] = new Array(subVal.length).fill(0);
                for (let k = 0; k < subVal.length; k++) {
                  aggregatedData[key][subKey][k] = (aggregatedData[key][subKey][k] || 0) + (subVal[k] || 0);
                }
              }
            }
          }
          // 단순 숫자인 경우: 합산
          else if (typeof val === 'number') {
            aggregatedData[key] = (aggregatedData[key] || 0) + val;
          }
        }
      }

      // data가 아닌 최상위에도 times/gender/weekday 등이 있을 수 있으므로 체크
      if (result.data && typeof result.data === 'object' && !bdData) {
        const TOP_SKIP = ['stores', 'bd', 'result', 'storeCount', 'rdnu', 'ok'];
        for (const [key, val] of Object.entries(result.data)) {
          if (TOP_SKIP.includes(key)) continue;
          if (val === null || val === undefined) continue;

          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'number') {
            if (!aggregatedData[key]) aggregatedData[key] = new Array(val.length).fill(0);
            for (let k = 0; k < val.length; k++) {
              aggregatedData[key][k] = (aggregatedData[key][k] || 0) + (val[k] || 0);
            }
          } else if (typeof val === 'object' && !Array.isArray(val)) {
            if (!aggregatedData[key]) aggregatedData[key] = {};
            for (const [subKey, subVal] of Object.entries(val)) {
              if (typeof subVal === 'number') {
                aggregatedData[key][subKey] = (aggregatedData[key][subKey] || 0) + subVal;
              } else if (Array.isArray(subVal) && subVal.length > 0 && typeof subVal[0] === 'number') {
                if (!aggregatedData[key][subKey]) aggregatedData[key][subKey] = new Array(subVal.length).fill(0);
                for (let k = 0; k < subVal.length; k++) {
                  aggregatedData[key][subKey][k] = (aggregatedData[key][subKey][k] || 0) + (subVal[k] || 0);
                }
              }
            }
          } else if (typeof val === 'number') {
            aggregatedData[key] = (aggregatedData[key] || 0) + val;
          }
        }
      }
    }

    const elapsed = Date.now() - t0;
    console.log(`[openub-sales] Done: ${successCount}/${cafeRdnus.length} bd/sales, ${Object.keys(aggregatedData).length} data keys in ${elapsed}ms`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        salesData: Object.keys(aggregatedData).length > 0 ? aggregatedData : null,
        meta: {
          s2Level: S2_LEVEL,
          s2Cells: cellTokens.length,
          totalBuildings: nearbyBuildings.length,
          cafeBuildings: cafeRdnus.length,
          bdSalesSuccess: successCount,
          bdSalesFailed: bdSalesResults.filter(r => !r.ok).length,
          radiusUsed: effectiveRadius,
          elapsedMs: elapsed
        }
      })
    };

  } catch (error) {
    console.warn('[openub-sales] proxy error:', error.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message })
    };
  }
}
