/* Shared.jsx — Sidebar, TopBar, CardShell, StatTile, CountUp, Box */

import React, { useState, useEffect, createContext } from 'react';
import { useFx, Sparkles } from './director/DirectorAnim.jsx';

/* ============================================================
   14 cards — 카테고리 순서대로 1-14 연속 번호
   ============================================================ */
// [2026-05-17] badge = n으로 정렬 (시안 번호와 1:1 일치, dataMapper 순서 = 화면 순서 = 시안 번호)
// 사이드바 표시 순서도 시안 번호 순서대로 정리
export const CARDS = [
  { n: "01", badge: "01", title: "상권 분석",        icon: "ph-storefront" },
  { n: "02", badge: "02", title: "고객 분석",         icon: "ph-users" },
  { n: "03", badge: "03", title: "상권 변화 추이",   icon: "ph-trend-up" },
  { n: "04", badge: "04", title: "프랜차이즈 현황",   icon: "ph-buildings" },
  { n: "05", badge: "05", title: "개인 카페",         icon: "ph-coffee" },
  { n: "06", badge: "06", title: "매출 분석",         icon: "ph-currency-krw" },
  { n: "07", badge: "07", title: "유동인구",          icon: "ph-person-simple-walk" },
  { n: "08", badge: "08", title: "임대 / 창업",       icon: "ph-key" },
  { n: "09", badge: "09", title: "카페 기회",         icon: "ph-lightbulb" },
  { n: "10", badge: "10", title: "배달 객단가",       icon: "ph-moped" },
  { n: "11", badge: "11", title: "SNS 트렌드",        icon: "ph-hash" },
  { n: "12", badge: "12", title: "날씨 영향",         icon: "ph-cloud-sun" },
  { n: "13", badge: "13", title: "상권 경쟁 분석",    icon: "ph-target" },
  { n: "14", badge: "14", title: "AI 종합 분석",      icon: "ph-sparkle" },
];

export const CARD_BADGE_MAP = Object.fromEntries(CARDS.map(c => [c.n, c.badge]));

// [2026-05-17] n 값 재정렬에 맞춰 cards 배열 갱신
// 매출은 이제 "06", 개인카페는 이제 "05" (시안 번호 swap)
export const GROUPS = [
  { id: "loc",  label: "입지 / 시장",  icon: "ph-map-trifold",    cards: ["01","03","07","08"] },
  { id: "cust", label: "고객 / 수요",  icon: "ph-users-three",    cards: ["02","11","12"] },
  { id: "comp", label: "경쟁",         icon: "ph-target",         cards: ["04","05","13"] },
  { id: "rev",  label: "매출 / 기회",  icon: "ph-chart-line-up",  cards: ["06","09","10"] },
  { id: "ai",   label: "AI 종합",      icon: "ph-sparkle",        cards: ["14"] },
];

export function groupOf(cardN) {
  return GROUPS.find(g => g.cards.includes(cardN));
}

/* ============================================================
   CardCtx — 펼침 상태 + 투어 spotlight 공유
   ============================================================ */
export const CardCtx = createContext({
  expanded: null,
  toggle: () => {},
  tourActive: null,
});

/* ============================================================
   Sidebar
   ============================================================ */
