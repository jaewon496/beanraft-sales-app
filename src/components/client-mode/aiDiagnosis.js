// ════════════════════════════════════════════════════════════════════════
// [2026-06-25] 통합 AI 진단 (배너 한 줄 · AI 종합 진단 단락 · 14개 카드 한 줄)
//
//   목표: "한 번의 제미나이 호출"로 14개 카드 데이터 + 각 기준치를 통째로 주고
//         구조화 출력(bannerLine / diagnosis / cardLines[14])을 받는다.
//
//   원칙(절대):
//   - 결정적: temperature 0 + 지역(dongCd) 캐시 → 같은 지역 재검색 = 호출 없이 동일 출력.
//   - 안전(폴백): AI 빈응답/에러/크레딧소진 시 호출부가 기존 결정적 텍스트
//     (bruSummary · bcOneLineSummary 배너/종합)를 그대로 쓴다. 여기선 null만 던진다.
//   - 진단만: 해결책(처방)은 사람(상담) 몫. "~하세요"류 조언 전면 금지(프롬프트로 강제).
//
//   이 파일은 '글(진단 텍스트)'만 생성한다. 점수·수치 계산은 일절 건드리지 않는다.
// ════════════════════════════════════════════════════════════════════════

const AI_DIAG_CACHE_PREFIX = 'bc_ai_diag_';   // 기존 키 컨벤션(bc_* snake_case) 준수
const AI_DIAG_SCHEMA_VER = 'v9';              // 프롬프트/스키마 바뀌면 올려서 캐시 무효화 (v9: 개인/프랜 비중 신호를 진짜 전국 평균 기준으로 — 전국 카페 개인 75%/프랜 25%(통계청 서비스업조사+공정위 가맹 2022, 출처 있는 실값)와 비교. 편차(%p) ≥10%p 일 때만 "전국 평균(개인 75%) 대비 N%p 높음/낮음" 신호, 미만이면 "전국 평균과 비슷한 수준"으로 자동 탈락. 옛 "내부 50/50 lean" 내부비교 폐기(배수는 보조로만 유지) / v8: 전년대비 매출 변화율을 동 단위(saleAmt/prevYearAmt, 점포 60~70개 소표본 노이즈로 ±수십% 요동)에서 구 단위(guAmt/prevYearGuAmt, 점포 600여 개 안정)로 교정 — '전년 대비 28% 감소·하락세' 거짓 신호 제거, 시장규모 +31%·구 평탄과 일관 / v7: 가짜 비교기준 전수 제거 — 개인/프랜 "전국평균(반반=50)"·ROI "평균 50"·공실률 "통상 7%" 상수 가정 삭제. 개인↔프랜=내부 배수, ROI=점수자체, 공실=값자체, 전년대비=전년기준으로 정직화 / v6: 매출 시군구 기준을 실제 필드 guAvg로 교정·드롭됐던 매출 신호 복구 / v5: bundle에서 상위20%매출 raw 제거·매출 비교 앵커 시군구 한정 / v4: 매출 신호 시군구 라벨 명시 / 개인↔프랜 거울상 한쪽만 신호)
const AI_DIAG_TIMEOUT_MS = 26000;

// ─────────────────────────────────────────────────────────────────────────
// Phase 1 통계 선별 임계값 (결정적 — 난수/Date 절대 금지)
//   "진짜 튀는 신호만" AI에 넘기기 위한 컷오프. 메모리 "점포 30개 미만 경고" 논리 재사용.
// ─────────────────────────────────────────────────────────────────────────
const SIGNAL_DEV_THRESHOLD = 15;   // |편차%| 이 값 미만이면 "평균 수준"으로 빼고 신호에서 제외
const SIGNAL_MIN_SAMPLE = 30;      // 점포수(모수)가 이보다 작으면 effect-size 강등 대상
const SIGNAL_WEAK_FACTOR = 0.5;    // 모수 부족 시 편차에 곱하는 감쇠 계수 (가짜 신호 약화)
// ★[2026-06-25 sanity clamp] |편차%|가 이 값을 넘으면 "단위/필드 불일치" 의심 → 그 신호를 통째로 드롭.
//   (예: 평당월세 406 vs 23 단위 섞임 = 1665% 같은 쓰레기가 다시는 출력에 안 들어가게 하는 안전장치.)
const SIGNAL_SANITY_MAX_DEV = 300;

// ─────────────────────────────────────────────────────────────────────────
// 전국 카페 개인/프랜차이즈 구성비 — 공식 통계 실값 (가짜 가정 아님, 출처 명확)
//   전국 카페 개인 74~75% / 프랜차이즈 25% — 통계청 서비스업조사(매장총수) + 공정위 가맹사업 현황(2022, 전국 약 100,729곳)
//   ※ 이건 코드에 박은 임의 상수(예: 옛 "반반=50")가 아니라 출처 있는 전국 평균 실값이라
//     "전국 평균(개인 75%) 대비"라고 써도 program-output-data-only 위반이 아니다.
// ─────────────────────────────────────────────────────────────────────────
const NATIONAL_INDIE_PCT = 75;          // 전국 카페 개인 비중 % (통계청 서비스업조사+공정위 가맹 2022)
const NATIONAL_FRANCH_PCT = 25;         // 전국 카페 프랜차이즈 비중 % (합 100)
// 전국 평균(개인 75%)과의 편차(%p)가 이 값 미만이면 "전국 평균과 비슷한 수준"으로 신호에서 자동 탈락(abstention).
//   예: 연신내 개인 77% vs 전국 75% = +2%p → 임계 미만 → 신호 안 됨. 진짜 튀는 동네(개인 50%/95%)만 신호.
const INDIE_NATIONAL_DEV_THRESHOLD = 10;
// 편차%가 비현실적으로 크면 true(=드롭 대상). null은 안전(드롭 안 함).
function _isInsaneDev(dev) {
  const d = _num(dev);
  return d !== null && Math.abs(d) > SIGNAL_SANITY_MAX_DEV;
}

