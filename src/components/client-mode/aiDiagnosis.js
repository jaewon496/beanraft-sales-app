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
const AI_DIAG_SCHEMA_VER = 'v10';            // 프롬프트/스키마 바뀌면 올려서 캐시 무효화 (v10[패스8]: 평당월세 facts 진짜 출처 교정 — '가게 전체 월세(619/17)'를 per평 통합값(41)으로 바꿈. 옛 v9 캐시에 619/17 facts로 생성된 디렉터/한줄평 텍스트가 남아 화면에 그대로 떠서, 캐시 무효화로 41 기준 재생성 강제. / v9: 개인/프랜 비중 신호를 진짜 전국 평균 기준으로 — 전국 카페 개인 75%/프랜 25%(통계청 서비스업조사+공정위 가맹 2022, 출처 있는 실값)와 비교. 편차(%p) ≥10%p 일 때만 "전국 평균(개인 75%) 대비 N%p 높음/낮음" 신호, 미만이면 "전국 평균과 비슷한 수준"으로 자동 탈락. 옛 "내부 50/50 lean" 내부비교 폐기(배수는 보조로만 유지) / v8: 전년대비 매출 변화율을 동 단위(saleAmt/prevYearAmt, 점포 60~70개 소표본 노이즈로 ±수십% 요동)에서 구 단위(guAmt/prevYearGuAmt, 점포 600여 개 안정)로 교정 — '전년 대비 28% 감소·하락세' 거짓 신호 제거, 시장규모 +31%·구 평탄과 일관 / v7: 가짜 비교기준 전수 제거 — 개인/프랜 "전국평균(반반=50)"·ROI "평균 50"·공실률 "통상 7%" 상수 가정 삭제. 개인↔프랜=내부 배수, ROI=점수자체, 공실=값자체, 전년대비=전년기준으로 정직화 / v6: 매출 시군구 기준을 실제 필드 guAvg로 교정·드롭됐던 매출 신호 복구 / v5: bundle에서 상위20%매출 raw 제거·매출 비교 앵커 시군구 한정 / v4: 매출 신호 시군구 라벨 명시 / 개인↔프랜 거울상 한쪽만 신호)
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
//     'monthlyAvgSales(소상공인 카페 평균 1086 1순위, 비즈맵 분위 평균 폴백) vs 시군구평균'을 보이므로, AI 진단도 같은 기준을 써야
//     한 리포트 안에서 매출 편차 숫자가 어긋나지 않는다.
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

  // [2026-06-29 정보분산 패스8 §1-10 통일] AI 종합/디렉터가 인용하는 평당월세·공실률을
  //   '카드 화면 KPI 단일값(41)'과 같게 만든다.
  //   ★[패스7 버그·패스8 교정] 직전엔 cards[7].bodyData.rentPerPyeong 을 '41(per평)'이라 착각해 1순위로 썼다.
  //     그러나 그 키는 dataMapper(line 2896 avgRent→rentPerPyeong)·Gemini 원본에선 '가게 전체 월세(만원, 예 619/17)'다
  //     (UnifiedLayout line 5434 주석 동일 경고). 그래서 displayRentPy 가 619/17이 되어 facts·프롬프트로 흘러
  //     AI 종합이 '평당 17만원·619만원'을 뱉었다. ⇒ 진짜 per평 단일값인 integratedRentPy(=kosisBoxData.integratedRent,
  //     buildIntegratedRent 한국부동산원+네이버 가중, KPI/카드1/카드8과 동일=41)를 1순위로 쓴다.
  //     폴백은 firebaseRent 평당단가(c7.perPyeong, 만원/평)만 — '가게 전체 월세(c7.rentPerPyeong)'는 절대 쓰지 않는다.
  //     공실률 = kosisBoxData.vacancy.value (=화면 6.9, 카드1 vacancyRate와 동일 출처).
  const displayRentPy = integratedRentPy || _num(c7.perPyeong);
  const displayVacancy = (kosisBoxData && kosisBoxData.vacancy && _num(kosisBoxData.vacancy.value)) || _num(c8.vacancy);

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
      반경m: _num(radius), 평당월세만원: displayRentPy,   // [패스8] 카드0도 단일값(displayRentPy=41)으로 — 옛 integratedRentPy 직참조 폐기
    }),
    // 1 고객 분석
    //   ★[2026-06-28] 연령분포(ageGroups: {name,pct}[])도 같이 넘긴다 — pro가 "60대 37%·50대 22%"처럼
    //     연령대별 %를 근거로 쓰는데 facts에 없으면 PCN이 그 문장을 반려했음. 분포를 facts로 만들 재료.
    _clean({
      주연령: _str(c1.topAge), 여성비율: _num(c1.femaleRatio), 남성비율: _num(c1.maleRatio),
      재방문율: _num(c1.revisitRate), 신규비율: _num(c1.newRatio),
      // ★[2026-06-28 B관찰자형] 더 많은 고객 축을 facts 재료로: 소득·1인가구·라이프스타일.
      월평균소득만원: _num(c1.avgIncomeMonthly) || _num(c1.regionAvgMonthlyIncome) || _num(c1.customerYrEarn),
      '1인가구비율': _num(c1.singleHousehold) || _num(c1.openubAptRatio),
      라이프스타일: _str(c1.lifestyle) || (Array.isArray(c1.lifestyleKeywords) && c1.lifestyleKeywords.length ? c1.lifestyleKeywords.slice(0, 4).join(', ') : null),
      연령분포: (() => {
        const ag = (cards && cards[1] && cards[1].chartData && Array.isArray(cards[1].chartData.ageGroups))
          ? cards[1].chartData.ageGroups : (Array.isArray(c1.ageGroups) ? c1.ageGroups : null);
        if (!Array.isArray(ag) || ag.length === 0) return null;
        return ag.map((g) => _clean({ 연령: _str(g && (g.name || g.label)), 비율: _num(g && g.pct) }))
                 .filter((g) => g && g.연령 && _num(g.비율) !== null).slice(0, 8);
      })(),
    }),
    // 2 상권 변화 추이
    _clean({
      '3년생존율': _num(c2.survivalRate3y), '1년생존율': _num(c2.survivalRate1y), '5년생존율': _num(c2.survivalRate5y),
      카페5년생존_기준: _str(c2.cafeIndustry5yr), 전산업5년생존_기준: _str(c2.allIndustry5yr),
      신규: _num(c2.openCount), 폐업: _num(c2.closeCount), 추세: _str(c2.trend),
    }),
    // 3 프랜차이즈 현황
    //   ★[2026-06-28 B관찰자형] 인기 메뉴 TOP(있으면)도 facts 재료로 — 메뉴/수요 렌즈(단정 아닌 관찰용).
    _clean({
      프랜차이즈수: _num(c3.franchiseCount), 점유율: _num(c3.franchiseShare), 브랜드수: _num(c3.brandCount),
      인기메뉴: (Array.isArray(c3.popularMenus) && c3.popularMenus.length)
        ? c3.popularMenus.slice(0, 3).map((mn) => _str(mn && (mn.name || mn.menu || mn))).filter(Boolean).join(', ')
        : (_str(c3.popularMenuTop3) || null),
    }),
    // 4 개인 카페 분석
    _clean({
      개인카페수: _num(c4.indieCount), 개인아메리카노평균: _num(c4.americanoAvg),
      개인대프랜차이즈가격차: (c4.indieFranchPriceCompare && _num(c4.indieFranchPriceCompare.indie) && _num(c4.indieFranchPriceCompare.franch))
        ? Math.round(c4.indieFranchPriceCompare.franch - c4.indieFranchPriceCompare.indie) : null,
    }),
    // 5 매출 분석 (월평균=monthlyAvgSales 단일값: 소상공인 카페 평균 1086 1순위, 비즈맵 분위 평균 폴백)
    //   ★[2026-06-25 앵커 한정] AI 진단 입력에는 매출 비교 기준을 '시군구평균(과 동평균)'만 남긴다.
    //     '상위20퍼센트매출만원' raw 숫자를 주면 통역가가 그걸 보고 멋대로 "상위 20% 대비"로
    //     비교해 매출 카드(-51%, 시군구 기준)와 숫자가 어긋났음 → bundle에서 통째로 제거.
    //     (매출 카드 화면의 상위20% 표시는 UnifiedLayout/dataMapper에 그대로 — 여기선 AI 입력만 한정.)
    //   ★[2026-06-25 회귀버그 수정] 시군구 평균은 card5 bodyData 의 실제 필드 'guAvg' 다.
    //     직전 작업이 없는 이름(sigunguCafeAvg)을 찾아 항상 null → 매출 신호가 통째로 드롭됐었다.
    //     매출 카드 헤드라인 "시군구 평균 대비 -51%"의 바로 그 출처(guAvg=1854)와 동일하게 맞춘다.
    //     guAvg 없으면 dongAvg → siAvg 폴백(매출 카드와 같은 계열 평균).
    //   ★[2026-06-28] 상위20%/하위20% 분위 매출도 facts 재료로 넘긴다(검증용). pro가 격차를 근거로 쓰는데
    //     facts에 없으면 PCN이 그 문장을 반려했음. 신호(signals) 입력엔 여전히 안 넣어 '상위20% 대비'로
    //     매출카드와 어긋나는 비교를 유도하지 않되, 검증 facts 에는 둬서 정상 출력이 통과되게 한다.
    _clean({
      월평균매출만원: _num(c5.monthlyAvgSales) || _num(c5.dongCafeAvgStable) || _num(c5.monthly),
      동평균매출만원: _num(c5.dongCafeAvgStable) || _num(c5.dongAvg),
      시군구평균매출만원: _num(c5.guAvg) || _num(c5.dongAvg) || _num(c5.siAvg),
      전년대비성장: _num(c5.yoyGrowth) || _num(c5.prevYearRate),
      // [2026-06-28 키 교정] 카드5 bodyData 의 실제 분위 키(bizmapTop/Bottom/MidSalesNum)로 맞춘다.
      //   예전 키(top20/topAvgSlamt/mercAmtOu20 등)는 bodyData에 없어 항상 null → facts가 비어 PCN 반려 유발했음.
      상위20퍼센트매출만원: _num(c5.bizmapTopSalesNum),
      하위20퍼센트매출만원: _num(c5.bizmapBottomSalesNum),
      중위매출만원: _num(c5.bizmapMidSalesNum),
    }),
    // 6 유동인구
    //   ★[2026-06-28 B관찰자형] 이용 피크시간·피크요일도(있으면) facts 재료로 — 시간/요일 렌즈.
    _clean({
      일유동인구: _num(c6.totalPop), 평일비중: _num(c6.weekdayPct), 주말비중: _num(c6.weekendPct),
      피크시간: _str(c6.peakHour),
      이용피크시간: _str(c6.usagePeakHour) || _str(c6.salesPeakHour),
      피크요일: _str(c6.peakDay) || _str(c6.salesPeakDay),
    }),
    // 7 임대/창업
    //   ★[2026-06-29 정보분산 패스8 §1-10] 평당월세는 KPI 단일값 displayRentPy(=integratedRentPy=통합 per평=41).
    //     ★패스7은 'displayRentPy=카드7 rentPerPyeong'을 41로 착각했으나 그 키는 '가게 전체 월세(619/17)'였다(상단 정의부 참조).
    //     이제 통합 per평(buildIntegratedRent, 카드1/카드8 KPI와 동일)만 facts로 들어가 41 단일. 지역평균도 같은 값.
    //     보증금도 depositManwon(만원) 우선, 권리금 premiumCost(만원)은 그대로.
    _clean({
      평당월세만원: displayRentPy,
      권리금만원: _num(c7.premiumCost),
      보증금만원: _num(c7.depositManwon) || _num(c7.deposit),
      // [2026-06-29 §1-10] 지역평균 기준도 표시 단일값으로 맞춘다 → 평당월세 신호가 '17만원 대비 +141%'
      //   같은 어긋난 비교를 만들지 않고 '평균수준'으로 자연 탈락하게(카드와 다른 17 숫자 출력 차단).
      평당월세_지역평균만원: displayRentPy,
    }),
    // 8 카페 기회
    //   ★[2026-06-29 정보분산 패스7 §1-10] 공실률은 카드1(cards-a.jsx) vacancyRate와 동일 출처
    //     (kosisBoxData.vacancy.value=화면 6.9). 예전엔 cards[8].bodyData.vacancy(미설정/한국부동산원 9.05)로 갈렸음.
    _clean({
      공실률: displayVacancy, 신규오픈: _num(c8.newOpen), 개인비중: _num(c8.individualPct),
    }),
    // 9 배달 객단가
    //   ★[2026-06-28 B관찰자형] 배달 비중(전체 매출 중 배달%)도 있으면 facts 재료로 — 채널 렌즈.
    _clean({
      배달객단가원: (_num(c9.searchAvgPrice) >= 1000 && _num(c9.searchAvgPrice) < 100000) ? Math.round(c9.searchAvgPrice) : null,
      배달주문건수: _num(c9.searchOrders), 배달매출만원: _num(c9.searchSales),
      배달비중: (_num(c9.deliveryShare) > 0 && _num(c9.deliveryShare) <= 100) ? Math.round(c9.deliveryShare) : null,
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
    // [2026-06-29 §1-10] 벤치마크 평당월세도 카드 표시 단일값으로(AI는 averages 언급 금지지만 출처 일관성 유지).
    평당월세_지역평균만원: displayRentPy,
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

// ═════════════════════════════════════════════════════════════════════════
// [2026-06-28] AI 추론 엔진 v10 — 3단계(신호 점수화 → 근거 PoT 계산 → 꼬리물기 IQuery)
//   기존 extractSignals(고정 15% 임계 '프린트')를 진짜 '추론'으로 업그레이드.
//   기존 함수(extractSignals/buildDiagnosisPrompt/v9 1회 통역)는 그대로 남겨둔다(폴백).
//   새 경로가 실패/예외면 getUnifiedDiagnosis 가 자동으로 v9 결과를 반환한다.
// ═════════════════════════════════════════════════════════════════════════

const AI_DIAG_V10_PREFIX = 'bc_ai_diag_v10pro7_';  // 종합(배너/진단/설계방향) pro 단일콜 추론 전용 캐시
//   ★[2026-06-29 정보분산 패스12] v10pro6_→v10pro7_ : 화면 렌더 직전(__BC_DATA__ 푸시 지점)에서 디렉터 전 섹션
//     문자열을 카드1 평당월세(rentPerPyeong)·공실률(vacancyRate)로 마지막-마일 강제 치환(injectCard1RentVacancyIntoDirector)
//     하는 안전망 추가. App.jsx 검색직원 AI가 만든 디렉터가 dataMapper 정규화를 우회해 31/9% 누수하던 경로 차단.
//     옛 캐시(31/9% 텍스트) 무효화해 다음 검색 때 41/6.9로 재생성.
//   ★[2026-06-29 정보분산 패스11] v10pro5_→v10pro6_ : 평당월세/공실 단일값을 buildIntegratedRent().value 그냥
//     round(=31 누수) 대신 'resolveCard1Rent/Vacancy(카드1 화면 표시 체인 단일 함수)'로 교체 → 입력·출력 모두
//     카드1 표시값(41/6.9)에 결정적으로 수렴. 옛 캐시(31/619/17/9% 텍스트) 무효화해 다음 검색 때 41/6.9로 재생성.
//   ★[2026-06-29 정보분산 패스10] v10pro4_→v10pro5_ : '사후 치환' 대신 'AI 입력 자체'를 교정.
//     디렉터 AI 프롬프트(App.jsx)에 먹이던 평당월세를 한국부동산원 원본 17/평 대신 통합 단일값 41로 바꾸고,
//     공실률·외부지표 출처명(한국부동산원) 제거 + "출처 명확히 발화" 지시 삭제 → AI가 17/9.05/한국부동산원을
//     볼 데이터 자체가 0이 됨. 옛 캐시(17/9.05/출처명) 무효화해 다음 검색 때 41/6.9·출처 0으로 재생성.
//   ★[2026-06-29 정보분산 패스9] v10pro3_→v10pro4_ : 디렉터 keyMetric(평당월세/공실)이 정규화를 거치지 않아
//     market.keyMetric.value="17만원" 등으로 샌 것을 _normalizeKeyMetric으로 41/6.9 강제 + 역어순('월세…평당 N만원')
//     치환 추가. 옛 캐시(17/9.05/출처명 keyMetric)를 버리고 다음 검색 때 41/6.9·출처 0으로 재생성되게 함.
//   ★[2026-06-29 정보분산 패스8] v10pro2_→v10pro3_ : 평당월세 facts 의 '진짜 출처'를 교정(가게 전체 월세 619/17
//     → 통합 per평 41)하며 캐시 무효화. 패스7은 표면(displayRentPy 변수)만 바꾸고 실제 facts에 619/17이 남아
//     AI가 그걸 그대로 인용했음. 옛 캐시를 버리고 다음 검색 때 41/6.9로 재생성되게 함.
//   ★[2026-06-29 정보분산 패스7] v10pro_→v10pro2_ : 평당월세·공실률을 카드 표시 단일값(41/6.9)으로 통일하며
//     캐시 무효화. 옛 17/9.05 텍스트가 남아있던 캐시를 버리고 다음 검색 때 41/6.9로 재생성되게 함.
//   ★[2026-06-28] 모델 'flash'→'pro'(gemini-2.5-pro, 판단력 최강) 업그레이드. 캐시키도 v10pro로 올려
//     기존 flash 캐시와 섞이지 않게 함(같은 동은 pro로 1회만 돌고 캐시). 14장 cardLines는 여전히 flash.
//   ★[2026-06-28 긴급] 4~5홉 순차호출이 504(24초 타임아웃)·과다호출(차단/과금 위험)이라 → pro '단일콜'로 압축.
//     꼬리물기(누가→언제→왜→빈수요)는 pro의 thinking이 한 콜 안에서 스스로 한다. 검색당 추가 AI콜 = pro 1콜만.
const REASON_MODEL = 'pro';                        // 추론 전용 모델(중계기: pro→gemini-2.5-pro)
const REASON_THINKING_BUDGET = 2048;              // ★자동 8192 금지. 2048(품질 좋음, 라이브 검증). 중계기는 >=128이면 그 값 유지.
const REASON_AGENT_TIMEOUT_MS = 25000;            // ★[2026-06-28] 23000→25000. 라이브 19.8초라 여유 부족 → 상향(중계기 24000 캡, 운영 26초 안).
//   ★[2026-06-28 핵심 원인] Gemini 2.5는 maxOutputTokens 에 '생각(thinking) 토큰'이 포함된다.
//     1400이면 thinkingBudget 2048이 출력한도를 다 먹어 본문 0자 → text 빈문자열 → 필드누락 → null 폴백이었음.
//     6000 = 생각budget 2048 + 답변 여유. 라이브 검증: 6000·2048·pro → 19.8초에 풀 추론(배너+진단+설계방향) 정상 반환.
const REASON_MAX_TOKENS = 6000;                   // pro 단일콜 출력 토큰 상한(생각 2048 포함 + 배너+진단+설계방향).

// 금지어(doom·마케팅 상투어) — 들어간 '그 문장만' 반려/세탁(전체 null 아님).
//   ★[2026-06-28] 과민 완화: '잠재력·경쟁·위축' 같은 일반어는 정상 분석에 흔히 쓰여 빼고,
//     명백한 doom/마케팅 클리셰만 엄격히 막는다(쇠퇴·포화·블루오션·레드오션·붕괴·몰락·대박·핫플 등).
const BANNED_WORDS = [
  '쇠퇴', '포화', '블루오션', '레드오션', '붕괴', '몰락',
  '대박', '필승', '노다지', '핫플',
];

// ─────────────────────────────────────────────────────────────────────────
// 1단계 — 신호 점수화 scoreSignals (통계, AI 호출 0)
//   각 후보 사실 점수 = Impact × Significance.
//     Impact        = 이 동이 시군구에서 차지하는 비중(0~1). 데이터 없으면 1.
//     Significance  = 평균 대비 표준화 편차(z). 시계열은 추세 기울기 유의성(계절조정).
//   소표본(점포<30 등) 억제. 상위 5~7개만 통과. |z|<1·평균 수준은 abstention 후보로.
//   ★반환 규격은 extractSignals 와 동일({signals[], averages[], menuNote})로 하위 호환.
// ─────────────────────────────────────────────────────────────────────────

// z = (x-μ)/σ. σ 없으면(또는 0) μ 대비 비율편차를 약식 z로 환산(편차 25%≈z1).
function _zScore(x, mu, sigma) {
  const v = _num(x), m = _num(mu);
  if (v === null || m === null) return null;
  const sd = _num(sigma);
  if (sd !== null && sd > 0) return (v - m) / sd;
  if (m === 0) return null;
  // σ 미지 → 비율편차/0.25 를 근사 z 로(편차 ±25%를 z±1 로 본다 — 보수적 근사).
  return ((v / m) - 1) / 0.25;
}

// Impact: 동의 시군구 내 비중(0~1). 점포수/시군구점포수가 있으면 그걸로, 없으면 1.
function _impactOf(dongN, sigunguN) {
  const d = _num(dongN), g = _num(sigunguN);
  if (d !== null && g !== null && g > 0) {
    const r = d / g;
    return (r > 0 && r <= 1) ? r : 1;
  }
  return 1;
}

// 소표본 억제: 점포수<SIGNAL_MIN_SAMPLE 이면 점수에 감쇠계수.
function _sampleFactor(sampleN) {
  const n = _num(sampleN);
  if (n === null) return 1;
  if (n < SIGNAL_MIN_SAMPLE) return SIGNAL_WEAK_FACTOR;     // 0.5
  return 1;
}

// 계절조정 잔차: 시계열 성장률을 '동월/계절 기대치'로 보정.
//   여기선 raw 시계열 분해가 없으므로, 계절성격(seasonHint)·기준월(season) 관계로
//   '제철 순행이면 변화의 일부를 계절 노이즈로 차감'하는 보수적 잔차만 적용.
//   (겨울 매출하락을 '쇠퇴'로 오판하지 않게 하려는 안전장치 — 과도 보정 금지.)
function _seasonAdjustedGrowth(growthPct, season) {
  const g = _num(growthPct);
  if (g === null) return null;
  // 겨울은 카페 비수기 → 음(-) 성장의 일부(최대 8%p)를 계절요인으로 흡수해 잔차만 신호화.
  if (season === '겨울' && g < 0) return Math.round(Math.min(0, g + 8));
  // 여름은 성수기 → 양(+) 성장의 일부(최대 6%p)를 계절요인으로 흡수.
  if (season === '여름' && g > 0) return Math.round(Math.max(0, g - 6));
  return Math.round(g);
}

// 후보 사실 1개 점수화. score = |z| × Impact × sampleFactor.
//   |z|>=1 일 때만 신호 채택(평균과 비슷하면 abstention). sanity 편차 드롭은 호출부에서.
function _scoreCandidate({ label, cardIdx, title, value, mu, sigma, dongN, sigunguN, sampleN, extra }) {
  const z = _zScore(value, mu, sigma);
  if (z === null) return { signal: null, averageOf: null };
  const impact = _impactOf(dongN, sigunguN);
  const sf = _sampleFactor(sampleN);
  const score = Math.abs(z) * impact * sf;
  // 평균 대비 비율편차(%) — 톤·라벨용(기존 통역가 프롬프트가 '편차퍼센트'를 톤 세기로 씀).
  const devPct = (_num(mu) !== null && _num(mu) !== 0) ? Math.round((_num(value) / _num(mu) - 1) * 100) : null;
  if (devPct !== null && _isInsaneDev(devPct)) {
    return { signal: null, averageOf: null, dropped: { 항목: label, 사유: '단위이상_드롭' } };
  }
  // |z|<1(평균과 비슷) 또는 점수 미달 → abstention 후보(averages 로).
  if (Math.abs(z) < 1 || score < 0.6) {
    return { signal: null, averageOf: `${title}:${label}` };
  }
  return {
    signal: _clean({
      카드: cardIdx, 카드명: title, 항목: label,
      값: _num(value), 기준: _num(mu),
      z: Math.round(z * 100) / 100,
      영향도: Math.round(impact * 100) / 100,    // Impact (시군구 내 비중)
      신호점수: Math.round(score * 100) / 100,   // Impact × Significance
      편차퍼센트: devPct,                          // 톤용(있을 때만)
      방향: z > 0 ? '높음' : '낮음',
      ...(extra || {}),
    }),
    averageOf: null,
  };
}

// scoreSignals 본체 — extractSignals 와 같은 입력/출력 규격. 점수 상위 5~7개만 통과.
function scoreSignals(cardData, benchmarks, menuRising, season) {
  const C = (i) => (cardData && cardData[i]) ? cardData[i] : {};
  const c0 = C(0), c2 = C(2), c3 = C(3), c5 = C(5), c7 = C(7), c8 = C(8), c12 = C(12), c13 = C(13);
  const scored = [];     // {score, signal}
  const averages = [];
  const sampleN = _num(c0.카페수);                 // 동의 카페 모수(소표본 억제용)
  const take = (r) => {
    if (!r) return;
    if (r.signal) scored.push({ score: _num(r.signal.신호점수) || 0, signal: r.signal });
    else if (r.averageOf) averages.push(r.averageOf);
  };

  // 5 매출 — 월평균매출 vs 시군구평균. Impact = 동카페수/시군구카페수(있으면).
  take(_scoreCandidate({
    label: '월평균매출', cardIdx: 5, title: CARD_TITLES[5],
    value: c5.월평균매출만원, mu: c5.시군구평균매출만원,
    dongN: sampleN, sigunguN: _num(c5.시군구카페수), sampleN,
    extra: { 비교기준: '시군구평균' },
  }));
  // 동평균 자체의 시군구 대비 위치
  take(_scoreCandidate({
    label: '동평균_시군구대비', cardIdx: 5, title: CARD_TITLES[5],
    value: c5.동평균매출만원, mu: c5.시군구평균매출만원, sampleN,
    extra: { 비교기준: '시군구평균' },
  }));
  // 전년대비 성장 — 계절조정 잔차로(겨울 하락·여름 상승의 계절 노이즈 차감).
  if (_num(c5.전년대비성장) !== null) {
    const adj = _seasonAdjustedGrowth(c5.전년대비성장, season);
    if (adj !== null && !_isInsaneDev(adj)) {
      // 잔차 |값|>=15%p 일 때만 신호(계절 제거 후에도 유의미한 변화).
      if (Math.abs(adj) >= SIGNAL_DEV_THRESHOLD) {
        const score = Math.min(3, Math.abs(adj) / 25) * _sampleFactor(sampleN);
        scored.push({ score, signal: _clean({
          카드: 5, 카드명: CARD_TITLES[5], 항목: '전년대비성장률_계절조정',
          값: adj, 비교기준: '전년(계절조정)', 원시성장률: Math.round(_num(c5.전년대비성장)),
          신호점수: Math.round(score * 100) / 100, 방향: adj > 0 ? '높음' : '낮음',
        }) });
      } else { averages.push(`${CARD_TITLES[5]}:전년대비성장(계절조정후 평탄)`); }
    }
  }

  // 2 상권 변화 — 점포 순증을 모수 대비 비율로(z 근사). 소표본 억제.
  if (_num(c2.신규) !== null && _num(c2.폐업) !== null && sampleN !== null && sampleN > 0) {
    const net = c2.신규 - c2.폐업;
    const netPct = Math.round(net / sampleN * 100);
    if (!_isInsaneDev(netPct)) {
      const z = netPct / 25;   // 순증 25%를 z1 로 근사
      const score = Math.abs(z) * _sampleFactor(sampleN);
      if (Math.abs(z) >= 1 && score >= 0.6) {
        scored.push({ score, signal: _clean({
          카드: 2, 카드명: CARD_TITLES[2], 항목: '점포순증', 값: net, 모수: sampleN,
          편차퍼센트: netPct, z: Math.round(z * 100) / 100,
          신호점수: Math.round(score * 100) / 100, 방향: net > 0 ? '높음' : '낮음',
        }) });
      } else { averages.push(`${CARD_TITLES[2]}:점포순증(${net}/${sampleN}=${netPct}%)`); }
    }
  }
  // 생존율 — 카페 5년 기준 대비.
  take(_scoreCandidate({
    label: '5년생존율_카페기준대비', cardIdx: 2, title: CARD_TITLES[2],
    value: c2['5년생존율'], mu: _pctFromStr(c2.카페5년생존_기준), sampleN,
  }));

  // 0·3 개인비중 — 전국 평균(개인 75%) 대비 %p(거울상 중복 방지: 개인만 신호).
  {
    const indie = _num(c0.개인비중퍼센트);
    const franch = _num(c3.점유율);
    const indieVal = (indie !== null) ? indie : (franch !== null ? 100 - franch : null);
    if (indieVal !== null) {
      const devPp = Math.round(indieVal - NATIONAL_INDIE_PCT);
      if (Math.abs(devPp) >= INDIE_NATIONAL_DEV_THRESHOLD) {
        const score = Math.min(3, Math.abs(devPp) / 15);   // 15%p 편차를 score1 로
        scored.push({ score, signal: _clean({
          카드: 0, 카드명: CARD_TITLES[0], 항목: '카페구성_개인비중',
          개인비중퍼센트: indieVal, 프랜차이즈비중퍼센트: franch,
          전국개인평균퍼센트: NATIONAL_INDIE_PCT, 전국프랜평균퍼센트: NATIONAL_FRANCH_PCT,
          비교기준: '전국평균(개인75%)', 전국대비편차포인트: devPp,
          신호점수: Math.round(score * 100) / 100, 방향: devPp > 0 ? '높음' : '낮음',
        }) });
      } else { averages.push(`${CARD_TITLES[0]}:개인카페비중`); }
    }
    if (franch !== null) averages.push(`${CARD_TITLES[3]}:프랜차이즈점유율`);
  }

  // 7 임대 — 평당월세 vs 지역평균.
  take(_scoreCandidate({
    label: '평당월세_지역평균대비', cardIdx: 7, title: CARD_TITLES[7],
    value: c7.평당월세만원, mu: c7.평당월세_지역평균만원, sampleN,
  }));

  // 8 공실률 — 값 자체(두 자릿수면 신호). 비교 기준 없음.
  if (_num(c8.공실률) !== null) {
    const vac = _num(c8.공실률);
    if (vac >= 0 && vac <= 100) {
      if (vac >= 12) {
        const score = Math.min(3, vac / 12);
        scored.push({ score, signal: _clean({
          카드: 8, 카드명: CARD_TITLES[8], 항목: '공실률', 값: vac,
          신호점수: Math.round(score * 100) / 100, 방향: '높음',
        }) });
      } else { averages.push(`${CARD_TITLES[8]}:공실률`); }
    }
  }

  // 12 ROI 종합점수 — 점수 자체(50에서 충분히 치우치면). 비교 기준 없음.
  if (_num(c12.종합점수) !== null) {
    const lean = Math.abs(c12.종합점수 - 50);
    if (lean >= SIGNAL_DEV_THRESHOLD) {
      const score = Math.min(3, lean / 20);
      scored.push({ score, signal: _clean({
        카드: 12, 카드명: CARD_TITLES[12], 항목: 'ROI종합점수', 점수: _num(c12.종합점수),
        밀집도라벨: _str(c12.카페밀집도라벨), 신호점수: Math.round(score * 100) / 100,
        방향: (c12.종합점수 - 50) > 0 ? '높음' : '낮음',
      }) });
    } else { averages.push(`${CARD_TITLES[12]}:ROI종합점수`); }
  }

  // 13 기회/리스크 균형.
  if (_num(c13.기회건수) !== null && _num(c13.리스크건수) !== null) {
    const diff = c13.기회건수 - c13.리스크건수;
    if (Math.abs(diff) >= 2) {
      const score = Math.min(3, Math.abs(diff) / 2);
      scored.push({ score, signal: _clean({
        카드: 13, 카드명: CARD_TITLES[13], 항목: '기회_리스크균형',
        기회: c13.기회건수, 리스크: c13.리스크건수, 신호점수: Math.round(score * 100) / 100,
        방향: diff > 0 ? '높음' : '낮음',
      }) });
    } else { averages.push(`${CARD_TITLES[13]}:기회리스크균형`); }
  }

  // 계절역행 메뉴(순행=노이즈 제외) — 점수는 중간 고정(메뉴는 보조 신호).
  let menuNote = null;
  if (Array.isArray(menuRising) && menuRising.length > 0) {
    const counter = [], seasonal = [];
    menuRising.forEach((m) => {
      const rel = _seasonRelation(m && m.seasonHint, season);
      if (rel === '역행') counter.push(m.name);
      else if (rel === '순행') seasonal.push(m.name);
    });
    if (counter.length > 0) {
      scored.push({ score: 1.0, signal: _clean({
        카드: 4, 카드명: '메뉴', 항목: '계절역행메뉴', 메뉴: counter, 기준월계절: season, 방향: '이상신호',
      }) });
    }
    menuNote = _clean({ 제철순행_제외: seasonal.length > 0 ? seasonal : null, 기준월계절: season });
  }

  // 점수 내림차순 → 상위 7개만(꼬리물기 토큰 가드). signal 객체에서 정렬 점수는 그대로 둠.
  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  const signals = scored.slice(0, 7).map((s) => s.signal);

  return _clean({ signals, averages, menuNote });
}

// ─────────────────────────────────────────────────────────────────────────
// 2단계 — 근거 PoT 계산 computeGroundedFacts (AI 호출 0)
//   AI가 머리로 산술 못 하게 모든 계산을 JS로 미리. 각 사실:
//     {key, label, value, unit, source(카드/항목), confidence('실측'/'추정'/'외부')}
//   cardData 에 있는 값만. 없으면 그 사실 생략(가짜 금지).
// ─────────────────────────────────────────────────────────────────────────
function computeGroundedFacts(cardData) {
  const C = (i) => (cardData && cardData[i]) ? cardData[i] : {};
  const c0 = C(0), c1 = C(1), c2 = C(2), c3 = C(3), c4 = C(4), c5 = C(5), c6 = C(6), c7 = C(7),
        c8 = C(8), c9 = C(9), c10 = C(10), c12 = C(12), c13 = C(13);
  const facts = [];
  const F = (key, label, value, unit, source, confidence) => {
    const v = (typeof value === 'string') ? _str(value) : _num(value);
    if (v === null) return;
    facts.push({ key, label, value: v, unit: unit || null, source, confidence });
  };

  // 카페 규모/구성
  F('cafeCount', '카페 수', c0.카페수, '개', '상권 분석', '실측');
  F('indiePct', '개인카페 비중', c0.개인비중퍼센트, '%', '상권 분석', '실측');
  F('franchPct', '프랜차이즈 비중',
    (_num(c0.개인비중퍼센트) !== null) ? (100 - _num(c0.개인비중퍼센트)) : null, '%', '상권 분석', '추정');
  // 시군구 대비 매출%, 분위 격차
  if (_num(c5.월평균매출만원) !== null && _num(c5.시군구평균매출만원) !== null && c5.시군구평균매출만원 > 0) {
    const ratio = Math.round(c5.월평균매출만원 / c5.시군구평균매출만원 * 100);
    F('salesVsSigungu', '월평균매출의 시군구평균 대비 비율', ratio, '%', '매출 분석', '추정');
    // ★[2026-06-28 파생] pro가 "구 평균 대비 N% 낮음/높음"으로 쓰는 보수치(=100-비율). PCN 통과용.
    F('salesGapVsSigungu', '월평균매출의 시군구평균 대비 차이(낮으면 +)', Math.abs(100 - ratio), '%', '매출 분석', '추정');
  }
  F('monthlySales', '월평균매출', c5.월평균매출만원, '만원', '매출 분석', '추정');
  F('dongAvgSales', '동평균매출', c5.동평균매출만원, '만원', '매출 분석', '추정');
  F('sigunguAvgSales', '시군구평균매출', c5.시군구평균매출만원, '만원', '매출 분석', '추정');
  // ★[2026-06-28 파생] 분위(상위20%/하위20%) 매출 + 분위 라벨(20/80) + 격차배수. pro가 격차를 근거로 씀.
  F('topQuintileSales', '상위 20% 카페 월매출', c5.상위20퍼센트매출만원, '만원', '매출 분석', '추정');
  F('botQuintileSales', '하위 20% 카페 월매출', c5.하위20퍼센트매출만원, '만원', '매출 분석', '추정');
  if (_num(c5.상위20퍼센트매출만원) !== null && _num(c5.하위20퍼센트매출만원) !== null && c5.하위20퍼센트매출만원 > 0) {
    F('quintileGapX', '상·하위 20% 매출 격차배수',
      Math.round(c5.상위20퍼센트매출만원 / c5.하위20퍼센트매출만원 * 10) / 10, '배', '매출 분석', '추정');
  }
  // 신폐 순증·생존율
  if (_num(c2.신규) !== null && _num(c2.폐업) !== null) {
    F('netStoreChange', '점포 순증(신규-폐업)', c2.신규 - c2.폐업, '개', '상권 변화 추이', '실측');
  }
  F('newCount', '신규 개업', c2.신규, '개', '상권 변화 추이', '실측');
  F('closeCount', '폐업', c2.폐업, '개', '상권 변화 추이', '실측');
  F('survival5y', '5년 생존율', c2['5년생존율'], '%', '상권 변화 추이', '추정');
  // 주고객 연령·성별
  F('topAge', '주 고객 연령대', c1.주연령, null, '고객 분석', '추정');
  // ★[2026-06-28 파생] 연령대별 비율을 각각 facts로(60대 37%·50대 22% 등). pro가 이 %들을 근거로 씀.
  if (Array.isArray(c1.연령분포)) {
    c1.연령분포.forEach((g, idx) => {
      const nm = _str(g && g.연령), pct = _num(g && g.비율);
      if (nm && pct !== null) F('age_' + idx, nm + ' 비율', pct, '%', '고객 분석', '추정');
    });
  }
  if (_num(c1.여성비율) !== null && _num(c1.남성비율) !== null) {
    const fem = _num(c1.여성비율);
    F('genderDominant', '주 성별',
      fem >= 55 ? `여성 ${Math.round(fem)}%` : (fem <= 45 ? `남성 ${Math.round(100 - fem)}%` : '남녀 비슷'),
      null, '고객 분석', '추정');
  }
  F('femalePct', '여성 비율', c1.여성비율, '%', '고객 분석', '추정');
  F('revisitRate', '재방문율', c1.재방문율, '%', '고객 분석', '추정');
  F('newRatio', '신규 고객 비율', c1.신규비율, '%', '고객 분석', '추정');
  // ★[2026-06-28 B관찰자형] 소득·1인가구·라이프스타일 (소득·소비 렌즈)
  F('avgIncome', '지역 월평균소득', c1.월평균소득만원, '만원', '고객 분석', '추정');
  F('singleHh', '1인가구 비율', c1['1인가구비율'], '%', '고객 분석', '추정');
  F('lifestyle', '주 고객 라이프스타일', c1.라이프스타일, null, '고객 분석', '추정');
  // 유동/피크 (시간·요일 렌즈)
  F('dailyPop', '일 유동인구', c6.일유동인구, '명', '유동인구', '추정');
  F('peakHour', '유동 피크 시간', c6.피크시간, null, '유동인구', '추정');
  F('usagePeakHour', '매출 피크 시간', c6.이용피크시간, null, '유동인구', '추정');
  F('peakDay', '피크 요일', c6.피크요일, null, '유동인구', '추정');
  if (_num(c6.평일비중) !== null && _num(c6.주말비중) !== null) {
    F('popWeekendSkew', '주말/평일 유동 성향',
      c6.주말비중 > c6.평일비중 ? '주말형' : '평일형', null, '유동인구', '추정');
    F('weekdayPct', '평일 유동 비중', c6.평일비중, '%', '유동인구', '추정');
  }
  // 경쟁 구조 (경쟁 렌즈)
  F('franchiseCount', '프랜차이즈 점포 수', c3.프랜차이즈수, '개', '프랜차이즈 현황', '실측');
  F('brandCount', '프랜차이즈 브랜드 수', c3.브랜드수, '개', '프랜차이즈 현황', '실측');
  F('popularMenu', '인기 메뉴', c3.인기메뉴, null, '프랜차이즈 현황', '추정');
  F('indieAmericano', '개인 카페 아메리카노 평균가', c4.개인아메리카노평균, '원', '개인 카페 분석', '추정');
  F('indieVsFranchPrice', '개인-프랜차이즈 객단가 차이', c4.개인대프랜차이즈가격차, '원', '개인 카페 분석', '추정');
  // 배달 채널 (채널 렌즈)
  F('deliveryTicket', '배달 객단가', c9.배달객단가원, '원', '배달 객단가', '추정');
  F('deliveryOrders', '배달 주문 건수', c9.배달주문건수, '건', '배달 객단가', '추정');
  F('deliveryShare', '배달 비중', c9.배달비중, '%', '배달 객단가', '추정');
  // 점포당 배후인구(있으면)
  if (_num(c6.일유동인구) !== null && _num(c0.카페수) !== null && c0.카페수 > 0) {
    F('popPerCafe', '카페 1곳당 일 유동인구',
      Math.round(c6.일유동인구 / c0.카페수), '명', '유동인구÷카페수', '추정');
  }
  // 비용·수익 (비용·수익 렌즈)
  F('rentPerPyeong', '평당 월세', c7.평당월세만원, '만원', '임대/창업 정보', '추정');
  F('deposit', '보증금', c7.보증금만원, '만원', '임대/창업 정보', '추정');
  F('premium', '권리금', c7.권리금만원, '만원', '임대/창업 정보', '추정');
  F('vacancy', '공실률', c8.공실률, '%', '카페 기회', '추정');
  // SNS/소비심리 (수요·SNS 렌즈)
  F('snsPositive', 'SNS 긍정 비율', c10.긍정비율, '%', 'SNS 트렌드', '외부');
  if (Array.isArray(c10.키워드) && c10.키워드.length) {
    F('snsKeywords', 'SNS 키워드', c10.키워드.slice(0, 5).map((k) => _str(k && (k.keyword || k.name || k))).filter(Boolean).join(', '), null, 'SNS 트렌드', '외부');
  }
  if (Array.isArray(c10.검색의도) && c10.검색의도.length) {
    F('searchIntents', '검색 의도', c10.검색의도.slice(0, 4).map((k) => _str(k && (k.intent || k.name || k))).filter(Boolean).join(', '), null, 'SNS 트렌드', '외부');
  }
  // ROI 종합 (성장·리스크 렌즈)
  F('roiScore', 'ROI 종합점수', c12.종합점수, '점', '상권 경쟁 분석', '추정');
  F('roiMonthlyProfit', '예상 월수익', c12.예상월수익만원, '만원', '상권 경쟁 분석', '추정');
  F('roiPayback', '투자 회수개월', c12.회수개월, '개월', '상권 경쟁 분석', '추정');
  // 기회/리스크
  F('opportunities', '기회 건수', c13.기회건수, '건', 'AI 종합 분석', '실측');
  F('risks', '리스크 건수', c13.리스크건수, '건', 'AI 종합 분석', '실측');

  return facts;
}

// PCN 숫자검증 verifyNumbers — ★[2026-06-28] '모순(위조)만' 잡는다. '없는 숫자'는 통과.
//   배경: 예전엔 facts에 없는 숫자를 전부 반려 → pro의 합리적 파생값(시군구 대비 41%·분위 라벨 20%·
//        연령 37% 등)까지 막아 출력 전체를 null로 버렸음(라이브 폴백 원인).
//   새 원칙(coordinator 지시): "매출 5000처럼 facts와 모순되는 위조"만 막고, 합리적 파생/퍼센트는 통과.
//   판정 규칙(보수적 — 과민 금지):
//     1) 어떤 fact와 '같은 값'(±5%·단위환산)으로 매칭 → 정상 인용, 통과.
//     2) 통화/개수 단위(만원·원·명·개)인 숫자만 모순 검사. 같은 통화단위 fact 중 가장 가까운 것과
//        0.5~5배 범위에서 '명백히 다르면'(같은 항목을 잘못 옮긴 위조 의심) → 그 숫자만 flag.
//        ※ '%'·라벨·배수·점수·연령·시각 등은 파생/구조값이 많아 모순 검사에서 제외(통과).
//     3) 구조적 라운드 라벨(10/20/25/50/75/80/90/100 — 분위·절반·백분위)은 검사 면제.
//   반환: { ok, flagged:[{number, token, reason, nearFact}] } — flagged 비면 통과.
function verifyNumbers(aiText, facts) {
  const text = String(aiText || '');
  // 통화/개수 단위 fact(만원·원·명·개)만 모순 비교 대상으로(퍼센트·점·배·개월 등은 제외).
  const CURR_UNITS = ['만원', '원', '명', '개'];
  const currFacts = (Array.isArray(facts) ? facts : [])
    .map((f) => ({ v: _num(f.value), label: f.label, unit: f.unit }))
    .filter((o) => o.v !== null && o.v !== 0 && CURR_UNITS.indexOf(o.unit) >= 0);
  const allFacts = (Array.isArray(facts) ? facts : [])
    .map((f) => _num(f.value)).filter((v) => v !== null);
  // ★단위환산 후보는 만↔원(×/÷10000)만. ×100·×1000 등 임의 환산은 무관한 작은 fact(생존율 48→4800,
  //   리스크 5→5000)를 '같은 값'으로 오통과시켜 위조(5000만원)를 놓치게 해서 폐기.
  const scaleCands = (b) => [b, b / 10000, b * 10000];
  const EQ_TOL = 0.05;
  const ROUND_LABELS = [10, 20, 25, 30, 50, 70, 75, 80, 90, 100];
  // 토큰 = 숫자 + (붙은 단위). 단위로 통화/개수 여부 판별.
  const tokens = text.match(/[\d][\d,\.]*\s*(?:억|만원|만|원|명|개|점|개월|건|배|위|시|%)?/g) || [];
  const flagged = [];
  tokens.forEach((tk) => {
    const raw = String(tk).trim();
    const numStr = raw.replace(/[^\d.]/g, '');
    const n = _num(numStr);
    if (n === null) return;
    if (n <= 12 && Number.isInteger(n)) return;        // 작은 서수/년수 면제
    if (ROUND_LABELS.indexOf(n) >= 0) return;          // 분위·절반·백분위 등 구조 라벨 면제
    // 1) 어떤 fact와 '같은 값'이면 정상 인용 → 통과.
    const equalsSome = allFacts.some((fv) => scaleCands(fv).some((c) => c !== 0 &&
      (Math.abs(n - c) / Math.abs(c) <= EQ_TOL || Math.abs(n - c) <= 1)));
    if (equalsSome) return;
    // 2) 통화/개수 단위가 붙은 숫자만 모순 검사. 단위 없으면(맥락 불명) 통과(과민 금지).
    const hasCurrUnit = /(억|만원|만|원|명|개)$/.test(raw);
    if (!hasCurrUnit) return;
    // 같은 통화단위 fact 중 0.5~5배 범위에서 가장 가까운 것 → 같은 항목 오인용(위조) 의심.
    let hit = null;
    for (const fo of currFacts) {
      const ratio = n / fo.v;                            // 단위 동일 가정(만원 vs 만원 등)
      if (ratio >= 0.5 && ratio <= 5 && Math.abs(n - fo.v) / fo.v > 0.40) {
        if (!hit) hit = { nearFact: fo.label, factVal: fo.v };
      }
    }
    if (hit) flagged.push({ number: n, token: raw, reason: 'fact_오인용_모순', nearFact: hit.nearFact });
    // 그 외(새/파생 숫자) = 합리적 파생으로 보고 통과.
  });
  return { ok: flagged.length === 0, flagged };
}

// 텍스트를 문장 단위로 쪼갠다(한국어 종결 + 줄바꿈 기준). 빈 조각 제거.
//   ★[2026-06-28] lookbehind 정규식((?<=...))은 구형 Safari(<16.4)·일부 웹뷰에서 SyntaxError →
//     검증 단계가 통째로 깨질 수 있어 폐기. lookbehind 없이 '마침표/종결' 뒤에 마커를 끼워 split.
function _splitSentences(text) {
  const s = String(text || '');
  if (!s) return [];
  // ① 문장부호(. ! ? 。) 뒤 + ② '다.'·'다 ' 같은 한국어 종결 + ③ 줄바꿈 에 분리 마커() 삽입.
  const marked = s
    .replace(/([.!?。])(\s+)/g, '$1')        // 문장부호 + 공백
    .replace(/(다)(\s+)(?=[가-힣A-Z0-9])/g, '$1$2')  // '~다 ' 뒤 (lookahead 만 — 호환됨)
    .replace(/[\n\r]+/g, '');                 // 줄바꿈
  return marked.split('').map((x) => x.trim()).filter(Boolean);
}

// 문장 단위 세탁: 모순(위조) 숫자나 금지어가 든 '그 문장만' 떨어낸다(나머지는 살림).
//   ★[2026-06-28] 각 문장에 _postProcessLine(대괄호·자사명 제거) 먼저 적용 후 검사.
//   반환 = 살아남은 문장들을 다시 이은 텍스트(전부 떨어지면 빈 문자열).
function _scrubSentences(text, facts) {
  const sents = _splitSentences(text);
  if (sents.length <= 1) {
    // 한 문장짜리: 후처리 → 모순/금지어면 통째 드롭, 아니면 그대로.
    const t = _postProcessLine(_str(text) || '');
    if (!t) return '';
    if (_hasBanned(t).length > 0) return '';
    return verifyNumbers(t, facts).ok ? t : '';
  }
  const kept = sents
    .map((s) => _postProcessLine(s))
    .filter((s) => s && _hasBanned(s).length === 0 && verifyNumbers(s, facts).ok);
  return kept.join(' ').trim();
}

// 금지어 세탁: 산출 문장에서 banned 단어가 있으면 표시(반려용).
function _hasBanned(text) {
  const t = String(text || '');
  return BANNED_WORDS.filter((w) => t.indexOf(w) >= 0);
}

// 자사 홍보어 — 프롬프트로 금지했지만, 만에 하나 남으면 후처리로 제거(문장은 안 버리고 그 구절만 잘라냄).
const SELF_PROMO_WORDS = ['빈크래프트', 'beancraft', 'BeanCraft'];

// ★[2026-06-29 정보분산 패스7] 화면 출처표기 전면 금지(사장님 결정 report-output-audit-fix).
//   AI가 "한국부동산원 자료에 따르면 …" 같은 출처명을 붙이면 그 출처 인용 구절만 들어내고 값(숫자)은 살린다.
//   값은 통합 단일값이므로 출처를 댈 필요가 없다. 자사명과 동일 방식(절 단위 제거)으로 처리.
const SOURCE_NAME_WORDS = ['한국부동산원', '부동산원', 'KOSIS', 'kosis', '공식 통계', '공식통계', '통계청'];
// 출처 인용 상투구(앞에 출처명, 뒤에 "자료/통계에 따르면/기준으로/에 의하면")까지 통째로 지우는 패턴.
const SOURCE_CITATION_RE = /(한국부동산원|부동산원|KOSIS|kosis|공식\s*통계|통계청)\s*(자료|통계|데이터|발표|조사|기준|집계)?\s*(에\s*따르면|에\s*의하면|을\s*기준으로|기준으로|에\s*따라|상)?\s*(으로|로|에)?\s*[,，]?\s*/g;

// ★[2026-06-28] 출력 후처리 — ①남은 대괄호([근거:...]·[...]) 제거 ②자사 홍보 문구 정리.
//   대괄호: 통째 삭제. 자사명: 그 자사명이 든 '절(clause)'을 잘라내되 문장은 살린다.
function _postProcessLine(text) {
  let t = String(text || '');
  if (!t) return '';
  // ① 대괄호 태그 제거([근거:항목=값], [출처:...], 그 외 [..] 모두). 전각 대괄호도.
  t = t.replace(/\s*[\[【][^\]】]*[\]】]/g, '');
  // ①-b ★[2026-06-29 패스7] 출처명/출처 인용 상투구 제거(화면 출처표기 금지). 값(숫자)은 남긴다.
  //   "한국부동산원 자료에 따르면 평당 월세는 41만원이며" → "평당 월세는 41만원이며".
  if (SOURCE_NAME_WORDS.some((w) => t.indexOf(w) >= 0)) {
    t = t.replace(SOURCE_CITATION_RE, '');                 // 출처 인용 상투구 통째 제거
    SOURCE_NAME_WORDS.forEach((w) => { t = t.split(w).join(''); });  // 남은 출처명 단어 제거
    // 출처명만 떼고 남은 어색한 조사/구두점 정리("이며·이고·자료에 따르면·으로/로" 잔재)
    t = t.replace(/^\s*(자료|통계|데이터)?\s*(에\s*따르면|에\s*의하면|기준으로|으로|로)\s*[,，]?\s*/, '');
    // 괄호 안 출처를 떼고 남은 빈/슬래시만 남은 괄호 정리: "(/)" "( · )" "()" → 삭제.
    t = t.replace(/[\(（]\s*[\/·,，、\s]*\s*(기준|출처|자료)?\s*[\)）]/g, '');
    t = t.replace(/\s*[,，]\s*[,，]/g, ', ').replace(/^\s*[,，·、]\s*/, '').trim();
  }
  // ② 자사명이 들어간 경우: 그 자사명을 포함하는 절(쉼표/구분 단위)을 들어내고 나머지로 자연스럽게 잇는다.
  const hasPromo = SELF_PROMO_WORDS.some((w) => t.indexOf(w) >= 0);
  if (hasPromo) {
    // 절 단위(쉼표·중점·"고 "·"며 ")로 쪼개 자사명 든 절만 제거.
    const parts = t.split(/(,|·|、)/);
    const kept = [];
    for (let i = 0; i < parts.length; i += 2) {
      const seg = parts[i];
      const sep = parts[i + 1] || '';
      if (SELF_PROMO_WORDS.some((w) => seg.indexOf(w) >= 0)) continue;  // 자사명 절은 버림
      kept.push(seg + (sep || ''));
    }
    t = kept.join('').replace(/[,·、]\s*$/, '').trim();
    // 절 분해로도 못 떼면(자사명이 문장 전체에 박힘) 단어만 지운다(최후수단).
    SELF_PROMO_WORDS.forEach((w) => { t = t.split(w).join(''); });
  }
  // 공백·구두점 정리.
  return t.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}

// ★[2026-06-28] 14개 카드 한 줄평(cardLines) 후처리·검증 — 종합과 동일 기준.
//   각 줄: ①_postProcessLine(대괄호 제거·자사명 절 제거) ②금지어 들면 그 줄 폐기(null)
//          ③PCN(verifyNumbers) — 지어낸(모순) 숫자 들면 그 줄 폐기(null).
//   폐기(null)된 줄은 호출부가 그 카드의 기존 결정적 폴백(bruSummary)을 그대로 쓰게 둔다(화면 안 깨짐).
//   facts 없으면 PCN 생략(후처리만). 입력 배열 길이/순서 유지.
function _cleanCardLines(cardLines, facts) {
  if (!Array.isArray(cardLines)) return cardLines;
  const useFacts = Array.isArray(facts) && facts.length > 0;
  const hasPromo = (t) => SELF_PROMO_WORDS.some((w) => String(t || '').indexOf(w) >= 0);
  return cardLines.map((line) => {
    const s = _str(line);
    if (!s) return null;                                   // 빈 줄 → 폴백
    // ① 문장 단위로 쪼개 자사명·금지어 든 '그 문장만' 버리고, 남은 문장은 각각 후처리(대괄호·절단위 자사명 제거).
    const sents = _splitSentences(s);
    const kept = sents
      .filter((sent) => !hasPromo(sent) && _hasBanned(sent).length === 0)  // 자사명/금지어 문장 제거
      .map((sent) => _postProcessLine(sent))                                // 남은 문장의 대괄호·잔여 자사명 정리
      .filter(Boolean);
    let cleaned = kept.join(' ').trim();
    // 한 문장짜리였는데 위에서 다 날아갔으면(예: 통째 자사명) 단어 제거 폴백 한 번 더.
    if (!cleaned) cleaned = _postProcessLine(s);
    if (!cleaned) return null;                              // 그래도 비면 폴백
    if (_hasBanned(cleaned).length > 0) return null;        // 잔존 금지어 → 폴백
    if (useFacts && !verifyNumbers(cleaned, facts).ok) return null;  // 지어낸 숫자 → 폴백
    return cleaned;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 3단계 — 꼬리물기 추론 runReasoningChain (★pro 단일콜로 압축, 종합만)
//   ★[2026-06-28 긴급] 4~5홉 순차호출 = 504(24초 초과)·과다호출(차단/과금 위험)이라 폐기.
//     gemini-2.5-pro 는 thinkingBudget(2048) 안에서 한 번 호출만으로 스스로 단계추론
//     (누가→언제→왜→빈수요)을 한다. 그러니 reason+synthesize 를 pro 1콜로 통합한다.
//   검색당 추가 AI콜 = pro 1콜만(14장 cardLines 는 기존 flash 1콜 그대로).
//   ★[2026-06-28 B관찰자형] 규칙: ①근거 facts 안 값만(지어내면 폐기) ②근거 숫자는 산문으로(대괄호/[근거] 금지)
//        ③doom·상투어 금지 ④회사명·자사서비스 언급 금지 ⑤평범 축 빼고 정직 기권 ⑥제품 단정 금지.
//   검증(PCN 숫자·금지어·후처리 대괄호/자사명 제거)은 전부 코드로(무료, 추가 AI콜 0).
// ─────────────────────────────────────────────────────────────────────────

// pro 단일 호출(multi-agent 1에이전트). thinkingBudget 2048 명시(자동 8192 금지). 실패=null.
//   중계기는 agent.thinkingBudget>=128 이면 그 값 유지 → 2048 통과 → 응답 ~10~15초 → 504 제거.
async function _callPro(prompt, schema, opts) {
  const o = opts || {};
  const agentTimeout = Math.min(o.agentTimeoutMs || REASON_AGENT_TIMEOUT_MS, 24000);
  // 클라이언트 abort 는 서버보다 넉넉히 커야 서버 응답을 기다린다(서버 타임아웃이 먼저 동작).
  const clientTimeout = agentTimeout + 2500;
  // ★[2026-06-28] AbortSignal.timeout 미지원 브라우저 방어 — 있으면 쓰고, 없으면 controller 폴백.
  //   (예전엔 AbortSignal.timeout 이 undefined 면 여기서 throw → 추론이 조용히 죽었을 수 있음.)
  let signal;
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      signal = AbortSignal.timeout(clientTimeout);
    } else if (typeof AbortController !== 'undefined') {
      const ctrl = new AbortController();
      setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, clientTimeout);
      signal = ctrl.signal;
    } else {
      signal = undefined;   // 둘 다 없으면 타임아웃 없이 호출(중계기 서버 타임아웃이 마감)
    }
  } catch (e) { signal = undefined; }
  _v10trace('pro_fetch_start', { agentTimeout, clientTimeout, hasSignal: !!signal, model: REASON_MODEL });
  let resp;
  try {
    resp = await fetch('/.netlify/functions/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(signal ? { signal } : {}),
      body: JSON.stringify({
        action: 'multi-agent',
        agents: [{
          id: 'reason',
          prompt,
          model: REASON_MODEL,                       // 'pro' → gemini-2.5-pro
          maxOutputTokens: o.maxTokens || REASON_MAX_TOKENS,
          temperature: 0,
          thinkingBudget: REASON_THINKING_BUDGET,    // ★2048 명시(자동 8192 금지) → 속도 ↑, 504 제거
          responseMimeType: 'application/json',
          responseSchema: schema,
          timeout: agentTimeout,
        }],
      }),
    });
  } catch (eFetch) {
    _v10trace('pro_fetch_err', { message: eFetch && eFetch.message, name: eFetch && eFetch.name });
    return null;
  }
  if (!resp.ok) {
    _v10trace('pro_fetch_done', { ok: false, status: resp.status });
    return null;
  }
  const data = await resp.json();
  const agent = data && data.results && data.results.reason;
  const textLen = (agent && typeof agent.text === 'string') ? agent.text.length : 0;
  _v10trace('pro_fetch_done', { ok: true, success: !!(agent && agent.success), textLen, err: agent && agent.error });
  if (!agent || !agent.success || !agent.text) return null;
  return parseJSON(agent.text);
}

