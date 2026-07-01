// 나이스비즈맵 세션 유지용 heartbeat (강한 버전)
// - 세션 읽기: Netlify Blobs bizmap-session/current.sessionId 우선 → 없거나 에러나면 env NICEBIZMAP_SESSION_ID 폴백
// - STEP1: GET /api/auth/session (상태 확인)
// - STEP2(★핵심·복원): GET check-analyzability (활동 → idle TTL 연장, 한도 0차감)
// - Set-Cookie 회전 캡처: 새 SESSION 쿠키 오면 Blobs bizmap-session/current 갱신
// - 만료 감지: success:false 또는 code 1002/9999 → Blobs bizmap-session/expired 갱신
// scheduled function 이므로 "배포본"에서만 5분마다 실행됨 (로컬/미배포 코드는 안 돔)
// ★ 저장소 교체(RTDB→Netlify Blobs, 2026-06-15): RTDB 쓰기가 401(인증)로 막혀 회전/만료가 무동작.
//   Blobs 는 함수 내장 저장소(siteID/token 자동) → 별도 인증 불필요 → 401 원천 해소.
//   단 Blobs 는 "배포본"에서만 컨텍스트가 있고, 로컬/미배포에선 getStore/get/set 이 throw → try/catch 로 env 폴백.
const https = require('https');

// ── Netlify Blobs 헬퍼 (동적 import: v10 은 ESM, 이 파일은 CommonJS) ──
// store 'bizmap-session', 키 current={sessionId,updatedAt,source}, expired={value,at}
// 실패해도 절대 throw 하지 않음 (heartbeat 가 죽으면 안 됨)
// ★ v10 + 레거시(V1 Lambda) 함수 핵심: getStore('이름') 만 부르면 컨텍스트(siteID/token)가
//   "자동 주입되지 않아" MissingBlobsEnvironmentError 로 throw → 지금까지 항상 null 폴백(=env)이었다.
//   해결: 핸들러 event 를 connectLambda(event) 로 먼저 넘겨 컨텍스트를 깔아준다(공식 V1 방식).
//   ※ scheduled function 의 event 에도 blobs/x-nf-site-id 가 들어온다(배포본 한정). 로컬/미배포면 없음 → 폴백.
//   connectLambda 가 없거나 실패하면 수동 siteID/token(env)로 폴백한다.
let LAST_BLOB_ERROR = null;
async function getBlobStore(event) {
  LAST_BLOB_ERROR = null;
  let getStore, connectLambda;
  try {
    ({ getStore, connectLambda } = await import('@netlify/blobs'));
  } catch (e) {
    LAST_BLOB_ERROR = 'import_failed:' + e.message;
    console.warn('[nicebizmap-heartbeat] @netlify/blobs import 실패 → env 폴백:', e.message);
    return null;
  }
  // 1순위: connectLambda(event) 로 V1 함수에 Blobs 컨텍스트 주입 후 getStore
  try {
    if (typeof connectLambda === 'function' && event) connectLambda(event);
    return getStore('bizmap-session');
  } catch (e) {
    LAST_BLOB_ERROR = 'auto_context:' + e.message;
    console.warn('[nicebizmap-heartbeat] connectLambda/getStore 자동 컨텍스트 실패 → 수동/ env 폴백:', e.message);
  }
  // 2순위: 수동 siteID/token (env)
  try {
    const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) {
      return getStore({ name: 'bizmap-session', siteID, token });
    }
    LAST_BLOB_ERROR = (LAST_BLOB_ERROR || 'no_context') + '; no_manual_siteid_token';
  } catch (e) {
    LAST_BLOB_ERROR = 'manual_context:' + e.message;
    console.warn('[nicebizmap-heartbeat] 수동 siteID/token getStore 실패 → env 폴백:', e.message);
  }
  return null;
}
async function blobGetJSON(store, key) {
  if (!store) return null;
  try {
    return await store.get(key, { type: 'json', consistency: 'strong' });
  } catch (e) {
    console.warn('[nicebizmap-heartbeat] Blobs get 실패(무시):', key, e.message);
    return null;
  }
}
async function blobSetJSON(store, key, value) {
  if (!store) return false;
  try {
    await store.setJSON(key, value);
    return true;
  } catch (e) {
    console.warn('[nicebizmap-heartbeat] Blobs set 실패(무시):', key, e.message);
    return false;
  }
}

