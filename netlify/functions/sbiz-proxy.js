// Netlify Functions - 소상공인 API 프록시 (공공데이터포털 + 소상공인365)
// gis/open API 핸들러 추가, WGS84→TM 변환 분리

const https = require('https');
const http = require('http');

const DATA_GO_KR_API_KEY = '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb';

const SBIZ_OPEN_API_KEYS = {
  snsAnaly: 'd46f5d518688912176484b6f894664c5d0b252967d92f4bafc690904381d7ff5',
  simple: 'bb51c6d3d3f93e8172c7888e73eb19afb9120c9f61676c658648ee2853f88e85',
  tour: 'fc2070ca36e0ec845ecfd8c949860cfe4552e56903afcb9bcea07a509f820bcd',
  slsIndex: 'abddbf5dc29670b9209d75e4910c7fd932a8a1a43dcce9d18661585e4040f2fb',
  delivery: '3ba2863eaf4e3b30b3c0237ab9da80ed11f4a7579d4f212d5c318b8e41a3a304',
  startupPublic: '167264f6eef5710d8d79e96b1316e8c2cb85a197d32446d3849008d0376cf098',
  detail: 'b2d9a1ae52aace697124a56c7c2bbed2eeb94fd4996fb5935cb9a25cc4c3c869',
  stcarSttus: '79a86fd460fe7478f52788c4a68a0e6f3406a23ff123c050a21a160a59946fd3',
  storSttus: 'b36c5637768f458919f5179641dac0cd742791750dc016a8591c4e7a6ab649c1',
  weather: '843e44cd955ebc42a684c9c892ada0b122713650e0e85c1f3ebe09c9aeff6319',
  hpReport: 'd269ecf98403fa878587eb925ded6ecf9e02f297da19f5d8ffec5cac7309647a'
};

function wgs84ToTM(lat, lng) {
  const a = 6378137.0, f = 1 / 298.257222101;
  const lat0 = 38 * Math.PI / 180, lng0 = 127 * Math.PI / 180;
  const k0 = 1.0, x0 = 200000, y0 = 500000;
  const e2 = 2 * f - f * f;
  const latRad = lat * Math.PI / 180, lngRad = lng * Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = e2 / (1 - e2) * Math.cos(latRad) * Math.cos(latRad);
  const A = (lngRad - lng0) * Math.cos(latRad);
  const M = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * latRad - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*latRad) + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*latRad) - (35*e2*e2*e2/3072) * Math.sin(6*latRad));
  const M0 = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * lat0 - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*lat0) + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*lat0) - (35*e2*e2*e2/3072) * Math.sin(6*lat0));
  const x = Math.round(k0 * N * (A + (1-T+C)*A*A*A/6 + (5-18*T+T*T+72*C-58*e2/(1-e2))*A*A*A*A*A/120) + x0);
  const yVal = Math.round(k0 * (M - M0 + N * Math.tan(latRad) * (A*A/2 + (5-T+9*C+4*C*C)*A*A*A*A/24 + (61-58*T+T*T+600*C-330*e2/(1-e2))*A*A*A*A*A*A/720)) + y0);
  return { x, y: yVal };
}

