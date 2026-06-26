/* director-modal.jsx — AI 디렉터 풀스크린 모달
   ─────────────────────────────────────────────────────────────
   14개 카드를 순서대로 1개씩 보여주며 디렉터가 설명.
   각 단계는 여러 beats 로 쪼개져, 대사 시점에 맞춰 개별 KPI/요소가
   "pop forward" 로 앞으로 튀어나와 강조됨.
*/

/* DIRECTOR_SCRIPT v2 — beat-driven
   각 step:
     { card, beat(타이틀), dur, text(전체 자막),
       beats:[ { at:ms, id, anim:[..], phrase:"강조 단어" } ... ] }
*/
/* [STEP 6] 각 beat 에 b.fx 추가 — 고정 주석 kit(약 6종) 재사용.
   값: 'swipe'|'underline'|'circle'|'box'|'spotlight'|'arrow'|'zoom'|'countup'.
   숫자 옆에는 swipe/underline/circle/box/countup, 영역·차트엔 spotlight/zoom/arrow. */
const DIRECTOR_SCRIPT = [
  { card:"01", beat:"상권 진단", dur:8800,
    text:"자리부터 보겠습니다. 강남역 1번 출구 일대 — 반경 500m에 매장이 350개. 그 중 카페가 126개입니다. 한국에서 카페 밀도 톱 5에 들어가는 자리예요.",
    beats:[
      { at:1500, id:"c1.tile1", anim:["focus"],                  fx:"spotlight", phrase:"강남역 1번 출구" },
      { at:3000, id:"c1.tile2", anim:["rise","roulette"],        fx:"countup",   phrase:"350개" },
      { at:4800, id:"c1.donut", anim:["dolly","spin-in"],        fx:"circle",    phrase:"카페가 126개" },
      { at:6800, id:"c1.tile3", anim:["drift-r","roulette"],     fx:"box",       phrase:"카페 밀도 톱 5" },
    ]},
  { card:"02", beat:"고객 결", dur:9000,
    text:"고객 결입니다. 주요 연령대는 30대로 34%. 성비는 여성 49 : 남성 51 — 거의 반반이지만 남성이 살짝 더 많아요. 재방문율 38%, 자주 오는 동네입니다.",
    beats:[
      { at:1200, id:"c2.tile1", anim:["rise","roulette"],        fx:"swipe",     phrase:"30대" },
      { at:2900, id:"c2.bars",  anim:["focus","bounce"],         fx:"underline", phrase:"34%" },
      { at:4400, id:"c2.tile2", anim:["drift-l","flash"],        fx:"box",       phrase:"49 : 남성 51" },
      { at:6600, id:"c2.tile3", anim:["dolly","roulette"],       fx:"circle",    phrase:"재방문율 38%" },
    ]},
  { card:"03", beat:"변화 흐름", dur:8600,
    text:"변화 추이입니다. 1년 생존율 89%, 3년 71%, 5년 52% — 모두 강남 평균 상회. 5년 전 108개에서 지금 126개. 시장이 천천히 살이 붙고 있어요.",
    beats:[
      { at:1200, id:"c3.g1",    anim:["drift-l","grad-flow"],    fx:"swipe",     phrase:"1년 생존율 89%" },
      { at:2800, id:"c3.g3",    anim:["drift-l","grad-flow"],    fx:"swipe",     phrase:"3년 71%" },
      { at:4300, id:"c3.g5",    anim:["drift-l","grad-flow"],    fx:"underline", phrase:"5년 52%" },
      { at:6300, id:"c3.tile2", anim:["rise","roulette"],        fx:"arrow",     phrase:"108개에서 지금 126개" },
    ]},
  { card:"04", beat:"경쟁자 명단", dur:7800,
    text:"프랜차이즈를 봅시다. 200미터 안에 스타벅스 11점. 이디야·투썸·메가·폴바셋까지 — 빅 5가 다 들어와 있는 자리예요.",
    beats:[
      { at:1300, id:"c4.top7", anim:["focus"],                   fx:"circle",    phrase:"스타벅스 11점" },
      { at:4200, id:"c4.top7", anim:["dolly"],                   fx:"box",       phrase:"빅 5" },
    ]},
  { card:"05", beat:"매출 회수", dur:8800,
    text:"회수 가능성입니다. 월매출 평균 9,121만원 — 강남구 평균보다 +16%. 13개월 추이를 보면 매월 +1~2% 꾸준히 오르고 있어요. 살아있는 시장입니다.",
    beats:[
      { at:1200, id:"c6.tile1", anim:["dolly","roulette"],       fx:"countup",   phrase:"9,121만원" },
      { at:3400, id:"c6.tile2", anim:["rise","flash"],           fx:"swipe",     phrase:"+16%" },
      { at:5400, id:"c6.line",  anim:["focus","sweep","wobble"], fx:"zoom",      phrase:"매월 +1~2%" },
    ]},
  { card:"06", beat:"개인 카페", dur:8400,
    text:"개인 카페가 71개, 비중 56%. 절반 넘게 차지하는 동네는 흔치 않아요. 아메리카노 평균 4,500원 — 스타벅스 톨 4,700원보다 살짝 아래입니다.",
    beats:[
      { at:1300, id:"c5.tile1", anim:["rise","roulette"],        fx:"swipe",     phrase:"71개" },
      { at:3000, id:"c5.tile3", anim:["dolly","roulette"],       fx:"circle",    phrase:"비중 56%" },
      { at:5300, id:"c5.tile2", anim:["drift-l","roulette"],     fx:"box",       phrase:"4,500원" },
    ]},
  { card:"07", beat:"사람 흐름", dur:9000,
    text:"유동인구 일평균 57만 명. 12~18시에 24%, 목요일이 17.8%로 가장 많습니다. 주중 비중이 77% — 직장 수요가 메인이라는 뜻이에요.",
    beats:[
      { at:1100, id:"c7.tile1", anim:["focus","roulette"],       fx:"countup",   phrase:"57만 명" },
      { at:3000, id:"c7.hours", anim:["drift-l","bounce"],       fx:"box",       phrase:"12~18시" },
      { at:4500, id:"c7.days",  anim:["drift-r","bounce"],       fx:"underline", phrase:"목요일이 17.8%" },
      { at:6500, id:"c7.donut", anim:["dolly","spin-in"],        fx:"circle",    phrase:"주중 비중이 77%" },
    ]},
  { card:"08", beat:"들어가는 비용", dur:8600,
    text:"비용이 만만치 않습니다. 평당 월세 42만원, 권리금 1.8억 — 시도 평균 +114%. 15평 기준 총 창업비 약 2.1억으로 잡혀요.",
    beats:[
      { at:1200, id:"c8.tile1", anim:["rise","roulette"],        fx:"swipe",     phrase:"42만원" },
      { at:3000, id:"c8.tile3", anim:["dolly","roulette"],       fx:"circle",    phrase:"1.8억" },
      { at:5000, id:"c8.tile4", anim:["focus","roulette","flash"], fx:"box",     phrase:"2.1억" },
    ]},
  { card:"09", beat:"기회 신호", dur:8000,
    text:"기회 포인트입니다. 공실률 6.9% — 보통이지만 안정권. 12분기 추이가 5%대에서 6.9%로 살짝 올랐지만 강남 평균 6.4% 수준이라 큰 위협은 아니에요.",
    beats:[
      { at:1100, id:"c9.hero", anim:["focus","roulette"],        fx:"countup",   phrase:"공실률 6.9%" },
      { at:3800, id:"c9.line", anim:["dolly","sweep","wobble"],  fx:"zoom",      phrase:"12분기 추이" },
      { at:5800, id:"c9.list", anim:["rise"],                    fx:"underline", phrase:"강남 평균 6.4%" },
    ]},
  { card:"10", beat:"배달 채널", dur:9000,
    text:"배달도 봅시다. 객단가 20,851원, 월 배달 매출 1,420만 — 매장의 15%. 12개월 주문건수가 420건에서 681건으로 +62%. 안전 노선으로 활용 가능해요.",
    beats:[
      { at:1100, id:"c10.tile1", anim:["rise","roulette"],       fx:"countup",   phrase:"20,851원" },
      { at:3000, id:"c10.tile2", anim:["dolly","roulette"],      fx:"swipe",     phrase:"1,420만" },
      { at:5000, id:"c10.line",  anim:["focus","sweep","wobble"], fx:"arrow",    phrase:"+62%" },
    ]},
  { card:"11", beat:"분위기", dur:8800,
    text:"SNS 분위기를 보면 긍정 비율 78% — 매우 좋은 동네입니다. 키워드는 강남카페, 분위기, 디저트맛집, 미팅장소 — 프리미엄 미팅 카페 결이 분명히 있어요.",
    beats:[
      { at:1200, id:"c11.tile1", anim:["focus","roulette"],      fx:"countup",   phrase:"긍정 비율 78%" },
      { at:3500, id:"c11.cloud", anim:["rise"],                  fx:"box",       phrase:"강남카페, 분위기, 디저트맛집" },
      { at:6300, id:"c11.top5",  anim:["drift-l"],               fx:"spotlight", phrase:"프리미엄 미팅 카페" },
    ]},
  { card:"12", beat:"날씨 영향", dur:8200,
    text:"날씨도 챙깁니다. 비 오는 날 매출이 +14% — 직장인들이 카페로 피신하는 패턴. 폭염·폭설 때는 -22%까지 빠지지만 배달 채널이 완충해줍니다.",
    beats:[
      { at:1100, id:"c12.tile1", anim:["rise","roulette"],       fx:"swipe",     phrase:"+14%" },
      { at:3400, id:"c12.tile3", anim:["dolly","roulette","glitch","flash"], fx:"circle", phrase:"-22%" },
      { at:5800, id:"c12.cal",   anim:["focus"],                 fx:"spotlight", phrase:"배달 채널이 완충" },
    ]},
  { card:"13", beat:"투자 대비 수익률", dur:9000,
    text:"이제 종합입니다. 투자 대비 수익률로 보면 수익성·생존은 받쳐주는데 투자 회수에서 점수가 눌려요. 초기 투자가 큰 자리라 회수가 길다는 뜻인데 — 시장이 그만큼 받쳐주니, 콘셉트로 객단가를 끌어올리면 충분히 만회되는 구조입니다.",
    beats:[
      { at:1200, id:"c13.axes",  anim:["drift-l","bounce"],      fx:"zoom",      phrase:"투자 대비 수익률" },
      { at:3400, id:"c13.kpi1",  anim:["rise","roulette"],       fx:"underline", phrase:"수익성·생존은 받쳐주는데" },
      { at:5400, id:"c13.kpi2",  anim:["focus","glitch","flash"], fx:"box",      phrase:"투자 회수" },
      { at:7000, id:"c13.gauge", anim:["dolly","glitch"],        fx:"circle",    phrase:"종합 점수" },
    ]},
  { card:"14", beat:"최종 의견", dur:9600,
    text:"최종 의견입니다. 수익률 레이더 — 수익성·생존은 외곽까지 펼쳐졌고 투자 회수만 안쪽에 머물러요. 약점이 아니라 비용 관리가 관건이라는 신호죠. 의뢰인 자본 여력 보고 프리미엄이냐 안전이냐 두 갈래 중 하나로 가시면 충분히 승산 있습니다.",
    beats:[
      { at:1500, id:"c14.radar", anim:["focus"],                          fx:"spotlight", phrase:"수익률 레이더" },
      { at:4400, id:"c14.score", anim:["dolly","roulette"],               fx:"arrow",     phrase:"수익성·생존은 외곽" },
      { at:6800, id:"c14.kpi2",  anim:["rise","flash"],                   fx:"box",       phrase:"투자 회수는 안쪽" },
    ]},
];