// 확정 사실/신호를 프롬프트에 넣기 좋게 압축(라벨=값 단위 / 출처 / 신뢰도).
function _factsToLines(facts) {
  return (Array.isArray(facts) ? facts : []).map((f) =>
    `${f.label}=${f.value}${f.unit || ''} (출처:${f.source}, ${f.confidence})`
  );
}

const _CHAIN_RULES = `[관찰 규칙 — 엄수]
1. 아래 '근거 데이터' 안의 값만 사용한다. 없는 숫자를 지어내면 그 문장은 폐기된다.
2. 근거 숫자는 문장 속에 자연스럽게 녹여 쓴다. 대괄호·[근거:...]·라벨 표기 절대 금지(예: "주 고객의 59%가 50대 이상이라, ..." 처럼 산문으로).
3. doom·상투어 절대 금지: 쇠퇴/포화/블루오션/레드오션/붕괴/몰락/대박/핫플/"시그니처로 차별화" 같은 마케팅 클리셰.
4. 회사명·자사 서비스(빈크래프트/인테리어/메뉴개발/운영교육/시공) 언급 절대 금지. 오직 '자리(상권) 자체의 방향'만 서술한다.
5. 평범한(특이점 없는) 축은 억지로 끼우지 말고 뺀다. 근거가 부족하면 "대체로 평균 수준, 특이점 적음"으로 정직히 줄인다(지어내기 금지).
6. 구체 제품을 단정하지 마라("○○ 메뉴를 팔아라" 금지). "이 자리는 ○○ 특성이라 △△ 방향이 맞는다"까지만.
7. 출처명·기관명 인용 절대 금지: "한국부동산원/부동산원/KOSIS/공식 통계/통계청 자료에 따르면" 같은 표현 쓰지 마라. 값은 그대로 쓰되 출처를 대지 않는다(값은 이미 통합 단일값이다).`;

