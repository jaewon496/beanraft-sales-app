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
const DIRECTOR_SCRIPT = [
  { card:"01", beat:"상권 진단", dur:8800,
    text:"자리부터 보겠습니다. 강남역 1번 출구 일대 — 반경 500m에 매장이 350개. 그 중 카페가 126개입니다. 한국에서 카페 밀도 톱 5에 들어가는 자리예요.",
    beats:[
      { at:1500, id:"c1.tile1", anim:["focus"],                  phrase:"강남역 1번 출구" },
      { at:3000, id:"c1.tile2", anim:["rise","roulette"],        phrase:"350개" },
      { at:4800, id:"c1.donut", anim:["dolly","spin-in"],        phrase:"카페가 126개" },
      { at:6800, id:"c1.tile3", anim:["drift-r","roulette"],     phrase:"카페 밀도 톱 5" },
    ]},
  { card:"02", beat:"고객 결", dur:9000,
    text:"고객 결입니다. 주요 연령대는 30대로 34%. 성비는 여성 49 : 남성 51 — 거의 반반이지만 남성이 살짝 더 많아요. 재방문율 38%, 자주 오는 동네입니다.",
    beats:[
      { at:1200, id:"c2.tile1", anim:["rise","roulette"],        phrase:"30대" },
      { at:2900, id:"c2.bars",  anim:["focus","bounce"],         phrase:"34%" },
      { at:4400, id:"c2.tile2", anim:["drift-l","flash"],        phrase:"49 : 남성 51" },
      { at:6600, id:"c2.tile3", anim:["dolly","roulette"],       phrase:"재방문율 38%" },
    ]},
  { card:"03", beat:"변화 흐름", dur:8600,
    text:"변화 추이입니다. 1년 생존율 89%, 3년 71%, 5년 52% — 모두 강남 평균 상회. 5년 전 108개에서 지금 126개. 시장이 천천히 살이 붙고 있어요.",
    beats:[
      { at:1200, id:"c3.g1",    anim:["drift-l","grad-flow"],    phrase:"1년 생존율 89%" },
      { at:2800, id:"c3.g3",    anim:["drift-l","grad-flow"],    phrase:"3년 71%" },
      { at:4300, id:"c3.g5",    anim:["drift-l","grad-flow"],    phrase:"5년 52%" },
      { at:6300, id:"c3.tile2", anim:["rise","roulette"],        phrase:"108개에서 지금 126개" },
    ]},
  { card:"04", beat:"경쟁자 명단", dur:7800,
    text:"프랜차이즈를 봅시다. 200미터 안에 스타벅스 11점. 이디야·투썸·메가·폴바셋까지 — 빅 5가 다 들어와 있는 자리예요.",
    beats:[
      { at:1300, id:"c4.top7", anim:["focus"],                   phrase:"스타벅스 11점" },
      { at:4200, id:"c4.top7", anim:["dolly"],                   phrase:"빅 5" },
    ]},
  { card:"05", beat:"매출 회수", dur:8800,
    text:"회수 가능성입니다. 월매출 평균 9,121만원 — 강남구 평균보다 +16%. 13개월 추이를 보면 매월 +1~2% 꾸준히 오르고 있어요. 살아있는 시장입니다.",
    beats:[
      { at:1200, id:"c6.tile1", anim:["dolly","roulette"],       phrase:"9,121만원" },
      { at:3400, id:"c6.tile2", anim:["rise","flash"],           phrase:"+16%" },
      { at:5400, id:"c6.line",  anim:["focus","sweep","wobble"], phrase:"매월 +1~2%" },
    ]},
  { card:"06", beat:"개인 카페", dur:8400,
    text:"개인 카페가 71개, 비중 56%. 절반 넘게 차지하는 동네는 흔치 않아요. 아메리카노 평균 4,500원 — 스타벅스 톨 4,700원보다 살짝 아래입니다.",
    beats:[
      { at:1300, id:"c5.tile1", anim:["rise","roulette"],        phrase:"71개" },
      { at:3000, id:"c5.tile3", anim:["dolly","roulette"],       phrase:"비중 56%" },
      { at:5300, id:"c5.tile2", anim:["drift-l","roulette"],     phrase:"4,500원" },
    ]},
  { card:"07", beat:"사람 흐름", dur:9000,
    text:"유동인구 일평균 57만 명. 12~18시에 24%, 목요일이 17.8%로 가장 많습니다. 주중 비중이 77% — 직장 수요가 메인이라는 뜻이에요.",
    beats:[
      { at:1100, id:"c7.tile1", anim:["focus","roulette"],       phrase:"57만 명" },
      { at:3000, id:"c7.hours", anim:["drift-l","bounce"],       phrase:"12~18시" },
      { at:4500, id:"c7.days",  anim:["drift-r","bounce"],       phrase:"목요일이 17.8%" },
      { at:6500, id:"c7.donut", anim:["dolly","spin-in"],        phrase:"주중 비중이 77%" },
    ]},
  { card:"08", beat:"들어가는 비용", dur:8600,
    text:"비용이 만만치 않습니다. 평당 월세 42만원, 권리금 1.8억 — 시도 평균 +114%. 15평 기준 총 창업비 약 2.1억으로 잡혀요.",
    beats:[
      { at:1200, id:"c8.tile1", anim:["rise","roulette"],        phrase:"42만원" },
      { at:3000, id:"c8.tile3", anim:["dolly","roulette"],       phrase:"1.8억" },
      { at:5000, id:"c8.tile4", anim:["focus","roulette","flash"], phrase:"2.1억" },
    ]},
  { card:"09", beat:"기회 신호", dur:8000,
    text:"기회 포인트입니다. 공실률 6.9% — 보통이지만 안정권. 12분기 추이가 5%대에서 6.9%로 살짝 올랐지만 강남 평균 6.4% 수준이라 큰 위협은 아니에요.",
    beats:[
      { at:1100, id:"c9.hero", anim:["focus","roulette"],        phrase:"공실률 6.9%" },
      { at:3800, id:"c9.line", anim:["dolly","sweep","wobble"],  phrase:"12분기 추이" },
      { at:5800, id:"c9.list", anim:["rise"],                    phrase:"강남 평균 6.4%" },
    ]},
  { card:"10", beat:"배달 채널", dur:9000,
    text:"배달도 봅시다. 객단가 20,851원, 월 배달 매출 1,420만 — 매장의 15%. 12개월 주문건수가 420건에서 681건으로 +62%. 안전 노선으로 활용 가능해요.",
    beats:[
      { at:1100, id:"c10.tile1", anim:["rise","roulette"],       phrase:"20,851원" },
      { at:3000, id:"c10.tile2", anim:["dolly","roulette"],      phrase:"1,420만" },
      { at:5000, id:"c10.line",  anim:["focus","sweep","wobble"], phrase:"+62%" },
    ]},
  { card:"11", beat:"분위기", dur:8800,
    text:"SNS 분위기를 보면 긍정 비율 78% — 매우 좋은 동네입니다. 키워드는 강남카페, 분위기, 디저트맛집, 미팅장소 — 프리미엄 미팅 카페 결이 분명히 있어요.",
    beats:[
      { at:1200, id:"c11.tile1", anim:["focus","roulette"],      phrase:"긍정 비율 78%" },
      { at:3500, id:"c11.cloud", anim:["rise"],                  phrase:"강남카페, 분위기, 디저트맛집" },
      { at:6300, id:"c11.top5",  anim:["drift-l"],               phrase:"프리미엄 미팅 카페" },
    ]},
  { card:"12", beat:"날씨 영향", dur:8200,
    text:"날씨도 챙깁니다. 비 오는 날 매출이 +14% — 직장인들이 카페로 피신하는 패턴. 폭염·폭설 때는 -22%까지 빠지지만 배달 채널이 완충해줍니다.",
    beats:[
      { at:1100, id:"c12.tile1", anim:["rise","roulette"],       phrase:"+14%" },
      { at:3400, id:"c12.tile3", anim:["dolly","roulette","glitch","flash"], phrase:"-22%" },
      { at:5800, id:"c12.cal",   anim:["focus"],                 phrase:"배달 채널이 완충" },
    ]},
  { card:"13", beat:"5축 분해", dur:9000,
    text:"이제 종합입니다. 5축 분해로 보면 시장·생존은 강한데 비용 부담에서 점수를 깎아 먹어요. 종합 53점 — 신중 검토 등급. 비싸지만 시장이 보장하는 자리라는 뜻입니다.",
    beats:[
      { at:1200, id:"c13.axes",  anim:["drift-l","bounce"],      phrase:"5축 분해" },
      { at:3400, id:"c13.kpi1",  anim:["rise","roulette"],       phrase:"시장·생존은 강한데" },
      { at:5400, id:"c13.kpi2",  anim:["focus","glitch","flash"], phrase:"비용 부담" },
      { at:7000, id:"c13.gauge", anim:["dolly","glitch"],        phrase:"종합 53점" },
    ]},
  { card:"14", beat:"최종 의견", dur:9600,
    text:"최종 의견입니다. 5축 레이더 — 입지·매출·생존은 외곽까지 펼쳐졌고 비용은 안쪽에 머물러요. 의뢰인 자본 여력 보고 프리미엄이냐 안전이냐 두 갈래 중 하나로 결정하시면 됩니다.",
    beats:[
      { at:1500, id:"c14.radar", anim:["focus"],                          phrase:"5축 레이더" },
      { at:4400, id:"c14.score", anim:["dolly","roulette"],               phrase:"입지·매출·생존은 외곽" },
      { at:6800, id:"c14.kpi2",  anim:["rise","flash"],                   phrase:"비용은 안쪽" },
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

function buildLiveScript() {
  const d = getLiveDirector();
  if (!d) return DIRECTOR_SCRIPT; // 실데이터 없으면 하드코딩 폴백

  return DIRECTOR_SCRIPT.map((step) => {
    const area = CARD_AREA_MAP[step.card];
    let beatTitle = step.beat;
    let text = step.text;

    if (area === "ai") {
      // 마지막 카드 — intro + closing 종합
      const parts = [];
      if (d.intro) parts.push(d.intro);
      if (d.closing) parts.push(d.closing);
      if (parts.length) {
        text = parts.join(' ');
        beatTitle = "최종 의견";
      }
    } else {
      const block = d[area];
      if (block) {
        const obs = Array.isArray(block.observations)
          ? block.observations.filter(Boolean) : [];
        // 같은 영역을 쓰는 카드 순서 → 관찰 멘트를 나눠 배정
        const order = AREA_CARD_ORDER[area] || [step.card];
        const cardPos = Math.max(0, order.indexOf(step.card));
        const slot = order.length || 1;
        // observations 를 slot 등분, 이 카드 몫만 추림
        const per = Math.ceil(obs.length / slot) || 1;
        let mine = obs.slice(cardPos * per, cardPos * per + per);
        // 몫이 비면(관찰 수가 적을 때) 영역 전체에서 앞쪽 일부 사용
        if (mine.length === 0) mine = obs.slice(0, 2);
        const sentences = [];
        if (block.headline) sentences.push(String(block.headline) + '.');
        mine.forEach(o => {
          let s = String(o).trim();
          if (s && !/[.!?]$/.test(s)) s += '.';
          if (s) sentences.push(s);
        });
        if (sentences.length) {
          text = sentences.join(' ');
          if (block.headline) beatTitle = String(block.headline);
        }
      }
    }

    return { ...step, beat: beatTitle, text };
  });
}

/* ============================================================
   useDirectorPlayback — 단계별 자동 진행 + beat 타임라인 스케줄
   ============================================================ */
function useDirectorPlayback(open) {
  const [step, setStep] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [seq, setSeq] = React.useState({});
  const [prevCard, setPrevCard] = React.useState(null);
  const [activeBeat, setActiveBeat] = React.useState(-1);   // 현재 강조 중 beat idx
  // [bc] 모달 열릴 때 검색 지역 실데이터로 대본 재생성 (실데이터 없으면 하드코딩 폴백)
  const [script, setScript] = React.useState(DIRECTOR_SCRIPT);
  const total = script.length;

  /* 모달 열릴 때마다 리셋 + 실데이터 대본 빌드 */
  React.useEffect(() => {
    if (!open) return;
    setScript(buildLiveScript());
    setStep(0); setPlaying(true); setSeq({}); setPrevCard(null); setActiveBeat(-1);
  }, [open]);

  /* 단계 전환 시 이전 카드 기억 (퇴장 모션) */
  const prevStepRef = React.useRef(0);
  React.useEffect(() => {
    if (!open) return;
    const prevIdx = prevStepRef.current;
    if (prevIdx !== step) {
      const pc = script[prevIdx]?.card;
      if (pc && pc !== script[step]?.card) {
        setPrevCard(pc);
        const t = setTimeout(() => setPrevCard(null), 320);
        prevStepRef.current = step;
        return () => clearTimeout(t);
      }
      prevStepRef.current = step;
    }
  }, [step, open]);

  /* 단계 진입 시 beat 타임라인 스케줄 — 대사 시점에 맞춰 개별 트리거 발사 */
  const beatTimersRef = React.useRef([]);
  React.useEffect(() => {
    // 정리
    beatTimersRef.current.forEach(t => clearTimeout(t));
    beatTimersRef.current = [];
    setActiveBeat(-1);

    if (!open || !playing) return;
    const cur = script[step];
    if (!cur) return;

    const beats = cur.beats || [];
    if (beats.length === 0) {
      // 백업: triggers (구버전 호환) 즉시 발사
      const trs = cur.triggers || [];
      if (trs.length > 0) {
        setSeq(prev => {
          const next = { ...prev };
          trs.forEach(t => {
            const e = typeof t === "string" ? { id:t, anim:[] } : t;
            const old = next[e.id] || { n:0, anim:[] };
            next[e.id] = { n: old.n + 1, anim: e.anim || [] };
          });
          return next;
        });
      }
      return;
    }

    // 각 beat 를 at(ms) 시점에 발사
    // 강조 후 hold(1.4s) 까지 머물다가 자동 해제 → 전체 대시보드가 잠깐 보이고 → 다음 beat
    const stepDur = cur.dur || 7000;
    beats.forEach((b, i) => {
      const tm = setTimeout(() => {
        setSeq(prev => {
          const next = { ...prev };
          const old = next[b.id] || { n:0, anim:[] };
          next[b.id] = { n: old.n + 1, anim: b.anim || [] };
          return next;
        });
        setActiveBeat(i);
      }, b.at);
      beatTimersRef.current.push(tm);

      // 해제 타이밍 — 다음 beat 200ms 전, 또는 +1400ms 중 더 빠른 쪽
      const nextAt = beats[i+1] ? beats[i+1].at : stepDur;
      const clearAt = Math.min(b.at + 1400, nextAt - 220);
      if (clearAt > b.at + 200) {
        const clr = setTimeout(() => setActiveBeat(a => a === i ? -1 : a), clearAt);
        beatTimersRef.current.push(clr);
      }
    });

    return () => {
      beatTimersRef.current.forEach(t => clearTimeout(t));
      beatTimersRef.current = [];
    };
  }, [step, open, playing, script]);

  /* 자동 다음 단계 */
  React.useEffect(() => {
    if (!open || !playing) return;
    const dur = script[step]?.dur || 7000;
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 < total) return s + 1;
        setPlaying(false);
        return s;
      });
    }, dur);
    return () => clearTimeout(t);
  }, [open, playing, step, total]);

  /* 수동 점프 시 beat 즉시 다시 발사 */
  const next   = () => setStep(s => Math.min(total-1, s+1));
  const prev   = () => setStep(s => Math.max(0,       s-1));
  const toggle = () => setPlaying(p => !p);
  const goto   = (i) => setStep(Math.max(0, Math.min(total-1, i)));

  return { step, total, playing, seq, prevCard, activeBeat, script,
           current: script[step] || script[0],
           next, prev, toggle, goto };
}

