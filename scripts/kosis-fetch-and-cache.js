/**
 * KOSIS 외식업체경영실태조사 - 카페(커피전문점) 데이터 수집 + Firebase 저장
 *
 * 사용법:
 *   1. .env 에 KOSIS_API_KEY 등록
 *   2. node scripts/kosis-fetch-and-cache.js
 *   3. Firebase RTDB의 regionData/_kosis/foodSurvey/{year} 에 저장됨
 *
 * 갱신 주기: 매년 1회 (KOSIS는 1년 단위 갱신)
 * Firebase 저장 위치: regionData/_kosis/foodSurvey/latest
 *                    regionData/_kosis/foodSurvey/{YYYY}
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// .env 직접 파싱 (dotenv 의존성 없이)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
  return env;
}
const ENV = loadEnv();
const KOSIS_API_KEY = process.env.KOSIS_API_KEY || ENV.KOSIS_API_KEY;
const FIREBASE_DB = process.env.VITE_FIREBASE_DATABASE_URL || ENV.VITE_FIREBASE_DATABASE_URL || 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';

if (!KOSIS_API_KEY) {
  console.error('[KOSIS] KOSIS_API_KEY 환경변수가 .env 파일에 없습니다.');
  console.error('  → https://kosis.kr/openapi/index/index.jsp 에서 무료 발급');
  process.exit(1);
}

// 통계표 매핑 (kosis-proxy.js와 동일)
const TABLES = {
  // Card 8 (임대/창업)
  interior:        { tblId: 'DT_114054_012', name: '개업시 인테리어 비용', card: 'Card8',  unit: '만원' },
  startupInvest:   { tblId: 'DT_114054_072', name: '개업 시 투자 비용', card: 'Card8',  unit: '만원' },
  rent:            { tblId: 'DT_114054_008', name: '사업장 임차현황', card: 'Card8',  unit: '%' },
  area:            { tblId: 'DT_114054_004', name: '사업장 신고면적', card: 'Card8',  unit: '평' },
  seats:           { tblId: 'DT_114054_010', name: '테이블 및 좌석 수', card: 'Card8',  unit: '석' },
  hours:           { tblId: 'DT_114054_009', name: '영업시간/영업일수', card: 'Card8',  unit: '시간/일' },
  remodel:         { tblId: 'DT_114054_013', name: '리모델링 현황', card: 'Card8',  unit: '%' },
  // Card 6 (매출)
  sales:           { tblId: 'DT_114054_021', name: '매출액', card: 'Card6',  unit: '만원' },
  unitPrice:       { tblId: 'DT_114054_022', name: '객단가', card: 'Card6',  unit: '원' },
  visitors:        { tblId: 'DT_114054_023', name: '일평균 방문/배달', card: 'Card6',  unit: '명' },
  profitability:   { tblId: 'DT_114054_029', name: '수익성·생산성', card: 'Card6',  unit: '%' },
  salesChange:     { tblId: 'DT_114054_134', name: '매출 증감', card: 'Card6',  unit: '%' },
  weekdaySales:    { tblId: 'DT_114054_078', name: '요일별 매출 비중', card: 'Card6',  unit: '%' },
  materialCost:    { tblId: 'DT_114054_031', name: '식재료비', card: 'Card6',  unit: '%' },
  // Card 10 (배달)
  deliveryUse:     { tblId: 'DT_114054_016', name: '배달앱 이용현황', card: 'Card10', unit: '%' },
  deliveryApps:    { tblId: 'DT_114054_077', name: '사용 중인 배달앱', card: 'Card10', unit: '%' },
  // Card 14 (AI 종합)
  difficulty:      { tblId: 'DT_114054_025', name: '경영상 애로사항', card: 'Card14', unit: '%' },
  switchExperience:{ tblId: 'DT_114054_026', name: '업종전환 경험', card: 'Card14', unit: '%' },
  switchIntent:    { tblId: 'DT_114054_027', name: '업종전환 의향', card: 'Card14', unit: '%' },
  // Card 2 (고객)
  customer:        { tblId: 'DT_114054_017', name: '주요 고객 현황', card: 'Card2',  unit: '%' },
  // 외식산업 BSI
  bsi:             { tblId: 'DT_KRBI_11',     name: '외식산업경기동향지수', card: 'Card14', unit: '점', prdSe: 'Q' },
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' }, timeout: 20000 }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body.replace(/^﻿/, '').trim())); }
        catch (e) { resolve({ _raw: body.slice(0, 300), _err: e.message }); }
      });
    }).on('error', reject);
  });
}

async function fetchTable(tblId, prdSe = 'Y') {
  const params = new URLSearchParams({
    method: 'getList', apiKey: KOSIS_API_KEY, format: 'json', jsonVD: 'Y',
    userStatsId: '', prdSe, orgId: '114', tblId,
    itmId: 'ALL', objL1: 'ALL', objL2: 'ALL', objL3: '', objL4: '',
    newEstPrdCnt: '1',
  });
  const url = `https://kosis.kr/openapi/Param/statisticsParameterData.do?${params}`;
  return await fetchJson(url);
}

function filterCoffee(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => {
    const allText = (r.C1_NM || '') + (r.C2_NM || '') + (r.C3_NM || '');
    return /커피\s*전문점|커피전문점|비알코올\s*음료점업/.test(allText);
  });
}

async function firebasePut(path, data) {
  const url = `${FIREBASE_DB}/${path}.json`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('[KOSIS] 외식업체경영실태조사 - 카페(커피전문점) 데이터 수집 시작');
  const results = {};
  const errors = {};
  const keys = Object.keys(TABLES);

  for (const k of keys) {
    const t = TABLES[k];
    process.stdout.write(`  [${k}] ${t.name} (${t.tblId}) ... `);
    try {
      const data = await fetchTable(t.tblId, t.prdSe || 'Y');
      const rows = Array.isArray(data) ? data : (data?.data || []);
      if (rows.length === 0) {
        console.log(`행 0개 (응답: ${JSON.stringify(data).slice(0, 100)})`);
        errors[k] = 'no rows';
      } else {
        const coffee = filterCoffee(rows);
        results[k] = {
          tblId: t.tblId, name: t.name, card: t.card, unit: t.unit,
          coffeeData: coffee, allRows: rows.length, coffeeRows: coffee.length,
          fetchedAt: new Date().toISOString(),
        };
        console.log(`전체 ${rows.length}행 → 카페 ${coffee.length}행`);
      }
    } catch (e) {
      console.log(`실패: ${e.message}`);
      errors[k] = e.message;
    }
    await new Promise(r => setTimeout(r, 250));
  }

  // 연도 추출
  const sampleRow = Object.values(results).find(r => r.coffeeData?.length > 0)?.coffeeData?.[0];
  const year = sampleRow?.PRD_DE || new Date().getFullYear().toString();

  const payload = {
    fetchedAt: new Date().toISOString(),
    year,
    tableCount: Object.keys(results).length,
    errorCount: Object.keys(errors).length,
    results,
    errors,
  };

  console.log('\n[Firebase] 저장 시작');
  await firebasePut(`regionData/_kosis/foodSurvey/latest`, payload);
  await firebasePut(`regionData/_kosis/foodSurvey/${year}`, payload);
  console.log(`[Firebase] 완료: regionData/_kosis/foodSurvey/latest 및 /${year}`);
  console.log(`\n수집 결과: 성공 ${Object.keys(results).length}/${keys.length}, 실패 ${Object.keys(errors).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
