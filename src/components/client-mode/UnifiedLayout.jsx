import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CardTemplate from './CardTemplate';
import { COLORS, TIMING, BLUR, LAYOUT } from './constants';

// ─── Naver Map SDK Loader (uses global script from index.html, never loads a second script) ───
let naverSDKLoadPromise = null;

function loadNaverMapSDK() {
  if (naverSDKLoadPromise) return naverSDKLoadPromise;
  if (window.naver?.maps?.Map) {
    naverSDKLoadPromise = Promise.resolve(window.naver);
    return naverSDKLoadPromise;
  }
  // Wait for the global script (loaded by index.html) to finish loading — never create a second script
  naverSDKLoadPromise = new Promise((resolve, reject) => {
    const MAX_WAIT = 5000; // 5 seconds
    const INTERVAL = 500;
    let elapsed = 0;
    const timer = setInterval(() => {
      if (window.naver?.maps?.Map) {
        clearInterval(timer);
        resolve(window.naver);
      } else {
        elapsed += INTERVAL;
        if (elapsed >= MAX_WAIT) {
          clearInterval(timer);
          reject(new Error('Naver Maps SDK not available (global script from index.html may be missing)'));
        }
      }
    }, INTERVAL);
  });
  return naverSDKLoadPromise;
}

// ─── Animation Constants ───
const PANEL_SPRING = { type: 'spring', stiffness: 80, damping: 18, mass: 1.2 };
const MAP_WIPE_DURATION = 1.2;
const MAP_WIPE_DELAY = 0.3;
const INPUT_APPEAR_DELAY = 0.2;
const SLIDER_APPEAR_DELAY = 0.5;
const CONTENT_FADE_DURATION = 0.5;
const SLIDER_MIN = 100;
const SLIDER_MAX = 500;
const SLIDER_STEP = 50;
const SLIDER_DEFAULT = 500;

// ─── SVG Icons ───

const SearchIcon = ({ size = 18, color = COLORS.white }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7.5" cy="7.5" r="5.5" stroke={color} strokeWidth="1.5"/>
    <path d="M11.5 11.5L16 16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const GPSIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="3" stroke={COLORS.white} strokeWidth="1.5" fill="none"/>
    <circle cx="10" cy="10" r="7" stroke={COLORS.white} strokeWidth="1" fill="none" opacity="0.4"/>
    <line x1="10" y1="1" x2="10" y2="4" stroke={COLORS.white} strokeWidth="1" opacity="0.6"/>
    <line x1="10" y1="16" x2="10" y2="19" stroke={COLORS.white} strokeWidth="1" opacity="0.6"/>
    <line x1="1" y1="10" x2="4" y2="10" stroke={COLORS.white} strokeWidth="1" opacity="0.6"/>
    <line x1="16" y1="10" x2="19" y2="10" stroke={COLORS.white} strokeWidth="1" opacity="0.6"/>
  </svg>
);

const MapPinIcon = ({ size = 48, color = 'rgba(255,255,255,0.25)' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4C16.268 4 10 10.268 10 18C10 28 24 44 24 44C24 44 38 28 38 18C38 10.268 31.732 4 24 4Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="24" cy="18" r="5" stroke={color} strokeWidth="2"/>
  </svg>
);

const HomeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M2 7L7 2L12 7V12.5H8.5V9.5H5.5V12.5H2V7Z"
      stroke={COLORS.white}
      strokeWidth="1.2"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// ─── Chart Tooltip Helper ───

const ChartTooltip = ({ x, y, label, viewBoxWidth }) => {
  const tipW = Math.max(label.length * 7 + 16, 36);
  const tipH = 22;
  const arrowSize = 5;
  let tipX = x - tipW / 2;
  if (tipX < 2) tipX = 2;
  if (tipX + tipW > viewBoxWidth - 2) tipX = viewBoxWidth - 2 - tipW;
  const above = y - tipH - arrowSize - 4 >= -10;
  const tipY = above ? y - tipH - arrowSize - 4 : y + arrowSize + 4;
  const arrowY = above ? tipY + tipH : tipY;
  const arrowPoints = above
    ? `${x - arrowSize},${arrowY} ${x + arrowSize},${arrowY} ${x},${arrowY + arrowSize}`
    : `${x - arrowSize},${arrowY} ${x + arrowSize},${arrowY} ${x},${arrowY - arrowSize}`;
  return (
    <g pointerEvents="none">
      <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={5} ry={5}
        fill={COLORS.graphAccent} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5}
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
      />
      <polygon points={arrowPoints} fill={COLORS.graphAccent} />
      <text x={tipX + tipW / 2} y={tipY + tipH / 2 + 4} textAnchor="middle"
        fill="#FFFFFF" fontSize={8} fontWeight={600}
      >{label}</text>
    </g>
  );
};

// ─── Charts (premium redesign) ───

const smoothPath = (points) => {
  if (points.length < 2) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cpx = (x0 + x1) / 2;
    d += ` C${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  return d;
};

const ChartDefs = () => (
  <defs>
    <linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.graphAccent} stopOpacity="0.25"/>
      <stop offset="100%" stopColor={COLORS.graphAccent} stopOpacity="0.02"/>
    </linearGradient>
    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.graphMuted} stopOpacity="0.15"/>
      <stop offset="100%" stopColor={COLORS.graphMuted} stopOpacity="0.02"/>
    </linearGradient>
    <linearGradient id="areaFillMint" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.graphAccent} stopOpacity="0.35"/>
      <stop offset="100%" stopColor={COLORS.graphAccent} stopOpacity="0.05"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.graphMuted} stopOpacity="0.8"/>
      <stop offset="100%" stopColor={COLORS.graphMuted} stopOpacity="0.4"/>
    </linearGradient>
    <linearGradient id="barGradMint" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.graphAccent} stopOpacity="0.9"/>
      <stop offset="100%" stopColor={COLORS.graphAccent} stopOpacity="0.5"/>
    </linearGradient>
    <filter id="subtleShadow">
      <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.12"/>
    </filter>
  </defs>
);

const ChartBar = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  const hasData = data && Array.isArray(data.values) && data.values.length > 0;
  const bars = hasData ? data.values : [45, 72, 58, 90, 65, 80];
  const labels = hasData ? data.labels : ['개인', '프랜', '베이커리', '디저트', '복합', '기타'];
  const maxVal = Math.max(...bars, 1);
  const normalizedBars = bars.map(v => Math.round((v / maxVal) * 100));
  const highlightIdx = hasData ? bars.indexOf(Math.max(...bars)) : 3;
  const maxH = 100;
  const barW = 32;
  const gap = 18;
  const totalW = bars.length * barW + (bars.length - 1) * gap;
  const vbW = totalW + 40;
  const gridLines = [33, 66, 100];

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${vbW} 160`} preserveAspectRatio="xMidYMid meet" style={{overflow:'visible'}}>
      <ChartDefs/>
      {gridLines.map((val) => {
        const y = 125 - (val / 100) * maxH;
        return <line key={val} x1={14} y1={y} x2={vbW - 14} y2={y} stroke={COLORS.white} strokeWidth={0.5} opacity={0.04}/>;
      })}
      {normalizedBars.map((val, i) => {
        const h = (val / 100) * maxH;
        const x = 20 + i * (barW + gap);
        const y = 125 - h;
        const isHovered = hovered === i;
        const isHighlight = i === highlightIdx;
        const fill = isHighlight ? 'url(#barGradMint)' : 'url(#barGrad)';
        const baseOpacity = isHighlight ? 0.9 : 0.7;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={6}
              fill={fill} opacity={isHovered ? 1 : baseOpacity}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(i)}
            />
            <text x={x + barW / 2} y={145} textAnchor="middle" fill={COLORS.textMuted} fontSize={7} fontFamily="'Pretendard', -apple-system, sans-serif">{labels[i]}</text>
          </g>
        );
      })}
      {hovered !== null && (() => {
        const realVal = bars[hovered];
        const nVal = normalizedBars[hovered];
        const h = (nVal / 100) * maxH;
        const x = 20 + hovered * (barW + gap) + barW / 2;
        const y = 125 - h;
        return <ChartTooltip x={x} y={y} label={hasData ? String(realVal) : String(nVal)} viewBoxWidth={vbW} />;
      })()}
    </svg>
  );
};

const ChartLine = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  const hasData = data && Array.isArray(data.values) && data.values.length > 0;
  let points, labels, realValues;
  if (hasData) {
    const vals = data.values;
    realValues = vals;
    const maxV = Math.max(...vals, 1);
    const minV = Math.min(...vals);
    const range = maxV - minV || 1;
    const n = vals.length;
    const xStep = n > 1 ? 300 / (n - 1) : 300;
    points = vals.map((v, i) => [20 + i * xStep, 120 - ((v - minV) / range) * 90]);
    labels = data.labels;
  } else {
    points = [[20,110],[70,65],[120,82],[170,40],[220,58],[270,25],[320,45]];
    labels = ['1월','2월','3월','4월','5월','6월','7월'];
    realValues = points.map(p => p[1]);
  }
  const curveD = smoothPath(points);
  const areaD = curveD + ` L${points[points.length-1][0]},135 L${points[0][0]},135 Z`;
  const gridLines = [30, 60, 90, 120];

  return (
    <svg width="100%" height="100%" viewBox="0 0 340 155" preserveAspectRatio="xMidYMid meet" style={{overflow:'visible'}}>
      <ChartDefs/>
      {gridLines.map((val) => (
        <line key={val} x1={10} y1={val} x2={330} y2={val} stroke={COLORS.white} strokeWidth={0.5} opacity={0.04}/>
      ))}
      <path d={areaD} fill="url(#areaFill)" />
      <path d={curveD} fill="none" stroke={COLORS.white} strokeWidth={1.8} opacity={0.5} strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={hovered === i ? 5 : 3} fill={COLORS.white} opacity={hovered === i ? 0.9 : 0.5}
            style={{ cursor: 'pointer', transition: 'r 0.15s, opacity 0.15s' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(i)}
          />
          <text x={p[0]} y={148} textAnchor="middle" fill={COLORS.textMuted} fontSize={7} fontFamily="'Pretendard', -apple-system, sans-serif">{labels[i]}</text>
        </g>
      ))}
      {hovered !== null && (
        <ChartTooltip x={points[hovered][0]} y={points[hovered][1]} label={hasData ? String(realValues[hovered]) : String(points[hovered][1])} viewBoxWidth={340} />
      )}
    </svg>
  );
};

