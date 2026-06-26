// Netlify Functions - 나이스비즈맵 고객분석 프록시
// m.nicebizmap.co.kr/api/explorer/summary/summary-report POST 프록시

const https = require('https');
const zlib = require('zlib');

// ─────────────────────────────────────────────────────────────────────────
// 세션 소스 보강 (데이터 로직 무변경 — 세션을 어디서 읽느냐만 바꿈)
// 우선순위: Netlify Blobs bizmap-session/current.sessionId → 없거나 에러나면 env NICEBIZMAP_SESSION_ID 폴백
// ★ 저장소 교체(RTDB→Netlify Blobs, 2026-06-15): RTDB 쓰기 401(인증) 해소.
//   Blobs 는 함수 내장 저장소(siteID/token 자동) → 별도 인증 불필요.
//   단 Blobs 는 "배포본"에서만 컨텍스트가 있고, 로컬 vite dev 에선 getStore/get/set 이 throw →
//   반드시 try/catch 로 감싸 env 폴백 (프록시가 로컬에서 안 죽게).
// @netlify/blobs v10 은 ESM → CommonJS 인 이 파일에선 동적 import(await import) 로 불러온다.
// ─────────────────────────────────────────────────────────────────────────

// 핸들러 시작 시 한 번 채워짐. 쿠키 헬퍼(fetchHtmlGet/Post, fetchJsonPost)가 이 값을 읽는다.
// 초기값 = env 폴백 (Blobs 조회 전이라도 기존과 동일하게 동작 보장).
let RESOLVED_SESSION_ID = process.env.NICEBIZMAP_SESSION_ID || '';

// 동기 쿠키 빌더 (세 함수가 공통 사용) — SESSION = Base64(sessionId)
function nbmSessionCookie() {
  return RESOLVED_SESSION_ID
    ? 'SESSION=' + Buffer.from(RESOLVED_SESSION_ID).toString('base64')
    : '';
}

// Netlify Blobs store 가져오기 (동적 import + try/catch — 로컬/미배포면 null)
async function getBlobStore() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('bizmap-session');
  } catch (e) {
    console.warn('[nicebizmap-proxy] Blobs getStore 불가(로컬/미배포 추정) → env 폴백:', e.message);
    return null;
  }
}

// Blobs current → sessionId 조회해 RESOLVED_SESSION_ID 갱신 (없거나 에러면 env 유지)
async function resolveNbmSession(store) {
  try {
    if (store) {
      const cur = await store.get('current', { type: 'json', consistency: 'strong' });
      if (cur && cur.sessionId) {
        RESOLVED_SESSION_ID = cur.sessionId; // Blobs 값 우선
        return;
      }
    }
  } catch (e) {
    console.warn('[nicebizmap-proxy] Blobs 세션 조회 실패 → env 폴백:', e.message);
  }
  // Blobs 없음/빈값/실패 → env 폴백 유지
  RESOLVED_SESSION_ID = process.env.NICEBIZMAP_SESSION_ID || '';
}

// Set-Cookie 배열에서 새 SESSION 회전 감지 → Blobs current 갱신 (heartbeat 와 동일 방식)
function extractRotatedSessionId(setCookie) {
  if (!Array.isArray(setCookie)) return null;
  for (const c of setCookie) {
    const m = /(?:^|;|\s)SESSION=([^;]+)/i.exec(c);
    if (m && m[1]) {
      try {
        const decoded = Buffer.from(decodeURIComponent(m[1].trim()), 'base64').toString('utf-8');
        if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(decoded)) {
          return decoded;
        }
      } catch (e) { /* base64 아님 → 무시 */ }
    }
  }
  return null;
}
async function maybeRotateNbmSession(store, setCookie) {
  try {
    const newSid = extractRotatedSessionId(setCookie);
    if (newSid && newSid !== RESOLVED_SESSION_ID) {
      RESOLVED_SESSION_ID = newSid; // 이후 호출에 즉시 반영
      if (store) {
        await store.setJSON('current', {
          sessionId: newSid,
          updatedAt: new Date().toISOString(),
          source: 'proxy-rotate'
        });
        console.log('[nicebizmap-proxy] session rotated -> Blobs current 갱신:', newSid);
      }
    }
  } catch (e) {
    console.warn('[nicebizmap-proxy] 세션 회전 Blobs 갱신 실패(무시):', e.message);
  }
}