export function Sidebar({ active, onNav, onStartTour, onCategoryClick, filterCategory }) {
  return (
    <aside className="bc-sb">
      <div className="bc-sb__brand">
        <span className="bc-sb__logo"><img src={(typeof window !== "undefined" && window.__resources?.beancraftLogo) || "assets/beancraft-logo.webp"} alt="BEANCRAFT"/></span>
      </div>
      <div style={{padding:"4px 10px 14px"}}>
        <div style={{fontSize:15, color:"var(--fg-4)", letterSpacing:"0.06em", marginBottom:4}}>검색</div>
        <div style={{fontSize:15, color:"var(--fg)", padding:"3px 0", fontWeight:500}}>강남역 1번 출구</div>
        <div style={{fontSize:15, color:"var(--fg-4)", marginBottom:10}}>반경 500m · 결과 리포트</div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("bc:research"))}
          style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            width:"100%",
            background:"rgba(255,255,255,0.04)",
            border:"1px solid var(--matte-line)",
            borderRadius:10,
            padding:"9px 12px",
            color:"var(--matte-fg)",
            fontSize:13,
            fontWeight:600,
            cursor:"pointer",
            letterSpacing:"-0.005em",
            transition:"all 160ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "var(--matte-line-2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "var(--matte-line)"; }}
        >
          <i className="ph ph-magnifying-glass" style={{fontSize:14}}></i>
          다시 검색하기
        </button>
      </div>

      <div className="bc-sb__group-title">분석 카드 · 5개 카테고리</div>

      <div style={{display:"flex", flexDirection:"column", gap:2}}>
        {GROUPS.map(g => {
          const isFilter = filterCategory === g.id;
          const hasActive = g.cards.includes(active);
          return (
            <div key={g.id}>
              <div
                className={"bc-cat" + (isFilter ? " filtering" : (hasActive ? " active" : ""))}
                onClick={() => onCategoryClick?.(g.id)}
                title={isFilter ? `${g.label} 필터 해제` : `${g.label}만 보기`}
              >
                <span className="bc-cat__icon"><i className={`ph ${g.icon}`}></i></span>
                <span className="bc-cat__label">{g.label}</span>
                <span className="bc-cat__count">{g.cards.length}</span>
                <i className={"ph " + (isFilter ? "ph-check" : "ph-caret-right") + " bc-cat__chev"}></i>
              </div>
              <div className="bc-cat-sub">
                {g.cards.map(n => {
                  const c = CARDS.find(c => c.n === n);
                  const isActive = active === n;
                  return (
                    <div
                      key={n}
                      data-card-nav={n}
                      ref={isActive ? (el => {
                        if (el && el.scrollIntoView) {
                          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                        }
                      }) : undefined}
                      className={"bc-cat-sub__item " + (isActive ? "active" : "")}
                      onClick={(e) => { e.stopPropagation(); onNav?.(n); }}
                    >
                      <span className="bc-cat-sub__num">{c?.badge || n}</span>
                      <span>{c?.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {onStartTour && (
        <button className="bc-sb__tour-cta" onClick={onStartTour}>
          <i className="ph-fill ph-sparkle"></i>
          <span>AI 디렉터</span>
        </button>
      )}
    </aside>
  );
}

/* ============================================================
   TopBar
   ============================================================ */
export function TopBar({ address = "강남역 1번 출구", crumbCur = "결과 리포트", onToggleSidebar, sidebarOpen, filterLabel, onClearFilter }) {
  return (
    <div className="bc-tb bc-topbar">
      <button
        className={"bc-tb__hamb " + (sidebarOpen ? "" : "active")}
        onClick={onToggleSidebar}
        title={sidebarOpen ? "사이드바 접기" : "사이드바 펼치기"}
      >
        <i className="ph ph-list"></i>
      </button>
      <div className="bc-tb__crumb">
        <i className="ph ph-squares-four" style={{fontSize:16}}></i>
        <span>대시보드</span>
        <span className="sep">/</span>
        <span>의뢰인 영업모드</span>
        <span className="sep">/</span>
        <span className="cur">{crumbCur}</span>
        {filterLabel && (
          <>
            <span className="sep">/</span>
            <span className="bc-tb__filter">
              <i className="ph ph-funnel-simple" style={{fontSize:15}}></i>
              {filterLabel}
              <button className="bc-tb__filter-x" onClick={onClearFilter} title="필터 해제">
                <i className="ph ph-x"></i>
              </button>
            </span>
          </>
        )}
      </div>
      <div className="bc-tb__addr">
        <span className="bc-tb__pin"></span>
        <span style={{fontWeight:600}}>{address}</span>
        <span style={{color:"var(--fg-3)"}}>· 반경 500m</span>
      </div>
      <div className="bc-tb__spacer"></div>
      <button className="bc-tb__icon-btn" title="필터"><i className="ph ph-funnel"></i></button>
      <button className="bc-tb__icon-btn" title="히스토리"><i className="ph ph-clock-counter-clockwise"></i></button>
      <button className="bc-tb__icon-btn" title="알림"><i className="ph ph-bell"></i></button>
      <button className="bc-tb__icon-btn" title="공유"><i className="ph ph-share-network"></i></button>
    </div>
  );
}

/* ============================================================
   CardShell
   ============================================================ */
export function CardShell({ n, title, sub, date = "2026.05.13", sources = [], headerRight, children, id, cardNumber }) {
  // cardNumber prop이 있으면 무조건 그 값을 라벨로 표시 (시안 번호 강제)
  // 없으면 n을 그대로 사용 (CARD_BADGE_MAP 변환 제거 - 시안 번호와 1:1 일치)
  const badge = cardNumber || n;
  const key = id || n;
  return (
    <section className="bc-card" id={`card-${key}`} data-card={key} data-screen-label={`${badge} ${title}`}>
      <header className="bc-card__header">
        <div className="bc-card__title-row">
          <div className="bc-card__num">{badge}</div>
          <div>
            <div className="bc-card__title">{title}</div>
            {sub && <div className="bc-card__sub">{sub}</div>}
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          {headerRight}
          <div className="bc-card__date">{date} 기준</div>
        </div>
      </header>
      <div className="bc-card__body">
        {children}
      </div>
    </section>
  );
}

/* ============================================================
   StatTile
   ============================================================ */
export function StatTile({ tone = "blue", label, value, unit, delta, deltaPositive = true, hero, id, accent = false }) {
  const fx = id ? useFx(id) : { n: 0, anim: [] };
  const [hot, setHot] = useState(false);
  useEffect(() => {
    if (fx.n === 0) return;
    setHot(true);
    const t = setTimeout(() => setHot(false), 1600);
    return () => clearTimeout(t);
  }, [fx.n]);
  const has = (a) => fx.anim.includes(a);
  let cls = `bc-tile tone-${tone}`;
  if (accent) cls += " accent";
  if (hot) cls += " hot";
  if (has("glow")) cls += " glow";
  if (has("float")) cls += " float";
  return (
    <div className={cls} style={{position:"relative"}}>
      <div className="label">{label}</div>
      <div className="row">
        <span className={"value " + (hero ? "value-hero" : "")}>
          <CountUp value={value} id={id}/>{unit && <span className="unit">{unit}</span>}
        </span>
        {delta && (
          <span className={"delta " + (deltaPositive ? "up" : "down")}>
            {(deltaPositive ? "+" : "") + delta}% {deltaPositive ? "↗" : "↘"}
          </span>
        )}
      </div>
      {has("sparkle") && <Sparkles id={id} count={7} radius={48}/>}
    </div>
  );
}

/* ============================================================
   CountUp
   ============================================================ */
export function CountUp({ value, duration = 1500, id }) {
  const fx = id ? useFx(id) : { n: 0, anim: [] };
  const [shown, setShown] = useState(value);
  const [bounce, setBounce] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (typeof value !== "string" && typeof value !== "number") { setShown(value); return; }
    const str = String(value);
    const m = str.match(/^([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) { setShown(value); return; }
    const target = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(target) || target === 0) { setShown(value); return; }
    const tail = m[2];
    const dec = m[1].includes(".") ? (m[1].split(".")[1].length) : 0;
    const has = (a) => fx.anim.includes(a);
    let raf, t0, cleanup = () => {};
    const fmt = (n) => (dec > 0 ? n.toFixed(dec) : Math.floor(n).toLocaleString()) + tail;
    const fireFinal = () => {
      if (has("bounce")) { setBounce(true); setTimeout(() => setBounce(false), 400); }
      if (has("flash"))  { setFlash(true);  setTimeout(() => setFlash(false),  650); }
    };
    const start = () => {
      if (has("roulette") && id) {
        const rollMs = 500;
        const upMs = 700;
        const rollEnd = performance.now() + rollMs;
        const rollTick = () => {
          if (performance.now() < rollEnd) {
            setShown(fmt(Math.random() * target * 1.6));
            raf = requestAnimationFrame(rollTick);
          } else {
            t0 = performance.now();
            raf = requestAnimationFrame(step);
          }
        };
        const step = (t) => {
          const p = Math.min(1, (t - t0) / upMs);
          const eased = 1 - Math.pow(1 - p, 3);
          setShown(fmt(target * eased));
          if (p < 1) raf = requestAnimationFrame(step);
          else fireFinal();
        };
        raf = requestAnimationFrame(rollTick);
      } else {
        const step = (t) => {
          if (!t0) t0 = t;
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setShown(fmt(target * eased));
          if (p < 1) raf = requestAnimationFrame(step);
          else fireFinal();
        };
        raf = requestAnimationFrame(step);
      }
      cleanup = () => cancelAnimationFrame(raf);
    };
    if (id && fx.n > 0 && has("glitch")) {
      setGlitch(true);
      setTimeout(() => { setGlitch(false); start(); }, 300);
    } else {
      start();
    }
    return () => cleanup();
  }, [value, duration, id ? fx.n : 0]);

  let cls = "";
  if (bounce) cls += " dr-cu bounce";
  if (glitch) cls += " dr-cu glitch";
  if (flash)  cls += " dr-cu flash";
  return <span className={cls}>{shown}</span>;
}

/* ============================================================
   Box — dark inline data box
   ============================================================ */
export function Box({ label, value, unit, sub, src, tone }) {
  const color = tone === "good" ? "var(--st-good)" : tone === "bad" ? "var(--st-bad)" : tone === "mid" ? "var(--st-mid)" : "var(--fg)";
  return (
    <div className="bc-box">
      <div className="label">{label}</div>
      <div className="value" style={{color}}>
        <CountUp value={value}/>{unit && <span className="unit">{unit}</span>}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
