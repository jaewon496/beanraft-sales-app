/* =============================================================
 * 빈크래프트 릴스 자동 직원 (reels-worker)
 * ------------------------------------------------------------
 * 하는 일: 릴스앱이 reels_requests/{id} 에 지역을 요청해두면,
 *  로그인된 영업앱(브라우저)을 자동 조작해서
 *  검색 → 분석완료 → 캡처 까지 사람 대신 눌러
 *  reels/{dongCd} (숫자+이미지)를 채운다.
 *
 * 구동: 맥에서 Node 18+ & Playwright. (README 인수인계.md 참고)
 *   npm install
 *   npx playwright install chromium
 *   node worker.js
 *
 * ★ 검증 상태(2026-06-23, 윈도우 클로드가 prod에서 직접 실행해 확인):
 *   - 검색 입력 → 분석완료 클릭 → 캡처(JPG) → reels/{dongCd} 숫자+이미지 기록  = 확인됨.
 *   - 로그인 폼 / 영업모드 진입 UI 는 prod 세션이 이미 로그인+의뢰인 상태였어서
 *     셀렉터를 직접 못 봄. 아래 ensureLoggedIn / ensureSearchReady 는 best-effort.
 *     첫 실행은 HEADLESS=false 로 눈으로 보며 셀렉터만 맞춰주세요(README 참고).
 * ============================================================= */

const { chromium } = require('playwright');

// ---- 설정 (환경변수로 덮어쓰기 가능) ----
const APP_URL  = process.env.BC_APP_URL || 'https://beancraft-sales.netlify.app/';
const RTDB     = 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';
const LOGIN_ID = process.env.BC_ID || 'admin';
const LOGIN_PW = process.env.BC_PW || 'qlwlsltm1';
const HEADLESS = (process.env.BC_HEADLESS || 'false') === 'true';
const PROFILE  = process.env.BC_PROFILE || './.bc-profile';   // 로그인 세션 저장 폴더(한 번 로그인하면 유지)
const POLL_MS  = 5000;        // 요청 큐 폴링 주기
const ANALYZE_TIMEOUT = 8 * 60 * 1000;  // 분석 최대 대기(8분)

// ---- RTDB REST 헬퍼 (firebase SDK 불필요) ----
async function rget(path){ const r = await fetch(`${RTDB}/${path}.json`); return r.json(); }
async function rpatch(path, obj){ await fetch(`${RTDB}/${path}.json`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj) }); }
const now = () => Date.now();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

// ============================================================
// 1) 로그인 보장 (best-effort — 첫 실행 시 셀렉터 확인 필요)
// ============================================================
async function ensureLoggedIn(page){
  await page.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await sleep(3000);
  const hasPw = await page.evaluate(() => !!document.querySelector('input[type="password"]'));
  if(!hasPw){ log('이미 로그인 상태'); return; }
  log('로그인 폼 감지 → 로그인 시도');
  await page.evaluate(({id, pw}) => {
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    };
    const idEl = document.querySelector('input[placeholder="아이디"]') || [...document.querySelectorAll('input[type="text"]')].find(e=>e.offsetParent!==null);
    const pwEl = document.querySelector('input[placeholder="비밀번호"]') || document.querySelector('input[type="password"]');
    if(idEl) setVal(idEl, id);
    if(pwEl) setVal(pwEl, pw);
    const keep = document.querySelector('input[type="checkbox"]');  // 로그인 상태 유지(세션 유지)
    if(keep && !keep.checked) keep.click();
  }, { id:LOGIN_ID, pw:LOGIN_PW });
  await sleep(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,a,input[type="submit"]')]
      .find(e => e.offsetParent!==null && /로그인/.test(e.textContent||e.value||''));
    if(b) b.click();
  });
  await sleep(5000);
  const stillPw = await page.evaluate(() => !!document.querySelector('input[type="password"]'));
  if(stillPw) throw new Error('로그인 실패 — 아이디/비밀번호 확인(BC_ID/BC_PW)');
  log('로그인 완료');
}

// ============================================================
// 2) 의뢰인 검색 화면 보장 (주소 입력칸이 뜨게)
// ============================================================
async function ensureSearchReady(page){
  for(let i=0;i<8;i++){
    const ready = await page.evaluate(() => !!document.querySelector('input[placeholder="주소를 입력하세요"]'));
    if(ready){ log('검색 입력칸 준비됨'); return; }
    // 단계별 best-effort 클릭: 시작하기 → (없으면) 설정/영업모드/영업모드 시작/의뢰인
    await page.evaluate(() => {
      const byText = (re) => [...document.querySelectorAll('button,a,div,li,span')]
        .filter(e => e.offsetParent!==null && re.test((e.textContent||'').trim()))
        .sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0];
      const order = [/^시작하기$/, /^의뢰인$/, /^영업모드 시작$/, /^영업모드$/, /^설정$/];
      for(const re of order){ const el = byText(re); if(el){ el.click(); break; } }
    });
    await sleep(1800);
  }
  throw new Error('검색 입력칸을 못 찾음(영업모드 진입 실패) — 셀렉터 확인 필요');
}

