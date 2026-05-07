// Netlify Functions - 나이스비즈맵 고객분석 프록시
// m.nicebizmap.co.kr/api/explorer/summary/summary-report POST 프록시

const https = require('https');
const zlib = require('zlib');

function fetchJsonGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers
      },
      timeout: 10000
    };
    const req = https.request(options, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      let body = '';
      stream.on('data', chunk => body += chunk);
      stream.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve(null); }
      });
      stream.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// HTML 응답용 GET (fragment 호출에 사용 - JSON 파싱 안 함)
// 세션 쿠키 자동 첨부 (NICEBIZMAP_SESSION_ID 환경변수, fetchJsonPost와 동일 규칙)
function fetchHtmlGet(url, headers = {}) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const sessionCookie = process.env.NICEBIZMAP_SESSION_ID
      ? 'SESSION=' + Buffer.from(process.env.NICEBIZMAP_SESSION_ID).toString('base64')
      : '';
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://m.nicebizmap.co.kr/',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
        ...headers
      },
      timeout: 12000
    };
    const req = https.request(options, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      let body = '';
      stream.on('data', chunk => body += chunk);
      stream.on('end', () => resolve(body || ''));
      stream.on('error', () => resolve(''));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.end();
  });
}

// HTML 응답용 POST (fragment 호출 - 정답지 fetchJsonPost 패턴 그대로, JSON 파싱 안 함)
// 세션 쿠키 자동 첨부 (NICEBIZMAP_SESSION_ID 환경변수)
function fetchHtmlPost(url, jsonBody) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify(jsonBody);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'text/html, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://m.nicebizmap.co.kr/',
        'Origin': 'https://m.nicebizmap.co.kr',
        'Cookie': process.env.NICEBIZMAP_SESSION_ID
          ? 'SESSION=' + Buffer.from(process.env.NICEBIZMAP_SESSION_ID).toString('base64')
          : '',
        'Content-Length': Buffer.byteLength(postBody)
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      let body = '';
      stream.on('data', chunk => body += chunk);
      stream.on('end', () => resolve(body || ''));
      stream.on('error', () => resolve(''));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.write(postBody);
    req.end();
  });
}

