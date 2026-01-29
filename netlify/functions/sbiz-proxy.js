// Netlify Functions - 소상공인365 API 프록시
// SSL 인증서 문제 우회 + CORS 해결

const https = require('https');

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const params = event.queryStringParameters || {};
  const { api, endpoint, ...queryParams } = params;

  if (!api) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'api 파라미터 필요 (sbiz, coord)' })
    };
  }

  try {
    let targetUrl;
    const baseUrl = 'bigdata.sbiz.or.kr';

    if (api === 'sbiz' && endpoint) {
      const urlParams = new URLSearchParams();
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key]) urlParams.append(key, queryParams[key]);
      });
      targetUrl = `https://${baseUrl}${endpoint}?${urlParams.toString()}`;
    } else if (api === 'coord') {
      const { lat, lng } = queryParams;
      if (!lat || !lng) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'lat, lng 필요' })
        };
      }
      // 간단한 TM 좌표 변환
      const margin = 500;
      const tmX = Math.round(parseFloat(lng) * 10000);
      const tmY = Math.round(parseFloat(lat) * 10000);
      targetUrl = `https://${baseUrl}/gis/api/getCoordToAdmPoint.json?minXAxis=${tmX - margin}&maxXAxis=${tmX + margin}&minYAxis=${tmY - margin}&maxYAxis=${tmY + margin}&mapLevel=14`;
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'api는 sbiz 또는 coord' })
      };
    }

    console.log('[프록시 요청]', targetUrl);

    // SSL 인증서 검증 무시하고 요청
    const data = await new Promise((resolve, reject) => {
      const options = {
        rejectUnauthorized: false, // SSL 인증서 검증 무시
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      https.get(targetUrl, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }).on('error', reject);
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
