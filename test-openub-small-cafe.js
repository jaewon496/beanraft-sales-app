// test-openub-small-cafe.js
// 소규모 개인카페가 OpenUB bd/sales에서 누락되는 원인 조사
// 카카오에서 발견된 카페 8개 → OpenUB에서 건물 발견 여부 + bd/sales 존재 여부 + search API 존재 여부

import { S2 } from 's2-geometry';

const ACCESS_TOKEN = 'f3ddcfb3-caf4-4c30-9e09-f3f7fbc1abc1';
const S2_LEVEL = 14;

const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip',
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/',
  'Access-Token': ACCESS_TOKEN
};

const JUSO_HEADERS = {
  'Origin': 'https://www.openub.com',
  'Referer': 'https://www.openub.com/'
};

// ─── 테스트 대상 카페 목록 ───
const CENTER = { lat: 37.4979, lng: 127.0276 }; // 강남역
const SEARCH_RADIUS = 600; // 600m로 넓게 잡아서 전부 커버

const TARGET_CAFES = [
  { name: '카페슬로우', address: '서울 서초구 서초대로77길 35', distFromKakao: 379 },
  { name: '카우커피', address: '서울 강남구 테헤란로 131', distFromKakao: 517 },
  { name: '더카페868', address: '서울 강남구 테헤란로2길 22', distFromKakao: 198 },
  { name: '코티커피 강남효성점', address: '서울 강남구 강남대로84길 15', distFromKakao: 221 },
  { name: 'R카페', address: '서울 강남구 강남대로98길 14', distFromKakao: 312 },
  { name: '015COFFEE', address: '서울 강남구 봉은사로18길 84', distFromKakao: 369 },
  { name: '커피스미스 본사점', address: '서울 강남구 테헤란로8길 25', distFromKakao: 408 },
  { name: '카페베르가모', address: '서울 강남구 역삼로7길 22', distFromKakao: 532 },
];

// ─── S2 셀 함수 (openub-proxy.js에서 복사) ───

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

// ─── API 호출 ───