/* ============================================================
   BeatSubtitle — 자막 안에서 현재 beat 의 phrase 만 강조
   ============================================================ */
function BeatSubtitle({ text, beats, activeBeat }) {
  if (!beats || beats.length === 0) return <span>{text}</span>;
  // 모든 phrase 의 위치를 찾아 세그먼트로 분할
  const phrases = beats.map(b => b.phrase).filter(Boolean);
  const segments = [];
  let cursor = 0;
  // 텍스트를 좌→우로 훑으며 각 phrase 의 첫 등장 위치를 잡아 분할
  const used = new Array(beats.length).fill(false);
  while (cursor < text.length) {
    let nextHit = -1, nextEnd = -1, hitBeat = -1;
    beats.forEach((b, i) => {
      if (used[i] || !b.phrase) return;
      const idx = text.indexOf(b.phrase, cursor);
      if (idx !== -1 && (nextHit === -1 || idx < nextHit)) {
        nextHit = idx;
        nextEnd = idx + b.phrase.length;
        hitBeat = i;
      }
    });
    if (nextHit === -1) {
      segments.push({ kind:"text", text: text.slice(cursor) });
      break;
    }
    if (nextHit > cursor) segments.push({ kind:"text", text: text.slice(cursor, nextHit) });
    segments.push({ kind:"phrase", text: text.slice(nextHit, nextEnd), beatIdx: hitBeat });
    used[hitBeat] = true;
    cursor = nextEnd;
  }
  return (
    <span>
      {segments.map((s, i) => {
        if (s.kind === "text") return <span key={i}>{s.text}</span>;
        const isOn = s.beatIdx === activeBeat;
        return (
          <span key={i} className={"dr-phrase" + (isOn ? " on" : "")}>{s.text}</span>
        );
      })}
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

  /* activeBeat 변경 시 — 같은 박스면 안쪽만 갱신, 다른 박스면 전체 줌업 */
  const stageRef = React.useRef(null);
  const prevBoxRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    if (!stage) return;
    const _cur = pb.current;
    const beat = pb.activeBeat >= 0 ? (_cur?.beats || [])[pb.activeBeat] : null;

    const clearAll = () => {
      stage.querySelectorAll("[data-fx-active]").forEach(el => {
        el.removeAttribute("data-fx-active");
        el.removeAttribute("data-fx-anim");
        el.style.removeProperty("--fx-scale");
        el.style.removeProperty("--fx-tx");
        el.style.removeProperty("--fx-ty");
      });
      stage.querySelectorAll("[data-fx-inner]").forEach(el => el.removeAttribute("data-fx-inner"));
      stage.removeAttribute("data-focus");
      prevBoxRef.current = null;
    };

    if (!beat || !beat.id) { clearAll(); return; }

    const innerTarget = stage.querySelector(`[data-fx-id="${beat.id}"]`);
    if (!innerTarget) { clearAll(); return; }

    // 박스로 승격 (tile/box 가 아니면 부모 박스로)
    let boxTarget = innerTarget;
    if (!innerTarget.classList.contains("bc-tile") && !innerTarget.classList.contains("bc-box")) {
      boxTarget = innerTarget.closest(".bc-tile, .bc-box") || innerTarget;
    }
    const sameBox = boxTarget === prevBoxRef.current;

    // 내부 하이라이트 표식 갱신
    stage.querySelectorAll("[data-fx-inner]").forEach(el => el.removeAttribute("data-fx-inner"));
    if (innerTarget !== boxTarget) {
      innerTarget.setAttribute("data-fx-inner", "1");
    }

    if (sameBox) {
      // 박스는 그대로 — focus 속성만 갱신해서 BeatSubtitle 동기화
      stage.setAttribute("data-focus", beat.id);
      return;
    }

    // 다른 박스로 전환 — 기존 정리
    stage.querySelectorAll("[data-fx-active]").forEach(el => {
      el.removeAttribute("data-fx-active");
      el.removeAttribute("data-fx-anim");
      el.style.removeProperty("--fx-scale");
      el.style.removeProperty("--fx-tx");
      el.style.removeProperty("--fx-ty");
    });

    const computeFx = () => {
      const sRect = stage.getBoundingClientRect();
      const tRect = boxTarget.getBoundingClientRect();
      if (tRect.width === 0 || tRect.height === 0) return;
      const targetAreaRatio = 0.38;
      const elArea = tRect.width * tRect.height;
      const stageArea = sRect.width * sRect.height;
      const desiredScale = Math.sqrt((stageArea * targetAreaRatio) / elArea);
      const maxScaleW = (sRect.width * 0.85) / tRect.width;
      const maxScaleH = (sRect.height * 0.85) / tRect.height;
      const scale = Math.max(1.5, Math.min(2.6, Math.min(desiredScale, maxScaleW, maxScaleH)));
      const elCx = tRect.left + tRect.width / 2;
      const elCy = tRect.top + tRect.height / 2;
      const stCx = sRect.left + sRect.width / 2;
      const stCy = sRect.top + sRect.height / 2;
      const tx = stCx - elCx;
      const ty = stCy - elCy;
      boxTarget.style.setProperty("--fx-scale", scale.toFixed(3));
      boxTarget.style.setProperty("--fx-tx", tx.toFixed(1) + "px");
      boxTarget.style.setProperty("--fx-ty", ty.toFixed(1) + "px");
    };
    computeFx();
    boxTarget.setAttribute("data-fx-active", "1");
    const extras = ["rise","fall","drift-l","drift-r","dolly","focus"];
    const tokens = (beat.anim || []).filter(a => extras.includes(a));
    if (tokens.length) boxTarget.setAttribute("data-fx-anim", tokens.join(" "));
    stage.setAttribute("data-focus", beat.id);
    prevBoxRef.current = boxTarget;

    const onResize = () => computeFx();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pb.activeBeat, open, pb.current?.card]);

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
              <BeatSubtitle text={cur.text} beats={cur.beats} activeBeat={pb.activeBeat}/>
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
          </footer>
        </aside>

        {/* 우측: 큰 카드 디스플레이 — 카드 전환은 부드럽게, 강조는 내부 요소에서 */}
        <main className="dm-stage">
          <div className="dm-stage__crumb" key={"cr-"+cur.card}>
            <span>{cur.card}</span>
            <span>·</span>
            <span>{cardInfo?.title}</span>
          </div>
          <div className="dm-stage__card" ref={stageRef} key={"card-"+cur.card}>
            {Comp ? <Comp {..._compProps}/> : <div style={{padding:32, color:"var(--fg-3)"}}>카드 {cur.card}</div>}
          </div>
        </main>
      </div>
    </SeqCtx.Provider>
  );
}

Object.assign(window, { DirectorModal, DIRECTOR_SCRIPT });
