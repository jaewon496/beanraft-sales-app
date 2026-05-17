// 강남구 22개 행정동 매출 데이터 병렬 수집 시간 측정
// 비즈맵 summary-report vs 소상공인 simpleAnls 두 가지 비교

const GANGNAM_DONGS = [
  { code8: '11680510', name: '신사동' },
  { code8: '11680521', name: '논현1동' },
  { code8: '11680531', name: '논현2동' },
  { code8: '11680545', name: '압구정동' },
  { code8: '11680565', name: '청담동' },
  { code8: '11680580', name: '삼성1동' },
  { code8: '11680590', name: '삼성2동' },
  { code8: '11680600', name: '대치1동' },
  { code8: '11680610', name: '대치2동' },
  { code8: '11680630', name: '대치4동' },
  { code8: '11680640', name: '역삼1동' },
  { code8: '11680660', name: '역삼2동' },
  { code8: '11680670', name: '도곡1동' },
  { code8: '11680680', name: '도곡2동' },
  { code8: '11680690', name: '개포1동' },
  { code8: '11680700', name: '개포2동' },
  { code8: '11680720', name: '개포4동' },
  { code8: '11680730', name: '세곡동' },
  { code8: '11680731', name: '일원본동' },
  { code8: '11680740', name: '일원1동' },
  { code8: '11680750', name: '일원2동' },
  { code8: '11680760', name: '수서동' }
];

const BASE = 'http://localhost:8888';

function findFirstNumber(obj, depth = 0, path = '') {
  // 응답 안에서 매출/금액 비슷한 키를 가진 첫 숫자 반환 (디버그용)
  if (depth > 5 || !obj || typeof obj !== 'object') return null;
  for (const k of Object.keys(obj)) {
    if (/amt|sales|매출|sale/i.test(k) && typeof obj[k] === 'number' && obj[k] > 0) {
      return { path: path + '.' + k, value: obj[k] };
    }
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0) {
      const r = findFirstNumber(v[0], depth + 1, path + '.' + k + '[0]');
      if (r) return r;
    } else if (v && typeof v === 'object') {
      const r = findFirstNumber(v, depth + 1, path + '.' + k);
      if (r) return r;
    }
  }
  return null;
}

