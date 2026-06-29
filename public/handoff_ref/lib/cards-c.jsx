/* cards-c.jsx — Card 13 (5-axis decomposition) + Card 14 (radar + signals)
   [2026-05-19] 정답지: 모든 mock fallback 제거. 데이터 없으면 '데이터 수집 중' 표시. */

/* ============================================================
   Card 13 — 상권 경쟁 분석 (5축 분해 종합 평가)
   ============================================================ */
// [2026-06-25 버그3] 한글 받침 유무로 조사 자동 선택.
//   hasFinalConsonant: 마지막 글자가 받침이면 true. (한글 음절 = 0xAC00~0xD7A3, (코드−0xAC00)%28 ≠ 0 이면 받침 있음)
function bcHasJong(word) {
  if (!word) return false;
  const ch = String(word).trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절 아니면 받침 없음 취급
  return (code - 0xac00) % 28 !== 0;
}
// 받침 있으면 withJong(예: 이/은/을), 없으면 noJong(예: 가/는/를)
function bcJosa(word, withJong, noJong) {
  return word + (bcHasJong(word) ? withJong : noJong);
}

// [2026-06-29 정보분산 패스3 §1-15] 종합점수 → 등급어 단일 출처(화면·릴스·데이터셰어 공유).
//   ★dataMapper.js 의 export function bcScoreGrade 와 동일 표(cutoff·어휘) — iframe/모듈 두 런타임이라 미러한다.
//   고치면 양쪽을 함께 고쳐야 함. word=카드13 톤, letter=A~C 매핑.
if (typeof window !== 'undefined' && !window.bcScoreGrade) {
  window.bcScoreGrade = function (total) {
    const t = Number(total);
    if (!(t > 0) || !isFinite(t)) return { word: '데이터 수집 중', letter: '' };
    if (t >= 80) return { word: '유리한 자리', letter: 'A' };
    if (t >= 70) return { word: '무난한 자리', letter: 'A-' };
    if (t >= 60) return { word: '무난한 자리', letter: 'B+' };
    if (t >= 50) return { word: '보통 — 운영이 관건', letter: 'B' };
    if (t >= 40) return { word: '보통 — 운영이 관건', letter: 'C+' };
    if (t >= 20) return { word: '비용 관리가 관건인 자리', letter: 'C+' };
    return { word: '도전적·보완 필요한 자리', letter: 'C' };
  };
}

// [2026-06-29 정보분산 패스5 §1-7] 카페 밀집도 → 등급어 단일 출처(미러).
//   ★dataMapper.js 의 export function bcDensityGrade 와 동일 표(임계·어휘) — iframe/모듈 두 런타임이라 미러한다.
//   고치면 양쪽을 함께 고쳐야 함. 카드13 한줄평·카드14 종합·competLevel·릴스가 전부 이 6단계 등급어를 쓴다.
if (typeof window !== 'undefined' && !window.bcDensityGrade) {
  window.bcDensityGrade = function (cafeCount) {
    const n = Number(cafeCount);
    if (!(n > 0) || !isFinite(n)) return '';
    if (n <= 15) return '여유';
    if (n <= 40) return '보통';
    if (n <= 80) return '다소 밀집';
    if (n <= 150) return '밀집';
    if (n <= 250) return '과밀';
    return '매우 과밀';
  };
}

