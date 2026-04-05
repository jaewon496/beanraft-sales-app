const https = require('https');

const API_KEY = '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb';
const BASE = 'https://apis.data.go.kr/1130000/FftcAreaIndutyAvrStatsService';

function fetchAPI(endpoint, params) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({
      serviceKey: API_KEY,
      resultType: 'json',
      ...params
    }).toString();
    const fullUrl = `${BASE}/${endpoint}?${query}`;

    https.get(fullUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.log('Parse error, raw:', data.substring(0, 300));
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // 외식별 - yr=2023, 전체 데이터 (totalCount=255)
  console.log('=== 외식별 (getAreaIndutyAvrOutStats) yr=2023, 전체 255건 ===\n');
  const r = await fetchAPI('getAreaIndutyAvrOutStats', {
    pageNo: '1', numOfRows: '300', yr: '2023'
  });

  if (!r || !r.items) {
    console.log('데이터 없음');
    return;
  }

  const items = r.items;
  console.log(`totalCount: ${r.totalCount}, 실제 수신: ${items.length}`);
  console.log(`\n필드 구조 (첫 번째 아이템):`);
  console.log(JSON.stringify(items[0], null, 2));

  // 고유 업종 목록
  const indutySet = new Set();
  const areaSet = new Set();
  items.forEach(it => {
    if (it.indutyMlsfcNm) indutySet.add(it.indutyMlsfcNm);
    if (it.areaNm) areaSet.add(it.areaNm);
  });

  console.log(`\n--- 고유 업종 (${indutySet.size}개) ---`);
  [...indutySet].sort().forEach(n => console.log(`  ${n}`));

  console.log(`\n--- 고유 지역 (${areaSet.size}개) ---`);
  [...areaSet].sort().forEach(n => console.log(`  ${n}`));

  // 카페/커피 필터
  const cafeItems = items.filter(it => {
    const str = JSON.stringify(it).toLowerCase();
    return str.includes('커피') || str.includes('카페') || str.includes('음료') || str.includes('coffee') || str.includes('cafe') || str.includes('베이커리') || str.includes('제과');
  });

  console.log(`\n--- 카페/커피/음료 관련 항목 (${cafeItems.length}건) ---`);
  cafeItems.forEach(it => {
    console.log(`  [${it.areaNm}] ${it.indutyMlsfcNm} | 가맹점수: ${it.frcsCnt?.toLocaleString()} | 평균매출: ${it.arUnitAvrgSlsAmt?.toLocaleString()}천원`);
  });

  // 서울 데이터 필터
  const seoulItems = items.filter(it => it.areaNm === '서울');
  console.log(`\n--- 서울 전체 업종 (${seoulItems.length}건) ---`);
  seoulItems.forEach(it => {
    console.log(`  ${it.indutyMlsfcNm} | 가맹점수: ${it.frcsCnt?.toLocaleString()} | 평균매출: ${it.arUnitAvrgSlsAmt?.toLocaleString()}천원`);
  });

  // 2022, 2021에도 커피 있는지 확인
  for (const yr of ['2022', '2021']) {
    console.log(`\n=== 외식별 yr=${yr} - 커피 관련만 ===`);
    const r2 = await fetchAPI('getAreaIndutyAvrOutStats', {
      pageNo: '1', numOfRows: '300', yr: yr
    });
    if (r2 && r2.items) {
      const cafe2 = r2.items.filter(it => {
        const str = JSON.stringify(it).toLowerCase();
        return str.includes('커피') || str.includes('카페') || str.includes('음료');
      });
      console.log(`  totalCount: ${r2.totalCount}, 커피/카페/음료: ${cafe2.length}건`);
      cafe2.forEach(it => {
        console.log(`  [${it.areaNm}] ${it.indutyMlsfcNm} | 가맹점수: ${it.frcsCnt?.toLocaleString()} | 평균매출: ${it.arUnitAvrgSlsAmt?.toLocaleString()}천원`);
      });
    }
  }

  // 서비스별에서도 커피 관련 확인
  console.log('\n=== 서비스별 (getAreaIndutyAvrSrvcStats) yr=2023 - 업종 목록 ===');
  const r3 = await fetchAPI('getAreaIndutyAvrSrvcStats', {
    pageNo: '1', numOfRows: '400', yr: '2023'
  });
  if (r3 && r3.items) {
    const svcInduty = new Set();
    r3.items.forEach(it => { if (it.indutyMlsfcNm) svcInduty.add(it.indutyMlsfcNm); });
    console.log(`  totalCount: ${r3.totalCount}`);
    console.log(`  업종 목록 (${svcInduty.size}개): ${[...svcInduty].sort().join(', ')}`);
  }

  // 도소매별 업종 목록
  console.log('\n=== 도소매별 (getAreaIndutyAvrWhrtStats) yr=2023 - 업종 목록 ===');
  const r4 = await fetchAPI('getAreaIndutyAvrWhrtStats', {
    pageNo: '1', numOfRows: '200', yr: '2023'
  });
  if (r4 && r4.items) {
    const whrtInduty = new Set();
    r4.items.forEach(it => { if (it.indutyMlsfcNm) whrtInduty.add(it.indutyMlsfcNm); });
    console.log(`  totalCount: ${r4.totalCount}`);
    console.log(`  업종 목록 (${whrtInduty.size}개): ${[...whrtInduty].sort().join(', ')}`);
  }
}

main().catch(console.error);
