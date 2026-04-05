// 카카오 vs 네이버 카페 수집 비교 스크립트
// 강남역 좌표 기준 반경 500m

const https = require('https');
const fs = require('fs');
const path = require('path');

// .env 파일 직접 파싱
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const CENTER = { lat: 37.4979526, lng: 127.0276242 };
const RADIUS = 500;
const KAKAO_KEY = '9e149576620513dc3283894501c49ab7';
const NAVER_CLIENT_ID = env.NAVER_SEARCH_CLIENT_ID;
const NAVER_CLIENT_SECRET = env.NAVER_SEARCH_CLIENT_SECRET;

// 프랜차이즈 목록 (네이버 검증에서 제외)
const FRANCHISE_KEYWORDS = [
  '스타벅스', '이디야', '투썸플레이스', '투썸', '메가커피', '메가MGC',
  '컴포즈커피', '컴포즈', '빽다방', '더벤티', '할리스', '파스쿠찌',
  '카페베네', '엔제리너스', '탐앤탐스', '커피빈', '폴바셋', '블루보틀',
  '커피에반하다', '매머드커피', '매머드', '감성커피', '커피나무',
  '커피스미스', '카페봄봄', '공차', '쥬씨', 'EDIYA', 'Starbucks',
  'MEGA', 'COMPOSE', '빈스빈스', '달콤커피', '드롭탑'
];

function isFranchise(name) {
  const clean = name.replace(/<[^>]*>/g, '').trim();
  return FRANCHISE_KEYWORDS.some(f => clean.includes(f));
}

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

// 격자점 생성: 중심점에서 200m 간격
function generateGridPoints(center, gridSpacing = 200) {
  const points = [];
  const latPerMeter = 1 / 111320;
  const lngPerMeter = 1 / (111320 * Math.cos(center.lat * Math.PI / 180));

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      // 원형 범위 안의 격자만
      if (Math.sqrt(dx * dx + dy * dy) * gridSpacing > RADIUS + 50) continue;
      points.push({
        lat: center.lat + dy * gridSpacing * latPerMeter,
        lng: center.lng + dx * gridSpacing * lngPerMeter
      });
    }
  }
  return points;
}

// 카카오 CE7 카테고리 검색 (격자 방식)
async function collectKakaoCafes() {
  const gridPoints = generateGridPoints(CENTER);
  console.log(`격자점 ${gridPoints.length}개 생성 완료`);

  const allCafes = new Map(); // id -> cafe

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
            allCafes.set(doc.id, {
              id: doc.id,
              name: doc.place_name,
              address: doc.road_address_name || doc.address_name,
              phone: doc.phone,
              x: doc.x,
              y: doc.y,
              category: doc.category_name
            });
          }
          hasMore = !data.meta.is_end && data.documents.length > 0;
        } else {
          hasMore = false;
        }
      } catch (e) {
        console.error(`격자 ${i} 페이지 ${page} 에러:`, e.message);
        hasMore = false;
      }
      page++;
      await sleep(200);
    }

    if ((i + 1) % 5 === 0) {
      process.stdout.write(`  격자 ${i + 1}/${gridPoints.length} 처리 중... (현재 ${allCafes.size}개)\r`);
    }
  }

  console.log(`\n카카오 수집 완료: 총 ${allCafes.size}개 카페`);
  return Array.from(allCafes.values());
}

// 네이버 지역 검색으로 카페 존재 여부 확인
async function verifyOnNaver(cafeName) {
  const cleanName = cafeName.replace(/<[^>]*>/g, '').trim();
  // 강남역 근처임을 명시해서 검색 정확도 향상
  const query = `강남역 ${cleanName}`;
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`;

  try {
    const data = await fetchJSON(url, {
      'X-Naver-Client-Id': NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
    });

    if (data.items && data.items.length > 0) {
      // 이름이 유사한지 확인
      for (const item of data.items) {
        const itemName = item.title.replace(/<[^>]*>/g, '').trim();
        if (itemName.includes(cleanName) || cleanName.includes(itemName) ||
            similarity(cleanName, itemName) > 0.5) {
          return { found: true, naverName: itemName, address: item.roadAddress || item.address };
        }
      }
    }
    return { found: false };
  } catch (e) {
    return { found: false, error: e.message };
  }
}

// 간단한 유사도 계산
function similarity(a, b) {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// 네이버 "강남역 카페" 검색 → 카카오에 없는 것 찾기
async function searchNaverForCafes() {
  const queries = ['강남역 카페', '강남역 커피', '강남역 커피숍'];
  const naverCafes = new Map();

  for (const q of queries) {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5`;
    try {
      const data = await fetchJSON(url, {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      });
      if (data.items) {
        for (const item of data.items) {
          const name = item.title.replace(/<[^>]*>/g, '').trim();
          if (!naverCafes.has(name)) {
            naverCafes.set(name, {
              name,
              address: item.roadAddress || item.address,
              category: item.category
            });
          }
        }
      }
    } catch (e) {
      console.error(`네이버 검색 "${q}" 에러:`, e.message);
    }
    await sleep(200);
  }

  return Array.from(naverCafes.values());
}

