/* director-modal.jsx — AI 디렉터 풀스크린 모달
   ─────────────────────────────────────────────────────────────
   14개 카드를 순서대로 1개씩 큼직하게 보여주며 디렉터가 설명.
   좌측: 디렉터 자막/진행/컨트롤
   우측: 현재 단계 카드 (큰 사이즈, 자체 애니메이션)
*/

const DIRECTOR_SCRIPT = [
  { card:"01", beat:"상권 진단",   dur:7600,
    text:"자리부터 보겠습니다. 강남역 1번 출구 일대 — 반경 500m에 매장이 350개. 그 중 카페가 126개입니다. 한국에서 카페 밀도 톱 5에 들어가는 자리예요.",
    triggers:[
      {id:"c1.tile1", anim:["roulette","bounce","sparkle"]},
      {id:"c1.tile2", anim:["roulette","bounce"]},
      {id:"c1.tile3", anim:["roulette","bounce"]},
      {id:"c1.tile4", anim:["roulette","bounce"]},
      {id:"c1.donut", anim:["spin-in","glow"]},
    ]},
  { card:"02", beat:"고객 결",     dur:7200,
    text:"고객 결입니다. 30대가 34%로 가장 두텁고, 재방문율 38% — 자주 오는 동네라는 뜻이에요. 라이프스타일도 미팅·SNS·퇴근후로 매우 명확합니다.",
    triggers:[
      {id:"c2.tile1", anim:["roulette","bounce"]},
      {id:"c2.tile2", anim:["roulette"]},
      {id:"c2.tile3", anim:["roulette","bounce"]},
      {id:"c2.tile4", anim:["roulette"]},
      {id:"c2.bars",  anim:["bounce"]},
      {id:"c2.chips", anim:[]},
    ]},
  { card:"03", beat:"변화 흐름",   dur:7000,
    text:"변화 추이입니다. 1년 생존율 89%, 3년 71%, 5년 52% — 모두 강남 평균 상회. 5년 전 108개에서 지금 126개. 시장이 천천히 살이 붙고 있어요.",
    triggers:[
      {id:"c3.tile1", anim:["roulette","bounce"]},
      {id:"c3.tile2", anim:["roulette"]},
      {id:"c3.tile3", anim:["roulette","bounce"]},
      {id:"c3.tile4", anim:["roulette"]},
      {id:"c3.g1",    anim:["grad-flow","glow"]},
      {id:"c3.g3",    anim:["grad-flow","bounce"]},
      {id:"c3.g5",    anim:["grad-flow","flash"]},
    ]},
  { card:"04", beat:"경쟁자 명단", dur:7000,
    text:"프랜차이즈를 봅시다. 200미터 안에 스타벅스 11점이 들어와 있어요. 이디야·투썸·메가·폴바셋까지 — 빅 5가 다 들어와 있는 자리입니다.",
    triggers:[
      {id:"c4.top7",  anim:[]},
    ]},
  /* 05 매출, 06 개인카페 — 순서 주의 */
  { card:"05", beat:"매출 회수",   dur:7400,
    text:"회수 가능성입니다. 월매출 평균 9,121만원 — 강남구 평균 +16%. 13개월 추이를 보면 매월 +1~2% 꾸준히 오르고 있어요. 살아있는 시장입니다.",
    triggers:[
      {id:"c6.tile1", anim:["roulette","bounce","sparkle"]},
      {id:"c6.tile2", anim:["roulette","bounce"]},
      {id:"c6.tile3", anim:["roulette"]},
      {id:"c6.tile4", anim:["roulette"]},
      {id:"c6.line",  anim:["sweep","wobble"]},
    ]},
  { card:"06", beat:"개인 카페",   dur:7000,
    text:"개인 카페가 71개, 비중 56%. 절반 넘게 차지하는 동네는 흔치 않아요. 아메리카노 평균 4,500원 — 스타벅스 톨 4,700원보다 살짝 아래입니다.",
    triggers:[
      {id:"c5.tile1", anim:["roulette","bounce"]},
      {id:"c5.tile2", anim:["roulette"]},
      {id:"c5.tile3", anim:["roulette","bounce","sparkle"]},
      {id:"c5.tile4", anim:["roulette"]},
      {id:"c5.top5",  anim:[]},
    ]},
  { card:"07", beat:"사람 흐름",   dur:7400,
    text:"유동인구 일평균 57만 명. 12~18시에 24%, 목요일이 17.8%로 가장 많습니다. 주중 비중이 77% — 직장 수요가 메인이라는 뜻이에요.",
    triggers:[
      {id:"c7.tile1", anim:["roulette","bounce","sparkle"]},
      {id:"c7.tile2", anim:["roulette","bounce"]},
      {id:"c7.tile3", anim:["roulette"]},
      {id:"c7.tile4", anim:["roulette"]},
      {id:"c7.hours", anim:["bounce"]},
      {id:"c7.days",  anim:["bounce"]},
      {id:"c7.donut", anim:["spin-in"]},
    ]},
  { card:"08", beat:"들어가는 비용", dur:7200,
    text:"들어가는 비용이 만만치 않습니다. 평당 월세 42만원, 권리금 1.8억 — 시도 평균 +114%. 15평 기준 총 창업비 약 2.1억으로 잡혀요.",
    triggers:[
      {id:"c8.tile1", anim:["roulette","glitch","bounce"]},
      {id:"c8.tile2", anim:["roulette"]},
      {id:"c8.tile3", anim:["roulette","bounce","glow"]},
      {id:"c8.tile4", anim:["roulette","flash"]},
    ]},
  { card:"09", beat:"기회 신호",   dur:6800,
    text:"기회 포인트입니다. 공실률 6.9% — 보통이지만 안정권. 12분기 추이가 5%대에서 6.9%로 살짝 올랐지만 강남 평균 6.4% 수준이라 큰 위협은 아니에요.",
    triggers:[
      {id:"c9.hero", anim:["roulette","bounce","glow"]},
      {id:"c9.line", anim:["sweep","wobble"]},
      {id:"c9.list", anim:[]},
    ]},
  { card:"10", beat:"배달 채널",   dur:7000,
    text:"배달도 봅시다. 객단가 20,851원, 월 배달 매출 1,420만 — 매장의 15% 정도. 12개월 주문건수가 420건에서 681건으로 +62%. 안전 노선으로 활용 가능해요.",
    triggers:[
      {id:"c10.tile1", anim:["roulette","bounce","sparkle"]},
      {id:"c10.tile2", anim:["roulette"]},
      {id:"c10.tile3", anim:["roulette","bounce"]},
      {id:"c10.tile4", anim:["roulette"]},
      {id:"c10.line",  anim:["sweep","wobble"]},
      {id:"c10.days",  anim:["bounce"]},
      {id:"c10.donut", anim:["spin-in"]},
    ]},
  { card:"11", beat:"분위기",     dur:7200,
    text:"SNS 분위기를 보면 긍정 비율 78% — 매우 좋은 동네입니다. 키워드는 강남카페, 분위기, 디저트맛집, 미팅장소 — 프리미엄 미팅 카페 결이 분명히 있어요.",
    triggers:[
      {id:"c11.tile1", anim:["roulette","bounce","glow"]},
      {id:"c11.tile2", anim:["roulette","flash"]},
      {id:"c11.tile3", anim:["roulette"]},
      {id:"c11.tile4", anim:["roulette"]},
      {id:"c11.cloud", anim:[]},
      {id:"c11.top5",  anim:[]},
    ]},
  { card:"12", beat:"날씨 영향",   dur:7000,
    text:"날씨도 챙깁니다. 비 오는 날 매출이 +14% — 직장인들이 카페로 피신하는 패턴. 폭염·폭설 때는 -22%까지 빠지지만 배달 채널이 완충해줍니다.",
    triggers:[
      {id:"c12.tile1", anim:["roulette","bounce"]},
      {id:"c12.tile2", anim:["roulette"]},
      {id:"c12.tile3", anim:["roulette","bounce"]},
      {id:"c12.tile4", anim:["roulette"]},
      {id:"c12.cal",   anim:[]},
    ]},
  { card:"13", beat:"5축 분해",   dur:7600,
    text:"이제 종합입니다. 5축 분해로 보면 시장·생존은 강한데 비용 부담에서 점수를 깎아 먹어요. 종합 53점 — 신중 검토 등급. 비싸지만 시장이 보장하는 자리라는 뜻입니다.",
    triggers:[
      {id:"c13.gauge", anim:["glitch","glow","sparkle"]},
      {id:"c13.kpi1",  anim:["roulette","bounce"]},
      {id:"c13.kpi2",  anim:["roulette"]},
      {id:"c13.kpi3",  anim:["roulette"]},
      {id:"c13.axes",  anim:["bounce"]},
    ]},
  { card:"14", beat:"최종 의견",   dur:8000,
    text:"최종 의견입니다. 5축 레이더 — 입지·매출·생존은 외곽까지 펼쳐졌고 비용은 안쪽에 머물러요. 의뢰인 자본 여력 보고 프리미엄이냐 안전이냐 두 갈래 중 하나로 결정하시면 됩니다.",
    triggers:[
      {id:"c14.score",  anim:["roulette","bounce","sparkle"]},
      {id:"c14.kpi1",   anim:["roulette","bounce"]},
      {id:"c14.kpi2",   anim:["roulette"]},
      {id:"c14.kpi3",   anim:["roulette"]},
      {id:"c14.radar",  anim:["sparkle","glow"]},
      {id:"c14.signal", anim:[]},
    ]},
];