const ChartArea = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  const hasData = data && Array.isArray(data.values) && data.values.length > 0;
  let points, points2, labels, realValues;
  if (hasData) {
    const vals = data.values;
    realValues = vals;
    const maxV = Math.max(...vals, 1);
    const n = vals.length;
    const xStep = n > 1 ? 340 / (n - 1) : 340;
    points = vals.map((v, i) => [i * xStep, 130 - (v / maxV) * 95]);
    // 두 번째 라인: values2가 있으면 사용, 없으면 첫 번째 라인의 약화 버전
    if (data.values2 && data.values2.length > 0) {
      const vals2 = data.values2;
      points2 = vals2.map((v, i) => [i * xStep, 130 - (v / maxV) * 95]);
    } else {
      points2 = points.map(([x, y]) => [x, Math.min(140, y + 20 + Math.random() * 10)]);
    }
    labels = data.labels;
  } else {
    points = [[0,120],[50,85],[100,98],[150,50],[200,68],[250,38],[300,58],[340,75]];
    points2 = [[0,130],[50,108],[100,115],[150,85],[200,95],[250,72],[300,88],[340,100]];
    labels = ['6시','9시','12시','15시','18시','21시','24시','3시'];
    realValues = points.map(p => p[1]);
  }
  const curveD = smoothPath(points);
  const areaD = curveD + ' L340,140 L0,140 Z';
  const curveD2 = smoothPath(points2);
  const areaD2 = curveD2 + ' L340,140 L0,140 Z';
  const gridLines = [40, 70, 100, 130];

  return (
    <svg width="100%" height="100%" viewBox="0 0 340 158" preserveAspectRatio="xMidYMid meet" style={{overflow:'visible'}}>
      <ChartDefs/>
      {gridLines.map((val) => (
        <line key={val} x1={0} y1={val} x2={340} y2={val} stroke={COLORS.white} strokeWidth={0.5} opacity={0.04}/>
      ))}
      <path d={areaD2} fill="url(#areaFill)" />
      <path d={areaD} fill="url(#areaFillMint)" />
      <path d={curveD2} fill="none" stroke={COLORS.graphMuted} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" opacity={0.5}/>
      <path d={curveD} fill="none" stroke={COLORS.graphAccent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8}/>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={hovered === i ? 4 : 2.5} fill={COLORS.white} opacity={hovered === i ? 0.9 : 0.5}
            style={{ cursor: 'pointer', transition: 'r 0.15s, opacity 0.15s' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(i)}
          />
          <text x={p[0]} y={153} textAnchor="middle" fill={COLORS.textMuted} fontSize={6} fontFamily="'Pretendard', -apple-system, sans-serif">{labels[i]}</text>
        </g>
      ))}
      {hovered !== null && (
        <ChartTooltip x={points[hovered][0]} y={points[hovered][1]} label={hasData ? fmt(realValues[hovered]) : String(points[hovered][1])} viewBoxWidth={340} />
      )}
    </svg>
  );
};

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Math.round(n).toLocaleString('ko-KR');
};

const DONUT_COLORS = [
  { color: 'rgba(27,42,74,0.9)', dotColor: '#1B2A4A', opacity: 1 },
  { color: 'rgba(107,114,128,0.6)', dotColor: '#6B7280', opacity: 0.7 },
  { color: 'rgba(55,75,120,0.7)', dotColor: '#374B78', opacity: 0.8 },
  { color: 'rgba(90,100,120,0.5)', dotColor: '#5A6478', opacity: 0.7 },
  { color: 'rgba(40,55,85,0.5)', dotColor: '#283755', opacity: 0.7 },
];

const ChartDonut = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  const r = 48;
  const cx = 72;
  const cy = 75;
  const circumference = 2 * Math.PI * r;
  const hasData = data && Array.isArray(data.segments) && data.segments.length > 0;
  let segments;
  if (hasData) {
    const totalPct = data.segments.reduce((s, seg) => s + (seg.pct || 0), 0) || 100;
    segments = data.segments.map((seg, i) => {
      const pctNorm = (seg.pct || 0) / totalPct;
      const dc = DONUT_COLORS[i % DONUT_COLORS.length];
      return {
        pct: pctNorm,
        label: `${Math.round(pctNorm * 100)}%`,
        name: seg.name || '',
        color: dc.color,
        dotColor: dc.dotColor,
        opacity: dc.opacity,
      };
    });
  } else {
    segments = [
      { pct: 0.58, label: '58%', name: '여성', color: 'rgba(27,42,74,0.9)', dotColor: '#1B2A4A', opacity: 1 },
      { pct: 0.42, label: '42%', name: '남성', color: 'rgba(107,114,128,0.6)', dotColor: '#6B7280', opacity: 0.7 },
    ];
  }
  let cumulativeOffset = 0;
  const segmentsWithOffset = segments.map((seg) => {
    const s = { ...seg, offset: -cumulativeOffset };
    cumulativeOffset += seg.pct * circumference;
    return s;
  });

  const getSegmentMidpoint = (segIndex) => {
    let startAngle = -Math.PI / 2;
    for (let s = 0; s < segIndex; s++) startAngle += segments[s].pct * 2 * Math.PI;
    const midAngle = startAngle + segments[segIndex].pct * Math.PI;
    return { x: cx + r * Math.cos(midAngle), y: cy + r * Math.sin(midAngle) };
  };

  return (
    <svg width="100%" height="100%" viewBox="0 0 220 150" preserveAspectRatio="xMidYMid meet" style={{overflow:'visible'}}>
      <ChartDefs/>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.graphBgBar} strokeWidth={24}/>
      {/* Segments */}
      {segmentsWithOffset.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
          strokeWidth={hovered === i ? 28 : 24}
          strokeDasharray={`${seg.pct * circumference} ${circumference}`}
          strokeDashoffset={seg.offset}
          opacity={seg.opacity}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ cursor: 'pointer', transition: 'stroke-width 0.2s, opacity 0.2s' }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          onTouchStart={() => setHovered(i)}
        />
      ))}
      {/* Center text */}
      <text x={cx} y={cy - 2} textAnchor="middle" fill={COLORS.white} fontSize={13} fontWeight={700}>{segments[0]?.label || ''}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={COLORS.textMuted} fontSize={8}>{segments[0]?.name || ''}</text>
      {/* Legend */}
      {segments.map((seg, i) => {
        const ly = 52 + i * 26;
        return (
          <g key={`legend-${i}`}>
            <circle cx={152} cy={ly - 3} r={4} fill={seg.dotColor} opacity={0.6}/>
            <text x={163} y={ly} fill={COLORS.textSecondary} fontSize={7} fontFamily="'Pretendard', -apple-system, sans-serif">{seg.name}</text>
            <text x={208} y={ly} fill={COLORS.textMuted} fontSize={7} textAnchor="end" fontFamily="'Pretendard', -apple-system, sans-serif">{seg.label}</text>
          </g>
        );
      })}
      {hovered !== null && (() => {
        const mid = getSegmentMidpoint(hovered);
        return <ChartTooltip x={mid.x} y={mid.y} label={segments[hovered].label} viewBoxWidth={220} />;
      })()}
    </svg>
  );
};