async function testNicebizmap(label) {
  console.log(`\n=== [${label}] 비즈맵 summary-report 22개 동 병렬 호출 ===`);
  const start = Date.now();
  const promises = GANGNAM_DONGS.map(async d => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/.netlify/functions/nicebizmap-proxy?admiCd=${d.code8}&upjong3Cd=Q13007`);
      const status = res.status;
      const json = await res.json().catch(() => null);
      return { dong: d, status, json, ms: Date.now() - t0 };
    } catch (e) {
      return { dong: d, error: e.message, ms: Date.now() - t0 };
    }
  });
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;
  const ok = results.filter(r => r.status === 200 && r.json && !r.json.error).length;
  const errs = results.filter(r => r.error || r.status !== 200 || (r.json && r.json.error));
  console.log(`총 시간: ${elapsed}ms`);
  console.log(`정상 응답: ${ok}/22`);
  console.log(`개별 ms: ${results.map(r => r.ms).join(',')}`);
  if (errs.length > 0) {
    console.log(`실패 사례 (최대 3개):`);
    errs.slice(0, 3).forEach(r => {
      console.log(`  - ${r.dong.name}(${r.dong.code8}): status=${r.status} err=${r.error || JSON.stringify(r.json).substring(0, 200)}`);
    });
  }
  // 첫 정상 응답 구조 보기
  const firstOk = results.find(r => r.status === 200 && r.json && !r.json.error);
  if (firstOk) {
    console.log(`\n[샘플 응답 키] ${firstOk.dong.name}:`);
    console.log(`  최상위 키: ${Object.keys(firstOk.json).join(', ')}`);
    const num = findFirstNumber(firstOk.json);
    if (num) console.log(`  매출 추정 필드: ${num.path} = ${num.value}`);
  }
  return { elapsed, ok, results };
}

async function testSbizSimpleAnls(label) {
  console.log(`\n=== [${label}] 소상공인 simpleAnls 22개 동 병렬 호출 ===`);
  const start = Date.now();
  const promises = GANGNAM_DONGS.map(async d => {
    const t0 = Date.now();
    const loc = encodeURIComponent('서울 강남구 ' + d.name);
    try {
      const res = await fetch(`${BASE}/.netlify/functions/sbiz-proxy?api=simpleAnls&admiCd=${d.code8}&simpleLoc=${loc}&upjongCd=Q13007`);
      const status = res.status;
      const json = await res.json().catch(() => null);
      return { dong: d, status, json, ms: Date.now() - t0 };
    } catch (e) {
      return { dong: d, error: e.message, ms: Date.now() - t0 };
    }
  });
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;
  const ok = results.filter(r => r.status === 200 && r.json && !r.json.error).length;
  const errs = results.filter(r => r.error || r.status !== 200 || (r.json && r.json.error));
  console.log(`총 시간: ${elapsed}ms`);
  console.log(`정상 응답: ${ok}/22`);
  console.log(`개별 ms: ${results.map(r => r.ms).join(',')}`);
  if (errs.length > 0) {
    console.log(`실패 사례 (최대 3개):`);
    errs.slice(0, 3).forEach(r => {
      console.log(`  - ${r.dong.name}(${r.dong.code8}): status=${r.status} err=${r.error || JSON.stringify(r.json).substring(0, 200)}`);
    });
  }
  const firstOk = results.find(r => r.status === 200 && r.json && !r.json.error);
  if (firstOk) {
    console.log(`\n[샘플 응답 키] ${firstOk.dong.name}:`);
    console.log(`  최상위 키: ${Object.keys(firstOk.json).join(', ')}`);
    const num = findFirstNumber(firstOk.json);
    if (num) console.log(`  매출 추정 필드: ${num.path} = ${num.value}`);
  }
  return { elapsed, ok, results };
}

function extractSales(r, source) {
  // 비즈맵: summaryReport 안 어디엔가 매출 / 소상공인: avgAmt.areaAvgAmt
  if (!r || !r.json) return 0;
  const j = r.json;
  if (source === 'sbiz') {
    // 소상공인 simpleAnls 응답 구조: {avgAmt:{areaAvgAmt}, popular:{...}} 또는 raw
    const a = j?.avgAmt?.areaAvgAmt
      || j?.avgAmtData?.areaAvgAmt
      || j?.data?.avgAmt?.areaAvgAmt;
    if (a) return Number(a);
    const num = findFirstNumber(j);
    return num ? num.value : 0;
  } else {
    // 비즈맵 응답 구조
    const a = j?.summary?.usageAndPaymentTrendList?.[0]?.amt
      || j?.usageAndPaymentTrendList?.[0]?.amt
      || j?.salesTrend?.[0]?.amt;
    if (a) return Number(a);
    const num = findFirstNumber(j);
    return num ? num.value : 0;
  }
}

function rankTop5(results, source) {
  const items = results.map(r => ({
    name: r.dong.name,
    sales: extractSales(r, source)
  })).sort((a, b) => b.sales - a.sales);
  return items.slice(0, 5);
}

(async () => {
  console.log('=== 강남구 22개 동 매출 수집 시간 측정 ===');
  console.log(`테스트 시작: ${new Date().toISOString()}`);
  console.log(`동 개수: ${GANGNAM_DONGS.length}`);
  console.log(`서버: ${BASE}`);

  // 비즈맵 1차
  const a1 = await testNicebizmap('1차');
  // 비즈맵 2차 (캐시 hit?)
  const a2 = await testNicebizmap('2차 캐시');
  // 소상공인 1차
  const b1 = await testSbizSimpleAnls('1차');
  // 소상공인 2차
  const b2 = await testSbizSimpleAnls('2차 캐시');

  console.log('\n=== TOP 5 매출 동 (비즈맵 기준) ===');
  console.log(rankTop5(a1.results, 'bizmap'));

  console.log('\n=== TOP 5 매출 동 (소상공인 기준) ===');
  console.log(rankTop5(b1.results, 'sbiz'));

  console.log('\n=== 종합 ===');
  console.log(`비즈맵: 1차=${a1.elapsed}ms (정상 ${a1.ok}/22) | 2차=${a2.elapsed}ms (정상 ${a2.ok}/22)`);
  console.log(`소상공인: 1차=${b1.elapsed}ms (정상 ${b1.ok}/22) | 2차=${b2.elapsed}ms (정상 ${b2.ok}/22)`);
})();
