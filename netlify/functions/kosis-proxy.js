// Netlify Function - KOSIS OpenAPI 프록시
// 통계청 KOSIS 통계 데이터 조회용
// 환경변수: KOSIS_API_KEY (https://kosis.kr/openapi/index/index.jsp 에서 무료 발급)

const https = require('https');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ─── 외식업체경영실태조사 통계표 매핑 (orgId=114, 농림축산식품부, 매년 갱신) ───
// 모든 통계표는 "특성별(2)"에 "커피 전문점" 분류 가능 (전체 외식업의 13.4%)
// objLevels: 통계표마다 분류값 차원 개수가 다름. 1=objL1만, 2=objL1+objL2, 3=objL1+objL2+objL3
const FOOD_SURVEY_TABLES = {
  // ★★★ Card 8 (임대/창업 정보)
  interior:        { tblId: 'DT_114054_012', name: '개업시 인테리어 비용', card: 'Card8',  unit: '만원',     objLevels: 2 },
  startupInvest:   { tblId: 'DT_114054_072', name: '개업 시 투자 비용 (2023~)', card: 'Card8',  unit: '만원', objLevels: 2 },
  rent:            { tblId: 'DT_114054_008', name: '사업장 임차현황', card: 'Card8',  unit: '%',       objLevels: 2 },
  area:            { tblId: 'DT_114054_004', name: '사업장 신고면적', card: 'Card8',  unit: '평',       objLevels: 2 },
  seats:           { tblId: 'DT_114054_010', name: '테이블 및 좌석 수', card: 'Card8',  unit: '석',     objLevels: 2 },
  hours:           { tblId: 'DT_114054_009', name: '영업시간/영업일수', card: 'Card8',  unit: '시간/일', objLevels: 2 },
  remodel:         { tblId: 'DT_114054_013', name: '리모델링 현황', card: 'Card8',  unit: '%',         objLevels: 2 },

  // ★★★ Card 6 (매출 분석)
  sales:           { tblId: 'DT_114054_021', name: '매출액 (전년도 기준)', card: 'Card6',  unit: '만원', objLevels: 2 },
  unitPrice:       { tblId: 'DT_114054_022', name: '객단가 (전년도 기준)', card: 'Card6',  unit: '원',  objLevels: 2 },
  visitors:        { tblId: 'DT_114054_023', name: '일평균 방문/배달/테이크아웃 수', card: 'Card6',  unit: '명', objLevels: 2 },
  profitability:   { tblId: 'DT_114054_029', name: '수익성·생산성 분석', card: 'Card6',  unit: '%',     objLevels: 1 },
  salesChange:     { tblId: 'DT_114054_134', name: '전년도 대비 매출 증감', card: 'Card6',  unit: '%',  objLevels: 2 },
  weekdaySales:    { tblId: 'DT_114054_078', name: '요일별 매출액 비중', card: 'Card6',  unit: '%',     objLevels: 2 },
  materialCost:    { tblId: 'DT_114054_031', name: '식재료비 사용', card: 'Card6',  unit: '%',         objLevels: 2 },

  // ★ Card 10 (배달 객단가)
  deliveryUse:     { tblId: 'DT_114054_016', name: '배달앱 이용현황', card: 'Card10', unit: '%',         objLevels: 3 },
  deliveryApps:    { tblId: 'DT_114054_077', name: '사용 중인 배달앱', card: 'Card10', unit: '%',        objLevels: 2 },

  // ★ Card 14 (AI 종합)
  difficulty:      { tblId: 'DT_114054_025', name: '경영상 애로사항', card: 'Card14', unit: '%',         objLevels: 2 },
  switchExperience:{ tblId: 'DT_114054_026', name: '업종전환 경험 및 이유', card: 'Card14', unit: '%',   objLevels: 2 },
  switchIntent:    { tblId: 'DT_114054_027', name: '업종전환 의향 및 이유', card: 'Card14', unit: '%',   objLevels: 2 },

  // ★ Card 2 (고객 분석) 보강
  customer:        { tblId: 'DT_114054_017', name: '주요 고객 현황', card: 'Card2',  unit: '%',          objLevels: 2 },

  // ★ 외식산업경기동향지수 (분기 단위)
  bsi:             { tblId: 'DT_KRBI_11',     name: '외식산업경기동향지수', card: 'Card14', unit: '점', prdSe: 'Q', objLevels: 1 },
};

