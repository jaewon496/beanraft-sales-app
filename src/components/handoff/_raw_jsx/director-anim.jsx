/* director-anim.jsx — 라이브 데이터 애니메이션 (플레이버 시스템)
   ─────────────────────────────────────────────────────────────
   트리거 스키마 (NARRATION → useNarration → SeqCtx):
     seq[id] = { n: 누적카운터, anim: ["roulette","sparkle",...] }

   플레이버 카탈로그:
     roulette     — 슬롯머신 카운트업 (큰 KPI)
     bounce       — 도착 시 scale 1.0→1.1→1.0 오버슈트
     sparkle      — 도착 시 빛 입자 5-7개 방출
     glow         — 호흡하듯 펄싱 헤일로 (2초)
     sweep        — 라인 그어진 후 빛 스윕 (0.8초)
     wobble       — 데이터 포인트 정착 후 sin 흔들림 (라인 차트)
     glitch       — 카운트업 직전 0.3초 글리치
     flash        — 색상 깜빡 2회
     spin-in      — 도넛 등장 시 360° 회전 페이드인
     grad-flow    — 게이지 채울 때 색 그라데이션 흐름
     float        — 패널 부유 (3초 4px sin)
*/

const SeqCtx = React.createContext({ seq: {}, tab: "market", speed: 1 });

/* ───────── hooks ───────── */
function useFx(id) {
  const { seq } = React.useContext(SeqCtx);
  const e = seq[id];
  return e ? { n: e.n, anim: e.anim || [] } : { n: 0, anim: [] };
}
function useTrigger(id) { return useFx(id).n; }   // 하위 호환
function useSpeed() {
  const { speed } = React.useContext(SeqCtx);
  return speed || 1;
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) { const c = 1.70158; return 1 + (c+1) * Math.pow(t-1, 3) + c * Math.pow(t-1, 2); }
const HAS = (arr, ...flags) => flags.some(f => arr.includes(f));

/* ============================================================
   Sparkles — 빛 입자 N개, trigger 시 0.6-0.9초 페이드아웃
   ============================================================ */
function Sparkles({ id, count = 6, color = "#FFE873", radius = 60 }) {
  const fx = useFx(id);
  const [tok, setTok] = React.useState(0);
  React.useEffect(() => {
    if (!fx.anim.includes("sparkle")) return;
    if (fx.n === 0) return;
    setTok(t => t + 1);
  }, [fx.n]);
  if (tok === 0) return null;
  return (
    <div className="dr-sparkles" key={tok}>
      {Array.from({length: count}).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + (tok * 0.7);
        const r = radius + (i % 2 === 0 ? 12 : -6);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const dly = (i * 30) + "ms";
        return (
          <span
            key={i}
            className="dr-sparkles__p"
            style={{
              "--x": `${x}px`, "--y": `${y}px`,
              "--c": color, animationDelay: dly,
            }}
          ></span>
        );
      })}
    </div>
  );
}

/* ============================================================
   DrLiveCountUp — 카운트업 (+ roulette, glitch, bounce, flash 지원)
   ============================================================ */
function DrLiveCountUp({ id, value, duration = 1100, suffix = "", prefix = "", decimals = 0 }) {
  const fx = useFx(id);
  const speed = useSpeed();
  const target = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  const [shown, setShown] = React.useState(fx.n > 0 ? 0 : target);
  const [bounce, setBounce] = React.useState(false);
  const [glitch, setGlitch] = React.useState(false);
  const [flash, setFlash] = React.useState(false);

  React.useEffect(() => {
    if (fx.n === 0) return;
    const hasRoulette = fx.anim.includes("roulette");
    const hasGlitch = fx.anim.includes("glitch");
    const hasBounce = fx.anim.includes("bounce");
    const hasFlash = fx.anim.includes("flash");
    let cleanup = () => {};
    const start = () => {
      const dur = duration / speed;
      let raf, t0;
      if (hasRoulette) {
        // 0.5s 동안 무작위 → 0.6s 동안 카운트업
        const rollMs = 500 / speed;
        const upMs = 700 / speed;
        const rollEnd = performance.now() + rollMs;
        const rollTick = () => {
          if (performance.now() < rollEnd) {
            const rnd = Math.random() * target * 1.6;
            setShown(rnd);
            raf = requestAnimationFrame(rollTick);
          } else {
            t0 = performance.now();
            raf = requestAnimationFrame(step);
          }
        };
        const step = (t) => {
          const p = Math.min(1, (t - t0) / upMs);
          setShown(target * easeOutCubic(p));
          if (p < 1) raf = requestAnimationFrame(step);
          else fireFinal();
        };
        raf = requestAnimationFrame(rollTick);
      } else {
        const step = (t) => {
          if (!t0) t0 = t;
          const p = Math.min(1, (t - t0) / dur);
          setShown(target * easeOutCubic(p));
          if (p < 1) raf = requestAnimationFrame(step);
          else fireFinal();
        };
        raf = requestAnimationFrame(step);
      }
      cleanup = () => cancelAnimationFrame(raf);
    };
    const fireFinal = () => {
      if (hasBounce) { setBounce(true); setTimeout(() => setBounce(false), 380); }
      if (hasFlash) {
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
      }
    };
    if (hasGlitch) {
      setGlitch(true);
      setTimeout(() => { setGlitch(false); start(); }, 300 / speed);
    } else {
      start();
    }
    return () => cleanup();
  }, [fx.n]);

  const display = decimals > 0 ? shown.toFixed(decimals) : Math.round(shown).toLocaleString();
  let cls = "dr-cu";
  if (bounce) cls += " bounce";
  if (glitch) cls += " glitch";
  if (flash)  cls += " flash";

  return (
    <span
      className={cls}
      data-text={`${prefix}${display}${suffix}`}
      style={{fontVariantNumeric:"tabular-nums", display:"inline-flex"}}
    >
      {prefix}{display}{suffix}
    </span>
  );
}

