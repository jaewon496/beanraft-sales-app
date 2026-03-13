// OpenUB API 프록시
// 건물별 매출 데이터 조회용
// OpenUB API는 인증 없이 익명으로 호출 가능 (토큰 불필요)

export async function handler(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { endpoint, body } = JSON.parse(event.body);

    // 허용된 엔드포인트만 프록시 (보안)
    const ALLOWED_ENDPOINTS = ['bd/hash', 'gp', 'bd/sales'];
    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Endpoint not allowed: ${endpoint}` })
      };
    }

    const response = await fetch(`https://api.openub.com/v2/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://openub.com',
        'Referer': 'https://openub.com/'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'api_error',
          status: response.status,
          message: `OpenUB API returned ${response.status}`
        })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.warn('OpenUB proxy error:', error.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}