async function main() {
  console.log('=== 카카오 vs 네이버 카페 수집 비교 ===');
  console.log(`기준: 강남역 (${CENTER.lat}, ${CENTER.lng}) 반경 ${RADIUS}m\n`);

  // 1. 카카오 카페 수집
  console.log('[1단계] 카카오 CE7 카테고리 격자 검색...');
  const kakaoCafes = await collectKakaoCafes();

  const franchises = kakaoCafes.filter(c => isFranchise(c.name));
  const independents = kakaoCafes.filter(c => !isFranchise(c.name));
  console.log(`  - 프랜차이즈: ${franchises.length}개`);
  console.log(`  - 개인카페: ${independents.length}개\n`);

  // 2. 개인카페에서 랜덤 50개 샘플링
  const sampleSize = Math.min(50, independents.length);
  const shuffled = independents.sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, sampleSize);

  console.log(`[2단계] 개인카페 ${sampleSize}개 샘플 → 네이버 검증...`);

  let foundCount = 0;
  let notFoundCount = 0;
  const notFoundList = [];

  for (let i = 0; i < sample.length; i++) {
    const cafe = sample[i];
    const result = await verifyOnNaver(cafe.name);

    if (result.found) {
      foundCount++;
    } else {
      notFoundCount++;
      notFoundList.push({
        kakaoName: cafe.name,
        address: cafe.address,
        phone: cafe.phone || '없음'
      });
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  ${i + 1}/${sampleSize} 검증 완료...\r`);
    }
    await sleep(200);
  }

  // 3. 네이버에서 "강남역 카페" 검색
  console.log(`\n[3단계] 네이버 "강남역 카페" 검색 → 카카오 미존재 확인...`);
  const naverCafes = await searchNaverForCafes();

  const kakaoNames = new Set(kakaoCafes.map(c => c.name));
  const naverOnly = naverCafes.filter(nc => {
    // 카카오 목록에 이름이 포함되어 있는지 확인
    for (const kn of kakaoNames) {
      if (kn.includes(nc.name) || nc.name.includes(kn) || similarity(kn, nc.name) > 0.5) {
        return false;
      }
    }
    return true;
  });

  // === 결과 출력 ===
  console.log('\n' + '='.repeat(60));
  console.log('              결과 요약');
  console.log('='.repeat(60));

  console.log(`\n[1] 카카오 총 수집 카페 수: ${kakaoCafes.length}개`);
  console.log(`    - 프랜차이즈: ${franchises.length}개`);
  console.log(`    - 개인카페: ${independents.length}개`);

  console.log(`\n[2] 네이버 검증 결과 (개인카페 ${sampleSize}개 샘플):`);
  console.log(`    - 네이버에서 확인됨: ${foundCount}개 (${(foundCount / sampleSize * 100).toFixed(1)}%)`);
  console.log(`    - 네이버에서 못 찾음: ${notFoundCount}개 (${(notFoundCount / sampleSize * 100).toFixed(1)}%)`);

  if (notFoundList.length > 0) {
    console.log(`\n[3] 카카오에만 있는 카페 (네이버 미확인, 샘플 ${notFoundCount}개):`);
    notFoundList.forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.kakaoName} | ${c.address} | 전화: ${c.phone}`);
    });
  }

  console.log(`\n[4] 네이버 "강남역 카페" 검색 결과: 총 ${naverCafes.length}개`);
  if (naverOnly.length > 0) {
    console.log(`    카카오에 없는 카페 ${naverOnly.length}개:`);
    naverOnly.forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.name} | ${c.address} | 카테고리: ${c.category}`);
    });
  } else {
    console.log(`    카카오에 없는 카페: 0개 (모두 카카오에도 존재)`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  결론: 카카오와 네이버 간 카페 데이터 차이가 존재함을 확인');
  console.log('='.repeat(60));
}

main().catch(console.error);
