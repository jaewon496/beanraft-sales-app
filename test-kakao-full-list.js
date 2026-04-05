/**
 * Kakao CE7 API - 강남역 반경 500m 전체 카페 추출
 *
 * 전략: 500m 원을 4x4 그리드(16개 셀)로 분할, 각 셀 중심에서 radius=180m 검색
 * 각 검색은 page 1~3 (최대 45건), 전체 결과를 id로 중복 제거
 */

const https = require('https');

const KAKAO_REST_KEY = '9e149576620513dc3283894501c49ab7';
const CENTER_LAT = 37.4979;
const CENTER_LNG = 127.0276;
const RADIUS = 500; // meters

// 위도/경도 1도당 미터 (서울 기준 근사값)
const LAT_PER_METER = 1 / 111320;
const LNG_PER_METER = 1 / (111320 * Math.cos(CENTER_LAT * Math.PI / 180));

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`JSON parse error: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function searchCategory(x, y, radius, page) {
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CE7&x=${x}&y=${y}&radius=${radius}&sort=distance&page=${page}&size=15`;
  const data = await httpGet(url, { Authorization: `KakaoAK ${KAKAO_REST_KEY}` });
  return data;
}

async function searchAllPages(x, y, radius) {
  const results = [];
  for (let page = 1; page <= 3; page++) {
    const data = await searchCategory(x, y, radius, page);
    if (!data.documents || data.documents.length === 0) break;
    results.push(...data.documents);
    if (data.meta && data.meta.is_end) break;
  }
  return results;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== Kakao CE7 강남역 500m 전체 카페 추출 ===\n');

  // Step 1: 기본 검색으로 total_count 확인
  const initial = await searchCategory(CENTER_LNG, CENTER_LAT, RADIUS, 1);
  const totalCount = initial.meta.total_count;
  console.log(`[INFO] 카카오 CE7 total_count: ${totalCount}`);
  console.log(`[INFO] 단일 검색 최대: 45건 (3pages x 15)`);
  console.log(`[INFO] 전체 추출을 위해 그리드 분할 검색 시작...\n`);

  const allCafes = new Map(); // id -> cafe object

  // Step 2: 그리드 분할 - 5x5 그리드 (25개 셀), 각 셀 중심에서 radius=150m
  const GRID = 5;
  const CELL_RADIUS = 150; // meters
  const stepLat = (RADIUS * 2 / GRID) * LAT_PER_METER;
  const stepLng = (RADIUS * 2 / GRID) * LNG_PER_METER;
  const startLat = CENTER_LAT - (RADIUS * LAT_PER_METER) + (stepLat / 2);
  const startLng = CENTER_LNG - (RADIUS * LNG_PER_METER) + (stepLng / 2);

  let cellCount = 0;
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cy = startLat + row * stepLat;
      const cx = startLng + col * stepLng;

      // 이 셀 중심이 500m 원 안에 있는지 확인
      const distFromCenter = Math.sqrt(
        Math.pow((cy - CENTER_LAT) / LAT_PER_METER, 2) +
        Math.pow((cx - CENTER_LNG) / LNG_PER_METER, 2)
      );
      if (distFromCenter > RADIUS + CELL_RADIUS) continue; // 원 밖이면 스킵

      cellCount++;
      const docs = await searchAllPages(cx, cy, CELL_RADIUS);
      let newCount = 0;
      for (const doc of docs) {
        if (!allCafes.has(doc.id)) {
          // 중심에서의 실제 거리 계산
          const dLat = (parseFloat(doc.y) - CENTER_LAT) / LAT_PER_METER;
          const dLng = (parseFloat(doc.x) - CENTER_LNG) / LNG_PER_METER;
          const dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
          doc._dist = dist;
          allCafes.set(doc.id, doc);
          newCount++;
        }
      }
      process.stdout.write(`  셀 ${cellCount}: (${cy.toFixed(4)}, ${cx.toFixed(4)}) → ${docs.length}건 (신규 ${newCount}건, 누적 ${allCafes.size}건)\n`);
      await sleep(100); // rate limit 방지
    }
  }

  // Step 3: 추가로 더 작은 반경으로 밀집 지역 보충
  console.log('\n[INFO] 밀집 지역 보충 검색 (radius=80m, 7x7 그리드)...');
  const GRID2 = 7;
  const CELL_RADIUS2 = 80;
  const stepLat2 = (RADIUS * 2 / GRID2) * LAT_PER_METER;
  const stepLng2 = (RADIUS * 2 / GRID2) * LNG_PER_METER;
  const startLat2 = CENTER_LAT - (RADIUS * LAT_PER_METER) + (stepLat2 / 2);
  const startLng2 = CENTER_LNG - (RADIUS * LNG_PER_METER) + (stepLng2 / 2);

  let cellCount2 = 0;
  let newInPhase2 = 0;
  for (let row = 0; row < GRID2; row++) {
    for (let col = 0; col < GRID2; col++) {
      const cy = startLat2 + row * stepLat2;
      const cx = startLng2 + col * stepLng2;

      const distFromCenter = Math.sqrt(
        Math.pow((cy - CENTER_LAT) / LAT_PER_METER, 2) +
        Math.pow((cx - CENTER_LNG) / LNG_PER_METER, 2)
      );
      if (distFromCenter > RADIUS + CELL_RADIUS2) continue;

      cellCount2++;
      const docs = await searchAllPages(cx, cy, CELL_RADIUS2);
      for (const doc of docs) {
        if (!allCafes.has(doc.id)) {
          const dLat = (parseFloat(doc.y) - CENTER_LAT) / LAT_PER_METER;
          const dLng = (parseFloat(doc.x) - CENTER_LNG) / LNG_PER_METER;
          const dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
          doc._dist = dist;
          allCafes.set(doc.id, doc);
          newInPhase2++;
        }
      }
      await sleep(50);
    }
  }
  console.log(`  보충 검색 완료: ${cellCount2}셀, 신규 ${newInPhase2}건 추가, 총 ${allCafes.size}건\n`);

  // Step 4: 500m 이내만 필터링 + 정렬
  const cafesInRadius = [...allCafes.values()]
    .filter(c => c._dist <= 550) // 약간의 여유
    .sort((a, b) => a._dist - b._dist);

  // Step 5: 출력
  console.log(`\n${'='.repeat(120)}`);
  console.log(`강남역 반경 500m 카페 전체 목록 (총 ${cafesInRadius.length}개)`);
  console.log(`${'='.repeat(120)}`);
  console.log(`${'#'.padStart(4)} | ${'이름'.padEnd(30)} | ${'주소'.padEnd(50)} | ${'거리'.padStart(5)} | 카테고리`);
  console.log(`${'-'.repeat(120)}`);

  for (let i = 0; i < cafesInRadius.length; i++) {
    const c = cafesInRadius[i];
    const name = (c.place_name || '').substring(0, 28).padEnd(30);
    const addr = (c.road_address_name || c.address_name || '').substring(0, 48).padEnd(50);
    const dist = String(c._dist).padStart(4) + 'm';
    const cat = (c.category_name || '').replace('음식점 > 카페', '카페');
    console.log(`${String(i + 1).padStart(4)} | ${name} | ${addr} | ${dist} | ${cat}`);
  }

  console.log(`\n${'='.repeat(120)}`);
  console.log(`총 ${cafesInRadius.length}개 카페 (500m 이내)`);
  console.log(`카카오 CE7 total_count: ${totalCount}`);
  console.log(`검색 셀 수: Phase1=${cellCount}셀(r=150m), Phase2=${cellCount2}셀(r=80m)`);

  // 거리 분포
  const dist100 = cafesInRadius.filter(c => c._dist <= 100).length;
  const dist200 = cafesInRadius.filter(c => c._dist > 100 && c._dist <= 200).length;
  const dist300 = cafesInRadius.filter(c => c._dist > 200 && c._dist <= 300).length;
  const dist400 = cafesInRadius.filter(c => c._dist > 300 && c._dist <= 400).length;
  const dist500 = cafesInRadius.filter(c => c._dist > 400 && c._dist <= 500).length;
  const distOver = cafesInRadius.filter(c => c._dist > 500).length;
  console.log(`\n거리 분포: 0-100m: ${dist100} | 100-200m: ${dist200} | 200-300m: ${dist300} | 300-400m: ${dist400} | 400-500m: ${dist500} | 500m+: ${distOver}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
