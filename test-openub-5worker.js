// test-openub-5worker.js
// 5-worker parallel OpenUB bd/sales test around 강남역
// Tests: batch=30, delay=100ms, 5 splits in parallel

import { S2 } from 's2-geometry';

const ACCESS_TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip',
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/',
  'Access-Token': ACCESS_TOKEN
};

const S2_LEVEL = 14;
const BATCH_SIZE = 30;
const BATCH_DELAY = 100;
const PER_CALL_TIMEOUT = 8000;
const BD_SALES_CATEGORY = 'A0:B0:C0:D0:F0:G0';
const RADIUS = 350;

// ─── S2 Cell Token ───

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
  } catch (e) { /* ignore */ }

  return Array.from(tokens);
}

// ─── Haversine ───

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── API Call with timeout ───

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
      throw new Error(`${res.status}: ${text.substring(0, 100)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Parse bd/hash ───

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
    buildings.push({ rdnu, lat: bLat, lng: bLng, address: info.ROAD_ADDR || info.ADDR || '' });
  }
  return buildings;
}

// ─── Cafe Category Filter ───

const NAME_EXCLUDE_KEYWORDS = ['에스테틱', '액세서리', '홀릭', '빈대떡', '떡갈비', '냉면', '김밤', '치킨', '고기'];

function isCafeCategory(category, storeName) {
  if (!category) return false;
  const mi = (category.mi || '');
  const sl = (category.sl || '');
  if (storeName) {
    for (const kw of NAME_EXCLUDE_KEYWORDS) {
      if (storeName.includes(kw)) return false;
    }
  }
  if (sl === '떡/한과 전문점' || sl === '테이크아웃음료/과일 전문점') return false;
  if (mi.includes('카페') || mi.includes('커피') || mi.includes('찻집')) return true;
  if (mi.includes('제과제빵떡케익')) return sl.includes('제과제빵떡케익');
  return false;
}

// ─── Extract cafes from bd/sales ───

function extractCafes(bdSalesResult, building) {
  const cafes = [];
  const { rdnu, data } = bdSalesResult;
  if (!data || !bdSalesResult.ok) return cafes;

  const stores = data.stores || data.result?.stores || [];
  if (Array.isArray(stores)) {
    for (const store of stores) {
      const name = store.storeNm || store.name || '';
      if (!isCafeCategory(store.category, name)) continue;
      cafes.push({
        storeId: store.storeId || store.id || '',
        storeNm: name,
        rdnu
      });
    }
  }

  const bdMap = data.bd || data.result?.bd || {};
  if (typeof bdMap === 'object' && !Array.isArray(bdMap)) {
    for (const [bdRdnu, bdInfo] of Object.entries(bdMap)) {
      if (!bdInfo || typeof bdInfo !== 'object') continue;
      const bdStores = bdInfo.stores || [];
      if (!Array.isArray(bdStores)) continue;
      for (const store of bdStores) {
        const name = store.storeNm || store.name || '';
        if (!isCafeCategory(store.category, name)) continue;
        cafes.push({
          storeId: store.storeId || store.id || '',
          storeNm: name,
          rdnu: bdRdnu || rdnu
        });
      }
    }
  }
  return cafes;
}

// ─── Run one split (simulates one Netlify function call) ───

async function runSplit(name, lat, lng) {
  const t0 = Date.now();
  const stats = { name, buildings: 0, success: 0, timeout: 0, error: 0, cafes: 0, time: 0, cafeList: [] };

  try {
    // 1) S2 tokens
    const cellTokens = latLngToS2Tokens(lat, lng, RADIUS, S2_LEVEL);

    // 2) bd/hash
    const hashResult = await callOpenUB('bd/hash', { cellTokens }, 10000);
    const buildings = parseBdHashResponse(hashResult, lat, lng, RADIUS);
    stats.buildings = buildings.length;
    const rdnus = buildings.map(b => b.rdnu);
    const buildingMap = {};
    for (const b of buildings) buildingMap[b.rdnu] = b;

    // 3) bd/sales in batches of BATCH_SIZE with BATCH_DELAY
    const results = [];
    const failed = [];

    for (let i = 0; i < rdnus.length; i += BATCH_SIZE) {
      const batch = rdnus.slice(i, i + BATCH_SIZE);
      const promises = batch.map(rdnu =>
        callOpenUB('bd/sales', { login: true, rdnu, category: BD_SALES_CATEGORY })
          .then(data => ({ rdnu, data, ok: true }))
          .catch(err => {
            const isTimeout = err.name === 'AbortError' || err.message.includes('abort');
            return { rdnu, error: err.message, ok: false, isTimeout };
          })
      );
      const batchResults = await Promise.allSettled(promises);
      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
          if (!r.value.ok) failed.push(r.value);
        }
      }
      // delay between batches
      if (i + BATCH_SIZE < rdnus.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    // 4) Retry failed ones once
    if (failed.length > 0) {
      const retryRdnus = failed.map(f => f.rdnu);
      for (let i = 0; i < retryRdnus.length; i += BATCH_SIZE) {
        const batch = retryRdnus.slice(i, i + BATCH_SIZE);
        const promises = batch.map(rdnu =>
          callOpenUB('bd/sales', { login: true, rdnu, category: BD_SALES_CATEGORY })
            .then(data => ({ rdnu, data, ok: true }))
            .catch(err => ({ rdnu, error: err.message, ok: false, isTimeout: err.name === 'AbortError' }))
        );
        const retryResults = await Promise.allSettled(promises);
        for (const r of retryResults) {
          if (r.status === 'fulfilled' && r.value.ok) {
            const idx = results.findIndex(x => x.rdnu === r.value.rdnu && !x.ok);
            if (idx !== -1) results[idx] = r.value;
          }
        }
      }
    }

    // 5) Count
    stats.success = results.filter(r => r.ok).length;
    stats.timeout = results.filter(r => !r.ok && r.isTimeout).length;
    stats.error = results.filter(r => !r.ok && !r.isTimeout).length;

    // 6) Extract cafes
    for (const result of results) {
      if (!result.ok) continue;
      const cafes = extractCafes(result, buildingMap[result.rdnu]);
      stats.cafeList.push(...cafes);
    }
    stats.cafes = stats.cafeList.length;

  } catch (err) {
    console.error(`[${name}] FATAL: ${err.message}`);
  }

  stats.time = ((Date.now() - t0) / 1000).toFixed(1);
  return stats;
}

// ─── Main ───

async function main() {
  const CENTER_LAT = 37.4979;
  const CENTER_LNG = 127.0276;
  const OFFSET = 0.0013;

  const splits = [
    { name: 'Center', lat: CENTER_LAT, lng: CENTER_LNG },
    { name: 'NE', lat: CENTER_LAT + OFFSET, lng: CENTER_LNG + OFFSET },
    { name: 'NW', lat: CENTER_LAT + OFFSET, lng: CENTER_LNG - OFFSET },
    { name: 'SE', lat: CENTER_LAT - OFFSET, lng: CENTER_LNG + OFFSET },
    { name: 'SW', lat: CENTER_LAT - OFFSET, lng: CENTER_LNG - OFFSET },
  ];

  console.log('=== OpenUB 5-Worker Parallel Test ===');
  console.log(`Location: 강남역 (${CENTER_LAT}, ${CENTER_LNG})`);
  console.log(`Radius: ${RADIUS}m per split, Offset: ${OFFSET}°`);
  console.log(`Batch: ${BATCH_SIZE}, Delay: ${BATCH_DELAY}ms, Timeout: ${PER_CALL_TIMEOUT}ms`);
  console.log('Running 5 splits in parallel...\n');

  const t0 = Date.now();

  // Run all 5 splits in parallel
  const results = await Promise.all(
    splits.map(s => runSplit(s.name, s.lat, s.lng))
  );

  const totalTime = ((Date.now() - t0) / 1000).toFixed(1);

  // Print table
  console.log('Split  | Buildings | Success | Timeout | Error | Cafes | Time');
  console.log('-------|-----------|---------|---------|-------|-------|-----');
  for (const r of results) {
    console.log(
      `${r.name.padEnd(7)}| ${String(r.buildings).padStart(9)} | ${String(r.success).padStart(7)} | ${String(r.timeout).padStart(7)} | ${String(r.error).padStart(5)} | ${String(r.cafes).padStart(5)} | ${r.time}s`
    );
  }

  // Merge and dedup
  const allCafes = results.flatMap(r => r.cafeList);
  const seen = new Set();
  const unique = [];
  for (const cafe of allCafes) {
    const key = cafe.storeId || cafe.storeNm;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(cafe);
  }

  const totalBuildings = results.reduce((s, r) => s + r.buildings, 0);
  const totalSuccess = results.reduce((s, r) => s + r.success, 0);
  const totalTimeout = results.reduce((s, r) => s + r.timeout, 0);
  const totalError = results.reduce((s, r) => s + r.error, 0);
  const totalCafesRaw = results.reduce((s, r) => s + r.cafes, 0);

  console.log('-------|-----------|---------|---------|-------|-------|-----');
  console.log(
    `TOTAL  | ${String(totalBuildings).padStart(9)} | ${String(totalSuccess).padStart(7)} | ${String(totalTimeout).padStart(7)} | ${String(totalError).padStart(5)} | ${String(totalCafesRaw).padStart(5)} | ${totalTime}s`
  );
  console.log(`\nRaw cafes (all splits): ${totalCafesRaw}`);
  console.log(`Unique cafes (after dedup): ${unique.length}`);

  // Show some sample cafe names
  if (unique.length > 0) {
    console.log(`\nSample cafes (first 10):`);
    for (const c of unique.slice(0, 10)) {
      console.log(`  - ${c.storeNm} (${c.rdnu})`);
    }
  }
}

main().catch(err => console.error('FATAL:', err));