/* ============================================================
   buildLiveScript — 검색 지역의 실제 디렉터 데이터로 14단계 대본 생성
   ─────────────────────────────────────────────────────────────
   데이터 출처: window.__BC_DATA__.cards[13].body.chartData.director
                (dataMapper.js _genDirector 결과 — 어느 지역이든 생성됨)
   구조: { intro, market{headline,observations[],keyMetric,citation},
           customer{...}, competition{...}, profit{...}, direction{...}, closing }
   5영역 → 14단계 카드 매핑. 각 카드는 해당 영역의 헤드라인+관찰 멘트를 사용.
   실데이터가 없을 때만 DIRECTOR_SCRIPT(하드코딩) 폴백.
   ============================================================ */
function getLiveDirector() {
  try {
    const cards = window.__BC_DATA__ && window.__BC_DATA__.cards;
    if (!Array.isArray(cards)) return null;
    // AI 종합 카드(n="14")는 배열 인덱스 13
    const aiBody = cards[13] && cards[13].body;
    const d = aiBody && (
      (aiBody.chartData && aiBody.chartData.director) ||
      aiBody.director
    );
    if (d && (d.intro || d.market || d.closing)) return d;
  } catch (e) {}
  return null;
}

/* DIRECTOR_SCRIPT 카드 식별자(n) → 디렉터 데이터 5영역 매핑.
   각 카드가 어떤 영역의 멘트를 보여줄지 결정.
   n 기준 (컴포넌트 식별자) — shared.jsx CARDS 참고:
   01상권 02고객 03변화 04프랜 05매출 06개인 07유동 08임대 09기회
   10배달 11SNS 12날씨 13경쟁 14AI종합 */
const CARD_AREA_MAP = {
  "01": "market",      // 상권 분석
  "02": "customer",    // 고객 분석
  "03": "direction",   // 상권 변화 추이
  "04": "competition", // 프랜차이즈 현황
  "05": "profit",      // 매출 분석
  "06": "competition", // 개인 카페
  "07": "customer",    // 유동인구
  "08": "profit",      // 임대 / 창업
  "09": "market",      // 카페 기회
  "10": "direction",   // 배달 객단가
  "11": "direction",   // SNS 트렌드
  "12": "direction",   // 날씨 영향
  "13": "competition", // 상권 경쟁 분석
  "14": "ai",          // AI 종합 분석
};

/* 한 영역의 observations 를 카드별로 분배 — 같은 영역을 여러 카드가 쓰면
   카드 순서(영역 내 등장 순)에 따라 다른 관찰 멘트를 보여줘 중복을 줄임.
   영역별 카드 등장 순서 인덱스 테이블. */
const AREA_CARD_ORDER = {
  market:      ["01", "09"],
  customer:    ["02", "07"],
  competition: ["04", "06", "13"],
  profit:      ["05", "08"],
  direction:   ["03", "10", "11", "12"],
};

/* [STEP 5b] 대사 전용: bruSummary 의 '첫 완결 문장'만 뽑아 짧고 또렷한 발화로.
   화면 파란 박스(.bc-card__bru)는 전체 bruSummary 그대로, 대사만 첫 문장으로 분리.
   경계: '습니다.' / '요.' / '다.' / '. '(마침표+공백) 중 가장 먼저 나오는 곳까지(부호 포함).
   소수점·% 뒤 숫자(예: 19.5%)는 뒤가 공백이 아니라 컷 안 됨. 경계 없으면 원문 유지.
   ★UnifiedLayout.jsx __dmFirstSentence 와 byte-identical 유지. */
function _firstSentence(raw) {
  const s = String(raw || "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!s) return "";
  const re = /(습니다\.|요\.|다\.|[.!?…])/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const end = m.index + m[0].length;
    if (end >= s.length || /\s/.test(s[end])) return s.slice(0, end).trim();
  }
  return s;
}

/* [STEP 5] 따뜻한 구어체 존댓말로 다듬기 — 숫자/사실은 그대로, 어미만 부드럽게.
   ★UnifiedLayout.jsx __dmNaturalize/__dmWarmEndings 와 byte-identical (자막==발화 wording). */
function _warmEndings(s) {
  let t = s;
  t = t.replace(/입니다([.!?…]?)$/u, '이에요$1');
  t = t.replace(/습니다([.!?…]?)$/u, '어요$1');
  t = t.replace(/됩니다([.!?…]?)$/u, '돼요$1');
  t = t.replace(/있습니다([.!?…]?)/gu, '있어요$1');
  t = t.replace(/없습니다([.!?…]?)/gu, '없어요$1');
  return t;
}
function _naturalize(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  // 줄바꿈/중복 공백 정리
  s = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  s = _warmEndings(s);
  // 문장부호로 안 끝나면 마침표 보강 (자연스러운 브리핑 어조)
  if (!/[.!?。…]$/.test(s)) s += ".";
  return s;
}

/* [STEP 5] 주제(영역) 전환 다리 — ★UnifiedLayout.jsx __dmBridge 와 byte-identical. */
function __dmBridge(fromArea, toArea) {
  if (!fromArea || !toArea || fromArea === toArea) return '';
  const key = fromArea + '>' + toArea;
  const TABLE = {
    'market>customer':    '자리를 봤으니, 이제 어떤 분들이 오는지 볼게요. [medium pause] ',
    'customer>direction': '사람이 이렇게 모이는 곳이면, 온라인에선 이 동네를 어떻게 말할까요? [medium pause] ',
    'direction>competition': '흐름은 그렇고, 그럼 경쟁은 어떤지 보죠. [medium pause] ',
    'competition>profit': '경쟁을 봤으니, 그래서 돈이 되는 자리인지 따져볼게요. [medium pause] ',
    'profit>market':      '비용을 봤으니, 다시 자리 자체의 기회를 짚어볼게요. [medium pause] ',
    'profit>direction':   '돈 얘기를 했으니, 채널 쪽 흐름으로 넘어가 볼게요. [medium pause] ',
    'competition>direction': '경쟁을 봤으니, 분위기가 어떤지로 넘어가요. [medium pause] ',
    'direction>customer': '흐름을 봤으니, 다시 사람 쪽을 볼게요. [medium pause] ',
    'customer>profit':    '손님 결을 봤으니, 그래서 매출이 받쳐주는지 보죠. [medium pause] ',
    'market>direction':   '자리를 봤으니, 동네 흐름으로 넘어가 볼게요. [medium pause] ',
  };
  return TABLE[key] || '그럼 이어서, 다음 부분을 볼게요. [medium pause] ';
}

/* beats 의 phrase 를 새 text 의 실제 부분문자열로 재정합.
   - phrase 가 그대로 들어있으면 유지
   - 아니면 그 phrase 의 숫자/핵심 토큰을 text 에서 찾아 대체
   - 그래도 없으면 그 beat 의 강조 단어는 비워(매칭 실패 시 하이라이트만 생략, 애니/줌은 정상)
   하이라이트는 부분문자열 일치이므로 이 정합이 깨지면 강조가 안 보인다. */
