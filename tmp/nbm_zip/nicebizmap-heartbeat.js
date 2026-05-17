// 나이스비즈맵 세션 유지용 heartbeat
const https = require('https');

exports.handler = async (event) => {
  const sessionId = process.env.NICEBIZMAP_SESSION_ID;
  if (!sessionId) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'no session id' }) };
  }

  const cookie = 'SESSION=' + Buffer.from(sessionId).toString('base64');

  return new Promise((resolve) => {
    const req = https.get({
      hostname: 'm.nicebizmap.co.kr',
      path: '/api/auth/session',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          console.log('[nicebizmap-heartbeat]', j.success ? 'session alive' : 'session expired', j.data?.loginId || '');
          resolve({
            statusCode: 200,
            body: JSON.stringify({ ok: j.success, valid: j.data?.valid, loginId: j.data?.loginId })
          });
        } catch(e) {
          resolve({ statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) });
        }
      });
    });
    req.on('error', e => resolve({ statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) }));
    req.end();
  });
};

exports.config = {
  schedule: "*/5 * * * *"
};
