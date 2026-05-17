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

    // risingMenuList가 NULL이면 zinidata에서 보충
    if (result && !result.parseError && result.data && result.data.risingMenuList == null) {
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