// ============================================================
// 3) 한 지역 분석 실행 → reels/{dongCd} 채워질 때까지
// ============================================================
async function runRegion(page, region){
  await ensureSearchReady(page);
  const startTs = now();
  const before = (await rget('reels')) || {};   // 분석 전 스냅샷

  // 주소 입력 + Enter (React 네이티브 setter)
  await page.evaluate((addr) => {
    const inp = [...document.querySelectorAll('input')].find(e => e.placeholder==='주소를 입력하세요');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(inp, addr);
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    inp.dispatchEvent(new Event('change',{bubbles:true}));
    inp.focus();
    ['keydown','keypress','keyup'].forEach(t => inp.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true})));
  }, region);
  log(`  검색 시작: ${region}`);

  // "분석 완료를 눌러주세요" 뜰 때까지 대기
  const tEnd = now() + ANALYZE_TIMEOUT;
  let done=false;
  while(now() < tEnd){
    const bt = await page.evaluate(() => (document.body.innerText||''));
    if(/분석 완료를 눌러|분석 완료/.test(bt)){ done=true; break; }
    await sleep(4000);
  }
  if(!done) throw new Error('분석 시간 초과');
  log('  분석 끝 → 분석 완료 클릭');

  // 분석 완료 클릭 (숫자 미러 기록됨)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,a,div')]
      .filter(e => e.offsetParent!==null && /분석 완료/.test(e.textContent||'') && (e.textContent||'').length<30)
      .sort((a,c)=>(a.textContent||'').length-(c.textContent||'').length)[0];
    if(b) b.click();
  });
  await sleep(3500);  // 리포트 렌더 대기

  // 캡처 실행 (이미지 업로드 발동) — 리포트 iframe 안에서
  const ifr = page.frames().find(f => /handoff_ref/.test(f.url()));
  if(ifr){
    try{
      await ifr.evaluate(() => { if(typeof window.__bcOpenCapture==='function') window.__bcOpenCapture(); });
      await sleep(2000);
      await ifr.evaluate(() => {
        const b = document.querySelector('[data-cap-confirm-jpg]') || document.querySelector('[data-cap-confirm]');
        if(b) b.click();
      });
      log('  캡처 실행(이미지 업로드 중)');
    }catch(e){ log('  캡처 트리거 경고:', e.message); }
  } else { log('  리포트 iframe 못 찾음 — 이미지 생략(숫자만)'); }

  // reels 에 새 결과(updatedAt > startTs) 들어올 때까지 대기 → 그 키 = dongCd
  const tEnd2 = now() + 90*1000;
  let dongCd=null;
  while(now() < tEnd2){
    const cur = (await rget('reels')) || {};
    if(cur.error){ throw new Error('reels 읽기 권한 막힘 — 콘솔 규칙에 reels ".read": true 필요'); }
    for(const k of Object.keys(cur)){
      const u = cur[k] && cur[k].updatedAt;
      if(u && u >= startTs && (!before[k] || (before[k].updatedAt||0) < u)){ dongCd = k; break; }
    }
    if(dongCd) break;
    await sleep(3000);
  }
  if(!dongCd) throw new Error('reels 기록 확인 실패');

  // 이미지까지 들어오면 더 좋음(최대 60초 추가 대기)
  const tEnd3 = now() + 60*1000;
  while(now() < tEnd3){
    const imgs = await rget(`reels/${dongCd}/images`);
    if(imgs && Object.values(imgs).filter(Boolean).length >= 3) break;
    await sleep(4000);
  }
  log(`  완료 → reels/${dongCd}`);
  return dongCd;
}

// ============================================================
// 4) 메인 루프 — 요청 큐 감시
// ============================================================
async function main(){
  log('reels-worker 시작. 앱:', APP_URL, '| headless:', HEADLESS);
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: HEADLESS, viewport:{width:1280,height:1000} });
  const page = ctx.pages()[0] || await ctx.newPage();
  await ensureLoggedIn(page);

  // 1회 테스트 모드: BC_TEST_REGION 지정 시 그 지역만 한 번 돌리고 종료(첫 설치 검증용)
  if(process.env.BC_TEST_REGION){
    log('★ 테스트 1회 실행:', process.env.BC_TEST_REGION);
    try{ const d = await runRegion(page, process.env.BC_TEST_REGION); log('★ 테스트 성공 → reels/'+d); }
    catch(e){ log('★ 테스트 실패:', e.message); }
    await ctx.close(); process.exit(0);
  }

  log('요청 큐 감시 시작 (reels_requests)');
  for(;;){
    try{
      const reqs = (await rget('reels_requests')) || {};
      const pending = Object.entries(reqs).filter(([id,r]) => r && r.status==='pending' && r.region);
      for(const [id, r] of pending){
        log('요청 처리:', id, r.region);
        await rpatch(`reels_requests/${id}`, { status:'processing', startedAt: now() });
        try{
          const dongCd = await runRegion(page, r.region);
          await rpatch(`reels_requests/${id}`, { status:'done', dongCd, doneAt: now() });
          log('  ✓ done:', r.region, '→', dongCd);
        }catch(e){
          await rpatch(`reels_requests/${id}`, { status:'error', error:String(e.message||e), doneAt: now() });
          log('  ✗ error:', r.region, e.message);
          // 화면 상태 초기화 위해 앱 새로고침
          try{ await page.goto(APP_URL, {waitUntil:'domcontentloaded'}); await sleep(3000); }catch(_){}
        }
      }
    }catch(e){ log('루프 오류:', e.message); }
    await sleep(POLL_MS);
  }
}

main().catch(e => { console.error('치명 오류:', e); process.exit(1); });
