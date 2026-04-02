// OpenUB 세션 유지용 Heartbeat 함수
// netlify.toml에서 스케줄 설정: */5 * * * * (5분마다)

const handler = async (event) => {
  const token = process.env.OPENUB_ACCESS_TOKEN || '';

  if (!token) {
    console.log('[openub-heartbeat] No token set');
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'no token' }) };
  }

  try {
    // 1. heartbeat 호출 (세션 유지)
    const heartbeatRes = await fetch('https://api.openub.com/v2/heartbeat', {
      method: 'GET',
      headers: {
        'Content-Type': 'text/plain',
        'Accept-Encoding': 'gzip',
        'Origin': 'https://www.openub.com',
        'Referer': 'https://www.openub.com/',
        'Access-Token': token
      }
    });

    const heartbeatStatus = heartbeatRes.status;
    console.log(`[openub-heartbeat] heartbeat: ${heartbeatStatus}`);

    // 2. bd/sales 간단 테스트 (토큰 유효성 확인)
    const testRes = await fetch('https://api.openub.com/v2/bd/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip',
        'Origin': 'https://www.openub.com',
        'Referer': 'https://www.openub.com/',
        'Access-Token': token
      },
      body: JSON.stringify({ login: true, rdnu: '1168010100100010001', category: 'A0:B0:C0:D0:F0:G0' })
    });

    const testStatus = testRes.status;
    console.log(`[openub-heartbeat] bd/sales test: ${testStatus}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: testStatus === 200,
        heartbeat: heartbeatStatus,
        bdSales: testStatus,
        timestamp: new Date().toISOString()
      })
    };
  } catch (e) {
    console.error('[openub-heartbeat] error:', e.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};

exports.handler = handler;
