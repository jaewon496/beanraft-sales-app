// 네이버 지역검색 API 3단계 전략 + 카카오 비교
// 강남역 좌표(37.4979526, 127.0276242) 기준 반경 500m

const https = require('https');
const fs = require('fs');
const path = require('path');

// .env 파일 파싱
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const CENTER = { lat: 37.4979526, lng: 127.0276242 };
const RADIUS = 500;
const NAVER_CLIENT_ID = env.NAVER_SEARCH_CLIENT_ID;
const NAVER_CLIENT_SECRET = env.NAVER_SEARCH_CLIENT_SECRET;
const KAKAO_KEY = '9e149576620513dc3283894501c49ab7';

console.log(`네이버 API 키: ${NAVER_CLIENT_ID ? 'OK' : 'MISSING'}`);
console.log(`카카오 API 키: ${KAKAO_KEY ? 'OK' : 'MISSING'}`);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJSON(url, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: headers
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Haversine 거리 계산 (미터)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 네이버 mapx, mapy를 WGS84로 변환
// 네이버 지역검색 API: mapx/mapy는 경위도 * 10^7 형태 (예: 1270291613 = 127.0291613)
function convertNaverCoords(mapx, mapy) {
  const x = parseInt(mapx);
  const y = parseInt(mapy);

  // 10자리(10억대) = 경도*10^7, 9자리(1억대~) = 위도*10^7
  if (x > 1000000000) {
    // 경위도 * 10^7
    return { lat: y / 10000000, lng: x / 10000000 };
  }

  if (x > 100000000) {
    // 경위도 * 10^7 (위도 쪽이 9자리)
    return { lat: y / 10000000, lng: x / 10000000 };
  }

  // 혹시 더 작은 값이면 그대로
  return { lat: y, lng: x };
}

// HTML 태그 제거
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}

// 중복 키 생성
function dedupeKey(name, address) {
  const cleanName = stripHtml(name).replace(/\s+/g, '');
  const cleanAddr = (address || '').replace(/\s+/g, '');
  return `${cleanName}|${cleanAddr}`;
}

