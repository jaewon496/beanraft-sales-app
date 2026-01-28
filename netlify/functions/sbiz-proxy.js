// 소상공인365 API 프록시 (Netlify Functions)
// CORS 문제 해결을 위한 서버리스 함수
// 2026-01-27 개선 버전

const SBIZ365_BASE_URL = 'https://bigdata.sbiz.or.kr';

// 소상공인365 OpenAPI 키 목록
const API_KEYS = {
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

// JSONP 파싱 (소상공인365 GIS API는 JSONP 형식 반환)
const parseJsonp = (text) => {
  // callback({"key": "value"}) 형식 처리
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

// WGS84 → TM 좌표 변환 (소상공인365 GIS API용)
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
    const apiType = url.searchParams.get('api'); // 'gis' 또는 'open'
    const endpoint = url.searchParams.get('endpoint');
    
    // 필수 파라미터 검증
    if (!apiType) {
      return createErrorResponse('api 파라미터 필요 (gis 또는 open)');
    }
    
    if (!endpoint) {
      return createErrorResponse('endpoint 파라미터 필요');
    }

    let targetUrl;
    let apiDescription = '';
    
    // ========================
    // GIS API 처리 (인증 불필요)
    // ========================
    if (apiType === 'gis') {
      const params = new URLSearchParams();
      
      // 좌표 변환 체크 (wgs84 파라미터가 있으면 TM으로 변환)
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
    // OpenAPI 처리 (키 필요)
    // ========================
    else if (apiType === 'open') {
      const apiName = url.searchParams.get('apiName');
      
      if (!apiName) {
        return createErrorResponse('apiName 파라미터 필요');
      }
      
      const apiKey = API_KEYS[apiName];
      
      if (!apiKey) {
        return createErrorResponse(`알 수 없는 API: ${apiName}`, 400, {
          availableApis: Object.keys(API_KEYS)
        });
      }
      
      const params = new URLSearchParams();
      params.append('key', apiKey);
      
      // 나머지 파라미터 전달
      for (const [paramKey, value] of url.searchParams) {
        if (!['api', 'endpoint', 'apiName'].includes(paramKey)) {
          params.append(paramKey, value);
        }
      }
      
      targetUrl = `${SBIZ365_BASE_URL}${endpoint}?${params.toString()}`;
      apiDescription = `OpenAPI: ${apiName}`;
    }
    
    // ========================
    // 잘못된 API 타입
    // ========================
    else {
      return createErrorResponse('api 타입은 gis 또는 open만 가능');
    }

    console.log(`[프록시 요청] ${apiDescription}`);
    console.log(`[타겟 URL] ${targetUrl}`);

    // 실제 API 호출
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://bigdata.sbiz.or.kr/',
        'Origin': 'https://bigdata.sbiz.or.kr'
      }
    });

    const responseText = await response.text();
    const elapsedTime = Date.now() - startTime;
    
    console.log(`[응답 상태] ${response.status} (${elapsedTime}ms)`);
    console.log(`[응답 크기] ${responseText.length} bytes`);

    // 응답 파싱
    const data = parseJsonp(responseText);
    
    // 성공 여부 판단
    const isSuccess = response.ok && !data.parseError;
    
    return createResponse({
      success: isSuccess,
      status: response.status,
      api: apiDescription,
      url: targetUrl,
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
