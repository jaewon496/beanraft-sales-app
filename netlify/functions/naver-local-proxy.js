// Naver Search API 프록시 (CORS 우회) - local + blog 검색 지원
// 네이버 개발자센터(developers.naver.com) 키 사용
// type=local (기본값): 지역 검색, type=blog: 블로그 검색
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

  const query = event.queryStringParameters?.query;
  if (!query) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'query parameter required' })
    };
  }

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Naver Search API keys not configured' })
    };
  }

  // [STEP F] type 파라미터: 'local' (기본) 또는 'blog'
  const searchType = event.queryStringParameters?.type || 'local';
  const display = event.queryStringParameters?.display || '5';
  const sort = event.queryStringParameters?.sort || (searchType === 'blog' ? 'sim' : 'random');

  try {
    let url;
    if (searchType === 'blog') {
      // [STEP F] 네이버 블로그 검색 API
      url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
    } else {
      // 기존 로컬 검색 API
      url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
    }

    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Naver ${searchType} Search API error:`, response.status, errText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Naver API error: ${response.status}`, detail: errText })
      };
    }

    const data = await response.json();

    // 블로그 검색: HTML 태그 제거
    if (searchType === 'blog' && data.items && Array.isArray(data.items)) {
      data.items = data.items.map(item => {
        if (item.title) item.title = item.title.replace(/<[^>]*>/g, '');
        if (item.description) item.description = item.description.replace(/<[^>]*>/g, '');
        return item;
      });
    }

    // 로컬 검색: mapx/mapy 변환 + HTML 태그 제거
    if (searchType === 'local' && data.items && Array.isArray(data.items)) {
      // mapx/mapy (카텍 TM128) → WGS84 변환 헬퍼
      const tm128ToWgs84 = (mapx, mapy) => {
        const x = parseInt(mapx) / 10000000;
        const y = parseInt(mapy) / 10000000;
        return { lat: y, lng: x };
      };

      data.items = data.items.map(item => {
        if (item.mapx && item.mapy) {
          const coords = tm128ToWgs84(item.mapx, item.mapy);
          item.wgs84 = coords;
        }
        if (item.title) item.title = item.title.replace(/<[^>]*>/g, '');
        return item;
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error('naver-local-proxy error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