// HTML fragment에서 popularMenuListContainer / risingMenuListContainer 파싱
// 패턴: <div id="popularMenuListContainer"> ... <p class="sec06RankMenu">메뉴명</p>
//       <ul><li>평균 단가 <span>3,550원</span></li> ... </ul>
// 반환: 표준화된 메뉴 객체 배열 (menuNm/MENU_NM, AVG_SALE_UPRC, PCTILE_25, PCTILE_75, SALE_RATE, RNK)
function parseMenuFragment(html, containerId) {
  if (!html || typeof html !== 'string') return [];
  try {
    // 1) container 시작 위치 찾기 → 다음 ListContainer 또는 EOF까지 (단순/안전 방식)
    // 1차: 정확한 id 매치 / 2차: id 부분 매치 (popular/rising) / 3차: section06 영역
    let startMatch = html.match(new RegExp('<div[^>]*id\\s*=\\s*["\']' + containerId + '["\'][^>]*>', 'i'));
    if (!startMatch) {
      // popularMenuListContainer → popular, risingMenuListContainer → rising 키워드 추출
      const kw = /popular/i.test(containerId) ? 'popular' : (/rising/i.test(containerId) ? 'rising' : '');
      if (kw) {
        startMatch = html.match(new RegExp('<[^>]*(?:id|class)\\s*=\\s*["\'][^"\']*' + kw + '[^"\']*["\'][^>]*>', 'i'));
      }
    }
    if (!startMatch) return [];
    const startIdx = (startMatch.index || 0) + startMatch[0].length;
    // 다른 *ListContainer가 다음에 오면 그 직전까지, 없으면 충분히 큰 영역
    const restHtml = html.slice(startIdx);
    const nextContainerRe = /<div[^>]*id\s*=\s*["'][a-zA-Z0-9_]*ListContainer["'][^>]*>/i;
    const nextMatch = restHtml.match(nextContainerRe);
    const containerHtml = nextMatch
      ? restHtml.slice(0, nextMatch.index)
      : restHtml.slice(0, 12000);

    // 2) 각 메뉴 블록: sec06RankMenu (메뉴명) + 그 직후 ul 안의 li/span 값
    const blocks = [];
    const menuRe = /<p[^>]*class\s*=\s*["'][^"']*sec06RankMenu[^"']*["'][^>]*>([\s\S]*?)<\/p>([\s\S]*?)(?=<p[^>]*class\s*=\s*["'][^"']*sec06RankMenu|$)/gi;
    let mm;
    while ((mm = menuRe.exec(containerHtml)) !== null) {
      const menuName = (mm[1] || '').replace(/<[^>]*>/g, '').trim();
      const tail = mm[2] || '';
      // li 안 라벨 + span 값 페어
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      const fields = {};
      let lm;
      while ((lm = liRe.exec(tail)) !== null) {
        const liInner = lm[1] || '';
        const spanMatch = liInner.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
        if (!spanMatch) continue;
        const valStr = (spanMatch[1] || '').replace(/<[^>]*>/g, '').trim();
        const labelStr = liInner.replace(/<span[^>]*>[\s\S]*?<\/span>/i, '').replace(/<[^>]*>/g, '').trim();
        // 숫자 추출 (콤마 제거, %p / % / 원 제거)
        const numStr = valStr.replace(/[^0-9.\-]/g, '');
        const num = numStr ? parseFloat(numStr) : NaN;
        if (/평균\s*단가/.test(labelStr)) fields.AVG_SALE_UPRC = isFinite(num) ? num : null;
        else if (/최저가/.test(labelStr)) fields.PCTILE_25 = isFinite(num) ? num : null;
        else if (/최고가/.test(labelStr)) fields.PCTILE_75 = isFinite(num) ? num : null;
        else if (/매출\s*비중/.test(labelStr)) fields.SALE_RATE = isFinite(num) ? num : null;
        else if (/판매\s*증가율|증가율/.test(labelStr)) fields.GROWTH_RATE = isFinite(num) ? num : null;
        else if (/주문\s*건수|건수/.test(labelStr)) fields.ORDER_CNT = isFinite(num) ? num : null;
      }
      if (menuName) {
        blocks.push({
          MENU_NM: menuName,
          menuNm: menuName,
          menuName: menuName,
          RNK: blocks.length + 1,
          rank: blocks.length + 1,
          ...fields
        });
      }
    }
    return blocks;
  } catch (e) {
    return [];
  }
}