function _reconcileBeats(beats, text) {
  if (!Array.isArray(beats) || !text) return beats || [];
  return beats.map((b) => {
    if (!b || !b.phrase) return b;
    if (text.indexOf(b.phrase) !== -1) return b; // 이미 부분문자열 → 유지
    // phrase 안의 숫자(단위 포함) 토큰을 text 에서 탐색
    const tokens = String(b.phrase).match(/[0-9][0-9,.]*\s*(?:만원|억|원|개|명|점|%|만|분기|건)?/g) || [];
    for (const tk of tokens) {
      const t = tk.trim();
      if (t && text.indexOf(t) !== -1) return { ...b, phrase: t };
    }
    // 마지막 시도: phrase 의 첫 2~6자 한글 덩어리
    const ko = String(b.phrase).match(/[가-힣]{2,6}/);
    if (ko && text.indexOf(ko[0]) !== -1) return { ...b, phrase: ko[0] };
    return { ...b, phrase: null }; // 매칭 불가 → 강조 생략(줌/애니는 유지)
  });
}

/* 이 카드 전용 대사 — 화면 파란 박스(bruSummary)와 같은 카드 내용이되, '첫 문장만' 짧게.
   박스는 전체 bruSummary 그대로 노출, 대사는 첫 완결 문장만 뽑아 또렷하게 분리.
   __BC_DATA__.cards[카드번호-1].body.bruSummary (5/6 스왑은 이미 반영된 배열). */
function _cardBruSummary(cardN) {
  try {
    const cards = window.__BC_DATA__ && window.__BC_DATA__.cards;
    const idx = parseInt(cardN, 10) - 1;
    const b = cards && cards[idx] && cards[idx].body;
    const s = b && b.bruSummary;
    return s ? _naturalize(s) : "";
  } catch (e) { return ""; }
}

/* [STEP 5] 발화용 멈춤 태그를 화면 자막에서 제거(자막엔 안 보이게).
   ★UnifiedLayout 의 TTS 경로는 태그를 그대로 쓰고, 화면 자막만 깨끗하게. */
