// test-openub-full-list.js
// OpenUB 5-worker 전체 카페 목록 + Kakao 비교
// Usage: node test-openub-full-list.js

import { S2 } from 's2-geometry';

const ACCESS_TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip',
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/',
  'Access-Token': ACCESS_TOKEN
};

const KAKAO_REST_KEY = '9e149576620513dc3283894501c49ab7';

const S2_LEVEL = 14;
const BATCH_SIZE = 30;
const BATCH_DELAY = 100;
const PER_CALL_TIMEOUT = 8000;
const BD_SALES_CATEGORY = 'A0:B0:C0:D0:F0:G0';
const RADIUS = 350;

const CENTER_LAT = 37.4979;
const CENTER_LNG = 127.0276;
const OFFSET = 0.0013;

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
        category: store.category || {},
        address: building?.address || '',
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
          category: store.category || {},
          address: bdInfo.ROAD_ADDR || bdInfo.ADDR || building?.address || '',
          rdnu: bdRdnu || rdnu
        });
      }
    }
  }
  return cafes;
}

// ─── Run one split ───

async function runSplit(name, lat, lng) {
  const t0 = Date.now();
  const stats = { name, buildings: 0, success: 0, timeout: 0, error: 0, cafes: 0, time: 0, cafeList: [] };

  try {
    const cellTokens = latLngToS2Tokens(lat, lng, RADIUS, S2_LEVEL);
    const hashResult = await callOpenUB('bd/hash', { cellTokens }, 10000);
    const buildings = parseBdHashResponse(hashResult, lat, lng, RADIUS);
    stats.buildings = buildings.length;
    const rdnus = buildings.map(b => b.rdnu);
    const buildingMap = {};
    for (const b of buildings) buildingMap[b.rdnu] = b;

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
      if (i + BATCH_SIZE < rdnus.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    // Retry failed once
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

    stats.success = results.filter(r => r.ok).length;
    stats.timeout = results.filter(r => !r.ok && r.isTimeout).length;
    stats.error = results.filter(r => !r.ok && !r.isTimeout).length;

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

// ─── Kakao CE7 search ───

async function kakaoSearchCategory(x, y, radius, page) {
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CE7&x=${x}&y=${y}&radius=${radius}&sort=distance&page=${page}&size=15`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }
  });
  return res.json();
}

async function kakaoSearchAllPages(x, y, radius) {
  const results = [];
  for (let page = 1; page <= 3; page++) {
    const data = await kakaoSearchCategory(x, y, radius, page);
    if (!data.documents || data.documents.length === 0) break;
    results.push(...data.documents);
    if (data.meta && data.meta.is_end) break;
  }
  return results;
}

async function getKakaoCafes() {
  const LAT_PER_METER = 1 / 111320;
  const LNG_PER_METER = 1 / (111320 * Math.cos(CENTER_LAT * Math.PI / 180));
  const SEARCH_RADIUS = 500;
  const allCafes = new Map();

  // Phase 1: 5x5 grid, r=150m
  const GRID = 5;
  const CELL_RADIUS = 150;
  const stepLat = (SEARCH_RADIUS * 2 / GRID) * LAT_PER_METER;
  const stepLng = (SEARCH_RADIUS * 2 / GRID) * LNG_PER_METER;
  const startLat = CENTER_LAT - (SEARCH_RADIUS * LAT_PER_METER) + (stepLat / 2);
  const startLng = CENTER_LNG - (SEARCH_RADIUS * LNG_PER_METER) + (stepLng / 2);

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cy = startLat + row * stepLat;
      const cx = startLng + col * stepLng;
      const distFromCenter = Math.sqrt(
        Math.pow((cy - CENTER_LAT) / LAT_PER_METER, 2) +
        Math.pow((cx - CENTER_LNG) / LNG_PER_METER, 2)
      );
      if (distFromCenter > SEARCH_RADIUS + CELL_RADIUS) continue;
      const docs = await kakaoSearchAllPages(cx, cy, CELL_RADIUS);
      for (const doc of docs) {
        if (!allCafes.has(doc.id)) {
          const dLat = (parseFloat(doc.y) - CENTER_LAT) / LAT_PER_METER;
          const dLng = (parseFloat(doc.x) - CENTER_LNG) / LNG_PER_METER;
          doc._dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
          allCafes.set(doc.id, doc);
        }
      }
      await new Promise(r => setTimeout(r, 80));
    }
  }

  // Phase 2: 7x7 grid, r=80m
  const GRID2 = 7;
  const CELL_RADIUS2 = 80;
  const stepLat2 = (SEARCH_RADIUS * 2 / GRID2) * LAT_PER_METER;
  const stepLng2 = (SEARCH_RADIUS * 2 / GRID2) * LNG_PER_METER;
  const startLat2 = CENTER_LAT - (SEARCH_RADIUS * LAT_PER_METER) + (stepLat2 / 2);
  const startLng2 = CENTER_LNG - (SEARCH_RADIUS * LNG_PER_METER) + (stepLng2 / 2);

  for (let row = 0; row < GRID2; row++) {
    for (let col = 0; col < GRID2; col++) {
      const cy = startLat2 + row * stepLat2;
      const cx = startLng2 + col * stepLng2;
      const distFromCenter = Math.sqrt(
        Math.pow((cy - CENTER_LAT) / LAT_PER_METER, 2) +
        Math.pow((cx - CENTER_LNG) / LNG_PER_METER, 2)
      );
      if (distFromCenter > SEARCH_RADIUS + CELL_RADIUS2) continue;
      const docs = await kakaoSearchAllPages(cx, cy, CELL_RADIUS2);
      for (const doc of docs) {
        if (!allCafes.has(doc.id)) {
          const dLat = (parseFloat(doc.y) - CENTER_LAT) / LAT_PER_METER;
          const dLng = (parseFloat(doc.x) - CENTER_LNG) / LNG_PER_METER;
          doc._dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
          allCafes.set(doc.id, doc);
        }
      }
      await new Promise(r => setTimeout(r, 50));
    }
  }

  return [...allCafes.values()].filter(c => c._dist <= 550).sort((a, b) => a._dist - b._dist);
}

// ─── Fuzzy name normalization for comparison ───

function normalizeName(name) {
  return (name || '')
    .replace(/\s+/g, '')       // remove spaces
    .replace(/[점호]$/g, '')   // remove trailing 점/호
    .replace(/강남역?점?$/g, '') // remove 강남역점, 강남점
    .replace(/역삼?점?$/g, '')
    .replace(/[㈜(주)]/g, '')
    .replace(/[·\-_.,]/g, '')
    .toLowerCase()
    .trim();
}

function fuzzyMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Check if one is substring of the other (min 3 chars)
  if (na.length >= 3 && nb.length >= 3) {
    if (na.includes(nb.substring(0, Math.min(nb.length, 5))) ||
        nb.includes(na.substring(0, Math.min(na.length, 5)))) return true;
  }
  return false;
}

// ─── Main ───

async function main() {
  // ═══════════════════════════════════════════
  // Part 1: OpenUB 5-Worker Full Cafe List
  // ═══════════════════════════════════════════

  const splits = [
    { name: 'Center', lat: CENTER_LAT, lng: CENTER_LNG },
    { name: 'NE', lat: CENTER_LAT + OFFSET, lng: CENTER_LNG + OFFSET },
    { name: 'NW', lat: CENTER_LAT + OFFSET, lng: CENTER_LNG - OFFSET },
    { name: 'SE', lat: CENTER_LAT - OFFSET, lng: CENTER_LNG + OFFSET },
    { name: 'SW', lat: CENTER_LAT - OFFSET, lng: CENTER_LNG - OFFSET },
  ];

  console.log('='.repeat(120));
  console.log('OpenUB 5-Worker Full Cafe List + Kakao Comparison');
  console.log(`Location: 강남역 (${CENTER_LAT}, ${CENTER_LNG})`);
  console.log(`Radius: ${RADIUS}m per split, Offset: ${OFFSET}`);
  console.log(`Batch: ${BATCH_SIZE}, Delay: ${BATCH_DELAY}ms`);
  console.log('='.repeat(120));
  console.log('\n[Phase 1] Running OpenUB 5 splits in parallel...');

  const t0 = Date.now();
  const results = await Promise.all(
    splits.map(s => runSplit(s.name, s.lat, s.lng))
  );
  const openubTime = ((Date.now() - t0) / 1000).toFixed(1);

  // Print split summary
  console.log('\nSplit  | Buildings | Success | Timeout | Error | Cafes | Time');
  console.log('-------|-----------|---------|---------|-------|-------|-----');
  for (const r of results) {
    console.log(
      `${r.name.padEnd(7)}| ${String(r.buildings).padStart(9)} | ${String(r.success).padStart(7)} | ${String(r.timeout).padStart(7)} | ${String(r.error).padStart(5)} | ${String(r.cafes).padStart(5)} | ${r.time}s`
    );
  }

  // Merge and dedup by storeNm
  const allCafes = results.flatMap(r => r.cafeList);
  const seen = new Map(); // storeNm -> cafe
  for (const cafe of allCafes) {
    const key = cafe.storeNm;
    if (!key || seen.has(key)) continue;
    seen.set(key, cafe);
  }
  const uniqueOpenUB = [...seen.values()].sort((a, b) => a.storeNm.localeCompare(b.storeNm, 'ko'));

  const totalBuildings = results.reduce((s, r) => s + r.buildings, 0);
  const totalCafesRaw = results.reduce((s, r) => s + r.cafes, 0);

  console.log(`\nTotal buildings: ${totalBuildings}, Raw cafes: ${totalCafesRaw}, Unique (dedup by storeNm): ${uniqueOpenUB.length}`);
  console.log(`OpenUB time: ${openubTime}s`);

  // Print full OpenUB list
  console.log(`\n${'='.repeat(120)}`);
  console.log(`[OpenUB] 강남역 전체 카페 목록 (${uniqueOpenUB.length}개)`);
  console.log(`${'='.repeat(120)}`);
  console.log(`${'#'.padStart(4)} | ${'이름'.padEnd(30)} | ${'주소 (ROAD_ADDR)'.padEnd(45)} | ${'category.mi'.padEnd(20)} | category.sl`);
  console.log('-'.repeat(120));

  for (let i = 0; i < uniqueOpenUB.length; i++) {
    const c = uniqueOpenUB[i];
    const name = (c.storeNm || '').substring(0, 28).padEnd(30);
    const addr = (c.address || '').substring(0, 43).padEnd(45);
    const mi = (c.category?.mi || '').substring(0, 18).padEnd(20);
    const sl = (c.category?.sl || '');
    console.log(`${String(i + 1).padStart(4)} | ${name} | ${addr} | ${mi} | ${sl}`);
  }

  // ═══════════════════════════════════════════
  // Part 2: Kakao CE7 Full Cafe List
  // ═══════════════════════════════════════════

  console.log(`\n${'='.repeat(120)}`);
  console.log('[Phase 2] Running Kakao CE7 grid search (5x5 + 7x7)...');

  const t1 = Date.now();
  const kakaoCafes = await getKakaoCafes();
  const kakaoTime = ((Date.now() - t1) / 1000).toFixed(1);

  console.log(`Kakao: ${kakaoCafes.length} cafes found in ${kakaoTime}s`);

  console.log(`\n${'='.repeat(120)}`);
  console.log(`[Kakao] 강남역 반경 500m 카페 목록 (${kakaoCafes.length}개)`);
  console.log(`${'='.repeat(120)}`);
  console.log(`${'#'.padStart(4)} | ${'이름'.padEnd(30)} | ${'주소'.padEnd(50)} | 카테고리`);
  console.log('-'.repeat(120));

  for (let i = 0; i < kakaoCafes.length; i++) {
    const c = kakaoCafes[i];
    const name = (c.place_name || '').substring(0, 28).padEnd(30);
    const addr = (c.road_address_name || c.address_name || '').substring(0, 48).padEnd(50);
    const cat = (c.category_name || '').replace('음식점 > ', '');
    console.log(`${String(i + 1).padStart(4)} | ${name} | ${addr} | ${cat}`);
  }

  // ═══════════════════════════════════════════
  // Part 3: Comparison
  // ═══════════════════════════════════════════

  console.log(`\n${'='.repeat(120)}`);
  console.log('[Phase 3] Comparison: OpenUB vs Kakao');
  console.log('='.repeat(120));

  const openubNames = uniqueOpenUB.map(c => c.storeNm);
  const kakaoNames = kakaoCafes.map(c => c.place_name);

  // Find matches
  const matchedOpenUB = new Set();
  const matchedKakao = new Set();
  const bothList = [];

  for (let oi = 0; oi < openubNames.length; oi++) {
    for (let ki = 0; ki < kakaoNames.length; ki++) {
      if (matchedKakao.has(ki)) continue;
      if (fuzzyMatch(openubNames[oi], kakaoNames[ki])) {
        matchedOpenUB.add(oi);
        matchedKakao.add(ki);
        bothList.push({ openub: openubNames[oi], kakao: kakaoNames[ki] });
        break;
      }
    }
  }

  const openubOnly = openubNames.filter((_, i) => !matchedOpenUB.has(i));
  const kakaoOnly = kakaoNames.filter((_, i) => !matchedKakao.has(i));

  // Print BOTH
  console.log(`\n--- BOTH (${bothList.length}개) ---`);
  for (let i = 0; i < bothList.length; i++) {
    const b = bothList[i];
    const match = b.openub === b.kakao ? '' : ` <-> ${b.kakao}`;
    console.log(`${String(i + 1).padStart(4)}. ${b.openub}${match}`);
  }

  // Print OpenUB Only
  console.log(`\n--- OpenUB ONLY (${openubOnly.length}개) ---`);
  for (let i = 0; i < openubOnly.length; i++) {
    console.log(`${String(i + 1).padStart(4)}. ${openubOnly[i]}`);
  }

  // Print Kakao Only
  console.log(`\n--- Kakao ONLY (${kakaoOnly.length}개) ---`);
  for (let i = 0; i < kakaoOnly.length; i++) {
    console.log(`${String(i + 1).padStart(4)}. ${kakaoOnly[i]}`);
  }

  // Summary
  console.log(`\n${'='.repeat(120)}`);
  console.log('SUMMARY');
  console.log('='.repeat(120));
  console.log(`OpenUB unique cafes: ${uniqueOpenUB.length}`);
  console.log(`Kakao CE7 cafes:     ${kakaoCafes.length}`);
  console.log(`Both (fuzzy match):  ${bothList.length}`);
  console.log(`OpenUB only:         ${openubOnly.length}`);
  console.log(`Kakao only:          ${kakaoOnly.length}`);
  console.log(`Total union:         ${bothList.length + openubOnly.length + kakaoOnly.length}`);
}

main().catch(err => console.error('FATAL:', err));
