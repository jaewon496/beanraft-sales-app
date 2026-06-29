/* tour.jsx — AI 디렉터 가이드 투어 모드 (14개 카드 순차 강조)
   ─────────────────────────────────────────────────────────────
   카드 1번부터 14번까지 순서대로 1개씩 spotlight,
   각 카드 진입 시 그 카드 전용 애니메이션 트리거 발사.

   triggers 항목:
     { id: "c1.cafeCount", anim: ["roulette","sparkle","bounce"] }
     | "c1.cafeCount"  ← 기본 (anim 없음)
*/

const TOUR_SCRIPT = [
  /* 01 상권 분석 — 큰 숫자 카운트업 + 도넛 회전 */
  { card: "01", beat: "상권 진단", dur: 7000,
    text: "자, 일단 자리부터 보겠습니다. 강남역 1번 출구 일대 — 반경 500m에 매장이 350개, 그 중 카페가 126개입니다. 한국에서 카페 밀도 톱 5에 들어가는 자리예요.",
    triggers: [
      { id: "c1.tile1", anim: ["roulette","bounce","sparkle"] },
      { id: "c1.tile2", anim: ["roulette","bounce"] },
      { id: "c1.tile3", anim: ["roulette","bounce"] },
      { id: "c1.tile4", anim: ["roulette","bounce"] },
      { id: "c1.donut", anim: ["spin-in","glow"] },
    ],
  },
  /* 02 고객 분석 — 막대 4개 스프링 바운스 + 키워드 칩 순차 */
  { card: "02", beat: "고객 결", dur: 6800,
    text: "고객 결을 보겠습니다. 30대가 34%로 가장 두텁고, 재방문율이 38% — 자주 오는 동네라는 뜻이에요. 라이프스타일 키워드도 미팅·SNS·퇴근 후로 매우 명확합니다.",
    triggers: [
      { id: "c2.tile1", anim: ["roulette","bounce"] },
      { id: "c2.tile2", anim: ["roulette"] },
      { id: "c2.tile3", anim: ["roulette","bounce"] },
      { id: "c2.tile4", anim: ["roulette"] },
      { id: "c2.bars",  anim: ["bounce"] },
      { id: "c2.chips", anim: [] },
    ],
  },
  /* 03 상권 변화 — 게이지 3개 채움 */
  { card: "03", beat: "변화 흐름", dur: 6800,
    text: "변화 추이입니다. 1년 생존율 89%, 3년 71%, 5년 52% — 모두 강남 평균 상회. 5년 전 108개에서 지금 126개로 +16.7%, 시장이 천천히 살이 붙고 있어요.",
    triggers: [
      { id: "c3.g1", anim: ["grad-flow","glow"] },
      { id: "c3.g3", anim: ["grad-flow","bounce"] },
      { id: "c3.g5", anim: ["grad-flow","flash"] },
      { id: "c3.tiles", anim: [] },
    ],
  },
  /* 04 프랜차이즈 — 브랜드 TOP 7 하나씩 팝업 */
  { card: "04", beat: "경쟁자 명단", dur: 6800,
    text: "프랜차이즈를 봅시다. 200미터 안에 스타벅스 11점이 들어와 있어요. 이디야, 투썸, 메가, 폴바셋까지 — 빅 5가 다 들어와 있는 자리입니다.",
    triggers: [
      { id: "c4.tiles",  anim: [] },
      { id: "c4.top7",   anim: [] },
      { id: "c4.bar3",   anim: ["bounce"] },
    ],
  },
  /* 05 개인 카페 — 가격 카운트업 + TOP 5 순차 */
  { card: "05", beat: "개인 카페", dur: 6800,
    text: "그런데 개인 카페가 71개로 비중 56%. 절반 넘게 차지하는 동네는 흔치 않아요. 아메리카노 평균 4,500원으로 스타벅스 톨 4,700원보다 살짝 아래입니다.",
    triggers: [
      { id: "c5.tile1", anim: ["roulette","bounce"] },
      { id: "c5.tile2", anim: ["roulette"] },
      { id: "c5.tile3", anim: ["roulette","bounce","sparkle"] },
      { id: "c5.tile4", anim: ["roulette"] },
      { id: "c5.top5",  anim: [] },
    ],
  },
  /* 06 매출 분석 — 13개월 라인 + 큰 숫자 룰렛 */
  { card: "06", beat: "매출 회수", dur: 7200,
    text: "회수 가능성입니다. 월매출 평균 9,121만 원 — 강남구 평균 7,840만 대비 +16.3%. 13개월 추이 보면 매월 +1~2% 꾸준히 오르고 있어요. 살아있는 시장입니다.",
    triggers: [
      { id: "c6.tile1", anim: ["roulette","bounce","sparkle"] },
      { id: "c6.tile2", anim: ["roulette","bounce"] },
      { id: "c6.tile3", anim: ["roulette"] },
      { id: "c6.tile4", anim: ["roulette"] },
      { id: "c6.line",  anim: ["sweep","wobble"] },
    ],
  },
  /* 07 유동인구 — 시간대 막대 6 + 요일 막대 7 순차 */
  { card: "07", beat: "사람 흐름", dur: 7200,
    text: "유동인구 일평균 57만 명. 12시~18시에 24%, 목요일이 17.8%로 가장 많습니다. 주중 비중이 77%, 직장 수요가 메인이라는 뜻이에요.",
    triggers: [
      { id: "c7.tile1", anim: ["roulette","bounce","sparkle"] },
      { id: "c7.tile2", anim: ["roulette","bounce"] },
      { id: "c7.tile3", anim: ["roulette"] },
      { id: "c7.tile4", anim: ["roulette"] },
      { id: "c7.hours", anim: ["bounce"] },
      { id: "c7.days",  anim: ["bounce"] },
      { id: "c7.donut", anim: ["spin-in"] },
    ],
  },
  /* 08 임대/창업 — KPI 페이드인 + 슬라이더 채움 */
  { card: "08", beat: "들어가는 비용", dur: 7000,
    text: "들어가는 비용이 만만치 않습니다. 평당 월세 42만 원, 권리금 1.8억 — 시도 평균 대비 +114%. 초기 진입 비용이 평균보다 높은 편의 입지예요.",
    triggers: [
      { id: "c8.tile1", anim: ["roulette","glitch","bounce"] },
      { id: "c8.tile2", anim: ["roulette"] },
      { id: "c8.tile3", anim: ["roulette","bounce","glow"] },
      { id: "c8.tile4", anim: ["roulette","flash"] },
      { id: "c8.kosis", anim: [] },
      { id: "c8.slider", anim: [] },
    ],
  },
  /* 09 카페 기회 — 분기 라인 + 색상 그라데이션 */
  { card: "09", beat: "기회 신호", dur: 6800,
    text: "그래도 기회 포인트가 있어요. 공실률 6.9% — 보통이지만 안정권입니다. 12분기 추이가 5%대에서 6.9%로 살짝 올랐지만 강남 평균 6.4% 수준이라 큰 위협은 아니에요.",
    triggers: [
      { id: "c9.hero", anim: ["roulette","bounce","glow"] },
      { id: "c9.line", anim: ["sweep","wobble"] },
      { id: "c9.list", anim: [] },
    ],
  },
  /* 10 배달 객단가 — 12개월 추이 + 비교 카운트업 */
  { card: "10", beat: "배달 채널", dur: 6800,
    text: "배달도 봅시다. 객단가 20,851원, 월 배달 매출 1,420만 — 매장의 15% 정도 됩니다. 12개월 주문건수가 420건에서 681건으로 +62%. 안전 노선으로 충분히 활용 가능해요.",
    triggers: [
      { id: "c10.tile1", anim: ["roulette","bounce","sparkle"] },
      { id: "c10.tile2", anim: ["roulette"] },
      { id: "c10.tile3", anim: ["roulette","bounce"] },
      { id: "c10.tile4", anim: ["roulette"] },
      { id: "c10.line",  anim: ["sweep","wobble"] },
      { id: "c10.days",  anim: ["bounce"] },
      { id: "c10.donut", anim: ["spin-in"] },
    ],
  },
  /* 11 SNS 트렌드 — 키워드 한 단어씩 + 도넛 회전 */
  { card: "11", beat: "분위기", dur: 7000,
    text: "SNS 분위기를 보면, 긍정 비율 78% — 매우 좋은 동네입니다. 키워드는 '강남카페', '분위기', '디저트맛집', '미팅장소' — 프리미엄 미팅 카페 결이 분명히 있어요.",
    triggers: [
      { id: "c11.tile1", anim: ["roulette","bounce","glow"] },
      { id: "c11.tile2", anim: ["roulette","flash"] },
      { id: "c11.tile3", anim: ["roulette"] },
      { id: "c11.tile4", anim: ["roulette"] },
      { id: "c11.cloud", anim: [] },
      { id: "c11.top5",  anim: [] },
    ],
  },
  /* 12 날씨 영향 — 캘린더 12개월 순차 + 기온 카운트업 */
  { card: "12", beat: "날씨 영향", dur: 6800,
    text: "날씨도 챙겨봅시다. 비 오는 날 매출이 +14%, 직장인들이 카페로 피신하는 패턴. 폭염·폭설 때는 -22%까지 빠지지만 배달 채널이 완충해줍니다.",
    triggers: [
      { id: "c12.tile1", anim: ["roulette","bounce"] },
      { id: "c12.tile2", anim: ["roulette"] },
      { id: "c12.tile3", anim: ["roulette","bounce"] },
      { id: "c12.tile4", anim: ["roulette"] },
      { id: "c12.cal",   anim: [] },
      { id: "c12.box",   anim: [] },
    ],
  },
  /* 13 상권 경쟁 — 투자 대비 수익률 게이지 + 5축 분해 막대 */
  { card: "13", beat: "투자 대비 수익률", dur: 7200,
    text: "이제 종합입니다. 투자 대비 수익률로 보면 수익성·생존은 받쳐주는데 투자 회수에서 점수를 깎아 먹어요. 비싼 자리라 회수가 길다는 뜻 — 콘셉트로 객단가를 끌어올리면 만회됩니다.",
    triggers: [
      { id: "c13.gauge", anim: ["glitch","glow","sparkle"] },
      { id: "c13.kpi",   anim: ["roulette","bounce"] },
      { id: "c13.axes",  anim: ["bounce"] },
    ],
  },
  /* 14 AI 종합 — 수익률 레이더 + 종합 점수 + 파티클 */
  { card: "14", beat: "최종 의견", dur: 7500,
    text: "최종 의견입니다. 수익률 레이더 — 수익성·생존은 외곽까지 펼쳐졌고 투자 회수는 안쪽에 머물러요. 의뢰인 자본 여력 보고 — 프리미엄이냐 안전이냐, 두 갈래 중 하나로 결정하시면 됩니다.",
    triggers: [
      { id: "c14.score",  anim: ["roulette","bounce","sparkle"] },
      { id: "c14.kpi",    anim: ["roulette","bounce"] },
      { id: "c14.radar",  anim: ["sparkle","glow"] },
      { id: "c14.signal", anim: [] },
    ],
  },
];