async function callOpenUB(endpoint, body) {
  const res = await fetch(`https://api.openub.com/v2/${endpoint}`, {
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

async function searchJuso(name) {
  const url = `https://juso.openub.com/v2/search/${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: JUSO_HEADERS });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { error: `${res.status}: ${text.substring(0, 200)}` };
  }
  return res.json();
}

// ─── 도로명 주소에서 핵심 부분 추출 (매칭용) ───

function extractRoadKey(address) {
  // "서울 강남구 테헤란로2길 22" → "테헤란로2길 22" 등
  // "서울특별시 강남구 테헤란로2길 22" → "테헤란로2길 22"
  const parts = address.replace(/서울특별시|서울시|서울/g, '').trim().split(/\s+/);
  // 구 이후 부분만 (도로명 + 번호)
  if (parts.length >= 3) {
    return parts.slice(1).join(' '); // 구 제외, 나머지
  }
  return address;
}

// ─── 메인 ───

async function main() {
  console.log('=== OpenUB 소규모 카페 누락 조사 ===\n');
  console.log(`검색 중심: 강남역 (${CENTER.lat}, ${CENTER.lng})`);
  console.log(`검색 반경: ${SEARCH_RADIUS}m (카카오 거리 기준 500m 초과 카페 포함)\n`);

  // STEP 1: S2 셀 생성 + bd/hash 호출
  console.log('--- STEP 1: bd/hash로 건물 목록 조회 ---');
  const cellTokens = latLngToS2Tokens(CENTER.lat, CENTER.lng, SEARCH_RADIUS, S2_LEVEL);
  console.log(`S2 셀 수: ${cellTokens.length} (level ${S2_LEVEL})`);

  const hashResult = await callOpenUB('bd/hash', { cellTokens });
  const bd = hashResult?.bd || {};
  const allBuildings = [];

  for (const [rdnu, info] of Object.entries(bd)) {
    if (!info || typeof info !== 'object') continue;
    const center = info.center;
    const bLat = Array.isArray(center) ? center[1] : null;
    const bLng = Array.isArray(center) ? center[0] : null;
    let dist = null;
    if (bLat && bLng) {
      dist = haversineDistance(CENTER.lat, CENTER.lng, bLat, bLng);
    }
    allBuildings.push({
      rdnu,
      lat: bLat,
      lng: bLng,
      address: info.ROAD_ADDR || info.ADDR || '',
      siteAddr: info.ADDR || '',
      dist
    });
  }

  console.log(`전체 건물 수 (bd/hash): ${allBuildings.length}`);
  const within600 = allBuildings.filter(b => b.dist !== null && b.dist <= 600);
  console.log(`600m 이내 건물 수: ${within600.length}\n`);

  // STEP 2: 각 카페의 건물 매칭
  console.log('--- STEP 2: 카페별 건물 매칭 ---\n');

  const results = [];

  for (const cafe of TARGET_CAFES) {
    const roadKey = extractRoadKey(cafe.address);
    console.log(`[${cafe.name}] 주소: ${cafe.address} (카카오 거리: ${cafe.distFromKakao}m)`);
    console.log(`  매칭 키: "${roadKey}"`);

    // 건물 찾기: ROAD_ADDR에 도로명+번호가 포함된 건물
    const matched = allBuildings.filter(b => {
      if (!b.address) return false;
      return b.address.includes(roadKey) || b.address.includes(roadKey.replace(/\s+/g, ''));
    });

    if (matched.length === 0) {
      // 더 느슨한 매칭: 도로명만으로
      const roadName = roadKey.split(/\s+/)[0]; // "테헤란로2길"
      const number = roadKey.split(/\s+/).slice(1).join(' '); // "22"
      const looseMatch = allBuildings.filter(b =>
        b.address && b.address.includes(roadName) && b.address.includes(number)
      );
      if (looseMatch.length > 0) {
        console.log(`  건물 발견 (느슨한 매칭): ${looseMatch.length}개`);
        for (const m of looseMatch) {
          console.log(`    rdnu=${m.rdnu}, addr=${m.address}, dist=${m.dist?.toFixed(0)}m`);
        }
        results.push({ ...cafe, building: looseMatch[0], buildingFound: true });
      } else {
        console.log(`  *** 건물 미발견! bd/hash에 이 주소의 건물이 없음 ***`);
        results.push({ ...cafe, building: null, buildingFound: false });
      }
    } else {
      console.log(`  건물 발견: ${matched.length}개`);
      for (const m of matched) {
        console.log(`    rdnu=${m.rdnu}, addr=${m.address}, dist=${m.dist?.toFixed(0)}m`);
      }
      results.push({ ...cafe, building: matched[0], buildingFound: true });
    }
    console.log('');
  }

  // STEP 3: 건물이 발견된 카페 → bd/sales 호출
  console.log('--- STEP 3: bd/sales로 매장 조회 ---\n');

  for (const r of results) {
    if (!r.buildingFound) {
      console.log(`[${r.name}] 건물 미발견 → bd/sales 스킵\n`);
      continue;
    }

    const rdnu = r.building.rdnu;
    console.log(`[${r.name}] bd/sales 호출 (rdnu=${rdnu})`);

    try {
      const salesData = await callOpenUB('bd/sales', {
        login: true,
        rdnu,
        category: 'A0:B0:C0:D0:F0:G0'
      });

      // stores 찾기
      let stores = [];
      if (salesData.bd && typeof salesData.bd === 'object') {
        for (const [bRdnu, bInfo] of Object.entries(salesData.bd)) {
          if (bInfo && Array.isArray(bInfo.stores)) {
            stores.push(...bInfo.stores.map(s => ({ ...s, _rdnu: bRdnu })));
          }
        }
      }
      if (salesData.stores && Array.isArray(salesData.stores)) {
        stores.push(...salesData.stores);
      }

      console.log(`  전체 매장 수: ${stores.length}`);

      // 모든 매장 출력
      if (stores.length > 0) {
        console.log('  --- 이 건물의 모든 매장 ---');
        for (const store of stores) {
          const cat = store.category ? `${store.category.mi || ''}/${store.category.sl || ''}` : 'N/A';
          console.log(`    ${store.storeNm || store.name || '???'} | 카테고리: ${cat} | storeId: ${store.storeId || store.id || 'N/A'}`);
        }
      }

      // 카페 이름 매칭
      const nameKey = r.name.replace(/\s+/g, '').toLowerCase();
      const found = stores.find(s => {
        const sName = (s.storeNm || s.name || '').replace(/\s+/g, '').toLowerCase();
        return sName.includes(nameKey) || nameKey.includes(sName);
      });

      if (found) {
        console.log(`  >>> 카페 발견! "${found.storeNm || found.name}"`);
        r.foundInSales = true;
      } else {
        console.log(`  >>> *** 카페 미발견 (bd/sales에 이 이름의 매장 없음) ***`);
        r.foundInSales = false;
      }
    } catch (err) {
      console.log(`  bd/sales 에러: ${err.message}`);
      r.foundInSales = false;
      r.salesError = err.message;
    }

    console.log('');
    await sleep(300); // rate limit
  }

  // STEP 4: juso.openub.com 검색 API
  console.log('--- STEP 4: juso.openub.com 검색 API ---\n');

  const searchNames = ['카페슬로우', '더카페868', '카우커피', '코티커피', 'R카페', '015COFFEE', '커피스미스'];

  for (const name of searchNames) {
    console.log(`검색: "${name}"`);
    try {
      const searchResult = await searchJuso(name);

      if (searchResult.error) {
        console.log(`  에러: ${searchResult.error}`);
      } else if (Array.isArray(searchResult)) {
        console.log(`  결과 수: ${searchResult.length}`);
        for (const item of searchResult.slice(0, 5)) {
          const salesFlag = item.salesExists !== undefined ? `salesExists=${item.salesExists}` : 'salesExists=N/A';
          console.log(`    ${item.name || item.storeNm || item.bdNm || JSON.stringify(item).substring(0, 100)} | ${salesFlag}`);
        }
      } else if (typeof searchResult === 'object') {
        // 구조가 다를 수 있음
        const items = searchResult.data || searchResult.results || searchResult.list || [];
        if (Array.isArray(items)) {
          console.log(`  결과 수: ${items.length}`);
          for (const item of items.slice(0, 5)) {
            const salesFlag = item.salesExists !== undefined ? `salesExists=${item.salesExists}` : 'salesExists=N/A';
            console.log(`    ${item.name || item.storeNm || item.bdNm || JSON.stringify(item).substring(0, 100)} | ${salesFlag}`);
          }
        } else {
          console.log(`  응답 구조: ${JSON.stringify(searchResult).substring(0, 300)}`);
        }
      }
    } catch (err) {
      console.log(`  에러: ${err.message}`);
    }
    console.log('');
    await sleep(300);
  }

  // STEP 5: 종합 요약
  console.log('\n=== 종합 요약 ===\n');
  console.log('카페명 | 카카오거리 | 500m이내? | 건물발견? | bd/sales발견?');
  console.log('-'.repeat(75));

  for (const r of results) {
    const within500 = r.distFromKakao <= 500 ? 'YES' : 'NO';
    const bdFound = r.buildingFound ? 'YES' : 'NO';
    const salesFound = r.foundInSales === true ? 'YES' : (r.foundInSales === false ? 'NO' : 'SKIP');
    console.log(`${r.name.padEnd(20)} | ${String(r.distFromKakao).padStart(4)}m | ${within500.padEnd(9)} | ${bdFound.padEnd(8)} | ${salesFound}`);
  }

  console.log('\n--- 분류 ---');
  const within500Missing = results.filter(r => r.distFromKakao <= 500 && r.buildingFound && !r.foundInSales);
  const noBuildingFound = results.filter(r => r.distFromKakao <= 500 && !r.buildingFound);
  const beyond500 = results.filter(r => r.distFromKakao > 500);

  if (beyond500.length > 0) {
    console.log(`\n[500m 초과 - 반경 밖]: ${beyond500.map(r => r.name).join(', ')}`);
  }
  if (noBuildingFound.length > 0) {
    console.log(`\n[500m 이내 - 건물 자체 미발견 (bd/hash 커버리지 갭)]: ${noBuildingFound.map(r => r.name).join(', ')}`);
  }
  if (within500Missing.length > 0) {
    console.log(`\n[500m 이내 - 건물은 있으나 bd/sales에 없음 (진짜 누락)]: ${within500Missing.map(r => r.name).join(', ')}`);
  }

  const allFoundInSales = results.filter(r => r.foundInSales === true);
  if (allFoundInSales.length > 0) {
    console.log(`\n[bd/sales에서 발견됨]: ${allFoundInSales.map(r => r.name).join(', ')}`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