// summary-report 응답이 "세션 만료/로그인 필요"를 의미하는지 판정 (heartbeat 와 동일 규칙)
//   봉투가 { success, code, message } 또는 { data:{...} } 양쪽으로 올 수 있어 둘 다 본다.
//   code 1002/9999 또는 message 에 "로그인" 포함 시 만료로 본다.
function isLoginExpired(result) {
  if (!result || result.parseError) return false;
  const env = result.data && typeof result.data === 'object' ? result.data : result;
  const j = env || result;
  if (j && j.success === false) {
    const code = String(j.code ?? j.errorCode ?? j.resultCode ?? '');
    if (code === '1002' || code === '9999') return true;
    if (typeof j.message === 'string' && /로그인/.test(j.message)) return true;
  }
  // 최상위에도 code/message 가 올 수 있음
  const topCode = String(result.code ?? result.errorCode ?? result.resultCode ?? '');
  if (topCode === '1002' || topCode === '9999') return true;
  if (typeof result.message === 'string' && /로그인/.test(result.message)) return true;
  return false;
}

function fetchJsonGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers
      },
      timeout: 10000
    };
    const req = https.request(options, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      // [버그 수정] 청크를 Buffer로 모은 후 마지막에 UTF-8 디코딩
      // 한글 멀티바이트가 청크 경계에 걸리면 fffd로 깨지는 문제 방지
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve(null); }
      });
      stream.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// HTML 응답용 GET (fragment 호출에 사용 - JSON 파싱 안 함)
// 세션 쿠키 자동 첨부 (NICEBIZMAP_SESSION_ID 환경변수, fetchJsonPost와 동일 규칙)
function fetchHtmlGet(url, headers = {}) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const sessionCookie = nbmSessionCookie();
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://m.nicebizmap.co.kr/',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
        ...headers
      },
      timeout: 12000
    };
    const req = https.request(options, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      // [버그 수정] 청크를 Buffer로 모은 후 마지막에 UTF-8 디코딩
      // 한글 멀티바이트가 청크 경계에 걸리면 fffd로 깨지는 문제 방지
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body || '');
      });
      stream.on('error', () => resolve(''));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.end();
  });
}

// HTML 응답용 POST (fragment 호출 - 정답지 fetchJsonPost 패턴 그대로, JSON 파싱 안 함)
// 세션 쿠키 자동 첨부 (NICEBIZMAP_SESSION_ID 환경변수)
function fetchHtmlPost(url, jsonBody) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify(jsonBody);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'text/html, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://m.nicebizmap.co.kr/',
        'Origin': 'https://m.nicebizmap.co.kr',
        'Cookie': nbmSessionCookie(),
        'Content-Length': Buffer.byteLength(postBody)
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      // [버그 수정] 청크를 Buffer로 모은 후 마지막에 UTF-8 디코딩
      // 한글 멀티바이트가 청크 경계에 걸리면 fffd로 깨지는 문제 방지
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body || '');
      });
      stream.on('error', () => resolve(''));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.write(postBody);
    req.end();
  });
}

// HTML fragment에서 popularMenuListContainer / risingMenuListContainer 파싱
// 패턴: <div id="popularMenuListContainer"> ... <p class="sec06RankMenu">메뉴명</p>
//       <ul><li>평균 단가 <span>3,550원</span></li> ... </ul>
// 반환: 표준화된 메뉴 객체 배열 (menuNm/MENU_NM, AVG_SALE_UPRC, PCTILE_25, PCTILE_75, SALE_RATE, RNK)
function parseMenuFragment(html, containerId) {
  if (!html || typeof html !== 'string') return [];
  try {
    // 1) container 시작 위치 찾기 → 다음 ListContainer 또는 EOF까지 (단순/안전 방식)
    // 1차: 정확한 id 매치 / 2차: id 부분 매치 (popular/rising) / 3차: section06 영역
    let startMatch = html.match(new RegExp('<div[^>]*id\\s*=\\s*["\']' + containerId + '["\'][^>]*>', 'i'));
    if (!startMatch) {
      // popularMenuListContainer → popular, risingMenuListContainer → rising 키워드 추출
      const kw = /popular/i.test(containerId) ? 'popular' : (/rising/i.test(containerId) ? 'rising' : '');
      if (kw) {
        startMatch = html.match(new RegExp('<[^>]*(?:id|class)\\s*=\\s*["\'][^"\']*' + kw + '[^"\']*["\'][^>]*>', 'i'));
      }
    }
    if (!startMatch) return [];
    const startIdx = (startMatch.index || 0) + startMatch[0].length;
    // 다른 *ListContainer가 다음에 오면 그 직전까지, 없으면 충분히 큰 영역
    const restHtml = html.slice(startIdx);
    const nextContainerRe = /<div[^>]*id\s*=\s*["'][a-zA-Z0-9_]*ListContainer["'][^>]*>/i;
    const nextMatch = restHtml.match(nextContainerRe);
    const containerHtml = nextMatch
      ? restHtml.slice(0, nextMatch.index)
      : restHtml.slice(0, 12000);

    // 2) 각 메뉴 블록: sec06RankMenu (메뉴명) + 그 직후 ul 안의 li/span 값
    const blocks = [];
    const menuRe = /<p[^>]*class\s*=\s*["'][^"']*sec06RankMenu[^"']*["'][^>]*>([\s\S]*?)<\/p>([\s\S]*?)(?=<p[^>]*class\s*=\s*["'][^"']*sec06RankMenu|$)/gi;
    let mm;
    while ((mm = menuRe.exec(containerHtml)) !== null) {
      const menuName = (mm[1] || '').replace(/<[^>]*>/g, '').trim();
      const tail = mm[2] || '';
      // li 안 라벨 + span 값 페어
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      const fields = {};
      let lm;
      while ((lm = liRe.exec(tail)) !== null) {
        const liInner = lm[1] || '';
        const spanMatch = liInner.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
        if (!spanMatch) continue;
        const valStr = (spanMatch[1] || '').replace(/<[^>]*>/g, '').trim();
        const labelStr = liInner.replace(/<span[^>]*>[\s\S]*?<\/span>/i, '').replace(/<[^>]*>/g, '').trim();
        // 숫자 추출 (콤마 제거, %p / % / 원 제거)
        const numStr = valStr.replace(/[^0-9.\-]/g, '');
        const num = numStr ? parseFloat(numStr) : NaN;
        if (/평균\s*단가/.test(labelStr)) fields.AVG_SALE_UPRC = isFinite(num) ? num : null;
        else if (/최저가/.test(labelStr)) fields.PCTILE_25 = isFinite(num) ? num : null;
        else if (/최고가/.test(labelStr)) fields.PCTILE_75 = isFinite(num) ? num : null;
        else if (/매출\s*비중/.test(labelStr)) fields.SALE_RATE = isFinite(num) ? num : null;
        else if (/판매\s*증가율|증가율/.test(labelStr)) fields.GROWTH_RATE = isFinite(num) ? num : null;
        else if (/주문\s*건수|건수/.test(labelStr)) fields.ORDER_CNT = isFinite(num) ? num : null;
      }
      if (menuName) {
        blocks.push({
          MENU_NM: menuName,
          menuNm: menuName,
          menuName: menuName,
          RNK: blocks.length + 1,
          rank: blocks.length + 1,
          ...fields
        });
      }
    }
    return blocks;
  } catch (e) {
    return [];
  }
}