/* useTour — 투어 상태 + seq 출력 (App-level SeqCtx에 공급) */
function useTour() {
  const [active, setActive] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [seq, setSeq] = React.useState({});
  const total = TOUR_SCRIPT.length;

  // 트리거 발사 (step 변경 / active 전환 시)
  React.useEffect(() => {
    if (!active) return;
    const cur = TOUR_SCRIPT[step];
    if (!cur) return;
    setSeq(prev => {
      const next = { ...prev };
      (cur.triggers || []).forEach(t => {
        const entry = typeof t === "string" ? { id: t, anim: [] } : t;
        const old = next[entry.id] || { n: 0, anim: [] };
        next[entry.id] = { n: old.n + 1, anim: entry.anim || [] };
      });
      return next;
    });
  }, [step, active]);

  // 자동 진행
  React.useEffect(() => {
    if (!active || !playing) return;
    const dur = (TOUR_SCRIPT[step]?.dur || 7000);
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 < total) return s + 1;
        setPlaying(false);
        return s;
      });
    }, dur);
    return () => clearTimeout(t);
  }, [active, playing, step, total]);

  const start = () => { setActive(true); setStep(0); setPlaying(true); setSeq({}); };
  const stop  = () => { setActive(false); setPlaying(false); };
  const next  = () => setStep(s => Math.min(total - 1, s + 1));
  const prev  = () => setStep(s => Math.max(0, s - 1));
  const goto  = (i) => setStep(Math.max(0, Math.min(total - 1, i)));
  const toggle = () => setPlaying(p => !p);

  const current = TOUR_SCRIPT[step] || TOUR_SCRIPT[0];
  return { active, step, total, playing, current, seq, start, stop, next, prev, goto, toggle };
}