// pro 단일콜 프롬프트 — ★[2026-06-28] 'B 관찰자형'. 신호 3개에만 매달리지 말고 근거 facts '전체'를
//   여러 렌즈로 훑어 이 자리만의 해석을 펼친다. designDirection 이 핵심(서로 다른 축 4~6줄).
function buildReasoningPrompt(facts, signals, ctx) {
  const factStr = JSON.stringify(_factsToLines(facts), null, 0);
  const sigStr = JSON.stringify(signals || [], null, 0);
  const season = (ctx && ctx.season) || '';
  return `당신은 카페 상권 '관찰자(애널리스트)'다. 아래 근거 데이터(이 자리의 14개 분석 축 수치) 전체를 훑고, 이 자리만의 해석을 여러 각도로 펼쳐라. 통계는 '문지기'가 아니라 '근거 공급자'다 — 신호 몇 개에만 매달리지 말고 근거 데이터 전체에서 이 자리만의 연결을 찾아라.
${_CHAIN_RULES}

[관찰 렌즈 — designDirection 각 줄은 서로 '다른 렌즈'에서 도출하라. 같은 축(예: 연령) 반복 금지]
- 고객 특성(연령분포·성별·소득·1인가구·라이프스타일)
- 시간·요일(유동/매출 피크 시간·피크 요일·주중주말)
- 경쟁 구조(카페 수·개인/프랜 비중·브랜드 수·개인vs프랜 객단가)
- 비용·수익(평당 월세·보증금·권리금·예상 월수익·회수개월·공실률)
- 생존·리스크(1/3/5년 생존율·신규/폐업·기회/리스크 건수)
- 매출·소비(분위 상/중/하·시군구 대비·소비심리)
- 수요·SNS(SNS 키워드·검색 의도·인기 메뉴·배달 비중)
→ 매 줄 다른 렌즈에서, 그 렌즈의 근거 숫자를 문장 속에 자연스럽게 녹여 '이 자리만의 방향'을 말하라. 특이점 없는 렌즈는 건너뛰어라.

[근거 데이터 — 이 안의 숫자만 사용]
${factStr}
[특히 두드러진 신호(참고 — 여기에만 갇히지 말 것)]
${sigStr}
[기준월 계절] ${season}

[출력 — 순수 JSON 한 개만. 첫 글자 { 마지막 글자 }. 마크다운 금지. 존댓말. 대괄호·[근거] 라벨 금지]
{
  "bannerLine": "이 자리를 한 줄로 진단(60자 이내, 근거 숫자 1~2개를 문장 속에 자연스럽게).",
  "diagnosis": "이 자리의 핵심 해석을 엮은 2~3문장 한 단락(근거 숫자를 산문으로 녹여서).",
  "designDirection": ["서로 다른 렌즈에서 4~6줄. 각 줄 다른 축, 근거 숫자를 문장 속에 자연스럽게, 회사명·제품단정·상투어 없이 '이 자리는 이런 특성이라 이런 방향이 맞는다'."]
}`;
}

