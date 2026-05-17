/* Charts.jsx — SnowUI-styled chart primitives
   Donut, Line, Bars, BarRow, Radar, ScoreGauge */

import React, { useState, useEffect } from 'react';
import { useFx, useTrigger } from './director/DirectorAnim.jsx';

/* ----- Donut ----- */
export function Donut({ segments, size = 130, thickness = 18, centerLabel, centerSub, animate = true, id }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);
  const trig = id ? useTrigger(id) : 0;
  const fx = id ? useFx(id) : { n: 0, anim: [] };
  const has = (a) => fx.anim.includes(a);
  const [mounted, setMounted] = useState(!animate);
  const [spinKey, setSpinKey] = useState(0);
  useEffect(() => {
    if (!animate) { setMounted(true); return; }
    setMounted(false);
    if (id && trig > 0 && has("spin-in")) setSpinKey(k => k + 1);
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, [animate, trig]);
  let off = 0;
  const wrapCls = (id && has("glow")) ? "bc-donut-wrap glow" : "bc-donut-wrap";
  return (
    <div className={wrapCls} style={{position:"relative", width:size, height:size}}>
      <svg
        key={spinKey}
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{transform:"rotate(-90deg)", animation: (id && has("spin-in") && trig > 0) ? "bc-donut-spin 0.85s cubic-bezier(.2,.7,.2,1) both" : "none"}}
      >
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness}/>
        {segments.map((s, i) => {
          const len = mounted ? (s.value / total) * C : 0;
          const dash = `${len} ${C}`;
          const offset = -off;
          off += (s.value / total) * C + 2;
          return (
            <circle
              key={i}
              cx={size/2} cy={size/2} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              style={{transition:"stroke-dasharray 0.9s var(--ease)"}}
            />
          );
        })}
      </svg>
      {centerLabel && (
        <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center"}}>
          <div>
            <div style={{fontSize:28, fontWeight:700, color:"var(--fg)", lineHeight:1, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>{centerLabel}</div>
            {centerSub && <div style={{fontSize:15, color:"var(--fg-2)", marginTop:6, fontWeight:500}}>{centerSub}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----- Donut legend ----- */
export function DonutLegend({ segments }) {
  return (
    <ul style={{margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:10}}>
      {segments.map((s, i) => (
        <li key={i} style={{display:"grid", gridTemplateColumns:"10px 1fr auto", gap:10, alignItems:"center", fontSize:15}}>
          <span style={{width:8, height:8, borderRadius:9999, background:s.color}}></span>
          <span style={{color:"var(--fg-2)"}}>{s.label}</span>
          <span style={{color:"var(--fg)", fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{s.text || `${s.value}%`}</span>
        </li>
      ))}
    </ul>
  );
}

/* ----- LineChart ----- */
export function LineChart({ data, comparison, width = 580, height = 180, yLabels, color = "var(--fg)", id, fluid = true }) {
  const trig = id ? useTrigger(id) : 0;
  const fx = id ? useFx(id) : { n: 0, anim: [] };
  const has = (a) => fx.anim.includes(a);
  const all = comparison ? [...data, ...comparison] : data;
  const rawMax = Math.max(...all);
  const rawMin = Math.min(...all);
  const span = rawMax - rawMin || 1;
  const pad = span * 0.08;
  const max = rawMax + pad;
  const min = Math.max(0, rawMin - pad);
  const range = max - min || 1;
  const padL = 44, padR = 12, padT = 16, padB = 28;
  const W = width - padL - padR;
  const H = height - padT - padB;
  const step = W / (data.length - 1);
  const yPos = (v) => padT + H - ((v - min) / range) * H;
  const pts = data.map((v, i) => [padL + i * step, yPos(v)]);
  const pathFor = (arr) => {
    if (arr.length < 2) return "";
    let d = `M${arr[0][0]},${arr[0][1]}`;
    for (let i = 0; i < arr.length - 1; i++) {
      const [x1, y1] = arr[i];
      const [x2, y2] = arr[i+1];
      const mx = (x1 + x2) / 2;
      d += ` C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    }
    return d;
  };
  const ticVals = yLabels || (() => {
    const stepV = range / 4;
    return Array.from({length: 5}, (_, i) => +(min + stepV * i).toFixed(0));
  })();
  const svgProps = fluid
    ? { width: "100%", height: height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", style: {display:"block"} }
    : { width, height, viewBox: `0 0 ${width} ${height}` };

  return (
    <div style={{position:"relative", width:"100%"}} key={trig}>
      <svg {...svgProps}>
        {ticVals.map((y, i) => {
          const py = yPos(y);
          if (py < padT - 4 || py > height - padB + 4) return null;
          return (
            <g key={i}>
              <line x1={padL} y1={py} x2={width-padR} y2={py} stroke="rgba(255,255,255,0.05)"/>
              <text x={padL - 10} y={py + 4} fontSize="13" fill="var(--matte-fg-3)" textAnchor="end" style={{fontVariantNumeric:"tabular-nums"}}>{y}</text>
            </g>
          );
        })}
        {comparison && (
          <path d={pathFor(comparison.map((v,i)=>[padL + i*step, yPos(v)]))} fill="none" stroke="#A3A3A3" strokeWidth="1.8" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" opacity="0.7"/>
        )}
        <path d={pathFor(pts)} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{strokeDasharray:1200, strokeDashoffset:0, animation:"bc-spin-in 1.2s var(--ease) both", "--c":"1200", "--target":"0"}}/>
      </svg>
      <span style={{
        position:"absolute",
        left: `${(pts[pts.length-1][0] / width) * 100}%`,
        top: `${(pts[pts.length-1][1] / height) * 100}%`,
        width: 9, height: 9, borderRadius: "50%",
        background: color,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}></span>
      {id && has("sweep") && trig > 0 && <span className="bc-line__sweep" key={`sw-${trig}`}></span>}
    </div>
  );
}

/* ----- Sparkline ----- */
export function Sparkline({ data, width = 220, height = 50, color = "#FFFFFF", id, fluid = true }) {
  const trig = id ? useTrigger(id) : 0;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 8) - 4]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i+1];
    const mx = (x1 + x2) / 2;
    d += ` C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  const svgProps = fluid
    ? { width: "100%", height: height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", style: { display: "block" } }
    : { width, height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" };
  return (
    <svg {...svgProps} key={trig}>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity="0.10"/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{strokeDasharray:1000, animation:"bc-spin-in 1.1s var(--ease) both", "--c":"1000", "--target":"0"}}/>
    </svg>
  );
}

/* ----- VBars ----- */
export function VBars({ items, height = 160, accent, color, barW = 22, gap = 14, id }) {
  const trig = id ? useTrigger(id) : 0;
  const fx = id ? useFx(id) : { n: 0, anim: [] };
  const has = (a) => fx.anim.includes(a);
  const max = Math.max(...items.map(i => i.v));
  const baseColor = color || "#FFFFFF";
  return (
    <div style={{display:"flex", alignItems:"flex-end", gap, height: height + 22, padding:"0 4px"}} key={trig}>
      {items.map((it, i) => {
        const h = (it.v / max) * height;
        const isAcc = accent === i;
        const animName = has("bounce") ? "bc-vbar-grow-bounce" : "bc-fade-in";
        return (
          <div key={i} style={{display:"flex", flexDirection:"column", alignItems:"center", flex:1, gap:6}}>
            <div style={{
              width: barW,
              maxWidth: "100%",
              height: h,
              borderRadius: 9999,
              background: isAcc ? "#5478C9" : baseColor,
              opacity: isAcc ? 1 : 0.9,
              animation: `${animName} 0.7s var(--ease) ${i*0.08}s both`,
              "--target-h": h + "px",
            }}></div>
            <div style={{fontSize:15, color: isAcc ? "#5478C9" : "var(--matte-fg-2)", fontWeight: isAcc ? 700 : 500}}>{it.l}</div>
            {it.v != null && <div style={{fontSize:15, color: isAcc ? "var(--matte-fg)" : "var(--matte-fg-3)", fontWeight: isAcc ? 600 : 500, fontVariantNumeric:"tabular-nums"}}>{it.t || `${it.v}%`}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ----- BarRow ----- */
export function BarRow({ label, value, max, color, suffix, accent, id }) {
  const trig = id ? useTrigger(id) : 0;
  const target = Math.min(100, (value / max) * 100);
  const [w, setW] = useState(target);
  useEffect(() => {
    if (!id || trig === 0) return;
    setW(0);
    const t = setTimeout(() => setW(target), 60);
    return () => clearTimeout(t);
  }, [trig]);
  const fill = color || (accent ? "#5478C9" : "#FFFFFF");
  return (
    <div style={{display:"grid", gridTemplateColumns:"110px 1fr 70px", gap:12, alignItems:"center", padding:"6px 0"}}>
      <div style={{fontSize:15, color: accent ? "var(--matte-fg)" : "var(--matte-fg-2)", fontWeight: accent ? 700 : 500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{label}</div>
      <div className="bc-bar" style={{height:10, background:"rgba(255,255,255,0.05)"}}><div style={{width:`${w}%`, background: fill}}></div></div>
      <div style={{textAlign:"right", fontSize:15, color: accent ? "#5478C9" : "var(--matte-fg)", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{value}{suffix}</div>
    </div>
  );
}

/* ----- ScoreGauge ----- */
export function ScoreGauge({ value, max = 100, size = 280, label, id, accent = false }) {
  const trig = id ? useTrigger(id) : 0;
  const fx = id ? useFx(id) : { n: 0, anim: [] };
  const has = (a) => fx.anim.includes(a);

  const VBW = 240, VBH = 160;
  const cx = 120, cy = 110;
  const r  = 92;
  const startA = Math.PI, endA = 2 * Math.PI;
  const pct = Math.min(1, value / max);
  const arc = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [sx, sy] = arc(startA);
  const [ex, ey] = arc(endA);
  const arcPath = `M${sx},${sy} A${r},${r} 0 0 1 ${ex},${ey}`;
  const arcLen = Math.PI * r;

  const tone = "var(--matte-fg-2)";
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(t);
  }, [trig]);
  const animVal = mounted ? value : 0;
  const dash = (mounted ? pct : 0) * arcLen;

  const W = size;
  const H = Math.round(size * VBH / VBW);
  const safeId = String(id || "s").replace(/[^A-Za-z0-9_-]/g, "_");

  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      width: W, maxWidth: "100%",
      overflow: "hidden",
    }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{display:"block", overflow:"hidden", width: W + "px", height: H + "px"}}
      >
        <defs>
          <linearGradient id={`scoreGrad-${safeId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={accent ? "#5478C9" : "#6a6a6a"}/>
            <stop offset="100%" stopColor={accent ? "#5478C9" : "#6a6a6a"}/>
          </linearGradient>
        </defs>
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#scoreGrad-${safeId})`}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen}`}
          style={{transition:"stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)"}}
        />
        <text
          x={cx} y={cy - 16}
          fontSize="48" fontWeight="700"
          fill="#FFFFFF"
          textAnchor="middle"
          style={{letterSpacing:"-0.02em", fontVariantNumeric:"tabular-nums"}}
        >{Math.round(animVal)}</text>
        <text
          x={cx} y={cy + 6}
          fontSize="13"
          fill="rgba(255,255,255,0.6)"
          textAnchor="middle"
          fontWeight="500"
        >/ {max}점</text>
      </svg>
      {label && (
        <div style={{marginTop:8, fontSize:15, color:tone, fontWeight:700, letterSpacing:"-0.005em"}}>
          {label}
        </div>
      )}
    </div>
  );
}

/* ----- Radar ----- */
export function Radar({ axes, values, size = 320, id, accent = false }) {
  const trig = id ? useTrigger(id) : 0;
  const fx = id ? useFx(id) : { n: 0, anim: [] };
  const has = (a) => fx.anim.includes(a);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.34;
  const n = axes.length;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const ringPoint = (i, k) => [cx + r * k * Math.cos(angle(i)), cy + r * k * Math.sin(angle(i))];
  const valPoint = (i) => ringPoint(i, values[i] / axes[i].max);
  const rings = [0.25, 0.5, 0.75, 1.0];

  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState(0);
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => {
      setMounted(true);
      if (id && has("sparkle")) {
        setTimeout(() => setParticles(c => c + 1), 700);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [trig]);

  const polyPoints = Array.from({length:n}, (_, i) => mounted ? valPoint(i) : [cx, cy])
    .map(p => p.join(",")).join(" ");

  const valPts = Array.from({length:n}, (_, i) => mounted ? valPoint(i) : [cx, cy]);

  return (
    <div style={{position:"relative", width:size, height:size}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
        {rings.map((k, i) => {
          const pts = Array.from({length:n}, (_, j) => ringPoint(j, k));
          return <polygon key={i} points={pts.map(p=>p.join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>;
        })}
        {axes.map((a, i) => {
          const [x, y] = ringPoint(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>;
        })}
        <polygon points={polyPoints} fill={accent ? "rgba(84,120,201,0.22)" : "rgba(255,255,255,0.06)"} stroke={accent ? "#5478C9" : "#9a9a9a"} strokeWidth="2" strokeLinejoin="round" style={{transition:"all 1.2s cubic-bezier(.4,0,.2,1)"}}/>
        {valPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4.5" fill={accent ? "#5478C9" : "#c9c9c9"} stroke="var(--matte-card)" strokeWidth="2" style={{transition:"all 1.2s cubic-bezier(.4,0,.2,1)"}}/>
        ))}
        {axes.map((a, i) => {
          const [lx, ly] = ringPoint(i, 1.42);
          return (
            <g key={i}>
              <text x={lx} y={ly} fontSize="15" fill="#FFFFFF" textAnchor="middle" fontWeight="600" dominantBaseline="middle">{a.label}</text>
              <text x={lx} y={ly + 22} fontSize="14" fill="#A3A3A3" textAnchor="middle" fontWeight="600" dominantBaseline="middle" style={{fontVariantNumeric:"tabular-nums"}}>
                {values[i]}<tspan fill="#6a6a6a" fontWeight="500">/{a.max}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      {particles > 0 && (
        <div key={particles} style={{position:"absolute", inset:0, pointerEvents:"none"}}>
          {valPts.map(([x, y], i) => (
            <span key={i} className="bc-radar-spark"
              style={{left:x, top:y, animationDelay: `${i * 60}ms`}}
            ></span>
          ))}
        </div>
      )}
    </div>
  );
}