function TourBar({ tour, onScrollTo }) {
  if (!tour.active) return null;
  const c = tour.current;
  const cardInfo = window.CARDS.find(x => x.n === c.card);
  const groupInfo = window.GROUPS.find(g => g.cards.includes(c.card));
  const Avatar = window.DirectorAvatar;

  React.useEffect(() => {
    if (tour.active) onScrollTo?.(c.card);
  }, [tour.active, tour.step]);

  const progress = ((tour.step + 1) / tour.total) * 100;

  return (
    <div className="bc-tour">
      <div className="bc-tour__progress"><div style={{width: `${progress}%`}}></div></div>

      <div className="bc-tour__row">
        <div className="bc-tour__avatar">
          {Avatar && <Avatar playing={tour.playing}/>}
        </div>

        <div className="bc-tour__center">
          <div className="bc-tour__crumb">
            <span className="bc-tour__group">{groupInfo?.label}</span>
            <span className="bc-tour__sep">·</span>
            <span className="bc-tour__num">{c.card}</span>
            <span className="bc-tour__card">{cardInfo?.title}</span>
            <span className="bc-tour__sep">·</span>
            <span className="bc-tour__beat">{c.beat}</span>
            <span className="bc-tour__step">{tour.step + 1} / {tour.total}</span>
          </div>
          <div className="bc-tour__text">
            {window.TypingText
              ? <window.TypingText text={c.text} speedMs={28} on={tour.playing}/>
              : c.text}
          </div>
        </div>

        <div className="bc-tour__controls">
          <button onClick={tour.prev} disabled={tour.step === 0} title="이전 (←)"><i className="ph ph-skip-back"></i></button>
          <button onClick={tour.toggle} className="primary" title={tour.playing ? "일시정지" : "재생"}>
            <i className={tour.playing ? "ph-fill ph-pause" : "ph-fill ph-play"}></i>
          </button>
          <button onClick={tour.next} disabled={tour.step >= tour.total - 1} title="다음 (→)"><i className="ph ph-skip-forward"></i></button>
          <button onClick={tour.stop} title="투어 종료 (Esc)"><i className="ph ph-x"></i></button>
        </div>
      </div>

      <div className="bc-tour__dots">
        {TOUR_SCRIPT.map((s, i) => (
          <button
            key={i}
            className={"bc-tour__dot " + (i === tour.step ? "on" : i < tour.step ? "done" : "")}
            onClick={() => tour.goto(i)}
            title={`${s.card} · ${s.beat}`}
          ></button>
        ))}
      </div>
    </div>
  );
}

function useTourKeys(tour) {
  React.useEffect(() => {
    if (!tour.active) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") tour.stop();
      else if (e.key === "ArrowRight") tour.next();
      else if (e.key === "ArrowLeft") tour.prev();
      else if (e.key === " ") { e.preventDefault(); tour.toggle(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tour.active, tour.step]);
}

Object.assign(window, { TOUR_SCRIPT, useTour, useTourKeys, TourBar });
