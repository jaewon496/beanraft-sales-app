const https = require('https');
const url = require('url');

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
    console.log(`\n>>> GET ${BASE}/${endpoint}`);
    console.log(`    params:`, JSON.stringify(params));

    https.get(fullUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`    status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          console.log('    raw response (first 500 chars):', data.substring(0, 500));
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // 1) getAreaIndutyAvrOutStats (외식별) - yr 2023, 2022, 2021 시도
  for (const yr of ['2023', '2022', '2021']) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[외식별] yr=${yr}`);
    console.log('='.repeat(60));
    const result = await fetchAPI('getAreaIndutyAvrOutStats', {
      pageNo: '1',
      numOfRows: '20',
      yr: yr
    });
    if (result) {
      const header = result.response?.header || result.header;
      const body = result.response?.body || result.body;
      console.log('    header:', JSON.stringify(header));
      if (body) {
        console.log('    totalCount:', body.totalCount);
        console.log('    numOfRows:', body.numOfRows);
        console.log('    pageNo:', body.pageNo);
        const items = body.items?.item || body.items || [];
        console.log('    items count:', Array.isArray(items) ? items.length : typeof items);
        if (Array.isArray(items) && items.length > 0) {
          console.log('\n    --- First item fields ---');
          console.log(JSON.stringify(items[0], null, 2));
          console.log('\n    --- All items summary ---');
          items.forEach((item, i) => {
            console.log(`    [${i}] area=${item.areaNm || item.ctprvnNm || '?'} induty=${item.indutyNm || item.indutyLclasNm || '?'} sales=${item.avrSlsAmt || item.avrAmnt || '?'}`);
          });
          // 카페/커피 검색
          const cafeItems = items.filter(it => {
            const str = JSON.stringify(it);
            return str.includes('커피') || str.includes('카페') || str.includes('음료') || str.includes('coffee') || str.includes('cafe');
          });
          if (cafeItems.length > 0) {
            console.log(`\n    --- 카페/커피 관련 항목 (${cafeItems.length}건) ---`);
            cafeItems.forEach(it => console.log(JSON.stringify(it, null, 2)));
          } else {
            console.log('\n    카페/커피 관련 항목 없음 (이 페이지에서)');
          }
          // yr 데이터가 있으면 다음 yr는 건너뜀
          break;
        }
      } else {
        console.log('    body 없음, 전체 응답:', JSON.stringify(result).substring(0, 500));
      }
    }
  }

  // 2) 전체 업종 목록 확인을 위해 numOfRows=100으로 재호출
  console.log(`\n${'='.repeat(60)}`);
  console.log('[외식별] 전체 업종 확인 (numOfRows=200)');
  console.log('='.repeat(60));
  const allResult = await fetchAPI('getAreaIndutyAvrOutStats', {
    pageNo: '1',
    numOfRows: '200',
    yr: '2023'
  });
  if (allResult) {
    const body = allResult.response?.body || allResult.body;
    if (body) {
      const items = body.items?.item || body.items || [];
      console.log('    totalCount:', body.totalCount);
      if (Array.isArray(items)) {
        // 고유 업종 목록
        const indutySet = new Set();
        const areaSet = new Set();
        items.forEach(it => {
          // 다양한 필드명 시도
          const induty = it.indutyNm || it.indutyLclasNm || it.indutyMclasNm || it.indutySclasNm || '';
          const area = it.areaNm || it.ctprvnNm || it.signguNm || '';
          if (induty) indutySet.add(induty);
          if (area) areaSet.add(area);
        });
        console.log('\n    --- 고유 업종 목록 ---');
        [...indutySet].sort().forEach(n => console.log(`      ${n}`));
        console.log('\n    --- 고유 지역 목록 ---');
        [...areaSet].sort().forEach(n => console.log(`      ${n}`));

        // 카페/커피 필터
        const cafeItems = items.filter(it => {
          const str = JSON.stringify(it);
          return str.includes('커피') || str.includes('카페') || str.includes('음료') || str.includes('coffee') || str.includes('cafe');
        });
        if (cafeItems.length > 0) {
          console.log(`\n    --- 카페/커피 관련 (${cafeItems.length}건) ---`);
          cafeItems.forEach(it => console.log(JSON.stringify(it)));
        }
      }
    }
  }

  // 3) 도소매별, 서비스별도 간단 테스트
  for (const [name, endpoint] of [
    ['도소매별', 'getAreaIndutyAvrWhrtStats'],
    ['서비스별', 'getAreaIndutyAvrSrvcStats']
  ]) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${name}] yr=2023, 5건만`);
    console.log('='.repeat(60));
    const r = await fetchAPI(endpoint, { pageNo: '1', numOfRows: '5', yr: '2023' });
    if (r) {
      const body = r.response?.body || r.body;
      if (body) {
        console.log('    totalCount:', body.totalCount);
        const items = body.items?.item || body.items || [];
        if (Array.isArray(items) && items.length > 0) {
          console.log('    first item:', JSON.stringify(items[0], null, 2));
        }
      } else {
        console.log('    전체 응답:', JSON.stringify(r).substring(0, 500));
      }
    }
  }
}

main().catch(console.error);