// ─── 외부 통계 매핑 (한국부동산원 408, 국세청 133, 한국은행 301) ───
// 카드 14개 보강용. 기존 food-survey 매핑과 분리.
// objLevels는 통계표마다 다름. 우선 기본값(2)으로 호출하고, 실패 시 1 또는 3 시도.
const EXTERNAL_TABLES = {
  // 한국부동산원 408 (분기별, prdSe=Q) - 73개 상권 단위. objLevels=1 (검증됨)
  marketRent:        { orgId: '408', tblId: 'DT_40801_N2203_06',   name: '상권별 중대형 임대료',          unit: '천원/㎡', prdSe: 'Q', objLevels: 1 },
  marketRentSmall:   { orgId: '408', tblId: 'DT_40801_N4203_06',   name: '상권별 소규모 임대료',          unit: '천원/㎡', prdSe: 'Q', objLevels: 1 },
  marketRentBundle:  { orgId: '408', tblId: 'DT_40801_N3203_06',   name: '상권별 집합 임대료',            unit: '천원/㎡', prdSe: 'Q', objLevels: 1 },
  vacancy:           { orgId: '408', tblId: 'DT_40801_N220201_06', name: '상권별 중대형 공실률',          unit: '%',       prdSe: 'Q', objLevels: 1 },
  vacancySmall:      { orgId: '408', tblId: 'DT_40801_N420201_06', name: '상권별 소규모 공실률',          unit: '%',       prdSe: 'Q', objLevels: 1 },
  priceIndex:        { orgId: '408', tblId: 'DT_40801_N2201_06',   name: '상권별 중대형 임대가격지수',    unit: '지수',    prdSe: 'Q', objLevels: 1 },
  conversionRate:    { orgId: '408', tblId: 'DT_40801_N2206_06',   name: '상권별 중대형 전환율',          unit: '%',       prdSe: 'Q', objLevels: 1 },
  yieldRate:         { orgId: '408', tblId: 'DT_40801_N2301_06',   name: '상권별 중대형 수익률(종합)',    unit: '%',       prdSe: 'Q', objLevels: 1 },
  netIncome:         { orgId: '408', tblId: 'DT_40801_N2303_06',   name: '상권별 중대형 순영업소득',      unit: '원/㎡',   prdSe: 'Q', objLevels: 1 },
  officeRent:        { orgId: '408', tblId: 'DT_40801_N120301_06', name: '상권별 오피스 임대료(3층이상)', unit: '천원/㎡', prdSe: 'Q', objLevels: 1 },

  // 국세청 133 (연간, prdSe=Y)
  cafeClosure:       { orgId: '133', tblId: 'DT_133001_9832',  name: '100대 생활밀접업종 폐업 사업자', unit: '명', prdSe: 'Y', objLevels: 2 },
  regionClosure:     { orgId: '133', tblId: 'DT_133001N_9816', name: '폐업자 현황 시군구',             unit: '명', prdSe: 'Y', objLevels: 2 },

  // 한국은행 301 (월별, prdSe=M)
  consumerSentiment: { orgId: '301', tblId: 'DT_511Y004', name: '소비자동향조사 지역', unit: '점', prdSe: 'M', objLevels: 2 },
};

const corsHandler = corsHeaders;

