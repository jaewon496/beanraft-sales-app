// 나이스비즈맵 세션 자동 재로그인 "직원"
// ─────────────────────────────────────────────────────────────────────────
// 세션이 만료되면(프록시가 code 1002/9999 "로그인 해주세요" 반환) 지금까지는
// 사람이 손으로 다시 로그인했다. 이 함수가 그 사람 역할을 대신한다.
//
// [로그인 엔드포인트 — 비즈맵 자체 코드에서 역추적 확정]
//   근거: /assets/js/auth/zinidata-auth-v1.js submitLogin() (라인 149~162)
//     "API 호출 (Spring Security 호환을 위해 form-urlencoded 형태로 전송)"
//     url: '/api/auth/login', method: 'POST',
//     contentType: 'application/x-www-form-urlencoded',
//     data: { loginId, password, rememberMe, returnUrl }
//   라이브 프로브 확인: 잘못된 자격증명 → 401 {"success":false,"message":"아이디 또는 비밀번호를 확인해주세요."}
//   성공 시 응답 봉투: { success:true, data:{ sessionId, loginId, memNo, ... } } (handleLoginSuccess 라인 191~206)
//     + Set-Cookie 로 SESSION=Base64(sessionId) 회전 발급(스프링 세션).
//
// [세션 보관 — 기존 heartbeat/proxy 와 100% 동일한 방식 재사용]
//   Netlify Blobs store 'bizmap-session', 키 'current' = { sessionId, updatedAt, source }.
//   여기선 source:'relogin' 으로 기록. heartbeat/proxy 의 resolveSession 이 그대로 읽어간다.
//   로컬/미배포에선 Blobs 컨텍스트가 없어 getStore/set 이 throw → try/catch 로 감싸 경고만(폴백).
//
// [보안 — 절대 규칙]
//   자격증명은 env(NICEBIZMAP_LOGIN_ID / NICEBIZMAP_LOGIN_PW)에서만 읽는다. 하드코딩 금지.
//   비밀번호는 로그/응답에 절대 출력하지 않는다(마스킹).
// ─────────────────────────────────────────────────────────────────────────

const https = require('https');
const qs = require('querystring');

const LOGIN_HOST = 'm.nicebizmap.co.kr';
const LOGIN_PATH = '/api/auth/login';
const LOGIN_ENDPOINT = `https://${LOGIN_HOST}${LOGIN_PATH}`;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ── Netlify Blobs 헬퍼 (동적 import: v10 은 ESM, 이 파일은 CommonJS) ──
// heartbeat.js / proxy.js 와 동일 패턴. 실패해도 throw 하지 않음.
async function getBlobStore() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('bizmap-session');
  } catch (e) {
    console.warn('[nicebizmap-relogin] Blobs getStore 불가(로컬/미배포 추정) → env 폴백:', e.message);
    return null;
  }
}
async function blobSetJSON(store, key, value) {
  if (!store) return false;
  try {
    await store.setJSON(key, value);
    return true;
  } catch (e) {
    console.warn('[nicebizmap-relogin] Blobs set 실패(무시):', key, e.message);
    return false;
  }
}

// Set-Cookie 배열에서 SESSION 값 → Base64 디코딩 → UUID 형태면 채택 (heartbeat 와 동일)
function extractSessionIdFromSetCookie(setCookie) {
  if (!Array.isArray(setCookie)) return null;
  for (const c of setCookie) {
    const m = /(?:^|;|\s)SESSION=([^;]+)/i.exec(c);
    if (m && m[1]) {
      try {
        const decoded = Buffer.from(decodeURIComponent(m[1].trim()), 'base64').toString('utf-8');
        if (UUID_RE.test(decoded)) return decoded;
      } catch (e) { /* base64 아님 → 무시 */ }
    }
  }
  return null;
}

// form-urlencoded POST → { status, json, setCookie }
function postLogin(loginId, password, rememberMe) {
  return new Promise((resolve) => {
    const postBody = qs.stringify({
      loginId,
      password,
      rememberMe: rememberMe ? 'true' : 'false',
      returnUrl: ''
    });
    const req = https.request({
      hostname: LOGIN_HOST,
      port: 443,
      path: LOGIN_PATH,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://m.nicebizmap.co.kr/auth/login',
        'Origin': 'https://m.nicebizmap.co.kr',
        'Content-Length': Buffer.byteLength(postBody)
      },
      timeout: 15000
    }, (res) => {
      const setCookie = res.headers['set-cookie'] || [];
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch (e) { json = null; }
        resolve({ status: res.statusCode, json, setCookie });
      });
    });
    req.on('error', e => resolve({ status: 0, json: null, setCookie: [], error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, json: null, setCookie: [], error: 'timeout' }); });
    req.write(postBody);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 핵심 함수: 로그인 → sessionId 추출 → Blobs current 저장.