// 코드 검증(무료, AI호출 X): ★[2026-06-28] '문장 단위'로 세탁한다(전체 null 금지).
//   원칙(coordinator 지시): 모순(위조)·금지어가 든 '그 문장만' 떨어내고, 나머지는 살린다.
//   최소 1조각이라도 살아남으면 그걸로 반환(designDirection도 한 줄이라도 살리면 채택).
function _verifyReasoningOutput(synth, facts) {
  if (!synth || typeof synth !== 'object') return null;
  // ★[2026-06-28] 후처리 먼저: 대괄호·자사명 제거(_postProcessLine) → 그 다음 모순/금지어 검사.
  // 배너: 한 문장이라 통째 검사하되, 모순/금지어면 드롭(진단/설계는 살 수 있으니 전체 null 아님).
  const bannerRaw = _postProcessLine(_str(synth.bannerLine) || '');
  const cleanBanner = (bannerRaw && _hasBanned(bannerRaw).length === 0 && verifyNumbers(bannerRaw, facts).ok)
    ? bannerRaw : null;
  // 진단: 문장 단위 세탁 — 모순/금지어 문장만 빼고 이어붙임(_scrubSentences 안에서 후처리됨).
  const cleanDiag = _scrubSentences(_str(synth.diagnosis) || '', facts) || null;
  // 설계방향: 각 줄을 문장단위 세탁 후, 살아남은 줄만(최대 6). 한 줄이라도 살리면 채택.
  let dir = Array.isArray(synth.designDirection)
    ? synth.designDirection.map((x) => _scrubSentences(_str(x) || '', facts)).filter(Boolean).slice(0, 6)
    : [];
  // 최소 조건: 배너·진단·설계 중 하나라도 살아남으면 반환(전부 죽으면 그때만 폴백).
  if (!cleanBanner && !cleanDiag && dir.length === 0) return null;
  return {
    bannerLine: cleanBanner,
    diagnosis: cleanDiag,
    // 설계방향은 2줄 이상이어야 배관(화면 폴백 기준)에 쓰이지만, 1줄만 살아도 버리지 않고 그대로 둠
    //   (호출부가 length>=2 일 때만 덮어쓰고, 1줄이면 기존 템플릿 폴백 — 그래도 배너/진단은 살려 반환).
    designDirection: dir.length >= 1 ? dir : null,
    _hops: 1, _abstained: false,
  };
}

