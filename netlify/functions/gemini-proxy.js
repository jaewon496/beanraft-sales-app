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

      // ═══ multi-agent: 여러 프롬프트를 서버사이드 병렬 호출 ═══
      if (body.action === 'multi-agent') {
        const agents = body.agents || [];
        if (!agents.length) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'agents 배열 필수' }) };
        }

        const callAgent = async (agent) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000);
          try {
            const reqBody = {
              contents: [{ parts: [{ text: agent.prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: agent.maxOutputTokens || 1000,
                ...(agent.grounding ? {} : { responseMimeType: 'application/json' }),
                thinkingConfig: { thinkingBudget: 0 }
              }
            };
            // grounding: Google Search 활성화 (Gemini 2.5+ 새 API)
            if (agent.grounding) {
              reqBody.tools = [{ google_search: {} }];
              // grounding 사용 시 thinkingBudget 제거 (호환성)
              delete reqBody.generationConfig.thinkingConfig;
            }
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody),
                signal: controller.signal
              }
            );
            clearTimeout(timeoutId);
            if (!res.ok) {
              return { id: agent.id, success: false, error: `HTTP ${res.status}` };
            }
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            // grounding 메타데이터 포함
            const groundingMeta = data.candidates?.[0]?.groundingMetadata || null;
            return { id: agent.id, success: true, text, groundingMeta: groundingMeta || undefined };
          } catch (err) {
            clearTimeout(timeoutId);
            return { id: agent.id, success: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
          }
        };

        const agentResults = await Promise.all(agents.map(callAgent));
        const results = {};
        agentResults.forEach(r => { results[r.id] = { success: r.success, text: r.text || undefined, error: r.error || undefined, groundingMeta: r.groundingMeta || undefined }; });
        return { statusCode: 200, headers, body: JSON.stringify({ results }) };
      }

      const { contents, generationConfig, systemInstruction, tools } = body;
      if (!contents) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'contents 필수' }) };
      }

      const requestBody = {
        contents,
        ...(generationConfig && { generationConfig }),
        ...(systemInstruction && { systemInstruction }),
        ...(tools && { tools }),
      };

      // 25초 타임아웃 (Netlify 함수 26초 제한 내)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);

      const data = await response.text();
      return { statusCode: response.status, headers, body: data };
    } catch (error) {
      // AbortController 타임아웃 시 더 명확한 에러 메시지
      if (error.name === 'AbortError') {
        return { statusCode: 504, headers, body: JSON.stringify({ error: 'Gemini API 응답 시간 초과 (25초). 프롬프트를 줄이거나 maxOutputTokens를 낮추세요.' }) };
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
}
