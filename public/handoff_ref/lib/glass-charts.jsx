/* glass-charts.jsx — minimal SVG chart primitives styled for glass panels */

/* Ring gauge (Activity-style, multi-arc) */
function GlassRing({ size = 200, thickness = 22, rings = [], centerLabel, centerSub }) {
  const cx = size / 2, cy = size / 2;
  const gap = 6;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => {
        const radius = (size / 2) - thickness / 2 - i * (thickness + gap);
        if (radius < thickness) return null;
        const c = 2 * Math.PI * radius;
        const pct = Math.max(0, Math.min(1, r.value / 100));
        return (
          <g key={i} transform={`rotate(-90 ${cx} ${cy})`}>
            <circle cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={r.track || "rgba(11,11,13,0.10)"}
              strokeWidth={thickness}
              strokeLinecap="round"/>
            <circle cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={r.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              style={{ filter: `drop-shadow(0 2px 6px ${r.color}66)` }}
            />
          </g>
        );
      })}
      {centerLabel && (
        <text x={cx} y={cy + 2} textAnchor="middle"
          style={{ font: "700 36px/1 var(--gl-font)", letterSpacing: "-0.03em", fill: "var(--gl-fg)" }}>
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + 24} textAnchor="middle"
          style={{ font: "500 11px/1 var(--gl-font)", fill: "var(--gl-fg-3)" }}>
          {centerSub}
        </text>
      )}
    </svg>
  );
}

/* Sparkline with optional area */
function GlassSpark({ data, color = "var(--gl-fg-2)", area = true, height = 64 }) {
  const w = 320;
  const min = Math.min(...data), max = Math.max(...data);
  const span = Math.max(0.0001, max - min);
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - 8 - ((v - min) / span) * (height - 16)]);
  const d = "M " + pts.map(p => p.join(",")).join(" L ");
  const areaD = d + ` L ${pts[pts.length-1][0]},${height} L 0,${height} Z`;
  const last = pts[pts.length-1];
  return (
    <svg className="gl-spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      {area && (
        <path d={areaD} fill={color} opacity="0.18"/>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={last[0]} cy={last[1]} r="4" fill={color}/>
      <circle cx={last[0]} cy={last[1]} r="8" fill={color} opacity="0.18"/>
    </svg>
  );
}

/* Thick rounded horizontal bar with label */
function GlassBarRow({ label, value, max = 100, color = "var(--gl-azure)", suffix = "%", note }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      <div className="gl-spread">
        <span style={{font:"500 14px/1 var(--gl-font)", color:"var(--gl-fg-2)"}}>{label}</span>
        <span style={{font:"600 16px/1 var(--gl-font)", color:"var(--gl-fg)", fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em"}}>
          {value}{suffix}{note ? <span style={{font:"500 12px/1 var(--gl-font)", color:"var(--gl-fg-4)", marginLeft:8}}>{note}</span> : null}
        </span>
      </div>
      <div className="gl-bar" style={{color}}>
        <i style={{width: pct + "%"}}/>
      </div>
    </div>
  );
}

/* Radar — 5-axis */
function GlassRadar({ size = 260, axes = [], values = [], color = "var(--gl-azure)" }) {
  const cx = size/2, cy = size/2, R = size/2 - 26;
  const n = axes.length;
  const pt = (i, r) => {
    const a = (Math.PI * 2 * i) / n - Math.PI/2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const rings = [0.25, 0.5, 0.75, 1.0];
  const valPts = values.map((v, i) => pt(i, R * (v/100)));
  const valD = "M " + valPts.map(p => p.join(",")).join(" L ") + " Z";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => (
        <polygon key={i}
          points={Array.from({length:n}, (_, j) => pt(j, R*r).join(",")).join(" ")}
          fill="none" stroke="rgba(11,11,13,0.10)" strokeWidth="1"/>
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(11,11,13,0.10)" strokeWidth="1"/>;
      })}
      <path d={valD} fill={color} opacity="0.22"/>
      <path d={valD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 2px 8px ${color}66)` }}/>
      {valPts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={color}/>)}
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={i} x={x} y={y} textAnchor="middle"
            style={{ font: "600 11px/1 var(--gl-font)", fill: "var(--gl-fg-3)" }}>
            {a}
          </text>
        );
      })}
    </svg>
  );
}

/* Vertical bar group — for hourly/weekly */
function GlassVBars({ data, height = 120, color = "var(--gl-azure)", labels }) {
  const w = 480;
  const max = Math.max(...data);
  const gap = 6;
  const bw = (w - gap * (data.length - 1)) / data.length;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      {data.map((v, i) => {
        const h = (v / max) * (height - 18);
        return (
          <g key={i}>
            <rect x={i * (bw + gap)} y={height - h}
              width={bw} height={h} rx={Math.min(bw/2, 6)}
              fill={color} opacity={0.85}/>
          </g>
        );
      })}
    </svg>
  );
}

/* Donut with center label */
function GlassDonut({ size = 200, thickness = 28, segments, centerLabel, centerSub }) {
  const cx = size/2, cy = size/2;
  const r = size/2 - thickness/2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(11,11,13,0.06)" strokeWidth={thickness}/>
        {segments.map((s, i) => {
          const pct = s.value / total;
          const len = c * pct;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={dash} strokeDashoffset={-offset}/>
          );
          offset += len;
          return el;
        })}
      </g>
      {centerLabel && (
        <text x={cx} y={cy} textAnchor="middle"
          style={{ font: "700 36px/1 var(--gl-font)", letterSpacing: "-0.03em", fill: "var(--gl-fg)" }}>
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + 22} textAnchor="middle"
          style={{ font: "500 12px/1 var(--gl-font)", fill: "var(--gl-fg-3)" }}>
          {centerSub}
        </text>
      )}
    </svg>
  );
}

Object.assign(window, { GlassRing, GlassSpark, GlassBarRow, GlassRadar, GlassVBars, GlassDonut });