// 화면 카드 순서(badge 1~14)와 데이터 인덱스(cards[]) 매핑.
//   cards[]: 0상권 1고객 2변화 3프랜 4개인 5매출 6유동 7임대 8기회 9배달 10SNS 11날씨 12경쟁 13종합
//   화면 순서도 동일(개인↔매출 스왑은 렌더 컴포넌트 함수 스왑이라 데이터 인덱스는 그대로).
const CARD_TITLES = [
  '상권 분석 리포트', '고객 분석', '상권 변화 추이', '프랜차이즈 현황',
  '개인 카페 분석', '매출 분석', '유동인구', '임대/창업 정보',
  '카페 기회', '배달 객단가', 'SNS 트렌드', '연간 기상 분포',
  '상권 경쟁 분석', 'AI 종합 분석',
];

// ─────────────────────────────────────────────────────────────────────────
// 안전 헬퍼 (NaN/null 차단, 빈값은 통째로 생략 → 지어내기 방지)
// ─────────────────────────────────────────────────────────────────────────
function _num(v) {
  const n = Number(v);
  return (typeof n === 'number' && isFinite(n)) ? n : null;
}
function _str(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === '-' || s === '–' || s === 'null' || s === 'undefined') return null;
  return s;
}
// 객체에서 null 값 키를 제거(빈 항목은 AI에 주지 않는다 = 없는 사실 단정 방지)
function _clean(obj) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    const v = obj[k];
    if (v === null || v === undefined) return;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const c = _clean(v);
      if (Object.keys(c).length > 0) out[k] = c;
    } else if (Array.isArray(v)) {
      if (v.length > 0) out[k] = v;
    } else if (typeof v === 'string') {
      const s = _str(v);
      if (s !== null) out[k] = s;
    } else {
      out[k] = v;
    }
  });
  return out;
}

// 기준월(YYYY년 M월) → 계절 라벨. 메뉴 순행/역행 판정용.
function _seasonOf(asOf) {
  const s = String(asOf || '');
  const m = s.match(/(\d{1,2})\s*월/);
  const mo = m ? parseInt(m[1], 10) : 0;
  if (mo >= 3 && mo <= 5) return '봄';
  if (mo >= 6 && mo <= 8) return '여름';
  if (mo >= 9 && mo <= 11) return '가을';
  if (mo === 12 || mo === 1 || mo === 2) return '겨울';
  return null;
}

// ═════════════════════════════════════════════════════════════════════════
// Phase 1 — 통계 선별 레이어 (AI = 진단가 → 통역가)
//   AI에 넘기기 전에 "진짜 튀는 신호만" 코드가 먼저 거른다. 평균 수준은 제외.
//   전부 결정적(난수/Date 금지). 외부 호출 0 — 이미 모인 bundle 데이터만 가공.
// ═════════════════════════════════════════════════════════════════════════

// 1) 거리(편차) 점수화: 값이 기준치 대비 몇 % 벗어났는지. (값/기준−1)×100.
function _pctDev(value, baseline) {
  const v = _num(value), base = _num(baseline);
  if (v === null || base === null || base === 0) return null;
  return Math.round((v / base - 1) * 100);
}

// 2) effect-size 가중: 모수(점포수)가 SIGNAL_MIN_SAMPLE 미만이면 편차를 감쇠(가짜신호 강등).
//   메모리 "시군구 평균 1.5배 이상 + 점포 30개 미만 = 이상치 경고" 논리 재사용.
function _attenuate(dev, sampleN) {
  if (dev === null) return null;
  const n = _num(sampleN);
  if (n !== null && n < SIGNAL_MIN_SAMPLE) return Math.round(dev * SIGNAL_WEAK_FACTOR);
  return dev;
}

// 퍼센트 문자열에서 "비율 숫자"만 추출. "카페 5년 42%" 처럼 '5년'의 5를 잡지 않도록
//   ①'NN%' 패턴 우선 → ②없으면 마지막 숫자(보통 비율이 뒤에 옴).
function _pctFromStr(s) {
  const str = String(s || '');
  const m = str.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return _num(m[1]);
  const all = str.match(/\d+(?:\.\d+)?/g);
  if (all && all.length) return _num(all[all.length - 1]);
  return null;
}

// 3) 계절성 판정: 메뉴 seasonHint vs 기준월 season → 순행(제철=노이즈)/역행(이상신호).
function _seasonRelation(seasonHint, season) {
  if (!seasonHint || seasonHint === '계절무관' || !season) return '무관';
  const isHot = (s) => s === '여름';
  const isCold = (s) => s === '겨울';
  if (seasonHint === '여름성') return isHot(season) ? '순행' : (isCold(season) ? '역행' : '무관');
  if (seasonHint === '겨울성') return isCold(season) ? '순행' : (isHot(season) ? '역행' : '무관');
  return '무관';
}

// 4) 신호 1개 만들기. |감쇠편차|가 임계 이상이면 신호로 채택, 아니면 null(=평균 수준).
//   { 항목, 값, 기준, 편차퍼센트, 방향 } — 톤을 편차 크기에 비례시키도록 크기+방향을 같이 준다.
function _makeSignal(label, value, baseline, sampleN) {
  const rawDev = _pctDev(value, baseline);
  const dev = _attenuate(rawDev, sampleN);
  if (dev === null) return { signal: null, dropped: { 항목: label, 사유: '기준없음' } };
  // sanity clamp: 비현실적 편차 = 단위/필드 불일치 의심 → 드롭(출력에 안 넣음).
  if (_isInsaneDev(dev)) {
    return { signal: null, dropped: { 항목: label, 편차퍼센트: dev, 사유: '단위이상_드롭' } };
  }
  if (Math.abs(dev) < SIGNAL_DEV_THRESHOLD) {
    return { signal: null, dropped: { 항목: label, 편차퍼센트: dev, 사유: '평균수준' } };
  }
  return {
    signal: _clean({
      항목: label, 값: _num(value), 기준: _num(baseline),
      편차퍼센트: dev, 방향: dev > 0 ? '높음' : '낮음',
    }),
    dropped: null,
  };
}

