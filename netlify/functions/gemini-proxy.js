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
    const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
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
    const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
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
          // Pro 모델은 응답이 느릴 수 있어 타임아웃 확장
          // 호출자가 agent.timeout으로 명시적 지정 가능 (최대 24000ms — Netlify 26초 제한 내)
          let agentTimeout = agent.model === 'pro' ? 22000 : 15000;
          if (typeof agent.timeout === 'number' && agent.timeout > 0) {
            agentTimeout = Math.min(agent.timeout, 24000);
          }
          const timeoutId = setTimeout(() => controller.abort(), agentTimeout);
          try {
            // 에이전트별 모델 선택 (기본 flash, pro 지정 가능)
            const modelName = agent.model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
            const agentTemp = agent.temperature || 0.7;
            // Pro 모델은 thinkingBudget 최소 128 필수 (0이면 에러)
            let agentThinking = agent.thinkingBudget != null ? agent.thinkingBudget : (agent.grounding ? 1024 : 0);
            if (agent.model === 'pro' && agentThinking < 128) agentThinking = 8192;
            const reqBody = {
              contents: [{ parts: [{ text: agent.prompt }] }],
              generationConfig: {
                temperature: agentTemp,
                maxOutputTokens: agent.maxOutputTokens || 1000,
                ...(agent.grounding ? {} : { responseMimeType: 'application/json' }),
                thinkingConfig: { thinkingBudget: agentThinking },
              }
            };
            // grounding: Google Search 활성화 (Gemini 2.5+ 새 API)
            if (agent.grounding) {
              reqBody.tools = [{ google_search: {} }];
            }
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody),
                signal: controller.signal
              }
            );
            clearTimeout(timeoutId);
            // 429 에러 시 3초 대기 후 1회 재시도
            if (res.status === 429) {
              await new Promise(r => setTimeout(r, 3000));
              const retryController = new AbortController();
              const retryTimeout = setTimeout(() => retryController.abort(), 12000);
              const retryRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(reqBody),
                  signal: retryController.signal
                }
              );
              clearTimeout(retryTimeout);
              if (!retryRes.ok) {
                return { id: agent.id, success: false, error: `HTTP ${retryRes.status} (retry after 429)` };
              }
              const retryData = await retryRes.json();
              const retryParts = retryData.candidates?.[0]?.content?.parts || [];
              const retryText = retryParts.map(p => p.text || '').join('');
              const retryGroundingMeta = retryData.candidates?.[0]?.groundingMetadata || null;
              return { id: agent.id, success: true, text: retryText, groundingMeta: retryGroundingMeta || undefined };
            }
            if (!res.ok) {
              return { id: agent.id, success: false, error: `HTTP ${res.status}` };
            }
            const data = await res.json();
            // 모든 parts의 텍스트를 합침 (Gemini 2.5가 여러 파트로 분할 응답하는 경우 대비)
            const parts = data.candidates?.[0]?.content?.parts || [];
            const text = parts.map(p => p.text || '').join('');
            // grounding 메타데이터 포함
            const groundingMeta = data.candidates?.[0]?.groundingMetadata || null;
            return { id: agent.id, success: true, text, groundingMeta: groundingMeta || undefined };
          } catch (err) {
            clearTimeout(timeoutId);
            return { id: agent.id, success: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
          }
        };

        // Promise.allSettled 병렬 호출: 모든 에이전트 동시 실행, 일부 실패해도 성공한 것 반환
        const settled = await Promise.allSettled(agents.map(agent => callAgent(agent)));
        const results = {};
        settled.forEach((s) => {
          if (s.status === 'fulfilled') {
            const r = s.value;
            results[r.id] = { success: r.success, text: r.text || undefined, error: r.error || undefined, groundingMeta: r.groundingMeta || undefined };
          } else {
            // Promise 자체가 reject된 경우 (callAgent 내부에서 catch하므로 거의 발생 안 함)
            results['unknown'] = { success: false, error: s.reason?.message || 'unknown error' };
          }
        });
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

      const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

      // ── 전체 실행 예산 24초 (Netlify 함수 26초 제한 내, 재시도 포함해도 초과 금지) ──
      // 단일 호출 1차 시도 → upstream이 429/503을 "즉시(=fast-fail)" 주면 남은 예산 안에서 1회만 빠르게 재시도.
      // 타임아웃(AbortError)이나 504 등은 이미 예산을 소진한 것이므로 재시도하지 않는다.
      const OVERALL_BUDGET_MS = 24000; // 1차 시도 최대 대기 (26초 한도 내 2초 여유)
      const RETRY_MIN_BUDGET_MS = 3000; // 남은 예산이 이만큼은 있어야 재시도 (없으면 그냥 에러)
      const startedAt = Date.now();

      const callOnce = async (timeoutMs) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const text = await response.text();
          return { status: response.status, body: text };
        } finally {
          clearTimeout(timeoutId);
        }
      };

      // 1차 시도
      let result = await callOnce(OVERALL_BUDGET_MS);

      // upstream 일시 혼잡(429/503)이고 남은 예산이 충분하면 1회만 빠른 재시도
      if (result.status === 429 || result.status === 503) {
        const elapsed = Date.now() - startedAt;
        const remaining = OVERALL_BUDGET_MS - elapsed;
        if (remaining >= RETRY_MIN_BUDGET_MS) {
          // 짧은 백오프(남은 예산의 일부, 최대 1초) 후 남은 예산 안에서 재시도
          const backoff = Math.min(1000, Math.max(0, Math.floor(remaining * 0.15)));
          if (backoff > 0) await new Promise(r => setTimeout(r, backoff));
          const retryBudget = OVERALL_BUDGET_MS - (Date.now() - startedAt);
          if (retryBudget >= 1000) {
            // 재시도 결과를 채택(성공이면 정상 응답, 여전히 429/503이어도 최신 상태 반환)
            result = await callOnce(retryBudget);
          }
        }
      }

      return { statusCode: result.status, headers, body: result.body };
    } catch (error) {
      // AbortController 타임아웃 시 더 명확한 에러 메시지
      if (error.name === 'AbortError') {
        return { statusCode: 504, headers, body: JSON.stringify({ error: 'Gemini API 응답 시간 초과. 프롬프트를 줄이거나 maxOutputTokens를 낮추세요.' }) };
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
}