const ChartHorizontalBar = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  const hasData = data && Array.isArray(data.items) && data.items.length > 0;
  let items;
  if (hasData) {
    const maxVal = Math.max(...data.items.map(d => d.value), 1);
    items = data.items.map(d => ({ label: d.label, value: Math.round((d.value / maxVal) * 100), realValue: d.value }));
  } else {
    items = [{ label: '보증금', value: 70, realValue: 70 }, { label: '월 임대', value: 55, realValue: 55 }, { label: '권리금', value: 40, realValue: 40 }];
  }
  const maxW = 210;
  const barH = 22;
  const svgH = Math.max(150, 28 + items.length * 42 + 10);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 320 ${svgH}`} preserveAspectRatio="xMidYMid meet" style={{overflow:'visible'}}>
      <ChartDefs/>
      {items.map((item, i) => {
        const y = 28 + i * 42;
        const w = (item.value / 100) * maxW;
        const isHovered = hovered === i;
        const isIndividual = item.label === '개인카페';
        const fill = isIndividual ? COLORS.graphAccent : COLORS.graphMuted;
        return (
          <g key={i}>
            <text x={12} y={y + 5} fill={COLORS.textMuted} fontSize={8} fontWeight={500} fontFamily="'Pretendard', -apple-system, sans-serif">{item.label}</text>
            <rect x={70} y={y - 10} width={maxW} height={barH} rx={8} fill={COLORS.graphBgBar}/>
            <rect x={70} y={y - 10} width={w} height={barH} rx={8}
              fill={fill}
              opacity={isHovered ? 1 : 0.85}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(i)}
            />
            <text x={70 + w + 10} y={y + 5} fill={COLORS.textMuted} fontSize={8} fontWeight={500} fontFamily="'Pretendard', -apple-system, sans-serif">{hasData ? fmt(item.realValue) : `${item.value}%`}</text>
          </g>
        );
      })}
      {hovered !== null && (() => {
        const item = items[hovered];
        const y = 28 + hovered * 42;
        const w = (item.value / 100) * maxW;
        const tipX = 70 + w / 2;
        const tipY = y - 10;
        return <ChartTooltip x={tipX} y={tipY} label={hasData ? fmt(item.realValue) : `${item.value}%`} viewBoxWidth={320} />;
      })()}
    </svg>
  );
};

const ChartMixed = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  const hasData = data && Array.isArray(data.values) && data.values.length > 0;
  let bars, linePoints, labels, realValues;
  if (hasData) {
    realValues = data.values;
    const maxV = Math.max(...data.values, 1);
    bars = data.values.map(v => Math.round((v / maxV) * 100));
    const n = bars.length;
    const xStep = n > 1 ? 225 / (n - 1) : 225;
    linePoints = bars.map((v, i) => [30 + i * xStep, 130 - (v / 100) * 90]);
    labels = data.labels;
  } else {
    bars = [30, 50, 65, 45, 70, 55];
    linePoints = [[30,100],[75,75],[120,58],[165,70],[210,42],[255,50]];
    labels = ['1월','2월','3월','4월','5월','6월'];
    realValues = bars;
  }
  const barW = 24;
  const maxH = 100;
  const curveD = smoothPath(linePoints);
  const hGridLines = [40, 70, 100, 130];

  return (
    <svg width="100%" height="100%" viewBox="0 0 300 155" preserveAspectRatio="xMidYMid meet" style={{overflow:'visible'}}>
      <ChartDefs/>
      {hGridLines.map((val) => (
        <line key={`h-${val}`} x1={10} y1={val} x2={275} y2={val} stroke={COLORS.white} strokeWidth={0.5} opacity={0.04}/>
      ))}
      {/* Background bars */}
      {bars.map((val, i) => {
        const h = (val / 100) * maxH;
        const x = 18 + i * 45;
        const y = 130 - h;
        const isBarHovered = hovered?.type === 'bar' && hovered?.idx === i;
        return (
          <g key={`bar-${i}`}>
            <rect x={x} y={y} width={barW} height={h} rx={4}
              fill={COLORS.graphBgBar} opacity={isBarHovered ? 0.6 : 0.3}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHovered({ type: 'bar', idx: i })}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered({ type: 'bar', idx: i })}
            />
            <text x={x + barW / 2} y={145} textAnchor="middle" fill={COLORS.textMuted} fontSize={6} fontFamily="'Pretendard', -apple-system, sans-serif">{labels[i]}</text>
          </g>
        );
      })}
      {/* Line overlay */}
      <path d={curveD} fill="none" stroke={COLORS.white} strokeWidth={1.5} opacity={0.5} strokeLinecap="round" strokeLinejoin="round"/>
      {linePoints.map((p, i) => {
        const isHovered = hovered?.type === 'line' && hovered?.idx === i;
        return (
          <g key={`pt-${i}`}>
            <circle cx={p[0]} cy={p[1]} r={isHovered ? 5 : 3}
              fill={COLORS.white} opacity={isHovered ? 0.9 : 0.5}
              style={{ cursor: 'pointer', transition: 'r 0.15s, opacity 0.15s' }}
              onMouseEnter={() => setHovered({ type: 'line', idx: i })}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered({ type: 'line', idx: i })}
            />
          </g>
        );
      })}
      {hovered?.type === 'bar' && (() => {
        const val = bars[hovered.idx];
        const x = 18 + hovered.idx * 45 + barW / 2;
        const h = (val / 100) * maxH;
        const y = 130 - h;
        return <ChartTooltip x={x} y={y} label={hasData ? String(realValues[hovered.idx]) : String(val)} viewBoxWidth={300} />;
      })()}
      {hovered?.type === 'line' && (() => {
        const p = linePoints[hovered.idx];
        return <ChartTooltip x={p[0]} y={p[1]} label={hasData ? String(realValues[hovered.idx]) : String(p[1])} viewBoxWidth={300} />;
      })()}
    </svg>
  );
};

// Returns a chart element with real data from card.chartData, falling back to demo data if null
const getChartForCard = (card) => {
  if (!card) return null;
  // Cards with no chart (e.g. opportunities/risks, SNS trends) - return null to skip chart area
  if (card.chartType === null && card.chartData === null) return null;
  const chartData = card.chartData || null;
  switch (card.chartType) {
    case 'bar': return chartData ? <ChartBar data={chartData} /> : <ChartBar />;
    case 'line': return chartData ? <ChartLine data={chartData} /> : <ChartLine />;
    case 'area': return chartData ? <ChartArea data={chartData} /> : <ChartArea />;
    case 'donut': return chartData ? <ChartDonut data={chartData} /> : <ChartDonut />;
    case 'horizontal-bar': return chartData ? <ChartHorizontalBar data={chartData} /> : <ChartHorizontalBar />;
    case 'mixed': return chartData ? <ChartMixed data={chartData} /> : <ChartMixed />;
    default: return null;
  }
};

// CHART_MAP for fallback when card has chartType but no chartData
const CHART_MAP = {
  bar: <ChartBar />,
  line: <ChartLine />,
  area: <ChartArea />,
  donut: <ChartDonut />,
  'horizontal-bar': <ChartHorizontalBar />,
  mixed: <ChartMixed />,
};

// ─── DataTable ───

const LABEL_MAP = {
  cafes: '카페 수', franchise: '프랜차이즈', individual: '개인카페', bakery: '베이커리 카페', newOpen: '신규 오픈',
  floatingPop: '일 유동인구', closed: '폐업 매장',
  '일 유동인구': '일 유동인구', '방문고객': '방문고객', '폐업 매장': '폐업 매장',
  monthly: '월평균 매출', dongAvg: '동 평균', guAvg: '구 평균', top5: '매출 상위 5곳',
  weekday: '평일 유동인구', weekend: '주말 유동인구', peakHour: '피크 시간대', ratio: '평일/주말 비율',
  male: '남성 비율', female: '여성 비율', newCustomer: '신규 고객', regular: '단골 고객', topAge: '주요 연령대',
  rentPerPyeong: '평당 임대료', deposit: '보증금', supportPrograms: '지원 프로그램',
  blogMentions: '블로그 언급수', deliveryRatio: '배달 비중', trendDirection: '트렌드 방향', closureRate: '폐업률',
  cafeDeliveryRank: '카페 배달 순위', avgDeliveryOrder: '평균 배달 주문건수', topCategory: '1위 배달 업종',
  weekdaySales: '평일 매출', weekendSales: '주말 매출', cardRatio: '카드 결제 비율', cashRatio: '현금 결제 비율',
  level: '경쟁 강도', cafePerKm2: 'km2당 카페 수', franchiseRatio: '프랜차이즈 비율', avgLifespan: '평균 영업기간',
  openCount: '신규 개업', closeCount: '폐업', netChange: '순증감', trend: '추세',
  survivalRate1y: '1년 생존율', survivalRate3y: '3년 생존율', survivalRate5y: '5년 생존율', survivalInsight: '생존율 분석',
  overallScore: '종합 점수', opportunities: '기회 요인', risks: '리스크 요인', recommendation: '추천 전략',
  dayOfWeek: '요일별 유동인구', avgStay: '평균 체류시간', residentPop: '상주인구', genderRatio: '성별 비율', peakTime: '피크타임',
  interiorCost: '인테리어 비용', equipmentCost: '설비/장비 비용', totalStartupCost: '총 창업비용', premiumCost: '권리금',
  perPyeong: '평당 임대료', medianMonthly: '월세 중위값', medianDeposit: '보증금 중위값',
  keywords: 'SNS 키워드', sentiment: '감성 분석', summary: 'SNS 요약',
  opportunityCount: '기회 요인 수', riskCount: '리스크 요인 수', beancraftPriority: '빈크래프트 우선순위',
  interior: '인테리어 제안', equipment: '설비 제안', menu: '메뉴 제안', beans: '원두 제안',
  education: '교육 제안', design: '디자인 제안', youtube: '유튜브 분석',
  revisitCycle: '재방문 주기', loyaltyIndex: '충성도 지수', scores: '점수',
  franchiseCount: '프랜차이즈 수', totalCafes: '전체 카페 수', independentCount: '개인 카페 수',
  franchiseSummary: '주요 프랜차이즈', nearbySummary: '주변 카페',
  avgMonthlySales: '평균 월매출', franchiseMinPrice: '아메리카노 최저가', franchiseMaxPrice: '아메리카노 최고가',
  cafeDeliveryCount: '카페 배달 건수', americanoPriceRange: '아메리카노 가격대', nearestFranchise: '최근접 프랜차이즈',
  regionType: '상권 유형', sunnyEffect: '맑은 날 영향', cloudyEffect: '흐린 날 영향',
  rainyEffect: '비 오는 날 영향', snowEffect: '눈 오는 날 영향', description: '날씨 분석 요약',
};

const formatValue = (key, val) => {
  if (Array.isArray(val)) return val.join(', ');
  if (key === 'monthly' || key === 'dongAvg' || key === 'guAvg') return `${val.toLocaleString()}만원`;
  if (key === 'male' || key === 'female' || key === 'newCustomer' || key === 'regular') return `${val}%`;
  if (key === 'weekday' || key === 'weekend') return `${val.toLocaleString()}명`;
  if (key === 'rentPerPyeong') return `${val}만원/평`;
  if (key === 'deposit') return `${val.toLocaleString()}만원`;
  if (key === 'supportPrograms') return `${val}건`;
  if (key === 'blogMentions') return `${val.toLocaleString()}건`;
  if (key === 'deliveryRatio' || key === 'closureRate') return `${val}%`;
  if (key === 'cafes' || key === 'franchise' || key === 'individual' || key === 'bakery' || key === 'newOpen') return `${val}개`;
  return String(val);
};

// Render opportunities/risks array items with colored left border
const RiskOpportunityList = ({ items, type }) => {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  const isOpportunity = type === 'opportunity';
  const borderColor = isOpportunity ? 'rgba(100,200,150,0.6)' : 'rgba(220,100,100,0.6)';
  const bgColor = isOpportunity ? 'rgba(100,200,150,0.06)' : 'rgba(220,100,100,0.06)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          borderLeft: `3px solid ${borderColor}`,
          background: bgColor,
          borderRadius: '0 8px 8px 0',
          padding: '10px 14px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary }}>
            {typeof item === 'string' ? item : (item.title || item.name || '')}
          </div>
          {typeof item === 'object' && (item.detail || item.description) && (
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.5 }}>
              {item.detail || item.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Render SNS keywords as pill/tag elements
const KeywordPills = ({ keywords }) => {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {keywords.map((kw, i) => (
        <span key={i} style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontSize: 12,
          color: COLORS.textSecondary,
          fontWeight: 500,
        }}>
          {typeof kw === 'string' ? kw : (kw.keyword || kw.name || '')}
        </span>
      ))}
    </div>
  );
};

// Render sentiment as a simple horizontal bar
const SentimentBar = ({ sentiment }) => {
  if (!sentiment) return null;
  // sentiment can be a string like "긍정 72%" or an object { positive: 72, negative: 28 }
  let positive = 50;
  let label = String(sentiment);
  if (typeof sentiment === 'object') {
    positive = sentiment.positive || sentiment.pos || 50;
    label = `긍정 ${positive}%`;
  } else if (typeof sentiment === 'string') {
    const match = sentiment.match(/(\d+)/);
    if (match) positive = parseInt(match[1], 10);
  }
  return (
    <div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ width: '100%', height: 6, background: COLORS.graphBgBar, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, positive))}%`,
          height: '100%',
          background: 'rgba(100,200,150,0.5)',
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
};

