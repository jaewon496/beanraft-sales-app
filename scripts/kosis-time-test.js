// KOSIS 18개 통계표 실제 호출 시간 측정
const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const env = {};
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8').split('\n').forEach(line => {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
  return env;
}
const KEY = loadEnv().KOSIS_API_KEY;

const TABLES = {
  interior: 'DT_114054_012', startupInvest: 'DT_114054_072',
  rent: 'DT_114054_008', area: 'DT_114054_004', seats: 'DT_114054_010',
  hours: 'DT_114054_009', remodel: 'DT_114054_013',
  sales: 'DT_114054_021', unitPrice: 'DT_114054_022', visitors: 'DT_114054_023',
  salesChange: 'DT_114054_134', weekdaySales: 'DT_114054_078',
  materialCost: 'DT_114054_031', deliveryApps: 'DT_114054_077',
  difficulty: 'DT_114054_025', switchExperience: 'DT_114054_026',
  switchIntent: 'DT_114054_027', customer: 'DT_114054_017',
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' }, timeout: 30000 }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body.replace(/^﻿/, '').trim())); }
        catch (e) { resolve({ _err: e.message }); }
      });
    }).on('error', reject);
  });
}

function url(tblId) {
  const p = new URLSearchParams({
    method: 'getList', apiKey: KEY, format: 'json', jsonVD: 'Y',
    userStatsId: '', prdSe: 'Y', orgId: '114', tblId,
    itmId: 'ALL', objL1: 'ALL', objL2: 'ALL', objL3: '', objL4: '',
    newEstPrdCnt: '1',
  });
  return `https://kosis.kr/openapi/Param/statisticsParameterData.do?${p}`;
}

async function timed(name, fn) {
  const t0 = Date.now();
  await fn();
  return Date.now() - t0;
}

(async () => {
  const keys = Object.keys(TABLES);
  console.log(`KOSIS 18개 통계표 호출 시간 측정 (${keys.length}개)\n`);

  // 1) 직렬 호출 (현재 수집 스크립트 방식, 200ms 간격)
  console.log('[직렬 호출 + 200ms 간격]');
  const serialMs = await timed('serial', async () => {
    for (const k of keys) {
      const t0 = Date.now();
      await fetchJson(url(TABLES[k]));
      const dt = Date.now() - t0;
      process.stdout.write(`  ${k.padEnd(20)} ${dt}ms\n`);
      await new Promise(r => setTimeout(r, 200));
    }
  });
  console.log(`  → 합계 ${serialMs}ms (${(serialMs/1000).toFixed(1)}초)\n`);

  // 2) 병렬 호출 (Promise.all 모두 동시)
  console.log('[병렬 호출 (모두 동시)]');
  const parallelMs = await timed('parallel', async () => {
    const promises = keys.map(k => {
      const t0 = Date.now();
      return fetchJson(url(TABLES[k])).then(() => {
        const dt = Date.now() - t0;
        process.stdout.write(`  ${k.padEnd(20)} ${dt}ms\n`);
      });
    });
    await Promise.all(promises);
  });
  console.log(`  → 합계 ${parallelMs}ms (${(parallelMs/1000).toFixed(1)}초)\n`);

  // 3) 6개씩 묶어서 병렬 (3배치)
  console.log('[6개 배치 × 3 (서버 부담 완화)]');
  const batchMs = await timed('batch', async () => {
    const batchSize = 6;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const t0 = Date.now();
      await Promise.all(batch.map(k => fetchJson(url(TABLES[k]))));
      console.log(`  배치 ${i/batchSize + 1} (${batch.length}개): ${Date.now() - t0}ms`);
    }
  });
  console.log(`  → 합계 ${batchMs}ms (${(batchMs/1000).toFixed(1)}초)\n`);

  console.log('═'.repeat(50));
  console.log(`결과 요약 (실제 측정값):`);
  console.log(`  직렬+200ms간격: ${(serialMs/1000).toFixed(1)}초`);
  console.log(`  완전 병렬:       ${(parallelMs/1000).toFixed(1)}초`);
  console.log(`  6개 배치:        ${(batchMs/1000).toFixed(1)}초`);
})();
