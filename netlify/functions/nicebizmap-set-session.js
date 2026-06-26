// 나이스비즈맵 세션 "전달 다리" (bridge)
// ─────────────────────────────────────────────────────────────────────────
// Vercel 카카오 직원(브라우저 자동화)이 카카오 OAuth 로 비즈맵에 로그인해 잡은
// sessionId 를 이 함수로 POST 한다. 우리는 그 값을 받아 heartbeat/proxy 가 읽는
// Netlify Blobs 'bizmap-session'/current 에 저장하기만 한다(전달 다리).
//   - 카카오 계정은 자체 비번 relogin() 이 안 먹힘 → 직원이 잡은 세션을 받아야만 한다.
//   - 저장 방식은 heartbeat/relogin/proxy 와 100% 동일(blobSetJSON 패턴 재사용).
//
// [인증 — 절대 규칙]
//   헤더 'X-Bridge-Token' === process.env.BRIDGE_TOKEN 일 때만 동작.
//   불일치/누락 → 401. BRIDGE_TOKEN 미설정이면 "안전하게 거부"(누구나 세션 덮어쓰기 차단).
//
// [보안 — 절대 규칙]
//   sessionId 전체를 로그/응답에 출력 금지. 앞 4자만 마스킹.
//   토큰도 로그에 안 남긴다.
// ─────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ── Netlify Blobs 헬퍼 (동적 import: v10 은 ESM, 이 파일은 CommonJS) ──
// heartbeat.js / relogin.js / proxy.js 와 동일 패턴. 실패해도 throw 하지 않음.
// ★ v10 + 레거시(V1 Lambda) 함수 핵심: getStore('이름') 만 부르면 컨텍스트(siteID/token)가
//   "자동 주입되지 않아" MissingBlobsEnvironmentError 로 throw → 지금까지 항상 null 폴백이었다.
//   해결: 핸들러 event 를 connectLambda(event) 로 먼저 넘겨 컨텍스트를 깔아준다(공식 V1 방식).
//   connectLambda 가 없거나 실패하면 수동 siteID/token(env)로 폴백한다.
//   진단용으로 마지막 실패 사유를 모듈 변수에 담는다(비밀 미노출).
let LAST_BLOB_ERROR = null;
async function getBlobStore(event) {
  LAST_BLOB_ERROR = null;
  let getStore, connectLambda;
  try {
    ({ getStore, connectLambda } = await import('@netlify/blobs'));
  } catch (e) {
    LAST_BLOB_ERROR = 'import_failed:' + e.message;
    console.warn('[nicebizmap-set-session] @netlify/blobs import 실패:', e.message);
    return null;
  }
  // 1순위: connectLambda(event) 로 V1 함수에 Blobs 컨텍스트 주입 후 getStore
  try {
    if (typeof connectLambda === 'function' && event) connectLambda(event);
    return getStore('bizmap-session');
  } catch (e) {
    LAST_BLOB_ERROR = 'auto_context:' + e.message;
    console.warn('[nicebizmap-set-session] connectLambda/getStore 자동 컨텍스트 실패:', e.message);
  }
  // 2순위: 수동 siteID/token (env) — 자동 컨텍스트가 안 될 때만
  try {
    const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) {
      return getStore({ name: 'bizmap-session', siteID, token });
    }
    LAST_BLOB_ERROR = (LAST_BLOB_ERROR || 'no_context') + '; no_manual_siteid_token';
  } catch (e) {
    LAST_BLOB_ERROR = 'manual_context:' + e.message;
    console.warn('[nicebizmap-set-session] 수동 siteID/token getStore 실패:', e.message);
  }
  return null;
}
async function blobSetJSON(store, key, value) {
  if (!store) return false;
  try {
    await store.setJSON(key, value);
    return true;
  } catch (e) {
    console.warn('[nicebizmap-set-session] Blobs set 실패(무시):', key, e.message);
    return false;
  }
}

function mask(sessionId) {
  return (sessionId && sessionId.length >= 4) ? (sessionId.slice(0, 4) + '****') : '****';
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Token',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // POST 전용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, reason: 'method_not_allowed' })
    };
  }

  // ── 인증: 브리지 토큰 ──
  // 미설정이면 안전하게 거부(누구나 세션 덮어쓰기 차단). 헤더는 대소문자 무시 조회.
  const expected = process.env.BRIDGE_TOKEN;
  if (!expected) {
    console.warn('[nicebizmap-set-session] BRIDGE_TOKEN 미설정 → 안전 거부(401)');
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, reason: 'bridge_token_not_configured' })
    };
  }
  const headers = event.headers || {};
  const provided = headers['x-bridge-token'] || headers['X-Bridge-Token'] || headers['X-BRIDGE-TOKEN'] || '';
  if (provided !== expected) {
    console.warn('[nicebizmap-set-session] 브리지 토큰 불일치 → 401');
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, reason: 'unauthorized' })
    };
  }

  // ── body 파싱 + sessionId UUID 검증 ──
  let sessionId = null;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    sessionId = body && body.sessionId ? String(body.sessionId).trim() : null;
  } catch (e) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, reason: 'invalid_json' })
    };
  }
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, reason: 'invalid_session_id' })
    };
  }

  // ── 저장: current 갱신 + expired 정리 (heartbeat/relogin 와 동일 패턴) ──
  const store = await getBlobStore(event); // ★ event 전달: connectLambda 로 컨텍스트 주입
  const saved = await blobSetJSON(store, 'current', {
    sessionId,
    updatedAt: new Date().toISOString(),
    source: 'kakao-oauth'
  });
  await blobSetJSON(store, 'expired', { value: false, at: new Date().toISOString() });

  console.log(`[nicebizmap-set-session] 세션 수신·저장(set=${saved}) sessionId=${mask(sessionId)} source=kakao-oauth`);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok: true,
      sessionId: mask(sessionId),  // 마스킹: 앞 4자만
      savedToBlobs: saved,
      source: 'kakao-oauth',
      // 진단용(비밀 미노출): Blobs 저장 실패 시 실제 사유. 성공이면 null.
      blobError: saved ? null : (LAST_BLOB_ERROR || null)
    })
  };
};