exports.handler = async (event, context) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json; charset=utf-8' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  const params = event.queryStringParameters || {};
  const { api, endpoint, apiName, ...queryParams } = params;
  if (!api) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'api 파라미터 필요', available: ['sbiz','coord','store','storeRadius','storeInds','gis','open'] }) };

  const startTime = Date.now();
  try {
    let targetUrl, useHttp = false;

    // 1. GIS API
    if (api === 'gis' && endpoint) {
      if (queryParams.wgs84_lat && queryParams.wgs84_lng) {
        const tm = wgs84ToTM(parseFloat(queryParams.wgs84_lat), parseFloat(queryParams.wgs84_lng));
        const margin = parseInt(queryParams.margin) || 1000;
        const urlParams = new URLSearchParams({ minXAxis: (tm.x-margin).toString(), maxXAxis: (tm.x+margin).toString(), minYAxis: (tm.y-margin).toString(), maxYAxis: (tm.y+margin).toString(), mapLevel: queryParams.mapLevel || '14' });
        ['chkedList','indsLclsCd','indsLclsNm','indsMclsCd','indsMclsNm'].forEach(k => { if (queryParams[k]) urlParams.append(k, queryParams[k]); });
        targetUrl = `https://bigdata.sbiz.or.kr${endpoint}?${urlParams.toString()}`;
      } else {
        const urlParams = new URLSearchParams();
        Object.keys(queryParams).forEach(k => { if (queryParams[k]) urlParams.append(k, queryParams[k]); });
        targetUrl = `https://bigdata.sbiz.or.kr${endpoint}?${urlParams.toString()}`;
      }
    }
    // 2. OpenAPI
    else if (api === 'open' && endpoint) {
      const key = SBIZ_OPEN_API_KEYS[apiName];
      if (!key) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: `알 수 없는 apiName: ${apiName}`, available: Object.keys(SBIZ_OPEN_API_KEYS) }) };
      const urlParams = new URLSearchParams({ certKey: key });
      Object.keys(queryParams).forEach(k => { if (queryParams[k]) urlParams.append(k, queryParams[k]); });
      targetUrl = `https://bigdata.sbiz.or.kr${endpoint}?${urlParams.toString()}`;
    }
    // 3. SBIZ
    else if (api === 'sbiz' && endpoint) {
      const urlParams = new URLSearchParams();
      Object.keys(queryParams).forEach(k => { if (queryParams[k]) urlParams.append(k, queryParams[k]); });
      targetUrl = `https://bigdata.sbiz.or.kr${endpoint}?${urlParams.toString()}`;
    }
    // 4. coord (반경 자동 확대: 1000 → 2000 → 3000)
    else if (api === 'coord') {
      const { lat, lng } = queryParams;
      if (!lat || !lng) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'lat, lng 필요' }) };
      const tm = wgs84ToTM(parseFloat(lat), parseFloat(lng));
      const margins = [1000, 2000, 3000];
      let coordResult = null;
      for (const margin of margins) {
        const coordUrl = `https://bigdata.sbiz.or.kr/gis/api/getCoordToAdmPoint.json?minXAxis=${tm.x-margin}&maxXAxis=${tm.x+margin}&minYAxis=${tm.y-margin}&maxYAxis=${tm.y+margin}&mapLevel=14`;
        const coordData = await new Promise((resolve, reject) => {
          const req = https.get(coordUrl, { rejectUnauthorized: false, headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://bigdata.sbiz.or.kr/' }, timeout: 15000 }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve([]); } });
          });
          req.on('error', () => resolve([]));
          req.on('timeout', () => { req.destroy(); resolve([]); });
        });
        if (Array.isArray(coordData) && coordData.length > 0) {
          coordResult = coordData;
          console.log(`[coord] margin=${margin}m → ${coordData.length}개 행정동 찾음`);
          break;
        }
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, status: 200, data: coordResult || [], elapsedMs: Date.now() - startTime })
      };
    }
    // 5. store (공공데이터포털)
    else if (api === 'store') {
      useHttp = true;
      const { divId, key, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      const urlParams = new URLSearchParams({ serviceKey: DATA_GO_KR_API_KEY, divId: divId||'adongCd', key: key||'1168010100', numOfRows: numOfRows||'100', pageNo: pageNo||'1', type: 'json' });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListInDong?${urlParams.toString()}`;
    }
    else if (api === 'storeRadius') {
      useHttp = true;
      const { cx, cy, radius, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      if (!cx || !cy) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'cx(경도), cy(위도) 필요' }) };
      const urlParams = new URLSearchParams({ serviceKey: DATA_GO_KR_API_KEY, cx, cy, radius: radius||'500', numOfRows: numOfRows||'100', pageNo: pageNo||'1', type: 'json' });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListInRadius?${urlParams.toString()}`;
    }
    else if (api === 'storeInds') {
      useHttp = true;
      const { divId, key, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      const urlParams = new URLSearchParams({ serviceKey: DATA_GO_KR_API_KEY, divId: divId||'adongCd', key: key||'1168010100', numOfRows: numOfRows||'100', pageNo: pageNo||'1', type: 'json' });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListByIndsMclasCd?${urlParams.toString()}`;
    }
    // 6. 서울시 열린데이터 (추정매출, 유동인구 등)
    else if (api === 'seoul') {
      useHttp = true;
      const seoulApiKey = '6d6c71717173656f3432436863774a';
      const { service, startIndex, endIndex, stdrYyquCd } = queryParams;
      const svc = service || 'VwsmTrdarSelngQq'; // 기본: 추정매출
      const si = startIndex || '1';
      const ei = endIndex || '1000';
      const quarter = stdrYyquCd ? `/${stdrYyquCd}` : '';
      targetUrl = `http://openapi.seoul.go.kr:8088/${seoulApiKey}/json/${svc}/${si}/${ei}${quarter}`;
    }
    else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: '지원하지 않는 api 타입', available: ['sbiz','coord','store','storeRadius','storeInds','gis','open','seoul'] }) };
    }

    console.log('[프록시]', api, targetUrl?.substring(0, 200));

    const data = await new Promise((resolve, reject) => {
      const protocol = useHttp ? http : https;
      const req = protocol.get(targetUrl, { rejectUnauthorized: false, headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://bigdata.sbiz.or.kr/' }, timeout: 30000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch(e) { resolve({ status: res.statusCode, data: body }); } });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, status: data.status, data: data.data, elapsedMs: Date.now() - startTime }) };
  } catch (error) {
    console.error('[프록시 에러]', error.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
