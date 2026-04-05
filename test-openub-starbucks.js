// test-openub-starbucks.js
// Investigation: Why Starbucks and other known chains don't appear in OpenUB results
// Tests bd/hash building discovery + bd/sales store listing for known Starbucks locations near 강남역

const API_BASE = 'https://api.openub.com/v2';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip',
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/',
  'Access-Token': 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1'
};

// 강남역 center (from Kakao geocoding)
const CENTER_LAT = 37.49794;
const CENTER_LNG = 127.02764;
const RADIUS = 550; // meters
const S2_LEVEL = 14;

// ─── S2 Cell functions (copied from openub-proxy.js) ───

// We need s2-geometry. Use dynamic import or require.
let S2;

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
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${endpoint} returned ${res.status}: ${text.substring(0, 300)}`);
  }
  return res.json();
}

// ─── Target locations to investigate ───

const STARBUCKS_LOCATIONS = [
  { name: '스타벅스 강남R점', address: '서울 강남구 강남대로 390', distFromCenter: 79 },
  { name: '스타벅스 몬테소리점', address: '서울 서초구 강남대로 399', distFromCenter: 81 },
  { name: '스타벅스 케이스퀘어강남점', address: '서울 강남구 강남대로94길 10', distFromCenter: 155 },
  { name: '스타벅스 강남역우송빌딩점', address: '서울 서초구 서초대로73길 7', distFromCenter: 204 },
  { name: '스타벅스 강남비젼타워점', address: '서울 강남구 테헤란로2길 27', distFromCenter: 237 },
  { name: '스타벅스 강남GT타워점', address: '서울 서초구 서초대로 411', distFromCenter: 127 },
  { name: '스타벅스 국기원사거리점', address: '서울 강남구 테헤란로 125', distFromCenter: 407 },
  { name: '스타벅스 강남역신분당역사점', address: '서울 강남구 역삼동 858', distFromCenter: 108 },
];

const OTHER_MISSING = [
  { name: '공차 강남역점', address: '서울 강남구 강남대로 지하 396', distFromCenter: 16, note: 'Same building as 강다짐/메가엠지씨/바나프레소 - building IS found' },
  { name: '블루보틀 역삼 카페', address: '서울 강남구 테헤란로 129', distFromCenter: 484, note: 'Same building as 수수커피/올라보 - building IS found' },
  { name: '코티커피 강남효성점', address: '서울 강남구 강남대로84길 15', distFromCenter: 221 },
];

// ─── Main investigation ───

async function main() {
  // Load S2
  const s2Module = await import('s2-geometry');
  S2 = s2Module.S2;

  console.log('='.repeat(80));
  console.log('OpenUB Starbucks Investigation');
  console.log('Center: 강남역 (37.49794, 127.02764), Radius: 550m');
  console.log('='.repeat(80));

  // Step 1: Get all buildings via bd/hash (5-split like proxy does)
  console.log('\n[STEP 1] Generating S2 tokens and calling bd/hash...');
  const cellTokens = latLngToS2Tokens(CENTER_LAT, CENTER_LNG, RADIUS, S2_LEVEL);
  console.log(`S2 tokens generated: ${cellTokens.length} cells`);

  const hashResult = await callOpenUB('bd/hash', { cellTokens });

  const bd = hashResult?.bd || {};
  const allRdnus = Object.keys(bd);
  console.log(`Total buildings from bd/hash: ${allRdnus.length}`);

  // Parse buildings with addresses
  const buildings = [];
  for (const [rdnu, info] of Object.entries(bd)) {
    if (!info || typeof info !== 'object') continue;
    const center = info.center;
    const bLat = Array.isArray(center) ? center[1] : null;
    const bLng = Array.isArray(center) ? center[0] : null;
    let dist = null;
    if (bLat && bLng) {
      dist = haversineDistance(CENTER_LAT, CENTER_LNG, bLat, bLng);
    }
    buildings.push({
      rdnu,
      lat: bLat,
      lng: bLng,
      dist,
      address: info.ROAD_ADDR || '',
      siteAddr: info.ADDR || '',
    });
  }

  // Filter to radius
  const nearbyBuildings = buildings.filter(b => !b.dist || b.dist <= RADIUS);
  console.log(`Buildings within ${RADIUS}m: ${nearbyBuildings.length}`);

  // Step 2: Search for each Starbucks address in building list
  console.log('\n' + '='.repeat(80));
  console.log('[STEP 2] Searching for Starbucks buildings in bd/hash results...');
  console.log('='.repeat(80));

  const allTargets = [...STARBUCKS_LOCATIONS, ...OTHER_MISSING];

  for (const target of allTargets) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Target: ${target.name}`);
    console.log(`Address: ${target.address} (${target.distFromCenter}m from center)`);
    if (target.note) console.log(`Note: ${target.note}`);

    // Extract key parts of address for matching
    const addrParts = extractAddressParts(target.address);
    console.log(`Search keys: road="${addrParts.road}", number="${addrParts.number}"`);

    // Search in buildings
    const matches = findMatchingBuildings(nearbyBuildings, addrParts);

    if (matches.length === 0) {
      // Try in ALL buildings (not just radius-filtered)
      const allMatches = findMatchingBuildings(buildings, addrParts);
      if (allMatches.length > 0) {
        console.log(`  >> NOT FOUND within ${RADIUS}m, but FOUND outside radius:`);
        for (const m of allMatches) {
          console.log(`     rdnu=${m.rdnu}, addr="${m.address}", dist=${m.dist ? Math.round(m.dist) + 'm' : 'unknown'}`);
        }
      } else {
        console.log(`  >> BUILDING NOT FOUND in bd/hash at all!`);
      }
    } else {
      console.log(`  >> BUILDING FOUND: ${matches.length} match(es)`);
      for (const m of matches) {
        console.log(`     rdnu=${m.rdnu}, addr="${m.address}", dist=${m.dist ? Math.round(m.dist) + 'm' : 'unknown'}`);
      }

      // Step 3: Call bd/sales for each matched building
      for (const m of matches) {
        console.log(`\n  [bd/sales] Calling for rdnu=${m.rdnu}...`);
        try {
          // Call with ALL categories to see everything
          const salesResult = await callOpenUB('bd/sales', {
            login: true,
            rdnu: m.rdnu,
            category: 'A0:B0:C0:D0:E0:F0:G0:H0:I0:J0:K0:L0:M0:N0:O0:P0:Q0:R0'
          });

          // Extract ALL stores
          const stores = extractAllStores(salesResult);
          console.log(`  Total stores in building: ${stores.length}`);

          if (stores.length === 0) {
            console.log(`  [RAW RESPONSE KEYS]: ${JSON.stringify(Object.keys(salesResult || {}))}`);
            // Print first 500 chars of response for debugging
            const raw = JSON.stringify(salesResult).substring(0, 800);
            console.log(`  [RAW (first 800 chars)]: ${raw}`);
          }

          // Check if our target name appears
          const targetKeyword = target.name.split(' ')[0]; // e.g. "스타벅스" or "공차" or "블루보틀"
          const found = stores.filter(s => s.name.includes(targetKeyword));

          if (found.length > 0) {
            console.log(`  >>> ${targetKeyword} FOUND in bd/sales! <<<`);
            for (const s of found) {
              console.log(`      name="${s.name}", category=${JSON.stringify(s.category)}, floor=${s.floor || 'N/A'}`);
              // Check if isCafeCategory would include it
              const wouldInclude = isCafeCategory(s.category, s.name);
              console.log(`      isCafeCategory() => ${wouldInclude}`);
            }
          } else {
            console.log(`  >>> ${targetKeyword} NOT FOUND in bd/sales for this building <<<`);
          }

          // Print ALL stores for inspection
          console.log(`\n  ALL STORES in building (rdnu=${m.rdnu}):`);
          for (const s of stores) {
            const isCafe = isCafeCategory(s.category, s.name);
            console.log(`    [${isCafe ? 'CAFE' : '    '}] "${s.name}" | category: mi="${s.category?.mi || ''}", sl="${s.category?.sl || ''}" | floor: ${s.floor || 'N/A'}`);
          }
        } catch (err) {
          console.log(`  ERROR calling bd/sales: ${err.message}`);
        }

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(80));
  console.log('[SUMMARY]');
  console.log('='.repeat(80));

  // Also try: search for any store with "스타벅스" across ALL bd/sales in radius
  console.log('\n[BONUS] Searching ALL buildings in radius for any store containing "스타벅스"...');
  console.log(`Will check ${nearbyBuildings.length} buildings (sampling first 80 for time)...`);

  const sampleBuildings = nearbyBuildings.slice(0, 80);
  let starbucksFoundCount = 0;
  let totalStoresScanned = 0;
  const starbucksInstances = [];

  for (let i = 0; i < sampleBuildings.length; i += 10) {
    const batch = sampleBuildings.slice(i, i + 10);
    const promises = batch.map(b =>
      callOpenUB('bd/sales', {
        login: true,
        rdnu: b.rdnu,
        category: 'A0:B0:C0:D0:E0:F0:G0:H0:I0:J0:K0:L0:M0:N0:O0:P0:Q0:R0'
      }).then(data => ({ rdnu: b.rdnu, data, ok: true, address: b.address }))
        .catch(err => ({ rdnu: b.rdnu, error: err.message, ok: false }))
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      if (!r.ok) continue;
      const stores = extractAllStores(r.data);
      totalStoresScanned += stores.length;
      for (const s of stores) {
        if (s.name.includes('스타벅스')) {
          starbucksFoundCount++;
          starbucksInstances.push({ name: s.name, address: r.address, rdnu: r.rdnu, category: s.category });
        }
      }
    }

    if (i + 10 < sampleBuildings.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\nScanned ${sampleBuildings.length} buildings, ${totalStoresScanned} total stores`);
  console.log(`Starbucks instances found: ${starbucksFoundCount}`);
  if (starbucksInstances.length > 0) {
    for (const s of starbucksInstances) {
      console.log(`  - "${s.name}" at ${s.address} (rdnu=${s.rdnu}), category: ${JSON.stringify(s.category)}`);
    }
  }
}

// ─── Helper: extract address parts ───

function extractAddressParts(address) {
  // Remove "서울 강남구 " etc prefix, get road name and number
  // e.g. "서울 강남구 강남대로 390" -> road="강남대로", number="390"
  // e.g. "서울 강남구 강남대로94길 10" -> road="강남대로94길", number="10"
  // e.g. "서울 강남구 강남대로 지하 396" -> road="강남대로", number="396"
  const parts = address.replace(/지하\s*/g, '').trim().split(/\s+/);
  // Find the road name (contains 로, 길, 대로)
  let road = '';
  let number = '';
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+(-\d+)?$/.test(parts[i])) {
      number = parts[i];
    } else if (parts[i].includes('로') || parts[i].includes('길') || parts[i].includes('대로')) {
      road = parts[i];
      break;
    }
  }
  return { road, number, full: address };
}

// ─── Helper: find matching buildings ───

function findMatchingBuildings(buildings, addrParts) {
  const matches = [];
  for (const b of buildings) {
    const addr = b.address || '';
    // Try exact road+number match
    if (addrParts.road && addrParts.number) {
      if (addr.includes(addrParts.road) && addr.includes(addrParts.number)) {
        matches.push(b);
        continue;
      }
    }
    // Partial: road name match + number in address
    if (addrParts.road && addr.includes(addrParts.road)) {
      // Check if the number appears
      if (addrParts.number && addr.includes(addrParts.number)) {
        matches.push(b);
      }
    }
  }
  return matches;
}

// ─── Helper: extract ALL stores from bd/sales response ───

function extractAllStores(data) {
  const stores = [];
  if (!data) return stores;

  // Direct stores array
  const directStores = data.stores || data.result?.stores || [];
  if (Array.isArray(directStores)) {
    for (const s of directStores) {
      stores.push({
        name: s.storeNm || s.name || '',
        category: s.category || {},
        floor: s.floor || null,
        storeId: s.storeId || s.id || '',
        isNewOpen: s.isNewOpen || false,
      });
    }
  }

  // Nested bd -> stores
  const bdMap = data.bd || data.result?.bd || {};
  if (typeof bdMap === 'object' && !Array.isArray(bdMap)) {
    for (const [rdnu, bdInfo] of Object.entries(bdMap)) {
      if (!bdInfo || typeof bdInfo !== 'object') continue;
      const bdStores = bdInfo.stores || [];
      if (!Array.isArray(bdStores)) continue;
      for (const s of bdStores) {
        stores.push({
          name: s.storeNm || s.name || '',
          category: s.category || {},
          floor: s.floor || null,
          storeId: s.storeId || s.id || '',
          isNewOpen: s.isNewOpen || false,
          rdnu,
        });
      }
    }
  }

  return stores;
}

// ─── isCafeCategory (from proxy) ───

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

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
