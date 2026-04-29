// OpenUB 세션 유지용 Heartbeat 함수 (개선판 v3)
// 목적: 토큰 만료 방지 + 즉시 만료 감지
// 스케줄: */5 * * * * (5분마다, netlify.toml 참조)
//
// 발견 사항:
//   - bd/hash: 토큰 검증 안 함 (항상 200) → 세션 키프얼라이브 무용지물
//   - bd/sales + login:false: 빈 응답, 토큰 검증 안 함
//   - bd/sales + login:true: 토큰 검증 → 200(유효) / 401(만료)
//   - heartbeat 엔드포인트: 404 (오픈업 측 제거됨)
//
// 전략:
//   1. bd/sales + login:true + 실제 rdnu 호출 → 토큰 활성 유지 + 검증
//   2. 401 응답 시 크리티컬 로그 (토큰 만료 즉시 알림)
//   3. 200 응답 시 정상 (토큰 살아있음)
//
// 토큰 갱신 방법 (만료 시):
//   1. 카카오 로그인: seooul496@naver.com / dlwodnjs!23
//   2. www.openub.com 접속 → 건물 클릭
//   3. DevTools Network → bd/sales 요청 → Access-Token 헤더 복사
//   4. Netlify 환경변수 OPENUB_ACCESS_TOKEN 갱신 → 재배포

// 검증용 RDNU (서울 성동구 금호동 - 실제 데이터 있는 건물)
const TEST_RDNU = 'MqQxSEy1f9-CSv';

const handler = async (event) => {
  const token = process.env.OPENUB_ACCESS_TOKEN || '';
  const startTime = Date.now();

  if (!token) {
    console.error('[openub-heartbeat] CRITICAL: OPENUB_ACCESS_TOKEN not set');
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        reason: 'no_token',
        timestamp: new Date().toISOString()
      })
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip',
    'Origin': 'https://www.openub.com',
    'Referer': 'https://www.openub.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'Access-Token': token
  };

  const result = {
    timestamp: new Date().toISOString(),
    tokenPrefix: token.slice(0, 8),
    ok: false,
    tokenAlive: false,
    storeCount: 0,
    elapsedMs: 0
  };

  try {
    const res = await fetch('https://api.openub.com/v2/bd/sales', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        login: true,
        rdnu: TEST_RDNU,
        category: 'A0:B0:C0:D0:F0:G0'
      })
    });

    result.status = res.status;
    result.elapsedMs = Date.now() - startTime;

    if (res.status === 200) {
      const data = await res.json();
      result.ok = true;
      result.tokenAlive = true;
      result.storeCount = (data?.result?.stores || []).length;
      console.log(`[openub-heartbeat] OK - token alive, ${result.storeCount} stores (${result.elapsedMs}ms)`);
    } else if (res.status === 401) {
      result.tokenAlive = false;
      result.error = 'TOKEN_EXPIRED';
      console.error('==========================================');
      console.error('[openub-heartbeat] CRITICAL: TOKEN EXPIRED');
      console.error('[openub-heartbeat] Re-issue via:');
      console.error('  1. Login: seooul496@naver.com / dlwodnjs!23');
      console.error('  2. Visit www.openub.com → click building');
      console.error('  3. Copy Access-Token from DevTools Network');
      console.error('  4. Update Netlify env: OPENUB_ACCESS_TOKEN');
      console.error('==========================================');
    } else {
      result.error = `UNEXPECTED_STATUS_${res.status}`;
      console.error(`[openub-heartbeat] Unexpected status: ${res.status}`);
    }
  } catch (e) {
    result.error = e.message;
    result.elapsedMs = Date.now() - startTime;
    console.error('[openub-heartbeat] Exception:', e.message);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};

exports.handler = handler;
