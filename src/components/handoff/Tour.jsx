/* Tour.jsx — AI 디렉터 가이드 투어 모드 (14개 카드 순차 강조) */

import React, { useState, useEffect } from 'react';
import { CARDS, GROUPS } from './Shared.jsx';
import { TypingText } from './director/DirectorAnim.jsx';
import { DirectorAvatar } from './director/Director.jsx';

export const TOUR_SCRIPT = [
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
  { card: "02", beat: "고객 결", dur: 6800,
    text: "고객 결을 보겠습니다. 30대가 34%로 가장 두텁고, 재방문율이 38% — 자주 오는 동네라는 뜻이에요. 라이프스타일 키워드도 미팅·SNS·퇴근 후로 매우 명확합니다.",
    triggers: [
      { id: "c2.tile1", anim: ["roulette","bounce"] },
      { id: "c2.tile2", anim: ["roulette"] },
      { id: "c2.tile3", anim: ["roulette","bounce"] },
      { id: "c2.tile4", anim: ["roulette"] },
    ],
  },
  { card: "09", beat: "기회 신호", dur: 6800,
    text: "그래도 기회 포인트가 있어요. 공실률 6.9% — 보통이지만 안정권입니다. 12분기 추이가 5%대에서 6.9%로 살짝 올랐지만 강남 평균 6.4% 수준이라 큰 위협은 아니에요.",
    triggers: [
      { id: "c9.hero", anim: ["roulette","bounce","glow"] },
      { id: "c9.line", anim: ["sweep","wobble"] },
      { id: "c9.list", anim: [] },
    ],
  },
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
  { card: "13", beat: "5축 분해", dur: 7200,
    text: "이제 종합입니다. 5축 분해로 보면 시장·생존은 강한데 비용 부담에서 점수를 깎아 먹어요. 종합 53점 — 신중 검토 등급. 비싸지만 시장이 보장하는 자리라는 뜻입니다.",
    triggers: [
      { id: "c13.gauge", anim: ["glitch","glow","sparkle"] },
      { id: "c13.kpi",   anim: ["roulette","bounce"] },
      { id: "c13.axes",  anim: ["bounce"] },
    ],
  },
  { card: "14", beat: "최종 의견", dur: 7500,
    text: "최종 의견입니다. 5축 레이더 — 입지·매출·생존은 외곽까지 펼쳐졌고 비용은 안쪽에 머물러요. 의뢰인 자본 여력 보고 — 프리미엄이냐 안전이냐, 두 갈래 중 하나로 결정하시면 됩니다.",
    triggers: [
      { id: "c14.score",  anim: ["roulette","bounce","sparkle"] },
      { id: "c14.kpi",    anim: ["roulette","bounce"] },
      { id: "c14.radar",  anim: ["sparkle","glow"] },
      { id: "c14.signal", anim: [] },
    ],
  },
];

export function useTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [seq, setSeq] = useState({});
  const total = TOUR_SCRIPT.length;

  useEffect(() => {
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

  useEffect(() => {
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

export function TourBar({ tour, onScrollTo }) {
  const c = tour.current;

  useEffect(() => {
    if (tour.active) onScrollTo?.(c?.card);
  }, [tour.active, tour.step]);

  if (!tour.active) return null;

  const cardInfo = CARDS.find(x => x.n === c.card);
  const groupInfo = GROUPS.find(g => g.cards.includes(c.card));
  const progress = ((tour.step + 1) / tour.total) * 100;

  return (
    <div className="bc-tour">
      <div className="bc-tour__progress"><div style={{width: `${progress}%`}}></div></div>

      <div className="bc-tour__row">
        <div className="bc-tour__avatar">
          <DirectorAvatar playing={tour.playing}/>
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
            <TypingText text={c.text} speedMs={28} on={tour.playing}/>
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

export function useTourKeys(tour) {
  useEffect(() => {
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
