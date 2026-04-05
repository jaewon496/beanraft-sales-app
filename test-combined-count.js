// test-combined-count.js
// OpenUB (gp + bd/sales) + Kakao CE7 combined cafe count for 강남역

const CENTER_LAT = 37.4979;
const CENTER_LNG = 127.0276;
const RADIUS = 500;

const OPENUB_TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';
const KAKAO_KEY = '9e149576620513dc3283894501c49ab7';

const CELL_TOKENS = [
  '357ca115','357ca139','357ca13f','357ca15','357ca161','357ca167',
  '357ca169','357ca16b','357ca3df','357ca3e4','357ca3f7','357ca3fc',
  '357ca401','357ca407','357ca409','357ca6ab','357ca6ad','357ca6b3'
];

const KAKAO_EXCLUDE = [
  '보드게임','만화','사주','방탈출','수면캡슐','룸카페','모임공간',
  '토즈','이스케이프','키이스케이프','퍼즐팩토리','황금열쇠'
];

const NAME_EXCLUDE_KEYWORDS = ['에스테틱','액세서리','홀릭','빈대떡','떡갈비','냉면','김밤','치킨','고기'];

// ─── Helpers ───

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── OpenUB API call ───

async function callOpenUB(endpoint, body) {
  const res = await fetch(`https://api.openub.com/v2/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
      'Origin': 'https://www.openub.com',
      'Referer': 'https://www.openub.com/',
      'Access-Token': OPENUB_TOKEN
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenUB ${endpoint} ${res.status}: ${t.substring(0,200)}`);
  }
  return res.json();
}

// ─── Cafe category filter (same as proxy) ───