// 네이버 지역검색
async function naverSearch(query, start = 1) {
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=${start}&sort=random`;
  try {
    const data = await fetchJSON(url, {
      'X-Naver-Client-Id': NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
    });
    if (data.items) return data.items;
    if (data.errorCode) {
      console.error(`  네이버 API 에러: ${data.errorCode} - ${data.errorMessage}`);
    }
    return [];
  } catch (e) {
    console.error(`  네이버 검색 에러 (${query}): ${e.message}`);
    return [];
  }
}

// 네이버 쿼리 페이징 검색 (start=1,6,11,...,46)
async function naverSearchPaged(query) {
  const allItems = [];
  for (let start = 1; start <= 46; start += 5) {
    const items = await naverSearch(query, start);
    allItems.push(...items);
    if (items.length < 5) break; // 더 이상 결과 없음
    await sleep(300);
  }
  return allItems;
}

// 네이버 결과를 통일 포맷으로 변환
function processNaverItem(item) {
  const name = stripHtml(item.title);
  const address = item.roadAddress || item.address || '';
  const coords = convertNaverCoords(item.mapx, item.mapy);
  const dist = haversineDistance(CENTER.lat, CENTER.lng, coords.lat, coords.lng);
  return {
    name,
    address,
    lat: coords.lat,
    lng: coords.lng,
    distance: Math.round(dist),
    category: item.category || '',
    phone: item.telephone || '',
    source: 'naver',
    mapx: item.mapx,
    mapy: item.mapy
  };
}

// 도로명 추출 ("OO로", "OO길")
function extractRoadNames(cafes) {
  const roadSet = new Set();
  for (const cafe of cafes) {
    if (!cafe.address) continue;
    // "서울 강남구 테헤란로 123" -> "테헤란로"
    const matches = cafe.address.match(/([가-힣]+(?:로|길))\s/g);
    if (matches) {
      for (const m of matches) {
        const road = m.trim();
        // 시/도/구/동 등 행정구역 제외
        if (road.endsWith('로') || road.endsWith('길')) {
          if (!road.match(/^(서울|경기|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/)) {
            roadSet.add(road);
          }
        }
      }
    }
  }
  return [...roadSet];
}

// 카카오 CE7 격자 검색
function generateGridPoints(center, gridSpacing = 200) {
  const points = [];
  const latPerMeter = 1 / 111320;
  const lngPerMeter = 1 / (111320 * Math.cos(center.lat * Math.PI / 180));
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.sqrt(dx * dx + dy * dy) * gridSpacing > RADIUS + 50) continue;
      points.push({
        lat: center.lat + dy * gridSpacing * latPerMeter,
        lng: center.lng + dx * gridSpacing * lngPerMeter
      });
    }
  }
  return points;
}

async function collectKakaoCafes() {
  const gridPoints = generateGridPoints(CENTER);
  console.log(`\n카카오 격자점 ${gridPoints.length}개 생성`);
  const allCafes = new Map();
  let totalRaw = 0;

  for (let i = 0; i < gridPoints.length; i++) {
    const gp = gridPoints[i];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 3) {
      const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CE7&x=${gp.lng}&y=${gp.lat}&radius=250&page=${page}&size=15&sort=distance`;
      try {
        const data = await fetchJSON(url, { Authorization: `KakaoAK ${KAKAO_KEY}` });
        if (data.documents) {
          for (const doc of data.documents) {
            totalRaw++;
            const dist = haversineDistance(CENTER.lat, CENTER.lng, parseFloat(doc.y), parseFloat(doc.x));
            if (dist <= RADIUS) {
              allCafes.set(doc.id, {
                name: doc.place_name,
                address: doc.road_address_name || doc.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                distance: Math.round(dist),
                phone: doc.phone,
                category: doc.category_name,
                source: 'kakao'
              });
            }
          }
          hasMore = !data.meta.is_end && data.documents.length > 0;
        } else {
          hasMore = false;
        }
      } catch (e) {
        console.error(`  카카오 격자 ${i} 페이지 ${page} 에러:`, e.message);
        hasMore = false;
      }
      page++;
      await sleep(300);
    }
  }

  return { cafes: [...allCafes.values()], totalRaw, deduped: allCafes.size };
}

