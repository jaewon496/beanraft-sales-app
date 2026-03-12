// Kakao Local API proxy (CORS bypass)
// Supports: address, keyword, category search
// Usage:
//   /api/kakao-proxy?type=address&query=...
//   /api/kakao-proxy?type=keyword&query=...&size=N
//   /api/kakao-proxy?type=category&category_group_code=CE7&x=...&y=...&radius=...&page=...&size=...&sort=...
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
  const searchType = params.type || 'address';

  const kakaoKey = process.env.KAKAO_REST_KEY || process.env.VITE_KAKAO_REST_KEY || '9e149576620513dc3283894501c49ab7';
  if (!kakaoKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Kakao REST API key not configured' })
    };
  }

  try {
    let url;

    if (searchType === 'address') {
      const query = params.query;
      if (!query) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'query parameter required for address search' })
        };
      }
      url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`;

    } else if (searchType === 'keyword') {
      const query = params.query;
      if (!query) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'query parameter required for keyword search' })
        };
      }
      const size = params.size || '15';
      url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${size}`;

    } else if (searchType === 'category') {
      const categoryCode = params.category_group_code;
      const x = params.x;
      const y = params.y;
      if (!categoryCode || !x || !y) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'category_group_code, x, y parameters required for category search' })
        };
      }
      const radius = params.radius || '1000';
      const page = params.page || '1';
      const size = params.size || '15';
      const sort = params.sort || 'distance';
      url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${categoryCode}&x=${x}&y=${y}&radius=${radius}&page=${page}&size=${size}&sort=${sort}`;

    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Unknown search type: ${searchType}. Use address, keyword, or category.` })
      };
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${kakaoKey}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Kakao ${searchType} API error:`, response.status, errText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Kakao API error: ${response.status}`, detail: errText })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error('kakao-proxy error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
