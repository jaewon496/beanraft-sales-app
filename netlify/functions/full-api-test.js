// 영업모드 전체 API + AI 테스트
// 사용법: https://beancraft-sales.netlify.app/.netlify/functions/full-api-test?region=강남역&geminiKey=YOUR_KEY

export async function handler(event, context) {
  const region = event.queryStringParameters?.region || "강남역";
  const geminiKey = event.queryStringParameters?.geminiKey || null;
  
  const results = {
    timestamp: new Date().toISOString(),
    testRegion: region,
    geminiKeyProvided: !!geminiKey,
    apis: {},
    aiCharacter: {}
  };

  // ═══════════════════════════════════════════════════════════
  // 1. Gemini AI 테스트 (URL 파라미터로 키 입력)
  // ═══════════════════════════════════════════════════════════
  if (geminiKey) {
    try {
      const geminiPrompt = `당신은 빈크래프트의 창업 컨설턴트입니다.

【빈크래프트 정체성】
- 컨설팅 서비스 (가맹 사업 아님)
- 판단을 대신하지 않음
- 판단할 수 있는 기준과 구조를 설계하는 역할

【절대 원칙】
- 우열 비교가 아닌 구조 차이 설명
- 매출/수익 보장 표현 금지
- 감정적 표현 금지

"${region}" 지역에 카페 창업을 고려하는 고객에게 상권 분석 인사이트를 3문장으로 전달해주세요.`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
          })
        }
      );
      const geminiData = await geminiRes.json();
      const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || null;
      
      results.apis.gemini = {
        status: aiResponse ? "SUCCESS" : "FAILED",
        httpStatus: geminiRes.status,
        response: aiResponse,
        error: geminiData.error || null
      };
      results.aiCharacter = {
        tested: true,
        characterApplied: aiResponse?.includes("구조") || aiResponse?.includes("판단") || aiResponse?.includes("컨설팅"),
        response: aiResponse
      };
    } catch (e) {
      results.apis.gemini = { status: "ERROR", error: e.message };
    }
  } else {
    results.apis.gemini = { 
      status: "SKIPPED", 
      message: "geminiKey 파라미터 필요. 예: ?geminiKey=AIzaSy..." 
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 2. 소상공인 상가정보 API (data.go.kr)
  // ═══════════════════════════════════════════════════════════
  const DATA_GO_KR_KEY = "02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb";
  
  try {
    const storeUrl = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${DATA_GO_KR_KEY}&radius=500&cx=127.0276&cy=37.4979&type=json&numOfRows=10`;
    const storeRes = await fetch(storeUrl);
    const storeData = await storeRes.json();
    
    results.apis.dataGoKr_store = {
      status: storeRes.ok && storeData.body?.items ? "SUCCESS" : "FAILED",
      httpStatus: storeRes.status,
      totalCount: storeData.body?.totalCount || 0,
      sampleData: storeData.body?.items?.slice(0, 2) || null,
      error: storeData.error || null
    };
  } catch (e) {
    results.apis.dataGoKr_store = { status: "ERROR", error: e.message };
  }

  // ═══════════════════════════════════════════════════════════
  // 3. 서울시 열린데이터 API (추정매출)
  // ═══════════════════════════════════════════════════════════
  const SEOUL_KEY = "6d6c71717173656f3432436863774a";
  
  try {
    const seoulUrl = `http://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json/VwsmTrdarSelngQq/1/5/`;
    const seoulRes = await fetch(seoulUrl);
    const seoulData = await seoulRes.json();
    
    results.apis.seoul_sales = {
      status: seoulRes.ok && seoulData.VwsmTrdarSelngQq ? "SUCCESS" : "FAILED",
      httpStatus: seoulRes.status,
      totalCount: seoulData.VwsmTrdarSelngQq?.list_total_count || 0,
      sampleData: seoulData.VwsmTrdarSelngQq?.row?.slice(0, 1) || null,
      error: seoulData.RESULT?.MESSAGE || null
    };
  } catch (e) {
    results.apis.seoul_sales = { status: "ERROR", error: e.message };
  }

  // ═══════════════════════════════════════════════════════════
  // 4. 한국부동산원 R-ONE API (임대료)
  // ═══════════════════════════════════════════════════════════
  const RONE_KEY = "d18d0f03e0344e7f8c1e818a3a07bf95";
  
  try {
    const roneUrl = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${RONE_KEY}&STATBL_ID=T301001&Type=json&pIndex=1&pSize=5`;
    const roneRes = await fetch(roneUrl);
    const roneText = await roneRes.text();
    let roneData;
    try {
      roneData = JSON.parse(roneText);
    } catch {
      roneData = { raw: roneText.substring(0, 300) };
    }
    
    results.apis.rone_rent = {
      status: roneRes.ok ? "SUCCESS" : "FAILED",
      httpStatus: roneRes.status,
      data: roneData
    };
  } catch (e) {
    results.apis.rone_rent = { status: "ERROR", error: e.message };
  }

  // ═══════════════════════════════════════════════════════════
  // 5. 통계청 SGIS API (인구)
  // ═══════════════════════════════════════════════════════════
  const SGIS_SERVICE_ID = "8fddbbb3e014767891c";
  const SGIS_SECRET = "19b90ec81ec74e16ad99";
  
  try {
    const tokenUrl = `https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json?consumer_key=${SGIS_SERVICE_ID}&consumer_secret=${SGIS_SECRET}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    
    if (tokenData.result?.accessToken) {
      results.apis.sgis = {
        status: "SUCCESS",
        tokenObtained: true,
        accessToken: tokenData.result.accessToken.substring(0, 20) + "..."
      };
    } else {
      results.apis.sgis = {
        status: "FAILED",
        error: tokenData.errMsg || "토큰 발급 실패"
      };
    }
  } catch (e) {
    results.apis.sgis = { status: "ERROR", error: e.message };
  }

  // ═══════════════════════════════════════════════════════════
  // 6. 기상청 API
  // ═══════════════════════════════════════════════════════════
  try {
    const today = new Date();
    const baseDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    const weatherUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${DATA_GO_KR_KEY}&numOfRows=10&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=0500&nx=60&ny=127`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();
    
    results.apis.weather = {
      status: weatherRes.ok && weatherData.response?.body ? "SUCCESS" : "FAILED",
      httpStatus: weatherRes.status,
      data: weatherData.response?.body?.items?.item?.slice(0, 2) || null,
      error: weatherData.response?.header?.resultMsg || null
    };
  } catch (e) {
    results.apis.weather = { status: "ERROR", error: e.message };
  }

  // ═══════════════════════════════════════════════════════════
  // 결과 요약
  // ═══════════════════════════════════════════════════════════
  const apiResults = Object.values(results.apis).filter(a => a.status !== "SKIPPED");
  const summary = {
    total: apiResults.length,
    success: apiResults.filter(a => a.status === "SUCCESS").length,
    failed: apiResults.filter(a => a.status !== "SUCCESS").length,
    aiCharacterWorking: results.aiCharacter.tested && results.aiCharacter.response
  };
  results.summary = summary;

  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(results, null, 2)
  };
}