function fetchJsonPost(url, jsonBody) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify(jsonBody);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://m.nicebizmap.co.kr/',
        'Origin': 'https://m.nicebizmap.co.kr',
        'Cookie': nbmSessionCookie(),
        'Content-Length': Buffer.byteLength(postBody)
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      // [세션 회전 캡처] 비즈맵 응답의 새 SESSION 쿠키를 모듈 변수에 기록 (데이터 무변경)
      LAST_POST_SET_COOKIE = res.headers['set-cookie'] || [];
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') { stream = res.pipe(zlib.createGunzip()); }
      else if (encoding === 'deflate') { stream = res.pipe(zlib.createInflate()); }
      // [버그 수정] 청크를 Buffer로 모은 후 마지막에 UTF-8 디코딩
      // 한글 멀티바이트가 청크 경계에 걸리면 fffd로 깨지는 문제 방지
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve({ rawBody: body.substring(0, 500), parseError: true }); }
      });
      stream.on('error', (e) => reject(e));
    });
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postBody);
    req.end();
  });
}

// 직전 fetchJsonPost 응답의 set-cookie (세션 회전 감지용). 데이터 흐름과 무관.
let LAST_POST_SET_COOKIE = [];

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

  // [세션 소스 보강] 비즈맵 호출 전에 Blobs current 우선 조회 (없거나 에러 시 env 폴백 유지).
  // 데이터 로직은 그대로 — 쿠키 헬퍼가 읽을 세션 값만 결정한다.
  // store 는 회전 캡처(maybeRotateNbmSession)에서도 재사용. 로컬/미배포면 null → env 로 동작.
  const blobStore = await getBlobStore();
  await resolveNbmSession(blobStore);

  try {
    let admiCd, requestBody, body = {};

    if (event.httpMethod === 'POST' && event.body) {
      body = JSON.parse(event.body);
      admiCd = body.admiCd;

      requestBody = {
        admiCd: admiCd,
        upjong3Cd: body.upjong3Cd || 'Q13007'
      };
      if (body.region) requestBody.region = body.region;
      if (body.upjong3Nm) requestBody.upjong3Nm = body.upjong3Nm;
      if (body.yyyymm) requestBody.yyyymm = body.yyyymm;
      if (body.prevYyyymm) requestBody.prevYyyymm = body.prevYyyymm;
      if (body.address) requestBody.address = body.address;
      if (body.xAxis) requestBody.xAxis = body.xAxis;
      if (body.yAxis) requestBody.yAxis = body.yAxis;
    } else {
      const params = event.queryStringParameters || {};
      admiCd = params.admiCd;
      body = { upjong3Cd: params.upjong3Cd || 'Q13007' };
      requestBody = {
        admiCd: admiCd,
        upjong3Cd: params.upjong3Cd || 'Q13007'
      };
    }

    if (!admiCd) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'admiCd 파라미터 필요' })
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // [2026-05-06] 세션 불필요 markets/trend 핸들러
    // 정답지 4/24 합의: chart/national, chart/admi, markets/trend, block-data 등
    // 토큰 X 한도 X. mode='trend' 파라미터로 분기.
    // ═══════════════════════════════════════════════════════════════
    if (body.mode === 'trend' || (event.queryStringParameters && event.queryStringParameters.mode === 'trend')) {
      const trendBody = { admiCd, upjong3Cd: requestBody.upjong3Cd };
      const trendData = await fetchJsonPost('https://m.nicebizmap.co.kr/api/explorer/markets/trend', trendBody);
      const items = Array.isArray(trendData?.data) ? trendData.data : [];
      // 입력한 admiCd 동의 업종만 필터 + 점포수 정렬
      const dongItems = items.filter(r => r.admiCd === admiCd);
      const sorted = dongItems.sort((a, b) => (b.thisStoreCnt || 0) - (a.thisStoreCnt || 0));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: sorted.map(r => ({
            upjong3Nm: r.upjong3Nm,
            upjong3Cd: r.upjong3Cd,
            storeCnt: r.thisStoreCnt,
            saleAmt: r.thisSaleAmt,
            salePer: r.salePer,
            cntPer: r.cntPer,
          })),
          totalNationwide: items.length,
          dongMatch: dongItems.length,
        })
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // [2026-05-06] 세션 불필요 markets/chart/national 핸들러
    // 정답지 4/24 합의: 토큰 X, 한도 X. mode='national' 파라미터로 분기.
    // 응답: 전국 업종별 시계열 매출/점포수. 카페 업종 평균 매출 산출용.
    // ═══════════════════════════════════════════════════════════════
    if (body.mode === 'national' || (event.queryStringParameters && event.queryStringParameters.mode === 'national')) {
      const upj3 = requestBody.upjong3Cd || 'Q13007';
      const natBody = { upjong3Cd: upj3 };
      const natData = await fetchJsonPost('https://m.nicebizmap.co.kr/api/explorer/markets/chart/national', natBody);
      // 응답 구조 다양성 대비 (data | result | items 등)
      const rawList = Array.isArray(natData?.data) ? natData.data
        : Array.isArray(natData?.result) ? natData.result
        : Array.isArray(natData?.items) ? natData.items
        : Array.isArray(natData) ? natData : [];
      // 카페(또는 요청 업종) 시계열 항목 추출
      const upj3Items = rawList.filter(r => !r.upjong3Cd || r.upjong3Cd === upj3);
      // 점포당 평균 매출 계산: 매출/점포수
      let perStoreAvgManwon = 0;
      let totalSaleAmt = 0;
      let totalStoreCnt = 0;
      let latestPeriod = null;
      const series = upj3Items.map(r => {
        const sa = parseFloat(r?.thisSaleAmt ?? r?.saleAmt ?? r?.amt ?? 0) || 0;
        const sc = parseInt(r?.thisStoreCnt ?? r?.storeCnt ?? r?.cnt ?? 0, 10) || 0;
        const yyyymm = String(r?.yyyymm ?? r?.crtrYm ?? r?.stdYm ?? '');
        if (sa > 0 && sc > 0) {
          totalSaleAmt += sa;
          totalStoreCnt += sc;
          if (!latestPeriod || yyyymm > latestPeriod) latestPeriod = yyyymm;
        }
        return { yyyymm, saleAmt: sa, storeCnt: sc, perStoreAvg: sc > 0 ? Math.round(sa / sc) : 0 };
      }).filter(r => r.saleAmt > 0 || r.storeCnt > 0);
      // 평균 점포당 매출 (만원 단위 추정 - 응답 단위에 따라 변환 필요. 일반적으로 비즈맵은 원 단위)
      if (totalStoreCnt > 0) {
        const perStoreWon = totalSaleAmt / totalStoreCnt;
        // 비즈맵 saleAmt가 보통 원 단위. 만원 단위로 변환 (응답에 따라 자동 보정)
        perStoreAvgManwon = perStoreWon >= 100000 ? Math.round(perStoreWon / 10000) : Math.round(perStoreWon);
      }
      // 최근 시점 데이터로 한 번 더 보정 (전체 평균보다 최근값이 더 정확)
      let latestPerStoreManwon = 0;
      if (latestPeriod) {
        const latestRows = series.filter(r => r.yyyymm === latestPeriod);
        const lsa = latestRows.reduce((s, r) => s + r.saleAmt, 0);
        const lsc = latestRows.reduce((s, r) => s + r.storeCnt, 0);
        if (lsc > 0) {
          const w = lsa / lsc;
          latestPerStoreManwon = w >= 100000 ? Math.round(w / 10000) : Math.round(w);
        }
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          upjong3Cd: upj3,
          perStoreAvgManwon,           // 시계열 전체 평균 (만원/월)
          latestPerStoreManwon,        // 최근 시점 평균 (만원/월)
          latestPeriod,
          totalSaleAmt,
          totalStoreCnt,
          seriesLength: series.length,
          series: series.slice(-12),   // 최근 12개월만 (응답 부피 축소)
        })
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: check-analyzability 자동 호출 → yyyymm + analysisStatus + expandedAdmiRegions 추출
    // ═══════════════════════════════════════════════════════════════
    const upjong3Cd = requestBody.upjong3Cd;
    const checkUrl = `https://m.nicebizmap.co.kr/api/explorer/summary/check-analyzability?admiCd=${admiCd}&upjong3Cd=${upjong3Cd}`;
    let checkData = null;
    try {
      const checkRaw = await fetchJsonGet(checkUrl, {
        'Referer': 'https://m.nicebizmap.co.kr/',
        'Origin': 'https://m.nicebizmap.co.kr',
        'X-Requested-With': 'XMLHttpRequest'
      });
      // [2026-06-24 회귀 수정] 응답이 { success, code, message, data:{...}, timestamp } 봉투로 옴.
      //   기존 코드는 최상위에서 analysisStatus/yyyymm/expandedAdmiRegions 를 읽어 전부 undefined →
      //   로그 status=N/A yyyymm=N/A, STEP6 미발동 → admiCdList 없이 BASIC(본인 동만)으로 호출돼
      //   매출이 동 단위(예: 불광2동 16점포 901만원)로 낮게 나왔음. data 봉투를 벗겨 읽는다.
      checkData = (checkRaw && checkRaw.data && typeof checkRaw.data === 'object') ? checkRaw.data : checkRaw;
      console.log(`[nicebizmap-proxy] check-analyzability admiCd=${admiCd} status=${checkData?.analysisStatus || 'N/A'} yyyymm=${checkData?.yyyymm || 'N/A'} expandedAnalyzable=${checkData?.expandedAnalyzable} basicStore=${checkData?.basicStoreCount} expandedStore=${checkData?.expandedStoreCount} expanded=${(checkData?.expandedAdmiRegions || []).length}`);
    } catch (e) {
      console.warn('[nicebizmap-proxy] check-analyzability 실패 (무시):', e.message);
    }

    // STEP 2: yyyymm 자동 보강 + prevYyyymm 자동 계산
    const prevOf = (yyyymm) => {
      if (!yyyymm || yyyymm.length !== 6) return null;
      return String(parseInt(yyyymm.slice(0, 4)) - 1) + yyyymm.slice(4);
    };
    if (!requestBody.yyyymm && checkData?.yyyymm) {
      requestBody.yyyymm = checkData.yyyymm;
    }
    if (!requestBody.prevYyyymm && requestBody.yyyymm) {
      requestBody.prevYyyymm = prevOf(requestBody.yyyymm);
    }

    // STEP 3: upjong3Nm 자동 보강 (커피전문점 기본)
    if (!requestBody.upjong3Nm) {
      requestBody.upjong3Nm = (upjong3Cd === 'Q13007') ? '커피전문점' : '';
    }

    // STEP 4: region 최소 골격 보강
    if (!requestBody.region) {
      requestBody.region = { admiCd, admiData: {} };
    }

    // STEP 5: address/xAxis/yAxis 빈값 기본 처리
    if (requestBody.address == null) requestBody.address = '';
    if (requestBody.xAxis == null) requestBody.xAxis = null;
    if (requestBody.yAxis == null) requestBody.yAxis = null;

    // STEP 6: admiCdList 자동 생성 (확장 분석 가능 시 본인 + 인접동)
    // [2026-06-24 회귀 수정] 현재 API 는 analysisStatus 를 'BASIC_ANALYZABLE' 로 주면서
    //   별도 boolean expandedAnalyzable=true 로 확장 가능 여부를 알려준다(예: 불광2동·역삼1동 둘 다).
    //   기존 코드는 analysisStatus === 'EXPANDED_ANALYZABLE' 만 봐서 영영 발동 안 함 → 본인 동만 분석.
    //   확장 가능(expandedAnalyzable=true 또는 status가 EXPANDED)이고 인접동이 있으면 admiCdList 를 보낸다.
    const _canExpand = (checkData?.expandedAnalyzable === true) || (checkData?.analysisStatus === 'EXPANDED_ANALYZABLE');
    if (_canExpand) {
      const expanded = (checkData.expandedAdmiRegions || []).map(r => r.admiCd).filter(Boolean);
      const merged = Array.from(new Set([...expanded, admiCd]));
      if (merged.length > 1) {
        requestBody.admiCdList = merged;
      }
    }

    const targetUrl = 'https://m.nicebizmap.co.kr/api/explorer/summary/summary-report';

    console.log(`[nicebizmap-proxy] POST ${targetUrl} admiCd=${admiCd} upjong3Cd=${requestBody.upjong3Cd} yyyymm=${requestBody.yyyymm || 'N/A'} prev=${requestBody.prevYyyymm || 'N/A'} admiCdList=${requestBody.admiCdList ? requestBody.admiCdList.length : 0}`);

    // ═══════════════════════════════════════════════════════════════
    // [단일 호출] summary-report 는 검색당 단 1회만 호출한다.
    //   ※ 재시도(같은 admiCd 재호출) 제거됨(2026-06-24):
    //     - 서버가 같은 admiCd 연속 호출에 캐시가 아니라 빈 응답(throttle)을 줘서
    //       두 번째 호출이 0/9 빈 응답으로 와 첫 호출의 완전응답을 못 쓰게 만들었다.
    //     - 막힌 서버를 더 두드리면 차단(ECONNRESET/GeoIP) 위험만 커지고 효과 없음.
    //   완전응답(9/9, averageSalesList 포함)을 못 받아도 그대로 반환 →
    //   누락 키는 App.jsx 의 localStorage 완전응답 캐시(부분보충)가 메운다(가짜 폴백 없음).
    // ═══════════════════════════════════════════════════════════════
    let result = await fetchJsonPost(targetUrl, requestBody);

    // ═══════════════════════════════════════════════════════════════
    // [자동 재로그인 1회 + summary-report 1회 재시도] (2026-06-26)
    //   응답이 9999/"로그인 해주세요"(세션 만료)면 → 재로그인 직원 1회 호출 →
    //   새 sessionId 를 쿠키 변수에 즉시 반영 → summary-report 1회만 재시도.
    //   ★무한루프 방지: 단 1회만. (같은 admiCd 연타 throttle 과는 별개 — 만료 복구 전용.)
    //   재로그인 실패하면 원래 만료 응답 그대로 진행(가짜 폴백 안 함).
    // ═══════════════════════════════════════════════════════════════
    if (isLoginExpired(result)) {
      console.warn('[nicebizmap-proxy] summary-report 세션 만료 감지 → 재로그인 1회 시도');
      try {
        const { relogin } = require('./nicebizmap-relogin');
        const re = await relogin(blobStore); // Blobs current 갱신 + store 재사용
        if (re && re.ok && re.sessionId) {
          RESOLVED_SESSION_ID = re.sessionId; // 이번 재시도에 새 세션 즉시 적용
          console.log('[nicebizmap-proxy] 재로그인 성공 → summary-report 1회 재시도');
          result = await fetchJsonPost(targetUrl, requestBody);
        } else {
          console.warn('[nicebizmap-proxy] 재로그인 실패 → 원응답 그대로:', re && re.reason);
        }
      } catch (e) {
        console.warn('[nicebizmap-proxy] 재로그인 호출 실패(무시):', e.message);
      }
    }

    // [세션 회전 캡처] summary-report 응답에 새 SESSION 쿠키가 왔으면 Blobs current 갱신
    // (heartbeat 와 동일 방식. 데이터 로직 무영향 — 회전 감지만. 로컬/미배포면 store=null → 스킵.)
    await maybeRotateNbmSession(blobStore, LAST_POST_SET_COOKIE);

    // 핵심 키 수신 검증 + 로깅
    const coreKeys = ['genderAgeTrendList','hourlySalesConcentration','weeklySalesConcentration','averageSalesList','usageAndPaymentTrendList','storeCountTrendList','marketSizeTrendList','costAnalysisList','popularMenuList'];
    const inner = (result && !result.parseError) ? (result.data || result) : null;
    const got = inner ? coreKeys.filter(k => inner[k] != null) : [];
    console.log(`[nicebizmap-proxy] core keys received: ${got.length}/${coreKeys.length} - ${got.join(', ')}`);

    // ═══════════════════════════════════════════════════════════════
    // [2026-05-06] popularMenuList / risingMenuList NULL/빈배열 보강 1순위:
    // /explorer/summary-reports/report-fragment HTML fragment 호출
    // 실제 비즈맵 화면에 노출되는 진짜 메뉴 데이터(아메리카노/카페라떼 등) 수집
    // 토큰/한도 차감 없음. 실패 시 아래 zinidata 폴백 유지.
    // ═══════════════════════════════════════════════════════════════
    if (result && !result.parseError && result.data) {
      const _curRising0 = result.data.risingMenuList;
      const _curPop0 = result.data.popularMenuList;
      const _risingEmpty = _curRising0 == null || (Array.isArray(_curRising0) && _curRising0.length === 0);
      const _popEmpty0 = _curPop0 == null || (Array.isArray(_curPop0) && _curPop0.length === 0);
      if (_risingEmpty || _popEmpty0) {
        try {
          // 정답지 fetchJsonPost 패턴 그대로 적용 (POST + JSON body + 세션 쿠키)
          // URL은 쿼리 없이 fragment 엔드포인트만, admiCd/upjong3Cd는 JSON body로 전송
          const fragUrl = 'https://m.nicebizmap.co.kr/explorer/summary-reports/report-fragment';
          const fragBody = {
            admiCd: String(admiCd),
            upjong3Cd: String(requestBody.upjong3Cd || 'Q13007')
          };
          console.log(`[nicebizmap-proxy] menu fragment POST 호출: ${fragUrl} body=${JSON.stringify(fragBody)}`);
          const fragHtml = await fetchHtmlPost(fragUrl, fragBody);
          const _fragLen = fragHtml ? fragHtml.length : 0;
          const _hasPopContainer = !!(fragHtml && /popularMenuListContainer/.test(fragHtml));
          console.log(`[nicebizmap-proxy] fragment POST 응답 길이: ${_fragLen}자, popularMenuListContainer 포함: ${_hasPopContainer}`);
          if (fragHtml && fragHtml.length > 200) {
            if (_popEmpty0) {
              const popMenus = parseMenuFragment(fragHtml, 'popularMenuListContainer');
              if (popMenus.length > 0) {
                result.data.popularMenuList = popMenus;
                console.log(`[nicebizmap-proxy] fragment popularMenuList 보충 완료: ${popMenus.length}건 [${popMenus.map(m => m.MENU_NM).join(', ')}]`);
              }
            }
            if (_risingEmpty) {
              const risingMenus = parseMenuFragment(fragHtml, 'risingMenuListContainer');
              if (risingMenus.length > 0) {
                result.data.risingMenuList = risingMenus;
                console.log(`[nicebizmap-proxy] fragment risingMenuList 보충 완료: ${risingMenus.length}건 [${risingMenus.map(m => m.MENU_NM).join(', ')}]`);
              }
            }
          } else {
            console.log(`[nicebizmap-proxy] fragment 응답 길이 부족 (${fragHtml ? fragHtml.length : 0}) -> zinidata 폴백`);
          }
        } catch (e) {
          console.warn('[nicebizmap-proxy] fragment 메뉴 보충 실패 (무시, zinidata 폴백 진행):', e.message);
        }
      }
    }

    // risingMenuList가 NULL/빈배열이면 zinidata에서 보충 (fragment 실패 시 마지막 폴백)
    const _curRising = result && result.data ? result.data.risingMenuList : undefined;
    const _risingNeedFill = result && !result.parseError && result.data &&
      (_curRising == null || (Array.isArray(_curRising) && _curRising.length === 0));
    if (_risingNeedFill) {
      try {
        // [2026-06-15] 급상승 메뉴 출처 수정 — 동(洞) 단위 → 시도(2자리) 폴백.
        //   기존: AREA_CD=시도2자리 만 호출 → 서울 전체 급상승(망고아이스크림/한라봉젤리/
        //         불고기샌드위치 등 비(非)카페 식사류)만 와서 isCafeMenu 필터에 전량 탈락 → 항상 빈값.
        //   수정: AREA_CD=8자리 동코드(역삼1동 11680640) 를 1순위로 호출하면 그 동의 실제
        //         카페 급상승 메뉴(청귤에이드/콜드브루/베이글/딸기요거트 등)가 MENU_NM 으로 옴.
        //         동에서 빈배열일 때만 시도2자리로 폴백(소멸 방지).
        //   ※ AREA_CD 는 정확히 8자리만 동 단위로 인식됨(10자리/6자리는 빈배열). admiCd 가
        //      10자리로 오면 앞 8자리로 잘라 시도한다.
        const upjongCd = requestBody.upjong3Cd || 'Q13007';
        const admiStr = String(admiCd);
        const dongCode8 = admiStr.length >= 8 ? admiStr.substring(0, 8) : null;
        const sidoCode = admiStr.substring(0, 2);
        // 출처 우선순위: 동(카페 단위) → 시도(광역, 폴백)
        const areaCandidates = [];
        if (dongCode8) areaCandidates.push(dongCode8);
        if (sidoCode && sidoCode !== dongCode8) areaCandidates.push(sidoCode);
        // [2026-06-14] 연도 폴백: 당해(getFullYear)는 집계 전이라 MENU_LIST 빈배열로 옴.
        // 당해 → 전년 순서로 시도해서 빈 메뉴 유실을 막는다.
        const nowYear = new Date().getFullYear();
        const yearCandidates = [nowYear, nowYear - 1];
        let menuList = null;
        let hitArea = null;
        for (const area of areaCandidates) {
          for (const yr of yearCandidates) {
            const zinidataUrl = `https://api-v1.zinidata.co.kr/v4/union/biz_trend_menu?CLSFC_TERM=M&YEAR=${yr}&TERMS=2&UPJONG_CD=${upjongCd}&AREA_CD=${area}`;
            console.log(`[nicebizmap-proxy] risingMenuList NULL -> zinidata 보충(AREA=${area} ${area.length === 8 ? '동' : '시도'} YEAR=${yr}): ${zinidataUrl}`);
            const zinResult = await fetchJsonGet(zinidataUrl, { 'UNION-API-KEY': 'pringles' });
            const _list = zinResult && zinResult.RESULT && zinResult.RESULT.MENU_LIST;
            if (_list && _list.length > 0) { menuList = _list; hitArea = area; break; }
          }
          if (menuList) break; // 동 단위에서 잡혔으면 시도 폴백 안 함
        }
        if (menuList && menuList.length > 0) {
          result.data.risingMenuList = menuList;
          console.log(`[nicebizmap-proxy] zinidata 급상승 보충 완료: ${menuList.length}건 (AREA=${hitArea} ${hitArea && hitArea.length === 8 ? '동단위 카페' : '시도단위'}) [${menuList.map(m => m.MENU_NM || m.MENU4_NM || '').filter(Boolean).join(', ')}]`);
        }
      } catch (e) {
        console.warn('[nicebizmap-proxy] zinidata 보충 실패 (무시):', e.message);
      }
    }

    // popularMenuList가 NULL/빈배열이면 zinidata biz_popular_menu에서 보충
    // 정답지 README "다음 세션에서 이어서 할 작업" 명시: zinidata biz_popular_menu 보강
    // 필수 파라미터: CLSFC_TERM=M&YEAR&TERMS=6&UPJONG_CD&AREA_CD&MENU_CLS=ALL
    // 응답 경로: RESULT.MENU_LIST (대문자), 메뉴명: MENU4_NM
    if (result && !result.parseError && result.data) {
      const _curPop = result.data.popularMenuList;
      const _popEmpty = _curPop == null || (Array.isArray(_curPop) && _curPop.length === 0);
      if (_popEmpty) {
        try {
          const sidoCode = admiCd.substring(0, 2);
          const upjongCd = requestBody.upjong3Cd || 'Q13007';
          // [2026-06-14] 연도 폴백: 당해(getFullYear)는 집계 전이라 MENU_LIST 빈배열로 옴
          // (예: 2026년 호출 시 빈값 → 아메리카노/카페라떼 등 실제 인기메뉴 유실).
          // 당해 → 전년 순서로 시도. 아메리카노 38%/카페라떼 10% 등 실데이터 복구.
          const nowYear = new Date().getFullYear();
          const yearCandidates = [nowYear, nowYear - 1];
          let popList = null;
          for (const yr of yearCandidates) {
            const popUrl = `https://api-v1.zinidata.co.kr/v4/union/biz_popular_menu?CLSFC_TERM=M&YEAR=${yr}&TERMS=6&UPJONG_CD=${upjongCd}&AREA_CD=${sidoCode}&MENU_CLS=ALL`;
            console.log(`[nicebizmap-proxy] popularMenuList 빈값 -> zinidata 보충(YEAR=${yr}): ${popUrl}`);
            const popResult = await fetchJsonGet(popUrl, { 'UNION-API-KEY': 'pringles' });
            const _list = popResult && popResult.RESULT && popResult.RESULT.MENU_LIST;
            if (_list && _list.length > 0) { popList = _list; break; }
          }
          if (popList && popList.length > 0) {
            // dataMapper 호환 형식으로 매핑: menuNm 키 + 비중/단가 표준화
            // zinidata 인기메뉴 필드: OKP_QTY_RATE(판매비중%), OKP_AVG_UPRC(평균단가)
            // → dataMapper가 읽는 saleRate/avgPrice 로 옮겨 비중(아메리카노 38% 등)이 살아남게 한다.
            const normalized = popList.slice(0, 10).map((m, idx) => ({
              menuNm: m.MENU4_NM || m.MENU3_NM || m.MENU2_NM || m.MENU1_NM || m.MENU_NM || '',
              menuName: m.MENU4_NM || m.MENU3_NM || m.MENU2_NM || m.MENU1_NM || m.MENU_NM || '',
              saleRate: (m.OKP_QTY_RATE != null) ? m.OKP_QTY_RATE : (m.OKP_AMT_RATE != null ? m.OKP_AMT_RATE : 0),
              avgPrice: m.OKP_AVG_UPRC != null ? m.OKP_AVG_UPRC : (m.AVG_SALE_UPRC != null ? m.AVG_SALE_UPRC : 0),
              rank: idx + 1,
              raw: m
            })).filter(m => m.menuNm);
            if (normalized.length > 0) {
              result.data.popularMenuList = normalized;
              console.log(`[nicebizmap-proxy] popularMenuList zinidata 보충 완료: ${normalized.length}건`);
            }
          }
        } catch (e) {
          console.warn('[nicebizmap-proxy] popularMenuList zinidata 보충 실패 (무시):', e.message);
        }
      }
    }

    if (result.parseError) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'JSON 파싱 실패', raw: result.rawBody })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, data: result })
    };
  } catch (e) {
    console.error('[nicebizmap-proxy] error:', e.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