const DataTable = ({ data }) => {
  if (!data) return null;
  const entries = Object.entries(data);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {entries.map(([key, val], i) => {
        // Special rendering for opportunities array
        if (key === 'opportunities' && Array.isArray(val)) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <RiskOpportunityList items={val} type="opportunity" />
            </div>
          );
        }
        // Special rendering for risks array
        if (key === 'risks' && Array.isArray(val)) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <RiskOpportunityList items={val} type="risk" />
            </div>
          );
        }
        // Special rendering for SNS keywords
        if (key === 'keywords' && Array.isArray(val)) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <KeywordPills keywords={val} />
            </div>
          );
        }
        // Special rendering for sentiment
        if (key === 'sentiment') {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <SentimentBar sentiment={val} />
            </div>
          );
        }
        // Default key-value pair rendering
        return (
          <div key={key} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0',
            borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
          }}>
            <span style={{ fontSize: 14, color: COLORS.textMuted }}>{LABEL_MAP[key] || key}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.white }}>{formatValue(key, val)}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Mock Cards (dark mode 상권 대시보드 데모용) ───

const MOCK_CARDS = [
  // Card 1: 상권 분석 리포트
  {
    title: '상권 분석 리포트',
    subtitle: '반경 500m 카페 현황',
    date: '2026년 4월 기준',
    source: '오픈업/카카오/네이버',
    bruSummary: null,
    aiSummary: '반경 500m 내 카페 47개 (프랜차이즈 12개, 개인 35개). 개인카페 중심의 상권입니다.',
    chartType: 'horizontal-bar',
    metaInfo: '카페 현황',
    chartData: { items: [{ label: '전체 카페', value: 47 }, { label: '프랜차이즈', value: 12 }, { label: '개인카페', value: 35 }] },
    bodyData: {
      cafes: 47,
      franchise: 12,
      individual: 35,
      bakery: 8,
      newOpen: 3,
      '일 유동인구': '24,530명',
      '방문고객': '8,120명',
      '폐업 매장': 2,
    },
  },
  // Card 2: 고객 분석
  {
    title: '고객 분석',
    subtitle: '방문 고객 특성',
    date: '2026년 4월 기준',
    source: '소상공인365',
    bruSummary: null,
    aiSummary: '30대 고객 비중이 가장 높으며, 여성 고객 비율이 높습니다.',
    chartType: 'bar',
    metaInfo: '고객',
    chartData: { labels: ['20대', '30대', '40대', '50대', '60대'], values: [22, 34, 24, 13, 7] },
    bodyData: {
      male: 43,
      female: 57,
      genderRatio: '남성 43% / 여성 57%',
      newCustomer: 0,
      regular: 0,
      topAge: '30대',
      peakTime: '12~15시',
      cafeDeliveryCount: 156,
    },
  },
  // Card 3: 프랜차이즈 현황
  {
    title: '프랜차이즈 현황',
    subtitle: '주요 프랜차이즈 브랜드 분석',
    date: '2026년 4월 기준',
    source: '오픈업/카카오',
    bruSummary: null,
    aiSummary: '반경 500m 내 프랜차이즈 12개. 스타벅스 등 7개 브랜드.',
    chartType: 'donut',
    metaInfo: '프랜차이즈',
    chartData: { segments: [{ name: '스타벅스', pct: 25 }, { name: '투썸플레이스', pct: 17 }, { name: '이디야', pct: 17 }, { name: '메가커피', pct: 17 }, { name: '빽다방', pct: 8 }, { name: '컴포즈', pct: 8 }, { name: '기타', pct: 8 }] },
    bodyData: {
      franchiseCount: 12,
      totalCafes: 47,
      independentCount: 35,
      brands: ['스타벅스', '투썸플레이스', '이디야', '메가커피', '빽다방', '컴포즈', '할리스'],
      franchiseSummary: '스타벅스 3개, 투썸플레이스 2개, 이디야 2개, 메가커피 2개, 빽다방 1개',
    },
    tag: '프랜차이즈',
  },
  // Card 4: 개인 카페 분석
  {
    title: '개인 카페 분석',
    subtitle: '주변 개인 카페 현황',
    date: '2026년 4월 기준',
    source: '오픈업/카카오',
    bruSummary: null,
    aiSummary: '반경 500m 내 개인카페 35개. 점포당 월평균 매출 1,820만원.',
    chartType: 'horizontal-bar',
    metaInfo: '개인카페',
    chartData: { items: [{ label: '개인카페', value: 35 }, { label: '프랜차이즈', value: 12 }, { label: '월매출(만)', value: 1820 }] },
    bodyData: {
      independentCount: 35,
      avgMonthlySales: 1820,
      franchiseMinPrice: 4500,
      franchiseMaxPrice: 6500,
      nearbySummary: '로스팅하우스 (120m), 카페봄 (180m), 모카포트 (230m), 언더바 (310m), 블랙빈 (380m)',
    },
    tag: '개인카페',
  },
  // Card 5: 매출 분석
  {
    title: '매출 분석',
    subtitle: '월평균 예상 매출',
    date: '2026년 4월 기준',
    source: '소상공인365',
    bruSummary: null,
    aiSummary: '카페 업종 월평균 매출 2,150만원, 동 전체 업종 평균 1,780만원. 동 평균 대비 높은 매출 수준입니다.',
    chartType: 'line',
    metaInfo: '매출',
    chartData: { labels: ['11월', '12월', '1월', '2월', '3월', '4월'], values: [1950, 1870, 2010, 2080, 2150, 2200] },
    bodyData: {
      monthly: 21500000,
      dongAvg: 17800000,
      guAvg: 0,
      top5: ['한식', '카페', '치킨', '분식', '일식'],
    },
  },
  // Card 6: 유동인구
  {
    title: '유동인구',
    subtitle: '시간대별 통행량 - 역삼동',
    date: '2026년 4월 기준',
    source: '소상공인365',
    bruSummary: null,
    aiSummary: '일평균 유동인구 24,530명. 평일 유동인구가 주말보다 높습니다.',
    chartType: 'area',
    metaInfo: '유동인구',
    chartData: { labels: ['6~9시', '9~12시', '12~15시', '15~18시', '18~21시', '21~24시'], values: [3200, 5800, 7100, 6400, 4800, 2100] },
    bodyData: {
      totalPop: 24530,
      visitors: 8120,
      topArea: null,
      weekday: 15200,
      weekend: 9330,
      peakHour: '12~15시',
      ratio: '평일 62% / 주말 38%',
      dayOfWeek: null,
      avgStay: null,
      residentPop: null,
    },
  },
  // Card 7: 임대/창업 정보
  {
    title: '임대/창업 정보',
    subtitle: '상가 시세 및 지원',
    date: '2026년 4월 기준',
    source: '한국부동산원',
    bruSummary: null,
    aiSummary: '평균 월 임대료 320만원, 보증금 5,000만원.',
    chartType: 'horizontal-bar',
    metaInfo: '임대',
    chartData: { items: [{ label: '보증금', value: 5000 }, { label: '월임대', value: 320 }, { label: '권리금', value: 3500 }, { label: '인테리어', value: 4000 }] },
    bodyData: {
      rentPerPyeong: 320,
      deposit: 5000,
      supportPrograms: 0,
      perPyeong: null,
      medianMonthly: null,
      medianDeposit: null,
      interiorCost: 4000,
      equipmentCost: 2500,
      totalStartupCost: 15000,
      premiumCost: 3500,
    },
  },
  // Card 8: 기회 & 리스크
  {
    title: '기회 & 리스크',
    subtitle: '상권 기회 요인과 리스크 분석',
    date: '2026년 4월 기준',
    source: 'Google Gemini',
    bruSummary: null,
    aiSummary: '유동인구가 풍부하고 오피스 밀집 지역으로 점심/오후 수요가 높습니다.',
    chartType: null,
    metaInfo: '기회/리스크',
    chartData: null,
    bodyData: {
      opportunities: [
        { title: '높은 유동인구', detail: '일 평균 2만명 이상의 유동인구로 자연 유입 고객 확보 용이' },
        { title: '오피스 밀집', detail: '반경 500m 내 대형 오피스 빌딩 다수, 점심 및 오후 커피 수요 높음' },
        { title: '지하철 역세권', detail: '강남역 도보 3분 거리, 접근성 우수' },
      ],
      risks: [
        { title: '높은 경쟁 강도', detail: '반경 500m 내 카페 47개로 과밀 상권' },
        { title: '높은 임대료', detail: '월 320만원 수준의 임대료로 손익분기점이 높음' },
      ],
      opportunityCount: 3,
      riskCount: 2,
    },
    tag: '기회/리스크',
  },
  // Card 9: 배달 분석
  {
    title: '배달 분석',
    subtitle: '배달 업종 현황',
    date: '2026년 4월 기준',
    source: '소상공인365',
    bruSummary: null,
    aiSummary: '카페/음료 배달 매출 비중 8%. 배달 업종 내 5위.',
    chartType: 'horizontal-bar',
    metaInfo: '배달',
    chartData: { items: [{ label: '치킨', value: 28 }, { label: '한식', value: 22 }, { label: '분식', value: 18 }, { label: '중식', value: 14 }, { label: '카페', value: 8 }] },
    bodyData: {
      deliveryRatio: 8,
      cafeDeliveryRank: 5,
      avgDeliveryOrder: 15200,
      topCategory: '치킨',
    },
  },
  // Card 10: SNS 트렌드
  {
    title: 'SNS 트렌드',
    subtitle: '소셜미디어 키워드 분석',
    date: '2026년 4월 기준',
    source: '네이버/소상공인365',
    bruSummary: null,
    aiSummary: '주요 키워드: 강남카페, 디저트, 루프탑, 분위기, 브런치. 블로그 언급 3,842건.',
    chartType: null,
    metaInfo: 'SNS',
    chartData: null,
    bodyData: {
      keywords: ['강남카페', '디저트', '루프탑', '분위기', '브런치'],
      sentiment: '긍정',
      summary: '강남역 주변 카페 검색량 증가 추세. 디저트와 분위기를 중시하는 리뷰가 다수.',
      blogMentions: 3842,
    },
    tag: 'SNS',
  },
  // Card 11: 날씨 영향 분석
  {
    title: '날씨 영향 분석',
    subtitle: '기상 조건별 매출 영향도',
    date: '2026년 4월 기준',
    source: '기상청/소상공인365',
    bruSummary: null,
    aiSummary: '맑은 날 매출이 평균 대비 12% 높으며, 비 오는 날은 15% 감소하는 경향이 있습니다.',
    chartType: null,
    chartData: null,
    bodyData: {
      regionType: '도심 오피스형',
      sunnyEffect: '+12%',
      cloudyEffect: '-3%',
      rainyEffect: '-15%',
      snowEffect: '-22%',
      description: '오피스 밀집 지역으로 날씨 영향이 상대적으로 적으나, 우천 시 테이크아웃 비중이 증가합니다.',
    },
    tag: '날씨',
  },
  // Card 12: 상권 경쟁 분석
  {
    title: '상권 경쟁 분석',
    subtitle: '상권 내 경쟁 수준',
    date: '2026년 4월 기준',
    source: '오픈업/카카오',
    bruSummary: null,
    aiSummary: '반경 500m 내 카페 47개, 경쟁 강도 "과밀". 프랜차이즈 비율 26%.',
    chartType: 'donut',
    metaInfo: '경쟁',
    chartData: { segments: [{ name: '프랜차이즈', pct: 26 }, { name: '개인', pct: 74 }] },
    bodyData: {
      level: '과밀',
      cafePerKm2: 60,
      franchiseRatio: 26,
      avgLifespan: '-',
    },
  },
  // Card 13: AI 종합 분석
  {
    title: 'AI 종합 분석',
    subtitle: 'AI 에이전트 종합 피드백',
    date: '2026년 4월 기준',
    source: 'Google Gemini',
    bruSummary: null,
    aiSummary: '강남역 반경 500m는 높은 유동인구와 오피스 수요가 강점이나, 카페 과밀 상권으로 차별화 전략이 필수입니다. 스페셜티 커피와 디저트 특화 메뉴로 개인카페 경쟁력을 확보하는 것이 유리합니다.',
    chartType: 'mixed',
    metaInfo: 'AI종합',
    chartData: { labels: ['종합', '기회', '리스크', '경쟁'], values: [72, 45, 30, 50] },
    bodyData: {
      overallScore: 72,
      opportunities: 3,
      risks: 2,
      recommendation: '조건부 추천',
      beancraftPriority: null,
      interior: null,
      equipment: null,
      menu: null,
      beans: null,
      education: null,
      design: null,
    },
  },
];