function fetchJson(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      timeout: timeoutMs,
      rejectUnauthorized: false,
    }, (res) => {
      // [버그 수정] 청크를 문자열로 += 누적하면 한글(UTF-8 멀티바이트)이 청크 경계에서 깨짐.
      // 다른 프록시(store-radius/sbiz/nicebizmap 등)와 동일하게 Buffer로 모은 뒤 UTF-8 디코드.
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        try {
          const cleaned = body.replace(/^﻿/, '').trim();
          resolve(JSON.parse(cleaned));
        } catch (e) {
          resolve({ _raw: body.slice(0, 500), _parseError: e.message });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// 전체 일괄 호출용 글로벌 데드라인 헬퍼 (26초 함수 limit 보호)
// 부분 응답이라도 반환하여 클라이언트가 폴백 가능하도록.
function withDeadline(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

// 통계표 데이터 조회
// objLevels: 통계표마다 분류값 차원 개수가 다름 (1, 2, 3 중 하나)
//   1 = objL1=ALL만, objL2~4=빈값
//   2 = objL1+objL2=ALL, objL3~4=빈값  (외식업체조사 대부분)
//   3 = objL1+objL2+objL3=ALL, objL4=빈값  (배달앱 등 일부)
async function getStatTable({ orgId, tblId, prdSe = 'Y', newEstPrdCnt = '1', startPrdDe, endPrdDe, itmId = 'ALL', objLevels = 2, apiKey }) {
  const params = new URLSearchParams({
    method: 'getList',
    apiKey,
    format: 'json',
    jsonVD: 'Y',
    userStatsId: '',
    prdSe,
    orgId,
    tblId,
    itmId,
    objL1: objLevels >= 1 ? 'ALL' : '',
    objL2: objLevels >= 2 ? 'ALL' : '',
    objL3: objLevels >= 3 ? 'ALL' : '',
    objL4: objLevels >= 4 ? 'ALL' : '',
  });
  if (startPrdDe && endPrdDe) {
    params.append('startPrdDe', startPrdDe);
    params.append('endPrdDe', endPrdDe);
  } else {
    params.append('newEstPrdCnt', newEstPrdCnt);
  }
  const url = `https://kosis.kr/openapi/Param/statisticsParameterData.do?${params.toString()}`;
  return await fetchJson(url, arguments[0]?.timeoutMs);
}

// 응답 데이터에서 "커피 전문점"만 필터링 (분류값명 또는 분류값ID 매칭)
function filterCoffeeShops(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => {
    const c1 = (r.C1_NM || '').toString();
    const c2 = (r.C2_NM || '').toString();
    const c3 = (r.C3_NM || '').toString();
    return /커피\s*전문점|커피전문점|비알코올\s*음료점업/.test(c1 + c2 + c3);
  });
}

// 통계표 응답을 카드용으로 가공: 시점별/분류별 평균값 추출
function summarizeRows(rows, key = 'DT') {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const byPeriod = {};
  rows.forEach(r => {
    const prd = r.PRD_DE || r.PRD_DE_NM || 'unknown';
    const value = parseFloat(r[key] || r.DT || '0') || 0;
    const itm = r.ITM_NM || r.ITM_ID || '';
    if (!byPeriod[prd]) byPeriod[prd] = [];
    byPeriod[prd].push({ itm, value, c1: r.C1_NM, c2: r.C2_NM, c3: r.C3_NM, unit: r.UNIT_NM });
  });
  return byPeriod;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const apiKey = process.env.KOSIS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'KOSIS_API_KEY 환경변수가 설정되지 않았습니다. https://kosis.kr/openapi/index/index.jsp 에서 무료 발급 후 .env 또는 Netlify 환경변수에 등록하세요.',
        availableTables: Object.fromEntries(Object.entries(FOOD_SURVEY_TABLES).map(([k, v]) => [k, { tblId: v.tblId, name: v.name }])),
      })
    };
  }

  const queryParams = event.queryStringParameters || {};
  const { mode, key, year, all } = queryParams;

  try {
    // 모드 1: 외식업체조사 단일 통계표 호출 (key=interior, rent, sales, ...)
    if (mode === 'food-survey' && key && FOOD_SURVEY_TABLES[key]) {
      const t = FOOD_SURVEY_TABLES[key];
      const data = await getStatTable({
        orgId: '114',
        tblId: t.tblId,
        prdSe: t.prdSe || 'Y',
        newEstPrdCnt: '1',
        startPrdDe: year || undefined,
        endPrdDe: year || undefined,
        objLevels: t.objLevels || 2,
        apiKey,
      });
      const rows = Array.isArray(data) ? data : (data?.data || []);
      const coffee = filterCoffeeShops(rows);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          mode: 'food-survey',
          key,
          tblId: t.tblId,
          name: t.name,
          card: t.card,
          unit: t.unit,
          rowCount: rows.length,
          coffeeShopRowCount: coffee.length,
          coffeeShopData: coffee,
          allData: rows,
        })
      };
    }

    // 모드 2: 외식업체조사 전체 통계표 일괄 호출 (Firebase 캐시용, 22초 글로벌 데드라인)
    if (mode === 'food-survey-all' || all === 'true') {
      const results = {};
      const errors = {};
      const keys = Object.keys(FOOD_SURVEY_TABLES);
      // 병렬 호출 (테스트 결과: 직렬 9초 → 병렬 0.5초)
      const fetchTask = Promise.all(keys.map(async (k) => {
        const t = FOOD_SURVEY_TABLES[k];
        try {
          const d = await getStatTable({
            orgId: '114',
            tblId: t.tblId,
            prdSe: t.prdSe || 'Y',
            newEstPrdCnt: '1',
            objLevels: t.objLevels || 2,
            apiKey,
            timeoutMs: 10000,
          });
          const rows = Array.isArray(d) ? d : (d?.data || []);
          results[k] = {
            tblId: t.tblId,
            name: t.name,
            card: t.card,
            unit: t.unit,
            coffeeShopData: filterCoffeeShops(rows),
            rowCount: rows.length,
          };
        } catch (e) {
          errors[k] = e.message;
        }
      }));
      await withDeadline(fetchTask, 22000, null);
      const _deadlineHit = Object.keys(results).length + Object.keys(errors).length < keys.length;
      if (_deadlineHit) {
        keys.forEach(k => {
          if (!results[k] && !errors[k]) errors[k] = 'deadline (22s)';
        });
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, mode: 'food-survey-all', results, errors, _meta: { fetchedAt: new Date().toISOString(), tableCount: keys.length, deadlineHit: _deadlineHit } })
      };
    }

    // 모드 4: 외부 통계 단일 호출 (한국부동산원/국세청/한국은행)
    if (mode === 'external' && key && EXTERNAL_TABLES[key]) {
      const t = EXTERNAL_TABLES[key];
      const data = await getStatTable({
        orgId: t.orgId,
        tblId: t.tblId,
        prdSe: t.prdSe || 'Y',
        newEstPrdCnt: '1',
        objLevels: t.objLevels || 2,
        apiKey,
      });
      const rows = Array.isArray(data) ? data : (data?.data || []);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          mode: 'external',
          key,
          orgId: t.orgId,
          tblId: t.tblId,
          name: t.name,
          unit: t.unit,
          prdSe: t.prdSe,
          rowCount: rows.length,
          data: rows,
          _raw: rows.length === 0 ? data : undefined,
        })
      };
    }

    // 모드 6: 외부 통계 시계열 호출 (분기/월/연 추이용)
    // 5종 핵심 시계열만 가져옴: marketRent(8Q), vacancy(8Q), priceIndex(12Q), cafeClosure(11Y), consumerSentiment(12M)
    // - mode=external-series&key=cafeClosure 단일 호출
    // - mode=external-series 전체 5종 일괄 호출
    if (mode === 'external-series') {
      const SERIES_PRD_CNT = {
        marketRent:        8,
        vacancy:           8,
        priceIndex:        12,
        cafeClosure:       11,
        consumerSentiment: 12,
      };
      const seriesKeys = Object.keys(SERIES_PRD_CNT);

      // 단일 시계열 호출
      if (key && SERIES_PRD_CNT[key] && EXTERNAL_TABLES[key]) {
        const t = EXTERNAL_TABLES[key];
        const cnt = SERIES_PRD_CNT[key];
        const data = await getStatTable({
          orgId: t.orgId,
          tblId: t.tblId,
          prdSe: t.prdSe || 'Y',
          newEstPrdCnt: String(cnt),
          objLevels: t.objLevels || 2,
          apiKey,
        });
        const rows = Array.isArray(data) ? data : (data?.data || []);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            mode: 'external-series',
            key,
            orgId: t.orgId,
            tblId: t.tblId,
            name: t.name,
            unit: t.unit,
            prdSe: t.prdSe,
            requestedPeriods: cnt,
            rowCount: rows.length,
            data: rows,
            _raw: rows.length === 0 ? data : undefined,
          })
        };
      }

      // 전체 5종 일괄 호출 (병렬, 22초 글로벌 데드라인)
      const results = {};
      const errors = {};
      const seriesTask = Promise.all(seriesKeys.map(async (k) => {
        const t = EXTERNAL_TABLES[k];
        const cnt = SERIES_PRD_CNT[k];
        try {
          const d = await getStatTable({
            orgId: t.orgId,
            tblId: t.tblId,
            prdSe: t.prdSe || 'Y',
            newEstPrdCnt: String(cnt),
            objLevels: t.objLevels || 2,
            apiKey,
            timeoutMs: 10000,
          });
          const rows = Array.isArray(d) ? d : (d?.data || []);
          // 응답 크기 줄이기: 핵심 필드만 (Stream too big 방지)
          const slimRows = rows.map(r => ({
            C1: r.C1, C1_NM: r.C1_NM,
            C2: r.C2, C2_NM: r.C2_NM,
            ITM_ID: r.ITM_ID, ITM_NM: r.ITM_NM,
            DT: r.DT, UNIT_NM: r.UNIT_NM,
            PRD_DE: r.PRD_DE, PRD_SE: r.PRD_SE,
          }));
          results[k] = {
            orgId: t.orgId,
            tblId: t.tblId,
            name: t.name,
            unit: t.unit,
            prdSe: t.prdSe,
            requestedPeriods: cnt,
            rowCount: slimRows.length,
            data: slimRows,
          };
        } catch (e) {
          errors[k] = e.message;
        }
      }));
      // 22초 글로벌 데드라인 — Netlify 함수 26초 타임아웃 전에 부분 응답이라도 반환
      await withDeadline(seriesTask, 22000, null);
      const _deadlineHit = Object.keys(results).length + Object.keys(errors).length < seriesKeys.length;
      if (_deadlineHit) {
        seriesKeys.forEach(k => {
          if (!results[k] && !errors[k]) errors[k] = 'deadline (22s)';
        });
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          mode: 'external-series',
          results,
          errors,
          _meta: { fetchedAt: new Date().toISOString(), tableCount: seriesKeys.length, periods: SERIES_PRD_CNT, deadlineHit: _deadlineHit }
        })
      };
    }

    // 모드 5: 외부 통계 13종 일괄 호출 (병렬, 22초 글로벌 데드라인)
    if (mode === 'external-all') {
      const results = {};
      const errors = {};
      const keys = Object.keys(EXTERNAL_TABLES);
      const allTask = Promise.all(keys.map(async (k) => {
        const t = EXTERNAL_TABLES[k];
        try {
          const d = await getStatTable({
            orgId: t.orgId,
            tblId: t.tblId,
            prdSe: t.prdSe || 'Y',
            newEstPrdCnt: '1',
            objLevels: t.objLevels || 2,
            apiKey,
            timeoutMs: 10000,
          });
          const rows = Array.isArray(d) ? d : (d?.data || []);
          // 응답 크기 줄이기: 각 행에서 핵심 필드만 추출 (Stream too big 방지)
          const slimRows = rows.map(r => ({
            C1: r.C1, C1_NM: r.C1_NM,
            C2: r.C2, C2_NM: r.C2_NM,
            ITM_ID: r.ITM_ID, ITM_NM: r.ITM_NM,
            DT: r.DT, UNIT_NM: r.UNIT_NM,
            PRD_DE: r.PRD_DE, PRD_SE: r.PRD_SE,
          }));
          results[k] = {
            orgId: t.orgId,
            tblId: t.tblId,
            name: t.name,
            unit: t.unit,
            prdSe: t.prdSe,
            rowCount: slimRows.length,
            data: slimRows,
          };
        } catch (e) {
          errors[k] = e.message;
        }
      }));
      // 22초 글로벌 데드라인 — Netlify 함수 26초 타임아웃 전에 부분 응답이라도 반환
      await withDeadline(allTask, 22000, null);
      const _deadlineHit = Object.keys(results).length + Object.keys(errors).length < keys.length;
      if (_deadlineHit) {
        keys.forEach(k => {
          if (!results[k] && !errors[k]) errors[k] = 'deadline (22s)';
        });
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, mode: 'external-all', results, errors, _meta: { fetchedAt: new Date().toISOString(), tableCount: keys.length, deadlineHit: _deadlineHit } })
      };
    }

    // 모드 3: 사용 가능한 통계표 목록 반환
    if (mode === 'list') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          tables: FOOD_SURVEY_TABLES,
          externalTables: EXTERNAL_TABLES,
          usage: '예시: /.netlify/functions/kosis-proxy?mode=food-survey&key=interior  또는  /.netlify/functions/kosis-proxy?mode=external&key=marketRent'
        })
      };
    }

    // 자유 모드: orgId, tblId 직접 전달
    if (queryParams.orgId && queryParams.tblId) {
      const data = await getStatTable({
        orgId: queryParams.orgId,
        tblId: queryParams.tblId,
        prdSe: queryParams.prdSe || 'Y',
        newEstPrdCnt: queryParams.newEstPrdCnt || '1',
        startPrdDe: queryParams.startPrdDe,
        endPrdDe: queryParams.endPrdDe,
        itmId: queryParams.itmId || 'ALL',
        objLevels: parseInt(queryParams.objLevels || '2', 10),
        apiKey,
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, data, _meta: { orgId: queryParams.orgId, tblId: queryParams.tblId } }) };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'mode 또는 (orgId+tblId) 필요',
        availableModes: [
          'food-survey&key=<key> (단일 통계표, 카페만 필터)',
          'food-survey-all (외식업체조사 전체 통계표 일괄)',
          'external&key=<key> (외부 통계 단일: 한국부동산원/국세청/한국은행)',
          'external-all (외부 통계 13종 일괄)',
          'external-series&key=<key> (시계열: marketRent/vacancy/priceIndex/cafeClosure/consumerSentiment)',
          'external-series (시계열 5종 일괄)',
          'list (사용 가능한 통계표 목록)',
        ],
        keys: Object.keys(FOOD_SURVEY_TABLES),
        externalKeys: Object.keys(EXTERNAL_TABLES),
        usage: '예시: /.netlify/functions/kosis-proxy?mode=food-survey&key=interior  또는  /.netlify/functions/kosis-proxy?mode=external&key=marketRent'
      })
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