/* ============================================================
   useDirectorPlayback — 14단계 자동 재생 + seq 트리거 발사
   ============================================================ */
function useDirectorPlayback(open) {
  const [step, setStep] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [seq, setSeq] = React.useState({});
  const total = DIRECTOR_SCRIPT.length;

  /* 모달 열릴 때마다 리셋 */
  React.useEffect(() => {
    if (!open) return;
    setStep(0); setPlaying(true); setSeq({});
  }, [open]);

  /* 단계 진입 시 트리거 발사 */
  React.useEffect(() => {
    if (!open) return;
    const cur = DIRECTOR_SCRIPT[step];
    if (!cur) return;
    setSeq(prev => {
      const next = { ...prev };
      (cur.triggers || []).forEach(t => {
        const entry = typeof t === "string" ? { id:t, anim:[] } : t;
        const old = next[entry.id] || { n:0, anim:[] };
        next[entry.id] = { n: old.n + 1, anim: entry.anim || [] };
      });
      return next;
    });
  }, [step, open]);

  /* 자동 진행 */
  React.useEffect(() => {
    if (!open || !playing) return;
    const dur = DIRECTOR_SCRIPT[step]?.dur || 7000;
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 < total) return s + 1;
        setPlaying(false);
        return s;
      });
    }, dur);
    return () => clearTimeout(t);
  }, [open, playing, step, total]);

  /* 다음/이전 시 트리거 재발사 */
  const refire = React.useCallback((i) => {
    const cur = DIRECTOR_SCRIPT[i];
    if (!cur) return;
    setSeq(prev => {
      const next = { ...prev };
      (cur.triggers || []).forEach(t => {
        const entry = typeof t === "string" ? { id:t, anim:[] } : t;
        const old = next[entry.id] || { n:0, anim:[] };
        next[entry.id] = { n: old.n + 1, anim: entry.anim || [] };
      });
      return next;
    });
  }, []);

  const next   = () => setStep(s => { const n = Math.min(total-1, s+1); refire(n); return n; });
  const prev   = () => setStep(s => { const n = Math.max(0,       s-1); refire(n); return n; });
  const toggle = () => setPlaying(p => !p);
  const goto   = (i) => { const n = Math.max(0, Math.min(total-1, i)); refire(n); setStep(n); };

  return { step, total, playing, seq, current: DIRECTOR_SCRIPT[step] || DIRECTOR_SCRIPT[0],
           next, prev, toggle, goto };
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

  if (!open) return null;

  const SeqCtx = window.SeqCtx;
  const cur = pb.current;
  const Comp = window[`Card${cur.card}`];
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
              {window.TypingText
                ? <window.TypingText text={cur.text} speedMs={30} on={pb.playing}/>
                : cur.text}
            </div>
          </div>

          <footer className="dm-side__foot">
            <div className="dm-progress">
              <div className="dm-progress__bar" style={{width:`${progress}%`}}></div>
              <div className="dm-progress__ticks">
                {DIRECTOR_SCRIPT.map((s, i) => (
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

        {/* 우측: 큰 카드 디스플레이 */}
        <main className="dm-stage" key={cur.card}>
          <div className="dm-stage__crumb">
            <span>{cur.card}</span>
            <span>·</span>
            <span>{cardInfo?.title}</span>
          </div>
          <div className="dm-stage__card">
            {Comp ? <Comp/> : <div style={{padding:32, color:"var(--fg-3)"}}>카드 {cur.card}</div>}
          </div>
        </main>
      </div>
    </SeqCtx.Provider>
  );
}

Object.assign(window, { DirectorModal, DIRECTOR_SCRIPT });
