/* shared.jsx — Sidebar, TopBar, CardShell, StatTile, charts
   SnowUI Dashboard tone, sales-mode dark. */

const { useState, useEffect, useRef, useContext, createContext } = React;

/* ============================================================
   14 cards — 카테고리 순서대로 1-14 연속 번호
   identity(n): 컴포넌트(window.Card${n}) 식별자 — 기존 ID 유지
   badge:      화면에 노출되는 순번 (01..14)
   ============================================================ */
const CARDS = [
  { n: "01", badge: "01", title: "상권 분석",        icon: "ph-storefront" },
  { n: "03", badge: "02", title: "상권 변화 추이",   icon: "ph-trend-up" },
  { n: "07", badge: "03", title: "유동인구",          icon: "ph-person-simple-walk" },
  { n: "08", badge: "04", title: "임대 / 창업",       icon: "ph-key" },
  { n: "02", badge: "05", title: "고객 분석",         icon: "ph-users" },
  { n: "11", badge: "06", title: "SNS 트렌드",        icon: "ph-hash" },
  { n: "12", badge: "07", title: "날씨 영향",         icon: "ph-cloud-sun" },
  { n: "04", badge: "08", title: "프랜차이즈 현황",   icon: "ph-buildings" },
  { n: "06", badge: "09", title: "개인 카페",         icon: "ph-coffee" },
  { n: "13", badge: "10", title: "상권 경쟁 분석",    icon: "ph-target" },
  { n: "05", badge: "11", title: "매출 분석",         icon: "ph-currency-krw" },
  { n: "09", badge: "12", title: "카페 기회",         icon: "ph-lightbulb" },
  { n: "10", badge: "13", title: "배달 객단가",       icon: "ph-moped" },
  { n: "14", badge: "14", title: "AI 종합 분석",      icon: "ph-sparkle" },
];

/* 컴포넌트 id(n) → 화면 badge 매핑 (CardShell, Director 가 참조) */
const CARD_BADGE_MAP = Object.fromEntries(CARDS.map(c => [c.n, c.badge]));

/* ============================================================
   5 카테고리 그룹 (PRD-aligned 분류)
   ============================================================ */
const GROUPS = [
  { id: "loc",  label: "입지 / 시장",  icon: "ph-map-trifold",    cards: ["01","03","07","08"] },
  { id: "cust", label: "고객 / 수요",  icon: "ph-users-three",    cards: ["02","11","12"] },
  { id: "comp", label: "경쟁",         icon: "ph-target",         cards: ["04","06","13"] },
  { id: "rev",  label: "매출 / 기회",  icon: "ph-chart-line-up",  cards: ["05","09","10"] },
  { id: "ai",   label: "AI 종합",      icon: "ph-sparkle",        cards: ["14"] },
];

function groupOf(cardN) {
  return GROUPS.find(g => g.cards.includes(cardN));
}

/* ============================================================
   CardCtx — 펼침 상태 + 투어 spotlight 공유
   ============================================================ */
const CardCtx = createContext({
  expanded: null,       // Set<string> | null  (null = 모두 펼침)
  toggle: () => {},
  tourActive: null,     // current spotlighted card "NN"
});

/* ============================================================
   Sidebar — 5 categories. Clicking a category collapses sidebar
   and filters main area to that category's cards.
   ============================================================ */
