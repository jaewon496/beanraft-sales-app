// 소상공인365 API 프록시 (Netlify Functions)
// CORS 문제 해결을 위한 서버리스 함수
// 2026-01-29 v2 - 새 API 경로(/sbiz/api/*) 지원

const SBIZ365_BASE_URL = 'https://bigdata.sbiz.or.kr';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

// 응답 생성 헬퍼
const createResponse = (body, status = 200) => {
  return new Response(JSON.stringify(body), { 
    status, 
    headers: corsHeaders 
  });
};

// 에러 응답 생성
const createErrorResponse = (message, status = 400, details = null) => {
  return createResponse({
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString()
  }, status);
};

// JSON/JSONP 파싱
const parseResponse = (text) => {
  // JSONP callback 형식 처리
  const jsonpMatch = text.match(/callback\s*\(\s*([\s\S]*)\s*\)\s*;?$/);
  if (jsonpMatch) {
    try {
      return JSON.parse(jsonpMatch[1]);
    } catch (e) {
      return { parseError: true, rawText: text.substring(0, 500) };
    }
  }
  
  // 일반 JSON 시도
  try {
    return JSON.parse(text);
  } catch (e) {
    return { parseError: true, rawText: text.substring(0, 500) };
  }
};

// WGS84 → TM 좌표 변환
const transformWGS84toTM = (lng, lat) => {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const lat0 = 38 * Math.PI / 180;
  const lng0 = 127 * Math.PI / 180;
  const k0 = 1.0;
  const x0 = 200000;
  const y0 = 500000;
  
  const e2 = 2 * f - f * f;
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = e2 / (1 - e2) * Math.cos(latRad) * Math.cos(latRad);
  const A = (lngRad - lng0) * Math.cos(latRad);
  
  const M = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * latRad
    - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*latRad)
    + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*latRad)
    - (35*e2*e2*e2/3072) * Math.sin(6*latRad));
  
  const M0 = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * lat0
    - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*lat0)
    + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*lat0)
    - (35*e2*e2*e2/3072) * Math.sin(6*lat0));
  
  const x = k0 * N * (A + (1-T+C)*A*A*A/6) + x0;
  const y = k0 * (M - M0 + N * Math.tan(latRad) * (A*A/2)) + y0;
  
  return { x: Math.round(x), y: Math.round(y) };
};

// 메인 핸들러
export default async (request, context) => {
  // OPTIONS 요청 (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const apiType = url.searchParams.get('api'); // 'gis', 'sbiz', 'coord'
    const endpoint = url.searchParams.get('endpoint');
    
    if (!apiType) {
      return createErrorResponse('api 파라미터 필요 (gis, sbiz, coord)');
    }

    let targetUrl;
    let apiDescription = '';
    
    // ========================
    // 좌표 → 행정동 코드 변환
    // ========================
    if (apiType === 'coord') {
      const lat = url.searchParams.get('lat');
      const lng = url.searchParams.get('lng');
      
      if (!lat || !lng) {
        return createErrorResponse('lat, lng 파라미터 필요');
      }
      
      const tm = transformWGS84toTM(parseFloat(lng), parseFloat(lat));
      const margin = 500;
      
      const params = new URLSearchParams();
      params.append('minXAxis', (tm.x - margin).toString());
      params.append('maxXAxis', (tm.x + margin).toString());
      params.append('minYAxis', (tm.y - margin).toString());
      params.append('maxYAxis', (tm.y + margin).toString());
      params.append('mapLevel', '14');
      
      targetUrl = `${SBIZ365_BASE_URL}/gis/api/getCoordToAdmPoint.json?${params.toString()}`;
      apiDescription = '좌표→행정동 변환';
    }
    
    // ========================
    // 새 상권 API (/sbiz/api/)
    // ========================
    else if (apiType === 'sbiz') {
      if (!endpoint) {
        return createErrorResponse('endpoint 파라미터 필요');
      }
      
      const params = new URLSearchParams();
      
      // 모든 파라미터 전달 (api, endpoint 제외)
      for (const [key, value] of url.searchParams) {
        if (!['api', 'endpoint'].includes(key)) {
          params.append(key, value);
        }
      }
      
      targetUrl = `${SBIZ365_BASE_URL}${endpoint}?${params.toString()}`;
      apiDescription = `상권API: ${endpoint}`;
    }
    
    // ========================
    // 기존 GIS API
    // ========================
    else if (apiType === 'gis') {
      if (!endpoint) {
        return createErrorResponse('endpoint 파라미터 필요');
      }
      
      const params = new URLSearchParams();
      
      // 좌표 변환 체크
      const wgs84Lat = url.searchParams.get('wgs84_lat');
      const wgs84Lng = url.searchParams.get('wgs84_lng');
      
      if (wgs84Lat && wgs84Lng) {
        const tm = transformWGS84toTM(parseFloat(wgs84Lng), parseFloat(wgs84Lat));
        params.append('cx', tm.x.toString());
        params.append('cy', tm.y.toString());
      }
      
      // 나머지 파라미터 전달
      for (const [key, value] of url.searchParams) {
        if (!['api', 'endpoint', 'wgs84_lat', 'wgs84_lng'].includes(key)) {
          params.append(key, value);
        }
      }
      
      // JSONP callback 추가
      params.append('callback', 'callback');
      
      targetUrl = `${SBIZ365_BASE_URL}${endpoint}?${params.toString()}`;
      apiDescription = `GIS API: ${endpoint}`;
    }
    
    // ========================
    // 잘못된 API 타입
    // ========================
    else {
      return createErrorResponse('api 타입은 gis, sbiz, coord만 가능');
    }

    console.log(`[프록시] ${apiDescription}`);
    console.log(`[URL] ${targetUrl}`);

    // 실제 API 호출
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://bigdata.sbiz.or.kr/',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const responseText = await response.text();
    const elapsedTime = Date.now() - startTime;
    
    console.log(`[응답] ${response.status} (${elapsedTime}ms, ${responseText.length}bytes)`);

    // 응답 파싱
    const data = parseResponse(responseText);
    
    // 성공 여부 판단
    const isSuccess = response.ok && !data.parseError;
    
    return createResponse({
      success: isSuccess,
      status: response.status,
      api: apiDescription,
      elapsedMs: elapsedTime,
      data: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[프록시 에러]', error);
    
    return createErrorResponse(
      error.message || '알 수 없는 오류',
      500,
      { stack: error.stack }
    );
  }
};

// Netlify Functions 경로 설정
export const config = {
  path: "/api/sbiz-proxy"
};
