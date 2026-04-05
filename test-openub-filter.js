// Test script: Query OpenUB bd/hash -> bd/sales and show what isCafeCategory filters out
// Uses the same S2 + rdnu approach as openub-proxy.js

const CENTER_LAT = 37.4979;
const CENTER_LNG = 127.0276;
const RADIUS = 500; // meters
const ACCESS_TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';

const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip',
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/',
  'Access-Token': ACCESS_TOKEN,
};

const BD_SALES_CATEGORY = 'A0:B0:C0:D0:F0:G0';

// --- S2 geometry (inline, minimal) ---
// We'll call our Netlify proxy to get S2 tokens, or use the deployed proxy directly.
// Actually, let's just call the deployed Netlify function which does all the work.

// Same isCafeCategory as openub-proxy.js
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
  if (mi.includes('제과제빵떡케익')) {
    return sl.includes('제과제빵떡케익');
  }
  return false;
}

// Haversine distance
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function callOpenUB(endpoint, body) {
  const res = await fetch(`https://api.openub.com/v2/${endpoint}`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${endpoint} ${res.status}: ${text.substring(0, 300)}`);
  }
  return res.json();
}

// Use S2 library
const { S2 } = require('s2-geometry');

const S2_LEVEL = 14;

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

async function main() {
  console.log(`Querying OpenUB for lat=${CENTER_LAT}, lng=${CENTER_LNG}, radius=${RADIUS}m`);

  // Step 1: S2 tokens
  const cellTokens = latLngToS2Tokens(CENTER_LAT, CENTER_LNG, RADIUS, S2_LEVEL);
  console.log(`S2 tokens: ${cellTokens.length} cells`);

  // Step 2: bd/hash
  console.log('Calling bd/hash...');
  const hashResult = await callOpenUB('bd/hash', { cellTokens });
  const buildings = parseBdHashResponse(hashResult, CENTER_LAT, CENTER_LNG, RADIUS);
  console.log(`Buildings in radius: ${buildings.length}`);

  // Step 3: bd/sales for each building (batch of 50 at a time)
  const BATCH = 50;
  const allPassedMap = new Map();
  const allFilteredMap = new Map();
  let totalStores = 0;

  for (let i = 0; i < buildings.length; i += BATCH) {
    const batch = buildings.slice(i, i + BATCH);
    const promises = batch.map(b =>
      callOpenUB('bd/sales', { login: true, rdnu: b.rdnu, category: BD_SALES_CATEGORY })
        .then(data => ({ rdnu: b.rdnu, data, ok: true, building: b }))
        .catch(err => ({ rdnu: b.rdnu, error: err.message, ok: false }))
    );
    const results = await Promise.all(promises);

    for (const result of results) {
      if (!result.ok) continue;
      const data = result.data;

      // Extract stores from bd map
      const bdMap = data.bd || data.result?.bd || {};
      if (typeof bdMap === 'object' && !Array.isArray(bdMap)) {
        for (const [bdRdnu, bdInfo] of Object.entries(bdMap)) {
          if (!bdInfo || typeof bdInfo !== 'object') continue;
          const bdStores = bdInfo.stores || [];
          if (!Array.isArray(bdStores)) continue;

          for (const store of bdStores) {
            totalStores++;
            const name = store.storeNm || store.name || '';
            const id = store.storeId || store.id || name + '_' + bdRdnu;
            const cat = store.category || {};
            const addr = bdInfo.roadAddr || bdInfo.siteAddr || bdInfo.ROAD_ADDR || result.building.address || '';

            if (isCafeCategory(cat, name)) {
              if (!allPassedMap.has(id)) {
                allPassedMap.set(id, { storeName: name, bg: cat.bg || '', mi: cat.mi || '', sl: cat.sl || '', address: addr });
              }
            } else {
              if (!allFilteredMap.has(id)) {
                allFilteredMap.set(id, { storeName: name, bg: cat.bg || '', mi: cat.mi || '', sl: cat.sl || '', address: addr });
              }
            }
          }
        }
      }

      // Also check top-level stores
      const topStores = data.stores || data.result?.stores || [];
      if (Array.isArray(topStores)) {
        for (const store of topStores) {
          totalStores++;
          const name = store.storeNm || store.name || '';
          const id = store.storeId || store.id || name + '_top_' + result.rdnu;
          const cat = store.category || {};

          if (isCafeCategory(cat, name)) {
            if (!allPassedMap.has(id)) {
              allPassedMap.set(id, { storeName: name, bg: cat.bg || '', mi: cat.mi || '', sl: cat.sl || '', address: store.roadAddr || '' });
            }
          } else {
            if (!allFilteredMap.has(id)) {
              allFilteredMap.set(id, { storeName: name, bg: cat.bg || '', mi: cat.mi || '', sl: cat.sl || '', address: store.roadAddr || '' });
            }
          }
        }
      }
    }

    process.stdout.write(`  Processed ${Math.min(i + BATCH, buildings.length)}/${buildings.length} buildings\r`);
  }

  console.log(`\nTotal store entries encountered: ${totalStores}`);

  // --- Results ---
  console.log('\n' + '='.repeat(80));
  console.log(`PASSED (isCafeCategory = true): ${allPassedMap.size} unique stores`);
  console.log('='.repeat(80));
  for (const [id, s] of allPassedMap) {
    console.log(`  [PASS] ${s.storeName} | mi=${s.mi} | sl=${s.sl} | bg=${s.bg}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`FILTERED (isCafeCategory = false): ${allFilteredMap.size} unique stores`);
  console.log('='.repeat(80));
  for (const [id, s] of allFilteredMap) {
    console.log(`  [FAIL] ${s.storeName} | mi=${s.mi} | sl=${s.sl} | bg=${s.bg}`);
  }

  // --- Group FILTERED by category.mi ---
  console.log('\n' + '='.repeat(80));
  console.log('FILTERED grouped by category.mi:');
  console.log('='.repeat(80));
  const miGroups = {};
  for (const [id, s] of allFilteredMap) {
    const mi = s.mi || '(empty)';
    if (!miGroups[mi]) miGroups[mi] = [];
    miGroups[mi].push(s.storeName);
  }
  const sortedMi = Object.entries(miGroups).sort((a, b) => b[1].length - a[1].length);
  for (const [mi, names] of sortedMi) {
    console.log(`\n  [${mi}] (${names.length} stores)`);
    for (const n of names) {
      console.log(`    - ${n}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total unique PASSED: ${allPassedMap.size}`);
  console.log(`Total unique FILTERED: ${allFilteredMap.size}`);
  console.log(`Total unique stores: ${allPassedMap.size + allFilteredMap.size}`);
}

main().catch(err => console.error('Fatal:', err));