function Sidebar({ active, onNav, onStartTour, onCategoryClick, onShowAll, filterCategory, isAll, address = "", radius }) {
  const radiusLabel = (typeof radius === "number" && radius > 0) ? `${radius}m` : "500m";
  return (
    <aside className="bc-sb">
      <div className="bc-sb__brand">
        <span className="bc-sb__logo"><img src={window.__resources?.beancraftLogo || "assets/beancraft-logo-cropped.png"} alt="BEANCRAFT"/></span>
      </div>
      <div style={{padding:"4px 10px 14px"}}>
        <div style={{fontSize:15, color:"var(--fg-4)", letterSpacing:"0.06em", marginBottom:4}}>검색</div>
        <div style={{fontSize:15, color:"var(--fg)", padding:"3px 0", fontWeight:500, wordBreak:"keep-all"}}>{(typeof address === "string" && address.trim()) || "검색 결과"}</div>
        <div style={{fontSize:15, color:"var(--fg-4)", marginBottom:10}}>{`반경 ${radiusLabel} · 결과 리포트`}</div>
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

      <div
        className={"bc-cat bc-cat--all" + (isAll ? " filtering" : "")}
        onClick={() => onShowAll?.()}
        title="전체 보고서 보기"
        style={{marginBottom:4}}
      >
        <span className="bc-cat__icon"><i className="ph ph-stack"></i></span>
        <span className="bc-cat__label">전체 보고서</span>
        <span className="bc-cat__count">{CARDS.length}</span>
        <i className={"ph " + (isAll ? "ph-check" : "ph-caret-right") + " bc-cat__chev"}></i>
      </div>

      <div className="bc-sb__group-title">카테고리별 보기 · 5개</div>

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
function TopBar({ address = "", crumbCur = "결과 리포트", onToggleSidebar, sidebarOpen, filterLabel, onClearFilter, radius }) {
  const radiusLabel = (typeof radius === "number" && radius > 0) ? `${radius}m` : "500m";
  return (
    <div className="bc-tb">
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
        <span style={{fontWeight:600}}>{(typeof address === "string" && address.trim()) || "검색 결과"}</span>
        <span style={{color:"var(--fg-3)"}}>{`· 반경 ${radiusLabel}`}</span>
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
   Card shell — header + body + footer (sources)
   ============================================================ */
function CardShell({ n, title, sub, date = "2026.05.13", sources = [], headerRight, children, id }) {
  const key = id || n;
  const badge = (window.CARD_BADGE_MAP && window.CARD_BADGE_MAP[n]) || n;
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
        </div>
      </header>
      <div className="bc-card__body">
        {children}
      </div>
    </section>
  );
}

/* ============================================================
   StatTile — SnowUI pastel + dark text + big value + delta arrow
   Uses count-up animation on mount; if `id` given, re-animates on tour trigger.
   Flavor classes (sparkle/glow/float/hot/roulette/bounce/glitch) come from seq.anim.
   ============================================================ */
function StatTile({ tone = "blue", label, value, unit, delta, deltaPositive = true, hero, id, accent = false, sub, deltaPrefixDisabled = false }) {
  const fx = id ? (window.useFx?.(id) ?? { n: 0, anim: [] }) : { n: 0, anim: [] };
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
    <div className={cls} data-fx-id={id} style={{position:"relative"}}>
      <div className="label">{label}</div>
      <div className="row">
        <span className={"value " + (hero ? "value-hero" : "")}>
          <CountUp value={value} id={id}/>{unit && <span className="unit">{unit}</span>}
        </span>
        {delta && (
          <span className={"delta " + (deltaPositive ? "up" : "down")}>
            {(deltaPrefixDisabled ? "" : (deltaPositive ? "+" : "")) + delta}% {deltaPositive ? "↗" : "↘"}
          </span>
        )}
      </div>
      {sub && <div style={{fontSize:13, color:"var(--matte-fg-3)", marginTop:6, fontWeight:500}}>{sub}</div>}
      {/* sparkle 효과 — 제거됨 */}
    </div>
  );
}

/* CountUp: numeric string counts up. With `id`, watches tour trigger and
   re-runs animation each time, applying roulette/bounce/glitch/flash flavors. */
function CountUp({ value, duration = 1500, id }) {
  const fx = id ? (window.useFx?.(id) ?? { n: 0, anim: [] }) : { n: 0, anim: [] };
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
   Dark inline data box (for source/data displays inside card body)
   ============================================================ */
function Box({ label, value, unit, sub, src, tone }) {
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

Object.assign(window, { CARDS, GROUPS, CARD_BADGE_MAP, groupOf, CardCtx, Sidebar, TopBar, CardShell, StatTile, CountUp, Box });