// 매출 위치를 신호로: 매출이 '시군구 평균' 대비 어디인가. 비교 기준은 오직 시군구 평균.
//   ★[2026-06-25 앵커 한정] 주 편차 기준 = '시군구평균'(md). 매출 카드 헤드라인이
//     'monthlyAvgSales(분위 평균) vs 시군구평균'으로 -51%를 보이므로, AI 진단도 같은 기준을 써야
//     한 리포트 안에서 두 숫자(-51% vs 옛 -60%)가 어긋나지 않는다.
//   ★상위20%(high) 폴백을 제거했다 — 통역가가 상위20%를 비교 기준으로 쓰는 길 자체를 닫는다.
//     시군구평균이 없으면 매출 신호를 만들지 않는다(억지 비교 금지).
function _quantileSignal(label, value, low, mid) {
  const v = _num(value), md = _num(mid);
  if (v === null) return { signal: null, dropped: null };
  // 비교 기준은 시군구평균(md) 하나뿐. 없으면 신호 없음(상위20% 등 다른 기준으로 바꾸지 않음).
  if (md === null || md <= 0) return { signal: null, dropped: null };
  const base = md;
  const dev = Math.round((v / base - 1) * 100);
  // sanity clamp: 비현실적 편차 = 단위/필드 불일치 의심 → 드롭.
  if (_isInsaneDev(dev)) {
    return { signal: null, dropped: { 항목: label, 편차퍼센트: dev, 사유: '단위이상_드롭' } };
  }
  if (Math.abs(dev) < SIGNAL_DEV_THRESHOLD) {
    return { signal: null, dropped: { 항목: label, 편차퍼센트: dev, 사유: '평균수준' } };
  }
  // ★비교기준 라벨을 '시군구평균'으로 고정 — 통역가가 다른 기준으로 바꿔 라벨링할 근거를 주지 않는다.
  return {
    signal: _clean({
      항목: label, 값: v,
      기준: base, 비교기준: '시군구평균',
      편차퍼센트: dev, 방향: dev > 0 ? '높음' : '낮음',
    }),
    dropped: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 선별기 본체 — bundle.cards(이미 가공된 14종 수치)에서 "튀는 신호"만 추린다.
//   반환: { signals[], averages[], menuNote } — AI엔 signals만 의미부여, averages는 "언급 금지" 목록.
//   판단 근거가 되는 기준치는 cardData 안에 이미 들어있음(전국/시군구/모수/분위).
// ─────────────────────────────────────────────────────────────────────────
function extractSignals(cardData, benchmarks, menuRising, season) {
  const signals = [];
  const averages = [];
  const push = (r, cardIdx, title) => {
    if (!r) return;
    if (r.signal) signals.push(_clean({ 카드: cardIdx, 카드명: title, ...r.signal }));
    else if (r.dropped && r.dropped.사유 === '평균수준') averages.push(`${title}:${r.dropped.항목}`);
  };
  const C = (i) => (cardData && cardData[i]) ? cardData[i] : {};

  const c0 = C(0), c2 = C(2), c3 = C(3), c5 = C(5), c8 = C(8), c12 = C(12), c13 = C(13);

  // 5 매출 — 시군구 평균 대비 위치만 본다(상위20% 비교 기준은 제거). 큰 음/양 편차가 진짜 신호.
  push(_quantileSignal('월평균매출', c5.월평균매출만원, c5.동평균매출만원, c5.시군구평균매출만원),
       5, CARD_TITLES[5]);
  // 시군구 대비 동평균 자체의 편차(분위와 별개로 동네 위치)
  push(_makeSignal('동평균_시군구대비', c5.동평균매출만원, c5.시군구평균매출만원, c0.카페수), 5, CARD_TITLES[5]);
  // 전년대비 성장 — ★실데이터 필드(prevYearRate/yoyGrowth, 매출 카드가 "+N% 작년 대비"로 직접 표시).
  //   이건 '전년(작년) 대비' 실제 시계열 변화율이라 정직한 비교다(외부 평균 가정 아님).
  //   ★단 '편차퍼센트' 라벨은 통역가가 '평균 대비'로 오독할 여지가 있어 빼고, 비교기준을 '전년'으로 명시한다.
  if (_num(c5.전년대비성장) !== null) {
    const g = _num(c5.전년대비성장);
    if (_isInsaneDev(g)) { /* 단위이상 → 드롭(언급도 안 함) */ }
    else if (Math.abs(g) >= SIGNAL_DEV_THRESHOLD) {
      signals.push(_clean({ 카드: 5, 카드명: CARD_TITLES[5], 항목: '전년대비성장률', 값: Math.round(g), 비교기준: '전년', 방향: g > 0 ? '높음' : '낮음' }));
    } else if (g !== null) { averages.push(`${CARD_TITLES[5]}:전년대비성장`); }
  }

  // 2 상권 변화 — 신규/폐업 순증을 모수(카페수) 대비 비율로. ★연신내 -7/139 ≈ -5% < 15% → 제외돼야 함.
  if (_num(c2.신규) !== null && _num(c2.폐업) !== null && _num(c0.카페수) !== null && c0.카페수 > 0) {
    const net = c2.신규 - c2.폐업;
    const netPct = Math.round(net / c0.카페수 * 100);
    if (_isInsaneDev(netPct)) { /* 단위이상 → 드롭 */ }
    else if (Math.abs(netPct) >= SIGNAL_DEV_THRESHOLD) {
      signals.push(_clean({ 카드: 2, 카드명: CARD_TITLES[2], 항목: '점포순증', 값: net, 모수: c0.카페수, 편차퍼센트: netPct, 방향: net > 0 ? '높음' : '낮음' }));
    } else {
      averages.push(`${CARD_TITLES[2]}:점포순증(${net}/${c0.카페수}=${netPct}%)`);
    }
  }
  // 생존율 — 카페 5년 기준 대비(기준은 문자열이라 숫자 추출 시도).
  push(_makeSignal('5년생존율_카페기준대비', c2['5년생존율'], _pctFromStr(c2.카페5년생존_기준), c0.카페수),
       2, CARD_TITLES[2]);

  // 0·3 개인비중 ↔ 프랜차이즈점유율 — 둘은 합이 100%인 거울상(같은 말 두 번).
  //   ★[2026-06-25 진짜 전국평균 기준] 비교 기준을 '전국 카페 개인 75%/프랜 25%'(통계청 서비스업조사+공정위
  //     가맹 2022, 출처 있는 실값)로 박는다. 옛 "반반=50" 임의 상수가 아니라 공식 통계 실값이라
  //     "전국 평균(개인 75%) 대비"라고 출력해도 된다.
  //   ★판정: 이 상권 개인비중(%) vs 전국 75%. 편차(%p) 절댓값이 임계(INDIE_NATIONAL_DEV_THRESHOLD=10%p)
  //     이상일 때만 신호("전국 평균(개인 75%) 대비 높음/낮음 N%p"). 임계 미만이면 "전국 평균과 비슷한 수준"으로
  //     averages 로 자동 탈락(abstention) — 부풀린 신호 금지.
  //     예: 연신내 개인 77% vs 75% = +2%p < 10 → 신호 안 됨. 개인 95% = +20%p / 개인 50% = -25%p → 신호.
  //   ★한쪽만 신호로 올린다(거울상 중복 방지). 개인비중을 대표로 쓰고, 프랜은 averages 로 보낸다.
  //   ★내부배수(개인이 프랜의 몇 배)는 출력에 보조로만 함께 둔다(주된 비교는 전국 평균 기준).
  {
    const indie = _num(c0.개인비중퍼센트);   // 개인 카페 비중 %
    const franch = _num(c3.점유율);          // 프랜차이즈 점유율 %
    // 같은 데이터 내부 배수(개인이 프랜의 몇 배). 0 분모 방어. — 보조 표현용(주 비교는 전국 평균).
    const ratioOf = (a, b) => (a !== null && b !== null && b > 0) ? Math.round((a / b) * 10) / 10 : null;

    if (indie !== null) {
      // 전국 평균(개인 75%)과의 편차(%p). 절댓값이 임계 이상일 때만 신호.
      const devPp = Math.round(indie - NATIONAL_INDIE_PCT);   // %p (퍼센트포인트)
      if (Math.abs(devPp) >= INDIE_NATIONAL_DEV_THRESHOLD) {
        signals.push(_clean({
          카드: 0, 카드명: CARD_TITLES[0], 항목: '카페구성_개인비중',
          개인비중퍼센트: indie, 프랜차이즈비중퍼센트: franch,
          전국개인평균퍼센트: NATIONAL_INDIE_PCT, 전국프랜평균퍼센트: NATIONAL_FRANCH_PCT,
          비교기준: '전국평균(개인75%)',
          전국대비편차포인트: devPp,                 // %p (전국 평균 75% 대비)
          개인대프랜배수: ratioOf(indie, franch),    // 보조 — 같은 상권 내부 배수
          방향: devPp > 0 ? '높음' : '낮음',
        }));
      } else {
        // 전국 평균과 비슷한 수준 → 신호 탈락. 거울상(프랜)도 함께 평균으로.
        averages.push(`${CARD_TITLES[0]}:개인카페비중`);
      }
    } else if (franch !== null) {
      // 개인비중이 없고 프랜만 있으면 프랜 → 개인으로 환산해 동일 기준 적용.
      const indieFromFranch = 100 - franch;
      const devPp = Math.round(indieFromFranch - NATIONAL_INDIE_PCT);
      if (Math.abs(devPp) >= INDIE_NATIONAL_DEV_THRESHOLD) {
        signals.push(_clean({
          카드: 0, 카드명: CARD_TITLES[0], 항목: '카페구성_개인비중',
          개인비중퍼센트: indieFromFranch, 프랜차이즈비중퍼센트: franch,
          전국개인평균퍼센트: NATIONAL_INDIE_PCT, 전국프랜평균퍼센트: NATIONAL_FRANCH_PCT,
          비교기준: '전국평균(개인75%)',
          전국대비편차포인트: devPp,
          개인대프랜배수: ratioOf(indieFromFranch, franch),
          방향: devPp > 0 ? '높음' : '낮음',
        }));
      } else { averages.push(`${CARD_TITLES[0]}:개인카페비중`); }
    }
    // 거울상(프랜차이즈 점유율)은 항상 averages 로 — 신호 중복 방지.
    if (franch !== null) averages.push(`${CARD_TITLES[3]}:프랜차이즈점유율`);
  }

  // 7 임대 — 평당월세 vs 지역평균.
  push(_makeSignal('평당월세_지역평균대비', C(7).평당월세만원, C(7).평당월세_지역평균만원, c0.카페수), 7, CARD_TITLES[7]);

  // 8 공실률 — ★[2026-06-25 가짜기준 제거] 예전엔 '통상 7%'라는 코드상수를 기준으로 "7% 대비 N%"를 냈는데,
  //   '평균 공실률 7%'는 실데이터 필드가 아니라 박아둔 상수 = 외부평균 지어내기.
  //   공실률은 그 자체가 절대 수치(높으면 빈 상가 많음)라 비교 기준 없이 '값 자체'만 말하면 된다.
  //   7%는 '눈에 띄게 높은 공실인가'(surface 여부) 판단에만 쓰고 출력엔 안 넣는다.
  //   카페상가 공실은 보통 한 자릿수라 두 자릿수(12% 이상)면 분명히 높은 신호로만 본다.
  if (_num(c8.공실률) !== null) {
    const vac = _num(c8.공실률);
    if (vac >= 0 && vac <= 100) {   // 단위 정상 범위만(잘못된 단위 유입 방어)
      if (vac >= 12) {
        signals.push(_clean({ 카드: 8, 카드명: CARD_TITLES[8], 항목: '공실률', 값: vac, 방향: '높음' }));
      } else { averages.push(`${CARD_TITLES[8]}:공실률`); }
    }
  }

  // 12 ROI 종합점수 — ★[2026-06-25 가짜기준 제거] 예전엔 '50점=평균' 가정으로 "평균 대비 N%"를 냈는데,
  //   '전국 평균 ROI 점수'는 실데이터 필드가 아니라 코드에 박은 상수(50)였다 = 지어내기.
  //   종합점수는 그 자체가 0~100 절대 등급(화면도 "종합 점수 68점"으로 단독 표기, '평균 대비' 없음)이라
  //   비교 기준이 필요 없다. 외부평균 비교 없이 '점수 자체 + 밀집도 라벨'을 사실로만 올린다.
  //   50은 '점수가 한쪽으로 충분히 치우쳐 surface할 가치가 있나' 판단(우세도)에만 쓰고 출력엔 안 넣는다.
  if (_num(c12.종합점수) !== null) {
    const lean = Math.abs(c12.종합점수 - 50);   // 우세도(내부 판단용) — 출력 안 함
    if (lean >= SIGNAL_DEV_THRESHOLD) {
      signals.push(_clean({ 카드: 12, 카드명: CARD_TITLES[12], 항목: 'ROI종합점수', 점수: _num(c12.종합점수), 밀집도라벨: _str(c12.카페밀집도라벨), 방향: (c12.종합점수 - 50) > 0 ? '높음' : '낮음' }));
    } else { averages.push(`${CARD_TITLES[12]}:ROI종합점수`); }
  }

  // 13 기회/리스크 건수 — 어느 한쪽이 크게 우세할 때만.
  if (_num(c13.기회건수) !== null && _num(c13.리스크건수) !== null) {
    const diff = c13.기회건수 - c13.리스크건수;
    if (Math.abs(diff) >= 2) {
      signals.push(_clean({ 카드: 13, 카드명: CARD_TITLES[13], 항목: '기회_리스크균형', 기회: c13.기회건수, 리스크: c13.리스크건수, 방향: diff > 0 ? '높음' : '낮음' }));
    } else { averages.push(`${CARD_TITLES[13]}:기회리스크균형`); }
  }

  // 3) 계절성 — 메뉴 급등: 순행(제철)=노이즈로 제외, 역행만 신호 후보.
  let menuNote = null;
  if (Array.isArray(menuRising) && menuRising.length > 0) {
    const counter = [];
    const seasonal = [];
    menuRising.forEach((m) => {
      const rel = _seasonRelation(m && m.seasonHint, season);
      if (rel === '역행') counter.push(m.name);
      else if (rel === '순행') seasonal.push(m.name);
    });
    if (counter.length > 0) {
      signals.push(_clean({ 카드: 4, 카드명: '메뉴', 항목: '계절역행메뉴', 메뉴: counter, 기준월계절: season, 방향: '이상신호' }));
    }
    menuNote = _clean({ 제철순행_제외: seasonal.length > 0 ? seasonal : null, 기준월계절: season });
  }

  return _clean({ signals, averages, menuNote });
}

// ─────────────────────────────────────────────────────────────────────────
// 데이터 번들 — 14개 카드 핵심 수치 + 각 수치의 기준치(전국/시군구/모수/분위)
//   cards[]: 데이터 인덱스 bodyData 배열 (UnifiedLayout 의 raw cards).
//   kosisBoxData/collectedData: 통합 평당월세·소비심리·기준월 등 보조 기준치.
// ─────────────────────────────────────────────────────────────────────────
export function buildDiagnosisBundle({ cards, kosisBoxData, collectedData, dataAsOf, address, radius }) {
  const b = (j) => (cards && cards[j] && cards[j].bodyData) ? cards[j].bodyData : {};
  const asOf = _str(dataAsOf) || '';
  const season = _seasonOf(asOf);

  const c0 = b(0), c1 = b(1), c2 = b(2), c3 = b(3), c4 = b(4), c5 = b(5), c6 = b(6),
        c7 = b(7), c8 = b(8), c9 = b(9), c10 = b(10), c11 = b(11), c12 = b(12), c13 = b(13);

  // 통합 평당 월세(만원/평) — 카드 0/7 KPI(integratedRent)와 동일 산출.
  const integratedRentPy = (() => {
    const ir = kosisBoxData && kosisBoxData.integratedRent;
    if (ir && _num(ir.value)) {
      return (typeof ir.unit === 'string' && ir.unit.indexOf('만원') >= 0)
        ? Math.round(ir.value) : Math.round(ir.value / 10000);
    }
    if (kosisBoxData && kosisBoxData.marketRent && _num(kosisBoxData.marketRent.value)) {
      return Math.round(kosisBoxData.marketRent.value / 10000);
    }
    return null;
  })();

  // 메뉴 급등 항목 + 계절 성격 힌트(순행/역행 판정 재료). cards[?] 에 menuTrend류가 있으면 사용.
  const menuRising = (() => {
    const raw = c4.risingMenus || c4.menuTrend || c5.risingMenus || (collectedData && collectedData.menuTrend);
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const seasonHint = (name) => {
      const n = String(name);
      if (/(아이스|ice|에이드|빙수|냉|스무디|프라페)/i.test(n)) return '여름성';
      if (/(따뜻|hot|뱅쇼|핫|카푸치노|군고구마|호빵)/i.test(n)) return '겨울성';
      if (/(빙수)/.test(n)) return '여름성';
      return '계절무관';
    };
    return raw.slice(0, 8).map((m) => {
      const name = _str(m && (m.name || m.menu || m.keyword)) || _str(m);
      if (!name) return null;
      return _clean({ name, seasonHint: seasonHint(name) });
    }).filter(Boolean);
  })();

  // 14개 카드 핵심 수치 + 기준치. null 키는 _clean 으로 제거(없는 사실 단정 방지).
  const cardData = [
    // 0 상권 분석
    _clean({
      카페수: _num(c0.cafes), 개인: _num(c0.individual), 프랜차이즈: _num(c0.franchise),
      개인비중퍼센트: (_num(c0.cafes) && _num(c0.individual)) ? Math.round(c0.individual / c0.cafes * 100) : null,
      반경m: _num(radius), 평당월세만원: integratedRentPy,
    }),
    // 1 고객 분석
    _clean({
      주연령: _str(c1.topAge), 여성비율: _num(c1.femaleRatio), 남성비율: _num(c1.maleRatio),
      재방문율: _num(c1.revisitRate), 신규비율: _num(c1.newRatio),
    }),
    // 2 상권 변화 추이
    _clean({
      '3년생존율': _num(c2.survivalRate3y), '1년생존율': _num(c2.survivalRate1y), '5년생존율': _num(c2.survivalRate5y),
      카페5년생존_기준: _str(c2.cafeIndustry5yr), 전산업5년생존_기준: _str(c2.allIndustry5yr),
      신규: _num(c2.openCount), 폐업: _num(c2.closeCount), 추세: _str(c2.trend),
    }),
    // 3 프랜차이즈 현황
    _clean({
      프랜차이즈수: _num(c3.franchiseCount), 점유율: _num(c3.franchiseShare), 브랜드수: _num(c3.brandCount),
    }),
    // 4 개인 카페 분석
    _clean({
      개인카페수: _num(c4.indieCount), 개인아메리카노평균: _num(c4.americanoAvg),
      개인대프랜차이즈가격차: (c4.indieFranchPriceCompare && _num(c4.indieFranchPriceCompare.indie) && _num(c4.indieFranchPriceCompare.franch))
        ? Math.round(c4.indieFranchPriceCompare.franch - c4.indieFranchPriceCompare.indie) : null,
    }),
    // 5 매출 분석 (월평균=분위 평균901 단일값)
    //   ★[2026-06-25 앵커 한정] AI 진단 입력에는 매출 비교 기준을 '시군구평균(과 동평균)'만 남긴다.
    //     '상위20퍼센트매출만원' raw 숫자를 주면 통역가가 그걸 보고 멋대로 "상위 20% 대비"로
    //     비교해 매출 카드(-51%, 시군구 기준)와 숫자가 어긋났음 → bundle에서 통째로 제거.
    //     (매출 카드 화면의 상위20% 표시는 UnifiedLayout/dataMapper에 그대로 — 여기선 AI 입력만 한정.)
    //   ★[2026-06-25 회귀버그 수정] 시군구 평균은 card5 bodyData 의 실제 필드 'guAvg' 다.
    //     직전 작업이 없는 이름(sigunguCafeAvg)을 찾아 항상 null → 매출 신호가 통째로 드롭됐었다.
    //     매출 카드 헤드라인 "시군구 평균 대비 -51%"의 바로 그 출처(guAvg=1854)와 동일하게 맞춘다.
    //     guAvg 없으면 dongAvg → siAvg 폴백(매출 카드와 같은 계열 평균).
    _clean({
      월평균매출만원: _num(c5.monthlyAvgSales) || _num(c5.dongCafeAvgStable) || _num(c5.monthly),
      동평균매출만원: _num(c5.dongCafeAvgStable) || _num(c5.dongAvg),
      시군구평균매출만원: _num(c5.guAvg) || _num(c5.dongAvg) || _num(c5.siAvg),
      전년대비성장: _num(c5.yoyGrowth) || _num(c5.prevYearRate),
    }),
    // 6 유동인구
    _clean({
      일유동인구: _num(c6.totalPop), 평일비중: _num(c6.weekdayPct), 주말비중: _num(c6.weekendPct),
      피크시간: _str(c6.peakHour),
    }),
    // 7 임대/창업
    //   ★[2026-06-25 단위버그 수정] 평당월세는 반드시 '만원/평' 단위 필드(rentPerPyeongManwon)를 쓴다.
    //     bd.rentPerPyeong(=406)은 원시/잘못된 단위라 신호 추출기가 "1665% 높은 406만원" 쓰레기를 냈음.
    //     화면 카드(cards-b.jsx)도 rentPerPyeongManwon → integratedRent → rentPerPyeong 순으로 만원값을 잡는다(동일 체인).
    //     보증금도 depositManwon(만원) 우선, 권리금 premiumCost(만원)은 그대로.
    _clean({
      평당월세만원: _num(c7.rentPerPyeongManwon) || integratedRentPy || _num(c7.rentPerPyeong),
      권리금만원: _num(c7.premiumCost),
      보증금만원: _num(c7.depositManwon) || _num(c7.deposit),
      평당월세_지역평균만원: integratedRentPy,
    }),
    // 8 카페 기회
    _clean({
      공실률: _num(c8.vacancy), 신규오픈: _num(c8.newOpen), 개인비중: _num(c8.individualPct),
    }),
    // 9 배달 객단가
    _clean({
      배달객단가원: (_num(c9.searchAvgPrice) >= 1000 && _num(c9.searchAvgPrice) < 100000) ? Math.round(c9.searchAvgPrice) : null,
      배달주문건수: _num(c9.searchOrders), 배달매출만원: _num(c9.searchSales),
    }),
    // 10 SNS 트렌드
    _clean({
      키워드: Array.isArray(c10.keywords) ? c10.keywords.slice(0, 12) : null,
      긍정비율: (_num(c10.positiveRatio) > 0 && _num(c10.positiveRatio) <= 100) ? Math.round(c10.positiveRatio * 10) / 10 : null,
      검색의도: Array.isArray(c10.searchIntents) ? c10.searchIntents.slice(0, 7) : null,
      블로그언급: _num(c10.blogMentions),
    }),
    // 11 연간 기상 분포
    _clean({
      겨울최저: _num(c11.winterMin), 여름최고: _num(c11.summerMax), 연평균기온: _num(c11.avgTemp),
      강수일비율: _num(c11.rainyPct),
    }),
    // 12 상권 경쟁 분석 (ROI 5축 — 점수는 화면값 그대로, 변경 금지)
    _clean({
      카페밀집도라벨: _str(c12.level), 종합점수: _num(c12.score),
      수익성점수: _num(c12.scoreMarket), 투자회수점수: _num(c12.scoreCompete),
      경쟁여건점수: _num(c12.scoreChange), 생존안정점수: _num(c12.scoreSurvival), 성장성점수: _num(c12.scoreCost),
      예상월수익만원: _num(c12.roiMonthlyProfit), 회수개월: _num(c12.roiPaybackMonths),
    }),
    // 13 AI 종합 분석
    _clean({
      종합점수: _num(c13.overallScore) || _num(c12.score), 기회건수: _num(c13.opportunities), 리스크건수: _num(c13.risks),
    }),
  ];

  const benchmarks = _clean({
    소비심리: _str(kosisBoxData && kosisBoxData.consumerSentiment && kosisBoxData.consumerSentiment.value),
    소비심리기준: _str(kosisBoxData && kosisBoxData.consumerSentiment && kosisBoxData.consumerSentiment.period),
    카페폐업률: _str(kosisBoxData && kosisBoxData.cafeClosure && kosisBoxData.cafeClosure.value),
    평당월세_지역평균만원: integratedRentPy,
  });

  // Phase 1 — 통계 선별: "진짜 튀는 신호"만 추리고, 평균 수준은 averages로 분리.
  const selected = extractSignals(cardData, benchmarks, menuRising, season);

  return _clean({
    address: _str(address),
    radius: _num(radius),
    dataAsOf: asOf || null,
    season,
    cards: cardData,
    benchmarks,
    menuRising,
    // ↓ Phase 1 산출물 — AI는 signals만 의미부여, averages는 절대 언급 금지.
    signals: selected.signals,
    averages: selected.averages,
    menuNote: selected.menuNote,
    signalCount: Array.isArray(selected.signals) ? selected.signals.length : 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 프롬프트 — 디시플린을 토씨까지 박는다(이게 핵심).
// ─────────────────────────────────────────────────────────────────────────
export function buildDiagnosisPrompt(bundle) {
  const titleList = CARD_TITLES.map((t, i) => `${i}. ${t}`).join(' / ');
  const sc = Number(bundle.signalCount || 0);
  const abstain = sc <= 1;
  return `당신은 카페 상권 분석 리포트의 "통역가"다. 진단은 이미 끝났다. 아래 [튀는 신호]는 코드가 통계로 "전국/시군구/모수/분위 기준 대비 진짜 튀는 항목만" 골라낸 사실이다. 너의 일은 이 사실들을 자연스러운 한국어 문장으로 옮기는 것뿐이다.
출력은 반드시 순수 JSON 객체 하나. 첫 글자 { 마지막 글자 }. 마크다운/코드블록 금지. 존댓말.

[너의 역할 — 절대]
- 너는 "진단가"가 아니라 "통역가"다. 새로 진단/추론/판단하지 마라. 주어진 [튀는 신호]를 문장으로 옮기기만 해라.
- ★[튀는 신호]에 없는 항목은 전부 "전국 평균 수준"이라는 뜻이다. 그런 항목은 절대 언급·추측·평가하지 마라. ([평균 수준 항목]에 적힌 것들이 그 예시다 — 이것들을 "쇠퇴/위축/부진/포화" 등으로 단정하면 거짓이다.)
- 해결책·처방은 사람(상담) 몫이다. "~하세요 / ~하면 됩니다 / ~를 노려라 / 차별화하라 / 메뉴 개발 / 시그니처 / 비용 절감 / 회전율 공략 / 객단가를 올려라" 같은 조언·처방·권유는 전면 금지.

[톤 — 편차 크기에 비례]
- 각 신호의 "편차퍼센트" 절댓값이 톤의 세기다. 작으면(15~30%) 담담하게, 크면(50% 이상) 또렷하게. ★doom(쇠퇴·붕괴·마이너스 강조 과장)도 spin(과장된 긍정)도 금지.
- 신호가 "낮음"이라고 곧장 "쇠퇴/위축"으로 비약하지 마라. "(기준) 대비 (몇 %) 낮은 수준" 정도로 사실에 비례해 적는다.
- ★기준 라벨은 신호의 "비교기준" 값을 그대로 써라. "비교기준":"시군구평균"이면 "시군구 평균 대비"라고 적는다. 신호에 없는 "상위 20% 기준" 같은 다른 기준으로 바꿔 쓰지 마라(매출 카드와 숫자가 어긋난다).
- ★★매출(월평균매출) 평균의 비교 기준은 오직 "시군구 평균"이다. "상위 20% 대비" 등 다른 기준으로 매출을 비교하지 마라.
- ★★★[가짜 기준 절대 금지] 신호에 "비교기준" 키가 없으면, "전국 평균 대비 / 평균 대비 / 통상 대비" 같은 비교 표현을 절대 붙이지 마라. 그 신호는 비교 대상이 없는 '값 자체' 또는 '같은 데이터 안에서의 비교'다. 예:
  · "카페구성_개인비중"(비교기준:"전국평균(개인75%)"): 이건 출처 있는 진짜 전국 평균(통계청+공정위 2022, 전국 카페 개인 75%/프랜 25%)과의 비교다. "전국 평균(개인 75%) 대비 N%p 높은/낮은 개인 NN%(프랜 NN%)"처럼 '전국대비편차포인트'(%p)와 방향을 그대로 옮겨라. 보조로 '개인대프랜배수'를 덧붙여도 된다. (이 항목은 신호에 떴다면 이미 전국 평균과 충분히 벌어졌다는 뜻 — 비슷한 수준이면 코드가 미리 뺐다.)
  · "ROI종합점수": "평균 대비"가 아니다. "종합 점수 NN점(밀집도 라벨)"처럼 점수 자체로만 적어라.
  · "공실률": "통상/평균 대비"가 아니다. "공실률 NN%로 높은 편"처럼 값 자체로만 적어라.
  · "전년대비성장률"(비교기준:"전년"): 이건 '작년 대비'라는 진짜 시점 비교다 — "전년 대비 +N%"로 적되, '전국 평균 대비'로 둔갑시키지 마라.
${abstain
  ? '- ★[abstention] 지금은 튀는 신호가 거의 없다(0~1개). 이 상권은 "대체로 전국 평균 수준, 특이점이 적다"는 뜻이다. bannerLine·diagnosis 를 doom 없이 "대체로 평균 수준, 두드러진 특이점은 적음" 톤으로 정직하게 써라. 없는 신호를 지어내지 마라.'
  : '- 신호가 여러 개면 가장 편차가 큰 것 위주로 통합하되, 어느 방향이든 균형 있게.'}

[계절 노이즈 — 이미 제거됨]
- 메뉴는 코드가 이미 걸렀다. 제철(순행) 메뉴 급등은 노이즈로 빠졌다 — 절대 "기회/신호"로 포장하지 마라.
- [튀는 신호]에 "계절역행메뉴"가 있을 때만 의미를 부여한다(계절을 거스른 이상 신호). 없으면 메뉴 언급 자체를 하지 마라.

[금지 — 엄수]
1. 클리셰("차별화하세요"류) 금지.
2. 지어내기 금지 — [튀는 신호]에 없는 외부사실(교통 개통·뉴스·정책 등)·미측정 단정("대부분 평범하다/포화다"류) 절대 금지. 신호로 못 받치면 말하지 마라.
3. 빈 의미 라벨 금지 — "이 동네만의 신호"처럼 알맹이 없는 말 금지. 신호의 항목·편차를 그대로 풀어 적는다.

[튀는 신호] (코드가 골라낸 것만 — 이것만 의미부여)
${JSON.stringify(bundle.signals || [], null, 0)}

[평균 수준 항목] (전국 평균 수준 = 언급 금지)
${JSON.stringify(bundle.averages || [], null, 0)}

[메뉴 계절 메모]
${JSON.stringify(bundle.menuNote || {}, null, 0)}

[참고용 전체 수치] (배경 맥락. 여기서 새 신호를 만들지 말고, 위 [튀는 신호] 해석에만 보조로 써라)
${JSON.stringify(bundle.cards || [], null, 0)}
[기준치] ${JSON.stringify(bundle.benchmarks || {}, null, 0)}

[카드 인덱스]
${titleList}

[출력 JSON 스키마]
{
  "bannerLine": "이 상권을 한 문장으로 옮긴 핵심 한 줄(60자 이내, 처방 없음, 톤은 신호 편차에 비례).",
  "diagnosis": "[튀는 신호]들을 자연스럽게 엮은 하나의 단락. 2~4문장. 처방 절대 없음. 신호 없는 차원은 언급 금지. 신호가 거의 없으면 '대체로 평균 수준' 톤.",
  "cardLines": ["카드0 한 줄", ... 정확히 14개. 그 카드에 해당하는 [튀는 신호]가 있으면 그 사실을 한 줄로 옮기고(50~90자), 없으면 '전국 평균과 비슷한 수준입니다.' 처럼 담담히. 신호 없는 카드를 부정적으로 단정하지 마라."]
}

cardLines 는 정확히 14개 문자열 배열. 순수 JSON으로만 응답.`;
}

// 캐시 키 — dongCd 우선, 없으면 주소|반경.
export function diagnosisCacheKey({ dongCd, address, radius }) {
  const base = _str(dongCd) || `${_str(address) || ''}|${_num(radius) || ''}`;
  return `${AI_DIAG_CACHE_PREFIX}${AI_DIAG_SCHEMA_VER}_${base}`;
}

function readCache(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && obj.bannerLine && Array.isArray(obj.cardLines)) return obj;
  } catch (e) { /* 캐시 깨짐 → 무시 */ }
  return null;
}
function writeCache(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 용량초과 등 무시 */ }
}

// JSON 추출(코드블록·잡텍스트 방어).
function parseJSON(text) {
  if (!text) return null;
  let t = String(text).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(t); } catch (e) { /* 계속 */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1')); } catch (e2) { /* 실패 */ }
  }
  return null;
}

// 응답 검증 — 모양이 맞아야만 채택(아니면 null → 호출부 폴백).
function validate(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const bannerLine = _str(obj.bannerLine);
  const diagnosis = _str(obj.diagnosis);
  let cardLines = Array.isArray(obj.cardLines) ? obj.cardLines.map((x) => _str(x)) : null;
  // 14개로 정규화: 모자라면 null 채움(그 자리만 폴백), 넘치면 자름.
  if (cardLines) {
    cardLines = cardLines.slice(0, 14);
    while (cardLines.length < 14) cardLines.push(null);
  }
  // 최소 조건: 배너 또는 진단 중 하나라도 있어야 의미 있음.
  if (!bannerLine && !diagnosis && (!cardLines || cardLines.every((x) => !x))) return null;
  return { bannerLine, diagnosis, cardLines: cardLines || new Array(14).fill(null) };
}

// ─────────────────────────────────────────────────────────────────────────
// 메인 — 캐시 우선 → 없으면 제미나이 1회 호출(temp 0) → 검증 → 캐시 → 반환.
//   어떤 실패에서도 throw 하지 않는다. 실패 = null 반환(호출부가 폴백).
// ─────────────────────────────────────────────────────────────────────────
export async function getUnifiedDiagnosis({ cards, kosisBoxData, collectedData, dataAsOf, address, radius }) {
  try {
    const dongCd = collectedData && collectedData.dongInfo && collectedData.dongInfo.dongCd;
    const key = diagnosisCacheKey({ dongCd, address, radius });

    const cached = readCache(key);
    if (cached) {
      return { ...validate(cached), _source: 'cache', _key: key };
    }

    const bundle = buildDiagnosisBundle({ cards, kosisBoxData, collectedData, dataAsOf, address, radius });
    // 데이터가 거의 없으면 호출하지 않는다(토큰 낭비·헛 호출 방지) → 폴백.
    const hasEnough = Array.isArray(bundle.cards) && bundle.cards.filter((c) => c && Object.keys(c).length > 0).length >= 4;
    if (!hasEnough) return null;

    const prompt = buildDiagnosisPrompt(bundle);
    const schema = {
      type: 'OBJECT',
      properties: {
        bannerLine: { type: 'STRING' },
        diagnosis: { type: 'STRING' },
        cardLines: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 14, maxItems: 14 },
      },
      required: ['bannerLine', 'diagnosis', 'cardLines'],
    };

    const resp = await fetch('/.netlify/functions/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(AI_DIAG_TIMEOUT_MS),
      body: JSON.stringify({
        action: 'multi-agent',
        agents: [{
          id: 'agent_diagnosis',
          prompt,
          model: 'flash',
          maxOutputTokens: 4000,
          temperature: 0,           // 결정적
          thinkingBudget: 0,
          responseMimeType: 'application/json',
          responseSchema: schema,
          timeout: 24000,
        }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const agent = data && data.results && data.results.agent_diagnosis;
    if (!agent || !agent.success || !agent.text) return null;

    const validated = validate(parseJSON(agent.text));
    if (!validated) return null;

    writeCache(key, validated);
    return { ...validated, _source: 'ai', _key: key };
  } catch (e) {
    // 빈응답/타임아웃/크레딧소진/네트워크 — 전부 폴백.
    if (typeof console !== 'undefined') console.warn('[AI진단] 폴백:', e && e.message);
    return null;
  }
}

export const __aiDiagnosisInternals = {
  CARD_TITLES, _seasonOf, parseJSON, validate,
  // Phase 1 통계 선별 내부 — 검증/테스트용
  extractSignals, _pctDev, _attenuate, _seasonRelation, _makeSignal, _quantileSignal, _pctFromStr,
  SIGNAL_DEV_THRESHOLD, SIGNAL_MIN_SAMPLE, SIGNAL_WEAK_FACTOR,
  NATIONAL_INDIE_PCT, NATIONAL_FRANCH_PCT, INDIE_NATIONAL_DEV_THRESHOLD,
};