// heartbeat / proxy 에서 import 해 직접 호출한다(자동 트리거 배선).
// 반환: { ok, sessionId?, reason?, loginEndpoint, savedToBlobs }
//   - 성공: { ok:true, sessionId, loginEndpoint, savedToBlobs }
//   - 실패: { ok:false, reason, loginEndpoint }  (비밀번호는 절대 안 실음)
// preStore: 이미 열어둔 Blobs store 를 넘기면 재사용(없으면 내부에서 연다).
// ─────────────────────────────────────────────────────────────────────────
async function relogin(preStore) {
  const loginId = process.env.NICEBIZMAP_LOGIN_ID;
  const password = process.env.NICEBIZMAP_LOGIN_PW;
  // 자격증명 미설정 → 비번 노출 없이 사유만
  if (!loginId || !password) {
    console.warn('[nicebizmap-relogin] 자격증명 env 없음 (NICEBIZMAP_LOGIN_ID/PW)');
    return { ok: false, reason: 'no_credentials', loginEndpoint: LOGIN_ENDPOINT };
  }

  console.log(`[nicebizmap-relogin] 재로그인 시도 loginId=${loginId} (pw=***)`);
  const res = await postLogin(loginId, password, true);

  if (res.error) {
    console.warn('[nicebizmap-relogin] 네트워크 오류:', res.error);
    return { ok: false, reason: 'network_error:' + res.error, loginEndpoint: LOGIN_ENDPOINT };
  }

  // sessionId 추출: ① 응답 봉투 data.sessionId ② Set-Cookie SESSION 디코딩 (둘 다 시도)
  const fromBody = res.json && res.json.data && res.json.data.sessionId;
  const fromCookie = extractSessionIdFromSetCookie(res.setCookie);
  let sessionId = null;
  if (fromBody && UUID_RE.test(String(fromBody))) sessionId = String(fromBody);
  else if (fromCookie) sessionId = fromCookie;

  // 성공 판정: success:true 이고 UUID 형 sessionId 확보
  const loginOk = !!(res.json && res.json.success === true);
  if (loginOk && sessionId) {
    const store = preStore || await getBlobStore();
    const saved = await blobSetJSON(store, 'current', {
      sessionId,
      updatedAt: new Date().toISOString(),
      source: 'relogin'
    });
    // 정상 응답을 받았으니 expired 플래그도 정리(heartbeat 와 동기화)
    await blobSetJSON(store, 'expired', { value: false, at: new Date().toISOString() });
    console.log(`[nicebizmap-relogin] 재로그인 성공 → Blobs current 갱신(set=${saved}) sessionId=${sessionId.slice(0, 4)}... loginId=${res.json.data?.loginId || ''}`);
    return { ok: true, sessionId, loginEndpoint: LOGIN_ENDPOINT, savedToBlobs: saved };
  }

  // 실패: 사유만(비번 미노출). 자격증명 오류/카카오전용계정 등 → 서버 메시지 그대로(비번 아님)
  const reason = (res.json && res.json.message)
    ? res.json.message
    : (res.status === 401 ? 'invalid_credentials' : ('login_failed_http_' + res.status));
  console.warn(`[nicebizmap-relogin] 재로그인 실패 status=${res.status} reason=${reason} (sessionId추출=${sessionId ? '있음' : '없음'})`);
  return { ok: false, reason, loginEndpoint: LOGIN_ENDPOINT };
}

// ─────────────────────────────────────────────────────────────────────────
// HTTP 핸들러 (테스트/수동 호출용): GET 으로 바로 부를 수 있다.
//   응답: { ok, sessionId(마스킹: 앞4자만), reason, loginEndpoint }
// ─────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const r = await relogin();
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok: r.ok,
      sessionId: r.ok && r.sessionId ? (r.sessionId.slice(0, 4) + '****') : null, // 마스킹
      reason: r.reason || null,
      loginEndpoint: r.loginEndpoint,
      savedToBlobs: r.savedToBlobs || false
    })
  };
};

// heartbeat / proxy 가 import 해 자동 호출하는 진입점
exports.relogin = relogin;