/* ============================================================
   DrLineChart — pen-draw + sweep + wobble
   ============================================================ */
function DrLineChart({ id, data, color = "#7DBBFF", w = 320, h = 100, label, valueLabel, fill = true, showDots = false }) {
  const fx = useFx(id);
  const speed = useSpeed();
  const ref = React.useRef(null);
  const [drawn, setDrawn] = React.useState(fx.n === 0);

  React.useEffect(() => {
    if (!ref.current) return;
    const path = ref.current.querySelector(".dr-line__path");
    const area = ref.current.querySelector(".dr-line__area");
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    if (fx.n === 0) { path.style.strokeDashoffset = 0; if (area) area.style.opacity = 1; setDrawn(true); return; }
    setDrawn(false);
    path.style.strokeDashoffset = len;
    path.style.transition = "none";
    if (area) { area.style.opacity = 0; area.style.transition = "none"; }
    path.getBoundingClientRect();
    const dur = (1500 / speed) + "ms";
    path.style.transition = `stroke-dashoffset ${dur} cubic-bezier(.2,.7,.2,1)`;
    path.style.strokeDashoffset = "0";
    if (area) { area.style.transition = `opacity ${dur} cubic-bezier(.2,.7,.2,1)`; area.style.opacity = 1; }
    const t = setTimeout(() => setDrawn(true), 1500 / speed);
    return () => clearTimeout(t);
  }, [fx.n]);

  if (!data || data.length === 0) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const pad = 8;
  const xStep = (w - pad * 2) / (data.length - 1);
  const yScale = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const pts = data.map((v, i) => [pad + i * xStep, yScale(v)]);
  const dPath = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const dArea = dPath + ` L ${pts[pts.length-1][0]} ${h-pad} L ${pts[0][0]} ${h-pad} Z`;

  const wobble = drawn && fx.anim.includes("wobble");
  const sweep  = drawn && fx.anim.includes("sweep");

  return (
    <div className={"dr-line " + (wobble ? "wobble " : "")} ref={ref}>
      {(label || valueLabel) && (
        <div className="dr-line__head">
          {label && <span className="dr-line__label">{label}</span>}
          {valueLabel && <span className="dr-line__val">{valueLabel}</span>}
        </div>
      )}
      <div style={{position:"relative"}}>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block"}}>
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {fill && <path className="dr-line__area" d={dArea} fill={`url(#grad-${id})`}/>}
          <path className="dr-line__path" d={dPath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          {(showDots || wobble) && pts.map((p, i) => (
            <circle
              key={i}
              cx={p[0]} cy={p[1]} r="2.4"
              fill={color}
              className={wobble ? "dr-line__dot wob" : "dr-line__dot"}
              style={{animationDelay: `${i * 80}ms`}}
            />
          ))}
        </svg>
        {sweep && <span className="dr-line__sweep"></span>}
      </div>
    </div>
  );
}

/* ============================================================
   DrBarChart — stagger grow + bounce (spring overshoot)
   ============================================================ */
function DrBarChart({ id, data, labels, color = "#7DBBFF", h = 110, label, highlightIdx = -1 }) {
  const fx = useFx(id);
  const speed = useSpeed();
  const max = Math.max(...data, 1);
  const bounce = fx.anim.includes("bounce");

  return (
    <div className="dr-bar">
      {label && <div className="dr-bar__label">{label}</div>}
      <div className="dr-bar__row" style={{height: h, "--bar-color": color}}>
        {data.map((v, i) => {
          const pct = (v / max) * 100;
          const delay = fx.n === 0 ? 0 : (i * (60 / speed));
          const dur = fx.n === 0 ? 0 : (700 / speed);
          const animName = bounce ? "dr-bar-grow-bounce" : "dr-bar-grow";
          return (
            <div key={i} className={"dr-bar__col" + (i === highlightIdx ? " hi" : "")}>
              <div
                className="dr-bar__fill"
                style={{
                  height: fx.n === 0 ? `${pct}%` : 0,
                  animation: fx.n > 0 ? `${animName} ${dur}ms ${delay}ms cubic-bezier(.2,.7,.2,1) forwards` : "none",
                  "--target": `${pct}%`,
                }}
              ></div>
              {labels && <div className="dr-bar__tick">{labels[i]}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   DrDonut — clockwise fill + spin-in + glow 옵션
   ============================================================ */
function DrDonut({ id, data, size = 140, label, centerLabel, centerValue }) {
  const fx = useFx(id);
  const speed = useSpeed();
  const ref = React.useRef(null);
  const wrapRef = React.useRef(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const spinIn = fx.anim.includes("spin-in");
  const glow = fx.anim.includes("glow");

  React.useEffect(() => {
    if (!ref.current) return;
    const segs = ref.current.querySelectorAll(".dr-donut__seg");
    let cumulative = 0;
    segs.forEach((seg, i) => {
      const v = data[i].value;
      const pct = v / total;
      const segLen = c * pct;
      seg.style.strokeDasharray = `${segLen} ${c}`;
      seg.style.strokeDashoffset = fx.n === 0 ? 0 : segLen;
      seg.style.transformOrigin = `${size/2}px ${size/2}px`;
      seg.style.transform = `rotate(${(cumulative / total) * 360 - 90}deg)`;
      cumulative += v;
      if (fx.n > 0) {
        seg.getBoundingClientRect();
        const dur = (900 / speed) + "ms";
        const delay = (i * (120 / speed)) + "ms";
        seg.style.transition = `stroke-dashoffset ${dur} ${delay} cubic-bezier(.2,.7,.2,1)`;
        seg.style.strokeDashoffset = 0;
      }
    });
    // spin-in on wrapper
    if (wrapRef.current && fx.n > 0 && spinIn) {
      const wrap = wrapRef.current;
      wrap.style.transition = "none";
      wrap.style.transform = "rotate(-180deg) scale(0.7)";
      wrap.style.opacity = "0";
      wrap.getBoundingClientRect();
      const dur = (800 / speed) + "ms";
      wrap.style.transition = `transform ${dur} cubic-bezier(.2,.7,.2,1), opacity ${dur} cubic-bezier(.2,.7,.2,1)`;
      wrap.style.transform = "rotate(0) scale(1)";
      wrap.style.opacity = "1";
    }
  }, [fx.n]);

  return (
    <div className="dr-donut">
      {label && <div className="dr-donut__label">{label}</div>}
      <div
        ref={wrapRef}
        className={"dr-donut__wrap " + (glow ? "glow" : "")}
        style={{width:size, height:size, position:"relative"}}
      >
        <svg ref={ref} width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12"/>
          {data.map((d, i) => (
            <circle key={i} className="dr-donut__seg" cx={size/2} cy={size/2} r={r} fill="none" stroke={d.color} strokeWidth="12" strokeLinecap="butt"/>
          ))}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="dr-donut__center">
            {centerValue && <div className="dr-donut__cv">{centerValue}</div>}
            {centerLabel && <div className="dr-donut__cl">{centerLabel}</div>}
          </div>
        )}
      </div>
      <div className="dr-donut__legend">
        {data.map((d, i) => (
          <div key={i} className="dr-donut__leg">
            <span className="sw" style={{background: d.color}}></span>
            <span className="lab">{d.label}</span>
            <span className="val">{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   DrGauge — 0→% + grad-flow (red→yellow→green sweep) + glow
   ============================================================ */
function DrGauge({ id, value, max = 100, label, size = 160, thresholds = [30, 60] }) {
  const fx = useFx(id);
  const speed = useSpeed();
  const [v, setV] = React.useState(fx.n > 0 ? 0 : value);
  const gradFlow = fx.anim.includes("grad-flow");
  const glow = fx.anim.includes("glow");

  React.useEffect(() => {
    if (fx.n === 0) return;
    setV(0);
    const dur = 1100 / speed;
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setV(value * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fx.n]);

  const pct = v / max;
  const color = v < thresholds[0] ? "#EF4444"
              : v < thresholds[1] ? "#F59E0B"
              : "#10B981";

  const r = size / 2 - 14;
  const cx = size / 2, cy = size / 2;
  const startA = Math.PI, endA = 2 * Math.PI;
  const cur = startA + (endA - startA) * pct;
  const trackD = describeArc(cx, cy, r, startA, endA);
  const fillD  = describeArc(cx, cy, r, startA, cur);
  const gradId = `gg-${id}`;

  return (
    <div className={"dr-gauge " + (glow ? "glow" : "")}>
      <svg width={size} height={size/2 + 18} viewBox={`0 0 ${size} ${size/2 + 18}`}>
        {gradFlow && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#EF4444"/>
              <stop offset="50%" stopColor="#F59E0B"/>
              <stop offset="100%" stopColor="#10B981"/>
            </linearGradient>
          </defs>
        )}
        <path d={trackD} stroke="rgba(255,255,255,0.08)" strokeWidth="14" fill="none" strokeLinecap="round"/>
        <path
          d={fillD}
          stroke={gradFlow ? `url(#${gradId})` : color}
          strokeWidth="14" fill="none" strokeLinecap="round"
          style={{transition: "stroke 0.3s var(--ease)"}}
        />
      </svg>
      <div className="dr-gauge__center">
        <div className="dr-gauge__val" style={{color: gradFlow ? color : color}}>{Math.round(v)}<span className="u">%</span></div>
        {label && <div className="dr-gauge__lab">{label}</div>}
      </div>
    </div>
  );
}
function describeArc(cx, cy, r, startA, endA) {
  if (Math.abs(endA - startA) < 0.001) {
    const p = [cx + r * Math.cos(startA), cy + r * Math.sin(startA)];
    return `M ${p[0]} ${p[1]}`;
  }
  const s = [cx + r * Math.cos(startA), cy + r * Math.sin(startA)];
  const e = [cx + r * Math.cos(endA),   cy + r * Math.sin(endA)];
  const large = Math.abs(endA - startA) > Math.PI ? 1 : 0;
  return `M ${s[0]} ${s[1]} A ${r} ${r} 0 ${large} 1 ${e[0]} ${e[1]}`;
}

/* ============================================================
   DrRadar — 폴리곤 펼침 + 외곽 sparkle
   ============================================================ */
function DrRadar({ id, data, size = 240, color = "#7DBBFF", label }) {
  const fx = useFx(id);
  const speed = useSpeed();
  const [progress, setProgress] = React.useState(fx.n > 0 ? 0 : 1);
  const [particles, setParticles] = React.useState(0);

  React.useEffect(() => {
    if (fx.n === 0) return;
    setProgress(0);
    const dur = 1200 / speed;
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setProgress(easeOutBack(p));
      if (p < 1) raf = requestAnimationFrame(step);
      else if (fx.anim.includes("sparkle")) setParticles(c => c + 1);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fx.n]);

  const cx = size/2, cy = size/2;
  const r = size/2 - 28;
  const n = data.length;
  const axes = data.map((d, i) => {
    const a = -Math.PI/2 + i * 2*Math.PI / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), axis: d.axis, value: d.value, a };
  });
  const pts = data.map((d, i) => {
    const a = axes[i].a;
    const rv = r * (d.value / 100) * Math.max(0.001, progress);
    return [cx + rv * Math.cos(a), cy + rv * Math.sin(a)];
  });
  const poly = pts.map(p => `${p[0]},${p[1]}`).join(" ");

  return (
    <div className="dr-radar" style={{position:"relative"}}>
      {label && <div className="dr-radar__label">{label}</div>}
      <svg width={size} height={size}>
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <polygon key={i}
            points={axes.map(a => `${cx + (a.x-cx)*f},${cy + (a.y-cy)*f}`).join(" ")}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
        ))}
        {axes.map((a, i) => <line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>)}
        <polygon points={poly} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="2"/>
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color}/>)}
        {axes.map((a, i) => {
          const lx = cx + (r + 14) * Math.cos(a.a);
          const ly = cy + (r + 14) * Math.sin(a.a);
          return <text key={i} x={lx} y={ly} fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-sans)">{a.axis}</text>;
        })}
      </svg>
      {particles > 0 && (
        <div key={particles} className="dr-radar__sparks">
          {pts.map((p, i) => (
            <span key={i} className="dr-radar__spark"
              style={{
                left: p[0], top: p[1],
                animationDelay: `${i * 40}ms`,
              }}
            ></span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   DrPulse — wrapper, color pulse
   ============================================================ */
function DrPulse({ id, color = "#7DBBFF", children, className = "" }) {
  const fx = useFx(id);
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (fx.n === 0) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 1200);
    return () => clearTimeout(t);
  }, [fx.n]);
  return (
    <div className={"dr-pulse " + (on ? "on " : "") + className} style={{"--pulse": color}}>
      {children}
    </div>
  );
}

/* ============================================================
   DrKpiTile — KPI 카드, anim 플레이버 종합 적용
   plus: sparkle / glow / bounce / hot ring
   ============================================================ */
function DrKpiTile({ id, label, value, suffix, prefix, decimals, delta, deltaPositive, tone = "blue", src, hero }) {
  const fx = useFx(id);
  const [hi, setHi] = React.useState(false);
  React.useEffect(() => {
    if (fx.n === 0) return;
    setHi(true);
    const t = setTimeout(() => setHi(false), 1600);
    return () => clearTimeout(t);
  }, [fx.n]);

  const glow = fx.anim.includes("glow");
  const float = fx.anim.includes("float");
  const sparkle = fx.anim.includes("sparkle");

  let cls = "dr-kpi tone-" + tone;
  if (hi) cls += " hot";
  if (glow) cls += " glow";
  if (float) cls += " float";

  return (
    <div className={cls} style={{position:"relative"}}>
      <div className="dr-kpi__label">{label}</div>
      <div className="dr-kpi__row">
        <div className={"dr-kpi__value " + (hero ? "hero" : "")}>
          <DrLiveCountUp id={id} value={value} suffix={suffix} prefix={prefix} decimals={decimals}/>
        </div>
        {delta != null && (
          <div className={"dr-kpi__delta " + (deltaPositive ? "up" : "down")}>
            {deltaPositive ? "+" : ""}{delta}%
            <i className={"ph " + (deltaPositive ? "ph-arrow-up-right" : "ph-arrow-down-right")}></i>
          </div>
        )}
      </div>
      {src && <div className="dr-kpi__src">{src}</div>}
      {sparkle && <Sparkles id={id} count={7} radius={48}/>}
    </div>
  );
}

/* ============================================================
   TypingText — 글자 단위 타이핑 자막
   ============================================================ */
function TypingText({ text, speedMs = 22, on = true }) {
  const [shown, setShown] = React.useState(on ? "" : text);
  React.useEffect(() => {
    if (!on) { setShown(text); return; }
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speedMs);
    return () => clearInterval(id);
  }, [text, on, speedMs]);
  return (
    <span className="dr-typing">
      {shown}
      <span className="dr-typing__caret">▍</span>
    </span>
  );
}

/* ============================================================
   DrStagger — 자식들을 트리거마다 순차 팝업 (리스트/칩/캘린더 등)
   ============================================================ */
function DrStagger({ id, children, delay = 80, anim = "pop", className = "", style = {} }) {
  const fx = useFx(id);
  return (
    <div
      key={`stag-${fx.n}`}
      className={`dr-stagger dr-stagger--${anim} ${className}`}
      style={{ ...style, "--dr-delay": `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   DrFader — 트리거 시 단순 페이드인 (KPI 페이드인 등)
   ============================================================ */
function DrFader({ id, children, className = "", style = {} }) {
  const fx = useFx(id);
  return (
    <div key={`fade-${fx.n}`} className={`dr-fader ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ============================================================
   DrTween — value를 트리거 시 from→to로 부드럽게 보간 (슬라이더 등)
   children은 함수: (v) => JSX
   ============================================================ */
function DrTween({ id, from = 0, to, duration = 1100, children }) {
  const fx = useFx(id);
  const speed = useSpeed();
  const [v, setV] = React.useState(fx.n > 0 ? from : to);
  React.useEffect(() => {
    if (fx.n === 0) return;
    let raf, t0;
    const dur = duration / speed;
    const step = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      setV(from + (to - from) * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fx.n]);
  return children(v);
}

Object.assign(window, {
  SeqCtx, useFx, useTrigger, useSpeed,
  DrLiveCountUp, DrLineChart, DrBarChart, DrDonut, DrGauge, DrRadar, DrPulse, DrKpiTile,
  Sparkles, TypingText, DrStagger, DrFader, DrTween,
});