function _stripPauseTags(s) {
  return String(s || '').replace(/\[(?:short|medium|long) pause\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

/* ============================================================
   [내레이션-숫자 기반 하이라이트] 파서 + DOM 매칭
   ─────────────────────────────────────────────────────────────
   하드코딩 beat id 대신, "디렉터가 지금 말하는 숫자"가 화면의 어느 요소에
   표시돼 있는지를 찾아서 그 요소만 강조한다. 카드에 그 숫자가 없으면(예:
   카드01 멘트에 'SNS 85%'가 나와도 카드01엔 85% 표시가 없음) → 강조 생략.
   ============================================================ */

/* cur.text 에서 값 토큰을 '발화 순서대로' 추출.
   각 토큰: { raw(원문), core(숫자만, 콤마/공백 제거), idx(text 내 시작 char index) }.
   단위(억/만원/만/원/개/명/곳/잔/건/%/퍼센트/점/도/년/분기/위)는 같이 잡되 비교는 core 로. */
function _extractValueTokens(text) {
  const s = String(text || "");
  const re = /\d[\d,\.]*\s*(?:억|만원|만|원|개|명|곳|잔|건|%|퍼센트|점|도|년|분기|위)?/g;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const raw = m[0];
    // 숫자 핵심부만: 콤마/공백 제거, 끝의 단위 글자 제거, 끝 점(.) 정리
    let core = raw.replace(/[,\s]/g, "").replace(/(억|만원|만|원|개|명|곳|잔|건|%|퍼센트|점|도|년|분기|위)$/g, "");
    core = core.replace(/\.+$/, "");           // "108." 같은 꼬리 점 제거
    if (!core || !/\d/.test(core)) continue;    // 숫자 없으면 버림
    out.push({ raw, core, idx: m.index });
  }
  return out;
}

/* 요소가 '실제로 표시'하는 숫자 목록(콤마 제거, 각 숫자 개별). 숨김 요소는 빈 배열.
   ★공백은 경계로 유지 — 콤마만 지워, 인접한 두 숫자가 한 덩어리로 붙는 허위(soup) 매칭을 막는다. */
function _visibleNumbers(el) {
  if (!el) return [];
  if (el.offsetParent === null && el.getClientRects().length === 0) return [];
  const t = el.textContent || "";
  return (t.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((s) => s.replace(/,/g, ""));
}

/* core 가 요소가 표시하는 '온전한 한 숫자'와 정확히 일치하는지(부분일치 금지).
   "59" 는 "59" 와만 일치하고 "590"·"3520" 과는 불일치 → 허위 강조 차단. */
function _numbersHaveExact(el, core) {
  return _visibleNumbers(el).indexOf(core) !== -1;
}

/* 스테이지 카드 안에서, 토큰 숫자를 '표시하는' 요소를 찾는다.
   후보: [data-fx-id] / .bc-tile / .bc-box. 디렉터 대사 박스(.bc-card__bru)는 제외(거기엔 모든 숫자가 들어있음).
   - 한 자리 숫자(예 '1억'→'1', '4건'→'4')는 너무 헐거워 강조 생략(허위 방지).
   - 요소가 그 숫자를 '온전한 한 값'으로 정확히 표시할 때만 매칭(부분일치·연결 soup 금지).
   - 이미 차지한 요소(used) 제외, textContent 가 가장 짧은(구체적) 요소 우선. 못 찾으면 null → 강조 생략. */
function _findElementForToken(stageCard, core, used) {
  if (!stageCard || !core) return null;
  if (core.replace(/\D/g, "").length < 2) return null;   // 한 자리 숫자 생략
  const cands = stageCard.querySelectorAll("[data-fx-id], .bc-tile, .bc-box");
  let best = null, bestLen = Infinity;
  cands.forEach((el) => {
    if (used.has(el)) return;
    if (el.closest && el.closest(".bc-card__bru")) return;   // 대사(파란 한 줄) 박스 제외
    if (!_numbersHaveExact(el, core)) return;
    const L = (el.textContent || "").replace(/\s+/g, "").length;
    if (L < bestLen) { best = el; bestLen = L; }
  });
  return best;
}

/* 내레이션 토큰 → DOM 요소 매칭 + 발화 시점 기반 타이밍 plan 생성.
   반환: [{ el, idx(토큰순번), charIdx, fireAt, clearAt }] (발화 순서, 겹침 제거 후).
   타이밍: fireAt ≈ clipDur × (clientFrac + (charIdx/textLen) × (1 - clientFrac)).
   그 위에 기존 spacing 규칙(SETTLE/MIN_GAP/DROP/TAIL/clearAt 당김) 그대로 적용. */
function _buildHighlightPlan(stageCard, text, clipDur, clientFrac, holdForLen) {
  const SETTLE = 1.0, TAIL = 1.4;
  const tokens = _extractValueTokens(text);
  const textLen = Math.max(1, (text || "").length);
  if (!stageCard || !clipDur || tokens.length === 0) return [];

  // 1) 각 토큰을 DOM 요소에 매칭(발화 순서, 한 요소=한 토큰). 못 찾으면 생략.
  const used = new Set();
  const matched = [];
  tokens.forEach((tk) => {
    const el = _findElementForToken(stageCard, tk.core, used);
    if (el) { used.add(el); matched.push({ el, idx: tk.idx, charIdx: tk.idx, len: (tk.raw || "").length }); }
  });
  if (matched.length === 0) return [];

  // 2) 발화 시점 추정: 디렉터가 말하기 시작하는 시점(clientFrac) 이후, char 위치 비율로 분포
  const cf = Math.min(0.6, Math.max(0, clientFrac || 0));
  const endWin = Math.max(SETTLE + 0.5, clipDur - TAIL);
  matched.forEach((p) => {
    let t = clipDur * (cf + (p.charIdx / textLen) * (1 - cf));
    t = Math.max(SETTLE, Math.min(endWin, t));
    p.fireAt = t;
  });

  // 3) 발화 순서 보장 + 동적 MIN_GAP(이전 hold + 0.3, 최소 1.8) 로 밀어내기
  for (let i = 1; i < matched.length; i++) {
    const prevLen = (matched[i - 1].el.textContent || "").trim().length || 8;
    const gap = Math.max(1.8, holdForLen(prevLen) + 0.3);
    if (matched[i].fireAt - matched[i - 1].fireAt < gap) {
      matched[i].fireAt = matched[i - 1].fireAt + gap;
    }
  }

  // 4) endWin 밖이거나 직전 강조와 겹치면 DROP(겹침 < 생략). clearAt = fireAt + hold.
  const kept = [];
  let prevClear = -Infinity;
  matched.forEach((p) => {
    if (p.fireAt > endWin + 0.01) return;       // 창 밖 → 생략
    if (p.fireAt <= prevClear) return;          // 이전 강조 아직 진행 → 생략
    const myLen = (p.el.textContent || "").trim().length || 8;
    const clearAt = Math.min(clipDur - 0.25, p.fireAt + holdForLen(myLen));
    kept.push({ el: p.el, charIdx: p.charIdx, len: p.len || 0, fireAt: p.fireAt, clearAt });
    prevClear = clearAt;
  });

  // 5) clearAt 을 다음 fireAt-0.35 로 당겨 숨 쉴 틈(겹침 절대 없게)
  kept.forEach((p, k) => {
    const next = kept[k + 1];
    if (next) p.clearAt = Math.min(p.clearAt, next.fireAt - 0.35);
  });
  return kept;
}

function buildLiveScript() {
  const d = getLiveDirector();
  if (!d) return DIRECTOR_SCRIPT; // 실데이터 없으면 하드코딩 폴백

  let prevArea = null;   // [STEP 5] 직전 카드 영역 — 바뀌면 다리절 prepend(부모와 동일 규칙)
  return DIRECTOR_SCRIPT.map((step) => {
    const area = CARD_AREA_MAP[step.card];
    let beatTitle = step.beat;
    let text = step.text;
    let beats = step.beats;

    // ★ 1순위: 이 카드 전용 한 줄 설명 — 대사 = 화면 카드 내용과 정확히 일치
    const bru = _cardBruSummary(step.card);
    if (bru) {
      text = bru;
    } else if (area === "ai") {
      // 폴백: 마지막 카드 — intro + closing 종합
      const parts = [];
      if (d.intro) parts.push(_naturalize(d.intro));
      if (d.closing) parts.push(_naturalize(d.closing));
      if (parts.length) { text = parts.join(' '); beatTitle = "최종 의견"; }
    } else {
      // 폴백: 기존 5영역 매핑(한 줄 설명이 없을 때만)
      const block = d[area];
      if (block) {
        const obs = Array.isArray(block.observations) ? block.observations.filter(Boolean) : [];
        const order = AREA_CARD_ORDER[area] || [step.card];
        const cardPos = Math.max(0, order.indexOf(step.card));
        const slot = order.length || 1;
        const per = Math.ceil(obs.length / slot) || 1;
        let mine = obs.slice(cardPos * per, cardPos * per + per);
        if (mine.length === 0) mine = obs.slice(0, 2);
        const sentences = [];
        if (block.headline) sentences.push(_naturalize(block.headline));
        mine.forEach(o => { const s = _naturalize(o); if (s) sentences.push(s); });
        if (sentences.length) {
          text = sentences.slice(0, 3).join(' ');
          if (block.headline) beatTitle = String(block.headline).trim();
        }
      }
    }

    // [STEP 5] 주제 전환 다리절 — 영역이 바뀐 카드 앞에 연결절 1개(자막엔 태그 제거).
    //   부모(TTS)도 같은 규칙으로 다리절을 발화에 넣으므로 자막==발화 wording 패리티 유지.
    const bridge = _stripPauseTags(__dmBridge(prevArea, area));
    if (bridge) text = bridge + ' ' + text;
    prevArea = area;

    // 텍스트가 바뀌었으면 beat.phrase 를 새 text 의 부분문자열로 재정합
    if (text !== step.text) {
      beats = _reconcileBeats(step.beats, text);
    }

    return { ...step, beat: beatTitle, text, beats };
  });
}

/* ============================================================
   음성(TTS) — ko-KR Web Speech API
   ─────────────────────────────────────────────────────────────
   getVoices() 는 Chrome 에서 비동기로 채워진다(처음엔 빈 배열).
   캐시해 두고, 비어있으면 voiceschanged 한 번 기다린다.
   AINarrationEngine.jsx:306-322 의 voice-picking 패턴을 차용. */
const _voiceState = { cache: null, listening: false };

function _refreshVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) _voiceState.cache = v;
  return _voiceState.cache || [];
}

/* 한국어 보이스 선택:
   1) name 에 'Google' 포함 + ko  2) 'Heami'/'Microsoft' ko
   3) lang 이 'ko' 로 시작하는 첫 보이스  4) 기본(null) */
function pickDirectorVoice() {
  const voices = _refreshVoices();
  if (!voices || voices.length === 0) return null;
  const isKo = (v) => v.lang && v.lang.toLowerCase().startsWith("ko");
  const ko = voices.filter(isKo);
  if (ko.length === 0) return null;
  const google = ko.find((v) => /google/i.test(v.name));
  if (google) return google;
  const ms = ko.find((v) => /heami|microsoft/i.test(v.name));
  if (ms) return ms;
  return ko[0] || null;
}

/* 너무 긴 한 문장(구두점 없는 긴 절)을 ~180자 이하로 쪼갬 — 크롬 약 15초 컷오프 방지.
   쉼표/공백 경계에서 끊되, 경계가 없으면 강제로 자른다(컷오프보단 끊김이 안전). */
const _MAX_UTTER = 180;
function _hardSplitLong(sentence) {
  const s = String(sentence);
  if (s.length <= _MAX_UTTER) return [s];
  const out = [];
  let rest = s;
  while (rest.length > _MAX_UTTER) {
    const window = rest.slice(0, _MAX_UTTER);
    // 쉼표(., 、 ,) 우선, 없으면 공백, 그것도 없으면 강제 컷
    let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf(","),
                       window.lastIndexOf("、"), window.lastIndexOf("，"));
    if (cut < _MAX_UTTER * 0.4) cut = window.lastIndexOf(" ");
    if (cut < _MAX_UTTER * 0.4) cut = _MAX_UTTER - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/* cur.text 를 문장 단위로 쪼갬 (구두점 유지) — 긴 발화 컷오프(약 15초) 방지 +
   문장마다 자연스러운 끊김. 마침표/물음표/느낌표/줄바꿈 기준.
   그 후 ~180자 넘는 긴 문장은 다시 쉼표/공백으로 더 쪼갬. */
function _splitSentences(text) {
  if (!text) return [];
  const parts = String(text)
    .split(/(?<=[.!?。…\n])/)        // 구분자를 각 조각 끝에 남김
    .map((s) => s.trim())
    .filter(Boolean);
  const base = parts.length ? parts : [String(text)];
  // 각 문장이 너무 길면(구두점 없는 한 덩어리) 한번 더 쪼갬
  const out = [];
  base.forEach((s) => { _hardSplitLong(s).forEach((p) => out.push(p)); });
  return out.length ? out : [String(text)];
}

/* ============================================================
   제미나이 대화 음성(PCM base64) → 아이프레임 컨텍스트의 WAV blob URL
   ─────────────────────────────────────────────────────────────
   부모(영업관리 본체)가 제미나이 멀티스피커 TTS(Aoede 고객 / Charon 디렉터)로
   만든 24kHz mono s16le PCM 을 base64 로 넘겨주면, 여기서 이 문서의 컨텍스트로
   직접 Blob/URL 을 만든다(blob: URL 은 만든 문서에만 유효하므로 base64 로 전달).
   ============================================================ */
function pcmBase64ToWavUrl(b64, sampleRate) {
  try {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const sr = sampleRate || 24000;
    const numCh = 1, bps = 16;
    const blockAlign = numCh * bps / 8;
    const byteRate = sr * blockAlign;
    const dataSize = bytes.length;
    const buf = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(buf);
    const ws = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); dv.setUint32(4, 36 + dataSize, true); ws(8, "WAVE");
    ws(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, numCh, true); dv.setUint32(24, sr, true); dv.setUint32(28, byteRate, true);
    dv.setUint16(32, blockAlign, true); dv.setUint16(34, bps, true);
    ws(36, "data"); dv.setUint32(40, dataSize, true);
    new Uint8Array(buf, 44).set(bytes);
    const blob = new Blob([buf], { type: "audio/wav" });
    return { url: URL.createObjectURL(blob), estDur: dataSize / (sr * 2) };
  } catch (e) { return null; }
}

/* ============================================================
   useDirectorPlayback — 단계별 자동 진행 + beat 타임라인 + 음성
   ============================================================ */
const MIN_DWELL = 4500;   // 한 카드 최소 체류(ms, speedFactor 적용 전)
const BEAT_TAIL = 1900;   // 마지막 beat 강조를 보여줄 꼬리시간(ms)

function useDirectorPlayback(open) {
  const [step, setStep] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [seq, setSeq] = React.useState({});
  const [prevCard, setPrevCard] = React.useState(null);
  const [activeBeat, setActiveBeat] = React.useState(-1);   // (폴백) 자막 강조용 beat idx
  // [내레이션-숫자 하이라이트] 현재 강조 중인 '실제 DOM 요소' (말하는 숫자가 표시된 곳)
  const [focalEl, setFocalEl] = React.useState(null);
  // 자막에서 현재 강조 숫자의 char 범위 {start,end} (없으면 null) — 자막 밑줄 동기화용
  const [focalRange, setFocalRange] = React.useState(null);
  const setFocal = React.useCallback((el, range) => {
    setFocalEl(el);
    setFocalRange(el ? (range || null) : null);
  }, []);
  const [speedFactor, setSpeedFactor] = React.useState(1);  // 0.75 / 1 / 1.25
  const [audioOn, setAudioOn] = React.useState(false);      // 제미나이 대화 음성 모드 ON 여부
  const [preparing, setPreparing] = React.useState(false);  // 음성 클립 생성 대기 중(이때 브라우저 음성 안 켬)
  // [bc] 모달 열릴 때 검색 지역 실데이터로 대본 재생성 (실데이터 없으면 하드코딩 폴백)
  const [script, setScript] = React.useState(DIRECTOR_SCRIPT);
  // [2026-06-16 REVERT] PPT 씬 레이어 제거 — 항상 풀 리포트 카드(window['Card'+n]) 를 렌더.
  //   재생 단위 = 카드(script[step]). 음성 = perCard 클립 + 브라우저 음성 폴백 둘뿐.
  const total = script.length;

  // ── refs ──────────────────────────────────────────────
  const beatTimersRef = React.useRef([]);     // 모든 beat setTimeout
  const advanceTimerRef = React.useRef(null);  // 다음 카드 전환 setTimeout
  const utterRef = React.useRef([]);           // GC 방지용 utterance 보관
  const speechDoneRef = React.useRef(false);   // 마지막 문장 onend 도착 여부
  const stepTokenRef = React.useRef(0);        // 단계별 토큰(중복 진행 방지)
  const stepStartRef = React.useRef(0);        // 카드 진입 시각
  const sentenceIdxRef = React.useRef(0);      // 재개용: 현재 발화 중인 문장 인덱스
  const sentencesRef = React.useRef([]);       // 현재 카드 문장 배열
  const pausedElapsedRef = React.useRef(0);    // 일시정지 시점의 카드 내 경과(ms)
  const resumeRef = React.useRef(false);       // 다음 effect 진입이 '재개'인지
  const speedRef = React.useRef(1);
  const prevSpeedRef = React.useRef(1);        // 속도 변경 감지용(같은 카드 내 속도만 바뀐 경우)
  const effectStepRef = React.useRef(-1);      // 카드진입 effect 가 마지막으로 실행된 step(-1=미실행)
  const keepAliveRef = React.useRef(null);     // 발화 중 13초 keepalive(크롬 컷오프 방지)
  // ── 제미나이 대화 음성(audio) 모드용 refs ──
  const audioElRef = React.useRef(null);       // <audio> (제미나이 대화 음성)
  const audioUrlRef = React.useRef(null);      // 해제용 blob URL
  const windowsRef = React.useRef([]);         // 카드별 [start,end] (오디오 초 단위)
  const firedBeatsRef = React.useRef(new Set());// 이미 발사한 beat 키("step:idx")
  const audioModeRef = React.useRef(false);    // 현재 음성 모드인지(클로저용)
  const ttsRef = React.useRef(null);           // director.tts 페이로드
  const stepRef = React.useRef(0);             // 최신 step(타임업데이트 클로저용)
  const playingRef = React.useRef(true);
  const scriptRef = React.useRef(DIRECTOR_SCRIPT);
  const preparingRef = React.useRef(false);    // 음성 생성 대기 중(브라우저 음성 억제용)
  // [내레이션-숫자 하이라이트] DirectorModal 이 스테이지 카드 DOM 을 여기에 꽂아준다(callback ref).
  const stageElRef = React.useRef(null);
  const setStageEl = React.useCallback((el) => { stageElRef.current = el || null; }, []);
  React.useEffect(() => { speedRef.current = speedFactor; }, [speedFactor]);
  // 클로저가 항상 최신 값을 보도록 본문에서 ref 동기화
  stepRef.current = step; playingRef.current = playing; scriptRef.current = script; preparingRef.current = preparing;

  // ── 음성 보이스 프리로드 (Chrome 비동기) ──────────────
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    _refreshVoices();
    if (!_voiceState.listening) {
      _voiceState.listening = true;
      window.speechSynthesis.addEventListener?.("voiceschanged", _refreshVoices);
    }
  }, []);

  // ── 타이머/음성 전체 정리 (절대 누수 없게) ──────────────
  const clearTimers = React.useCallback(() => {
    beatTimersRef.current.forEach((t) => clearTimeout(t));
    beatTimersRef.current = [];
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
  }, []);

  // keepalive 정리(중복 호출 안전)
  const clearKeepAlive = React.useCallback(() => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
  }, []);

  // 발화 중 13초마다 pause()/resume() — 크롬의 ~15초 단일 발화 컷오프 회피
  const startKeepAlive = React.useCallback(() => {
    clearKeepAlive();
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    keepAliveRef.current = setInterval(() => {
      try {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      } catch (e) {}
    }, 13000);
  }, [clearKeepAlive]);

  const stopSpeech = React.useCallback(() => {
    clearKeepAlive();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    utterRef.current = [];
  }, [clearKeepAlive]);

  const hardStop = React.useCallback(() => {
    clearTimers();
    stopSpeech();
  }, [clearTimers, stopSpeech]);

  /* 모달 열릴 때마다 리셋 + 실데이터 대본 빌드 / 닫힐 때 완전 정리 */
  React.useEffect(() => {
    if (!open) { hardStop(); setActiveBeat(-1); setFocal(null); setAudioOn(false); setPreparing(false); audioModeRef.current = false; effectStepRef.current = -1; return; }
    setScript(buildLiveScript());
    setStep(0); setPlaying(true); setSeq({}); setPrevCard(null); setActiveBeat(-1); setFocal(null);
    effectStepRef.current = -1;   // 재오픈 시 첫 카드를 '속도변경'으로 오인 방지
    prevSpeedRef.current = speedFactor;
    firedBeatsRef.current = new Set();
    prevStepRef.current = 0;                 // 카드 전환 추적 리셋
    // ── 제미나이 대화 음성 페이로드 감지 (카드별 perCard 클립만) ──
    const perCardClips = (t) => Array.isArray(t && t.perCard) ? t.perCard : null;
    const hasAudio = (arr) => Array.isArray(arr) && arr.some(p => p && p.audioBase64);
    const ready = (t) => !!(t && t.status === "ready" && hasAudio(perCardClips(t)));
    const tts0 = getLiveDirector() && getLiveDirector().tts;
    ttsRef.current = tts0 || null;
    let pollId = 0;
    if (ready(tts0)) {
      audioModeRef.current = true; setAudioOn(true); setPreparing(false);
    } else if (tts0 && tts0.status === "pending") {
      // 생성 중 — 준비될 때까지 대기(이때 브라우저 음성 안 켬). 최대 ~90초, 그 안에 안 되면 브라우저 음성 폴백.
      audioModeRef.current = false; setAudioOn(false); setPreparing(true);
      let tries = 0;
      pollId = setInterval(() => {
        tries += 1;
        const t = getLiveDirector() && getLiveDirector().tts;
        ttsRef.current = t || ttsRef.current;
        if (ready(t)) { audioModeRef.current = true; setAudioOn(true); setPreparing(false); clearInterval(pollId); pollId = 0; }
        else if (tries >= 180 || (t && t.status === "failed")) { setPreparing(false); clearInterval(pollId); pollId = 0; }
      }, 500);
    } else {
      audioModeRef.current = false; setAudioOn(false); setPreparing(false);   // 음성 없음 → 브라우저 음성 폴백
    }
    return () => { if (pollId) clearInterval(pollId); hardStop(); };   // 언마운트/닫힘 시 정리
  }, [open, hardStop]);

  /* ── 카드별 음성 클립 재생 — 카드 = 그 카드 음성이 실제로 끝나면(onended) 다음으로 ──
     한 덩어리 음성을 글자수로 추정해 쪼개던 방식(말↔화면 어긋남) 폐기.
     카드마다 따로 만든 음성(고객질문+디렉터답)을 재생 → 클립 종료 = 카드 전환(추정 0, 정확).
     강조(beat)는 이 클립의 '실제 길이' 안에서 단어 위치(고객질문 비율 이후+디렉터 멘트 내 위치)에 맞춰 발사. */
  React.useEffect(() => {
    if (!open || !audioOn) return;
    const tts = ttsRef.current;
    const per = tts && Array.isArray(tts.perCard) ? tts.perCard : [];
    const sc = scriptRef.current;
    const cur = sc[step];
    const beats = (cur && cur.beats) || [];
    const text = (cur && cur.text) || "";
    const cardEntry = per[step] || null;
    const total = sc.length;
    const advance = () => { if (step + 1 < total) setStep(step + 1); else setPlaying(false); };

    // 이 카드 음성이 없으면(생성 실패분) — 글자수 기반 타이머로 보정 진행.
    //   강조는 음성 모드와 동일하게 '내레이션 숫자 → DOM 요소' 매칭으로(추정 길이 위에서 타이머).
    if (!cardEntry || !cardEntry.audioBase64) {
      const sf = speedRef.current || 1;
      const dwell = Math.min(16000, Math.max(5000, 2500 + 110 * text.length)) * sf;
      const holdForLen = (len) => Math.max(1.4, Math.min(3.0, (350 + 68 * (len || 8)) / 1000));
      const tms = [];
      // 음성 없음 → 디렉터가 처음부터 말한다고 가정(clientFrac 0). 추정 길이 = dwell(초).
      const buildAndSchedule = () => {
        const stage = stageElRef.current;
        if (!stage) return;
        const plan = _buildHighlightPlan(stage, text, dwell / 1000, 0, holdForLen);
        plan.forEach((p) => {
          const range = { start: p.charIdx, end: p.charIdx + (p.len || 0) };
          tms.push(setTimeout(() => setFocal(p.el, range), Math.max(0, p.fireAt * 1000)));
          tms.push(setTimeout(() => setFocalEl((cur2) => cur2 === p.el ? null : cur2), Math.max(0, p.clearAt * 1000)));
        });
      };
      // 카드 enter 애니/마운트 후 DOM 측정(레이아웃 안정)
      tms.push(setTimeout(buildAndSchedule, 320));
      const adv = setTimeout(advance, dwell);
      return () => { tms.forEach(clearTimeout); clearTimeout(adv); setFocal(null); };
    }

    // 카드 음성 클립 재생
    const made = pcmBase64ToWavUrl(cardEntry.audioBase64, tts.sampleRate || 24000);
    if (!made) { const adv = setTimeout(advance, 7000); return () => clearTimeout(adv); }
    const audio = new Audio(made.url);
    audioElRef.current = audio;
    audioUrlRef.current = made.url;
    audio.playbackRate = speedRef.current || 1;

    // ── [내레이션-숫자 기반 하이라이트] 하드코딩 beat id/타이밍 폐기 ──
    //   디렉터가 '지금 말하는 숫자'가 이 카드에서 표시된 요소를 찾아 그 요소만 강조.
    //   plan = [{el, fireAt, clearAt}] (발화 순서). 카드에 없는 숫자는 매칭 실패 → 강조 생략.
    //   per-beat HOLD = clamp(1.4, 350+68*요소텍스트길이, 3.0)s. MIN_GAP/DROP/SETTLE/TAIL/clearAt당김 동일.
    //   타이밍: fireAt ≈ clipDur × (clientFrac + (charIdx/textLen)×(1-clientFrac)) — 숫자가 말해지는 시점.
    const holdForLen = (len) =>
      Math.max(1.4, Math.min(3.0, (350 + 68 * (len || 8)) / 1000));   // 초 단위
    // 고객(여) 질문이 끝난 뒤(디렉터가 말하기 시작할 때)부터 강조 시작 — 질문 중엔 안 띄움
    const clientLen = (cardEntry && cardEntry.clientQLen) || 0;
    const clientFrac = Math.min(0.55, clientLen / (clientLen + (text.length || 1)));
    let plan = [];            // [{el, charIdx, fireAt, clearAt}]
    let planned = false;      // 스테이지 DOM 준비된 시점에 1회 확정
    let activeK = -1;         // 현재 강조 중인 plan 인덱스
    const computePlan = () => {
      const stage = stageElRef.current;
      const dur = (audio.duration && isFinite(audio.duration)) ? audio.duration : made.estDur;
      if (!stage || !dur) { plan = []; return; }
      plan = _buildHighlightPlan(stage, text, dur, clientFrac, holdForLen);
      planned = true;
    };
    computePlan();   // DOM 이 이미 있으면 즉시, 없으면 첫 timeupdate 에서 재시도
    const fired = new Set();
    const onMeta = () => { planned = false; computePlan(); };   // 실제 길이 확정 → 재계산
    const onTime = () => {
      // 스테이지 DOM 이 effect 실행 시점에 아직 없었으면(enter 애니/마운트 레이스) 첫 틱에 확정
      if (!planned) computePlan();
      const ct = audio.currentTime;
      for (let k = 0; k < plan.length; k++) {
        const p = plan[k];
        if (!fired.has(k) && ct >= p.fireAt) {
          fired.add(k);
          setFocal(p.el, { start: p.charIdx, end: p.charIdx + (p.len || 0) }); activeK = k;
        }
      }
      // 현재 강조를 hold 후 해제(다음 강조 전 숨 쉴 틈 / 마지막은 클립 끝 전에 정리)
      if (activeK >= 0) {
        const ap = plan[activeK];
        if (ap && ct >= ap.clearAt) { setFocal(null); activeK = -1; }
      }
    };
    const onEnded = () => { setFocal(null); advance(); };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    if (playingRef.current) audio.play().catch(() => {});

    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      try { audio.pause(); } catch (e) {}
      try { audio.src = ""; } catch (e) {}
      if (audioUrlRef.current) { try { URL.revokeObjectURL(audioUrlRef.current); } catch (e) {} audioUrlRef.current = null; }
      if (audioElRef.current === audio) audioElRef.current = null;
      setFocal(null);   // 카드 전환 시 잔상 방지
    };
  }, [open, audioOn, step]);

  /* 일시정지/재개 — 현재 카드 클립을 직접 제어(클립 재생성 없이 이어듣기) */
  React.useEffect(() => {
    if (!open || !audioModeRef.current) return;
    const a = audioElRef.current;
    if (!a) return;
    if (playing) { a.play().catch(() => {}); } else { try { a.pause(); } catch (e) {} }
  }, [playing, open]);

  /* 단계 전환 시 이전 카드 기억 (퇴장 모션) — exit 0.38s 와 맞춤 */
  const prevStepRef = React.useRef(0);
  React.useEffect(() => {
    if (!open) return;
    const prevIdx = prevStepRef.current;
    if (prevIdx === step) return;
    const pc = script[prevIdx]?.card;
    if (pc && pc !== script[step]?.card) {
      setPrevCard(pc);
      const t = setTimeout(() => setPrevCard(null), 380);  // exit 0.38s
      prevStepRef.current = step;
      return () => clearTimeout(t);
    }
    prevStepRef.current = step;
  }, [step, open, script]);

  /* ── 발화 큐: 문장들을 순차로 말함. 마지막 onend → speechDoneRef=true ──
     startIdx 부터 재생(재개 지원). token 으로 단계 일치 확인. */
  const speakFrom = React.useCallback((sentences, startIdx, token) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      speechDoneRef.current = true;   // 음성 불가 → 즉시 완료로 간주
      return false;
    }
    const list = sentences.filter(Boolean);
    if (list.length === 0) { speechDoneRef.current = true; return false; }
    clearKeepAlive();
    try { window.speechSynthesis.cancel(); } catch (e) {}
    utterRef.current = [];
    const voice = pickDirectorVoice();
    let i = Math.max(0, startIdx | 0);

    const finishAll = () => { speechDoneRef.current = true; clearKeepAlive(); };

    const sayNext = () => {
      if (token !== stepTokenRef.current) { clearKeepAlive(); return; }   // 단계 바뀜 → 중단
      if (i >= list.length) { finishAll(); return; }
      const sentence = list[i];
      sentenceIdxRef.current = i;
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = "ko-KR";
      u.pitch = 1.0;
      u.rate = 1.0 * (speedRef.current || 1);   // [STEP 7] 0.95→1.0 (느린 말 대신 멈춤으로 페이스)
      if (voice) u.voice = voice;
      u.onend = () => {
        if (token !== stepTokenRef.current) { clearKeepAlive(); return; }
        i += 1;
        if (i >= list.length) { finishAll(); return; }
        sayNext();
      };
      u.onerror = () => {
        if (token !== stepTokenRef.current) { clearKeepAlive(); return; }
        i += 1;
        if (i >= list.length) { finishAll(); return; }
        sayNext();
      };
      utterRef.current.push(u);   // GC 방지
      try { window.speechSynthesis.speak(u); }
      catch (e) { finishAll(); }
    };
    startKeepAlive();   // 발화 시작 → 13초 keepalive 가동(완료/중단 시 해제)
    sayNext();
    return true;
  }, [startKeepAlive, clearKeepAlive]);

  /* ── 다음 카드로 진행할지 폴링하는 타이머 무장 ──
     모든 조건 충족 시(또는 폴백 예산 소진 시) 진행. delayMs 후 재평가. */
  const armAdvance = React.useCallback((token, opts) => {
    const sf = speedRef.current || 1;
    const cur = script[step];
    if (!cur) return;
    const beats = cur.beats || [];
    const lastBeatAt = beats.length ? beats[beats.length - 1].at : 0;
    const hasSpeech = !(typeof window === "undefined" || !window.speechSynthesis);

    // 음성 불가 시 예산(텍스트 길이 기반)
    const fallbackBudget = Math.min(16000, Math.max(6000,
      2500 + 100 * (cur.text ? cur.text.length : 0))) * sf;

    const minDwell = MIN_DWELL * sf;
    const tailGate = lastBeatAt * sf + BEAT_TAIL * sf;

    const tick = () => {
      if (token !== stepTokenRef.current) return;
      const elapsed = Date.now() - stepStartRef.current;
      const speechOk = hasSpeech ? speechDoneRef.current : (elapsed >= fallbackBudget);
      const dwellOk = elapsed >= minDwell;
      const tailOk = elapsed >= tailGate;

      if (speechOk && dwellOk && tailOk) {
        // 진행 — 마지막 카드면 정지(루프 안 함)
        if (step + 1 < total) {
          setStep(step + 1);
        } else {
          setPlaying(false);
        }
        return;
      }
      // 아직 → 가장 늦은 게이트까지 남은 시간 후 재평가
      const remain = Math.max(
        speechOk ? 0 : (hasSpeech ? 220 : fallbackBudget - elapsed),
        dwellOk ? 0 : minDwell - elapsed,
        tailOk ? 0 : tailGate - elapsed,
        120
      );
      advanceTimerRef.current = setTimeout(tick, remain);
    };
    advanceTimerRef.current = setTimeout(tick, opts?.firstDelay ?? 200);
  }, [script, step, total]);

  /* ── 카드 진입: settle → beat 스케줄 → 음성 시작 → advance 무장 ── */
  React.useEffect(() => {
    // 이전 단계 잔여 타이머/음성 정리
    clearTimers();
    stopSpeech();
    setActiveBeat(-1);
    setFocal(null);

    if (!open || !playing) return;
    const cur = script[step];
    if (!cur) return;

    // 음성(오디오) 모드 또는 음성 생성 대기 중: 브라우저 음성·타이머 스케줄 생략(이중 음성 방지)
    if (audioModeRef.current || preparingRef.current) return;

    const token = ++stepTokenRef.current;
    speechDoneRef.current = false;
    const sf = speedRef.current || 1;

    // 속도만 바뀐 경우(같은 카드 step, speedFactor 변경) → 카드 처음부터가 아니라
    // 현재 진행 지점부터 '재개'로 취급(템포만 변경). 진짜 단계 이동은 0부터 시작.
    const speedOnlyChange =
      effectStepRef.current === step && prevSpeedRef.current !== speedFactor;
    if (speedOnlyChange && !resumeRef.current) {
      // 현재 카드 내 경과/문장을 스냅샷 → 아래 isResume 경로로 흘려보냄
      pausedElapsedRef.current = Math.max(0, Date.now() - stepStartRef.current);
      resumeRef.current = true;   // (sentenceIdxRef 는 발화 중 갱신돼 있어 그대로 사용)
    }
    effectStepRef.current = step;
    prevSpeedRef.current = speedFactor;

    // 재개 여부 + 재개 오프셋(카드 내 이미 흘러간 ms). 재개면 저장된 문장부터.
    const isResume = resumeRef.current;
    resumeRef.current = false;
    const resumeOffset = isResume ? (pausedElapsedRef.current || 0) : 0;
    const startSentence = isResume ? (sentenceIdxRef.current || 0) : 0;
    if (!isResume) { sentenceIdxRef.current = 0; pausedElapsedRef.current = 0; }

    const sentences = _splitSentences(cur.text);
    sentencesRef.current = sentences;

    const beats = cur.beats || [];

    // beats 없는 구버전 폴백: triggers 즉시 발사 + 음성 + advance
    if (beats.length === 0) {
      const trs = cur.triggers || [];
      if (trs.length > 0 && !isResume) {
        setSeq((prev) => {
          const next = { ...prev };
          trs.forEach((t) => {
            const e = typeof t === "string" ? { id: t, anim: [] } : t;
            const old = next[e.id] || { n: 0, anim: [] };
            next[e.id] = { n: old.n + 1, anim: e.anim || [] };
          });
          return next;
        });
      }
      stepStartRef.current = Date.now() - resumeOffset;
      speakFrom(sentences, startSentence, token);
      armAdvance(token);
      return () => { clearTimers(); stopSpeech(); setFocal(null); };
    }

    // SETTLE: rAF + 300ms 뒤에 첫 강조/타임라인 무장(레이아웃 안정 후 측정).
    // 재개 시엔 settle 짧게(layout 이미 안정).
    let raf = 0;
    let settleTimer = 0;
    const scheduleBeats = () => {
      if (token !== stepTokenRef.current) return;
      // 재개면 이미 흐른 시간만큼 시작 시각을 과거로 당김
      stepStartRef.current = Date.now() - resumeOffset;

      // ── [내레이션-숫자 기반 하이라이트 · 브라우저 음성 폴백] ──
      //   하드코딩 beat id/at 폐기. 디렉터 멘트의 숫자가 화면 요소에 있으면 그 요소만 강조.
      //   브라우저 TTS 는 고객 질문이 없으므로 clientFrac=0(디렉터가 처음부터 말함).
      //   추정 발화 길이 = fallbackBudget(=armAdvance 와 동일 산식, sf 미적용한 초 단위).
      const holdForLen = (len) => Math.max(1.4, Math.min(3.0, (350 + 68 * (len || 8)) / 1000));
      const budgetSec = Math.min(16000, Math.max(6000, 2500 + 100 * (cur.text ? cur.text.length : 0))) / 1000;
      const stage = stageElRef.current;
      if (stage) {
        const plan = _buildHighlightPlan(stage, cur.text, budgetSec, 0, holdForLen);
        plan.forEach((p) => {
          const fireMs = p.fireAt * 1000 * sf;
          const clearMs = p.clearAt * 1000 * sf;
          const range = { start: p.charIdx, end: p.charIdx + (p.len || 0) };
          const fireDelay = fireMs - resumeOffset;
          if (fireDelay > 0) {
            const tm = setTimeout(() => {
              if (token !== stepTokenRef.current) return;
              setFocal(p.el, range);
            }, fireDelay);
            beatTimersRef.current.push(tm);
          }
          const clearDelay = clearMs - resumeOffset;
          if (clearMs > fireMs + 200 && clearDelay > 0) {
            const clr = setTimeout(() => {
              if (token !== stepTokenRef.current) return;
              setFocalEl((c) => (c === p.el ? null : c));
            }, clearDelay);
            beatTimersRef.current.push(clr);
          }
        });
      }

      // 음성 시작(재개면 저장 문장부터) + 진행 타이머 무장
      speakFrom(sentences, startSentence, token);
      armAdvance(token);
    };

    raf = requestAnimationFrame(() => {
      settleTimer = setTimeout(scheduleBeats, isResume ? 60 : 300);
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (settleTimer) clearTimeout(settleTimer);
      clearTimers();
      stopSpeech();
      setFocal(null);
    };
  // speedFactor 변경 시에도 현재 카드 재스케줄(재생 중일 때)
  }, [step, open, playing, script, speedFactor, preparing, clearTimers, stopSpeech, speakFrom, armAdvance]);

  /* ── 수동 점프 / 토글 / goto — 진행 시 음성·타이머 모두 정리됨(effect 재실행) ──
     수동 이동은 항상 처음부터(resume 아님). */
  const _resetResume = () => { resumeRef.current = false; pausedElapsedRef.current = 0; sentenceIdxRef.current = 0; };
  // 음성 모드: 카드로 점프 = setStep → 그 클립이 처음부터 새로 재생됨(클립 effect 가 처리)
  const _clipMode = () => audioModeRef.current;
  const _audioGoto = (i) => { const idx = Math.max(0, Math.min(total - 1, i)); if (!playingRef.current) setPlaying(true); setStep(idx); };
  const next   = () => { if (_clipMode()) { _audioGoto(stepRef.current + 1); return; } hardStop(); _resetResume(); setStep((s) => Math.min(total - 1, s + 1)); };
  const prev   = () => { if (_clipMode()) { _audioGoto(stepRef.current - 1); return; } hardStop(); _resetResume(); setStep((s) => Math.max(0, s - 1)); };
  const toggle = () => {
    if (_clipMode()) { setPlaying((p) => !p); return; }   // 재생/일시정지 effect 가 클립을 직접 제어
    setPlaying((p) => {
      if (p) {
        // 일시정지 → 카드 내 경과/문장을 cancel() 전에 스냅샷(취소가 onend 를 부를 수 있음)
        pausedElapsedRef.current = Math.max(0, Date.now() - stepStartRef.current);
        const savedSentence = sentenceIdxRef.current || 0;  // 현재 발화 중 문장
        hardStop();                                          // 음성/타이머 정지(pause()는 불안정)
        sentenceIdxRef.current = savedSentence;              // cancel 의 onend 가 건드렸어도 복원
      } else {
        // 재생 재개 → 다음 effect 진입을 '재개'로 표시(남은 문장/남은 시간부터)
        resumeRef.current = true;
      }
      return !p;
    });
  };
  const goto   = (i) => { if (_clipMode()) { _audioGoto(i); return; } hardStop(); _resetResume(); setStep(Math.max(0, Math.min(total - 1, i))); };
  const setSpeed = (v) => { setSpeedFactor(v); if (_clipMode() && audioElRef.current) { try { audioElRef.current.playbackRate = v; } catch (e) {} } };

  return { step, total, playing, seq, prevCard, activeBeat, focalEl, focalRange, setStageEl, script, speedFactor, audioOn, preparing,
           current: script[step] || script[0],
           next, prev, toggle, goto, setSpeed };
}