// 세션 읽기: Blobs current 우선 → env 폴백 (Blobs 없거나 에러나면 env 로 정상 동작)
async function resolveSessionId(store) {
  const cur = await blobGetJSON(store, 'current');
  if (cur && cur.sessionId) return { sessionId: cur.sessionId, source: 'blobs' };
  if (process.env.NICEBIZMAP_SESSION_ID) return { sessionId: process.env.NICEBIZMAP_SESSION_ID, source: 'env' };
  return { sessionId: null, source: 'none' };
}

// 쿠키 문자열: SESSION = Base64(sessionId)
function cookieFor(sessionId) {
  return 'SESSION=' + Buffer.from(sessionId).toString('base64');
}

// 한 번의 GET 호출 → { json, setCookie:[...] } 반환 (한글 안전: Buffer 모은 뒤 디코딩)
function bizmapGet(path, sessionId) {
  return new Promise((resolve) => {
    const req = https.get({
      hostname: 'm.nicebizmap.co.kr',
      path,
      headers: {
        'Cookie': cookieFor(sessionId),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://m.nicebizmap.co.kr/',
        'Origin': 'https://m.nicebizmap.co.kr',
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, res => {
      const setCookie = res.headers['set-cookie'] || [];
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch (e) { json = null; }
        resolve({ json, setCookie });
      });
    });
    req.on('error', e => resolve({ json: null, setCookie: [], error: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ json: null, setCookie: [], error: 'timeout' }); });
    req.end();
  });
}

// Set-Cookie 배열에서 새 SESSION 값 추출 → sessionId(UUID) 디코딩
function extractRotatedSessionId(setCookieArrays) {
  for (const arr of setCookieArrays) {
    if (!Array.isArray(arr)) continue;
    for (const c of arr) {
      const m = /(?:^|;|\s)SESSION=([^;]+)/i.exec(c);
      if (m && m[1]) {
        const b64 = decodeURIComponent(m[1].trim());
        try {
          const decoded = Buffer.from(b64, 'base64').toString('utf-8');
          // UUID 형태면 채택 (회전된 새 sessionId)
          if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(decoded)) {
            return decoded;
          }
        } catch (e) { /* base64 아님 → 무시 */ }
      }
    }
  }
  return null;
}

// 응답이 "진짜 로그인 풀림(만료)"을 의미하는지 판정
// ★ 2026-07-01: 9999 는 만료가 아니라 throttle(과호출) 신호 → 만료에서 제외.
//   같은 admiCd 를 5분마다 두드리면 세션이 살아있어도 9999/빈응답을 준다(프로젝트 확립 사실).
//   그래서 9999 를 만료로 잡아 keeper 재로그인을 태우면 → 멀쩡한 세션인데 카카오 알림 폭탄.
//   진짜 로그인 풀림 신호만 만료로: code 1002(auth/session 로그인 풀림)만.
//   빈응답/네트워크 실패(!j)도 만료 아님(살아있음으로 간주 = throttle 로 봄).
function isExpiredResponse(j) {
  if (!j) return false; // 네트워크 실패/빈응답은 만료로 보지 않음 (throttle 이니 살아있음으로 간주)
  const code = String(j.code ?? j.errorCode ?? j.resultCode ?? '');
  if (code === '9999') return false; // 9999 = throttle(과호출) ≠ 세션만료. 절대 만료로 잡지 않음.
  if (code === '1002') return true;  // 1002 = 로그인 풀림 = 진짜 만료
  if (j.success === false) return true; // auth/session 등의 명백한 로그인 풀림
  return false;
}