function isCafeCategory(category, storeName) {
  if (!category) return false;
  const mi = category.mi || '';
  const sl = category.sl || '';
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

// ─── STEP 1: OpenUB gp + bd/hash + bd/sales ───

async function fetchOpenUBCafes() {
  console.log('\n=== STEP 1: OpenUB gp + bd/hash + bd/sales ===\n');

  // 1a) gp with A8 to find cafe buildings
  console.log('Calling gp (A8 category)...');
  const gpResult = await callOpenUB('gp', {
    hashKeys: CELL_TOKENS,
    globalParam: { categories: 'A8' },
    login: true
  });

  // 1b) bd/hash to get building addresses + coords
  console.log('Calling bd/hash...');
  const hashResult = await callOpenUB('bd/hash', { cellTokens: CELL_TOKENS });

  // Parse buildings from hash
  const bd = hashResult?.bd || {};
  const buildingMap = {};
  for (const [rdnu, info] of Object.entries(bd)) {
    if (!info || typeof info !== 'object') continue;
    const center = info.center;
    const bLat = Array.isArray(center) ? center[1] : null;
    const bLng = Array.isArray(center) ? center[0] : null;
    if (bLat && bLng) {
      const dist = haversine(CENTER_LAT, CENTER_LNG, bLat, bLng);
      if (dist <= RADIUS) {
        buildingMap[rdnu] = { lat: bLat, lng: bLng, address: info.ROAD_ADDR || info.ADDR || '', dist: Math.round(dist) };
      }
    }
  }
  console.log(`Buildings in ${RADIUS}m: ${Object.keys(buildingMap).length}`);

  // Parse gp response to find cafe buildings
  const cafeRdnus = new Set();
  const gpCafeCounts = {}; // rdnu -> count from gp
  for (const [cellKey, cellData] of Object.entries(gpResult)) {
    if (!cellData || typeof cellData !== 'object') continue;
    for (const [rdnu, info] of Object.entries(cellData)) {
      if (!info || typeof info !== 'object') continue;
      if (!buildingMap[rdnu]) continue; // outside radius
      cafeRdnus.add(rdnu);
      if (!gpCafeCounts[rdnu]) gpCafeCounts[rdnu] = 0;
      gpCafeCounts[rdnu] += (info.count || 0);
    }
  }

  const gpTotalCount = Object.values(gpCafeCounts).reduce((s, c) => s + c, 0);
  console.log(`gp A8 found ${cafeRdnus.size} cafe buildings, total count from gp: ${gpTotalCount}`);

  // 1c) bd/sales for cafe buildings only (A0 category to get store names)
  console.log(`\nCalling bd/sales for ${cafeRdnus.size} cafe buildings (batch=30, delay=100ms)...`);
  const cafeRdnuArr = Array.from(cafeRdnus);
  const allCafes = [];
  const BATCH = 30;
  const DELAY = 100;

  for (let i = 0; i < cafeRdnuArr.length; i += BATCH) {
    const batch = cafeRdnuArr.slice(i, i + BATCH);
    const promises = batch.map(rdnu =>
      callOpenUB('bd/sales', { login: true, rdnu, category: 'A0:B0:C0:D0:F0:G0' })
        .then(data => ({ rdnu, data, ok: true }))
        .catch(err => ({ rdnu, error: err.message, ok: false }))
    );
    const results = await Promise.all(promises);

    for (const r of results) {
      if (!r.ok) { console.log(`  FAIL ${r.rdnu}: ${r.error}`); continue; }
      // Extract cafe stores
      const data = r.data;
      const bdMap = data.bd || data.result?.bd || {};
      for (const [bdRdnu, bdInfo] of Object.entries(bdMap)) {
        if (!bdInfo || typeof bdInfo !== 'object') continue;
        const stores = bdInfo.stores || [];
        if (!Array.isArray(stores)) continue;
        for (const store of stores) {
          const name = store.storeNm || store.name || '';
          if (!isCafeCategory(store.category, name)) continue;
          const coord = store.coord || bdInfo.center || null;
          const lat = Array.isArray(coord) ? coord[1] : null;
          const lng = Array.isArray(coord) ? coord[0] : null;
          allCafes.push({
            name,
            address: bdInfo.roadAddr || bdInfo.siteAddr || store.address || buildingMap[bdRdnu]?.address || '',
            lat, lng,
            rdnu: bdRdnu,
            source: 'openub'
          });
        }
      }
      // Also check stores at top level
      const topStores = data.stores || data.result?.stores || [];
      if (Array.isArray(topStores)) {
        for (const store of topStores) {
          const name = store.storeNm || store.name || '';
          if (!isCafeCategory(store.category, name)) continue;
          const coord = store.coord || store.center || null;
          const lat = Array.isArray(coord) ? coord[1] : null;
          const lng = Array.isArray(coord) ? coord[0] : null;
          // avoid duplicates by storeId
          const existing = allCafes.find(c => c.name === name && c.rdnu === r.rdnu);
          if (!existing) {
            allCafes.push({
              name,
              address: store.roadAddr || store.siteAddr || store.address || buildingMap[r.rdnu]?.address || '',
              lat, lng,
              rdnu: r.rdnu,
              source: 'openub'
            });
          }
        }
      }
    }

    if (i + BATCH < cafeRdnuArr.length) await sleep(DELAY);
  }

  // Deduplicate by name+rdnu
  const seen = new Set();
  const uniqueCafes = [];
  for (const c of allCafes) {
    const key = `${c.name}|${c.rdnu}`;
    if (!seen.has(key)) { seen.add(key); uniqueCafes.push(c); }
  }

  console.log(`\nOpenUB cafes (after dedup): ${uniqueCafes.length}`);
  console.log('Sample OpenUB cafes:');
  uniqueCafes.slice(0, 15).forEach((c, i) => console.log(`  ${i+1}. ${c.name} | ${c.address}`));
  if (uniqueCafes.length > 15) console.log(`  ... and ${uniqueCafes.length - 15} more`);

  return uniqueCafes;
}

// ─── STEP 2: Kakao CE7 grid search ───

async function fetchKakaoCafes() {
  console.log('\n=== STEP 2: Kakao CE7 (5x5 grid, 500m) ===\n');

  const GRID = 5;
  const gridStep = (RADIUS * 2) / GRID;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(CENTER_LAT * Math.PI / 180);

  const allPlaces = new Map(); // id -> place
  let totalApiCalls = 0;

  for (let gi = 0; gi < GRID; gi++) {
    for (let gj = 0; gj < GRID; gj++) {
      const offsetLat = ((gi - (GRID-1)/2) * gridStep) / mPerDegLat;
      const offsetLng = ((gj - (GRID-1)/2) * gridStep) / mPerDegLng;
      const gridLat = CENTER_LAT + offsetLat;
      const gridLng = CENTER_LNG + offsetLng;
      const gridRadius = Math.ceil(gridStep * 0.8); // enough to overlap

      // Fetch up to 3 pages (45 results per grid cell)
      for (let page = 1; page <= 3; page++) {
        const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CE7&x=${gridLng}&y=${gridLat}&radius=${gridRadius}&page=${page}&size=15&sort=distance`;
        const res = await fetch(url, {
          headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }
        });
        totalApiCalls++;
        if (!res.ok) { console.log(`Kakao error: ${res.status}`); break; }
        const data = await res.json();
        const docs = data.documents || [];
        for (const d of docs) {
          if (!allPlaces.has(d.id)) {
            allPlaces.set(d.id, {
              id: d.id,
              name: d.place_name,
              address: d.road_address_name || d.address_name,
              category: d.category_name,
              lat: parseFloat(d.y),
              lng: parseFloat(d.x),
              source: 'kakao'
            });
          }
        }
        if (data.meta?.is_end) break;
      }
    }
  }

  console.log(`Kakao API calls: ${totalApiCalls}`);
  console.log(`Kakao raw CE7 results: ${allPlaces.size}`);

  // Filter to within radius
  let withinRadius = [];
  for (const p of allPlaces.values()) {
    const dist = haversine(CENTER_LAT, CENTER_LNG, p.lat, p.lng);
    if (dist <= RADIUS) {
      p.dist = Math.round(dist);
      withinRadius.push(p);
    }
  }
  console.log(`Within ${RADIUS}m: ${withinRadius.length}`);

  // Filter out non-cafes
  const filtered = withinRadius.filter(p => {
    const cat = (p.category || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    for (const ex of KAKAO_EXCLUDE) {
      if (cat.includes(ex) || name.includes(ex.toLowerCase())) return false;
    }
    return true;
  });

  console.log(`After excluding non-cafes: ${filtered.length}`);
  console.log('Sample Kakao cafes:');
  filtered.slice(0, 15).forEach((c, i) => console.log(`  ${i+1}. ${c.name} | ${c.address} | ${c.dist}m`));
  if (filtered.length > 15) console.log(`  ... and ${filtered.length - 15} more`);

  return filtered;
}

// ─── STEP 3: Name normalization + matching ───

function normalizeName(name) {
  if (!name) return '';
  let n = name;
  // Remove spaces
  n = n.replace(/\s+/g, '');
  // Remove (주), 주식회사
  n = n.replace(/\(주\)/g, '').replace(/주식회사/g, '');
  // English to Korean conversions
  n = n.replace(/MGC/gi, '엠지씨');
  n = n.replace(/Coffee/gi, '커피');
  n = n.replace(/Cafe/gi, '카페');
  // Lowercase English
  n = n.replace(/[A-Za-z]+/g, m => m.toLowerCase());
  // Remove branch suffixes: XX역N점, XX점, N호점, N호, 지점, etc.
  n = n.replace(/[가-힣a-z0-9]*역\d*점$/, '');
  n = n.replace(/[가-힣a-z0-9]*\d*점$/, '');
  n = n.replace(/\d+호점$/, '');
  n = n.replace(/\d+호$/, '');
  n = n.replace(/지점$/, '');
  // Also remove trailing 점
  n = n.replace(/점$/, '');
  return n;
}

function extractBrandCore(name) {
  return normalizeName(name);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function isNameMatch(name1, name2) {
  const b1 = extractBrandCore(name1);
  const b2 = extractBrandCore(name2);
  if (!b1 || !b2) return false;
  // Exact match
  if (b1 === b2) return true;
  // One contains the other
  if (b1.includes(b2) || b2.includes(b1)) return true;
  // Levenshtein < 3
  if (levenshtein(b1, b2) < 3) return true;
  return false;
}

function normalizeAddress(addr) {
  if (!addr) return '';
  return addr
    .replace(/\s+/g, '')
    .replace(/서울특별시/g, '서울')
    .replace(/부산광역시/g, '부산')
    .replace(/대구광역시/g, '대구')
    .replace(/인천광역시/g, '인천')
    .replace(/광주광역시/g, '광주')
    .replace(/대전광역시/g, '대전')
    .replace(/울산광역시/g, '울산')
    .replace(/세종특별자치시/g, '세종')
    .replace(/경기도/g, '경기')
    .replace(/지하/g, '지하');
}

function isLocationMatch(cafe1, cafe2) {
  // If both have coords, check distance < 50m
  if (cafe1.lat && cafe1.lng && cafe2.lat && cafe2.lng) {
    return haversine(cafe1.lat, cafe1.lng, cafe2.lat, cafe2.lng) < 50;
  }
  // If both have addresses, check similarity with normalized addresses
  if (cafe1.address && cafe2.address) {
    const a1 = normalizeAddress(cafe1.address);
    const a2 = normalizeAddress(cafe2.address);
    // Extract road name + number part (e.g. 강남대로359 or 테헤란로4길46)
    const roadPattern = /([가-힣]+로[가-힣]*\d*길?)\s*(?:지하)?\s*(\d+)/;
    const m1 = a1.match(roadPattern);
    const m2 = a2.match(roadPattern);
    if (m1 && m2) {
      return m1[1] === m2[1] && m1[2] === m2[2];
    }
    // Fallback: check if one contains a significant chunk of the other
    if (a1.length > 5 && a2.length > 5) {
      return a1.includes(a2.substring(0, Math.min(15, a2.length))) ||
             a2.includes(a1.substring(0, Math.min(15, a1.length)));
    }
  }
  return false;
}

function findMatch(kakaoCafe, openubCafes) {
  // First pass: name match + location match
  for (const ou of openubCafes) {
    if (isNameMatch(kakaoCafe.name, ou.name) && isLocationMatch(kakaoCafe, ou)) {
      return { match: ou, method: 'name+location' };
    }
  }
  // Second pass: exact normalized name match (no location needed - same area)
  const kNorm = extractBrandCore(kakaoCafe.name);
  for (const ou of openubCafes) {
    const oNorm = extractBrandCore(ou.name);
    if (kNorm && oNorm && kNorm === oNorm) {
      return { match: ou, method: 'exact-name' };
    }
  }
  return null;
}

// ─── STEP 4: Combine ───

async function main() {
  console.log('========================================');
  console.log('Combined Cafe Count Test: 강남역');
  console.log(`Center: ${CENTER_LAT}, ${CENTER_LNG} | Radius: ${RADIUS}m`);
  console.log('========================================');

  const t0 = Date.now();

  // Fetch both sources
  const openubCafes = await fetchOpenUBCafes();
  const kakaoCafes = await fetchKakaoCafes();

  // Match
  console.log('\n=== STEP 3: Name Matching ===\n');

  const matched = [];
  const kakaoOnly = [];

  for (const kc of kakaoCafes) {
    const result = findMatch(kc, openubCafes);
    if (result) {
      matched.push({ kakao: kc, openub: result.match, method: result.method });
    } else {
      kakaoOnly.push(kc);
    }
  }

  console.log(`Matched (overlap): ${matched.length}`);
  if (matched.length > 0) {
    console.log('Match examples:');
    matched.slice(0, 15).forEach((m, i) => {
      console.log(`  ${i+1}. [${m.method}] Kakao: "${m.kakao.name}" <-> OpenUB: "${m.openub.name}"`);
      console.log(`     Kakao addr: ${m.kakao.address}`);
      console.log(`     OpenUB addr: ${m.openub.address}`);
      const dist = (m.kakao.lat && m.openub.lat)
        ? Math.round(haversine(m.kakao.lat, m.kakao.lng, m.openub.lat, m.openub.lng)) + 'm'
        : 'N/A';
      console.log(`     Distance: ${dist}`);
    });
    if (matched.length > 15) console.log(`  ... and ${matched.length - 15} more`);
  }

  console.log(`\nKakao-only (보충): ${kakaoOnly.length}`);
  if (kakaoOnly.length > 0) {
    console.log('Kakao-only cafes:');
    kakaoOnly.forEach((c, i) => {
      console.log(`  ${i+1}. ${c.name} | ${c.address} | ${c.dist}m`);
    });
  }

  // Final combined
  const combined = [...openubCafes, ...kakaoOnly];

  const elapsed = Date.now() - t0;

  console.log('\n========================================');
  console.log('FINAL RESULTS');
  console.log('========================================');
  console.log(`OpenUB cafes:          ${openubCafes.length}`);
  console.log(`Kakao filtered cafes:  ${kakaoCafes.length}`);
  console.log(`Matched (overlap):     ${matched.length}`);
  console.log(`Kakao-only (보충):     ${kakaoOnly.length}`);
  console.log(`FINAL COMBINED:        ${combined.length}`);
  console.log(`  = OpenUB(${openubCafes.length}) + Kakao보충(${kakaoOnly.length})`);
  console.log(`Total time: ${(elapsed/1000).toFixed(1)}s`);
  console.log('========================================');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