/* ============================================================
   BeatSubtitle — 자막 안에서 '지금 강조 중인 숫자'(focalRange) 만 강조
   ─────────────────────────────────────────────────────────────
   하이라이트 타깃이 내레이션 숫자 기반이라, 자막 강조도 그 숫자의 char 범위로 동기화.
   range 없으면 전체를 평범한 텍스트로(밑줄 없음).
   ============================================================ */
function BeatSubtitle({ text, range }) {
  const s = String(text || "");
  const r = range && Number.isFinite(range.start) && range.end > range.start ? range : null;
  if (!r || r.start < 0 || r.start >= s.length) return <span>{s}</span>;
  const start = Math.max(0, r.start);
  const end = Math.min(s.length, r.end);
  return (
    <span>
      {start > 0 ? <span>{s.slice(0, start)}</span> : null}
      <span className="dr-phrase on">{s.slice(start, end)}</span>
      {end < s.length ? <span>{s.slice(end)}</span> : null}
    </span>
  );
}

/* ============================================================
   DirectorAvatar (큰 버전)
   ============================================================ */
function BigAvatar({ playing }) {
  return (
    <div className="dm-avatar">
      <svg width="84" height="84" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="24" r="11" fill="rgba(125,187,255,0.92)"/>
        <path d="M12 56c0-11 9-18 20-18s20 7 20 18" fill="rgba(125,187,255,0.55)"/>
        <circle cx="28" cy="22" r="1.6" fill="#0d1014"/>
        <circle cx="36" cy="22" r="1.6" fill="#0d1014"/>
        <path d="M28 27c1.4 1.5 2.8 1.5 4 0" stroke="#0d1014" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      </svg>
      {playing && <div className="dm-avatar__live"><span className="dm-pulse-dot"></span>설명 중</div>}
    </div>
  );
}

