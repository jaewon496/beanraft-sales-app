// Gemini API 테스트용 프록시 (App.jsx 변경 없음, 테스트 전용)
export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET 요청 - 키 상태 + API 작동 확인
  if (event.httpMethod === 'GET') {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ 
          status: 'error', 
          message: 'GEMINI_API_KEY 환경변수 없음',
          hint: 'Netlify 환경변수에 GEMINI_API_KEY 또는 VITE_GEMINI_API_KEY 설정 필요'
        })
      };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: '안녕' }] }],
            generationConfig: { maxOutputTokens: 50 }
          })
        }
      );

      const data = await response.text();
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          status: response.ok ? 'success' : 'fail',
          httpStatus: response.status,
          keyPrefix: GEMINI_API_KEY.substring(0, 10) + '...',
          response: data.substring(0, 500)
        })
      };
    } catch (error) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ status: 'error', message: error.message })
      };
    }
  }

  // POST 요청 - 실제 프록시
  if (event.httpMethod === 'POST') {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    try {
      const body = JSON.parse(event.body || '{}');
      const { contents, generationConfig } = body;
      if (!contents) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'contents 필수' }) };
      }

      const requestBody = { contents };
      if (generationConfig) requestBody.generationConfig = generationConfig;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      const data = await response.text();
      return { statusCode: response.status, headers, body: data };
    } catch (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
}
