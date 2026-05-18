/* director-script.jsx — 나레이션 + 시퀀서 (플레이버 조합)
   ─────────────────────────────────────────────────────────────
   triggers 엔트리:
     "abc.id"                           ← 기본 (anim 없음)
     { id: "abc.id", anim: ["roulette","sparkle"] }   ← 플레이버 지정
*/

const NARRATION = [
  // ───────────────────── 시장 탭 ─────────────────────
  { tab: "market", dur: 5200, beat: "오프닝",
    text: "자, 일단 자리부터 보겠습니다. 강남역 1번 출구 일대 — 반경 500m에 카페가 126개 있어요. 한국에서 카페 밀도 톱 5에 들어가는 자리입니다.",
    triggers: [
      { id: "m.cafeCount", anim: ["roulette","sparkle","bounce"] },
      { id: "m.cafeDonut", anim: ["spin-in","glow"] },
    ],
  },
  { tab: "market", dur: 4800, beat: "매출",
    text: "월매출 평균 9,121만 원. 강남구 평균 7,840만 원 대비 +16%. 시장 자체가 살아 있다는 뜻이에요.",
    triggers: [
      { id: "m.salesAvg",  anim: ["roulette","bounce","flash"] },
      { id: "m.salesLine", anim: ["sweep","wobble"] },
    ],
  },
  { tab: "market", dur: 4600, beat: "유동",
    text: "유동인구는 일평균 57만 명. 출근 8~9시, 퇴근 6~8시에 집중도가 가장 높아요.",
    triggers: [
      { id: "m.foot",    anim: ["roulette","glow"] },
      { id: "m.hourBar", anim: ["bounce"] },
    ],
  },
  { tab: "market", dur: 4900, beat: "임대",
    text: "그런데 평당 월세가 42만 원이에요. 최근 1년간 10.1% 올랐습니다. 강남 평균보다 빠른 속도예요.",
    triggers: [
      { id: "m.rent",      anim: ["glitch","bounce"] },
      { id: "m.rentLine",  anim: ["sweep","wobble"] },
      { id: "m.rentDelta", anim: ["flash"] },
    ],
  },

  // ───────────────────── 경쟁 탭 ─────────────────────
  { tab: "comp", dur: 5400, beat: "5축",
    text: "이제 경쟁입니다. 5축 종합 53점 — 보통 등급이에요. 입지·고객·매출은 강한데, 경쟁 강도와 진입 비용에서 점수를 깎아 먹습니다.",
    triggers: [
      { id: "c.radar", anim: ["sparkle"] },
      { id: "c.score", anim: ["glitch","roulette","bounce"] },
    ],
  },
  { tab: "comp", dur: 4800, beat: "유형",
    text: "프랜차이즈 47개, 개인 카페 79개. 개인 비중 56%로 절반을 넘어요. 프랜차이즈가 못 잡는 결이 있다는 뜻입니다.",
    triggers: [
      { id: "c.franchise", anim: ["roulette","bounce"] },
      { id: "c.indie",     anim: ["roulette","bounce","glow"] },
      { id: "c.compDonut", anim: ["spin-in"] },
    ],
  },
  { tab: "comp", dur: 4600, beat: "개폐업",
    text: "1년간 신규 5개, 폐업 8개. 강남구 폐업률 2.1% — 서울 평균 3.8%의 절반 수준이에요. 경쟁은 빡빡한데 살아남는 동네입니다.",
    triggers: [
      { id: "c.openClose", anim: ["bounce","flash"] },
      { id: "c.closeRate", anim: ["roulette","glow","sparkle"] },
    ],
  },

  // ───────────────────── 생존 탭 ─────────────────────
  { tab: "surv", dur: 5400, beat: "생존곡선",
    text: "정리하겠습니다. 1년 생존율 100%, 3년 71%, 5년 52%. 강남 평균보다 좋은 숫자예요. 살아남는다는 전제 하에 들어가는 자리입니다.",
    triggers: [
      { id: "s.g1", anim: ["grad-flow","glow","sparkle"] },
      { id: "s.g3", anim: ["grad-flow","bounce"] },
      { id: "s.g5", anim: ["grad-flow","flash"] },
    ],
  },
  { tab: "surv", dur: 5000, beat: "비용",
    text: "들어가는 비용은 만만치 않습니다. 권리금 1.8억 — 시도 평균 8,400만 대비 +114%. 15평 기준 총 창업비 약 2.1억으로 잡혀요.",
    triggers: [
      { id: "s.deposit", anim: ["glitch","roulette","flash"] },
      { id: "s.total",   anim: ["roulette","bounce","glow"] },
    ],
  },
  { tab: "surv", dur: 5200, beat: "회수",
    text: "회수 시나리오는 약 28개월. 강남 평균보다 약간 짧습니다. 프리미엄 또는 배달 안전 노선, 두 갈래 중 하나로 결정하시면 됩니다.",
    triggers: [
      { id: "s.recoveryLine", anim: ["sweep","wobble"] },
      { id: "s.recovery",     anim: ["roulette","bounce","sparkle"] },
    ],
  },
];

/* ─────────── useNarration: 시퀀서 훅 ───────────
   seq 값 형태: { [id]: { n: counter, anim: [...] } } */
function useNarration(script = NARRATION) {
  const [step, setStep] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [speed, setSpeed] = React.useState(1);
  const [subtitleOn, setSubtitleOn] = React.useState(true);
  const [seq, setSeq] = React.useState({});
  const total = script.length;
  const cur = script[step] || script[0];

  React.useEffect(() => {
    setSeq(prev => {
      const next = { ...prev };
      (cur.triggers || []).forEach(t => {
        const entry = typeof t === "string" ? { id: t, anim: [] } : t;
        const old = next[entry.id] || { n: 0, anim: [] };
        next[entry.id] = { n: old.n + 1, anim: entry.anim || [] };
      });
      return next;
    });
  }, [step]);

  React.useEffect(() => {
    if (!playing) return;
    const dur = (cur.dur || 4000) / speed;
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 < total) return s + 1;
        setPlaying(false);
        return s;
      });
    }, dur);
    return () => clearTimeout(t);
  }, [step, playing, speed]);

  const restart = () => { setSeq({}); setStep(0); setPlaying(true); };
  const next    = () => setStep(s => Math.min(total - 1, s + 1));
  const prev    = () => setStep(s => Math.max(0, s - 1));
  const goto    = (i) => setStep(Math.max(0, Math.min(total - 1, i)));
  const toggle  = () => setPlaying(p => !p);

  return {
    step, total, cur, seq, playing, speed, subtitleOn,
    setSpeed, setSubtitleOn,
    next, prev, goto, toggle, restart,
  };
}

Object.assign(window, { NARRATION, useNarration });