// ── Vercel 카카오 직원 호출 (2026-06-26) ──
// 카카오 계정은 자체 비번 relogin() 이 안 먹힘 → Vercel 에 있는 카카오 로그인 직원
// (브라우저 자동화)에게 "다시 로그인해줘"라고 GET 으로 부른다. 직원이 새 세션을 잡으면
// nicebizmap-set-session 으로 우리 Blobs current 에 저장 → 다음 틱부터 정상.
//   - URL 은 env KAKAO_KEEPER_URL (예: https://bc-vercel-mu.vercel.app/api/kakao-login).
//   - 응답 { ok, reason } 만 본다. ok:false reason captcha → '사람 개입 필요' 로그(알림 훅 자리).
//   - heartbeat 가 죽으면 안 되므로 절대 throw 하지 않음.
function callKakaoKeeper(keeperUrl) {
  return new Promise((resolve) => {
    let urlObj;
    try { urlObj = new URL(keeperUrl); }
    catch (e) { return resolve({ ok: false, reason: 'bad_keeper_url' }); }
    const req = https.get({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'beancraft-heartbeat'
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch (e) { json = null; }
        if (json && typeof json === 'object') {
          resolve({ ok: json.ok !== false, reason: json.reason || null, status: res.statusCode });
        } else {
          // 비-JSON 응답: 2xx 면 성공으로 간주
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, reason: 'non_json', status: res.statusCode });
        }
      });
    });
    req.on('error', e => resolve({ ok: false, reason: 'network_error:' + e.message }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
    req.end();
  });
}

