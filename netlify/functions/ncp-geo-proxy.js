// NCP (Naver Cloud Platform) Geocoding / Directions API 프록시
// 브라우저에서 직접 호출하면 CORS + 401 에러 발생하므로 서버 프록시 필요
// 환경변수: VITE_NCP_CLIENT_ID, VITE_NCP_CLIENT_SECRET (Netlify 환경변수에서 읽음)

const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const { type, query, start, goal, waypoints, option } = params;

  // NCP 키: Netlify 환경변수에서 가져오기 (VITE_ 접두사 포함/미포함 둘 다 체크)
  const clientId = process.env.NCP_CLIENT_ID || process.env.VITE_NCP_CLIENT_ID;
  const clientSecret = process.env.NCP_CLIENT_SECRET || process.env.VITE_NCP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'NCP API keys not configured' })
    };
  }

  try {
    let targetUrl;

    if (type === 'directions' || type === 'driving') {
      // Directions API (경로 탐색)
      if (!start || !goal) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'start, goal 파라미터 필요' })
        };
      }
      // start/goal은 "lng,lat" 형식 (예: 127.0,37.5) - encodeURIComponent 하면 쉼표가 깨지므로 그대로 전달
      targetUrl = `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${start}&goal=${goal}&option=${option || 'trafast'}`;
      if (waypoints) {
        // waypoints는 "lng1,lat1|lng2,lat2" 형식 - 프론트에서 이미 encodeURIComponent 하므로 decode 후 전달
        targetUrl += `&waypoints=${decodeURIComponent(waypoints)}`;
      }
    } else {
      // Geocoding API (기본)
      if (!query) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'query 파라미터 필요' })
        };
      }
      targetUrl = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`;
    }

    console.log('[ncp-geo-proxy]', type || 'geocode', targetUrl.substring(0, 120));

    const data = await new Promise((resolve, reject) => {
      const req = https.get(targetUrl, {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret
        },
        timeout: 10000
      }, (res) => {
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
      req.on('timeout', () => { req.destroy(); reject(new Error('NCP API timeout')); });
    });

    if (data.status !== 200) {
      console.error('[ncp-geo-proxy] NCP API error:', data.status, JSON.stringify(data.data).substring(0, 200));
      return {
        statusCode: data.status,
        headers,
        body: JSON.stringify({ error: `NCP API error: ${data.status}`, detail: data.data })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data.data)
    };
  } catch (err) {
    console.error('[ncp-geo-proxy] error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
