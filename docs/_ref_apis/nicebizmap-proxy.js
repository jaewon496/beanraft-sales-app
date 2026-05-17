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
    let admiCd, requestBody;

    if (event.httpMethod === 'POST' && event.body) {
      const body = JSON.parse(event.body);
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

    const targetUrl = 'https://m.nicebizmap.co.kr/api/explorer/summary/summary-report';

    console.log(`[nicebizmap-proxy] POST ${targetUrl} admiCd=${admiCd} upjong3Cd=${requestBody.upjong3Cd} yyyymm=${requestBody.yyyymm || 'N/A'}`);

    let result = await fetchJsonPost(targetUrl, requestBody);

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
