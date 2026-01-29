// Netlify Functions - 소상공인 API 프록시 (공공데이터포털 + 소상공인365)
// SSL 인증서 문제 우회 + CORS 해결

const https = require('https');
const http = require('http');

// 공공데이터포털 API 키
const DATA_GO_KR_API_KEY = '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb';

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const params = event.queryStringParameters || {};
  const { api, endpoint, ...queryParams } = params;

  if (!api) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'api 파라미터 필요',
        available: ['sbiz', 'coord', 'store', 'storeRadius', 'storeInds']
      })
    };
  }

  try {
    let targetUrl;
    let useHttp = false; // 공공데이터포털은 http

    // ═══════════════════════════════════════════════════════════════
    // 1. 소상공인365 비공식 API (sbiz, coord)
    // ═══════════════════════════════════════════════════════════════
    if (api === 'sbiz' && endpoint) {
      const baseUrl = 'bigdata.sbiz.or.kr';
      const urlParams = new URLSearchParams();
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key]) urlParams.append(key, queryParams[key]);
      });
      targetUrl = `https://${baseUrl}${endpoint}?${urlParams.toString()}`;
    } 
    else if (api === 'coord') {
      const baseUrl = 'bigdata.sbiz.or.kr';
      const { lat, lng } = queryParams;
      if (!lat || !lng) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'lat, lng 필요' })
        };
      }
      const margin = 500;
      const tmX = Math.round(parseFloat(lng) * 10000);
      const tmY = Math.round(parseFloat(lat) * 10000);
      targetUrl = `https://${baseUrl}/gis/api/getCoordToAdmPoint.json?minXAxis=${tmX - margin}&maxXAxis=${tmX + margin}&minYAxis=${tmY - margin}&maxYAxis=${tmY + margin}&mapLevel=14`;
    }
    // ═══════════════════════════════════════════════════════════════
    // 2. 공공데이터포털 상가(상권)정보 API (store, storeRadius, storeInds)
    // ═══════════════════════════════════════════════════════════════
    else if (api === 'store') {
      // 행정동 내 상가 조회
      useHttp = true;
      const { divId, key, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      const urlParams = new URLSearchParams({
        serviceKey: DATA_GO_KR_API_KEY,
        divId: divId || 'adongCd',
        key: key || '1168010100',
        numOfRows: numOfRows || '100',
        pageNo: pageNo || '1',
        type: 'json'
      });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListInDong?${urlParams.toString()}`;
    }
    else if (api === 'storeRadius') {
      // 반경 내 상가 조회
      useHttp = true;
      const { cx, cy, radius, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      if (!cx || !cy) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'cx(경도), cy(위도) 필요' })
        };
      }
      const urlParams = new URLSearchParams({
        serviceKey: DATA_GO_KR_API_KEY,
        cx: cx,
        cy: cy,
        radius: radius || '500',
        numOfRows: numOfRows || '100',
        pageNo: pageNo || '1',
        type: 'json'
      });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListInRadius?${urlParams.toString()}`;
    }
    else if (api === 'storeInds') {
      // 업종별 상가 조회
      useHttp = true;
      const { divId, key, indsLclsCd, indsMclsCd, indsSclsCd, numOfRows, pageNo } = queryParams;
      const urlParams = new URLSearchParams({
        serviceKey: DATA_GO_KR_API_KEY,
        divId: divId || 'adongCd',
        key: key || '1168010100',
        numOfRows: numOfRows || '100',
        pageNo: pageNo || '1',
        type: 'json'
      });
      if (indsLclsCd) urlParams.append('indsLclsCd', indsLclsCd);
      if (indsMclsCd) urlParams.append('indsMclsCd', indsMclsCd);
      if (indsSclsCd) urlParams.append('indsSclsCd', indsSclsCd);
      targetUrl = `http://apis.data.go.kr/B553077/api/open/sdsc/storeListByIndsMclasCd?${urlParams.toString()}`;
    }
    else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: '지원하지 않는 api 타입',
          available: ['sbiz', 'coord', 'store', 'storeRadius', 'storeInds']
        })
      };
    }

    console.log('[프록시 요청]', api, targetUrl);

    // HTTP/HTTPS 요청
    const data = await new Promise((resolve, reject) => {
      const protocol = useHttp ? http : https;
      const options = {
        rejectUnauthorized: false,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      };

      const req = protocol.get(targetUrl, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, status: data.status, data: data.data })
    };

  } catch (error) {
    console.error('[프록시 에러]', error.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
