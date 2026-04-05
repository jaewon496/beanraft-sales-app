// 네이버에만 있는 카페 검증 스크립트
// test-naver-3stage.js 로직 재사용 + fuzzy 매칭 검증

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

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function convertNaverCoords(mapx, mapy) {
  const x = parseInt(mapx);
  const y = parseInt(mapy);
  if (x > 1000000000) return { lat: y / 10000000, lng: x / 10000000 };
  if (x > 100000000) return { lat: y / 10000000, lng: x / 10000000 };
  return { lat: y, lng: x };
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}

function dedupeKey(name, address) {
  const cleanName = stripHtml(name).replace(/\s+/g, '');
  const cleanAddr = (address || '').replace(/\s+/g, '');
  return `${cleanName}|${cleanAddr}`;
}

async function naverSearch(query, start = 1) {
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=${start}&sort=random`;
  try {
    const data = await fetchJSON(url, {
      'X-Naver-Client-Id': NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
    });
    if (data.items) return data.items;
    return [];
  } catch (e) {
    return [];
  }
}

async function naverSearchPaged(query) {
  const allItems = [];
  for (let start = 1; start <= 46; start += 5) {
    const items = await naverSearch(query, start);
    allItems.push(...items);
    if (items.length < 5) break;
    await sleep(300);
  }
  return allItems;
}

function processNaverItem(item) {
  const name = stripHtml(item.title);
  const address = item.roadAddress || item.address || '';
  const coords = convertNaverCoords(item.mapx, item.mapy);
  const dist = haversineDistance(CENTER.lat, CENTER.lng, coords.lat, coords.lng);
  return {
    name, address,
    lat: coords.lat, lng: coords.lng,
    distance: Math.round(dist),
    category: item.category || '',
    phone: item.telephone || '',
    source: 'naver',
  };
}

function extractRoadNames(cafes) {
  const roadSet = new Set();
  for (const cafe of cafes) {
    if (!cafe.address) continue;
    const matches = cafe.address.match(/([가-힣]+(?:로|길))\s/g);
    if (matches) {
      for (const m of matches) {
        const road = m.trim();
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
  const allCafes = new Map();
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
        hasMore = false;
      }
      page++;
      await sleep(300);
    }
  }
  return [...allCafes.values()];
}

// ===== Fuzzy 매칭 유틸리티 =====

// 정규화: 공백, 특수문자 제거, 소문자
function normalize(name) {
  return name.replace(/\s+/g, '').replace(/[·\-_()]/g, '').toLowerCase();
}

// 브랜드명 추출 (첫 단어 또는 영문 브랜드)
function extractBrand(name) {
  // 영문 브랜드 추출
  const engMatch = name.match(/^[a-zA-Z]+/);
  if (engMatch && engMatch[0].length >= 2) return engMatch[0].toLowerCase();
  // 한글 첫 단어
  const korMatch = name.match(/^[가-힣]+/);
  if (korMatch) return korMatch[0];
  return name.split(/\s+/)[0];
}

// 두 문자열의 유사도 (0~1, Jaccard on bigrams)
function bigramSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.length < 2 || nb.length < 2) return na === nb ? 1.0 : 0;
  const bigramsA = new Set();
  for (let i = 0; i < na.length - 1; i++) bigramsA.add(na.substring(i, i + 2));
  const bigramsB = new Set();
  for (let i = 0; i < nb.length - 1; i++) bigramsB.add(nb.substring(i, i + 2));
  let intersection = 0;
  for (const bg of bigramsA) if (bigramsB.has(bg)) intersection++;
  return intersection / (bigramsA.size + bigramsB.size - intersection);
}

// 부분 포함 체크
function containsMatch(naverName, kakaoName) {
  const nn = normalize(naverName);
  const kn = normalize(kakaoName);
  return nn.includes(kn) || kn.includes(nn);
}

// 비카페 판별 키워드
const NON_CAFE_KEYWORDS = [
  '아이스크림', '보드게임', '피시방', 'PC방', '노래방', '당구',
  '볼링', '빨래방', '세탁', '부동산', '약국', '병원', '의원',
  '마트', '편의점', '미용', '네일', '헬스', '요가', '필라테스',
  '주유소', '세차', '정비', '학원', '어린이집', '유치원',
  '사무실', '오피스', '코워킹', '공유오피스', '인쇄', '복사',
  '호텔', '모텔', '숙박', '게스트하우스',
  '식당', '고기', '치킨', '피자', '족발', '곱창', '삼겹', '국밥',
  '라멘', '초밥', '횟집', '중국집', '분식',
  '주점', '술집', '바(bar)', '호프', '포차',
];

function isNonCafe(name, category) {
  const combined = (name + ' ' + category).toLowerCase();
  for (const kw of NON_CAFE_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

// ===== 메인 =====
async function main() {
  console.log('네이버에만 있는 카페 검증 스크립트');
  console.log('='.repeat(60));
  console.log('수집 중... (약 2-3분 소요)\n');

  // --- 네이버 수집 (3단계) ---
  const globalMap = new Map();

  const stage1Queries = [
    '역삼동 카페', '서초동 카페', '강남대로 카페', '테헤란로 카페',
    '강남역 카페', '역삼역 카페', '강남구 카페', '반포동 카페',
    '잠원동 카페', '서초구 카페'
  ];
  process.stdout.write('1단계 수집...');
  for (const query of stage1Queries) {
    const items = await naverSearchPaged(query);
    for (const item of items) {
      const cafe = processNaverItem(item);
      const key = dedupeKey(cafe.name, cafe.address);
      if (!globalMap.has(key)) globalMap.set(key, cafe);
    }
  }
  console.log(` ${globalMap.size}건`);

  const stage2Queries = [
    '강남역 커피', '강남역 커피전문점', '강남역 디저트카페', '강남역 베이커리',
    '역삼동 커피', '역삼동 커피전문점', '서초동 커피', '강남대로 커피',
    '테헤란로 커피', '강남역 디저트', '강남역 브런치카페', '강남역 스터디카페',
    '역삼동 디저트', '서초동 디저트카페', '강남구 커피전문점'
  ];
  process.stdout.write('2단계 수집...');
  for (const query of stage2Queries) {
    const items = await naverSearchPaged(query);
    for (const item of items) {
      const cafe = processNaverItem(item);
      const key = dedupeKey(cafe.name, cafe.address);
      if (!globalMap.has(key)) globalMap.set(key, cafe);
    }
  }
  console.log(` ${globalMap.size}건`);

  // 3단계
  const inRadiusCafes = [...globalMap.values()].filter(c => c.distance <= RADIUS);
  const roadNames = extractRoadNames(inRadiusCafes);
  let snowballQueries = [];
  for (const road of roadNames) {
    snowballQueries.push(`${road} 카페`);
    snowballQueries.push(`${road} 커피`);
  }
  if (snowballQueries.length > 30) snowballQueries = snowballQueries.slice(0, 30);
  if (snowballQueries.length < 10) {
    const extras = ['강남역 근처 카페', '역삼역 근처 카페', '강남역 주변 커피', '역삼동 근처 커피', '서초동 근처 카페'];
    for (const e of extras) {
      if (snowballQueries.length >= 10) break;
      if (!snowballQueries.includes(e)) snowballQueries.push(e);
    }
  }
  process.stdout.write('3단계 수집...');
  for (const query of snowballQueries) {
    const items = await naverSearchPaged(query);
    for (const item of items) {
      const cafe = processNaverItem(item);
      const key = dedupeKey(cafe.name, cafe.address);
      if (!globalMap.has(key)) globalMap.set(key, cafe);
    }
  }
  console.log(` ${globalMap.size}건`);

  // --- 카카오 수집 ---
  process.stdout.write('카카오 수집...');
  const kakaoCafes = await collectKakaoCafes();
  console.log(` ${kakaoCafes.length}건`);

  // --- 비교 ---
  const naverFinal = [...globalMap.values()].filter(c => c.distance <= RADIUS);
  console.log(`\n네이버 반경내: ${naverFinal.length}건`);
  console.log(`카카오 반경내: ${kakaoCafes.length}건`);

  // 이름 기반 exact 매칭
  const kakaoNames = new Map();
  for (const c of kakaoCafes) {
    kakaoNames.set(c.name.replace(/\s+/g, ''), c);
  }

  const naverOnly = [];
  for (const c of naverFinal) {
    const cleanName = c.name.replace(/\s+/g, '');
    if (!kakaoNames.has(cleanName)) {
      naverOnly.push(c);
    }
  }

  console.log(`네이버에만 있는 카페: ${naverOnly.length}개\n`);

  // ===== 핵심: Fuzzy 검증 =====
  console.log('='.repeat(60));
  console.log(`=== 네이버에만 있는 ${naverOnly.length}개 카페 검증 ===`);
  console.log('='.repeat(60));

  for (let i = 0; i < naverOnly.length; i++) {
    const nc = naverOnly[i];
    console.log(`\n${i + 1}. [${nc.name}] - ${nc.address} - [${nc.category}] (${nc.distance}m)`);

    // 1) Fuzzy 매칭: bigram similarity
    const fuzzyMatches = [];
    for (const kc of kakaoCafes) {
      const sim = bigramSimilarity(nc.name, kc.name);
      const partial = containsMatch(nc.name, kc.name);
      if (sim >= 0.3 || partial) {
        fuzzyMatches.push({ cafe: kc, similarity: sim, partial });
      }
    }
    fuzzyMatches.sort((a, b) => b.similarity - a.similarity);

    // 2) 브랜드명 매칭
    const naverBrand = extractBrand(nc.name);
    const brandMatches = [];
    for (const kc of kakaoCafes) {
      const kakaoBrand = extractBrand(kc.name);
      if (naverBrand === kakaoBrand && naverBrand.length >= 2) {
        brandMatches.push(kc);
      }
    }

    // 3) 비카페 판별
    const nonCafeReason = isNonCafe(nc.name, nc.category);

    // 출력
    if (fuzzyMatches.length > 0) {
      console.log(`   -> 카카오 유사 매칭:`);
      fuzzyMatches.slice(0, 5).forEach(m => {
        const flags = [];
        if (m.partial) flags.push('부분포함');
        flags.push(`유사도 ${(m.similarity * 100).toFixed(0)}%`);
        console.log(`      "${m.cafe.name}" | ${m.cafe.address} | ${m.cafe.distance}m [${flags.join(', ')}]`);
      });
    } else {
      console.log(`   -> 카카오 유사 매칭: 없음`);
    }

    if (brandMatches.length > 0 && brandMatches.length <= 10) {
      console.log(`   -> 브랜드 "${naverBrand}" 카카오 매칭:`);
      brandMatches.slice(0, 5).forEach(bc => {
        console.log(`      "${bc.name}" | ${bc.address} | ${bc.distance}m`);
      });
    } else if (brandMatches.length > 10) {
      console.log(`   -> 브랜드 "${naverBrand}" 카카오 매칭: ${brandMatches.length}건 (프랜차이즈)`);
    }

    // 판정
    let verdict;
    if (nonCafeReason) {
      verdict = `비카페 (사유: "${nonCafeReason}" 키워드 감지)`;
    } else if (fuzzyMatches.length > 0 && fuzzyMatches[0].similarity >= 0.6) {
      verdict = `이름 차이 오류 (카카오 "${fuzzyMatches[0].cafe.name}"과 동일 매장 가능성 높음, 유사도 ${(fuzzyMatches[0].similarity * 100).toFixed(0)}%)`;
    } else if (fuzzyMatches.length > 0 && fuzzyMatches[0].partial) {
      verdict = `이름 차이 오류 가능 (카카오 "${fuzzyMatches[0].cafe.name}"이 부분 포함됨)`;
    } else {
      verdict = `진짜 신규 (카카오에 유사 매칭 없음)`;
    }
    console.log(`   => 판정: ${verdict}`);
  }

  // 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log('=== 요약 ===');
  let genuineNew = 0, nameError = 0, nonCafe = 0;
  for (const nc of naverOnly) {
    const non = isNonCafe(nc.name, nc.category);
    if (non) { nonCafe++; continue; }
    let bestSim = 0;
    let bestPartial = false;
    for (const kc of kakaoCafes) {
      const sim = bigramSimilarity(nc.name, kc.name);
      if (sim > bestSim) bestSim = sim;
      if (containsMatch(nc.name, kc.name)) bestPartial = true;
    }
    if (bestSim >= 0.6 || bestPartial) { nameError++; }
    else { genuineNew++; }
  }
  console.log(`총 ${naverOnly.length}개 중:`);
  console.log(`  - 진짜 신규 (카카오 미등록): ${genuineNew}개`);
  console.log(`  - 이름 차이 오류 (같은 매장): ${nameError}개`);
  console.log(`  - 비카페 업종: ${nonCafe}개`);
  console.log('='.repeat(60));
}

main().catch(console.error);