function Card13({ body = {} }) {
  const total = Number(body.totalScore) || 0;
  // [2026-06-26 매출 미수집 보류] 데이터층 약속: 매출 미수집(차단/비수도권)이면 ROI 종합점수를
  //   가짜로 채우지 않고 bodyData._roiUnavailable=true + _roiUnavailableReason 을 보낸다.
  //   이때 수익성·투자회수 축 점수=null, 종합점수=null(경쟁/생존/성장 3축은 정상값 있음).
  //   → 종합점수/게이지/등급/두 축을 '보류'로 표기. (false/없음이면 기존과 100% 동일)
  const _roiUnavail = (body.bodyData && body.bodyData._roiUnavailable === true);
  const _roiUnavailReason = (_roiUnavail && body.bodyData && body.bodyData._roiUnavailableReason)
    ? String(body.bodyData._roiUnavailableReason)
    : '매출 미수집(차단/미제공 가능) — 재검색 권장';
  // [2026-06-26] 추정 배지 약속 — 데이터층이 bodyData._estimated에 추정/폴백 값의 필드명을 담아 보냄.
  //   그 필드를 그릴 때만 옆에 회색 '추정' 배지. 실측이면 배지 없음. (값/계산 무변경)
  const _estSet13 = (window.bcEstSet ? window.bcEstSet(body.bodyData || {}) : new Set());
  const _isEst13 = (...keys) => (window.bcIsEst ? window.bcIsEst(_estSet13, ...keys) : false);
  const EstBadge = window.EstBadge || (() => null);
  // [2026-06-29 패스3 §1-15] 투자 대비 수익률 등급 — 단일 출처 bcScoreGrade(화면·릴스·셰어 공유). 점수·계산 무변경.
  const grade = (window.bcScoreGrade ? window.bcScoreGrade(total).word
    : (total >= 80 ? "유리한 자리" : total >= 60 ? "무난한 자리" : total >= 40 ? "보통 — 운영이 관건" : total >= 20 ? "비용 관리가 관건인 자리" : "도전적·보완 필요한 자리"));
  const survival3y = Number(body.survival3y) || 0;
  // [2026-06-30] 경쟁분석 '월매출' = 매출카드와 같은 단일 진실값(monthlyAvgSales=비즈맵 커피 분위 평균) 1순위.
  //   body.cafeSales(옛 소상공인 raw)가 어쩌다 주입돼도 단일값이 항상 이기게 순서 고정(1억 부활 방어).
  const cafeSales = Number(body.bodyData?.monthlyAvgSales)
    || Number(body.cafeSales)
    || Number(body.bodyData?.dongCafeAvgStable)
    || Number(body.bodyData?.monthly)
    || 0;
  const guAvg = Number(body.guAvg) || 0;
  // [2026-06-29 예언 제거] 사장월급 차감 진짜수익 '표시' 2줄 블록을 제거 → 표시용 _accProfit/_realProfit/_ownerWage/_hasProfitRows 불필요.
  //   (데이터층 realProfitMonthly 등은 dataMapper ROI 점수 계산용으로 그대로 남아 있음 — 점수는 무변경.)
  const sigungu = body.sigungu || "";
  const cafeCount = Number(body.cafeCount) || 0;
  const individualCount = Number(body.individualCount) || 0;
  const avgRent = Number(body.avgRent) || 0;
  // premiumCost: dataMapper에서 만원 단위. 억 단위 변환은 ÷10000 한번만.
  const premiumManwon = Number(body.premiumCost) || 0;
  const premiumEok = premiumManwon > 0 ? (premiumManwon / 10000).toFixed(1) : null;
  const risingMenu = body.risingMenu || null;
  const popularMenuTop = body.popularMenuTop || null;
  const popularMenuCount = Number(body.popularMenuCount) || 0;
  const weatherLabel = body.weatherLabel || "";
  const weatherScore = Number(body.weatherScore) || 0;
  const externalIndicators = body.externalIndicators || null;

  // [2026-06-28 ROI 가중치 정합] 5축 = 수익성25·투자회수15·경쟁여건20·생존안정20·성장성20 (합=100)
  //   한 장 요약 배너 값(__BC_DATA__.summary.stats: 손익분기 등)을 headline에 인용해 모순 0건.
  //   ※[2026-06-29] 총 창업비 합계 표기 폐기 후, 투자회수 headline은 점수 비율 기반 정성표현만 사용(_roiSt는 보조 인용 슬롯으로 유지).
  const _roiSt = (typeof window !== 'undefined' && window.__BC_DATA__ && window.__BC_DATA__.summary && window.__BC_DATA__.summary.stats) || {};
  void _roiSt;
  const axes = [
    {
      key: "profit",
      label: "수익성",
      max: 25,
      // 매출 미수집이면 점수 미산정(null) — 막대/숫자 대신 '미산정' 표기.
      score: _roiUnavail ? null : (Number(body.scoreMarket) || 0),
      unavail: _roiUnavail,
      headline: (() => {
        if (_roiUnavail) return '매출 미수집 — 수익성 미산정 (재검색 권장)';
        const _opPct = (body.roiOpProfitPct != null) ? Number(body.roiOpProfitPct) : null;
        const _opProfit = (body.roiMonthlyProfit != null) ? Number(body.roiMonthlyProfit) : null;
        const _sales = Number(body.roiMonthlySales) || cafeSales || 0;
        if (_opPct == null || _sales <= 0) return cafeSales > 0 ? `월매출 ${window.bcFmtMan(cafeSales) || (cafeSales.toLocaleString() + '만원')} — 수익성 분석 중` : '수익성 데이터 수집 중';
        const _salesTxt = window.bcFmtMan(_sales) || (_sales.toLocaleString() + '만원');
        const _profitTxt = (_opProfit != null) ? `${_opProfit >= 0 ? '+' : ''}${_opProfit.toLocaleString()}만원` : '';
        // 영업이익률 부호 그대로(음수면 음수). 톤은 긍정 처방: 적자라도 '임대 부담/원가 관리' 레버로 한 줄.
        if (_opPct >= 0) {
          return `월매출 ${_salesTxt} · 영업이익률 +${_opPct}%${_profitTxt ? ` (월이익 ${_profitTxt})` : ''} — 남는 장사 구조`;
        }
        return `월매출 ${_salesTxt} · 영업이익률 ${_opPct}%${_profitTxt ? ` (월이익 ${_profitTxt})` : ''} — 임대·원가 관리가 관건`;
      })(),
    },
    {
      key: "payback",
      label: "투자 회수",
      max: 15,
      // 매출 미수집이면 점수 미산정(null) — 막대/숫자 대신 '미산정' 표기.
      score: _roiUnavail ? null : (Number(body.scoreCompete) || 0),
      unavail: _roiUnavail,
      // [2026-06-29 예언 제거 + 사장님 확정] 투자 회수 축은 '동네평균 기준 상권평가 점수'라 점수(score)는 그대로 둔다.
      //   headline에서 ① '내 카페 회수 N개월/월수익 N만원'(예언) ② '총 창업비 합계 N만원'(동네별로 안 변해 무의미) 둘 다 뺀다.
      //   대신 점수 비율로 '초기 투자 부담이 평균 대비 위/아래'인지 정성으로만 안내(숫자 없이). 회수 시점은 단정하지 않는다.
      headline: (() => {
        if (_roiUnavail) return '매출 미수집 — 투자 회수 미산정 (재검색 권장)';
        const _sc = Number(body.scoreCompete) || 0;        // 투자회수 점수(0~15)
        const _ratio = _sc / 15;                            // 점수 비율(높을수록 회수 유리)
        if (_sc > 0) {
          const _burden = _ratio >= 0.6 ? '초기 투자 회수 여건이 평균보다 좋은 편'
            : _ratio >= 0.35 ? '초기 투자 회수 여건은 평균 수준'
            : '초기 투자 부담이 평균보다 큰 편';
          return `${_burden} — 회수 속도는 운영(객단가·회전율)에 따라 달라집니다`;
        }
        return '회수 속도는 운영(객단가·회전율)에 따라 달라집니다';
      })(),
    },
    {
      key: "competition",
      label: "경쟁 여건",
      max: 20,
      score: Number(body.scoreChange) || 0,
      // [2026-06-28 신뢰지표 정합] 경쟁 한줄평 = '반경 내 카페 수(밀집도)' 기반.
      //   ★폐기: 점포당 배후인구(perStorePop) 기반 문구. 인구·유동 데이터가 불안정해 4·8명 같은 무의미값이
      //     나오던 결함 → 채점에서도 빠졌고(dataMapper), 한줄평에서도 빼고 카페 수 밀집도 등급으로 표현한다.
      //   [2026-06-29 패스5 §1-7] 밀집도 등급어 = 단일 출처 window.bcDensityGrade(카드14·competLevel·릴스와 동일):
      //     ≤15 여유 · ≤40 보통 · ≤80 다소 밀집 · ≤150 밀집 · ≤250 과밀 · 그 이상 매우 과밀.
      //   + 개인 카페 비중(%)을 '차별화 여지'로 붙여 만회 경로 제시.
      //   perStorePop은 신뢰범위(점포당 ≥50명, dataMapper에서 이미 게이트)일 때만 보조 표시로 괄호 추가.
      headline: (() => {
        if (!(cafeCount > 0)) return '경쟁 데이터 수집 중';
        const _grade = window.bcDensityGrade ? window.bcDensityGrade(cafeCount)
          : (cafeCount <= 15 ? '여유'
            : cafeCount <= 40 ? '보통'
            : cafeCount <= 80 ? '다소 밀집'
            : cafeCount <= 150 ? '밀집'
            : cafeCount <= 250 ? '과밀'
            : '매우 과밀');
        const _diff = individualCount > 0
          ? ` — 개인 ${Math.round(individualCount / cafeCount * 100)}% 차별화 여지`
          : '';
        // 보조: 점포당 배후인구(신뢰범위일 때만 값이 옴). 채점 아님, 참고용 괄호.
        const _psp = (body.perStorePop != null) ? Number(body.perStorePop) : null;
        const _basis = body.perStorePopBasis || null;
        const _pspNote = (_psp != null && isFinite(_psp) && _psp > 0)
          ? ` (점포당 ${_psp.toLocaleString()}명${_basis === 'flow' ? ' 유동' : ''})`
          : '';
        return `반경 내 카페 ${cafeCount}개 — ${_grade}${_diff}${_pspNote}`;
      })(),
    },
    {
      key: "survival",
      label: "생존 안정",
      max: 20,
      score: Number(body.scoreSurvival) || 0,
      headline: survival3y > 0
        ? `3년 생존율 ${survival3y}% — ${survival3y >= 60 ? '상위' : survival3y >= 40 ? '평균' : '주의'}`
        : '생존율 데이터 수집 중',
    },
    {
      key: "growth",
      label: "성장성",
      max: 20,
      // [2026-06-25 사장님 확정] 성장성은 '시장(상권) 단위' 신호만. 근거에서 메뉴 완전 제거.
      //   메뉴(시그니처/급상승)는 '매장 단위' 강점이라 상권 성장성의 근거가 될 수 없다.
      //   진짜 driver 순서: ①신규/폐업 순증 ②5년 점포 변화율 ③전년 대비(YoY) 시장 추세.
      score: Number(body.scoreCost) || 0,
      headline: (() => {
        const _openCnt = Number(body.openCount) || Number(body.newOpen) || 0;
        const _closeCnt = Number(body.closeCount) || Number(body.closed) || 0;
        // ① 신규/폐업 순증 — 가장 직접적인 상권 성장 신호.
        if (_openCnt > 0 || _closeCnt > 0) {
          const _net = _openCnt - _closeCnt;
          const _label = _net > 0 ? '확장 국면' : _net < 0 ? '수축 국면' : '균형 회전';
          return `신규 ${_openCnt}개 / 폐업 ${_closeCnt}개 — ${_label}`;
        }
        // ② 5년 점포 변화율 (구조적·계절 무관).
        const _ch5 = Number(body.cafes5yChangeRate);
        if (isFinite(_ch5) && _ch5 !== 0) {
          return `5년 점포 ${_ch5 >= 0 ? '+' : ''}${Math.round(_ch5)}% — ${_ch5 > 0 ? '확장 추세' : '수축 추세'}`;
        }
        // ③ 전년 대비(YoY) 시장 매출 추세 (계절 보정된 구 단위 값).
        const _yoy = Number(body.prevYearRate);
        if (isFinite(_yoy) && _yoy !== 0) {
          return `전년 대비 시장 ${_yoy >= 0 ? '+' : ''}${_yoy}% — ${_yoy > 0 ? '성장세' : '둔화세'}`;
        }
        return '시장 성장 신호 수집 중';
      })(),
    },
  ];

  // [2026-06-26 보류] 미산정(score=null) 축은 강·약점/최대비율 산정에서 제외해 0점으로 오분류·NaN 정렬 방지.
  const _scoredAxes = axes.filter(a => a.score != null && isFinite(Number(a.score)));
  const _byRatio = _scoredAxes.slice().sort((a, b) => (b.score/b.max) - (a.score/a.max));
  // [2026-06-28 관찰자 시점·doom 금지 — 사장님 원칙] '강점 0개/약점 5개'식 과부정은 창업 동기를 꺾으므로 금지.
  //   ① 절대 강점(60%↑) 있으면 그걸 강점. ② 없으면 '강점 0'으로 끝내지 말고 동네 내 상대 상위 1~2축을 '상대적 우위'로 받침(_strRelative).
  //   ③ 약점은 진짜 낮은 축(40% 미만)만 — 0.4~0.6 어중간한 축까지 약점으로 몰아 공포 주지 않는다(냉정하되 다차원·만회 레버 연결).
  const _absStrong = _byRatio.filter(a => a.score / a.max >= 0.6);
  const _strRelative = _absStrong.length === 0;
  const strengths = _absStrong.length ? _absStrong : _byRatio.slice(0, Math.min(2, _byRatio.length));
  const _strKeys = new Set(strengths.map(a => a.key));
  const weaknesses = _byRatio.filter(a => (a.score / a.max < 0.4) && !_strKeys.has(a.key)).sort((a, b) => (a.score/a.max) - (b.score/b.max));
  const maxRatio = _scoredAxes.reduce((m, a) => Math.max(m, a.score/a.max), 0);

  // [2026-06-14] 우리 5축 점수 비율 → 우리 자체 등급 (외부 95점/외부 A등급 대체)
  //   85%↑ 우수 / 65%↑ 양호 / 45%↑ 보통 / 25%↑ 보완 여지 / 그 미만 보완 필요
  // [2026-06-25 ROI 톤] '취약' 단정 부정어 → '보완' 톤(거짓 아님, 균형).
  const axisGrade = (ratio) => {
    if (!(ratio > 0)) return '보완 필요';
    if (ratio >= 0.85) return '우수';
    if (ratio >= 0.65) return '양호';
    if (ratio >= 0.45) return '보통';
    if (ratio >= 0.25) return '보완 여지';
    return '보완 필요';
  };
  // KPI 3번째 타일에 노출할 우리 축: 가장 약한 축(없으면 가장 강한 축) — 자리 판단에 가장 중요
  const focusAxis = weaknesses[0] || strengths[0] || axes[0];
  const focusRatio = focusAxis ? (focusAxis.max > 0 ? focusAxis.score / focusAxis.max : 0) : 0;

  // 한 줄 요약 (점수·축 기반 동적 생성)
  // [2026-06-25 ROI 톤] 균형 처방. 점수 무변경, 표현만.
  //   낮은 점수도 "약점으로 끝"내지 않고, 가장 강한 축의 실제 수치(월매출/생존율/카페수 = strongest.headline)를
  //   레버로 붙여 만회 경로를 제시. 강한 축 수치가 실제 데이터라 빈말 응원이 아님.
  // [2026-06-25 버그2] 부제 = ROI 종합 관점 한 줄(경쟁 프레이밍 제거).
  //   밀집도 표현을 쓰면 경쟁여건 축과 같은 등급어를 그대로 인용해 카드 내 모순 0.
  //   [2026-06-29 패스5 §1-7] 등급어 = 단일 출처 window.bcDensityGrade(카드13 한줄평·competLevel·릴스와 동일 6단계).
  //     ★옛 자체 임계(>200 과밀/>80 보통/else 여유) 폐기 → 같은 카페수에 같은 단어.
  //   [버그3] 축 이름 뒤 조사는 bcJosa로 받침 자동 처리(성장성이/투자 회수가/경쟁 여건이 …).
  const densityWord = window.bcDensityGrade ? window.bcDensityGrade(cafeCount)
    : (cafeCount > 0 ? (cafeCount > 250 ? '매우 과밀' : cafeCount > 150 ? '과밀' : cafeCount > 80 ? '밀집' : cafeCount > 40 ? '다소 밀집' : cafeCount > 15 ? '보통' : '여유') : '');
  const headline = (() => {
    if (total === 0) return '데이터 수집 중';
    const strongest = strengths[0];
    // weaknesses는 비율 오름차순 정렬 → [0]이 가장 약한 축(최약점). 강점 strongest[0](최강)과 대칭.
    const weakest = weaknesses[0];
    const _good = total >= 60;
    if (strongest && weakest) {
      if (_good) {
        // 강점 축(받쳐줌) + 약점 축(다듬으면)을 ROI 수익률 관점으로. 조사 자동.
        return `${bcJosa(strongest.label, '이', '가')} 받쳐주는 자리 — ${bcJosa(weakest.label, '은', '는')} 다듬으면 투자 대비 수익률이 안정됩니다.`;
      }
      // 낮은 점수: 약점(원인)을 정직하게 짚되 → 강한 축의 실제 수치를 만회 레버로 연결.
      const _lever = (strongest.headline && !/수집 중/.test(strongest.headline))
        ? strongest.headline.split(' — ')[0].split('(')[0].trim()
        : `${strongest.label}`;
      // 밀집도는 경쟁여건 축과 같은 등급어만 사용(densityWord). '묻히는 밀도' 류 옛 표현 제거.
      const _densityNote = densityWord ? ` 카페 밀집도는 '${densityWord}'.` : '';
      return `${bcJosa(weakest.label, '이', '가')} 점수를 누르지만, ${bcJosa(_lever, '이', '가')} 받쳐줘 회전율·객단가로 수익률을 끌어올릴 수 있는 구조.${_densityNote}`;
    }
    return `투자 대비 수익률 — ${grade}.`;
  })();

  // [2026-06-14] "빈크래프트 종합 진단" — 전적으로 우리 5축 점수 기반.
  //   외부 창업기상도(95점)·외부 상권지도 A등급·외부 매출지수는 우리 종합 58점(보통)과
  //   기준·스케일이 달라 모순을 일으키므로 화면 노출 제거(점수 보너스로는 이미 내부 반영됨).
  //   여기서는 경쟁력 종합 점수(앵커) + 우리 5축을 점수 비율순으로 우리 등급으로만 표기.
  const diagnosisCards = (() => {
    const items = [];
    // 1) 우리 자체 종합 (5축 합산 점수 = total)
    // [2026-06-25 ROI 톤] 낮은 점수도 단정적 부정어 대신 '보완 방향' 톤(거짓 금지).
    const _gradeKr = total >= 80 ? '유리' : total >= 60 ? '무난' : total >= 40 ? '보통' : total >= 20 ? '비용 관리 관건' : '보완 필요';
    if (total > 0) items.push(['투자 대비 수익률', `${total}점 · ${_gradeKr}`, true]);
    // 2) 우리 5축을 점수 비율 내림차순으로 → 우리 등급(우수/양호/보통/주의/취약)으로 표기
    //    미산정 축(score=null)은 등급 대신 '미산정' 표기, 정렬은 최하위로(0 취급).
    if (total > 0) {
      const _ax = (a) => (a.score != null && isFinite(Number(a.score)) && a.max > 0) ? a.score / a.max : -1;
      const ranked = [...axes].sort((a, b) => _ax(b) - _ax(a));
      ranked.forEach(a => {
        if (items.length < 6) {
          const _u = (a.unavail === true) || a.score == null || !isFinite(Number(a.score));
          const _r = a.max > 0 ? (a.score || 0) / a.max : 0;
          items.push([a.label, _u ? '미산정' : axisGrade(_r), false]);
        }
      });
    }
    return items.slice(0, 6);
  })();

  return (
    <CardShell n="13" id="13"
      bruSummary={body.bruSummary}
      title="상권 경쟁 분석"
      sub="투자 대비 수익률 종합 (100점)">

      <div style={{display:"grid", gridTemplateColumns:"320px 1fr", gap:32, alignItems:"center", marginBottom:24, padding:"8px 8px 16px"}}>
        <div style={{display:"flex", justifyContent:"center"}}>
          {_roiUnavail
            ? <ScoreGauge id="c13.gauge" value={0} max={100} size={300} label="종합 보류"/>
            : <ScoreGauge id="c13.gauge" value={total} max={100} size={300} label={grade} accent/>}
        </div>
        <div>
          <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:600, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:14}}>한 줄 요약</div>
          {_roiUnavail ? (
            <div style={{marginBottom:28}}>
              <div style={{fontSize:30, fontWeight:700, lineHeight:1.35, color:"var(--matte-fg-2)", letterSpacing:"-0.015em"}}>매출 미수집 · 종합 보류</div>
              <div style={{fontSize:15, color:"var(--matte-fg-3)", marginTop:10, lineHeight:1.5}}>{_roiUnavailReason}</div>
            </div>
          ) : (
          <div style={{fontSize:30, fontWeight:700, lineHeight:1.35, color:"#fff", letterSpacing:"-0.015em", marginBottom:28}}>
            {headline}<br/>
            투자 대비 수익률은 <span style={{color:"#4C7BE4"}}>{grade}</span>로 봅니다.
          </div>
          )}
          <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14}}>
            {[
              ["3년 생존", survival3y > 0 ? String(survival3y) : '-', survival3y > 0 ? '%' : '', survival3y > 0 ? `전국 평균 대비 ${survival3y >= 39 ? '+' : ''}${(survival3y - 39).toFixed(1)}%${survival3y >= 39 ? '↑' : '↓'}` : '', survival3y >= 60, survival3y > 0 && _isEst13('survival3y', 'survival')],
              ["월매출", cafeSales > 0 ? (window.bcFmtMan(cafeSales) || cafeSales.toLocaleString() + '만원') : '-', '', cafeSales > 0 && guAvg > 0 ? `${sigungu || '시군구'} 평균 대비 ${cafeSales > guAvg ? '+' : ''}${Math.round((cafeSales/guAvg-1)*100)}%` : '', false, cafeSales > 0 && _isEst13('monthlyAvgSales', 'cafeSales')],
              [focusAxis ? focusAxis.label : '핵심 지표', total > 0 && focusAxis ? axisGrade(focusRatio) : '-', '', total > 0 && focusAxis ? `우리 분석 ${focusAxis.score}/${focusAxis.max}점 (${Math.round(focusRatio*100)}%)` : '', focusRatio >= 0.65, false],
            ].map(([l, v, u, sub, acc, est]) => (
              <div key={l} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:12, border:"1px solid var(--matte-line)"}}>
                <div style={{fontSize:14, color:"var(--matte-fg-3)", marginBottom:10, fontWeight:500, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}><span>{l}</span>{est ? <EstBadge/> : null}</div>
                <div style={{fontSize:32, fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1}}>{v}{u && <span style={{fontSize:14, color:"var(--matte-fg-3)", marginLeft:4, fontWeight:500}}>{u}</span>}</div>
                {sub && <div style={{fontSize:13, color: acc ? "#4C7BE4" : "var(--matte-fg-3)", marginTop:8, fontWeight:600}}>{sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5축 분해 */}
      <div className="bc-box" style={{padding:32}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:24}}>
          <div style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em"}}>한눈에 보기</div>
          {_roiUnavail
            ? <div style={{fontSize:14, color:"var(--matte-fg-3)"}}>종합 <strong style={{color:"var(--matte-fg-2)", fontSize:15, marginLeft:4}}>보류</strong> (매출 미수집)</div>
            : <div style={{fontSize:14, color:"var(--matte-fg-3)"}}>항목 점수 합 = 종합 <strong style={{color:"var(--matte-fg)", fontSize:17, marginLeft:4}}>{total}</strong>점</div>}
        </div>

        <window.DrStagger id="c13.axes" delay={140} style={{display:"flex", flexDirection:"column"}}>
        {axes.map((a, idx) => {
          // [2026-06-26 보류] 미산정 축(score=null): 막대/숫자/비율 대신 '미산정'(회색).
          const _unavail = (a.unavail === true) || a.score == null || !isFinite(Number(a.score));
          const pct = (!_unavail && a.max > 0) ? a.score / a.max : 0;
          const isMax = !_unavail && a.max > 0 && pct === maxRatio && maxRatio > 0;
          const barColor = isMax ? "#4C7BE4" : "#FFFFFF";
          return (
            <div key={a.key} style={{padding:"20px 0", borderTop: idx > 0 ? "1px solid var(--matte-line)" : "none"}}>
              <div style={{display:"grid", gridTemplateColumns:"180px 1fr 130px", gap:20, alignItems:"center"}}>
                <div>
                  <div style={{fontSize:17, fontWeight:700, color: isMax ? "#4C7BE4" : (_unavail ? "var(--matte-fg-3)" : "#fff"), letterSpacing:"-0.01em", marginBottom:4}}>{a.label}</div>
                  <div style={{fontSize:13, color:"var(--matte-fg-3)", fontVariantNumeric:"tabular-nums"}}>만점 {a.max}점</div>
                </div>
                <div>
                  <div className="bc-bar" style={{height:14, background:"rgba(255,255,255,0.05)", marginBottom:10}}>
                    {!_unavail && <div style={{width:`${pct*100}%`, background:barColor, height:"100%", borderRadius:"inherit", transition:"width 0.9s var(--ease)"}}></div>}
                  </div>
                  <div style={{fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>{a.headline}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  {_unavail ? (
                    <div style={{fontSize:18, fontWeight:700, color:"var(--matte-fg-3)", letterSpacing:"-0.01em", lineHeight:1}}>미산정</div>
                  ) : (
                    <>
                      <div style={{fontSize:36, fontWeight:700, color: isMax ? "#4C7BE4" : "var(--matte-fg)", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1}}>{a.score}</div>
                      <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:8}}>비율 <strong style={{color:"var(--matte-fg-2)", fontWeight:700}}>{Math.round(pct*100)}%</strong></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </window.DrStagger>
      </div>

      {/* [2026-06-29 예언 제거] '월 수익 2줄(회계상 영업이익 / 사장월급 뺀 진짜 수익)'은 내 카페 월수익을 단정하는
            예측이라 화면에서 제거. ROI 5축 점수(수익성·투자회수)는 동네평균 기준 상권평가라 그대로 두되,
            '내 카페가 매달 얼마 번다'는 예언성 숫자만 화면에서 뺀다. (데이터층 realProfitMonthly 등은 점수 계산용으로 유지.) */}

      {/* 강점 / 약점 — 자동 분류 (mock 활용/대응 박스 제거) */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
        <div className="bc-box" style={{padding:28, border:"1px solid rgba(76, 123, 228,0.35)", background:"linear-gradient(180deg, rgba(76, 123, 228,0.06), transparent 70%)", display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18}}>
            <div style={{fontSize:18, fontWeight:700, color:"#4C7BE4", letterSpacing:"-0.01em"}}>{_strRelative ? '상대적 우위' : '강점'}</div>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600}}>{strengths.length}개</div>
          </div>
          {strengths.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:14, flex:1}}>
              {strengths.map(a => (
                <div key={a.key} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)", flex:1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
                    <span style={{fontSize:18, fontWeight:700, color:"#fff", letterSpacing:"-0.005em"}}>{a.label}</span>
                    <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"#4C7BE4", letterSpacing:"-0.01em"}}>{a.score}<span style={{fontSize:14, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>/{a.max}</span></span>
                  </div>
                  <div style={{fontSize:15, color:"var(--matte-fg-2)", lineHeight:1.55}}>{a.headline}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center", fontSize:14, color:"var(--matte-fg-3)", lineHeight:1.6, padding:"20px 0"}}>축별 점수가 고르게 분포 — 뚜렷이 앞서는 축은 적지만 치명적 약점도 적은 무난한 구조입니다.</div>
          )}
        </div>

        <div className="bc-box" style={{padding:28, display:"flex", flexDirection:"column"}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18}}>
            <div style={{fontSize:18, fontWeight:700, letterSpacing:"-0.01em"}}>약점</div>
            <div style={{fontSize:14, color:"var(--matte-fg-3)", fontWeight:600}}>{weaknesses.length}개</div>
          </div>
          {weaknesses.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:14, flex:1}}>
              {weaknesses.map(a => (
                <div key={a.key} style={{padding:"20px 22px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--matte-line)", flex:1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
                    <span style={{fontSize:18, fontWeight:700, color:"#fff", letterSpacing:"-0.005em"}}>{a.label}</span>
                    <span style={{fontSize:20, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"var(--matte-fg)", letterSpacing:"-0.01em"}}>{a.score}<span style={{fontSize:14, color:"var(--matte-fg-3)", marginLeft:3, fontWeight:500}}>/{a.max}</span></span>
                  </div>
                  <div style={{fontSize:15, color:"var(--matte-fg-2)", lineHeight:1.55}}>{a.headline}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center", fontSize:14, color:"var(--matte-fg-3)", lineHeight:1.6, padding:"20px 0"}}>모든 축이 기준선 이상 — 뚜렷한 약점이 없는 안정적인 자리입니다.</div>
          )}
        </div>
      </div>

      {/* 빈크래프트 종합 진단 — 우리 5축 점수 기반 (외부 지표 노출 제거) */}
      {diagnosisCards.length > 0 && (
        <div className="bc-box" style={{padding:"24px 32px", marginTop:16, display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:24, alignItems:"center"}}>
          <div style={{display:"flex", flexDirection:"column", gap:2}}>
            <div style={{fontSize:13, color:"var(--matte-fg)", fontWeight:700, letterSpacing:"0.04em"}}>빈크래프트 종합 진단</div>
            <div style={{fontSize:11, color:"var(--matte-fg-4)", fontWeight:500}}>우리 5축 분석 기준</div>
          </div>
          {diagnosisCards.map(([l, v, isOurs], i) => (
            <div key={i} style={{display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4}}>
              <div style={{fontSize:13, color:"var(--matte-fg-3)", fontWeight:500}}>{l}</div>
              <div style={{fontSize:18, color: isOurs ? "#4C7BE4" : "var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.005em"}}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

/* ============================================================
   Card 14 — AI 종합 분석 (레이더 + 시그널 + 디렉터 버튼)
   ============================================================ */
function Card14({ body = {}, onOpenDirector }) {
  const total = Number(body.totalScore) || 0;
  const opportunities = Number(body.opportunities) || 0;
  const risks = Number(body.risks) || 0;
  // [2026-06-29 패스3 §1-15] 수익률 등급(word)·letter 모두 단일 출처 bcScoreGrade. 점수 무변경.
  const _g14 = (window.bcScoreGrade ? window.bcScoreGrade(total) : { word: '', letter: '' });
  const recommendation = body.recommendation || _g14.word;
  const grade = _g14.letter;
  // [2026-06-29 패스3 §1-14] Card14 레이더·초점축 5축 = body.axes(= dataMapper card11.axes5 단일 배열)를 그대로 읽는다.
  //   ★옛 _NEWMAX 라벨덮어쓰기 폐기 — max 가 이미 단일 배열(25/15/20/20/20)로 들어오므로 라벨매칭 어긋남 위험이 사라짐.
  const _srcAxes = Array.isArray(body.axes) ? body.axes : [];
  const axesArr = (_srcAxes.length === 5)
    ? _srcAxes.map(a => ({ label: a.label, max: Number(a.max) > 0 ? Number(a.max) : 1, score: Number(a.score) || 0 }))
    : [];
  const radarAxes = axesArr.length === 5
    ? axesArr.map(a => ({ label: a?.label || '-', max: Number(a?.max) > 0 ? Number(a.max) : 1 }))
    : [];
  const radarValues = axesArr.length === 5
    ? axesArr.map(a => Number(a?.score) || 0)
    : [];
  const allSignals = Array.isArray(body.signals) ? body.signals : [];
  const positiveSignals = allSignals.filter(s => s.type === 'positive').map(s => s.text);
  const negativeSignals = allSignals.filter(s => s.type === 'negative').map(s => s.text);
  const tags = Array.isArray(body.tags) ? body.tags : [];
  // [2026-06-26] 신뢰 점수 재정의 — 자기참조(리포트가 얼마나 채워졌나) 폐기.
  //   데이터층 약속(bodyData._estimated = 추정/폴백 값의 필드명)을 읽어
  //   "핵심 지표 N개 중 실집계(추정 아님) 몇 개"로 바꾼다. 90~100 수렴 무의미 → 실측 비율.
  //   _estimated 가 아직 안 오면(데이터층 미연동) 표시를 끄고(null) 자기참조로 회귀하지 않는다.
  const _bd = body.bodyData || {};
  const _estSet = (window.bcEstSet ? window.bcEstSet(_bd) : new Set());
  // 리포트 핵심 지표(개념) — 추정 배지가 붙는 끝단 값과 동일한 필드명 사용.
  const TRUST_METRICS = ['monthlyAvgSales', 'avgRent', 'survival3y', 'newOpen', 'closed', 'avgPrice', 'opProfitPct', 'costRate'];
  const trustInfo = (() => {
    // _estimated 가 비어 있고(=데이터층이 추정 정보 자체를 안 보냄) 추정 키도 없으면 신뢰비율 산출 근거 없음 → 표시 안 함.
    if (!_estSet || _estSet.size === 0) return null;
    const totalN = TRUST_METRICS.length;
    const estN = TRUST_METRICS.filter(k => _estSet.has(String(k))).length;
    const realN = totalN - estN; // 실집계(추정 아님) 개수
    return { realN, totalN, pct: Math.round((realN / totalN) * 100) };
  })();

  // [2026-06-15] "한 장 요약" 병합 — 상단 배너 제거 후 본 카드로 흡수.
  const _sum = (typeof window !== 'undefined' && window.__BC_DATA__ && window.__BC_DATA__.summary) || {};
  const _st = _sum.stats || {};
  // [2026-06-25] 통합 AI 진단: 배너 한 줄(bannerLine)·통합 진단 단락(diagnosis).
  //   없으면(폴백) 기존 결정적 텍스트(verdictLine·designDirection)를 그대로 쓴다.
  const _aiBanner = (typeof _sum.bannerLine === 'string' && _sum.bannerLine.trim()) ? _sum.bannerLine.trim() : '';
  const _aiDiagnosis = (typeof _sum.diagnosis === 'string' && _sum.diagnosis.trim()) ? _sum.diagnosis.trim() : '';
  const _headLine = _aiBanner || _sum.verdictLine || '';

  return (
    <CardShell n="14" id="14"
      bruSummary={body.bruSummary}
      title="AI 종합 분석"
      sub="AI 에이전트 종합 피드백"
      headerRight={
        <button onClick={onOpenDirector} className="bc-btn" style={{height:32, padding:"0 14px", fontSize:15}}>
          <i className="ph ph-sparkle"></i> AI 디렉터
        </button>
      }>

      {/* [2026-06-29 예언 제거 + 사장님 확정] 한 장 요약 — '예상 월매출·회수기간'(내 카페 예언)은 위험한 단정이라 제거.
            '총 창업비'(합계)도 동네별로 안 변해 무의미 → 삭제. 남기는 값은 하나: 손익분기(목표=얼마 팔아야 본전, 예측 아님).
            ※ ROI 5축 점수(수익성·투자회수)는 동네평균 기준 상권평가라 그대로 둠 — 여기선 '내 카페 예언/합계' 표시만 뺀다. */}
      {(_sum.verdict || _headLine || (_sum.reasons && _sum.reasons.length) || _sum.riskLine ||
        _st.bepSalesText) && (
        <>
          <div className="bc-box" style={{padding:18, borderLeft:"3px solid #4C7BE4", marginBottom:16}}>
            {_sum.verdict && (
              <span style={{color:"#4C7BE4", fontWeight:700, fontSize:13, letterSpacing:"0.04em"}}>{_sum.verdict}</span>
            )}
            {_headLine && (
              <div style={{color:"var(--matte-fg)", fontSize:17, fontWeight:600, lineHeight:1.4, marginTop:6}}>{_headLine}</div>
            )}
            {Array.isArray(_sum.reasons) && _sum.reasons.length > 0 && (
              <div style={{display:"flex", flexWrap:"wrap", gap:8, marginTop:12}}>
                {_sum.reasons.map((r, i) => <span key={i} className="bc-pill">{r}</span>)}
              </div>
            )}
            {_sum.riskLine && (
              <div style={{color:"var(--matte-fg-3)", fontSize:14, marginTop:10}}>핵심 리스크 — {_sum.riskLine}</div>
            )}
          </div>

          {/* [2026-06-29 사장님 확정] '총 창업비' 타일(sum4) 삭제 — 합계가 동네별로 안 변해 무의미.
              남는 칸 = 손익분기(목표=얼마 팔아야 본전, 예측 아님)만 단독 표기. */}
          {_st.bepSalesText && (
            <div style={{marginBottom:16}}>
              <StatTile id="c14.sum2" tone="mint"  label="손익분기 (목표 매출)" value={_st.bepSalesText || '-'} sub={_st.bepCups ? ('하루 약 ' + _st.bepCups + '잔') : ''} hero/>
            </div>
          )}
          <div style={{fontSize:12, color:"var(--matte-fg-4)", lineHeight:1.65, marginBottom:4}}>
            손익분기는 ‘매달 이만큼(하루 잔 수)만 팔면 본전’이 되는 목표 매출이에요. 동네 실제 임대료 기준 고정비로 계산한 값이라, 장사를 가늠하는 목표선으로 보시면 됩니다.
          </div>
        </>
      )}

      <div style={{display:"grid", gridTemplateColumns:"260px 1fr", gap:24, marginBottom:18}}>
        <div className="bc-tile tone-blue accent" style={{padding:28, minHeight:180, display:"flex", flexDirection:"column", justifyContent:"space-between"}}>
          <div>
            <div className="label" style={{fontSize:15}}>종합 점수</div>
            <div style={{display:"flex", alignItems:"baseline", gap:8, marginTop:10}}>
              <span style={{fontSize:80, fontWeight:700, letterSpacing:"-0.03em", lineHeight:1, fontVariantNumeric:"tabular-nums", color:"#4C7BE4"}}><CountUp id="c14.score" value={String(total)}/></span>
              <span style={{fontSize:18, color:"var(--matte-fg-3)", fontWeight:500}}>/ 100점</span>
            </div>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:14, borderTop:"1px solid var(--matte-line)"}}>
            <span style={{fontSize:15, color:"var(--matte-fg-3)"}}>등급 · {recommendation}</span>
            <span style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em", color:"#fff"}}>{grade}</span>
          </div>
        </div>

        <div className={"c14-kpi " + (trustInfo ? "bc-grid-3" : "bc-grid-2")} style={{gap:12}}>
          <StatTile id="c14.kpi1" tone="mint"  label="기회"    value={String(opportunities)} unit="건" hero/>
          <StatTile id="c14.kpi2" tone="rose"  label="리스크"  value={String(risks)} unit="건" deltaPositive={false} hero/>
          {trustInfo && (
            <StatTile id="c14.kpi3" tone="cream" label="실집계 지표"
              value={String(trustInfo.realN)} unit={"/" + trustInfo.totalN}
              sub={`핵심 지표 ${trustInfo.totalN}개 중 실측 ${trustInfo.realN}개 (${trustInfo.pct}%)`}/>
          )}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24}}>
        <div className="bc-box" style={{padding:18, display:"flex", flexDirection:"column"}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:8}}>한눈에 보기</div>
          {radarAxes.length === 5 && radarValues.some(v => v > 0) ? (
            <>
              <div style={{display:"flex", justifyContent:"center"}}>
                <Radar
                  id="c14.radar"
                  size={320}
                  accent
                  axes={radarAxes}
                  values={radarValues}
                />
              </div>
              <div style={{flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between", gap:12, marginTop:16, paddingTop:16, borderTop:"1px solid var(--matte-line)"}}>
                {axesArr.map((a, idx) => {
                  const mx = Number(a?.max) > 0 ? Number(a.max) : 1;
                  const sc = Number(a?.score) || 0;
                  const pct = Math.round((sc / mx) * 100);
                  return (
                    <div key={idx}>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
                        <span style={{fontSize:14, color:"var(--matte-fg-2)", fontWeight:600, letterSpacing:"-0.01em"}}>{a?.label || '-'}</span>
                        <span style={{fontSize:14, color:"var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{sc}<span style={{fontSize:12, color:"var(--matte-fg-3)", fontWeight:500}}> / {mx}</span></span>
                      </div>
                      <div className="bc-bar" style={{height:8, background:"rgba(255,255,255,0.08)"}}>
                        <div style={{width:`${pct}%`, background:"#4C7BE4", height:"100%", borderRadius:"inherit", transition:"width 0.9s var(--ease)"}}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 0", color:"var(--matte-fg-4)", fontSize:13}}>점수 데이터 수집 중</div>
          )}
        </div>

        <div>
          <div className="bc-box" style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:15, color:"var(--matte-fg)", fontWeight:700, marginBottom:10, letterSpacing:"0.04em"}}>긍정 시그널 ({positiveSignals.length})</div>
            {positiveSignals.length > 0 ? (
              <window.DrStagger id="c14.signal.pos" delay={80} style={{display:"flex", flexDirection:"column", gap:10}}>
                {positiveSignals.map((t, i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:6, fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </window.DrStagger>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>개인 카페 비중을 살린 차별화 콘셉트면 비집고 들어갈 자리가 있습니다.</div>
            )}
          </div>
          <div className="bc-box" style={{padding:16}}>
            <div style={{fontSize:15, color:"var(--matte-fg-2)", fontWeight:700, marginBottom:10, letterSpacing:"0.04em"}}>부정 시그널 ({negativeSignals.length})</div>
            {negativeSignals.length > 0 ? (
              <window.DrStagger id="c14.signal.neg" delay={100} style={{display:"flex", flexDirection:"column", gap:10}}>
                {negativeSignals.map((t, i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:6, fontSize:14, color:"var(--matte-fg-2)", lineHeight:1.5}}>
                    <span style={{fontSize:13, color:"var(--matte-fg-4)", fontVariantNumeric:"tabular-nums", fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </window.DrStagger>
            ) : (
              <div style={{fontSize:13, color:"var(--matte-fg-4)"}}>부정 시그널 없음</div>
            )}
          </div>
          {/* [2026-06-28] 통합 AI 진단 단락 + 설계방향을 '둘 다' 보여준다(예전엔 진단 있으면 설계방향을
                early return 으로 숨겨서 v10 추론 설계방향이 화면에 절대 안 떴음 = 라이브 폴백 착시 원인).
                설계방향 우선순위: v10 추론(body.designDirection 으로 UnifiedLayout 가 덮음) > dataMapper 템플릿.
                진단(통합 진단)이 있으면 진단 박스, 그와 별개로 설계방향이 있으면 설계방향 박스도 함께 렌더. */}
          {_aiDiagnosis && (
            <div className="bc-box" style={{padding:18, marginTop:12, background:"rgba(76, 123, 228,0.08)", border:"1px solid rgba(76, 123, 228,0.40)"}}>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
                <i className="ph ph-magnifying-glass" style={{fontSize:18, color:"#4C7BE4"}}></i>
                <span style={{fontSize:15, color:"#4C7BE4", fontWeight:700, letterSpacing:"0.02em"}}>통합 진단</span>
              </div>
              <div style={{fontSize:14.5, color:"var(--matte-fg)", lineHeight:1.7}}>{_aiDiagnosis}</div>
              <div style={{display:"flex", alignItems:"center", gap:8, marginTop:14, paddingTop:12, borderTop:"1px solid rgba(76, 123, 228,0.25)", fontSize:13.5, color:"var(--matte-fg-3)"}}>
                <i className="ph ph-chats-circle" style={{fontSize:16, color:"#4C7BE4"}}></i>
                <span>여기서부터는 상담 — 진단을 바탕으로 어떻게 풀지는 전문가와 함께 설계합니다.</span>
              </div>
            </div>
          )}
          {(() => {
            // 설계방향 — v10 추론 우선(UnifiedLayout 가 body.designDirection 을 v10 값으로 덮어둠),
            //   없으면 _sum.designDirection, 그래도 없으면 dataMapper 템플릿(body.designDirection 원본).
            const dd = (Array.isArray(_sum.designDirection) && _sum.designDirection.length) ? _sum.designDirection : body.designDirection;
            const ddItems = Array.isArray(dd)
              ? dd.filter(x => typeof x === 'string' && x.trim().length > 0)
              : (typeof dd === 'string' && dd.trim().length > 0 ? [dd.trim()] : []);
            if (ddItems.length === 0) return null;
            return (
              <div className="bc-box" style={{padding:18, marginTop:12, background:"rgba(76, 123, 228,0.08)", border:"1px solid rgba(76, 123, 228,0.40)"}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
                  <i className="ph ph-compass-tool" style={{fontSize:18, color:"#4C7BE4"}}></i>
                  <span style={{fontSize:15, color:"#4C7BE4", fontWeight:700, letterSpacing:"0.02em"}}>이렇게 설계하면 됩니다</span>
                </div>
                <window.DrStagger id="c14.design" delay={90} style={{display:"flex", flexDirection:"column", gap:11}}>
                  {ddItems.map((t, i) => (
                    <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:8, fontSize:14, color:"var(--matte-fg)", lineHeight:1.55}}>
                      <span style={{fontSize:13, color:"#4C7BE4", fontVariantNumeric:"tabular-nums", fontWeight:700}}>{String(i+1).padStart(2,"0")}</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </window.DrStagger>
              </div>
            );
          })()}
        </div>
      </div>

      <button onClick={onOpenDirector} className="bc-btn bc-btn--lg" style={{marginTop:20, width:"100%", justifyContent:"center"}}>
        <i className="ph-fill ph-sparkle"></i>
        AI 디렉터
      </button>
    </CardShell>
  );
}

Object.assign(window, { Card13, Card14 });