// ─── Radius Slider ───

function RadiusSlider({ value = SLIDER_DEFAULT, onChange = () => {} }) {
  const pct = ((value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
  return (
    <div style={{ width: '100%', padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ color: COLORS.white, fontSize: 12, fontWeight: 500, opacity: 0.5 }}>반경 설정</span>
        <span style={{ color: COLORS.white, fontSize: 14, fontWeight: 700 }}>{value}m</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 28, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: 'transparent', border: `1px solid ${COLORS.whiteBorder}`, borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 3, background: COLORS.white, borderRadius: 2, transition: 'width 0.15s ease', opacity: 0.6 }} />
        <input type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={SLIDER_STEP} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: 'absolute', width: '100%', height: 28, opacity: 0, cursor: 'pointer', margin: 0, zIndex: 2 }}
        />
        <motion.div
          animate={{ left: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            position: 'absolute', width: 14, height: 14, borderRadius: '50%',
            background: COLORS.white, border: `2px solid ${COLORS.navy}`,
            transform: 'translateX(-50%)', pointerEvents: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ color: COLORS.white, fontSize: 10, opacity: 0.35 }}>100m</span>
        <span style={{ color: COLORS.white, fontSize: 10, opacity: 0.35 }}>300m</span>
        <span style={{ color: COLORS.white, fontSize: 10, opacity: 0.35 }}>500m</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// UnifiedLayout Component
// ─────────────────────────────────────────────

