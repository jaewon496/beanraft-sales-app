// 비즈맵 매출 데이터는 Firebase 캐시에 있음
// 22개 동 매출 데이터를 Firebase에서 병렬로 받아 시간 측정 + TOP 5 추출

const FIREBASE = 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';

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

async function fetchOne(d) {
  const t0 = Date.now();
  const sido = d.code8.substring(0, 2);
  const url = `${FIREBASE}/nicebizmap/${sido}/${d.code8}.json`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return { dong: d, status: res.status, json, ms: Date.now() - t0, url };
  } catch (e) {
    return { dong: d, error: e.message, ms: Date.now() - t0 };
  }
}

function extractPerStoreAvg(j) {
  // chart: [{ym:'YYYYMM', s:총매출(억원), sc:점포수, ap:평균단가(천원)}]
  // 점포당 월 평균 매출(만원) = 월별로 (s억 / sc점포) 계산 후 평균
  if (!j || !Array.isArray(j.c) || j.c.length === 0) return 0;
  const recent = j.c.slice(-6);
  let perStoreSum = 0, count = 0;
  for (const item of recent) {
    if (item.s && item.sc) {
      // s는 억원 단위 -> 만원 변환: s * 10000
      // 점포당 매출(만원) = (s * 10000) / sc
      perStoreSum += (item.s * 10000) / item.sc;
      count++;
    }
  }
  if (count === 0) return 0;
  return Math.round(perStoreSum / count);
}

async function runTest(label) {
  console.log(`\n=== [${label}] Firebase nicebizmap 22개 동 병렬 호출 ===`);
  const start = Date.now();
  const results = await Promise.all(GANGNAM_DONGS.map(fetchOne));
  const elapsed = Date.now() - start;
  const ok = results.filter(r => r.status === 200 && r.json && r.json.c).length;
  const noData = results.filter(r => r.status === 200 && (!r.json || !r.json.c));
  console.log(`총 시간: ${elapsed}ms`);
  console.log(`정상 응답(매출 있음): ${ok}/22`);
  console.log(`데이터 없음: ${noData.length}개 - ${noData.map(r => r.dong.name).join(', ')}`);
  console.log(`개별 ms: ${results.map(r => r.ms).join(',')}`);
  return { elapsed, ok, results };
}

(async () => {
  console.log('=== 강남구 22개 동 매출 데이터 Firebase 호출 ===');
  console.log(`서버: ${FIREBASE}`);

  const a1 = await runTest('1차');
  const a2 = await runTest('2차');
  const a3 = await runTest('3차');

  // TOP 5 추출 (1차 결과 기준)
  const ranked = a1.results
    .filter(r => r.json && r.json.c)
    .map(r => ({ name: r.dong.name, code: r.dong.code8, perStore: extractPerStoreAvg(r.json), name_n: r.json.n }))
    .sort((a, b) => b.perStore - a.perStore);

  console.log('\n=== TOP 5 점포당 월 평균 매출 (강남구 22개 동) ===');
  ranked.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.name}(${r.name_n}) - ${r.perStore.toLocaleString()}만원/월`);
  });

  console.log('\n=== 전체 순위 ===');
  ranked.forEach((r, i) => {
    console.log(`${i + 1}. ${r.name} - ${r.perStore.toLocaleString()}만원`);
  });

  console.log('\n=== 시간 종합 ===');
  console.log(`Firebase 22개 병렬: 1차=${a1.elapsed}ms / 2차=${a2.elapsed}ms / 3차=${a3.elapsed}ms`);
  console.log(`평균: ${Math.round((a1.elapsed + a2.elapsed + a3.elapsed) / 3)}ms`);
})();
