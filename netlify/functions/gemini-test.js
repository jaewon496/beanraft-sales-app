// Gemini API 테스트 엔드포인트
// 배포 후 https://beancraft-sales.netlify.app/.netlify/functions/gemini-test 로 접근

export async function handler(event, context) {
  const GEMINI_API_KEY = "AIzaSyAXB9YN7_Z6tRG5xTLyUYqaxUD83duiYKc";
  const MODEL = "gemini-2.5-flash";
  
  const testPrompt = "안녕하세요. 테스트입니다. '빈크래프트 AI 테스트 성공! 현재 시간은 ' 다음에 현재 시간을 말해주세요.";
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: testPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 200
          }
        })
      }
    );
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const data = await response.json();
    
    // 결과 파싱
    let aiResponse = "";
    let status = "unknown";
    
    if (response.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      aiResponse = data.candidates[0].content.parts[0].text;
      status = "SUCCESS";
    } else if (data.error) {
      aiResponse = data.error.message || JSON.stringify(data.error);
      status = `ERROR_${response.status}`;
    } else {
      aiResponse = JSON.stringify(data);
      status = `UNEXPECTED_${response.status}`;
    }
    
    const result = {
      test: "Gemini API Test",
      timestamp: new Date().toISOString(),
      model: MODEL,
      apiKey: GEMINI_API_KEY.substring(0, 10) + "...",
      httpStatus: response.status,
      status: status,
      responseTimeMs: responseTime,
      prompt: testPrompt,
      aiResponse: aiResponse,
      rawResponse: data
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result, null, 2)
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        test: "Gemini API Test",
        timestamp: new Date().toISOString(),
        model: MODEL,
        status: "FETCH_ERROR",
        error: error.message,
        stack: error.stack
      }, null, 2)
    };
  }
}