export default function UnifiedLayout({
  resultsReady = false,
  cards = MOCK_CARDS,
  summaryMetrics = null,
  collectedData = null,
  onSearch = () => {},
  onGoHome = () => {},
  onRadiusChange = null,
  searchAddress = '',
  embedded = false,
  salesModeLoading = false,
  salesModeProgress = 0,
  salesModeStep = '',
  salesModeCollectingText = '',
  onAbortAnalysis = null,
  initialHomepageOpen = false,
  onHomepageClosed = null,
}) {
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(SLIDER_DEFAULT);
  const [mapRevealed, setMapRevealed] = useState(!resultsReady && !salesModeLoading);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [showHomepage, setShowHomepage] = useState(initialHomepageOpen);
  const [homepageUrl, setHomepageUrl] = useState('/site/');
  const [autoCompleteOpen, setAutoCompleteOpen] = useState(false);
  const [kakaoSuggestions, setKakaoSuggestions] = useState([]);
  const kakaoDebounceRef = useRef(null);
  const inputRef = useRef(null);
  const mapContainerRef = useRef(null);
  const naverMapRef = useRef(null);
  const naverMarkerRef = useRef(null);
  const naverCircleRef = useRef(null);
  const [naverReady, setNaverReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  // ── Sync initialHomepageOpen prop ──
  useEffect(() => {
    if (initialHomepageOpen) setShowHomepage(true);
  }, [initialHomepageOpen]);

  // ── Notify parent when homepage panel closes ──
  const handleCloseHomepage = useCallback(() => {
    setShowHomepage(false);
    if (onHomepageClosed) onHomepageClosed();
  }, [onHomepageClosed]);

  // ── Cafe Map Modal State ──
  const [showCafeMap, setShowCafeMap] = useState(false);
  const [cafeMapRadius, setCafeMapRadius] = useState(500);
  const cafeMapRef = useRef(null);
  const cafeMapCircleRef = useRef(null);
  const cafeMapMarkersRef = useRef([]);
  const cafeMapInfoWindowRef = useRef(null);
  const cafeMapAnimFrameRef = useRef(null);

  // ── Cafe Map: radius change animation ──
  const animateCafeCircleRadius = useCallback((fromR, toR) => {
    if (cafeMapAnimFrameRef.current) cancelAnimationFrame(cafeMapAnimFrameRef.current);
    const circle = cafeMapCircleRef.current;
    if (!circle) return;
    const duration = 300;
    const startTime = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentR = fromR + (toR - fromR) * easeOut(progress);
      try { circle.setRadius(currentR); } catch (e) { cafeMapAnimFrameRef.current = null; return; }
      if (progress < 1) cafeMapAnimFrameRef.current = requestAnimationFrame(step);
      else cafeMapAnimFrameRef.current = null;
    };
    cafeMapAnimFrameRef.current = requestAnimationFrame(step);
  }, []);

  const updateCafeMarkerVisibility = useCallback((r) => {
    cafeMapMarkersRef.current.forEach(item => {
      if (!item.dist || !item.marker) return;
      try {
        const shouldShow = r >= 500 || item.dist <= r;
        const el = item.marker.getElement ? item.marker.getElement() : null;
        if (el) { el.style.transition = 'opacity 0.3s ease'; el.style.opacity = shouldShow ? '1' : '0'; el.style.pointerEvents = shouldShow ? 'auto' : 'none'; }
        else if (item.marker.setVisible) item.marker.setVisible(shouldShow);
      } catch (e) {}
    });
  }, []);

  const handleCafeMapRadiusChange = useCallback((newR) => {
    const prevR = cafeMapCircleRef.current ? cafeMapCircleRef.current.getRadius() : 500;
    setCafeMapRadius(newR);
    animateCafeCircleRadius(prevR, newR);
    updateCafeMarkerVisibility(newR);
  }, [animateCafeCircleRadius, updateCafeMarkerVisibility]);

  // ── Cafe Map: Naver Map rendering ──
  useEffect(() => {
    const cd = collectedData;
    const coords = cd?.coordinates;
    if (!showCafeMap || !coords || !window.naver?.maps) return;
    setCafeMapRadius(500);
    const timer = setTimeout(() => {
      try {
        const container = document.getElementById('unified-cafe-map-container');
        if (!container) return;
        const center = new window.naver.maps.LatLng(coords.lat, coords.lng);
        const map = new window.naver.maps.Map('unified-cafe-map-container', {
          center, zoom: 15,
          zoomControl: true,
          zoomControlOptions: { position: window.naver.maps.Position.TOP_RIGHT },
          logoControl: false, mapDataControl: false, scaleControl: false
        });
        if (!map) return;
        cafeMapRef.current = map;
        window.naver.maps.Event.addListener(map, 'click', () => {
          if (cafeMapInfoWindowRef.current) try { cafeMapInfoWindowRef.current.close(); } catch (e) {}
        });
        const circle = new window.naver.maps.Circle({ map, center, radius: 500, strokeColor: '#2196F3', strokeWeight: 2, fillColor: '#2196F3', fillOpacity: 0.08 });
        cafeMapCircleRef.current = circle;
        // Mug SVGs
        const mugSvg = (color) => `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 1 C6 1 1 5.5 1 11 C1 18 12 31 12 31 C12 31 23 18 23 11 C23 5.5 18 1 12 1Z" fill="${color}" stroke="#fff" stroke-width="1.5"/><ellipse cx="12" cy="11" rx="4.5" ry="3.5" fill="#fff" opacity="0.9" transform="rotate(-30 12 11)"/><path d="M10 9 Q12 11 14 9" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/></svg>`;
        // Center marker
        const centerMarker = new window.naver.maps.Marker({ map, position: center, icon: { content: mugSvg('#EF4444'), anchor: new window.naver.maps.Point(12, 31) }, zIndex: 100 });
        cafeMapMarkersRef.current.push({ marker: centerMarker, dist: null, type: 'center', origIcon: mugSvg('#EF4444') });
        const infoWindow = new window.naver.maps.InfoWindow({ content: '', borderWidth: 0, backgroundColor: 'transparent', disableAnchor: true, pixelOffset: new window.naver.maps.Point(0, -8) });
        cafeMapInfoWindowRef.current = infoWindow;
        const makeInfo = (name, addr, dist) => '<div style="padding:8px 12px;background:#fff;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.15);font-family:Pretendard,sans-serif;min-width:140px;"><p style="font-size:13px;font-weight:700;color:#191F28;margin:0 0 4px;">' + (name||'') + '</p><p style="font-size:11px;color:#6B7684;margin:0;">' + (addr||'') + '</p>' + (dist!=null?'<p style="font-size:11px;color:#3182F6;margin:2px 0 0;font-weight:600;">'+dist+'m</p>':'') + '</div>';
        // Cluster SVG
        const clusterSvg = (count, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="2"/><text x="18" y="23" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${count}</text></svg>`;
        const makeClusterInfo = (cafes) => {
          const lines = cafes.map(c => { const t = c._type === 'franchise' ? '프랜차이즈' : c._type === 'bakery' ? '베이커리' : '개인카페'; return '<p style="font-size:12px;color:#191F28;margin:2px 0;">'+(c.name||'')+' <span style="color:#6B7684;font-size:11px;">('+t+')</span></p>'; }).join('');
          return '<div style="padding:8px 12px;background:#fff;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.15);font-family:Pretendard,sans-serif;min-width:160px;max-height:200px;overflow-y:auto;">'+lines+'</div>';
        };
        // All cafes
        const allCafes = [];
        (cd?.nearbyFranchiseList||[]).forEach(c => { if(c.lat&&c.lng) allCafes.push({...c,_type:'franchise',_color:c.isNewOpen?'#A855F7':'#3B82F6'}); });
        (cd?.nearbyIndependentList||[]).forEach(c => { if(c.lat&&c.lng) allCafes.push({...c,_type:'independent',_color:c.isNewOpen?'#A855F7':'#22C55E'}); });
        (cd?.nearbyBakeryList||[]).forEach(c => { if(c.lat&&c.lng) allCafes.push({...c,_type:'bakery',_color:'#F59E0B'}); });
        // Group by location
        const groups = {};
        allCafes.forEach(c => { const lat2=parseFloat(c.lat),lng2=parseFloat(c.lng); if(isNaN(lat2)||isNaN(lng2))return; const k=`${Math.round(lat2/0.00015)*0.00015}_${Math.round(lng2/0.00015)*0.00015}`; if(!groups[k])groups[k]=[]; groups[k].push(c); });
        Object.values(groups).forEach(group => {
          if (group.length===1) {
            const c=group[0]; const pos=new window.naver.maps.LatLng(parseFloat(c.lat),parseFloat(c.lng));
            const color = c._type==='bakery'?'#F59E0B':c._type==='franchise'?(c.isNewOpen?'#A855F7':'#3B82F6'):(c.isNewOpen?'#A855F7':'#22C55E');
            const icon=mugSvg(color);
            const marker=new window.naver.maps.Marker({map,position:pos,icon:{content:icon,anchor:new window.naver.maps.Point(12,31)}});
            const displayName=c._type==='bakery'?c.name+' (베이커리)':(c.isNewOpen?c.name+' (신규)':c.name);
            window.naver.maps.Event.addListener(marker,'click',()=>{infoWindow.setContent(makeInfo(displayName,c.addr,c.dist));infoWindow.open(map,marker);});
            const dist=typeof c.dist==='number'?c.dist:parseFloat(c.dist)||999;
            cafeMapMarkersRef.current.push({marker,dist,type:c._type,origIcon:icon,isNewOpen:!!c.isNewOpen});
          } else {
            const avgLat=group.reduce((s,c)=>s+parseFloat(c.lat),0)/group.length;
            const avgLng=group.reduce((s,c)=>s+parseFloat(c.lng),0)/group.length;
            const pos=new window.naver.maps.LatLng(avgLat,avgLng);
            const typeCounts={};group.forEach(c=>{typeCounts[c._type]=(typeCounts[c._type]||0)+1;});
            let dom='independent',mx=0;Object.entries(typeCounts).forEach(([t,n])=>{if(n>mx){mx=n;dom=t;}});
            const colorMap={franchise:'#3B82F6',independent:'#22C55E',bakery:'#F59E0B'};
            const svg=clusterSvg(group.length,colorMap[dom]||'#3B82F6');
            const marker=new window.naver.maps.Marker({map,position:pos,icon:{content:svg,anchor:new window.naver.maps.Point(18,18)},zIndex:30});
            window.naver.maps.Event.addListener(marker,'click',()=>{infoWindow.setContent(makeClusterInfo(group));infoWindow.open(map,marker);});
            const minDist=Math.min(...group.map(c=>typeof c.dist==='number'?c.dist:parseFloat(c.dist)||999));
            cafeMapMarkersRef.current.push({marker,dist:minDist,type:dom,origIcon:svg,isNewOpen:group.some(c=>c.isNewOpen),clusterCafes:group});
          }
        });
      } catch(e) { console.warn('[CafeMap] init failed:', e.message); }
    }, 100);
    return () => {
      clearTimeout(timer);
      try {
        if(cafeMapAnimFrameRef.current){cancelAnimationFrame(cafeMapAnimFrameRef.current);cafeMapAnimFrameRef.current=null;}
        if(cafeMapInfoWindowRef.current){try{cafeMapInfoWindowRef.current.close();}catch(e){}cafeMapInfoWindowRef.current=null;}
        cafeMapMarkersRef.current.forEach(item=>{try{const m=item?.marker||item;if(m&&typeof m.setMap==='function')m.setMap(null);}catch(e){}});
        cafeMapMarkersRef.current=[];
        if(cafeMapCircleRef.current){try{cafeMapCircleRef.current.setMap(null);}catch(e){}cafeMapCircleRef.current=null;}
        if(cafeMapRef.current){try{cafeMapRef.current.destroy();}catch(e){}cafeMapRef.current=null;}
      } catch(e) { console.warn('[CafeMap] cleanup error:', e.message); }
    };
  }, [showCafeMap, collectedData?.coordinates, collectedData?.nearbyFranchiseList, collectedData?.nearbyIndependentList, collectedData?.nearbyBakeryList]);

  // Preload bg
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/cafe-bg.jpg';
  }, []);

  // Initialize Naver Map
  useEffect(() => {
    if (!mapRevealed || !mapContainerRef.current) return;

    // Skip map on localhost — Naver Maps SDK loads but creates auth-failed tiles
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      console.warn('[NaverMap] Skipping map on localhost (auth tiles issue)');
      setMapLoadFailed(true);
      return;
    }

    let ro;
    loadNaverMapSDK()
      .then(() => {
        if (!window.naver?.maps?.Map || !mapContainerRef.current) {
          setMapLoadFailed(true);
          return;
        }
        try {
          const defaultCenter = new window.naver.maps.LatLng(37.5665, 126.9780);
          const mapOptions = {
            center: defaultCenter,
            zoom: 15,
            logoControl: false,
            mapDataControl: false,
            zoomControl: true,
            zoomControlOptions: {
              position: window.naver.maps.Position.TOP_RIGHT,
              style: window.naver.maps.ZoomControlStyle.SMALL
            }
          };
          const map = new window.naver.maps.Map(mapContainerRef.current, mapOptions);
          naverMapRef.current = map;
          setNaverReady(true);

          // Resize observer to handle panel resize
          ro = new ResizeObserver(() => {
            if (window.naver && window.naver.maps && window.naver.maps.Event) {
              window.naver.maps.Event.trigger(map, 'resize');
            }
          });
          if (mapContainerRef.current) {
            ro.observe(mapContainerRef.current);
          }
        } catch (err) {
          console.warn('[NaverMap] Map creation failed:', err.message);
          setMapLoadFailed(true);
        }
      })
      .catch((err) => {
        console.warn('[NaverMap] SDK load failed:', err.message);
        setMapLoadFailed(true);
      });

    // Auth failure detection: if map not ready after 3 seconds, show fallback
    const authTimeout = setTimeout(() => {
      setMapLoadFailed((prev) => {
        // Only set failed if map is still not ready
        if (!naverMapRef.current) return true;
        return prev;
      });
    }, 3000);

    return () => {
      clearTimeout(authTimeout);
      if (ro) ro.disconnect();
    };
  }, [mapRevealed]);

  // Update map center when searchAddress changes
  useEffect(() => {
    if (!naverReady || !naverMapRef.current || !searchAddress) return;
    if (!window.naver?.maps?.Service) return;

    window.naver.maps.Service.geocode({ query: searchAddress }, (status, response) => {
      if (status === window.naver.maps.Service.Status.OK && response.v2?.addresses?.length > 0) {
        const addr = response.v2.addresses[0];
        const coord = new window.naver.maps.LatLng(parseFloat(addr.y), parseFloat(addr.x));
        naverMapRef.current.setCenter(coord);
        naverMapRef.current.setZoom(15);

        // Remove existing marker/circle
        if (naverMarkerRef.current) {
          naverMarkerRef.current.setMap(null);
        }
        if (naverCircleRef.current) {
          naverCircleRef.current.setMap(null);
        }

        // Create marker
        naverMarkerRef.current = new window.naver.maps.Marker({
          position: coord,
          map: naverMapRef.current,
          icon: {
            content: '<div style="width:24px;height:24px;background:#171717;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
            anchor: new window.naver.maps.Point(12, 12)
          }
        });

        // Create circle
        naverCircleRef.current = new window.naver.maps.Circle({
          map: naverMapRef.current,
          center: coord,
          radius: radius,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.1
        });
      }
    });
  }, [naverReady, searchAddress, radius]);

  // Update circle radius when slider changes
  useEffect(() => {
    if (!naverCircleRef.current) return;
    naverCircleRef.current.setRadius(radius);
  }, [radius]);

  // Notify parent when radius changes (for card recalculation)
  useEffect(() => {
    if (onRadiusChange && resultsReady) {
      onRadiusChange(radius);
    }
  }, [radius, onRadiusChange, resultsReady]);

  // GPS button handler
  const handleGPS = useCallback(() => {
    if (!naverMapRef.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!window.naver?.maps) return;
        const coord = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        naverMapRef.current.setCenter(coord);
      },
      (err) => console.warn('[GPS]', err.message),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const handlePanelAnimComplete = useCallback(() => {
    setMapRevealed(true);
    setTimeout(() => inputRef.current?.focus(), (MAP_WIPE_DELAY + MAP_WIPE_DURATION) * 1000);
  }, []);

  // ── Popular spots for local autocomplete ──
  const POPULAR_SPOTS = [
    '강남역','홍대입구역','건대입구역','성수동','이태원','명동','잠실','신촌',
    '판교역','분당 정자동','수원역','일산','안양 범계역','김포 장기동',
    '해운대','서면','부산 남포동','대구 동성로','대전 둔산동','광주 충장로',
    '전주 객사','제주 연동','창원 상남동','코엑스','가로수길','을지로3가',
    '삼청동','북촌','연남동','망원동','합정','역삼','종로','광화문','여의도',
    '서울대입구역','연세대','남대문시장','동대문시장'
  ];

  // Fetch Kakao keyword suggestions (debounced)
  const fetchKakaoSuggestions = useCallback((query) => {
    if (kakaoDebounceRef.current) clearTimeout(kakaoDebounceRef.current);
    if (!query || query.length < 2) {
      setKakaoSuggestions([]);
      return;
    }
    kakaoDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kakao-proxy?type=keyword&query=${encodeURIComponent(query)}&size=5`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          setKakaoSuggestions((data.documents || []).map(d => ({
            place_name: d.place_name,
            address_name: d.address_name || d.road_address_name || '',
          })));
        }
      } catch {
        // ignore timeout/network errors
      }
    }, 300);
  }, []);

  // Compute filtered suggestions: popular spots + kakao results
  const autoCompleteSuggestions = (() => {
    if (!address || address.length < 1) return [];
    const q = address.toLowerCase();
    const spots = POPULAR_SPOTS.filter(s => s.toLowerCase().includes(q)).slice(0, 4);
    const kakao = kakaoSuggestions
      .filter(k => !spots.some(s => s === k.place_name))
      .slice(0, 4);
    return [
      ...spots.map(s => ({ type: 'spot', label: s, sub: '' })),
      ...kakao.map(k => ({ type: 'kakao', label: k.place_name, sub: k.address_name })),
    ].slice(0, 6);
  })();

  const handleAddressChange = useCallback((e) => {
    const val = e.target.value;
    setAddress(val);
    setAutoCompleteOpen(val.length >= 1);
    fetchKakaoSuggestions(val);
  }, [fetchKakaoSuggestions]);

  const handleSuggestionClick = useCallback((label) => {
    setAddress(label);
    setAutoCompleteOpen(false);
    setKakaoSuggestions([]);
    onSearch(label, radius);
  }, [onSearch, radius]);

  const handleSubmit = useCallback(() => {
    const trimmed = address.trim();
    setAutoCompleteOpen(false);
    setKakaoSuggestions([]);
    if (trimmed) {
      onSearch(trimmed, radius);
    }
  }, [address, radius, onSearch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setAutoCompleteOpen(false);
    }
  }, [handleSubmit]);

  const leftWidth = resultsReady ? LAYOUT.mapPanelWidthResult : salesModeLoading ? LAYOUT.mapPanelWidth : '100vw';

  return (
    <div
      style={{
        position: embedded ? 'absolute' : 'fixed',
        inset: 0,
        background: COLORS.black,
        overflow: 'hidden',
        display: 'flex',
      }}
      className="unified-layout-root"
    >
      {/* ── Cafe Map Modal ── */}
      {showCafeMap && collectedData?.coordinates && (
        <div
          onClick={() => setShowCafeMap(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '90vw', maxWidth: 600, height: '70vh',
              background: '#1a1a2e', borderRadius: 16,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.white, margin: 0 }}>
                카페 위치 지도
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>반경 {cafeMapRadius}m</span>
                <input
                  type="range" min={100} max={500} step={50} value={cafeMapRadius}
                  onChange={e => handleCafeMapRadiusChange(Number(e.target.value))}
                  style={{ width: 100, accentColor: '#3182F6' }}
                />
                <button
                  onClick={() => setShowCafeMap(false)}
                  style={{ background: 'none', border: 'none', color: COLORS.white, fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                >
                  x
                </button>
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, padding: '8px 18px', flexWrap: 'wrap' }}>
              {[
                { color: '#EF4444', label: '검색 위치' },
                { color: '#3B82F6', label: '프랜차이즈' },
                { color: '#22C55E', label: '개인카페' },
                { color: '#F59E0B', label: '베이커리' },
                { color: '#A855F7', label: '신규 오픈' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{item.label}</span>
                </div>
              ))}
            </div>
            {/* Map container */}
            <div id="unified-cafe-map-container" style={{ flex: 1, minHeight: 0 }} />
          </div>
        </div>
      )}
      {/* ── Background image (blurred) ── */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          backgroundImage: 'url(/cafe-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: `blur(${BLUR.bgBlur}px)`,
          opacity: bgLoaded ? 0.12 : 0,
          transition: 'opacity 1.5s ease',
          willChange: 'opacity',
          zIndex: 0,
        }}
      />
      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 0,
        }}
      />

      {/* ══════ LEFT PANEL (Map + Search) ══════ */}
      <motion.div
        initial={{ width: (!resultsReady && !salesModeLoading) ? leftWidth : 0, opacity: (!resultsReady && !salesModeLoading) ? 1 : 0 }}
        animate={{ width: leftWidth, opacity: 1 }}
        transition={PANEL_SPRING}
        onAnimationComplete={handlePanelAnimComplete}
        style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: `blur(${BLUR.cardBackdrop}px)`,
          WebkitBackdropFilter: `blur(${BLUR.cardBackdrop}px)`,
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRight: resultsReady ? `1px solid rgba(255,255,255,0.1)` : 'none',
        }}
        className="unified-left-panel"
      >
        {/* Map area with radial wipe */}
        <motion.div
          initial={{ clipPath: (!resultsReady && !salesModeLoading) ? 'circle(150% at 50% 50%)' : 'circle(0% at 50% 50%)' }}
          animate={{ clipPath: mapRevealed ? 'circle(150% at 50% 50%)' : 'circle(0% at 50% 50%)' }}
          transition={{ duration: MAP_WIPE_DURATION, delay: MAP_WIPE_DELAY, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
        >
          {/* Search input */}
          <motion.div
            initial={{ opacity: (!resultsReady && !salesModeLoading) ? 1 : 0, y: (!resultsReady && !salesModeLoading) ? 0 : -10 }}
            animate={{ opacity: mapRevealed ? 1 : 0, y: mapRevealed ? 0 : -10 }}
            transition={{ duration: CONTENT_FADE_DURATION, delay: (!resultsReady && !salesModeLoading) ? 0 : MAP_WIPE_DELAY + INPUT_APPEAR_DELAY }}
            style={{ padding: '20px 20px 0', flexShrink: 0 }}
          >
            <div style={{ position: 'relative' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'transparent',
                border: `1.5px solid ${COLORS.whiteBorder}`,
                borderRadius: 8, padding: '0 14px', height: 46,
              }}>
                {resultsReady ? (
                  <input
                    readOnly
                    value={searchAddress}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: COLORS.white, fontSize: 14, fontWeight: 500, letterSpacing: '0.02em',
                      cursor: 'default',
                    }}
                  />
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    value={address}
                    onChange={handleAddressChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (address.length >= 1) setAutoCompleteOpen(true); }}
                    onBlur={() => { setTimeout(() => setAutoCompleteOpen(false), 200); }}
                    placeholder="주소를 입력하세요"
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: COLORS.white, fontSize: 14, fontWeight: 500, letterSpacing: '0.02em',
                    }}
                  />
                )}
                {!resultsReady && (
                  <button
                    onClick={handleSubmit}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: 4, display: 'flex', alignItems: 'center',
                      opacity: address.trim() ? 1 : 0.4, transition: 'opacity 0.2s',
                    }}
                    aria-label="검색"
                  >
                    <SearchIcon color={COLORS.white} />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {autoCompleteOpen && !resultsReady && autoCompleteSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  marginTop: 4, borderRadius: 10, overflow: 'hidden',
                  background: 'rgba(30,30,38,0.95)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
                }}>
                  {autoCompleteSuggestions.map((item, i) => (
                    <div
                      key={`${item.type}-${i}`}
                      onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(item.type === 'kakao' ? (item.sub || item.label) : item.label); }}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                        color: COLORS.white,
                        borderBottom: i < autoCompleteSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        display: 'flex', flexDirection: 'column', gap: 2,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 500 }}>{item.label}</span>
                      {item.sub && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{item.sub}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Radius slider */}
          <motion.div
            initial={{ opacity: (!resultsReady && !salesModeLoading) ? 1 : 0, y: (!resultsReady && !salesModeLoading) ? 0 : 8 }}
            animate={{ opacity: mapRevealed ? 1 : 0, y: mapRevealed ? 0 : 8 }}
            transition={{ duration: CONTENT_FADE_DURATION, delay: (!resultsReady && !salesModeLoading) ? 0 : MAP_WIPE_DELAY + SLIDER_APPEAR_DELAY }}
            style={{ padding: '14px 20px 0', flexShrink: 0 }}
          >
            <RadiusSlider value={radius} onChange={setRadius} />
          </motion.div>

          {/* Map area */}
          <div style={{
            flex: 1, position: 'relative',
            overflow: 'hidden', minHeight: 200,
          }}>
            {/* Map container — hidden when load failed to prevent auth tiles from showing */}
            {!mapLoadFailed && (
              <div
                ref={mapContainerRef}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  minHeight: 200,
                  overflow: 'hidden',
                }}
              />
            )}
            {/* Fallback: loading or failure */}
            {mapLoadFailed ? (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 12,
                background: 'rgba(10,10,10,0.9)',
                zIndex: 2,
              }}>
                <MapPinIcon color="rgba(255,255,255,0.35)" />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500, letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1.6 }}>
                  지도를 불러올 수 없습니다
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '0.03em' }}>
                  (배포 후 표시)
                </span>
              </div>
            ) : !naverReady && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 12, opacity: 0.3,
                background: 'rgba(0,0,0,0.3)',
                zIndex: 2,
              }}>
                <MapPinIcon />
                <span style={{ color: COLORS.white, fontSize: 14, fontWeight: 500, letterSpacing: '0.05em' }}>
                  지도 로딩 중...
                </span>
              </div>
            )}

            {/* GPS Icon - always top right */}
            <div
              onClick={handleGPS}
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 32, height: 32, borderRadius: 6,
                background: 'rgba(255,255,255,0.08)',
                border: `1px solid rgba(255,255,255,0.15)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              <GPSIcon />
            </div>
          </div>

          {/* Home button at bottom */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <button
              onClick={() => setShowHomepage(true)}
              style={{
                background: 'transparent', border: 'none',
                color: COLORS.white, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: 0.5, transition: 'opacity 0.2s', padding: '4px 0',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
            >
              <HomeIcon />
              홈페이지
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* ══════ RIGHT PANEL (Cards / Empty State) ══════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        style={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2,
          display: (resultsReady || salesModeLoading) ? 'flex' : 'none',
          flexDirection: 'column',
        }}
        className="unified-right-panel"
      >
        <AnimatePresence mode="wait">
          {!resultsReady ? (
            /* ── Empty state or Loading state ── */
            salesModeLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  height: '100%',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 12,
                }}
              >
                {/* Progress bar */}
                <div style={{ width: '60%', maxWidth: 320, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${salesModeProgress}%`,
                      height: '100%',
                      background: 'rgba(255,255,255,0.4)',
                      borderRadius: 1,
                      transition: 'width 0.5s ease-out',
                    }}
                  />
                </div>
                <span style={{ color: COLORS.white, fontSize: 24, fontWeight: 300, fontFamily: 'Pretendard, sans-serif', marginTop: 12 }}>
                  {salesModeProgress}%
                </span>
                <span style={{ color: COLORS.white, fontSize: 12, opacity: 0.4, fontFamily: 'Pretendard, sans-serif', textAlign: 'center', maxWidth: 300 }}>
                  {salesModeCollectingText || salesModeStep || '분석을 준비하고 있습니다'}
                </span>
                {onAbortAnalysis && (
                  <button
                    onClick={onAbortAnalysis}
                    style={{
                      marginTop: 24, padding: '6px 18px', borderRadius: 4, fontSize: 11, fontWeight: 400,
                      background: 'transparent', color: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                      transition: 'all 0.2s', fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    분석 중지
                  </button>
                )}
                <button
                  onClick={() => setShowHomepage(true)}
                  style={{
                    marginTop: 12, background: 'transparent', border: 'none',
                    color: COLORS.white, fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    opacity: 0.4, transition: 'opacity 0.2s', padding: '4px 0',
                    fontFamily: 'Pretendard, sans-serif',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
                >
                  <HomeIcon />
                  홈페이지
                </button>
              </motion.div>
            ) : (
            <div key="empty" style={{ height: '100%' }} />
            )
          ) : (
            /* ── Cards area ── */
            <motion.div
              key="cards"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '24px 24px 48px',
                scrollSnapType: 'y proximity',
              }}
              className="unified-cards-scroll"
            >
              {/* Section header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ marginBottom: 20, scrollSnapAlign: 'start' }}
              >
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.white, letterSpacing: '-0.02em' }}>
                  분석 결과
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: COLORS.textMuted }}>
                  {cards.length}개 항목 -- 반경 {radius}m 기준
                </p>
              </motion.div>

              {/* Summary dashboard bar removed - data moved to individual cards */}

              {/* Cards list */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                gap: 24,
              }}>
                {cards.map((card, i) => (
                  <React.Fragment key={i}>
                    <CardTemplate
                      index={i}
                      title={card.title}
                      subtitle={card.subtitle}
                      date={card.date}
                      bruSummary={card.bruSummary || null}
                      aiSummary={card.aiSummary}
                      chartContent={card.chartData !== undefined ? getChartForCard(card) : (CHART_MAP[card.chartType] || null)}
                      bodyContent={<DataTable data={card.bodyData} />}
                      metaInfo={card.metaInfo}
                    />
                    {/* "지도로 보기" button after Card 1 */}
                    {i === 0 && collectedData?.coordinates && (
                      (collectedData?.nearbyFranchiseList?.length > 0 || collectedData?.nearbyIndependentList?.length > 0) && (
                        <button
                          onClick={() => setShowCafeMap(true)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            width: '100%', fontSize: 14, fontWeight: 600, color: '#3182F6',
                            background: 'rgba(49,130,246,0.07)', border: 'none', borderRadius: 12,
                            padding: '12px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
                            transition: 'background 0.2s', fontFamily: 'Pretendard, sans-serif',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(49,130,246,0.14)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(49,130,246,0.07)'}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 118 4.99 1.5 1.5 0 018 7.5z" fill="#3182F6"/></svg>
                          지도로 보기
                        </button>
                      )
                    )}
                  </React.Fragment>
                ))}
                {/* ── Unified Data Sources ── */}
                {(() => {
                  const sourceSet = new Set();
                  cards.forEach(card => {
                    if (card.source) {
                      card.source.split('/').forEach(s => {
                        const trimmed = s.trim();
                        if (trimmed) sourceSet.add(trimmed);
                      });
                    }
                  });
                  const sources = Array.from(sourceSet);
                  if (sources.length === 0) return null;
                  return (
                    <div style={{
                      textAlign: 'right',
                      padding: '8px 4px 0',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.3)',
                      lineHeight: 1.5,
                      letterSpacing: '0.01em',
                    }}>
                      {'데이터 출처: ' + sources.join(', ')}
                    </div>
                  );
                })()}
              </div>

              {/* Bottom spacer */}
              <div style={{ height: 40 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ══════ Homepage Sliding Panel (full-screen overlay) ══════ */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '100vw',
        height: '100vh',
        transform: showHomepage ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 9999,
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top bar */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(20,22,28,0.95)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCloseHomepage}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: 36,
                height: 36,
                color: COLORS.white,
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            >
              X
            </button>
          </div>
        </div>
        {/* iframe - only render when visible to avoid unnecessary loading */}
        {showHomepage && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <iframe
              src={homepageUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="빈크래프트 홈페이지"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )}
      </div>

      {/* ── Responsive CSS ── */}
      <style>{`
        @media (max-width: 767px) {
          .unified-layout-root {
            flex-direction: column !important;
          }
          .unified-left-panel {
            width: 100% !important;
            height: 40vh !important;
            min-height: 240px;
          }
          .unified-right-panel {
            flex: 1 !important;
            height: auto !important;
            min-height: 60vh;
          }
        }
        .unified-cards-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .unified-cards-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .unified-cards-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
        }
        .unified-cards-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${COLORS.navy};
          border: 2px solid ${COLORS.white};
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${COLORS.navy};
          border: 2px solid ${COLORS.white};
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