// ===== 메인 실행 =====
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`강남역 반경 ${RADIUS}m 카페 수집 - 3단계 전략`);
  console.log(`중심: ${CENTER.lat}, ${CENTER.lng}`);
  console.log(`${'='.repeat(60)}\n`);

  const globalMap = new Map(); // dedupeKey -> cafe
  let coordSample = null; // 좌표 샘플 확인용

  // ===== 1단계: 지역 격자 쿼리 =====
  const stage1Queries = [
    '역삼동 카페', '서초동 카페', '강남대로 카페', '테헤란로 카페',
    '강남역 카페', '역삼역 카페', '강남구 카페', '반포동 카페',
    '잠원동 카페', '서초구 카페'
  ];

  console.log(`=== 1단계: 지역 격자 쿼리 ===`);
  console.log(`쿼리 수: ${stage1Queries.length}개`);
  let stage1Raw = 0;

  for (const query of stage1Queries) {
    const items = await naverSearchPaged(query);
    process.stdout.write(`  "${query}": ${items.length}건`);
    stage1Raw += items.length;

    for (const item of items) {
      const cafe = processNaverItem(item);
      // 첫 번째 아이템으로 좌표 체계 확인
      if (!coordSample && item.mapx) {
        coordSample = { mapx: item.mapx, mapy: item.mapy, converted: { lat: cafe.lat, lng: cafe.lng } };
      }
      const key = dedupeKey(cafe.name, cafe.address);
      if (!globalMap.has(key)) {
        globalMap.set(key, cafe);
      }
    }
    console.log(` (누적 고유: ${globalMap.size})`);
  }

  // 좌표 체계 확인 로그
  if (coordSample) {
    console.log(`\n[좌표 체계 확인]`);
    console.log(`  원본 mapx=${coordSample.mapx}, mapy=${coordSample.mapy}`);
    console.log(`  변환 lat=${coordSample.converted.lat.toFixed(6)}, lng=${coordSample.converted.lng.toFixed(6)}`);
  }

  const stage1Deduped = globalMap.size;
  const stage1InRadius = [...globalMap.values()].filter(c => c.distance <= RADIUS).length;

  console.log(`\n수집: ${stage1Raw}건 -> 중복제거: ${stage1Deduped}건 -> 반경내: ${stage1InRadius}건\n`);

  // ===== 2단계: 카테고리 변형 쿼리 =====
  const stage2Queries = [
    '강남역 커피', '강남역 커피전문점', '강남역 디저트카페', '강남역 베이커리',
    '역삼동 커피', '역삼동 커피전문점', '서초동 커피', '강남대로 커피',
    '테헤란로 커피', '강남역 디저트', '강남역 브런치카페', '강남역 스터디카페',
    '역삼동 디저트', '서초동 디저트카페', '강남구 커피전문점'
  ];

  console.log(`=== 2단계: 카테고리 변형 쿼리 ===`);
  console.log(`쿼리 수: ${stage2Queries.length}개`);
  let stage2Raw = 0;
  const beforeStage2 = globalMap.size;
  const beforeStage2Radius = [...globalMap.values()].filter(c => c.distance <= RADIUS).length;

  for (const query of stage2Queries) {
    const items = await naverSearchPaged(query);
    process.stdout.write(`  "${query}": ${items.length}건`);
    stage2Raw += items.length;

    for (const item of items) {
      const cafe = processNaverItem(item);
      const key = dedupeKey(cafe.name, cafe.address);
      if (!globalMap.has(key)) {
        globalMap.set(key, cafe);
      }
    }
    console.log(` (누적 고유: ${globalMap.size})`);
  }

  const stage2Deduped = globalMap.size;
  const stage2InRadius = [...globalMap.values()].filter(c => c.distance <= RADIUS).length;
  const stage2New = stage2InRadius - beforeStage2Radius;

  console.log(`\n수집: ${stage2Raw}건 -> 중복제거: ${stage2Deduped}건 -> 반경내: ${stage2InRadius}건 (1단계 대비 +${stage2New}건 신규)\n`);

  // ===== 3단계: 스노우볼 쿼리 =====
  console.log(`=== 3단계: 스노우볼 쿼리 ===`);

  // 반경 내 카페들에서 도로명 추출
  const inRadiusCafes = [...globalMap.values()].filter(c => c.distance <= RADIUS);
  const roadNames = extractRoadNames(inRadiusCafes);
  console.log(`추출된 도로명: ${roadNames.join(', ')}`);

  // 스노우볼 쿼리 생성 (각 도로명 + "카페", "커피")
  let snowballQueries = [];
  for (const road of roadNames) {
    snowballQueries.push(`${road} 카페`);
    snowballQueries.push(`${road} 커피`);
  }

  // 최소 10개, 최대 30개 제한
  if (snowballQueries.length > 30) {
    snowballQueries = snowballQueries.slice(0, 30);
  }
  // 10개 미만이면 추가 쿼리 생성
  if (snowballQueries.length < 10) {
    const extras = ['강남역 근처 카페', '역삼역 근처 카페', '강남역 주변 커피', '역삼동 근처 커피', '서초동 근처 카페'];
    for (const e of extras) {
      if (snowballQueries.length >= 10) break;
      if (!snowballQueries.includes(e)) snowballQueries.push(e);
    }
  }

  console.log(`스노우볼 쿼리 ${snowballQueries.length}개:`);
  snowballQueries.forEach(q => console.log(`  - ${q}`));

  let stage3Raw = 0;
  const beforeStage3Radius = [...globalMap.values()].filter(c => c.distance <= RADIUS).length;

  for (const query of snowballQueries) {
    const items = await naverSearchPaged(query);
    process.stdout.write(`  "${query}": ${items.length}건`);
    stage3Raw += items.length;

    for (const item of items) {
      const cafe = processNaverItem(item);
      const key = dedupeKey(cafe.name, cafe.address);
      if (!globalMap.has(key)) {
        globalMap.set(key, cafe);
      }
    }
    console.log(` (누적 고유: ${globalMap.size})`);
  }

  const stage3Deduped = globalMap.size;
  const stage3InRadius = [...globalMap.values()].filter(c => c.distance <= RADIUS).length;
  const stage3New = stage3InRadius - beforeStage3Radius;

  console.log(`\n수집: ${stage3Raw}건 -> 중복제거: ${stage3Deduped}건 -> 반경내: ${stage3InRadius}건 (2단계 대비 +${stage3New}건 신규)\n`);

  // ===== 카카오 격자 검색 =====
  console.log(`=== 카카오 격자 검색 ===`);
  const kakaoResult = await collectKakaoCafes();
  const kakaoCafes = kakaoResult.cafes;
  console.log(`격자: 21개 -> 수집: ${kakaoResult.totalRaw}건 -> 중복제거: ${kakaoResult.deduped}건 -> 반경내: ${kakaoCafes.length}건\n`);

  // ===== 최종 비교 =====
  console.log(`${'='.repeat(60)}`);
  console.log(`=== 최종 비교 ===`);
  console.log(`${'='.repeat(60)}`);

  const naverFinal = [...globalMap.values()].filter(c => c.distance <= RADIUS);
  console.log(`\n네이버 3단계 총 반경내: ${naverFinal.length}건`);
  console.log(`카카오 격자 총 반경내: ${kakaoCafes.length}건`);

  // 이름 기반 매칭 (주소 무시, 이름만으로)
  const naverNames = new Map();
  for (const c of naverFinal) {
    const cleanName = c.name.replace(/\s+/g, '');
    naverNames.set(cleanName, c);
  }

  const kakaoNames = new Map();
  for (const c of kakaoCafes) {
    const cleanName = c.name.replace(/\s+/g, '');
    kakaoNames.set(cleanName, c);
  }

  const kakaoOnly = [];
  const both = [];
  for (const [name, cafe] of kakaoNames) {
    if (naverNames.has(name)) {
      both.push(name);
    } else {
      kakaoOnly.push(cafe);
    }
  }

  const naverOnly = [];
  for (const [name, cafe] of naverNames) {
    if (!kakaoNames.has(name)) {
      naverOnly.push(cafe);
    }
  }

  console.log(`\n양쪽 모두 있는 카페: ${both.length}개`);

  console.log(`\n카카오에만 있는 카페: ${kakaoOnly.length}개`);
  if (kakaoOnly.length > 0) {
    const showCount = Math.min(kakaoOnly.length, 20);
    kakaoOnly.slice(0, showCount).forEach(c => {
      console.log(`  - ${c.name} | ${c.address} | ${c.distance}m`);
    });
    if (kakaoOnly.length > showCount) {
      console.log(`  ... 외 ${kakaoOnly.length - showCount}개`);
    }
  }

  console.log(`\n네이버에만 있는 카페: ${naverOnly.length}개`);
  naverOnly.forEach(c => {
    console.log(`  - ${c.name} | ${c.address} | ${c.distance}m`);
  });

  // 거리별 분포
  console.log(`\n=== 네이버 거리별 분포 ===`);
  const distBuckets = [100, 200, 300, 400, 500];
  for (const d of distBuckets) {
    const count = naverFinal.filter(c => c.distance <= d).length;
    console.log(`  ${d}m 이내: ${count}건`);
  }

  console.log(`\n=== 카카오 거리별 분포 ===`);
  for (const d of distBuckets) {
    const count = kakaoCafes.filter(c => c.distance <= d).length;
    console.log(`  ${d}m 이내: ${count}건`);
  }

  console.log(`\n완료.`);
}

main().catch(console.error);