// 메인 — pro 단일콜 추론. 신호 0~1개면 호출 없이 코드로 정직 기권. 어떤 실패에서도 null(호출부 v9 폴백).
async function runReasoningChain(facts, signals, ctx) {
  _v10trace('rc_enter', { sigN: Array.isArray(signals) ? signals.length : -1, factsN: Array.isArray(facts) ? facts.length : -1 });
  // 신호가 거의 없으면(0~1개) AI 호출 자체를 안 한다(차단/과금 방어) → 정직 기권을 코드로 반환.
  if (!Array.isArray(signals) || signals.length <= 1) {
    _v10trace('rc_abstain', { sigN: Array.isArray(signals) ? signals.length : -1 });
    return {
      bannerLine: '대체로 평균 수준으로, 두드러진 특이점은 적은 상권입니다.',
      diagnosis: '수집된 데이터에서 전국·시군구 평균과 크게 벌어지는 항목이 거의 없습니다. 특정 방향으로 단정하기보다 대체로 평탄한 상권으로 볼 수 있습니다.',
      designDirection: [
        '두드러진 신호가 적은 만큼, 타깃을 명확히 한 콘셉트와 동선 설계로 안정적인 진입을 노릴 수 있는 자리입니다.',
        '세부 콘셉트는 현장의 흐름을 한 번 더 확인한 뒤 좁히는 편이 안전한 자리입니다.',
      ],
      _hops: 0, _abstained: true,
    };
  }

  const schema = {
    type: 'OBJECT',
    properties: {
      bannerLine: { type: 'STRING' },
      diagnosis: { type: 'STRING' },
      designDirection: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 4, maxItems: 6 },
    },
    required: ['bannerLine', 'diagnosis', 'designDirection'],
  };
  const prompt = buildReasoningPrompt(facts, signals, ctx);
  _v10trace('rc_built_prompt', { promptLen: prompt ? prompt.length : 0 });

  // ★검색당 pro 1콜만. 실패/타임아웃이면 null → 호출부가 v9 폴백.
  let synth = null;
  try {
    synth = await _callPro(prompt, schema, {});
  } catch (e) { _v10trace('rc_callpro_threw', { message: e && e.message }); synth = null; }
  _v10trace('rc_got_synth', { isNull: !synth });
  if (!synth) return null;

  // 검증(금지어·PCN 숫자대조)은 전부 코드(무료, 추가 AI호출 0).
  return _verifyReasoningOutput(synth, facts);
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
4. ★출처명·기관명 인용 금지 — "한국부동산원/부동산원/KOSIS/공식 통계/통계청 자료에 따르면" 같은 출처 인용 표현 절대 쓰지 마라. 값(숫자)만 쓰고 출처는 대지 않는다.