function fetchJsonPost(url, jsonBody) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify(jsonBody);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://m.nicebizmap.co.kr/',
        'Origin': 'https://m.nicebizmap.co.kr',
        'Cookie': process.env.NICEBIZMAP_SESSION_ID
          ? 'SESSION=' + Buffer.from(process.env.NICEBIZMAP_SESSION_ID).toString('base64')
          : '',
        'Content-Length': Buffer.byteLength(postBody)
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      let body = '';
      stream.on('data', chunk => body += chunk);
      stream.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve({ rawBody: body.substring(0, 500), parseError: true }); }
      });
      stream.on('error', (e) => reject(e));
    });
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postBody);
    req.end();
  });
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    let admiCd, requestBody, body = {};

    if (event.httpMethod === 'POST' && event.body) {
      body = JSON.parse(event.body);
      admiCd = body.admiCd;

      requestBody = {
        admiCd: admiCd,
        upjong3Cd: body.upjong3Cd || 'Q13007'
      };
      if (body.region) requestBody.region = body.region;
      if (body.upjong3Nm) requestBody.upjong3Nm = body.upjong3Nm;
      if (body.yyyymm) requestBody.yyyymm = body.yyyymm;
      if (body.prevYyyymm) requestBody.prevYyyymm = body.prevYyyymm;
      if (body.address) requestBody.address = body.address;
      if (body.xAxis) requestBody.xAxis = body.xAxis;
      if (body.yAxis) requestBody.yAxis = body.yAxis;
    } else {
      const params = event.queryStringParameters || {};
      admiCd = params.admiCd;
      body = { upjong3Cd: params.upjong3Cd || 'Q13007' };
      requestBody = {
        admiCd: admiCd,
        upjong3Cd: params.upjong3Cd || 'Q13007'
      };
    }

    if (!admiCd) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'admiCd 파라미터 필요' })
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // [2026-05-06] 세션 불필요 markets/trend 핸들러
    // 정답지 4/24 합의: chart/national, chart/admi, markets/trend, block-data 등
    // 토큰 X 한도 X. mode='trend' 파라미터로 분기.
    // ═══════════════════════════════════════════════════════════════
    if (body.mode === 'trend' || (event.queryStringParameters && event.queryStringParameters.mode === 'trend')) {
      const trendBody = { admiCd, upjong3Cd: requestBody.upjong3Cd };
      const trendData = await fetchJsonPost('https://m.nicebizmap.co.kr/api/explorer/markets/trend', trendBody);
      const items = Array.isArray(trendData?.data) ? trendData.data : [];
      // 입력한 admiCd 동의 업종만 필터 + 점포수 정렬
      const dongItems = items.filter(r => r.admiCd === admiCd);
      const sorted = dongItems.sort((a, b) => (b.thisStoreCnt || 0) - (a.thisStoreCnt || 0));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: sorted.map(r => ({
            upjong3Nm: r.upjong3Nm,
            upjong3Cd: r.upjong3Cd,
            storeCnt: r.thisStoreCnt,
            saleAmt: r.thisSaleAmt,
            salePer: r.salePer,
            cntPer: r.cntPer,
          })),
          totalNationwide: items.length,
          dongMatch: dongItems.length,
        })
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // [2026-05-06] 세션 불필요 markets/chart/national 핸들러
    // 정답지 4/24 합의: 토큰 X, 한도 X. mode='national' 파라미터로 분기.
    // 응답: 전국 업종별 시계열 매출/점포수. 카페 업종 평균 매출 산출용.
    // ═══════════════════════════════════════════════════════════════
    if (body.mode === 'national' || (event.queryStringParameters && event.queryStringParameters.mode === 'national')) {
      const upj3 = requestBody.upjong3Cd || 'Q13007';
      const natBody = { upjong3Cd: upj3 };
      const natData = await fetchJsonPost('https://m.nicebizmap.co.kr/api/explorer/markets/chart/national', natBody);
      // 응답 구조 다양성 대비 (data | result | items 등)
      const rawList = Array.isArray(natData?.data) ? natData.data
        : Array.isArray(natData?.result) ? natData.result
        : Array.isArray(natData?.items) ? natData.items
        : Array.isArray(natData) ? natData : [];
      // 카페(또는 요청 업종) 시계열 항목 추출
      const upj3Items = rawList.filter(r => !r.upjong3Cd || r.upjong3Cd === upj3);
      // 점포당 평균 매출 계산: 매출/점포수
      let perStoreAvgManwon = 0;
      let totalSaleAmt = 0;
      let totalStoreCnt = 0;
      let latestPeriod = null;
      const series = upj3Items.map(r => {
        const sa = parseFloat(r?.thisSaleAmt ?? r?.saleAmt ?? r?.amt ?? 0) || 0;
        const sc = parseInt(r?.thisStoreCnt ?? r?.storeCnt ?? r?.cnt ?? 0, 10) || 0;
        const yyyymm = String(r?.yyyymm ?? r?.crtrYm ?? r?.stdYm ?? '');
        if (sa > 0 && sc > 0) {
          totalSaleAmt += sa;
          totalStoreCnt += sc;
          if (!latestPeriod || yyyymm > latestPeriod) latestPeriod = yyyymm;
        }
        return { yyyymm, saleAmt: sa, storeCnt: sc, perStoreAvg: sc > 0 ? Math.round(sa / sc) : 0 };
      }).filter(r => r.saleAmt > 0 || r.storeCnt > 0);
      // 평균 점포당 매출 (만원 단위 추정 - 응답 단위에 따라 변환 필요. 일반적으로 비즈맵은 원 단위)
      if (totalStoreCnt > 0) {
        const perStoreWon = totalSaleAmt / totalStoreCnt;
        // 비즈맵 saleAmt가 보통 원 단위. 만원 단위로 변환 (응답에 따라 자동 보정)
        perStoreAvgManwon = perStoreWon >= 100000 ? Math.round(perStoreWon / 10000) : Math.round(perStoreWon);
      }
      // 최근 시점 데이터로 한 번 더 보정 (전체 평균보다 최근값이 더 정확)
      let latestPerStoreManwon = 0;
      if (latestPeriod) {
        const latestRows = series.filter(r => r.yyyymm === latestPeriod);
        const lsa = latestRows.reduce((s, r) => s + r.saleAmt, 0);
        const lsc = latestRows.reduce((s, r) => s + r.storeCnt, 0);
        if (lsc > 0) {
          const w = lsa / lsc;
          latestPerStoreManwon = w >= 100000 ? Math.round(w / 10000) : Math.round(w);
        }
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          upjong3Cd: upj3,
          perStoreAvgManwon,           // 시계열 전체 평균 (만원/월)
          latestPerStoreManwon,        // 최근 시점 평균 (만원/월)
          latestPeriod,
          totalSaleAmt,
          totalStoreCnt,
          seriesLength: series.length,
          series: series.slice(-12),   // 최근 12개월만 (응답 부피 축소)
        })
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: check-analyzability 자동 호출 → yyyymm + analysisStatus + expandedAdmiRegions 추출
    // ═══════════════════════════════════════════════════════════════
    const upjong3Cd = requestBody.upjong3Cd;
    const checkUrl = `https://m.nicebizmap.co.kr/api/explorer/summary/check-analyzability?admiCd=${admiCd}&upjong3Cd=${upjong3Cd}`;
    let checkData = null;
    try {
      checkData = await fetchJsonGet(checkUrl, {
        'Referer': 'https://m.nicebizmap.co.kr/',
        'Origin': 'https://m.nicebizmap.co.kr',
        'X-Requested-With': 'XMLHttpRequest'
      });
      console.log(`[nicebizmap-proxy] check-analyzability admiCd=${admiCd} status=${checkData?.analysisStatus || 'N/A'} yyyymm=${checkData?.yyyymm || 'N/A'} expanded=${(checkData?.expandedAdmiRegions || []).length}`);
    } catch (e) {
      console.warn('[nicebizmap-proxy] check-analyzability 실패 (무시):', e.message);
    }

    // STEP 2: yyyymm 자동 보강 + prevYyyymm 자동 계산
    const prevOf = (yyyymm) => {
      if (!yyyymm || yyyymm.length !== 6) return null;
      return String(parseInt(yyyymm.slice(0, 4)) - 1) + yyyymm.slice(4);
    };
    if (!requestBody.yyyymm && checkData?.yyyymm) {
      requestBody.yyyymm = checkData.yyyymm;
    }
    if (!requestBody.prevYyyymm && requestBody.yyyymm) {
      requestBody.prevYyyymm = prevOf(requestBody.yyyymm);
    }

    // STEP 3: upjong3Nm 자동 보강 (커피전문점 기본)
    if (!requestBody.upjong3Nm) {
      requestBody.upjong3Nm = (upjong3Cd === 'Q13007') ? '커피전문점' : '';
    }

    // STEP 4: region 최소 골격 보강
    if (!requestBody.region) {
      requestBody.region = { admiCd, admiData: {} };
    }

    // STEP 5: address/xAxis/yAxis 빈값 기본 처리
    if (requestBody.address == null) requestBody.address = '';
    if (requestBody.xAxis == null) requestBody.xAxis = null;
    if (requestBody.yAxis == null) requestBody.yAxis = null;

    // STEP 6: admiCdList 자동 생성 (EXPANDED_ANALYZABLE 시 본인 + 인접동)
    if (checkData?.analysisStatus === 'EXPANDED_ANALYZABLE') {
      const expanded = (checkData.expandedAdmiRegions || []).map(r => r.admiCd).filter(Boolean);
      const merged = Array.from(new Set([...expanded, admiCd]));
      if (merged.length > 1) {
        requestBody.admiCdList = merged;
      }
    }

    const targetUrl = 'https://m.nicebizmap.co.kr/api/explorer/summary/summary-report';

    console.log(`[nicebizmap-proxy] POST ${targetUrl} admiCd=${admiCd} upjong3Cd=${requestBody.upjong3Cd} yyyymm=${requestBody.yyyymm || 'N/A'} prev=${requestBody.prevYyyymm || 'N/A'} admiCdList=${requestBody.admiCdList ? requestBody.admiCdList.length : 0}`);

    let result = await fetchJsonPost(targetUrl, requestBody);

    // 핵심 키 수신 검증 + 로깅
    const coreKeys = ['genderAgeTrendList','hourlySalesConcentration','weeklySalesConcentration','averageSalesList','usageAndPaymentTrendList','storeCountTrendList','marketSizeTrendList','costAnalysisList','popularMenuList'];
    const inner = (result && !result.parseError) ? (result.data || result) : null;
    const got = inner ? coreKeys.filter(k => inner[k] != null) : [];
    console.log(`[nicebizmap-proxy] core keys received: ${got.length}/${coreKeys.length} - ${got.join(', ')}`);

    // ═══════════════════════════════════════════════════════════════
    // [2026-05-06] popularMenuList / risingMenuList NULL/빈배열 보강 1순위:
    // /explorer/summary-reports/report-fragment HTML fragment 호출
    // 실제 비즈맵 화면에 노출되는 진짜 메뉴 데이터(아메리카노/카페라떼 등) 수집
    // 토큰/한도 차감 없음. 실패 시 아래 zinidata 폴백 유지.
    // ═══════════════════════════════════════════════════════════════
    if (result && !result.parseError && result.data) {
      const _curRising0 = result.data.risingMenuList;
      const _curPop0 = result.data.popularMenuList;
      const _risingEmpty = _curRising0 == null || (Array.isArray(_curRising0) && _curRising0.length === 0);
      const _popEmpty0 = _curPop0 == null || (Array.isArray(_curPop0) && _curPop0.length === 0);
      if (_risingEmpty || _popEmpty0) {
        try {
          // 정답지 fetchJsonPost 패턴 그대로 적용 (POST + JSON body + 세션 쿠키)
          // URL은 쿼리 없이 fragment 엔드포인트만, admiCd/upjong3Cd는 JSON body로 전송
          const fragUrl = 'https://m.nicebizmap.co.kr/explorer/summary-reports/report-fragment';
          const fragBody = {
            admiCd: String(admiCd),
            upjong3Cd: String(requestBody.upjong3Cd || 'Q13007')
          };
          console.log(`[nicebizmap-proxy] menu fragment POST 호출: ${fragUrl} body=${JSON.stringify(fragBody)}`);
          const fragHtml = await fetchHtmlPost(fragUrl, fragBody);
          const _fragLen = fragHtml ? fragHtml.length : 0;
          const _hasPopContainer = !!(fragHtml && /popularMenuListContainer/.test(fragHtml));
          console.log(`[nicebizmap-proxy] fragment POST 응답 길이: ${_fragLen}자, popularMenuListContainer 포함: ${_hasPopContainer}`);
          if (fragHtml && fragHtml.length > 200) {
            if (_popEmpty0) {
              const popMenus = parseMenuFragment(fragHtml, 'popularMenuListContainer');
              if (popMenus.length > 0) {
                result.data.popularMenuList = popMenus;
                console.log(`[nicebizmap-proxy] fragment popularMenuList 보충 완료: ${popMenus.length}건 [${popMenus.map(m => m.MENU_NM).join(', ')}]`);
              }
            }
            if (_risingEmpty) {
              const risingMenus = parseMenuFragment(fragHtml, 'risingMenuListContainer');
              if (risingMenus.length > 0) {
                result.data.risingMenuList = risingMenus;
                console.log(`[nicebizmap-proxy] fragment risingMenuList 보충 완료: ${risingMenus.length}건 [${risingMenus.map(m => m.MENU_NM).join(', ')}]`);
              }
            }
          } else {
            console.log(`[nicebizmap-proxy] fragment 응답 길이 부족 (${fragHtml ? fragHtml.length : 0}) -> zinidata 폴백`);
          }
        } catch (e) {
          console.warn('[nicebizmap-proxy] fragment 메뉴 보충 실패 (무시, zinidata 폴백 진행):', e.message);
        }
      }
    }

    // risingMenuList가 NULL/빈배열이면 zinidata에서 보충 (fragment 실패 시 마지막 폴백)
    const _curRising = result && result.data ? result.data.risingMenuList : undefined;
    const _risingNeedFill = result && !result.parseError && result.data &&
      (_curRising == null || (Array.isArray(_curRising) && _curRising.length === 0));
    if (_risingNeedFill) {
      try {
        const sidoCode = admiCd.substring(0, 2);
        const currentYear = new Date().getFullYear();
        const upjongCd = requestBody.upjong3Cd || 'Q13007';
        const zinidataUrl = `https://api-v1.zinidata.co.kr/v4/union/biz_trend_menu?CLSFC_TERM=M&YEAR=${currentYear}&TERMS=2&UPJONG_CD=${upjongCd}&AREA_CD=${sidoCode}`;
        console.log(`[nicebizmap-proxy] risingMenuList NULL -> zinidata 보충: ${zinidataUrl}`);
        const zinResult = await fetchJsonGet(zinidataUrl, { 'UNION-API-KEY': 'pringles' });
        const menuList = zinResult && zinResult.RESULT && zinResult.RESULT.MENU_LIST;
        if (menuList && menuList.length > 0) {
          result.data.risingMenuList = menuList;
          console.log(`[nicebizmap-proxy] zinidata 보충 완료: ${menuList.length}건`);
        }
      } catch (e) {
        console.warn('[nicebizmap-proxy] zinidata 보충 실패 (무시):', e.message);
      }
    }

    // popularMenuList가 NULL/빈배열이면 zinidata biz_popular_menu에서 보충
    // 정답지 README "다음 세션에서 이어서 할 작업" 명시: zinidata biz_popular_menu 보강
    // 필수 파라미터: CLSFC_TERM=M&YEAR&TERMS=6&UPJONG_CD&AREA_CD&MENU_CLS=ALL
    // 응답 경로: RESULT.MENU_LIST (대문자), 메뉴명: MENU4_NM
    if (result && !result.parseError && result.data) {
      const _curPop = result.data.popularMenuList;
      const _popEmpty = _curPop == null || (Array.isArray(_curPop) && _curPop.length === 0);
      if (_popEmpty) {
        try {
          const sidoCode = admiCd.substring(0, 2);
          const currentYear = new Date().getFullYear();
          const upjongCd = requestBody.upjong3Cd || 'Q13007';
          const popUrl = `https://api-v1.zinidata.co.kr/v4/union/biz_popular_menu?CLSFC_TERM=M&YEAR=${currentYear}&TERMS=6&UPJONG_CD=${upjongCd}&AREA_CD=${sidoCode}&MENU_CLS=ALL`;
          console.log(`[nicebizmap-proxy] popularMenuList 빈값 -> zinidata 보충: ${popUrl}`);
          const popResult = await fetchJsonGet(popUrl, { 'UNION-API-KEY': 'pringles' });
          const popList = popResult && popResult.RESULT && popResult.RESULT.MENU_LIST;
          if (popList && popList.length > 0) {
            // dataMapper 호환 형식으로 매핑: menuNm 키 표준화
            const normalized = popList.slice(0, 10).map((m, idx) => ({
              menuNm: m.MENU4_NM || m.MENU3_NM || m.MENU2_NM || m.MENU1_NM || m.MENU_NM || '',
              menuName: m.MENU4_NM || m.MENU3_NM || m.MENU2_NM || m.MENU1_NM || m.MENU_NM || '',
              rank: idx + 1,
              raw: m
            })).filter(m => m.menuNm);
            if (normalized.length > 0) {
              result.data.popularMenuList = normalized;
              console.log(`[nicebizmap-proxy] popularMenuList zinidata 보충 완료: ${normalized.length}건`);
            }
          }
        } catch (e) {
          console.warn('[nicebizmap-proxy] popularMenuList zinidata 보충 실패 (무시):', e.message);
        }
      }
    }

    if (result.parseError) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'JSON 파싱 실패', raw: result.rawBody })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, data: result })
    };
  } catch (e) {
    console.error('[nicebizmap-proxy] error:', e.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