exports.handler = async (event) => {
  const store = await getBlobStore(event); // ★ event 전달: connectLambda 로 컨텍스트 주입 (없으면 env 폴백)
  const { sessionId, source } = await resolveSessionId(store);
  if (!sessionId) {
    console.log('[nicebizmap-heartbeat] no session id (blobs+env 모두 없음)');
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'no session id' }) };
  }

  // STEP1: 상태 확인
  const step1 = await bizmapGet('/api/auth/session', sessionId);
  // STEP2(★핵심): check-analyzability = 활동 호출 → idle TTL 연장, 한도 0차감
  const step2 = await bizmapGet(
    '/api/explorer/summary/check-analyzability?admiCd=11680640&upjong3Cd=Q13007',
    sessionId
  );

  // ── Set-Cookie 회전 캡처 (두 응답 모두 검사) ──
  let rotated = false;
  const newSid = extractRotatedSessionId([step1.setCookie, step2.setCookie]);
  if (newSid && newSid !== sessionId) {
    rotated = await blobSetJSON(store, 'current', {
      sessionId: newSid,
      updatedAt: new Date().toISOString(),
      source: 'heartbeat-rotate'
    });
    console.log('[nicebizmap-heartbeat] session rotated -> Blobs current 갱신:', newSid, 'set=' + rotated);
  }

  // ── 살아있음/활동 판정 ──
  const aliveStatus = !!(step1.json && step1.json.success);   // /api/auth/session
  const activityOk = !!(step2.json && step2.json.success !== false && !isExpiredResponse(step2.json));
  const keepAlive = activityOk; // check-analyzability 가 정상 = TTL 연장됨

  // ── 만료 감지 ──
  const expired = isExpiredResponse(step1.json) || isExpiredResponse(step2.json);

  // ── 만료 시 자동 복구 (2026-06-26) ──
  // 카카오 계정 전환: 자체 비번 relogin() 은 카카오 OAuth 계정엔 안 먹힌다.
  //   → 1순위로 Vercel 카카오 직원(KAKAO_KEEPER_URL)을 GET 으로 부른다(만료 감지 시 1회만).
  //     직원이 새 세션을 잡아 nicebizmap-set-session 으로 우리 Blobs current 에 저장 →
  //     다음 틱에 세션 정상.
  //   → KAKAO_KEEPER_URL 미설정이고 자체 비번 자격증명이 있으면 폴백으로 relogin() 시도
  //     (구 자체계정 호환용. 카카오계정이면 사실상 의미 없음).
  //   무한 호출 방지: 둘 다 만료 감지 시 1회만. heartbeat 는 절대 안 죽는다(try/catch).
  let keeperResult = null;
  let reloginResult = null;
  if (expired) {
    await blobSetJSON(store, 'expired', { value: true, at: new Date().toISOString() });
    const keeperUrl = process.env.KAKAO_KEEPER_URL;
    if (keeperUrl) {
      // ── keeper 재로그인 쿨다운 (2026-07-01) ──
      // 진짜 만료(1002)라도 6시간 안에 이미 keeper 를 불렀으면 또 부르지 않는다.
      //   만약 9999 오판 같은 잔여 오탐이 남아 있어도 최대 6시간에 1회로 묶어 카카오 알림 폭탄 방지.
      //   저장소·방식은 이 함수가 이미 쓰는 Blobs(getBlobStore/blobGetJSON/blobSetJSON) 그대로 재사용.
      const KEEPER_COOLDOWN_MS = 21600000; // 6시간
      const KEEPER_LAST_KEY = 'lastKeeperAt';
      const now = Date.now();
      const lastRec = await blobGetJSON(store, KEEPER_LAST_KEY);
      const lastAt = lastRec && typeof lastRec.at === 'number' ? lastRec.at : 0;
      if (lastAt && (now - lastAt) < KEEPER_COOLDOWN_MS) {
        const remainMin = Math.round((KEEPER_COOLDOWN_MS - (now - lastAt)) / 60000);
        keeperResult = { ok: false, reason: 'cooldown_skip', cooldownRemainMin: remainMin };
        console.log('[nicebizmap-heartbeat] keeper 쿨다운 중 → 재로그인 건너뜀 (남은 ' + remainMin + '분)');
      } else try {
        // 실제 호출 직전에 시각 기록 (동시 실행/재시도에도 중복 호출 방지)
        await blobSetJSON(store, KEEPER_LAST_KEY, { at: now, atISO: new Date(now).toISOString() });
        keeperResult = await callKakaoKeeper(keeperUrl); // 쿨다운 내 1회만
        if (keeperResult.ok) {
          console.log('[nicebizmap-heartbeat] 카카오 직원 호출 OK → 다음 틱에 세션 정상 예상');
        } else if (keeperResult.reason && /captcha/i.test(keeperResult.reason)) {
          // 알림 훅 자리: 캡차는 자동 통과 불가 → 사람이 직접 로그인해야 함
          console.warn('[nicebizmap-heartbeat] !! 사람 개입 필요(캡차) — 카카오 직원이 자동 로그인 못 함');
        } else {
          console.warn('[nicebizmap-heartbeat] 카카오 직원 호출 실패:', keeperResult.reason);
        }
      } catch (e) {
        console.warn('[nicebizmap-heartbeat] 카카오 직원 호출 예외(무시):', e.message);
      }
    } else if (process.env.NICEBIZMAP_LOGIN_ID && process.env.NICEBIZMAP_LOGIN_PW) {
      // 폴백: KAKAO_KEEPER_URL 없을 때만 구 자체계정 비번 재로그인 시도
      try {
        const { relogin } = require('./nicebizmap-relogin');
        reloginResult = await relogin(store); // store 재사용 → current/expired 갱신
        console.log('[nicebizmap-heartbeat] (폴백)자체 재로그인 결과:', reloginResult.ok ? 'OK' : ('FAIL:' + reloginResult.reason));
      } catch (e) {
        console.warn('[nicebizmap-heartbeat] (폴백)자체 재로그인 호출 실패(무시):', e.message);
      }
    } else {
      console.warn('[nicebizmap-heartbeat] 만료됐으나 복구 경로 없음(KAKAO_KEEPER_URL/자격증명 모두 미설정)');
    }
  } else if (step1.json || step2.json) {
    // 정상 응답을 한 번이라도 받았으면 expired:false 로 정리
    await blobSetJSON(store, 'expired', { value: false, at: new Date().toISOString() });
  }

  console.log(
    `[nicebizmap-heartbeat] session ${expired ? 'expired' : 'alive'}, keepAlive:${keepAlive}, rotated:${rotated}`
    + ` (src:${source}, step1:${aliveStatus}, step2:${activityOk}, loginId:${step1.json?.data?.loginId || ''})`
    + (keeperResult ? `, keeper:${keeperResult.ok ? 'ok' : keeperResult.reason}` : '')
    + (reloginResult ? `, relogin:${reloginResult.ok ? 'ok' : reloginResult.reason}` : '')
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: aliveStatus || activityOk,
      keepAlive,
      rotated,
      expired,
      keeper: keeperResult ? { ok: keeperResult.ok, reason: keeperResult.reason || null } : null,
      relogin: reloginResult ? { ok: reloginResult.ok, reason: reloginResult.reason || null } : null,
      source,
      // 진단용(비밀 미노출): Blobs 컨텍스트 연결 여부 + 실패 사유. store 생기면 connected:true.
      blobConnected: !!store,
      blobError: store ? null : (LAST_BLOB_ERROR || null),
      loginId: step1.json?.data?.loginId || null
    })
  };
};

exports.config = {
  schedule: "*/5 * * * *"
};