[★cardLines(14개 카드 한 줄평) — '관찰자' 품질로]
- cardLines 의 14줄은 위 bannerLine/diagnosis 규칙과 달리, 각 줄이 '그 카드'의 데이터를 '관찰자 시점'으로 해석한 한 줄이다([참고용 전체 수치]의 해당 카드 숫자를 근거로).
- 단순 숫자 복창 금지 — "그래서 이 자리에선 어떤 의미인가"까지 한 줄로(예: "주 고객의 59%가 50대 이상이라, 낮 시간 체류 수요가 큰 자리입니다").
- 근거 숫자는 문장 속에 자연스럽게 녹인다(대괄호·[근거:...]·라벨 절대 금지).
- 회사명·자사 서비스(빈크래프트/인테리어/메뉴개발/운영교육/시공) 언급 절대 금지.
- doom·상투어(쇠퇴/포화/블루오션/"시그니처로 차별화") 금지. 긍정·냉정 균형(과장도 doom도 금지).
- 그 카드에 숫자가 없으면 지어내지 말고 "전국 평균과 비슷한 수준입니다." 같은 중립 한 줄.
- 14줄은 서로 베끼지 말 것 — 각 카드 고유 내용으로.

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
  "cardLines": ["카드0 한 줄", ... 정확히 14개. 각 줄은 그 카드 데이터를 관찰자 시점으로 해석한 한 줄(50~90자). 근거 숫자를 문장 속에 자연스럽게(대괄호 금지), 회사명·상투어 없이, '그래서 이 자리에선 어떤 의미'까지. 숫자 없는 카드는 '전국 평균과 비슷한 수준입니다.' 같은 중립 한 줄. 14줄 서로 다르게."]
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

// v10 종합(배너/진단/설계방향) 전용 캐시 — 모양이 v9 와 달라(cardLines 없음) 검증식을 분리.
function readCache_v10(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    // 배너 또는 진단 중 하나라도 있으면 유효(설계방향은 선택).
    if (obj && typeof obj === 'object' && (obj.bannerLine || obj.diagnosis)) return obj;
  } catch (e) { /* 캐시 깨짐 → 무시 */ }
  return null;
}
function writeCache_v10(key, value) {
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
// [2026-06-28] 실경로 추적기 — 단계별로 window.__bcV10Trace 에 기록 + console.warn.
//   "실검색에서만 조용히 죽는다"의 원인을 딱 한 번 검색으로 확정하려고 심음.
//   parent window 까지 기록(iframe 안에서 돌 수도 있어서) — 콘솔에서 __bcV10Trace 로 바로 확인.
// ─────────────────────────────────────────────────────────────────────────
function _v10trace(step, value) {
  try {
    const w = (typeof window !== 'undefined') ? window : null;
    if (w) {
      if (!w.__bcV10Trace) w.__bcV10Trace = { _t0: Date.now(), steps: [] };
      w.__bcV10Trace[step] = value;
      w.__bcV10Trace.steps.push({ step, value, at: Date.now() - (w.__bcV10Trace._t0 || Date.now()) });
      // parent(상위 프레임)에도 미러 — iframe 격리 대비.
      try { if (w.parent && w.parent !== w) { w.parent.__bcV10Trace = w.__bcV10Trace; } } catch (e) { /* cross-origin */ }
    }
  } catch (e) { /* noop */ }
  try { console.warn('[v10trace]', step, value); } catch (e) { /* noop */ }
}

// ─────────────────────────────────────────────────────────────────────────
// [2026-06-28] v10 레이어를 단독 함수로 분리.
//   ★핵심 수정: 예전엔 getUnifiedDiagnosis 맨 앞 v9 캐시 hit 시 early-return 해버려서
//     (같은 동 두 번째 검색부터) v10 블록을 영영 안 지나갔음 = 실검색에서만 조용히 폴백.
//   이제 v9 캐시 hit 든 새 v9 호출이든 '둘 다' 이 레이어를 거친다 → v10 항상 시도(v10 캐시로 비용 방어).
//   반환: v10 성공이면 merged 결과, 실패/기권이면 v9Result 그대로(화면 안 깨짐).
async function _applyV10Layer(v9Result, bundle, ids) {
  const { dongCd, address, radius } = ids || {};
  try {
    const v10Key = `${AI_DIAG_V10_PREFIX}${_str(dongCd) || `${_str(address) || ''}|${_num(radius) || ''}`}`;
    _v10trace('1_reached_v10', { v10Key, hasBundle: !!(bundle && Array.isArray(bundle.cards)) });

    const v10Cached = readCache_v10(v10Key);
    if (v10Cached) {
      _v10trace('1b_v10_cache_hit', { hasDir: Array.isArray(v10Cached.designDirection) });
      return {
        ...v9Result,
        bannerLine: v10Cached.bannerLine || v9Result.bannerLine,
        diagnosis: v10Cached.diagnosis || v9Result.diagnosis,
        designDirection: Array.isArray(v10Cached.designDirection) ? v10Cached.designDirection : null,
        _source: 'reasoning-cache', _key: v10Key,
      };
    }

    const facts = computeGroundedFacts(bundle.cards);
    _v10trace('2_facts', { count: Array.isArray(facts) ? facts.length : 0 });
    const scored = scoreSignals(bundle.cards, bundle.benchmarks, bundle.menuRising, bundle.season);
    const sigN = (scored && Array.isArray(scored.signals)) ? scored.signals.length : 0;
    _v10trace('3_signals', { count: sigN, willAbstain: sigN <= 1, items: (scored.signals || []).map((s) => s.항목) });

    _v10trace('3b_calling_reason', { factsN: Array.isArray(facts) ? facts.length : 0, sigN, season: bundle.season });
    const reasoning = await runReasoningChain(facts, scored.signals, { season: bundle.season });
    _v10trace('4_reasoning', {
      isNull: !reasoning,
      abstained: reasoning ? reasoning._abstained : null,
      hops: reasoning ? reasoning._hops : null,
      hasBanner: !!(reasoning && reasoning.bannerLine),
      hasDiag: !!(reasoning && reasoning.diagnosis),
      dirLen: (reasoning && Array.isArray(reasoning.designDirection)) ? reasoning.designDirection.length : 0,
    });

    if (reasoning && (reasoning.bannerLine || reasoning.diagnosis || (Array.isArray(reasoning.designDirection) && reasoning.designDirection.length))) {
      const merged = {
        bannerLine: reasoning.bannerLine || v9Result.bannerLine,
        diagnosis: reasoning.diagnosis || v9Result.diagnosis,
        designDirection: Array.isArray(reasoning.designDirection) ? reasoning.designDirection : null,
      };
      writeCache_v10(v10Key, merged);
      _v10trace('7_wroteCache', { v10Key, dirLen: merged.designDirection ? merged.designDirection.length : 0 });
      _v10trace('8_applied', { dirLen: merged.designDirection ? merged.designDirection.length : 0, source: 'reasoning' });
      try { console.log('[AI추론v10] 적용 — 홉', reasoning._hops, '· 설계방향', merged.designDirection ? merged.designDirection.length : 0, '줄'); } catch (e) {}
      return {
        ...v9Result,
        bannerLine: merged.bannerLine,
        diagnosis: merged.diagnosis,
        designDirection: merged.designDirection,
        _source: 'reasoning', _key: v10Key,
      };
    }
    // reasoning 이 null 또는 빈 결과 → v9 폴백(화면 안 깨짐).
    _v10trace('6_verify_or_empty', { reason: reasoning ? '빈결과(검증 후 전부 반려)' : 'runReasoningChain_null' });
    return v9Result;
  } catch (eReason) {
    _v10trace('9_caught', { message: eReason && eReason.message });
    if (typeof console !== 'undefined') console.warn('[AI추론v10] 폴백→v9:', eReason && eReason.message);
    return v9Result;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 메인 — 캐시 우선 → 없으면 제미나이 1회 호출(temp 0) → 검증 → 캐시 → 반환.
//   어떤 실패에서도 throw 하지 않는다. 실패 = null 반환(호출부가 폴백).
// ─────────────────────────────────────────────────────────────────────────
export async function getUnifiedDiagnosis({ cards, kosisBoxData, collectedData, dataAsOf, address, radius }) {
  try {
    const dongCd = collectedData && collectedData.dongInfo && collectedData.dongInfo.dongCd;
    const key = diagnosisCacheKey({ dongCd, address, radius });
    _v10trace('0_enter', { dongCd: dongCd || null, hasAddress: !!address });

    // bundle 은 v9 캐시 hit 여부와 무관하게 항상 만든다(v10 레이어가 facts/signals 에 필요).
    const bundle = buildDiagnosisBundle({ cards, kosisBoxData, collectedData, dataAsOf, address, radius });
    const hasEnough = Array.isArray(bundle.cards) && bundle.cards.filter((c) => c && Object.keys(c).length > 0).length >= 4;

    const cached = readCache(key);
    if (cached) {
      // ★[2026-06-28 수정] 예전엔 여기서 early-return → v10 영영 안 돎(실검색 폴백 원인).
      //   이제 v9 캐시 hit 여도 v10 레이어를 거친다(v10 자체 캐시로 같은 동 1회만 pro).
      _v10trace('0b_v9_cache_hit', { hasEnough });
      const v9Cached = { ...validate(cached), designDirection: cached.designDirection || null, _source: 'cache', _key: key };
      // 옛 캐시(후처리 전)에도 대괄호/자사명/출처명/지어낸숫자 줄 정리 적용(화면 일관성).
      try {
        const _facts = computeGroundedFacts(bundle.cards);
        v9Cached.cardLines = _cleanCardLines(v9Cached.cardLines, _facts);
        // ★[2026-06-29 패스7] 옛 v9 캐시 배너/진단의 출처명·대괄호·자사명 세탁(출처표기 0건 보장).
        if (v9Cached.bannerLine) v9Cached.bannerLine = _postProcessLine(v9Cached.bannerLine) || v9Cached.bannerLine;
        if (v9Cached.diagnosis) v9Cached.diagnosis = _postProcessLine(v9Cached.diagnosis) || v9Cached.diagnosis;
      } catch (eCl) { /* 유지 */ }
      if (!hasEnough) return v9Cached;   // 데이터 빈약하면 v10 안 돌리고 v9 캐시 그대로
      return await _applyV10Layer(v9Cached, bundle, { dongCd, address, radius });
    }

    // 데이터가 거의 없으면 호출하지 않는다(토큰 낭비·헛 호출 방지) → 폴백.
    if (!hasEnough) return null;

    // ── 1회 통역(14 cardLines)은 기존 v9 그대로 호출(비용 방어: 14장은 다단 안 씀) ──
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

    // ★[2026-06-28] 14 cardLines 도 관찰자 품질 후처리·검증: 대괄호/자사명 제거 + PCN(지어낸 숫자 줄 폐기).
    //   폐기된 줄(null)은 호출부가 그 카드 기존 결정적 폴백을 쓴다. facts 로 숫자 검증.
    try {
      const _facts = computeGroundedFacts(bundle.cards);
      validated.cardLines = _cleanCardLines(validated.cardLines, _facts);
      // ★[2026-06-29 패스7] v9 배너/진단도 후처리(대괄호·자사명·출처명 제거). v10 실패 시 이게 화면에 남으므로
      //   출처표기(한국부동산원 등) 0건 보장을 위해 여기서도 세탁한다.
      if (validated.bannerLine) validated.bannerLine = _postProcessLine(validated.bannerLine) || validated.bannerLine;
      if (validated.diagnosis) validated.diagnosis = _postProcessLine(validated.diagnosis) || validated.diagnosis;
    } catch (eCl) { /* 후처리 실패해도 원본 cardLines 유지 */ }

    // v9(통역) 결과 = 14 cardLines 의 안전한 기반. 이게 곧 폴백 베이스다.
    writeCache(key, validated);
    const v9Result = { ...validated, designDirection: null, _source: 'ai', _key: key };
    _v10trace('0c_fresh_v9_done', { ok: true });

    // ── v10 추론 레이어(종합만): 신호점수화 → PoT 근거계산 → pro 단일콜. 실패면 v9Result 반환. ──
    return await _applyV10Layer(v9Result, bundle, { dongCd, address, radius });
  } catch (e) {
    // 빈응답/타임아웃/크레딧소진/네트워크 — 전부 폴백.
    if (typeof console !== 'undefined') console.warn('[AI진단] 폴백:', e && e.message);
    return null;
  }
}

// ★[2026-06-28] 격리 테스트용 export — facts/signals 더미로 pro 1콜만 찔러볼 수 있게.
//   풀검색 반복 없이 runReasoningChain(facts, signals, {season}) 1콜로 검증.
export { runReasoningChain, buildReasoningPrompt, computeGroundedFacts, scoreSignals };

// 브라우저 콘솔에서 1콜 격리 테스트: window.__bcTestReason(facts, signals, {season})
//   인자 없이 부르면 내장 더미(강남류)로 pro 1콜을 쏜다. 반환=추론 결과(또는 null=폴백).
if (typeof window !== 'undefined') {
  window.__bcTestReason = async (facts, signals, ctx) => {
    const _dummyFacts = facts || [
      { key: 'cafeCount', label: '카페 수', value: 60, unit: '개', source: '상권 분석', confidence: '실측' },
      { key: 'monthlySales', label: '월평균매출', value: 2800, unit: '만원', source: '매출 분석', confidence: '추정' },
      { key: 'sigunguAvgSales', label: '시군구평균매출', value: 1854, unit: '만원', source: '매출 분석', confidence: '추정' },
      { key: 'topAge', label: '주 고객 연령대', value: '30대', unit: null, source: '고객 분석', confidence: '추정' },
      { key: 'peakHour', label: '피크 시간', value: '21시', unit: null, source: '유동인구', confidence: '추정' },
      { key: 'rentPerPyeong', label: '평당 월세', value: 60, unit: '만원', source: '임대/창업 정보', confidence: '추정' },
    ];
    const _dummySignals = signals || [
      { 카드: 5, 카드명: '매출 분석', 항목: '동평균_시군구대비', 값: 2600, 기준: 1854, 방향: '높음', 신호점수: 1.6, 비교기준: '시군구평균' },
      { 카드: 7, 카드명: '임대/창업 정보', 항목: '평당월세_지역평균대비', 값: 60, 기준: 40, 방향: '높음', 신호점수: 2 },
      { 카드: 6, 카드명: '유동인구', 항목: '피크시간', 값: '21시', 방향: '야간' },
    ];
    const r = await runReasoningChain(_dummyFacts, _dummySignals, ctx || { season: '겨울' });
    try { console.log('[__bcTestReason] 결과:', r); } catch (e) {}
    return r;
  };

  // ★[2026-06-28] 실데이터 1콜 진단 훅 — window.__bcRunV10()
  //   풀검색 반복·차단 없이, 방금 검색한 라이브 데이터(window.__BC_DATA__.cards)로
  //   getUnifiedDiagnosis 가 쓰는 그 _applyV10Layer 경로를 '그대로' 1번 돌린다(=pro 1콜).
  //   콘솔: await window.__bcRunV10()  →  {result, trace} 로 어디서 끊기는지 단계 확인.
  window.__bcRunV10 = async () => {
    try {
      // __BC_DATA__ 는 보통 리포트 iframe 안에 있다. 현재창 → 자식 iframe 순으로 찾는다.
      const findBcData = () => {
        try { if (window.__BC_DATA__ && Array.isArray(window.__BC_DATA__.cards)) return window.__BC_DATA__; } catch (e) {}
        try {
          const frames = window.frames || [];
          for (let i = 0; i < frames.length; i++) {
            try { const d = frames[i].__BC_DATA__; if (d && Array.isArray(d.cards)) return d; } catch (e) { /* cross-origin */ }
          }
        } catch (e) {}
        // DOM iframe 직접 스캔(동일 출처면 contentWindow 접근 가능)
        try {
          const ifr = document.querySelectorAll('iframe');
          for (let i = 0; i < ifr.length; i++) {
            try { const d = ifr[i].contentWindow && ifr[i].contentWindow.__BC_DATA__; if (d && Array.isArray(d.cards)) return d; } catch (e) {}
          }
        } catch (e) {}
        return null;
      };
      const bc = findBcData();
      if (!bc || !Array.isArray(bc.cards) || bc.cards.length === 0) {
        return { error: 'no __BC_DATA__' };
      }

      // __BC_DATA__.cards = 화면순서(idx4↔5 스왑) · 각 원소 {n, body:{bodyData,chartData,...}}.
      //   buildDiagnosisBundle 은 데이터인덱스(4=개인,5=매출)·cards[i].bodyData/chartData 를 기대.
      //   → 스왑 되돌리고(데이터인덱스 4=화면5, 5=화면4) body.bodyData/chartData 로 모양 맞춘다.
      const screenCards = bc.cards;
      const pick = (screenIdx) => {
        const el = screenCards[screenIdx];
        const body = (el && el.body) ? el.body : {};
        return { bodyData: body.bodyData || {}, chartData: body.chartData || {} };
      };
      const cardsForBundle = [];
      for (let dataIdx = 0; dataIdx < 14; dataIdx++) {
        const screenIdx = dataIdx === 4 ? 5 : (dataIdx === 5 ? 4 : dataIdx);  // 4↔5 언스왑
        cardsForBundle.push(pick(screenIdx));
      }

      // 추적 초기화(이번 1콜만 깨끗하게 보이게).
      window.__bcV10Trace = { _t0: Date.now(), steps: [] };
      _v10trace('hook_start', { cardsN: screenCards.length, address: bc.address || null });

      const bundle = buildDiagnosisBundle({
        cards: cardsForBundle, kosisBoxData: null, collectedData: null,
        dataAsOf: bc.dataAsOf || '', address: bc.address || '', radius: bc.radius || 500,
      });
      // v9 베이스(여기선 안 부른다 — v10만 1콜). designDirection 폴백 기반만 만들어 넘긴다.
      const v9Base = { bannerLine: null, diagnosis: null, cardLines: new Array(14).fill(null), designDirection: null, _source: 'hook-v9base' };

      // ★getUnifiedDiagnosis 가 실제로 쓰는 그 함수 그대로 재사용(복제본 아님).
      const result = await _applyV10Layer(v9Base, bundle, {
        dongCd: null, address: bc.address || '', radius: bc.radius || 500,
      });
      _v10trace('hook_done', { source: result && result._source, dirLen: (result && Array.isArray(result.designDirection)) ? result.designDirection.length : 0 });
      try { console.log('[__bcRunV10] result:', result); } catch (e) {}
      return { result, trace: (window.__bcV10Trace && window.__bcV10Trace.steps) || [] };
    } catch (e) {
      try { _v10trace('hook_caught', { message: e && e.message }); } catch (e2) {}
      return { error: e && e.message, trace: (window.__bcV10Trace && window.__bcV10Trace.steps) || [] };
    }
  };
}

export const __aiDiagnosisInternals = {
  CARD_TITLES, _seasonOf, parseJSON, validate,
  // Phase 1 통계 선별 내부 — 검증/테스트용
  extractSignals, _pctDev, _attenuate, _seasonRelation, _makeSignal, _quantileSignal, _pctFromStr,
  SIGNAL_DEV_THRESHOLD, SIGNAL_MIN_SAMPLE, SIGNAL_WEAK_FACTOR,
  NATIONAL_INDIE_PCT, NATIONAL_FRANCH_PCT, INDIE_NATIONAL_DEV_THRESHOLD,
  // v10 추론 엔진 내부 — 검증/테스트용 (AI 호출 0 단계만 동기 검증 가능)
  scoreSignals, computeGroundedFacts, verifyNumbers, runReasoningChain, buildReasoningPrompt,
  _zScore, _impactOf, _sampleFactor, _seasonAdjustedGrowth, _scoreCandidate, _hasBanned,
  _verifyReasoningOutput, _factsToLines, _callPro, _splitSentences, _scrubSentences,
  _applyV10Layer, _v10trace, _postProcessLine, _cleanCardLines, SELF_PROMO_WORDS,
  BANNED_WORDS, REASON_MODEL, REASON_THINKING_BUDGET, REASON_AGENT_TIMEOUT_MS, REASON_MAX_TOKENS,
};