/* ============================================================
   DirectorModal — 풀스크린, 좌측 디렉터 / 우측 카드
   ============================================================ */
function DirectorModal({ open, onClose }) {
  const pb = useDirectorPlayback(open);

  /* 단축키 */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight") pb.next();
      else if (e.key === "ArrowLeft")  pb.prev();
      else if (e.key === " ") { e.preventDefault(); pb.toggle(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pb.step]);

  /* ── [내레이션-숫자 기반 하이라이트] pb.focalEl(말하는 숫자가 표시된 실제 DOM 요소)이
     바뀔 때마다: 카드는 scale 1.0 고정. "초점 빼고 전부 딤(오버레이 1장) + 초점만 위로 pop+glow".
     초점 대상은 재생 훅이 내레이션 숫자→DOM 매칭으로 골라준 요소. 매칭 없으면 focalEl=null → 강조 없음. */
  const stageRef = React.useRef(null);
  const overlayRef = React.useRef(null);     // 카드 전체를 덮는 단일 딤 오버레이
  const focalRef = React.useRef(null);        // 현재 초점 요소(복귀용)
  // 스테이지 카드 DOM 을 재생 훅에 전달(콜백 ref) — 거기서 숫자→요소 매칭에 사용
  const attachStage = React.useCallback((el) => {
    stageRef.current = el;
    pb.setStageEl?.(el);
  }, [pb.setStageEl]);
  React.useEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    if (!stage) return;
    const target = pb.focalEl;   // 재생 훅이 고른, 지금 말하는 숫자가 표시된 요소(없으면 null)

    // 단일 딤 오버레이 확보(카드 좌표계 — stage 는 dm-stage__card, position:relative)
    let overlay = overlayRef.current;
    if (!overlay || overlay.parentNode !== stage) {
      overlay = document.createElement("div");
      overlay.className = "dm-dim-overlay";
      overlay.setAttribute("aria-hidden", "true");
      stage.appendChild(overlay);
      overlayRef.current = overlay;
    }

    // 이전 초점 해제(딤은 그대로 두고 lift/glow 만 새 초점으로 이동)
    const clearFocal = () => {
      const prev = focalRef.current;
      if (prev) {
        prev.removeAttribute("data-fx-lift");
        prev.classList.remove("dm-focal-pop");
        focalRef.current = null;
      }
    };

    // 딤+초점 전체 해제(초점 없음 → 정리)
    const clearAll = () => {
      clearFocal();
      stage.removeAttribute("data-fx-dim");
      stage.removeAttribute("data-focus");
    };

    // 매칭된 요소가 없으면(이 카드에 그 숫자가 없거나 말하는 중 아님) → 강조 없음
    if (!target || !stage.contains(target)) { clearAll(); return; }

    // 박스로 승격 (tile/box 가 아니면 부모 박스로) — 초점 단위(글로우가 박스 단위로 깔끔)
    let focal = target;
    if (!target.classList.contains("bc-tile") && !target.classList.contains("bc-box")) {
      focal = target.closest(".bc-tile, .bc-box") || target;
    }

    // 이전 초점 해제 후 새 초점 적용 (한 번에 하나)
    clearFocal();

    // 카드 전체 딤 켜기(오버레이 표시) + 자막 동기화용 data-focus
    stage.setAttribute("data-fx-dim", "1");
    stage.setAttribute("data-focus", "1");

    // 초점만 오버레이 위로 올리고 pop+glow
    focal.setAttribute("data-fx-lift", "1");   // position:relative + z-index(오버레이 위)
    focal.classList.add("dm-focal-pop");        // scale(1.08) + accent glow
    focalRef.current = focal;

    return () => { clearFocal(); };
  }, [pb.focalEl, open, pb.current?.card]);

  // 모달 닫히거나 카드 바뀔 때 딤 오버레이도 같이 정리(다음 카드에서 잔상 방지)
  React.useEffect(() => {
    return () => {
      const ov = overlayRef.current;
      if (ov && ov.parentNode) { ov.parentNode.removeChild(ov); }
      overlayRef.current = null;
      focalRef.current = null;
    };
  }, [open, pb.current?.card]);

  if (!open) return null;

  const SeqCtx = window.SeqCtx;

  const cur = pb.current;
  const Comp = window[`Card${cur.card}`];
  // [bc] index.html renderCard 와 동일하게 __BC_DATA__ 에서 실제 카드 body 주입
  // (이게 없으면 모달 안 카드가 전부 "데이터 수집 중" 빈 화면이 됨)
  const _cardIdx = parseInt(cur.card, 10) - 1;
  const _cardBody = (window.__BC_DATA__ && window.__BC_DATA__.cards
    && window.__BC_DATA__.cards[_cardIdx] && window.__BC_DATA__.cards[_cardIdx].body) || {};
  const _compProps = cur.card === "14" ? { body: _cardBody, onOpenDirector: () => {} } : { body: _cardBody };
  const cardInfo = window.CARDS?.find(c => c.n === cur.card);
  const groupInfo = window.GROUPS?.find(g => g.cards.includes(cur.card));
  const progress = ((pb.step + 1) / pb.total) * 100;

  // 퇴장(crossfade) 레이어용 — 이전 카드 컴포넌트/프롭
  const prevComp = pb.prevCard ? window[`Card${pb.prevCard}`] : null;
  const PrevComp = prevComp;
  const _prevIdx = pb.prevCard ? parseInt(pb.prevCard, 10) - 1 : -1;
  const _prevBody = (_prevIdx >= 0 && window.__BC_DATA__ && window.__BC_DATA__.cards
    && window.__BC_DATA__.cards[_prevIdx] && window.__BC_DATA__.cards[_prevIdx].body) || {};
  const prevProps = pb.prevCard === "14" ? { body: _prevBody, onOpenDirector: () => {} } : { body: _prevBody };

  return (
    <SeqCtx.Provider value={{ seq: pb.seq, tab: "main", speed: 1 }}>
      <div className="dm-root" role="dialog" aria-modal="true">
        {/* 배경: 어둡고 흐릿한 백드롭 + 살짝 보이는 그리드 ghost */}
        <div className="dm-backdrop" onClick={onClose}>
          <div className="dm-ghost-grid" aria-hidden="true">
            {window.CARDS.map(c => (
              <div key={c.n} className={"dm-ghost-card " + (c.n === cur.card ? "on" : "")}>
                <div className="dm-ghost-num">{c.n}</div>
                <div className="dm-ghost-title">{c.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 좌측 디렉터 패널 */}
        <aside className="dm-side">
          <header className="dm-side__head">
            <div className="dm-brand">
              <span className="dm-pulse-dot"></span>
              <span className="dm-brand__name">AI 디렉터</span>
              {pb.preparing ? (
                <span style={{marginLeft:8, fontSize:11, padding:"2px 7px", borderRadius:8,
                  background:"rgba(76,123,228,0.18)", color:"#9bb8f5", letterSpacing:"0.2px"}}>
                  음성 준비 중…
                </span>
              ) : !pb.audioOn ? (
                <span style={{marginLeft:8, fontSize:11, padding:"2px 7px", borderRadius:8,
                  background:"rgba(255,255,255,0.07)", color:"var(--fg-3, #9aa)", letterSpacing:"0.2px"}}>
                  브라우저 음성
                </span>
              ) : null}
            </div>
            <button className="dm-close" onClick={onClose} title="닫기 (Esc)">
              <i className="ph ph-x"></i>
            </button>
          </header>

          <div className="dm-side__body">
            <BigAvatar playing={pb.playing}/>

            <div className="dm-crumb">
              <span className="dm-crumb__group">{groupInfo?.label}</span>
              <span className="dm-crumb__sep">·</span>
              <span className="dm-crumb__num">{cur.card}</span>
              <span className="dm-crumb__card">{cardInfo?.title}</span>
            </div>
            <div className="dm-beat">{cur.beat}</div>

            <div className="dm-subtitle">
              <BeatSubtitle text={cur.text} range={pb.focalRange}/>
            </div>
          </div>

          <footer className="dm-side__foot">
            <div className="dm-progress">
              <div className="dm-progress__bar" style={{width:`${progress}%`}}></div>
              <div className="dm-progress__ticks">
                {pb.script.map((s, i) => (
                  <button key={i}
                    className={"dm-tick " + (i === pb.step ? "on" : i < pb.step ? "done" : "")}
                    style={{left:`${(i/(pb.total-1))*100}%`}}
                    onClick={() => pb.goto(i)}
                    title={`${s.card} · ${s.beat}`}></button>
                ))}
              </div>
            </div>
            <div className="dm-step">{pb.step + 1} / {pb.total}</div>

            <div className="dm-controls">
              <button onClick={pb.prev} disabled={pb.step === 0} title="이전 (←)">
                <i className="ph ph-skip-back"></i>
              </button>
              <button onClick={pb.toggle} className="primary" title={pb.playing ? "일시정지 (Space)" : "재생 (Space)"}>
                <i className={pb.playing ? "ph-fill ph-pause" : "ph-fill ph-play"}></i>
              </button>
              <button onClick={pb.next} disabled={pb.step >= pb.total - 1} title="다음 (→)">
                <i className="ph ph-skip-forward"></i>
              </button>
              <button onClick={onClose} title="종료 (Esc)">
                <i className="ph ph-x"></i>
              </button>
            </div>

            {/* 재생 속도 — 0.75 / 1 / 1.25배 (음성·beat·전환 전체에 적용) */}
            <div className="dm-speed" role="group" aria-label="재생 속도">
              {[0.75, 1, 1.25].map((sp) => (
                <button key={sp}
                  className={"dm-speed__btn" + (pb.speedFactor === sp ? " on" : "")}
                  onClick={() => pb.setSpeed(sp)}
                  title={`재생 속도 ${sp}배`}>
                  {sp}x
                </button>
              ))}
            </div>
          </footer>
        </aside>

        {/* 우측: 큰 카드 디스플레이 — 카드 전환은 부드러운 크로스페이드(젠틀 돌리),
            강조는 내부 요소에서 줌업 */}
        <main className="dm-stage">
          <div className="dm-stage__crumb" key={"cr-"+cur.card}>
            <span>{cur.card}</span>
            <span>·</span>
            <span>{cardInfo?.title}</span>
          </div>
          <div className="dm-stage__perspective">
            {/* 퇴장: 이전 카드를 잠깐(0.38s) exit 애니로 유지 → 하드컷 방지 */}
            {prevComp && pb.prevCard && pb.prevCard !== cur.card && (
              <div className="dm-stage__card dm-stage__card--exit" key={"prev-"+pb.prevCard} aria-hidden="true">
                <PrevComp {...prevProps}/>
              </div>
            )}
            {/* 입장: 새 카드 enter 애니 */}
            <div className="dm-stage__card dm-stage__card--enter" ref={attachStage} key={"card-"+cur.card}>
              {Comp ? <Comp {..._compProps}/> : <div style={{padding:32, color:"var(--fg-3)"}}>카드 {cur.card}</div>}
            </div>
          </div>
        </main>
      </div>
    </SeqCtx.Provider>
  );
}

Object.assign(window, { DirectorModal, DIRECTOR_SCRIPT,
  // [검증용] 내레이션-숫자→DOM 매칭 함수 노출(디버그 전용, 동작에 영향 없음)
  __dmExtractTokens: _extractValueTokens,
  __dmFindEl: _findElementForToken,
  __dmBuildPlan: _buildHighlightPlan,
  __dmBuildScript: buildLiveScript });
