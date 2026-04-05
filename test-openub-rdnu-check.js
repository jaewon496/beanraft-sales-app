// test-openub-rdnu-check.js
// CRITICAL INVESTIGATION: Why bd/hash returns wrong rdnu for buildings
// Website uses rdnu Nuh2B_~n8CNn3x for 테헤란로2길 22 (카페868 = 2 stores)
// Our code gets rdnu Nuh22uWfc2vx7p for same address (0 stores)

const run = async () => {
  const { S2 } = await import('s2-geometry');

  const API_BASE = 'https://api.openub.com/v2';
  const ACCESS_TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';
  const API_HEADERS = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip',
    'Origin': 'https://www.openub.com',
    'Referer': 'https://www.openub.com/',
    'Access-Token': ACCESS_TOKEN
  };

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
    } catch (e) {}
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
      throw new Error(`OpenUB ${endpoint} ${res.status}: ${text.substring(0, 300)}`);
    }
    return res.json();
  }

  function parseBdHashAll(hashResult) {
    const bd = hashResult?.bd;
    if (!bd || typeof bd !== 'object') return [];
    const buildings = [];
    for (const [rdnu, info] of Object.entries(bd)) {
      if (!info || typeof info !== 'object') continue;
      const center = info.center;
      const bLat = Array.isArray(center) ? center[1] : null;
      const bLng = Array.isArray(center) ? center[0] : null;
      buildings.push({
        rdnu, lat: bLat, lng: bLng,
        ROAD_ADDR: info.ROAD_ADDR || '',
        ADDR: info.ADDR || '',
        raw: info
      });
    }
    return buildings;
  }

  function extractAllStores(data) {
    const stores = [];
    if (Array.isArray(data.stores)) {
      for (const s of data.stores) {
        stores.push({ name: s.storeNm || s.name || '?', category: s.category, floor: s.floor || '', roadAddr: s.roadAddr || '', subRdnu: null });
      }
    }
    const bdMap = data.bd || {};
    if (typeof bdMap === 'object' && !Array.isArray(bdMap)) {
      for (const [bdRdnu, bdInfo] of Object.entries(bdMap)) {
        if (!bdInfo || typeof bdInfo !== 'object') continue;
        if (Array.isArray(bdInfo.stores)) {
          for (const s of bdInfo.stores) {
            stores.push({ name: s.storeNm || s.name || '?', category: s.category, floor: s.floor || '', roadAddr: bdInfo.ROAD_ADDR || s.roadAddr || '', subRdnu: bdRdnu });
          }
        }
      }
    }
    return stores;
  }

  async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  const CENTER_LAT = 37.4979;
  const CENTER_LNG = 127.0276;
  const RADIUS = 600;

  const CORRECT_RDNU = 'Nuh2B_~n8CNn3x';
  const WRONG_RDNU = 'Nuh22uWfc2vx7p';

  console.log('='.repeat(80));
  console.log('OPENUB RDNU MISMATCH INVESTIGATION');
  console.log('='.repeat(80));
  console.log(`Search center: ${CENTER_LAT}, ${CENTER_LNG}, radius: ${RADIUS}m`);
  console.log(`CORRECT rdnu (from website): ${CORRECT_RDNU}`);
  console.log(`WRONG rdnu (from our code):  ${WRONG_RDNU}`);
  console.log();

  // ═══════════════════════════════════════════
  // STEP 1: bd/hash for gangnam area
  // ═══════════════════════════════════════════
  console.log('>>> STEP 1: S2 cells + bd/hash');
  const cellTokens = latLngToS2Tokens(CENTER_LAT, CENTER_LNG, RADIUS, S2_LEVEL);
  console.log(`S2 L${S2_LEVEL} tokens: ${cellTokens.length} cells`);

  const hashResult = await callOpenUB('bd/hash', { cellTokens });
  const allBuildings = parseBdHashAll(hashResult);
  console.log(`Total buildings from bd/hash: ${allBuildings.length}`);

  // ═══════════════════════════════════════════
  // STEP 2: Find "테헤란로2길 22" in bd/hash
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 2: Search for "테헤란로2길 22" in bd/hash');

  const teheran22 = allBuildings.filter(b => {
    const addr = (b.ROAD_ADDR + ' ' + b.ADDR).replace(/\s/g, '');
    return addr.includes('테헤란로2길22');
  });
  console.log(`Buildings matching "테헤란로2길 22": ${teheran22.length}`);
  for (const b of teheran22) {
    console.log(`  rdnu: ${b.rdnu}`);
    console.log(`  ROAD_ADDR: ${b.ROAD_ADDR}`);
    console.log(`  ADDR: ${b.ADDR}`);
    console.log(`  center: [${b.lat}, ${b.lng}]`);
    console.log();
  }

  // Broader search
  const teheranAll = allBuildings.filter(b => b.ROAD_ADDR.includes('테헤란로2길'));
  console.log(`All buildings on "테헤란로2길": ${teheranAll.length}`);
  for (const b of teheranAll) {
    console.log(`  rdnu: ${b.rdnu} | ROAD_ADDR: ${b.ROAD_ADDR} | ADDR: ${b.ADDR}`);
  }

  // Check if CORRECT rdnu exists
  const correctInHash = allBuildings.find(b => b.rdnu === CORRECT_RDNU);
  const wrongInHash = allBuildings.find(b => b.rdnu === WRONG_RDNU);

  console.log(`\n*** CORRECT rdnu (${CORRECT_RDNU}) in bd/hash? ${correctInHash ? 'YES' : 'NO'} ***`);
  if (correctInHash) {
    console.log(`  ROAD_ADDR: ${correctInHash.ROAD_ADDR} | ADDR: ${correctInHash.ADDR} | center: [${correctInHash.lat}, ${correctInHash.lng}]`);
  }

  console.log(`*** WRONG rdnu (${WRONG_RDNU}) in bd/hash? ${wrongInHash ? 'YES' : 'NO'} ***`);
  if (wrongInHash) {
    console.log(`  ROAD_ADDR: ${wrongInHash.ROAD_ADDR} | ADDR: ${wrongInHash.ADDR} | center: [${wrongInHash.lat}, ${wrongInHash.lng}]`);
  }

  // ═══════════════════════════════════════════
  // STEP 3: bd/sales with CORRECT rdnu
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 3: bd/sales with CORRECT rdnu (website)');
  try {
    const sales1 = await callOpenUB('bd/sales', { login: true, rdnu: CORRECT_RDNU, category: 'A0:B0:C0:D0:F0:G0' });
    const stores1 = extractAllStores(sales1);
    console.log(`Stores returned: ${stores1.length}`);
    for (const s of stores1) {
      console.log(`  ${s.name} | mi=${s.category?.mi || ''} sl=${s.category?.sl || ''} | floor=${s.floor} | subRdnu=${s.subRdnu || 'N/A'}`);
    }
    if (sales1.bd) {
      for (const [k, v] of Object.entries(sales1.bd)) {
        console.log(`  bd["${k}"] ROAD_ADDR: ${v.ROAD_ADDR || 'N/A'} | ADDR: ${v.ADDR || 'N/A'} | center: ${JSON.stringify(v.center)} | stores: ${v.stores?.length || 0}`);
      }
    }
    console.log(`  Response top-level keys: ${Object.keys(sales1).join(', ')}`);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  // ═══════════════════════════════════════════
  // STEP 4: bd/sales with WRONG rdnu
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 4: bd/sales with WRONG rdnu (our code)');
  try {
    const sales2 = await callOpenUB('bd/sales', { login: true, rdnu: WRONG_RDNU, category: 'A0:B0:C0:D0:F0:G0' });
    const stores2 = extractAllStores(sales2);
    console.log(`Stores returned: ${stores2.length}`);
    for (const s of stores2) {
      console.log(`  ${s.name} | mi=${s.category?.mi || ''} sl=${s.category?.sl || ''}`);
    }
    if (sales2.bd) {
      for (const [k, v] of Object.entries(sales2.bd)) {
        console.log(`  bd["${k}"] ROAD_ADDR: ${v.ROAD_ADDR || 'N/A'} | ADDR: ${v.ADDR || 'N/A'} | center: ${JSON.stringify(v.center)} | stores: ${v.stores?.length || 0}`);
      }
    }
    if (stores2.length === 0) {
      console.log(`  Response keys: ${Object.keys(sales2).join(', ')}`);
      // Dump partial response
      const raw = JSON.stringify(sales2).substring(0, 500);
      console.log(`  Raw (first 500 chars): ${raw}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  // ═══════════════════════════════════════════
  // STEP 5: What building is WRONG rdnu?
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 5: What building does WRONG rdnu actually correspond to?');
  if (wrongInHash) {
    console.log(`  From bd/hash: ROAD_ADDR="${wrongInHash.ROAD_ADDR}" ADDR="${wrongInHash.ADDR}" center=[${wrongInHash.lat}, ${wrongInHash.lng}]`);
    if (teheran22.length > 0 && teheran22[0].lat && wrongInHash.lat) {
      const dist = haversineDistance(teheran22[0].lat, teheran22[0].lng, wrongInHash.lat, wrongInHash.lng);
      console.log(`  Distance from 테헤란로2길 22 building: ${dist.toFixed(1)}m`);
    }
  } else {
    console.log('  WRONG rdnu not found in bd/hash either!');
    // Try to get info from bd/sales
    try {
      const info = await callOpenUB('bd/sales', { login: true, rdnu: WRONG_RDNU, category: 'A0:B0:C0:D0:F0:G0' });
      if (info.bd) {
        for (const [k, v] of Object.entries(info.bd)) {
          console.log(`  From bd/sales: rdnu=${k} ROAD_ADDR="${v.ROAD_ADDR || 'N/A'}" ADDR="${v.ADDR || 'N/A'}" center=${JSON.stringify(v.center)}`);
        }
      }
    } catch (e) {
      console.log(`  Cannot retrieve info: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════
  // STEP 6: All buildings within 50m of 테헤란로2길 22
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 6: All buildings within 50m of 테헤란로2길 22');

  // Get target coords
  let targetLat = 37.4985, targetLng = 127.0271;
  if (teheran22.length > 0 && teheran22[0].lat) {
    targetLat = teheran22[0].lat;
    targetLng = teheran22[0].lng;
    console.log(`Using coords from bd/hash match: ${targetLat}, ${targetLng}`);
  } else {
    // Get coords from CORRECT rdnu via bd/sales
    try {
      const correctSales = await callOpenUB('bd/sales', { login: true, rdnu: CORRECT_RDNU, category: 'A0:B0:C0:D0:F0:G0' });
      if (correctSales.bd) {
        for (const [k, v] of Object.entries(correctSales.bd)) {
          if (v.center) {
            targetLat = v.center[1];
            targetLng = v.center[0];
            console.log(`Using coords from CORRECT rdnu bd/sales: ${targetLat}, ${targetLng}`);
            break;
          }
        }
      }
    } catch (e) {}
  }

  const nearby = allBuildings
    .filter(b => b.lat && b.lng)
    .map(b => ({ ...b, distToTarget: haversineDistance(targetLat, targetLng, b.lat, b.lng) }))
    .filter(b => b.distToTarget <= 50)
    .sort((a, b) => a.distToTarget - b.distToTarget);

  console.log(`Buildings within 50m: ${nearby.length}`);
  for (const b of nearby) {
    console.log(`  rdnu: ${b.rdnu} | dist: ${b.distToTarget.toFixed(1)}m | ROAD_ADDR: ${b.ROAD_ADDR} | ADDR: ${b.ADDR}`);
  }

  // Check ALL nearby for cafe868
  console.log('\nChecking bd/sales for ALL nearby buildings...');
  for (const b of nearby) {
    try {
      const sales = await callOpenUB('bd/sales', { login: true, rdnu: b.rdnu, category: 'A0:B0:C0:D0:F0:G0' });
      const stores = extractAllStores(sales);
      const has868 = stores.some(s => s.name.includes('868') || s.name.includes('카페868'));
      console.log(`  ${b.rdnu} (${b.ROAD_ADDR || b.ADDR}) -> ${stores.length} stores${has868 ? ' <<< CAFE 868 FOUND!' : ''} [${stores.map(s => s.name).join(', ')}]`);
    } catch (e) {
      console.log(`  ${b.rdnu} -> ERROR: ${e.message}`);
    }
    await sleep(100);
  }

  // Check if CORRECT rdnu is among nearby
  const correctNearby = nearby.find(b => b.rdnu === CORRECT_RDNU);
  console.log(`\nIs CORRECT rdnu in nearby list? ${correctNearby ? 'YES (dist=' + correctNearby.distToTarget.toFixed(1) + 'm)' : 'NO'}`);

  // ═══════════════════════════════════════════
  // STEP 7: Starbucks investigation
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 7: STARBUCKS INVESTIGATION');
  console.log('스타벅스 강남R점: 강남대로 390');

  const gangnam390 = allBuildings.filter(b => {
    const addr = b.ROAD_ADDR.replace(/\s/g, '');
    return addr.includes('강남대로390');
  });
  console.log(`\nBuildings matching "강남대로 390": ${gangnam390.length}`);
  for (const b of gangnam390) {
    console.log(`  rdnu: ${b.rdnu} | ROAD_ADDR: ${b.ROAD_ADDR} | ADDR: ${b.ADDR} | center: [${b.lat}, ${b.lng}]`);
  }

  // Check bd/sales for each
  for (const b of gangnam390) {
    try {
      const sales = await callOpenUB('bd/sales', { login: true, rdnu: b.rdnu, category: 'A0:B0:C0:D0:F0:G0' });
      const stores = extractAllStores(sales);
      const hasSB = stores.some(s => s.name.includes('스타벅스') || s.name.toLowerCase().includes('starbucks'));
      console.log(`  ${b.rdnu} -> ${stores.length} stores${hasSB ? ' <<< STARBUCKS FOUND!' : ''}`);
      for (const s of stores) {
        console.log(`    ${s.name} | mi=${s.category?.mi || ''}`);
      }
    } catch (e) {
      console.log(`  ${b.rdnu} -> ERROR: ${e.message}`);
    }
    await sleep(100);
  }

  // Also check nearby buildings (within 50m of approx starbucks coords)
  const sbLat = 37.4969, sbLng = 127.0284;
  const nearbySB = allBuildings
    .filter(b => b.lat && b.lng)
    .map(b => ({ ...b, distToSB: haversineDistance(sbLat, sbLng, b.lat, b.lng) }))
    .filter(b => b.distToSB <= 50)
    .sort((a, b) => a.distToSB - b.distToSB);

  console.log(`\nBuildings within 50m of Starbucks coords: ${nearbySB.length}`);
  for (const b of nearbySB) {
    console.log(`  rdnu: ${b.rdnu} | dist: ${b.distToSB.toFixed(1)}m | ROAD_ADDR: ${b.ROAD_ADDR}`);
  }

  console.log('\nChecking bd/sales for buildings near Starbucks...');
  for (const b of nearbySB) {
    try {
      const sales = await callOpenUB('bd/sales', { login: true, rdnu: b.rdnu, category: 'A0:B0:C0:D0:F0:G0' });
      const stores = extractAllStores(sales);
      const hasSB = stores.some(s => s.name.includes('스타벅스') || s.name.toLowerCase().includes('starbucks'));
      console.log(`  ${b.rdnu} (${b.ROAD_ADDR || b.ADDR}) -> ${stores.length} stores${hasSB ? ' <<< STARBUCKS!' : ''} [${stores.map(s => s.name).join(', ')}]`);
    } catch (e) {
      console.log(`  ${b.rdnu} -> ERROR: ${e.message}`);
    }
    await sleep(100);
  }

  // ═══════════════════════════════════════════
  // STEP 8: S2 cell coverage check
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 8: S2 CELL COVERAGE CHECK');

  if (!correctInHash) {
    console.log(`CORRECT rdnu NOT in bd/hash. Checking S2 cell coverage...`);

    // Get building coords from bd/sales
    try {
      const correctSales = await callOpenUB('bd/sales', { login: true, rdnu: CORRECT_RDNU, category: 'A0:B0:C0:D0:F0:G0' });
      let bldLat = null, bldLng = null, bldAddr = '';
      if (correctSales.bd) {
        for (const [k, v] of Object.entries(correctSales.bd)) {
          if (v && v.center) {
            bldLat = v.center[1];
            bldLng = v.center[0];
            bldAddr = v.ROAD_ADDR || '';
          }
        }
      }

      if (bldLat && bldLng) {
        console.log(`Building coords: ${bldLat}, ${bldLng} (${bldAddr})`);
        const bldToken = latLngToToken(bldLat, bldLng, S2_LEVEL);
        console.log(`Building S2 token: ${bldToken}`);
        console.log(`In our cell list? ${cellTokens.includes(bldToken)}`);

        const distFromCenter = haversineDistance(CENTER_LAT, CENTER_LNG, bldLat, bldLng);
        console.log(`Distance from search center: ${distFromCenter.toFixed(1)}m`);

        if (!cellTokens.includes(bldToken)) {
          console.log('\n*** ROOT CAUSE: S2 cell NOT in coverage! ***');
          console.log('The building exists but our S2 grid misses its cell.');

          // Try querying with just this cell
          console.log('\nQuerying bd/hash with just the building cell...');
          const bldHash = await callOpenUB('bd/hash', { cellTokens: [bldToken] });
          const bldBuildings = parseBdHashAll(bldHash);
          console.log(`Buildings in this single cell: ${bldBuildings.length}`);
          const found = bldBuildings.find(b => b.rdnu === CORRECT_RDNU);
          console.log(`CORRECT rdnu in single-cell result? ${found ? 'YES' : 'NO'}`);
          if (found) {
            console.log(`  ROAD_ADDR: ${found.ROAD_ADDR}`);
          }
          for (const b of bldBuildings.slice(0, 5)) {
            console.log(`  ${b.rdnu} | ${b.ROAD_ADDR} | ${b.ADDR}`);
          }
        }
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  } else {
    console.log(`CORRECT rdnu IS in bd/hash. S2 coverage is fine.`);
    console.log(`The bug must be in address matching or distance filtering.`);

    // Check distance filtering
    if (correctInHash.lat && correctInHash.lng) {
      const distFromCenter = haversineDistance(CENTER_LAT, CENTER_LNG, correctInHash.lat, correctInHash.lng);
      console.log(`Distance from center: ${distFromCenter.toFixed(1)}m (radius: ${RADIUS}m)`);
      console.log(`Would be filtered by 550m radius? ${distFromCenter > 550 ? 'YES - THIS IS THE BUG' : 'NO'}`);
    }
  }

  // ═══════════════════════════════════════════
  // STEP 9: COMPREHENSIVE RDNU ANALYSIS
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 9: Check if bd/hash has DIFFERENT rdnu structure than bd/sales');
  console.log('Hypothesis: bd/hash might use a building-level rdnu while bd/sales uses a unit-level rdnu');

  // For the 테헤란로2길 22 buildings, check if bd/sales returns DIFFERENT rdnus inside
  for (const b of teheran22.slice(0, 3)) {
    console.log(`\nbd/hash rdnu: ${b.rdnu} (${b.ROAD_ADDR})`);
    try {
      const sales = await callOpenUB('bd/sales', { login: true, rdnu: b.rdnu, category: 'A0:B0:C0:D0:F0:G0' });
      if (sales.bd) {
        const bdKeys = Object.keys(sales.bd);
        console.log(`  bd/sales returns ${bdKeys.length} sub-rdnu(s): ${bdKeys.join(', ')}`);
        for (const [k, v] of Object.entries(sales.bd)) {
          console.log(`    "${k}" -> ROAD_ADDR: ${v.ROAD_ADDR || 'N/A'} | stores: ${v.stores?.length || 0}`);
          if (v.stores) {
            for (const s of v.stores) {
              console.log(`      ${s.storeNm || s.name} (${s.category?.mi || ''})`);
            }
          }
        }
        // Does any sub-rdnu match CORRECT_RDNU?
        if (bdKeys.includes(CORRECT_RDNU)) {
          console.log(`  *** CORRECT rdnu "${CORRECT_RDNU}" IS A SUB-RDNU OF THIS BUILDING! ***`);
        }
      } else {
        console.log(`  No bd map in response. Keys: ${Object.keys(sales).join(', ')}`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
    await sleep(100);
  }

  // ═══════════════════════════════════════════
  // STEP 10: DEEP DIVE into bd/sales response structure
  // ═══════════════════════════════════════════
  console.log('\n>>> STEP 10: DEEP DIVE into bd/sales response structure');

  // Re-check CORRECT rdnu with full raw output
  console.log('\n--- CORRECT rdnu full response ---');
  try {
    const sales1 = await callOpenUB('bd/sales', { login: true, rdnu: CORRECT_RDNU, category: 'A0:B0:C0:D0:F0:G0' });
    console.log('Top keys:', Object.keys(sales1));
    console.log('result keys:', sales1.result ? Object.keys(sales1.result) : 'N/A');
    if (sales1.result) {
      console.log('result.stores count:', Array.isArray(sales1.result.stores) ? sales1.result.stores.length : 'not array');
      console.log('result.siteAddr:', sales1.result.siteAddr || 'N/A');
      console.log('result.decodedRdnu:', sales1.result.decodedRdnu || 'N/A');
      if (Array.isArray(sales1.result.stores)) {
        for (const s of sales1.result.stores) {
          const cat = s.category || {};
          console.log(`  STORE: "${s.storeNm || s.name}" | mi="${cat.mi}" sl="${cat.sl}" bg="${cat.bg}" | floor=${s.floor} | isNewOpen=${s.isNewOpen}`);
        }
      }
      if (sales1.result.bd) {
        console.log('result.bd keys:', Object.keys(sales1.result.bd));
      }
    }
    // Check if there's a .bd at top level
    if (sales1.bd) {
      console.log('Top-level bd keys:', Object.keys(sales1.bd));
    }
    // Raw JSON first 1000 chars
    const raw1 = JSON.stringify(sales1).substring(0, 1500);
    console.log(`Raw (1500 chars): ${raw1}`);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }

  // Re-check WRONG rdnu with full raw output
  console.log('\n--- WRONG rdnu (강남대로 390) full response ---');
  try {
    const sales2 = await callOpenUB('bd/sales', { login: true, rdnu: WRONG_RDNU, category: 'A0:B0:C0:D0:F0:G0' });
    console.log('Top keys:', Object.keys(sales2));
    console.log('result keys:', sales2.result ? Object.keys(sales2.result) : 'N/A');
    if (sales2.result) {
      console.log('result.stores count:', Array.isArray(sales2.result.stores) ? sales2.result.stores.length : 'not array');
      if (Array.isArray(sales2.result.stores)) {
        for (const s of sales2.result.stores) {
          const cat = s.category || {};
          console.log(`  STORE: "${s.storeNm || s.name}" | mi="${cat.mi}" sl="${cat.sl}" bg="${cat.bg}" | floor=${s.floor}`);
        }
      }
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }

  // ═══════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total buildings from bd/hash: ${allBuildings.length}`);
  console.log(`Buildings matching "테헤란로2길 22": ${teheran22.length}`);
  if (teheran22.length > 0) {
    console.log(`  Their rdnu(s): ${teheran22.map(b => b.rdnu).join(', ')}`);
  }
  console.log(`CORRECT rdnu (${CORRECT_RDNU}) in bd/hash: ${correctInHash ? 'YES' : 'NO'}`);
  console.log(`WRONG rdnu (${WRONG_RDNU}) in bd/hash: ${wrongInHash ? 'YES (' + wrongInHash.ROAD_ADDR + ')' : 'NO'}`);
  console.log(`강남대로 390 buildings: ${gangnam390.length}`);
};

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
