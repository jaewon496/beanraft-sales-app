import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from 'recharts';
import CardTemplate from './CardTemplate';
import Card01MarketReport from './cards/Card01MarketReport';
import Card02CustomerAnalysis from './cards/Card02CustomerAnalysis';
import Card3FranchiseAnalysis from './Card3FranchiseAnalysis';
import Card4IndieCafeAnalysis from './Card4IndieCafeAnalysis';
import Card5SalesAnalysis from './Card5SalesAnalysis';
import Card6FloatingPop from './Card6FloatingPop';
import Card8OpportunityRisk from './Card8OpportunityRisk';
import Card12CompetitionScore from './Card12CompetitionScore';
import Card13TrendAnalysis from './Card13TrendAnalysis';
import Card9DeliveryAvgPrice from './Card9DeliveryAvgPrice';
// ── Handoff 시안 카드 14종 (design-handoff-v1) ──
import HfCard01 from '../handoff/cards/Card01.jsx';
import HfCard02 from '../handoff/cards/Card02.jsx';
import HfCard03 from '../handoff/cards/Card03.jsx';
import HfCard04 from '../handoff/cards/Card04.jsx';
import HfCard05 from '../handoff/cards/Card05.jsx';   // 매출 분석 (시안 Card06 함수)
import HfCard06 from '../handoff/cards/Card06.jsx';   // 개인 카페 (시안 Card05 함수)
import HfCard07 from '../handoff/cards/Card07.jsx';
import HfCard08 from '../handoff/cards/Card08.jsx';
import HfCard09 from '../handoff/cards/Card09.jsx';
import HfCard10 from '../handoff/cards/Card10.jsx';
import HfCard11 from '../handoff/cards/Card11.jsx';
import HfCard12 from '../handoff/cards/Card12.jsx';
import HfCard13 from '../handoff/cards/Card13.jsx';
import HfCard14 from '../handoff/cards/Card14.jsx';
import { Sidebar as HfSidebar, TopBar as HfTopBar, GROUPS as HF_GROUPS, CARDS as HF_CARDS } from '../handoff/Shared.jsx';
import '../../styles/handoff/colors_and_type.css';
import '../../styles/handoff/sales.css';
// matte.css: 시안의 정식 매트 다크 톤 (사용자가 OK한 색감). 파스텔 알록달록 차단.
import '../../styles/handoff/matte.css';
import AINarrationEngine from './AINarrationEngine';
import { COLORS, TIMING, BLUR, LAYOUT } from './constants';
import {
  mapCollectedDataToCards,
  mapToCommercialDistrict,
  extractMarketRent,
  extractVacancy,
  extractPriceChange,
  extractConversionRate,
  extractYieldRate,
  extractNetIncome,
  extractCafeClosure,
  extractRegionClosure,
  extractConsumerSentiment,
  extractMarketRentSeries,
  extractVacancySeries,
  extractPriceIndexSeries,
  extractCafeClosureSeries,
  extractConsumerSentimentSeries,
  buildIntegratedRent,
} from './dataMapper';

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
// [2026-05-28] PANEL_SPRING은 더 이상 width 애니메이션에 쓰지 않는다.
//   width는 layout-trigger property라 매 프레임 reflow 발생 → frame drop.
//   대신 width는 CSS로 즉시 적용하고, opacity만 framer로 페이드한다.
const PANEL_FADE = { duration: 0.5, ease: [0.22, 1, 0.36, 1] };
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

// ─── Card 1: Big Number + Mini Donut ───
const ChartBigNumberDonut = ({ data }) => {
  const hasData = data && typeof data.bigNumber === 'number';
  const bigNum = hasData ? data.bigNumber : 330;
  const unit = data?.unit || '개';
  const subtitle = data?.subtitle || '';
  // Card 1 상권 분석 리포트 확정 팔레트: 프랜차이즈=#1E3A8A, 개인카페=#3B82F6, 베이커리=#FFFFFF
  const CARD1_COLOR_OVERRIDE = {
    '프랜차이즈': '#1E3A8A',
    '개인카페': '#3B82F6',
    '베이커리': '#FFFFFF',
  };
  const rawSegments = data?.segments || [
    { name: '프랜차이즈', pct: 25 },
    { name: '개인카페', pct: 55 },
    { name: '베이커리', pct: 20 },
  ];
  const segments = rawSegments.map((seg) => ({
    ...seg,
    color: CARD1_COLOR_OVERRIDE[seg.name] || seg.color,
  }));

  const r = 32;
  const cx = 46;
  const cy = 46;
  const circumference = 2 * Math.PI * r;
  const totalPct = segments.reduce((s, seg) => s + (seg.pct || 0), 0) || 100;

  let cumulativeOffset = 0;
  const segmentsWithOffset = segments.map((seg) => {
    const pctNorm = (seg.pct || 0) / totalPct;
    const s = { ...seg, pctNorm, offset: -cumulativeOffset };
    cumulativeOffset += pctNorm * circumference;
    return s;
  });

  const MINI_COLORS = ['#1B2A4A', '#6B7280', '#374B78', '#5A6478', '#283755'];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 0', minHeight: 120 }}>
      {/* Left: Big Number */}
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 52, fontWeight: 800, color: COLORS.white,
            lineHeight: 1, letterSpacing: '-2px',
            fontFamily: "'Pretendard', -apple-system, sans-serif",
          }}>{bigNum.toLocaleString('ko-KR')}</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: COLORS.textMuted }}>{unit}</span>
        </div>
        {subtitle && (
          <p style={{
            fontSize: 12, color: COLORS.textMuted, marginTop: 8, lineHeight: 1.4,
            fontFamily: "'Pretendard', -apple-system, sans-serif",
          }}>{subtitle}</p>
        )}
      </div>
      {/* Right: Mini Donut */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.graphBgBar} strokeWidth={14}/>
          {segmentsWithOffset.map((seg, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.color || MINI_COLORS[i % MINI_COLORS.length]}
              strokeWidth={14}
              strokeDasharray={`${seg.pctNorm * circumference} ${circumference}`}
              strokeDashoffset={seg.offset}
              opacity={0.85}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {segments.slice(0, 3).map((seg, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: seg.color || MINI_COLORS[i % MINI_COLORS.length],
                display: 'inline-block', opacity: 0.8,
              }}/>
              <span style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: "'Pretendard', sans-serif" }}>
                {seg.name} {Math.round((seg.pct / totalPct) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Card 2: Semi-circle Gauge + Age Grid ───
const ChartGaugeGrid = ({ data }) => {
  const male = data?.male ?? 43;
  const female = data?.female ?? 57;
  const ageGroups = data?.ageGroups || [
    { name: '20대', pct: 22 },
    { name: '30대', pct: 34 },
    { name: '40대', pct: 24 },
    { name: '50대+', pct: 20 },
  ];

  const maleAngle = (male / 100) * 180;
  // Semi-circle gauge: left = male (blue), right = female (pink)
  const r = 50;
  const cx = 90;
  const cy = 60;
  const circumHalf = Math.PI * r; // half circle

  const maleArc = (male / 100) * circumHalf;
  const femaleArc = (female / 100) * circumHalf;

  // SVG arc path for semi-circle
  const describeArc = (startAngle, endAngle) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(Math.PI + startRad);
    const y1 = cy - r * Math.sin(Math.PI + startRad);
    const x2 = cx + r * Math.cos(Math.PI + endRad);
    const y2 = cy - r * Math.sin(Math.PI + endRad);
    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const maxPct = Math.max(...ageGroups.map(a => a.pct), 1);

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Semi-circle gauge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <svg width="180" height="80" viewBox="0 0 180 80">
          {/* Background arc */}
          <path d={describeArc(0, 180)} fill="none" stroke={COLORS.graphBgBar} strokeWidth={16} strokeLinecap="round"/>
          {/* Male arc (left side, from 0) */}
          <path d={describeArc(0, maleAngle)} fill="none" stroke="#4A7CCC" strokeWidth={16} strokeLinecap="round" opacity={0.85}/>
          {/* Female arc (right side) */}
          <path d={describeArc(maleAngle, 180)} fill="none" stroke="#CC6B8A" strokeWidth={16} strokeLinecap="round" opacity={0.85}/>
          {/* Labels */}
          <text x={28} y={75} textAnchor="middle" fill="#4A7CCC" fontSize={10} fontWeight={700} fontFamily="'Pretendard', sans-serif">{male}%</text>
          <text x={90} y={48} textAnchor="middle" fill={COLORS.textMuted} fontSize={8} fontFamily="'Pretendard', sans-serif">남 / 여</text>
          <text x={152} y={75} textAnchor="middle" fill="#CC6B8A" fontSize={10} fontWeight={700} fontFamily="'Pretendard', sans-serif">{female}%</text>
        </svg>
      </div>
      {/* Age group grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
        {ageGroups.map((ag, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, minWidth: 40,
              fontFamily: "'Pretendard', sans-serif",
            }}>{ag.name}</span>
            <div style={{
              flex: 1, height: 14, borderRadius: 7,
              background: COLORS.graphBgBar, overflow: 'hidden',
            }}>
              <div style={{
                width: `${(ag.pct / maxPct) * 100}%`, height: '100%', borderRadius: 7,
                background: i === 0 ? '#374B78' : i === 1 ? '#1B2A4A' : i === 2 ? '#5A6478' : '#6B7280',
                opacity: 0.85, transition: 'width 0.6s ease',
              }}/>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: COLORS.white, minWidth: 32, textAlign: 'right',
              fontFamily: "'Pretendard', sans-serif",
            }}>{ag.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Card 3: Ranking List ───
const ChartRankingList = ({ data }) => {
  const items = data?.items || [
    { name: '스타벅스', count: 5 },
    { name: '투썸플레이스', count: 3 },
    { name: '이디야', count: 3 },
    { name: '메가커피', count: 2 },
    { name: '빽다방', count: 1 },
  ];
  const maxCount = Math.max(...items.map(d => d.count), 1);
  const RANK_COLORS = ['#C9A84C', '#8C8C96', '#7C6E4E', '#5A6478', '#5A6478'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
      {items.slice(0, 5).map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Rank number */}
          <span style={{
            fontSize: i === 0 ? 22 : 16, fontWeight: 800, minWidth: 28, textAlign: 'center',
            color: i === 0 ? '#C9A84C' : COLORS.textMuted,
            fontFamily: "'Pretendard', -apple-system, sans-serif",
            lineHeight: 1,
          }}>{i + 1}</span>
          {/* Brand name */}
          <span style={{
            fontSize: 13, fontWeight: i === 0 ? 700 : 500, minWidth: 80,
            color: i === 0 ? COLORS.white : COLORS.textSecondary,
            fontFamily: "'Pretendard', sans-serif",
          }}>{item.name}</span>
          {/* Bar */}
          <div style={{
            flex: 1, height: i === 0 ? 18 : 14, borderRadius: 7,
            background: COLORS.graphBgBar, overflow: 'hidden',
          }}>
            <div style={{
              width: `${(item.count / maxCount) * 100}%`, height: '100%', borderRadius: 7,
              background: i === 0
                ? 'linear-gradient(90deg, #C9A84C, #E8D48B)'
                : RANK_COLORS[i] || '#5A6478',
              opacity: i === 0 ? 0.9 : 0.6,
              transition: 'width 0.6s ease',
            }}/>
          </div>
          {/* Count */}
          <span style={{
            fontSize: 12, fontWeight: 700, minWidth: 32, textAlign: 'right',
            color: i === 0 ? '#C9A84C' : COLORS.textMuted,
            fontFamily: "'Pretendard', sans-serif",
          }}>{item.count}개</span>
        </div>
      ))}
    </div>
  );
};

// ─── Card 4: Comparison Split ───
const ChartComparisonSplit = ({ data }) => {
  const left = data?.left || { label: '개인카페', count: 35, metrics: [] };
  const right = data?.right || { label: '프랜차이즈', count: 12, metrics: [] };

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, padding: '8px 0', minHeight: 110 }}>
      {/* Left side */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6,
          fontFamily: "'Pretendard', sans-serif",
        }}>{left.label}</span>
        <span style={{
          fontSize: 40, fontWeight: 800, color: COLORS.white, lineHeight: 1,
          fontFamily: "'Pretendard', -apple-system, sans-serif",
          letterSpacing: '-1px',
        }}>{(left.count || 0).toLocaleString('ko-KR')}</span>
        <span style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>개</span>
        {(left.metrics || []).length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            {left.metrics.map((m, i) => (
              <span key={i} style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'Pretendard', sans-serif" }}>
                {m.label}: {m.value}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Divider */}
      <div style={{
        width: 1, alignSelf: 'stretch',
        background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.15) 70%, transparent 100%)',
        margin: '8px 0',
      }}/>
      {/* Right side */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6,
          fontFamily: "'Pretendard', sans-serif",
        }}>{right.label}</span>
        <span style={{
          fontSize: 40, fontWeight: 800, color: COLORS.textMuted, lineHeight: 1,
          fontFamily: "'Pretendard', -apple-system, sans-serif",
          letterSpacing: '-1px',
        }}>{(right.count || 0).toLocaleString('ko-KR')}</span>
        <span style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>개</span>
        {(right.metrics || []).length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            {right.metrics.map((m, i) => (
              <span key={i} style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'Pretendard', sans-serif" }}>
                {m.label}: {m.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Card 5: Big Number + Mini Trend (매출 분석) ───
const ChartBigNumberTrend = ({ data }) => {
  const hasData = data && Array.isArray(data.values) && data.values.length > 0;
  const values = hasData ? data.values : [1950, 1870, 2010, 2080, 2150, 2200];
  const labels = hasData ? (data.labels || []) : ['11월', '12월', '1월', '2월', '3월', '4월'];
  const bigNumber = hasData ? (data.bigNumber || values[values.length - 1]) : 2200;
  const unit = (data && data.unit) || '만원';

  const fmtBig = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Math.round(n).toLocaleString('ko-KR');
  };

  const sparkW = 260;
  const sparkH = 40;
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values);
  const range = maxV - minV || 1;
  const xStep = values.length > 1 ? sparkW / (values.length - 1) : sparkW;
  const points = values.map((v, i) => [30 + i * xStep, 10 + sparkH - ((v - minV) / range) * sparkH]);
  const curveD = smoothPath(points);

  return (
    <div style={{ padding: '24px 20px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, fontWeight: 800, color: '#3182F6', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
        {data?.displayText ? data.displayText : <>{fmtBig(bigNumber)}<span style={{ fontSize: 24, fontWeight: 600, marginLeft: 4 }}>{unit}</span></>}
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6, marginBottom: 16 }}>
        월평균 매출
      </div>
      <svg width="100%" height="60" viewBox={`0 0 ${sparkW + 60} ${sparkH + 20}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="sparkTrendFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3182F6" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#3182F6" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <path d={curveD + ` L${points[points.length-1][0]},${sparkH + 12} L${points[0][0]},${sparkH + 12} Z`} fill="url(#sparkTrendFade)" />
        <path d={curveD} fill="none" stroke="#3182F6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.8}/>
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="#3182F6" opacity={i === points.length - 1 ? 1 : 0.5}/>
        ))}
        {labels.map((lbl, i) => (
          <text key={i} x={points[i]?.[0] || 0} y={sparkH + 20} textAnchor="middle" fill={COLORS.textMuted} fontSize={7} fontFamily="'Pretendard', -apple-system, sans-serif">{lbl}</text>
        ))}
      </svg>
    </div>
  );
};

// ─── Card 6: Heatmap Blocks (유동인구) ───
const ChartHeatmapBlocks = ({ data }) => {
  const hasData = data && Array.isArray(data.values) && data.values.length > 0;
  const values = hasData ? data.values : [3200, 5800, 7100, 6400, 4800, 2100];
  const labels = hasData ? (data.labels || []) : ['6~9시', '9~12시', '12~15시', '15~18시', '18~21시', '21~24시'];
  const maxV = Math.max(...values, 1);

  const getBlockColor = (value) => {
    const ratio = value / maxV;
    const opacity = 0.15 + ratio * 0.75;
    return `rgba(49,130,246,${opacity.toFixed(2)})`;
  };

  const fmtCount = (n) => {
    if (n >= 10000) return (n / 10000).toFixed(1) + '만';
    if (n >= 1000) return (n / 1000).toFixed(1) + '천';
    return String(n);
  };

  return (
    <div style={{ padding: '20px 16px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {values.map((val, i) => {
          const ratio = val / maxV;
          return (
            <div key={i} style={{
              background: getBlockColor(val),
              borderRadius: 12,
              padding: '16px 10px',
              textAlign: 'center',
              border: '1px solid rgba(49,130,246,0.15)',
            }}>
              <div style={{ fontSize: 11, color: ratio > 0.6 ? 'rgba(255,255,255,0.9)' : COLORS.textMuted, marginBottom: 6, fontWeight: 500 }}>
                {labels[i] || ''}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: ratio > 0.6 ? '#FFFFFF' : '#3182F6', letterSpacing: '-0.01em' }}>
                {fmtCount(val)}
              </div>
              <div style={{ fontSize: 10, color: ratio > 0.6 ? 'rgba(255,255,255,0.6)' : COLORS.textMuted, marginTop: 4 }}>
                {Math.round(ratio * 100)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Card 7: Price Cards (임대/창업 정보) ───
const ChartPriceCards = ({ data }) => {
  const hasData = data && Array.isArray(data.items) && data.items.length > 0;
  const items = hasData ? data.items : [
    { label: '보증금', value: 5000 },
    { label: '월임대', value: 320 },
    { label: '권리금', value: 3500 },
    { label: '인테리어', value: 4000 },
  ];
  const totalCost = (data && data.totalCost) || items.reduce((s, it) => s + (it.value || 0), 0);

  const fmtWon = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '-';
    // 만원 단위 입력 → 한국식 억/만 표기
    if (n >= 10000) {
      const eok = Math.floor(n / 10000);
      const man = Math.round(n % 10000);
      if (man > 0) return `${eok}억 ${man.toLocaleString('ko-KR')}만`;
      return `${eok}억`;
    }
    return Math.round(n).toLocaleString('ko-KR') + '만';
  };

  return (
    <div style={{ padding: '20px 16px 16px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
        gap: 8,
        marginBottom: 12,
      }}>
        {items.map((item, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '14px 8px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.white, letterSpacing: '-0.01em' }}>
              {fmtWon(item.value)}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        background: 'rgba(49,130,246,0.1)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid rgba(49,130,246,0.2)',
      }}>
        <span style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: 500 }}>총 예상 비용</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#3182F6', letterSpacing: '-0.01em' }}>{fmtWon(totalCost)}</span>
      </div>
    </div>
  );
};

// ─── Card 8: Split List (카페 기회 - 단일 컬럼) ───
// [카페 중심 재지향] externalIntel(Gemini Google Search) 기회 목록만 사용.
// 리스크 섹션 제거. 기회를 풀너비로 넓게 표시. 내부 데이터 폴백 절대 금지.
const ChartSplitList = ({ data }) => {
  // [카페 중심 재지향] 기회(opportunities)만 처리.
  const opportunities = Array.isArray(data?.opportunities) ? data.opportunities : [];

  const ITEM_HEIGHT = 200; // 카드 1건 높이 (1줄 summary 기준 컴팩트화)

  // SVG 아이콘 (이모지 금지)
  const IconUp = ({ color }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );

  const formatDate = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    // "2026-04-15" → "04.15"
    const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[2]}.${m[3]}`;
    return raw.slice(0, 10);
  };

  const SideColumn = ({ kind, items }) => {
    // [카페 중심 재지향] kind는 'opp' 고정. 리스크 색상/라벨 분기 제거.
    const baseColor = '#1E3A8A';
    const label = '카페 기회';
    const scrollRef = useRef(null);
    const [activeIdx, setActiveIdx] = useState(0);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      const onScroll = () => {
        const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
        if (idx !== activeIdx) setActiveIdx(idx);
      };
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => el.removeEventListener('scroll', onScroll);
    }, [activeIdx]);

    const scrollBoxStyle = {
      height: ITEM_HEIGHT,
      overflowY: 'auto',
      scrollSnapType: 'y mandatory',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      borderRadius: 16,
    };

    const renderCard = (item, i) => {
      const obj = typeof item === 'object' && item !== null ? item : { title: String(item || '') };
      const title = obj.title || obj.label || '';
      const summary = obj.summary || '';
      const tags = Array.isArray(obj.tags) ? obj.tags.filter(Boolean).slice(0, 4) : [];
      const url = obj.url || '';
      const hasUrl = !!(url && typeof url === 'string' && url.startsWith('http'));
      const dateStr = formatDate(obj.publishedAt);

      return (
        <div
          key={`${kind}-${i}`}
          style={{
            height: ITEM_HEIGHT,
            minHeight: ITEM_HEIGHT,
            boxSizing: 'border-box',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            padding: 20,
            borderRadius: 16,
            border: '1px solid rgba(30,58,138,0.25)',
            background: 'linear-gradient(135deg, rgba(30,58,138,0.08), rgba(30,58,138,0.02))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 12,
          }}
        >
          {/* 상단: 아이콘 + 날짜 (출처 제거 2026-05-02) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
            <IconUp color={baseColor} />
            {dateStr && (
              <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginLeft: 'auto' }}>{dateStr}</span>
            )}
          </div>

          {/* 제목 (제목은 흰색/무채색, 기회/리스크 구분은 배경·테두리·아이콘·해시태그로만) */}
          <div style={{
            fontSize: 17,
            fontWeight: 600,
            lineHeight: 1.35,
            color: '#f1f5f9',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {title || '제목 없음'}
          </div>

          {/* 요약 (1줄 고정, 넘치면 말줄임) */}
          {summary && (
            <div style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: '#94a3b8',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}>
              {summary}
            </div>
          )}

          {/* 하단: 태그 + 원문보기 */}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              {tags.map((tag, ti) => {
                const t = String(tag).replace(/^#/, '');
                return (
                  <span key={ti} style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(30,58,138,0.15)',
                    color: baseColor,
                    whiteSpace: 'nowrap',
                  }}>#{t}</span>
                );
              })}
            </div>
            {hasUrl && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: baseColor,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  opacity: 0.9,
                }}
              >원문 보기 ↗</a>
            )}
          </div>
        </div>
      );
    };

    const total = items.length;
    const currentIdx = total > 0 ? Math.min(activeIdx, total - 1) : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: baseColor,
          marginBottom: 10,
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 2,
          paddingRight: 2,
          overflow: 'visible',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ paddingLeft: 2 }}>{label}{total > 0 ? ` (${currentIdx + 1}/${total})` : ''}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <div ref={scrollRef} style={{ ...scrollBoxStyle, flex: 1, minWidth: 0 }}>
            {total > 0 ? (
              items.map((item, i) => renderCard(item, i))
            ) : (
              <div style={{
                height: ITEM_HEIGHT,
                border: '1px dashed rgba(30,58,138,0.25)',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: 'rgba(148,163,184,0.7)',
                padding: 20,
                textAlign: 'center',
                background: 'rgba(30,58,138,0.03)',
              }}>
                곧 업데이트됩니다
              </div>
            )}
          </div>

          {/* 세로 점 인디케이터 */}
          {total > 1 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 6,
              padding: '0 2px',
            }}>
              {items.map((_, i) => (
                <span key={i} style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === currentIdx ? baseColor : 'rgba(148,163,184,0.3)',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px 16px 16px', width: '100%', boxSizing: 'border-box', minWidth: 0 }}>
      {/* [카페 중심 재지향] 2분할 grid 제거. 기회 단일 컬럼 풀너비 */}
      <div style={{ width: '100%', minWidth: 0 }}>
        <SideColumn kind="opp" items={opportunities} />
      </div>
    </div>
  );
};

// ─── Card 9: Circular Progress (배달 분석) ───
const ChartCircularProgress = ({ data }) => {
  const hasData = data && Array.isArray(data.items) && data.items.length > 0;
  const items = hasData ? data.items : [
    { label: '\uCE58\uD0A8', value: 28 }, { label: '\uD55C\uC2DD', value: 22 }, { label: '\uBD84\uC2DD', value: 18 },
    { label: '\uC911\uC2DD', value: 14 }, { label: '\uCE74\uD398', value: 8 },
  ];
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const cols = items.length;
  const cellW = 56;
  const totalW = cols * cellW;
  const svgW = Math.max(totalW + 20, 300);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${svgW} 110`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      {items.map((item, i) => {
        const cx = (svgW - totalW) / 2 + i * cellW + cellW / 2;
        const cy = 38;
        const pct = Math.min(item.value, 100) / 100;
        const dash = pct * circumference;
        const isHighlight = item.label === '\uCE74\uD398';
        const strokeColor = isHighlight ? '#3182F6' : COLORS.graphMuted;
        const strokeOpacity = isHighlight ? 0.9 : 0.6;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.graphBgBar} strokeWidth={5} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={strokeColor} strokeWidth={5}
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round" opacity={strokeOpacity}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 0.4s ease' }}
            />
            <text x={cx} y={cy + 4} textAnchor="middle" fill={COLORS.white} fontSize={9} fontWeight={700}>{item.value}%</text>
            <text x={cx} y={78} textAnchor="middle" fill={COLORS.textMuted} fontSize={7} fontFamily="'Pretendard', -apple-system, sans-serif">{item.label}</text>
            {isHighlight && <rect x={cx - 14} y={86} width={28} height={14} rx={7} fill="rgba(49,130,246,0.15)" />}
            {isHighlight && <text x={cx} y={96} textAnchor="middle" fill="#3182F6" fontSize={6} fontWeight={600}>{'\uD604\uC7AC'}</text>}
          </g>
        );
      })}
    </svg>
  );
};

// ─── Card 10: Word Cloud (SNS 트렌드) ───
const ChartWordCloud = ({ data }) => {
  const hasData = data && data.keywords && data.keywords.length > 0;
  // 깨진 키워드 교체 맵 + 블랙리스트 (dataMapper.js와 동일)
  const WC_BROKEN_MAP = { '\uC2A0\uADDC\uC624\uD508': '\uC2E0\uADDC\uC624\uD508' };
  const WC_BLACKLIST = ['\uD558\uB4DC\uC6E8\uC5B4', '\uC18C\uD504\uD2B8\uC6E8\uC5B4', '\uC804\uC790\uC81C\uD488', '\uCEF4\uD4E8\uD130'];
  const sanitizeWC = (items) => items
    .map(k => {
      const fixed = WC_BROKEN_MAP[k.text] || k.text;
      if (WC_BLACKLIST.includes(fixed)) return null;
      return { ...k, text: fixed };
    })
    .filter(Boolean);
  // [v14] defaultKeywords \uC81C\uAC70 - \uBA54\uD0C0/\uC77C\uBC18\uB860 \uD0A4\uC6CC\uB4DC \uB178\uCD9C \uCC28\uB2E8. \uB370\uC774\uD130 \uC5C6\uC73C\uBA74 \uC6CC\uB4DC\uD074\uB77C\uC6B0\uB4DC \uC790\uCCB4 \uC228\uAE40
  const defaultKeywords = [];
  const keywords = sanitizeWC(hasData ? data.keywords : defaultKeywords);
  if (keywords.length === 0) {
    return null;
  }
  const displayCount = Math.min(keywords.length, 20);
  // 감성값 없으면 null 유지 -> 가짜 72/28 막대 대신 막대 자체를 숨김
  const sentimentPos = hasData && data.sentimentPos != null ? data.sentimentPos : null;
  const sentimentNeg = sentimentPos != null ? 100 - sentimentPos : null;
  const hasSentiment = sentimentPos != null;

  // Generate scattered positions for up to 20 keywords
  const positions = [
    { x: 55, y: 18 }, { x: 160, y: 12 }, { x: 270, y: 20 }, { x: 100, y: 35 },
    { x: 215, y: 32 }, { x: 310, y: 40 }, { x: 35, y: 48 }, { x: 140, y: 52 },
    { x: 245, y: 50 }, { x: 70, y: 68 }, { x: 185, y: 70 }, { x: 290, y: 65 },
    { x: 120, y: 82 }, { x: 230, y: 85 }, { x: 40, y: 88 }, { x: 310, y: 82 },
    { x: 170, y: 92 }, { x: 80, y: 98 }, { x: 260, y: 96 }, { x: 150, y: 30 },
  ];

  const maxWeight = Math.max(...keywords.slice(0, displayCount).map(k => k.weight), 1);

  // Generate unique float animation params per keyword
  const floatParams = useMemo(() => {
    return Array.from({ length: displayCount }, (_, i) => ({
      yOffset: 2 + (i % 5) * 0.8,
      xOffset: 1.5 + (i % 4) * 0.5,
      duration: 3 + (i % 7) * 0.6,
      delay: (i * 0.3) % 3,
    }));
  }, [displayCount]);

  return (
    <svg width="100%" height="100%" viewBox="0 0 340 150" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      <defs>
        <style>{`
          @keyframes wcFloat0 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(1.5px,-2.5px)} 66%{transform:translate(-1px,2px)} }
          @keyframes wcFloat1 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-1.8px,2px)} 75%{transform:translate(1.2px,-2.8px)} }
          @keyframes wcFloat2 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(2px,1.5px)} 80%{transform:translate(-1.5px,-2px)} }
          @keyframes wcFloat3 { 0%,100%{transform:translate(0,0)} 30%{transform:translate(-1px,-2.2px)} 60%{transform:translate(1.8px,1.8px)} }
          @keyframes wcFloat4 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(1.2px,2.5px)} }
        `}</style>
      </defs>
      {keywords.slice(0, displayCount).map((kw, i) => {
        const pos = positions[i % positions.length];
        const sizeRatio = kw.weight / maxWeight;
        const fontSize = 5 + sizeRatio * 9;
        const opacity = 0.35 + sizeRatio * 0.55;
        const fp = floatParams[i];
        const animName = `wcFloat${i % 5}`;
        const animDur = `${fp.duration}s`;
        const animDelay = `${fp.delay}s`;
        return (
          <text key={i} x={pos.x} y={pos.y} textAnchor="middle"
            fill={COLORS.white} fontSize={fontSize} fontWeight={sizeRatio > 0.6 ? 700 : sizeRatio > 0.3 ? 600 : 400}
            opacity={opacity} fontFamily="'Pretendard', -apple-system, sans-serif"
            style={{ animation: `${animName} ${animDur} ease-in-out ${animDelay} infinite` }}
          >{kw.text}</text>
        );
      })}
      {hasSentiment && (
        <>
          <rect x={40} y={118} width={260} height={7} rx={3.5} fill={COLORS.graphBgBar} />
          <rect x={40} y={118} width={260 * sentimentPos / 100} height={7} rx={3.5} fill="rgba(52,199,89,0.7)" />
          <rect x={40 + 260 * sentimentPos / 100} y={118} width={260 * sentimentNeg / 100} height={7} rx={3.5} fill="rgba(255,69,58,0.5)" />
          <text x={40} y={138} fill="rgba(52,199,89,0.8)" fontSize={7} fontWeight={600} fontFamily="'Pretendard', -apple-system, sans-serif">{'\uAE0D\uC815'} {sentimentPos}%</text>
          <text x={300} y={138} textAnchor="end" fill="rgba(255,69,58,0.7)" fontSize={7} fontWeight={600} fontFamily="'Pretendard', -apple-system, sans-serif">{'\uBD80\uC815'} {sentimentNeg}%</text>
        </>
      )}
    </svg>
  );
};

// ─── Card 11: Weather Impact (날씨 영향) ───
const WeatherSvgIcon = ({ type, x, y, color }) => {
  switch (type) {
    case 'sun':
      return (
        <g>
          <circle cx={x} cy={y} r={6} fill="none" stroke={color} strokeWidth={1.2} />
          {[0,45,90,135,180,225,270,315].map(a => {
            const rad = a * Math.PI / 180;
            return <line key={a} x1={x+8*Math.cos(rad)} y1={y+8*Math.sin(rad)} x2={x+10*Math.cos(rad)} y2={y+10*Math.sin(rad)} stroke={color} strokeWidth={1} strokeLinecap="round" />;
          })}
        </g>
      );
    case 'cloud':
      return <path d={`M${x-8},${y+3} a5,5 0 0,1 4,-7 a6,6 0 0,1 10,0 a4,4 0 0,1 2,7 Z`} fill="none" stroke={color} strokeWidth={1.2} />;
    case 'rain':
      return (
        <g>
          <path d={`M${x-7},${y} a4,4 0 0,1 3,-5 a5,5 0 0,1 8,0 a3,3 0 0,1 2,5 Z`} fill="none" stroke={color} strokeWidth={1} />
          <line x1={x-3} y1={y+4} x2={x-4} y2={y+8} stroke={color} strokeWidth={1} strokeLinecap="round" />
          <line x1={x+1} y1={y+4} x2={x} y2={y+8} stroke={color} strokeWidth={1} strokeLinecap="round" />
          <line x1={x+5} y1={y+4} x2={x+4} y2={y+8} stroke={color} strokeWidth={1} strokeLinecap="round" />
        </g>
      );
    case 'snow':
      return (
        <g>
          <path d={`M${x-7},${y-2} a4,4 0 0,1 3,-5 a5,5 0 0,1 8,0 a3,3 0 0,1 2,5 Z`} fill="none" stroke={color} strokeWidth={1} />
          <text x={x-3} y={y+8} fill={color} fontSize={5} fontFamily="sans-serif">*</text>
          <text x={x+2} y={y+7} fill={color} fontSize={4} fontFamily="sans-serif">*</text>
          <text x={x+5} y={y+9} fill={color} fontSize={5} fontFamily="sans-serif">*</text>
        </g>
      );
    default: return null;
  }
};

// 연간 기상 분포 차트: 실측 일수 기반 가로 막대. 매출 영향% 표기 제거 (2026-04-15).
const ChartWeatherImpact = ({ data }) => {
  const hasData = data && Array.isArray(data.items) && data.items.length > 0;
  const items = hasData ? data.items : [
    { label: '\uB9D1\uC74C', icon: 'sun', value: 0, unit: '\uC77C' },
    { label: '\uD750\uB9BC', icon: 'cloud', value: 0, unit: '\uC77C' },
    { label: '\uBE44', icon: 'rain', value: 0, unit: '\uC77C' },
    { label: '\uB208', icon: 'snow', value: 0, unit: '\uC77C' },
  ];
  const totalForPct = items.reduce((s, it) => s + (Number(it.value) || 0), 0);
  const maxV = Math.max(...items.map(d => Number(d.value) || 0), 1);
  const barMaxW = 180;
  const startX = 80;
  const palette = {
    sun: 'rgba(255,204,0,0.85)',
    cloud: 'rgba(174,174,178,0.75)',
    rain: 'rgba(10,132,255,0.85)',
    snow: 'rgba(191,219,254,0.85)',
  };
  return (
    <svg width="100%" height="100%" viewBox="0 0 340 135" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      {items.map((item, i) => {
        const y = 22 + i * 26;
        const val = Number(item.value) || 0;
        const bW = (val / maxV) * barMaxW;
        const fillColor = palette[item.icon] || 'rgba(120,120,128,0.6)';
        const pct = totalForPct > 0 ? Math.round((val / totalForPct) * 1000) / 10 : 0;
        const unit = item.unit || '\uC77C';
        return (
          <g key={i}>
            <WeatherSvgIcon type={item.icon} x={25} y={y} color={COLORS.textSecondary} />
            <text x={52} y={y + 4} fill={COLORS.textMuted} fontSize={8} fontWeight={500} fontFamily="'Pretendard', -apple-system, sans-serif">{item.label}</text>
            <rect x={startX} y={y - 6} width={Math.max(bW, 1)} height={12} rx={4} fill={fillColor} style={{ transition: 'width 0.3s ease' }} />
            <text x={startX + Math.max(bW, 1) + 6} y={y + 4}
              textAnchor="start"
              fill={COLORS.textSecondary}
              fontSize={8} fontWeight={700} fontFamily="'Pretendard', -apple-system, sans-serif">
              {val}{unit}
              <tspan fill={COLORS.textMuted} fontWeight={500}>  {pct}%</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── [v25] Card 11: 월별 비·눈 캘린더 (클릭 시 일별 상세) ───
const MonthlyCalendarGrid = ({ months }) => {
  const [openMonth, setOpenMonth] = React.useState(null);
  const maxRain = Math.max(...months.map(m => m.rainDays || 0), 1);
  const maxSnow = Math.max(...months.map(m => m.snowDays || 0), 1);
  const dayTypeIcon = { sunny: '맑', cloudy: '흐', rain: '비', snow: '눈' };
  const dayTypeColor = {
    sunny: 'rgba(251,191,36,0.7)',
    cloudy: 'rgba(156,163,175,0.55)',
    rain: 'rgba(59,130,246,0.85)',
    snow: 'rgba(191,219,254,0.85)',
  };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
        {months.map((mo, mi) => {
          const isOpen = openMonth === mi;
          const rainStrength = (mo.rainDays || 0) / maxRain;
          const snowStrength = (mo.snowDays || 0) / maxSnow;
          const dominant = (mo.snowDays || 0) > 0 && snowStrength > rainStrength ? 'snow' : 'rain';
          const bgColor = dominant === 'snow'
            ? `rgba(191,219,254,${0.10 + snowStrength * 0.45})`
            : `rgba(59,130,246,${0.06 + rainStrength * 0.45})`;
          return (
            <div
              key={mi}
              onClick={() => setOpenMonth(isOpen ? null : mi)}
              style={{
                background: bgColor,
                border: isOpen ? '1.5px solid rgba(125,211,252,0.7)' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
                padding: '8px 6px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border 0.15s ease',
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>{mo.month}월</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>비 {mo.rainDays}일</div>
              {mo.snowDays > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(191,219,254,1)', marginTop: 2 }}>눈 {mo.snowDays}일</div>
              )}
              {mo.avgTemp != null && (
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{mo.avgTemp}°C</div>
              )}
            </div>
          );
        })}
      </div>
      {openMonth != null && Array.isArray(months[openMonth]?.days) && months[openMonth].days.length > 0 && (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: 'rgba(15,23,42,0.4)',
          border: '1px solid rgba(125,211,252,0.25)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary }}>{months[openMonth].month}월 일별 날씨</span>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>
              비 {months[openMonth].rainDays}일 · 눈 {months[openMonth].snowDays}일
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {months[openMonth].days.map((d, di) => (
              <div key={di} style={{
                background: dayTypeColor[d.t] || 'rgba(120,120,128,0.3)',
                borderRadius: 6,
                padding: '6px 4px',
                textAlign: 'center',
                color: d.t === 'rain' || d.t === 'sunny' ? '#0f172a' : COLORS.textPrimary,
              }}>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{d.d}일</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{dayTypeIcon[d.t] || '?'}</div>
                {d.p > 0 && (
                  <div style={{ fontSize: 9, marginTop: 2, opacity: 0.8 }}>{d.p}mm</div>
                )}
                {d.tmax != null && d.tmin != null && (
                  <div style={{ fontSize: 9, marginTop: 2, opacity: 0.7 }}>{d.tmax}/{d.tmin}°</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Card 12: Gauge Meter (경쟁 분석) ───
const ChartGaugeMeter = ({ data }) => {
  const hasData = data && data.score != null;
  const score = hasData ? Math.min(Math.max(data.score, 0), 100) : 72;
  const label = (hasData && data.label) ? data.label : '\uACBD\uC7C1 \uAC15\uB3C4';
  const cx = 160, cy = 95, r = 70;
  const startAngle = Math.PI, endAngle = 2 * Math.PI;
  const totalAngle = endAngle - startAngle;
  const describeArc = (sA, eA) => {
    const x1 = cx + r * Math.cos(sA), y1 = cy + r * Math.sin(sA);
    const x2 = cx + r * Math.cos(eA), y2 = cy + r * Math.sin(eA);
    return `M ${x1},${y1} A ${r},${r} 0 ${(eA - sA) > Math.PI ? 1 : 0} 1 ${x2},${y2}`;
  };
  const needleAngle = startAngle + (score / 100) * totalAngle;
  const nx = cx + (r - 10) * Math.cos(needleAngle);
  const ny = cy + (r - 10) * Math.sin(needleAngle);
  const scoreColor = score <= 33 ? 'rgba(52,199,89,0.9)' : score <= 66 ? 'rgba(255,204,0,0.9)' : 'rgba(255,69,58,0.9)';
  return (
    <svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="gaugeGradCard12" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(52,199,89,0.7)" />
          <stop offset="50%" stopColor="rgba(255,204,0,0.7)" />
          <stop offset="100%" stopColor="rgba(255,69,58,0.7)" />
        </linearGradient>
      </defs>
      <path d={describeArc(startAngle, endAngle)} fill="none" stroke={COLORS.graphBgBar} strokeWidth={14} strokeLinecap="round" />
      <path d={describeArc(startAngle, endAngle)} fill="none" stroke="url(#gaugeGradCard12)" strokeWidth={14} strokeLinecap="round" />
      <text x={cx - r - 5} y={cy + 16} textAnchor="middle" fill={COLORS.textMuted} fontSize={7}>0</text>
      <text x={cx} y={cy - r + 2} textAnchor="middle" fill={COLORS.textMuted} fontSize={7}>50</text>
      <text x={cx + r + 5} y={cy + 16} textAnchor="middle" fill={COLORS.textMuted} fontSize={7}>100</text>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={COLORS.white} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      <circle cx={cx} cy={cy} r={4} fill={COLORS.white} opacity={0.6} />
      <text x={cx} y={cy + 28} textAnchor="middle" fill={scoreColor} fontSize={20} fontWeight={800} fontFamily="'Pretendard', -apple-system, sans-serif">{score}</text>
      <text x={cx} y={cy + 42} textAnchor="middle" fill={COLORS.textMuted} fontSize={8} fontFamily="'Pretendard', -apple-system, sans-serif">{label}</text>
    </svg>
  );
};

// ─── Card 12 (v14): Competition Score — 5축 점수 Hero + 막대 ───
const ChartCompetitionScore = ({ data }) => {
  const hasData = data && data.overallScore != null && data.axes;
  const fallbackAxes = {
    density:            { value: 5,    score: 75,  unit: '개/km²', label: '카페 밀도' },
    franchiseRatio:     { value: 40,   score: 60,  unit: '%',      label: '프랜차이즈 비율' },
    potentialPerStore:  { value: 10000, score: 20, unit: '명',     label: '카페당 잠재 고객' },
    openCloseTrend:     { value: 0,    score: 50,  unit: '비율',   label: '개폐업 추세' },
    salesRentMargin:    { value: 0.5,  score: 50,  unit: '비율',   label: '매출-임대 여유' },
  };
  const overallScore = hasData ? Math.min(Math.max(data.overallScore, 0), 100) : 68;
  const tierLabel    = hasData ? data.tierLabel : '양호';
  const tierColor    = hasData ? data.tierColor : '#FBBF24';
  const axesMap      = hasData ? data.axes : fallbackAxes;

  // axes 순서 고정 (dataMapper/utils 와 동일)
  const axisOrder = ['density', 'franchiseRatio', 'potentialPerStore', 'openCloseTrend', 'salesRentMargin'];
  const axesList = axisOrder
    .map(k => ({ key: k, ...(axesMap[k] || {}) }))
    .filter(a => a.score != null);

  const formatAxisValue = (a) => {
    if (a.key === 'density') return `${a.value} ${a.unit}`;
    if (a.key === 'franchiseRatio') return `${a.value}%`;
    if (a.key === 'potentialPerStore') return `${(a.value || 0).toLocaleString()}명`;
    if (a.key === 'openCloseTrend') return `${a.value > 0 ? '+' : ''}${a.value}`;
    if (a.key === 'salesRentMargin') return `${a.value}`;
    return String(a.value);
  };

  const barColor = (score) => {
    if (score >= 80) return '#1E3A8A';
    if (score >= 60) return '#FBBF24';
    if (score >= 40) return '#F59E0B';
    return '#F04452';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 6px' }}>
      {/* Hero: 종합 점수 + 구간 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: tierColor, lineHeight: 1, fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
            {overallScore}
          </span>
          <span style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>종합 경쟁 점수 (0~100)</span>
        </div>
        <div style={{
          background: tierColor,
          color: '#0B0F19',
          fontSize: 13,
          fontWeight: 700,
          padding: '6px 12px',
          borderRadius: 999,
          fontFamily: "'Pretendard', -apple-system, sans-serif",
        }}>
          {tierLabel}
        </div>
      </div>

      {/* 5개 축 막대 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {axesList.map((a) => (
          <div key={a.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 600 }}>{a.label}</span>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                {formatAxisValue(a)} <span style={{ color: barColor(a.score), fontWeight: 700, marginLeft: 6 }}>{a.score}점</span>
              </span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(Math.max(a.score, 0), 100)}%`,
                height: '100%',
                background: barColor(a.score),
                borderRadius: 4,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Card 13: Score Card + Radar (AI 종합) ───
const ChartScoreCard = ({ data }) => {
  const hasData = data && data.overall != null;
  const overall = hasData ? data.overall : 72;
  const axes = hasData && data.axes ? data.axes : [
    { label: '\uAE30\uD68C', value: 68 }, { label: '\uC548\uC804', value: 65 },
    { label: '\uACBD\uC7C1', value: 55 }, { label: '\uB9E4\uCD9C', value: 70 }, { label: '\uC785\uC9C0', value: 78 },
  ];
  const overallColor = overall >= 70 ? 'rgba(52,199,89,0.9)' : overall >= 40 ? 'rgba(255,204,0,0.9)' : 'rgba(255,69,58,0.9)';
  const radarCx = 230, radarCy = 70, radarR = 45;
  const n = axes.length;
  const angleStep = (2 * Math.PI) / n;
  const startOff = -Math.PI / 2;
  const getPoint = (i, scale) => ({
    x: radarCx + radarR * scale * Math.cos(startOff + i * angleStep),
    y: radarCy + radarR * scale * Math.sin(startOff + i * angleStep),
  });
  const rings = [0.33, 0.66, 1.0];
  const dataPts = axes.map((ax, i) => getPoint(i, Math.min(ax.value, 100) / 100));
  const dataD = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
  return (
    <svg width="100%" height="100%" viewBox="0 0 340 150" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      <circle cx={80} cy={70} r={42} fill="none" stroke={COLORS.graphBgBar} strokeWidth={5} />
      <circle cx={80} cy={70} r={42} fill="none" stroke={overallColor} strokeWidth={5}
        strokeDasharray={`${(overall / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
        strokeLinecap="round" transform="rotate(-90 80 70)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      <text x={80} y={65} textAnchor="middle" fill={COLORS.white} fontSize={22} fontWeight={800} fontFamily="'Pretendard', -apple-system, sans-serif">{overall}</text>
      <text x={80} y={82} textAnchor="middle" fill={COLORS.textMuted} fontSize={9} fontFamily="'Pretendard', -apple-system, sans-serif">{'\uC885\uD569 \uC810\uC218'}</text>
      <text x={80} y={128} textAnchor="middle" fill={overallColor} fontSize={10} fontWeight={600} fontFamily="'Pretendard', -apple-system, sans-serif">
        {overall >= 70 ? '\uC591\uD638' : overall >= 40 ? '\uBCF4\uD1B5' : '\uC8FC\uC758'}
      </text>
      {rings.map((ring, ri) => {
        const pts = Array.from({ length: n }, (_, i) => getPoint(i, ring));
        return <path key={ri} d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'} fill="none" stroke={COLORS.white} strokeWidth={0.4} opacity={0.08} />;
      })}
      {axes.map((_, i) => {
        const p = getPoint(i, 1);
        return <line key={i} x1={radarCx} y1={radarCy} x2={p.x} y2={p.y} stroke={COLORS.white} strokeWidth={0.3} opacity={0.1} />;
      })}
      <path d={dataD} fill="rgba(49,130,246,0.15)" stroke="rgba(49,130,246,0.6)" strokeWidth={1.2} />
      {dataPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="rgba(49,130,246,0.8)" />)}
      {axes.map((ax, i) => {
        const p = getPoint(i, 1.22);
        return <text key={i} x={p.x} y={p.y + 3} textAnchor="middle" fill={COLORS.textMuted} fontSize={7} fontFamily="'Pretendard', -apple-system, sans-serif">{ax.label}</text>;
      })}
    </svg>
  );
};

// ─── Card 14: AI Insight Dashboard (v14 - 시각 중심 종합) ───
// headline + 3 KPI + Recharts RadarChart + Signals + Tags
// data: { headline, kpis[], radarAxes[], signals[], tags[], overall, axes[] }
const ChartInsightDashboard = ({ data }) => {
  const hasData = data && (data.headline || data.kpis?.length > 0 || data.radarAxes?.length > 0);
  const headline = hasData && data.headline ? String(data.headline) : '데이터 부족';
  const analysis = hasData && data.analysis ? String(data.analysis) : '';
  const kpis = hasData && Array.isArray(data.kpis) && data.kpis.length > 0 ? data.kpis : [
    { label: '종합 점수', value: 0, unit: '점', trend: '유지' },
    { label: '기회', value: 0, unit: '건', trend: '유지' },
    { label: '리스크', value: 0, unit: '건', trend: '유지' },
  ];
  const radarData = hasData && Array.isArray(data.radarAxes) && data.radarAxes.length > 0 ? data.radarAxes : [
    { axis: '밀집도', value: 0, fullMark: 100 },
    { axis: '경쟁', value: 0, fullMark: 100 },
    { axis: '잠재력', value: 0, fullMark: 100 },
    { axis: '추세', value: 0, fullMark: 100 },
    { axis: '비용여유', value: 0, fullMark: 100 },
  ];
  const signals = hasData && Array.isArray(data.signals) ? data.signals : [];
  const tags = hasData && Array.isArray(data.tags) ? data.tags : [];

  // Trend arrow
  const trendArrow = (t) => {
    if (t === '상승') return { glyph: '▲', color: '#34C759' };
    if (t === '하락') return { glyph: '▼', color: '#FF453A' };
    return { glyph: '—', color: 'rgba(255,255,255,0.45)' };
  };

  // Signal icon
  const signalIcon = (type) => {
    if (type === 'positive') return { glyph: '+', color: '#34C759', bg: 'rgba(52,199,89,0.09)' };
    if (type === 'negative') return { glyph: '−', color: '#FF453A', bg: 'rgba(255,69,58,0.09)' };
    return { glyph: '·', color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.04)' };
  };

  return (
    <div style={{
      width: '100%', padding: 0, boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 18,
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* Headline */}
      <div style={{
        fontSize: 'clamp(1.4rem, 3.2vw, 2.1rem)',
        fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.02em',
        color: COLORS.white, textAlign: 'left', wordBreak: 'keep-all',
      }}>
        {headline}
      </div>

      {/* KPI 3개 (가로 배치, 모바일에서도 유지) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {kpis.slice(0, 3).map((kpi, i) => {
          const arrow = trendArrow(kpi.trend);
          return (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '10px 10px 12px',
              display: 'flex', flexDirection: 'column', gap: 4,
              minWidth: 0,
            }}>
              <div style={{
                fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{kpi.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                <span style={{
                  fontSize: 'clamp(16px, 2.2vw, 22px)', fontWeight: 800, color: COLORS.white,
                  letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {kpi.value}
                </span>
                {kpi.unit && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                    {kpi.unit}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: arrow.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 10 }}>{arrow.glyph}</span>
                <span>{kpi.trend || '유지'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analysis 본문 */}
      {analysis && (
        <div style={{ padding: '4px 0' }}>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600,
            marginBottom: 12, letterSpacing: '0.03em',
          }}>
            디렉터 분석
          </div>
          <div style={{
            fontSize: 15, color: 'rgba(255,255,255,0.88)', lineHeight: 1.85,
            fontWeight: 400, wordBreak: 'keep-all',
          }}>
            {analysis.split(/\n+/).filter(Boolean).map((para, i) => (
              <p key={i} style={{
                margin: 0, marginBottom: i < analysis.split(/\n+/).filter(Boolean).length - 1 ? 14 : 0,
              }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Radar Chart (Recharts) */}
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="75%">
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11, fontFamily: "'Pretendard', sans-serif" }}
            />
            <PolarRadiusAxis
              angle={90} domain={[0, 100]} tickCount={5}
              tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }}
              stroke="rgba(255,255,255,0.08)" axisLine={false}
            />
            <Radar
              name="score" dataKey="value"
              stroke="rgba(49,130,246,0.85)" strokeWidth={1.6}
              fill="rgba(49,130,246,0.2)" fillOpacity={1}
              dot={{ r: 3, fill: 'rgba(49,130,246,0.95)', stroke: 'rgba(255,255,255,0.9)', strokeWidth: 1 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Signals 리스트 */}
      {signals.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.02em' }}>
            주요 시그널
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {signals.map((s, i) => {
              const icon = signalIcon(s.type);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: icon.bg, borderRadius: 10, padding: '8px 12px',
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, borderRadius: '50%',
                    fontSize: 13, fontWeight: 700, color: icon.color, flexShrink: 0,
                  }}>
                    {icon.glyph}
                  </span>
                  <span style={{ fontSize: 13, color: COLORS.white, lineHeight: 1.4, fontWeight: 500 }}>
                    {s.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags (외부 신호 키워드 칩) */}
      {tags.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.02em' }}>
            외부 신호
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.map((t, i) => (
              <span key={i} style={{
                fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap',
              }}>
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Card 12: Market Trend (상권 변화 추이) ───
const ChartMarketTrend = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  const hasData = data && Array.isArray(data.trendValues) && data.trendValues.length > 0;

  // Generate month labels (recent 6 months)
  const generateMonthLabels = (count = 6) => {
    const now = new Date();
    const labels = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      labels.push(`${yy}.${mm}`);
    }
    return labels;
  };

  let monthLabels, trendVals, openVals, closeVals;
  if (hasData) {
    monthLabels = data.monthLabels || generateMonthLabels(data.trendValues.length);
    trendVals = data.trendValues;
    openVals = data.openValues || trendVals.map(() => 0);
    closeVals = data.closeValues || trendVals.map(() => 0);
  } else {
    monthLabels = generateMonthLabels(6);
    trendVals = [45, 50, 48, 52, 55, 58];
    openVals = [2, 1, 3, 2, 1, 2];
    closeVals = [1, 2, 1, 3, 1, 1];
  }

  const n = trendVals.length;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 30;
  const padBottom = 40;
  const chartW = 340 - padLeft - padRight;
  const chartH = 145 - padTop - padBottom;
  const maxTrend = Math.max(...trendVals, 100);
  const minTrend = Math.min(...trendVals, 0);
  const rangeTrend = maxTrend - minTrend || 1;

  const xStep = n > 1 ? chartW / (n - 1) : chartW;
  const trendPoints = trendVals.map((v, i) => [
    padLeft + i * xStep,
    padTop + chartH - ((v - minTrend) / rangeTrend) * chartH,
  ]);
  const curveD = smoothPath(trendPoints);
  const areaD = curveD + ` L${trendPoints[n - 1][0]},${padTop + chartH} L${trendPoints[0][0]},${padTop + chartH} Z`;

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100].filter(v => v >= minTrend && v <= maxTrend + 10);
  const getY = (v) => padTop + chartH - ((v - minTrend) / rangeTrend) * chartH;

  // Open/close max for bar scaling
  const maxOC = Math.max(...openVals, ...closeVals, 1);
  const barMaxH = 18;
  const barW = Math.min(6, xStep * 0.25);

  const lastIdx = n - 1;
  const lastVal = trendVals[lastIdx];

  return (
    <svg width="100%" height="100%" viewBox="0 0 340 170" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="marketTrendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
        </linearGradient>
        <filter id="glowLast">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Y-axis label (vertical) */}
      <text x={6} y={padTop + chartH / 2} textAnchor="middle" fill="#999999" fontSize={6}
        fontFamily="'Pretendard', -apple-system, sans-serif"
        transform={`rotate(-90, 6, ${padTop + chartH / 2})`}>
        장사 안정성 지수
      </text>

      {/* Y-axis ticks + grid lines */}
      {yTicks.map(v => {
        const yPos = getY(v);
        return (
          <g key={`ytick-${v}`}>
            <line x1={padLeft - 4} y1={yPos} x2={padLeft + chartW} y2={yPos} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
            <text x={padLeft - 6} y={yPos + 3} textAnchor="end" fill="#999999" fontSize={6.5}
              fontFamily="'Pretendard', -apple-system, sans-serif">{v}</text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaD} fill="url(#marketTrendArea)" />

      {/* Trend line */}
      <path d={curveD} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />

      {/* Open/Close bar markers at each point */}
      {trendPoints.map((p, i) => {
        const openH = (openVals[i] / maxOC) * barMaxH;
        const closeH = (closeVals[i] / maxOC) * barMaxH;
        const baseY = padTop + chartH + 2;
        return (
          <g key={`oc-${i}`}>
            {/* Open bar (blue, upward from baseline area) */}
            {openVals[i] > 0 && (
              <circle cx={p[0] - barW * 0.8} cy={p[1] - 1} r={Math.max(2, openH * 0.5)}
                fill="#4A90D9" opacity={0.8} />
            )}
            {/* Close bar (red) */}
            {closeVals[i] > 0 && (
              <circle cx={p[0] + barW * 0.8} cy={p[1] + 1} r={Math.max(2, closeH * 0.5)}
                fill="#E74C3C" opacity={0.8} />
            )}
          </g>
        );
      })}

      {/* Data points on trend line */}
      {trendPoints.map((p, i) => (
        <g key={`pt-${i}`}>
          <circle cx={p[0]} cy={p[1]}
            r={i === lastIdx ? 5 : (hovered === i ? 4.5 : 2.5)}
            fill={i === lastIdx ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
            opacity={i === lastIdx ? 1 : (hovered === i ? 0.9 : 0.6)}
            filter={i === lastIdx ? 'url(#glowLast)' : undefined}
            style={{ cursor: 'pointer', transition: 'r 0.15s, opacity 0.15s' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(i)}
          />
        </g>
      ))}

      {/* Last point "현재" label */}
      <text x={trendPoints[lastIdx][0] + 8} y={trendPoints[lastIdx][1] - 6}
        fill="#FFFFFF" fontSize={7} fontWeight={700}
        fontFamily="'Pretendard', -apple-system, sans-serif">
        {lastVal}
      </text>
      <text x={trendPoints[lastIdx][0] + 8} y={trendPoints[lastIdx][1] + 3}
        fill="#999999" fontSize={6}
        fontFamily="'Pretendard', -apple-system, sans-serif">
        현재
      </text>

      {/* X-axis month labels */}
      {trendPoints.map((p, i) => (
        <text key={`xl-${i}`} x={p[0]} y={padTop + chartH + 14} textAnchor="middle"
          fill="#999999" fontSize={6.5}
          fontFamily="'Pretendard', -apple-system, sans-serif">
          {monthLabels[i]}
        </text>
      ))}

      {/* Legend (top right, inside chart area) */}
      <g transform={`translate(${padLeft + chartW - 105}, ${padTop + 2})`}>
        <rect x={-5} y={-8} width={110} height={16} rx={3} fill="rgba(0,0,0,0.5)" />
        <circle cx={0} cy={0} r={3.5} fill="#4A90D9" />
        <text x={7} y={3} fill="rgba(255,255,255,0.7)" fontSize={7.5} fontFamily="'Pretendard', -apple-system, sans-serif">개업</text>
        <circle cx={35} cy={0} r={3.5} fill="#E74C3C" />
        <text x={42} y={3} fill="rgba(255,255,255,0.7)" fontSize={7.5} fontFamily="'Pretendard', -apple-system, sans-serif">폐업</text>
        <line x1={70} y1={0} x2={82} y2={0} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} strokeLinecap="round" />
        <text x={85} y={3} fill="rgba(255,255,255,0.7)" fontSize={7.5} fontFamily="'Pretendard', -apple-system, sans-serif">흐름</text>
      </g>

      {/* Tooltip on hover */}
      {hovered !== null && (
        <g>
          <rect x={trendPoints[hovered][0] - 28} y={trendPoints[hovered][1] - 26}
            width={56} height={18} rx={4} fill="rgba(0,0,0,0.75)" />
          <text x={trendPoints[hovered][0]} y={trendPoints[hovered][1] - 14}
            textAnchor="middle" fill="#FFFFFF" fontSize={7} fontWeight={600}
            fontFamily="'Pretendard', -apple-system, sans-serif">
            지수 {trendVals[hovered]} | +{openVals[hovered]} -{closeVals[hovered]}
          </text>
        </g>
      )}

      {/* 출처 텍스트 제거 (2026-05-02 의뢰인 요청) */}
    </svg>
  );
};

// Returns a chart element with real data from card.chartData, falling back to demo data if null
const getChartForCard = (card) => {
  if (!card) return null;
  // Cards with no chart (e.g. SNS trends) - return null to skip chart area
  if (card.chartType === null && card.chartData === null) return null;
  const chartData = card.chartData || null;
  switch (card.chartType) {
    case 'bar': return chartData ? <ChartBar data={chartData} /> : <ChartBar />;
    case 'line': return chartData ? <ChartLine data={chartData} /> : <ChartLine />;
    case 'area': return chartData ? <ChartArea data={chartData} /> : <ChartArea />;
    case 'donut': return chartData ? <ChartDonut data={chartData} /> : <ChartDonut />;
    case 'horizontal-bar': return chartData ? <ChartHorizontalBar data={chartData} /> : <ChartHorizontalBar />;
    case 'mixed': return chartData ? <ChartMixed data={chartData} /> : <ChartMixed />;
    case 'bigNumberDonut': return chartData ? <ChartBigNumberDonut data={chartData} /> : <ChartBigNumberDonut />;
    case 'gaugeGrid': return chartData ? <ChartGaugeGrid data={chartData} /> : <ChartGaugeGrid />;
    case 'rankingList': return chartData ? <ChartRankingList data={chartData} /> : <ChartRankingList />;
    case 'comparisonSplit': return chartData ? <ChartComparisonSplit data={chartData} /> : <ChartComparisonSplit />;
    case 'bigNumberTrend': return chartData ? <ChartBigNumberTrend data={chartData} /> : <ChartBigNumberTrend />;
    case 'heatmapBlocks': return chartData ? <ChartHeatmapBlocks data={chartData} /> : <ChartHeatmapBlocks />;
    case 'priceCards': return chartData ? <ChartPriceCards data={chartData} /> : <ChartPriceCards />;
    case 'splitList': return chartData ? <ChartSplitList data={chartData} /> : <ChartSplitList />;
    case 'circularProgress': return chartData ? <ChartCircularProgress data={chartData} /> : <ChartCircularProgress />;
    case 'wordCloud': return chartData ? <ChartWordCloud data={chartData} /> : <ChartWordCloud />;
    case 'weatherImpact': return chartData ? <ChartWeatherImpact data={chartData} /> : <ChartWeatherImpact />;
    case 'gaugeMeter': return chartData ? <ChartGaugeMeter data={chartData} /> : <ChartGaugeMeter />;
    case 'competitionScore': return chartData ? <ChartCompetitionScore data={chartData} /> : <ChartCompetitionScore />;
    case 'scoreCard': return chartData ? <ChartScoreCard data={chartData} /> : <ChartScoreCard />;
    case 'marketTrend': return chartData ? <ChartMarketTrend data={chartData} /> : <ChartMarketTrend />;
    case 'insightDashboard': return chartData ? <ChartInsightDashboard data={chartData} /> : <ChartInsightDashboard />;
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
  bigNumberDonut: <ChartBigNumberDonut />,
  gaugeGrid: <ChartGaugeGrid />,
  rankingList: <ChartRankingList />,
  comparisonSplit: <ChartComparisonSplit />,
  bigNumberTrend: <ChartBigNumberTrend />,
  heatmapBlocks: <ChartHeatmapBlocks />,
  priceCards: <ChartPriceCards />,
  splitList: <ChartSplitList />,
  circularProgress: <ChartCircularProgress />,
  wordCloud: <ChartWordCloud />,
  weatherImpact: <ChartWeatherImpact />,
  gaugeMeter: <ChartGaugeMeter />,
  competitionScore: <ChartCompetitionScore />,
  scoreCard: <ChartScoreCard />,
  marketTrend: <ChartMarketTrend />,
  insightDashboard: <ChartInsightDashboard />,
};

// ─── DataTable ───

const LABEL_MAP = {
  cafes: '카페 수', franchise: '프랜차이즈', individual: '개인카페', bakery: '베이커리 카페', newOpen: '신규 오픈',
  floatingPop: '일 유동인구', closed: '폐업 매장',
  '일 유동인구': '일 유동인구', '방문고객': '방문고객', '폐업 매장': '폐업 매장',
  monthly: '월평균 매출', dongAvg: '동 평균', guAvg: '구 평균', cafeSalesRank: '카페 매출 순위', cafePctInTop5: '카페 비중',
  siAvg: '시 평균', prevYearGuAmt: '작년 강남구 매출', prevMonGuAmt: '전월 강남구 매출',
  prevMonRate: '전월 대비 변동률', prevYearRate: '작년 대비 변동률',
  topFiveDongs: '매출 TOP 5 동', gusignguStores: '강남구 카페 매장수', sigaongStores: '서울 카페 매장수',
  annualSalesTrend: '13개월 매출 추이',
  weekday: '평일 유동인구', weekend: '주말 유동인구', peakHour: '피크 시간대', ratio: '평일/주말 비율',
  male: '남성 비율', female: '여성 비율', newCustomer: '신규 고객', regular: '단골 고객', topAge: '주요 연령대',
  rentPerPyeong: '평당 임대료', deposit: '보증금', supportPrograms: '지원 프로그램',
  blogMentions: '블로그 언급수', trendDirection: '트렌드 방향', closureRate: '폐업률',
  weekdaySales: '평일 매출', weekendSales: '주말 매출', cardRatio: '카드 결제 비율', cashRatio: '현금 결제 비율',
  level: '주변 카페 경쟁 수준', cafePerKm2: 'km2당 카페 수', franchiseRatio: '프랜차이즈 비율', avgLifespan: '평균 영업기간',
  dongDensity: '동 내 밀집 정도', newEntryRate: '신규 진입률(1년 미만)', stableStoreRate: '안정 매장(3년+)', recentOpen: '최근 개업', recentClose: '최근 폐업', perStoreSales: '점포당 월매출', marketSize: '시장 규모',
  cafeCount: '카페 수', radius: '수집 반경', dailyPopulation: '일 유동인구', potentialPerStore: '카페당 잠재 고객',
  openCloseTrend: '개폐업 추세', monthlyRent: '월 임대료', salesRentMargin: '매출-임대 여유',
  openCount: '신규 개업', closeCount: '폐업', netChange: '순증감', trend: '추세',
  survivalRate1y: '1년 생존 확률', survivalRate3y: '3년 생존 확률', survivalRate5y: '5년 생존 확률', survivalInsight: '생존 확률 분석', weatherSalesImpact: '날씨별 매출 변동',
  overallScore: '종합 점수', overallGrade: '종합 등급', opportunities: '기회 요인', risks: '리스크 요인', recommendation: '추천 전략',
  dayOfWeek: '요일별 유동인구', avgStay: '평균 체류시간', residentPop: '상주인구', genderRatio: '성별 비율', peakTime: '손님이 가장 많은 시간',
  interiorCost: '인테리어 비용', equipmentCost: '설비/장비 비용', totalStartupCost: '총 창업비용', premiumCost: '권리금',
  perPyeong: '평당 임대료', medianMonthly: '월세 중위값', medianDeposit: '보증금 중위값',
  keywords: 'SNS 키워드', sentiment: '감성 분석', summary: 'SNS 요약',
  // Card 10 SNS 트렌드 - 보조 필드
  negativeKeywords: '주의 키워드', instagramPosts: '인스타그램 게시물',
  searchIntents: '검색 유입 경로', topShops: '후기 좋은 매장',
  opportunityCount: '기회 요인 수', riskCount: '리스크 요인 수', beancraftPriority: '빈크래프트 우선순위',
  interior: '인테리어 제안', equipment: '설비 제안', menu: '메뉴 제안', beans: '원두 제안',
  education: '교육 제안', design: '디자인 제안', youtube: '유튜브 분석',
  revisitCycle: '재방문 주기', loyaltyIndex: '충성도 지수', scores: '점수',
  earnAmt: '연 평균소득', maleLifestyle: '남성 라이프스타일', femaleLifestyle: '여성 라이프스타일',
  genAgeSales: '연령별 소비매출', householdType: '세대 구성',
  singleHousehold: '1인가구 비율(추정)', households: '세대수',
  franchiseCount: '프랜차이즈 수', totalCafes: '전체 카페 수', independentCount: '개인 카페 수',
  franchiseSummary: '주요 프랜차이즈', nearbySummary: '주변 카페',
  avgMonthlySales: '평균 월매출', franchiseMinPrice: '아메리카노 최저가', franchiseMaxPrice: '아메리카노 최고가',
  cafeDeliveryCount: '카페 배달 건수', americanoPriceRange: '아메리카노 가격대', nearestFranchise: '최근접 프랜차이즈',
  // [v15] Card 1 - 상권 종합 (비즈맵 summary-report)
  blockType: '상권 유형', subway: '지하철', busStop: '버스정류장', publicFacility: '관공서',
  eduFacility: '교육시설', financeFacility: '금융시설',
  popularUpjongSale: '매출 TOP 업종', popularUpjongStore: '점포수 TOP 업종',
  nearbyHjd: '주변 행정동', seoulFclty: '서울 집객시설', blockCount: '블록 밀집도',
  // [v15] Card 2 - 고객 분석 (오픈업 pop/rp + 비즈맵 genderAge)
  openubPopulation: '오픈업 주거인구', openubSingleHh: '오픈업 1인가구',
  openubTotalHh: '오픈업 전체가구', openubAptRatio: '아파트 거주 비율',
  openubResidentStatus: '오픈업 주거 상태', bizmapGenderAge: '비즈맵 성별×연령 매출',
  seoulRepop: '서울 상주인구', openubGenAgeSales: '오픈업 성별×연령 결제',
  openubSalesStatus: '오픈업 결제 상태',
  // [v15] Card 3 - 프랜차이즈 (TOP 10)
  brandTop10: '브랜드 TOP 10', totalFranchiseBrands: '전체 프랜차이즈 종수',
  // [v15] Card 4 - 개인카페 (목록)
  indieCafeList: '개인카페 목록', priceHistogram: '메뉴가 분포',
  // [v15] Card 5 - 매출
  bizmapQuartile: '매출 분위수', marketSize13mChange: '13개월 시장 변화',
  marketSizeTrend: '시장 규모 추이', usageCount: '월 이용 건수', avgPayment: '결제단가',
  weeklyHeatmap: '요일별 집중도', hourlyPeak: '시간대 피크',
  hourlyBars: '시간대별 집중도', bizmapTrendCount: '비즈맵 업종 수',
  nationalChart6m: '전국 6개월 추이',
  averageSalesListRaw: '매출 분위수 바', weeklyBars: '요일별 집중도 바',
  openubTimes: '오픈업 시간대별 결제', openubWeekday: '오픈업 요일별 결제',
  openubStatus: '오픈업 결제 상태', seoulQuarterSales: '서울 분기 매출',
  salesIndex: '매출지수',
  // [v15] Card 6 - 유동인구
  wdTimeline: '평일 시간대 유동', weTimeline: '주말 시간대 유동',
  genderFlow: '성별 유동 비율', tourEvents: '관광축제', seoulFlpop: '서울 유동인구',
  // [v15] Card 7 - 임대/창업
  costBreakdown: '비용 분해', costBreakdownList: '비용 분해 차트',
  supportProgramList: '창업 지원 프로그램', rentPerPyeongCalc: '평당 임대료',
  rentVsNational: '전국 평균 대비',
  // [v15] Card 8 - 기회/리스크
  anchorContextText: 'Google 앵커 원문', sourceTags: '소스 태그',
  newsOppsTimeline: '뉴스 타임라인',
  // [v15] Card 9 - 배달
  deliveryByDow: '요일별 배달', deliveryPeakDow: '배달 피크 요일',
  cafeVsAllDelivery: '카페 vs 전업종',
  // [v15] Card 10 - SNS 트렌드
  popularMenuTop10: '인기 메뉴 TOP 10', risingMenuDetail: '급상승 메뉴',
  snsAnalyRaw: 'Google SNS 원문', hotPlaces: '핫플레이스', socialTags: '소셜 태그',
  // [v15] Card 11 - 기상 (월별)
  monthlyAvgTemp: '월별 평균기온', monthlyRainDays: '월별 강수일',
  monthlySunshineHours: '월별 일조시간', sbizWeatherIndex: '창업기상도 점수',
  // [v15] Card 13 - 상권 변화
  storeCountTrend: '13개월 점포수', storeCount13mChange: '13개월 변화',
  storeChangeSummary: '점포 증감', ageDistribution: '업력 분포',
  storSttusCount: '업소 상태', seoulTrdarStor: '서울 상권 점포',
  stabilityGauge: '장사 안정성 지수',
  storeChangeBars: '개폐업 이중 바',
  regionType: '상권 유형', sunnyEffect: '맑은 날 영향', cloudyEffect: '흐린 날 영향',
  rainyEffect: '비 오는 날 영향', snowEffect: '눈 오는 날 영향', description: '날씨 분석 요약',
  yearlyDistribution: '연평균 기온·계절 극값', monthlyCalendar: '월별 비·눈 캘린더',
  weatherSummary: '날씨 분석 요약',
  rainDays: '연 강수일', rainPct: '강수일 비율', sunnyDays: '연 맑은 날', sunnyPct: '맑은 날 비율',
  cloudyDays: '연 흐린 날', cloudyPct: '흐린 날 비율', snowDays: '연 눈 오는 날', snowPct: '눈 비율',
  heavyRainDays: '호우일(30mm+)', heatWaveDays: '폭염일(33도+)', coldWaveDays: '한파일(-12도-)',
  avgTemp: '연평균 기온', winterMinTemp: '겨울 최저기온', summerMaxTemp: '여름 최고기온',
  totalDays: '집계 일수', relativePosition: '전국 평균 대비', nationalAvgRainDays: '전국 평년 강수일',
  dataSource: '데이터 출처 기간',
  cafeDeliveryContext: '카페 배달 포지션', industryComparison: '업계 평균 비교',
  saleTypeBreakdown: '판매 채널 비중',
  netProfit: '배달 포함 실질 순이익', netProfitMarginPct: '실질 순이익률',
  profitHealthPct: '수익 건전성', profitHealthNote: '수익 건전성 분석',
  totalPop: '일 유동인구', visitors: '일 방문고객',
  topArea: '상위 유동인구 지역',
  brands: '주요 브랜드',
  avgMenuPrice: '평균 메뉴가',
  avgAmericanoPrice: '아메리카노 평균',
  avgDessertPrice: '디저트 평균',
  potentialCustomers: '일평균 잠재고객',
  targetAge: '핵심 타겟 연령',
  peakTimeCustomers: '피크타임 예상 고객',
  // Card 15: 창업 지원 프로그램
  totalPrograms: '전체 프로그램 수',
  filteredCount: '카페 관련 프로그램 수',
  // [v16] 비즈맵 키 - Card 2 (성별/연령)
  bizmapGenderRatio: '성별 결제비율',
  bizmapTopAge: '주력 결제 연령',
  // [v16] 비즈맵 키 - Card 5 (매출)
  bizmapTopSales: '상위 20% 매출',
  bizmapAvgSales: '동 평균 매출',
  bizmapBottomSales: '하위 20% 매출',
  bizmapAvgUsageCnt: '월 이용 건수',
  bizmapAvgUnitPrice: '평균 결제단가',
  bizmapUsageTrend: '이용 추세',
  bizmapMarketSize: '시장 규모',
  bizmapMarketTrend: '시장 변동률',
  // [v16] 비즈맵 키 - Card 6 (피크)
  bizmapPeakHour: '최고 매출 시간대',
  bizmapPeakHourPct: '최고 시간대 비중',
  bizmapPeakDay: '최고 매출 요일',
  bizmapPeakDayPct: '최고 요일 비중',
  bizmapHourlyChart: '시간대별 매출',
  bizmapWeeklyChart: '요일별 매출',
  // [v16] 비즈맵 키 - Card 8 (비용 구조)
  bizmapOpIncomePct: '영업이익률',
  bizmapMaterialPct: '식재료비율',
  bizmapLaborPct: '인건비율',
  bizmapRentPct: '임차료비율',
  bizmapEtcPct: '기타비율',
  bizmapCostSummary: '비용 구조 요약',
  // [v16] 비즈맵 키 - Card 13 (점포 변화)
  bizmapStoreLatest: '카페 점포수(이번달)',
  bizmapStoreFirst: '카페 점포수(13개월전)',
  bizmapStoreNetChange: '13개월 점포 증감',
  bizmapStoreTrendLabel: '점포 추세',
  bizmapStoreTrendChart: '점포수 추이',
  // [v17] 비즈맵 보조 키 - Card 7/9/11/12
  bizmapBlockType: '비즈맵 상권 유형',
  bizmapPeakDayDelivery: '비즈맵 매출 피크 요일',
  bizmapPeakDayDeliveryPct: '비즈맵 피크 요일 비중',
  bizmapPeakHourWeather: '비즈맵 매출 피크 시간대',
  bizmapPeakHourWeatherPct: '비즈맵 피크 시간 비중',
  bizmapTopUpjongByStore: '비즈맵 점포수 TOP 업종',
};

const formatValue = (key, val) => {
  if (Array.isArray(val)) {
    // [Phase 7 재작업] 객체 배열은 [object Object] 반복을 피하기 위해 빈 문자열 반환
    if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) return '';
    return val.join(', ');
  }
  if (key === 'monthly' || key === 'dongAvg' || key === 'guAvg' || key === 'siAvg' || key === 'prevYearGuAmt' || key === 'prevMonGuAmt') {
    // 만원 단위 → 한국식 억/만 표기
    const v = Number(val);
    if (!v || v <= 0) return '-';
    if (v >= 10000) { const e = Math.floor(v / 10000); const m = Math.round(v % 10000); return m > 0 ? `${e}억 ${m.toLocaleString()}만원` : `${e}억원`; }
    return `${v.toLocaleString()}만원`;
  }
  if (key === 'prevMonRate' || key === 'prevYearRate') {
    if (val === null || val === undefined || val === '') return '-';
    const v = Number(val);
    if (!isFinite(v)) return '-';
    return `${v.toFixed(1)}%`;
  }
  if (key === 'gusignguStores' || key === 'sigaongStores') {
    const v = Number(val);
    if (!v || v <= 0) return '-';
    return `${v.toLocaleString()}개`;
  }
  if (key === 'topFiveDongs') {
    if (!val) return '-';
    return String(val);
  }
  if (key === 'annualSalesTrend') return '';
  if (key === 'male' || key === 'female' || key === 'newCustomer' || key === 'regular') return `${val}%`;
  if (key === 'weekday' || key === 'weekend') return `${val.toLocaleString()}명`;
  if (key === 'rentPerPyeong') {
    const v = Number(val);
    if (!v || v <= 0) return '-';
    if (v >= 10000) { const e = Math.floor(v / 10000); const m = Math.round(v % 10000); return m > 0 ? `${e}억 ${m.toLocaleString()}만원/평` : `${e}억원/평`; }
    return `${v}만원/평`;
  }
  if (key === 'deposit') {
    const v = Number(val);
    if (!v || v <= 0) return '-';
    if (v >= 10000) { const e = Math.floor(v / 10000); const m = Math.round(v % 10000); return m > 0 ? `${e}억 ${m.toLocaleString()}만원` : `${e}억원`; }
    return `${v.toLocaleString()}만원`;
  }
  if (key === 'supportPrograms') return `${val}건`;
  if (key === 'blogMentions') return `${val.toLocaleString()}건`;
  if (key === 'closureRate' || key === 'singleHousehold') return `${val}%`;
  if (key === 'residentPop') return `${Number(val).toLocaleString()}명`;
  if (key === 'households') return `${Number(val).toLocaleString()}세대`;
  if (key === 'cafes' || key === 'franchise' || key === 'individual' || key === 'bakery' || key === 'newOpen') return `${val}개`;
  if (key === 'totalPop' || key === 'visitors') return `${Number(val).toLocaleString()}명`;
  if (key === 'survivalRate1y' || key === 'survivalRate3y' || key === 'survivalRate5y') return `${val}%`;
  if (key === 'avgMonthlySales') {
    const v = Number(val);
    if (!v || v <= 0) return null;
    if (v >= 10000) { const e = Math.floor(v / 10000); const m = Math.round(v % 10000); return m > 0 ? `${e}억 ${m.toLocaleString()}만원` : `${e}억원`; }
    return `${v.toLocaleString()}만원`;
  }
  if (key === 'franchiseMinPrice' || key === 'franchiseMaxPrice') {
    const v = Number(val);
    if (!v || v <= 0) return null;
    return `${v.toLocaleString()}원`;
  }
  if (key === 'avgMenuPrice' || key === 'avgAmericanoPrice' || key === 'avgDessertPrice') {
    return val ? `${Number(val).toLocaleString()}원` : null;
  }
  // [v16] 비즈맵 키 단위 처리 (bizmap 접두 키만)
  if (typeof key === 'string' && key.startsWith('bizmap')) {
    // 차트 배열형은 DataTable에서 안 보이게 (별도 ChartGrid 슬롯에서 렌더링)
    if (/Chart$/.test(key) || /Labels$|Values$/.test(key)) return '';
    if (val === null || val === undefined || val === '') return '-';
    // 이미 포맷된 문자열(예: "14시 18.3%", "금요일", "+5.2%")은 그대로
    if (typeof val === 'string') return val;
    const num = Number(val);
    if (!Number.isFinite(num)) return String(val);
    if (/Pct$/.test(key)) return `${num}%`;
    if (/(Amt|Sales|Size)$/.test(key)) {
      if (!num || num <= 0) return '-';
      if (num >= 10000) {
        const e = Math.floor(num / 10000);
        const m = Math.round(num % 10000);
        return m > 0 ? `${e}억 ${m.toLocaleString()}만원` : `${e}억원`;
      }
      return `${num.toLocaleString()}만원`;
    }
    if (/(Count|Cnt|Latest|First|NetChange)$/.test(key)) return `${num.toLocaleString()}${/Cnt$|Count$/.test(key) ? '건' : '개'}`;
    if (/Payment|UnitPrice/.test(key)) return `${num.toLocaleString()}원`;
    return String(val);
  }
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
          {/* 출처 표기 제거 (2026-05-02) */}
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

const DataTable = ({ data, chartType }) => {
  if (!data) return null;
  const entries = Object.entries(data);
  const zeroAsNullKeys = new Set(['avgMonthlySales', 'franchiseMinPrice', 'franchiseMaxPrice', 'guAvg', 'siAvg', 'prevYearGuAmt', 'prevMonGuAmt', 'gusignguStores', 'sigaongStores', 'blogMentions', 'openCount', 'netChange', 'overallScore', 'opportunityCount', 'riskCount', 'perStoreSales', 'marketSize', 'newEntryRate', 'stableStoreRate', 'avgLifespan', 'recentOpen', 'recentClose', 'franchiseRatio']);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {entries.map(([key, val], i) => {
        // Skip opportunities/risks arrays if chart already shows them (splitList)
        if ((key === 'opportunities' || key === 'risks') && Array.isArray(val) && chartType === 'splitList') {
          return null;
        }
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
        // Card 10 - 인스타그램 게시물 한 줄 (instagramPosts)
        if (key === 'instagramPosts' && typeof val === 'string' && val.trim()) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 4 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{val.trim()}</div>
            </div>
          );
        }
        // [v21] Card 10 - 후기 좋은 매장 (topShops) - 매장 카드 리스트
        if (key === 'topShops' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 10 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {val.map((shop, si) => (
                  <div key={si} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{
                      minWidth: 22,
                      height: 22,
                      borderRadius: 11,
                      background: 'rgba(14,165,233,0.18)',
                      color: 'rgba(125,211,252,1)',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                    }}>{si + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary }}>{shop.name}</span>
                        <span style={{ fontSize: 12, color: 'rgba(125,211,252,1)', fontWeight: 600 }}>· {shop.menu}</span>
                      </div>
                      {shop.reason && (
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.4 }}>{shop.reason}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        // [v20] Card 10 - 검색 유입 경로 (searchIntents) - 파란 칩
        if (key === 'searchIntents' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {val.map((q, qi) => (
                  <span key={qi} style={{
                    display: 'inline-block',
                    padding: '5px 13px',
                    borderRadius: 20,
                    background: 'rgba(14,165,233,0.14)',
                    border: '1px solid rgba(14,165,233,0.3)',
                    fontSize: 12.5,
                    color: 'rgba(125,211,252,1)',
                    fontWeight: 500,
                  }}>
                    {typeof q === 'string' ? q : ''}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        // [v12.1] SNS 주의 키워드 (negativeKeywords) - 빨간 태그
        if (key === 'negativeKeywords' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {val.map((kw, ki) => (
                  <span key={ki} style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: 20,
                    background: 'rgba(255,69,58,0.12)',
                    border: '1px solid rgba(255,69,58,0.25)',
                    fontSize: 12,
                    color: 'rgba(255,99,89,0.95)',
                    fontWeight: 500,
                  }}>
                    {typeof kw === 'string' ? kw : (kw.keyword || kw.name || '')}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        // [v14] SNS 트렌드 카드 정리: atmosphere/visitMotivation/strengths/weaknesses/cafeMenus/popularMenuType 섹션 제거
        // 카드 목적 = 동네 카페 상권 전체 분위기. 카페별 메뉴/방문동기/강점/약점은 다른 카드에서 다룸.
        // Special rendering for trendMenus (nicebizmap rising menus)
        if (key === 'trendMenus' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {val.slice(0, 10).map((m, mi) => (
                  <span key={mi} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'rgba(255,149,0,0.12)', borderRadius: 12,
                    padding: '4px 10px', fontSize: 12, fontWeight: 600,
                    color: 'rgba(255,149,0,0.9)',
                  }}>
                    {m.rank > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>{m.rank}</span>}
                    {m.name}
                  </span>
                ))}
              </div>
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

        // [v15] 브랜드 TOP 10 (name, count, nearest, density)
        if (key === 'brandTop10' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {val.slice(0, 10).map((b, bi) => (
                  <div key={bi} style={{
                    display: 'grid', gridTemplateColumns: '24px 1fr 60px 70px 70px',
                    gap: 8, alignItems: 'center', padding: '4px 0',
                    fontSize: 12, color: COLORS.textSecondary,
                    borderBottom: bi < val.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{bi + 1}</span>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    <span style={{ textAlign: 'right' }}>{b.count}개</span>
                    <span style={{ textAlign: 'right', color: COLORS.textMuted }}>{b.nearest}</span>
                    <span style={{ textAlign: 'right', color: COLORS.textMuted }}>{b.density}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // [v15] 개인카페 전체 목록 (근거리순)
        if (key === 'indieCafeList' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key} ({val.length}곳)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                {val.map((c, ci) => (
                  <div key={ci} style={{
                    display: 'grid', gridTemplateColumns: '24px 1fr 60px 70px',
                    gap: 8, alignItems: 'center', padding: '6px 0',
                    fontSize: 12, color: COLORS.textSecondary,
                    borderBottom: ci < val.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{ci + 1}</span>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ textAlign: 'right', color: COLORS.textMuted }}>{c.dist != null ? c.dist + 'm' : '-'}</span>
                    <span style={{ textAlign: 'right', color: COLORS.textMuted }}>{c.menuPrice ? Number(c.menuPrice).toLocaleString() + '원' : '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // [v15] 인기 메뉴 TOP 10
        if (key === 'popularMenuTop10' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {val.slice(0, 10).map((m, mi) => (
                  <div key={mi} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.04)',
                    fontSize: 12,
                  }}>
                    <span style={{ color: 'rgba(255,149,0,0.8)', fontWeight: 700, minWidth: 18 }}>{m.rank}</span>
                    <span style={{ color: COLORS.textSecondary, flex: 1 }}>{m.name}</span>
                    {m.price > 0 && <span style={{ color: COLORS.textMuted, fontSize: 11 }}>{Number(m.price).toLocaleString()}원</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // [v15] 급상승 메뉴 (증감률 화살표)
        if (key === 'risingMenuDetail' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {val.map((m, mi) => (
                  <span key={mi} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 12,
                    background: 'rgba(100,200,150,0.12)',
                    fontSize: 12, fontWeight: 600,
                    color: 'rgba(100,200,150,0.9)',
                  }}>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>▲</span>
                    {m.name}
                    {m.changeRate > 0 && <span style={{ fontSize: 10 }}>+{m.changeRate}%</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        // [v25] 연평균 기온·계절 극값 (위 차트와 중복되는 % 제거, 기온 인사이트 위주)
        if (key === 'yearlyDistribution' && val && typeof val === 'object' && val.totalDays > 0) {
          const yd = val;
          const items = [
            { label: '연평균', val: yd.avgTemp != null ? `${yd.avgTemp}°C` : '-', color: '#94a3b8' },
            { label: '여름 최고', val: yd.summerMax != null ? `${yd.summerMax}°C` : '-', color: '#f59e0b' },
            { label: '겨울 최저', val: yd.winterMin != null ? `${yd.winterMin}°C` : '-', color: '#60a5fa' },
            { label: '강수 전국대비', val: yd.relativePosition || '-', color: '#a78bfa' },
          ];
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key} (최근 {yd.totalDays}일)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {items.map((it, ii) => (
                  <div key={ii} style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    padding: '10px 8px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{it.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: it.color }}>{it.val}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // [v25] 월별 비·눈 캘린더 (클릭 시 일별 상세 펼침)
        if (key === 'monthlyCalendar' && Array.isArray(val) && val.length === 12) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>월 박스를 클릭하면 그 달의 일별 날씨가 펼쳐집니다</div>
              <MonthlyCalendarGrid months={val} />
            </div>
          );
        }

        // [v15] 월별 기온 라인차트 (간단 SVG)
        if ((key === 'monthlyAvgTemp' || key === 'monthlyRainDays' || key === 'monthlySunshineHours') && Array.isArray(val) && val.length === 12) {
          const valid = val.map((v, mi) => v != null ? { month: mi + 1, value: Number(v) } : null).filter(Boolean);
          if (valid.length < 2) return null;
          const max = Math.max(...valid.map(v => v.value));
          const min = Math.min(...valid.map(v => v.value));
          const range = max - min || 1;
          const W = 360; const H = 80; const pad = 6;
          const colors = { monthlyAvgTemp: '#f59e0b', monthlyRainDays: '#3b82f6', monthlySunshineHours: '#fbbf24' };
          const color = colors[key] || '#888';
          const pts = valid.map((p, pi) => {
            const x = pad + 12 + (pi * (W - pad * 2 - 12) / (valid.length - 1));
            const y = H - pad - 12 - ((p.value - min) / range) * (H - pad * 2 - 12);
            return [x, y];
          });
          const pathD = pts.map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
          const unit = key === 'monthlyAvgTemp' ? '°C' : key === 'monthlyRainDays' ? '일' : '시간';
          const monthLabels = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
          // For monthlyRainDays, show as bars instead of line
          const isBar = key === 'monthlyRainDays';
          const barW = (W - pad * 2 - 12) / valid.length * 0.7;
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6 }}>{LABEL_MAP[key] || key}</div>
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ maxWidth: '100%' }}>
                {isBar ? (
                  pts.map((p, pi) => (
                    <g key={pi}>
                      <rect x={p[0] - barW / 2} y={p[1]} width={barW} height={H - pad - 12 - p[1]}
                        fill={color} opacity="0.75" rx="1.5" />
                    </g>
                  ))
                ) : (
                  <>
                    <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" />
                    {pts.map((p, pi) => (
                      <circle key={pi} cx={p[0]} cy={p[1]} r="2" fill={color} />
                    ))}
                  </>
                )}
                {pts.map((p, pi) => (
                  <text key={`l${pi}`} x={p[0]} y={H - 2} textAnchor="middle"
                    fill="rgba(255,255,255,0.4)" fontSize="7"
                    fontFamily="'Pretendard', sans-serif">{monthLabels[pi]}</text>
                ))}
              </svg>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                최저 {min.toFixed(1)}{unit} / 최고 {max.toFixed(1)}{unit} (1~12월)
              </div>
            </div>
          );
        }

        // [Phase 7 재작업] 매출 분위수 바 (averageSalesListRaw)
        if (key === 'averageSalesListRaw' && Array.isArray(val) && val.length >= 2) {
          const amounts = val.map(r => r.amount).filter(a => a > 0);
          if (amounts.length < 2) return null;
          const maxA = Math.max(...amounts);
          const minA = Math.min(...amounts);
          const range = maxA - minA || 1;
          // Find "current" tier (중/평균 position) - default to middle
          const currentIdx = Math.floor(val.length / 2);
          const fmtAmt = (v) => {
            if (v >= 100000000) return (v / 100000000).toFixed(1) + '억';
            if (v >= 10000) return Math.round(v / 10000) + '만';
            return String(v);
          };
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ position: 'relative', width: '100%', height: 10, background: 'linear-gradient(90deg, rgba(100,150,220,0.25), rgba(255,149,0,0.55))', borderRadius: 5, marginBottom: 22 }}>
                {val.map((r, ri) => {
                  const pct = ((r.amount - minA) / range) * 100;
                  const isCurrent = ri === currentIdx;
                  return (
                    <div key={ri} style={{
                      position: 'absolute', left: `calc(${pct}% - 4px)`,
                      top: isCurrent ? -4 : 0,
                      width: isCurrent ? 12 : 8, height: isCurrent ? 18 : 10,
                      background: isCurrent ? '#ff9500' : 'rgba(255,255,255,0.4)',
                      borderRadius: isCurrent ? 3 : '50%',
                      border: isCurrent ? '2px solid #fff' : 'none',
                    }} title={`${r.tier} ${fmtAmt(r.amount)}`} />
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.textMuted }}>
                {val.map((r, ri) => (
                  <span key={ri} style={{ flex: 1, textAlign: ri === 0 ? 'left' : ri === val.length - 1 ? 'right' : 'center' }}>
                    {r.tier} {fmtAmt(r.amount)}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        // [Phase 7 재작업] 요일별 매출 집중도 바 (weeklyBars)
        if (key === 'weeklyBars' && Array.isArray(val) && val.length >= 2) {
          const max = Math.max(...val.map(r => r.value || 0));
          if (max <= 0) return null;
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72 }}>
                {val.map((r, ri) => {
                  const pct = max > 0 ? (r.value / max) * 100 : 0;
                  const isPeak = r.value === max;
                  return (
                    <div key={ri} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: isPeak ? '#ff9500' : COLORS.textMuted, fontWeight: isPeak ? 700 : 500 }}>
                        {r.value}%
                      </span>
                      <div style={{
                        width: '100%', height: `${Math.max(4, pct)}%`,
                        background: isPeak ? 'rgba(255,149,0,0.75)' : 'rgba(255,255,255,0.3)',
                        borderRadius: 3, minHeight: 4,
                      }} />
                      <span style={{ fontSize: 10, color: COLORS.textMuted }}>{r.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // [Phase 7 재작업] 개폐업 이중 바 (storeChangeBars = [{period, opened, closed}])
        if (key === 'storeChangeBars' && Array.isArray(val) && val.length >= 2) {
          const maxV = Math.max(...val.flatMap(r => [r.opened || 0, r.closed || 0]), 1);
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, paddingBottom: 18, position: 'relative' }}>
                {val.slice(0, 13).map((r, ri) => {
                  const openPct = maxV > 0 ? (r.opened / maxV) * 100 : 0;
                  const closePct = maxV > 0 ? (r.closed / maxV) * 100 : 0;
                  return (
                    <div key={ri} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%', width: '100%', justifyContent: 'center' }}>
                        <div title={`신규 ${r.opened}`} style={{
                          width: '45%', height: `${Math.max(2, openPct)}%`,
                          background: 'rgba(74,144,217,0.75)', borderRadius: '2px 2px 0 0', minHeight: 2,
                        }} />
                        <div title={`폐업 ${r.closed}`} style={{
                          width: '45%', height: `${Math.max(2, closePct)}%`,
                          background: 'rgba(231,76,60,0.75)', borderRadius: '2px 2px 0 0', minHeight: 2,
                        }} />
                      </div>
                      <span style={{ position: 'absolute', bottom: -16, fontSize: 8, color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
                        {String(r.period).slice(-4)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: COLORS.textMuted }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(74,144,217,0.75)', borderRadius: 2 }} /> 신규 개업
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(231,76,60,0.75)', borderRadius: 2 }} /> 폐업
                </span>
              </div>
            </div>
          );
        }

        // [Phase 7 재작업] 전국 6개월 추이 (nationalChart6m = [{month, sale, stores}])
        //                  -> [object Object] 버그 수정: 전용 라인 차트로 렌더
        if (key === 'nationalChart6m' && Array.isArray(val) && val.length >= 2) {
          const saleVals = val.map(r => Number(r?.sale || 0));
          const maxS = Math.max(...saleVals); const minS = Math.min(...saleVals);
          const rangeS = maxS - minS || 1;
          const W = 360; const H = 70; const pad = 8;
          const bottomLabel = H - 2;
          const pts = saleVals.map((v, pi) => {
            const x = pad + (pi * (W - pad * 2) / (saleVals.length - 1));
            const y = pad + 4 + (1 - (v - minS) / rangeS) * (H - pad * 2 - 18);
            return [x, y];
          });
          const pathD = pts.map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
          const fmt = (v) => {
            if (v >= 100000000) return (v / 100000000).toFixed(1) + '억';
            if (v >= 10000) return Math.round(v / 10000) + '만';
            return String(v);
          };
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6 }}>{LABEL_MAP[key] || key}</div>
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ maxWidth: '100%' }}>
                <path d={pathD} fill="none" stroke="#ff9500" strokeWidth="1.8" />
                {pts.map((p, pi) => (
                  <circle key={pi} cx={p[0]} cy={p[1]} r="2.5" fill="#ff9500" />
                ))}
                {val.map((r, pi) => (
                  <text key={`lab${pi}`} x={pts[pi][0]} y={bottomLabel} textAnchor="middle"
                    fill="rgba(255,255,255,0.5)" fontSize="7.5"
                    fontFamily="'Pretendard', sans-serif">
                    {String(r?.month || '').slice(-2) + '월'}
                  </text>
                ))}
              </svg>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                최저 {fmt(minS)} / 최고 {fmt(maxS)} (최근 6개월 매출)
              </div>
            </div>
          );
        }

        // [v15] 13개월 점포수 추이 (라인차트)
        if ((key === 'storeCountTrend' || key === 'marketSizeTrend') && Array.isArray(val) && val.length >= 2) {
          const valueKey = key === 'marketSizeTrend' ? 'value' : 'count';
          const pts = val.map(r => Number(r[valueKey] || 0)).filter(v => v > 0);
          if (pts.length < 2) return null;
          const max = Math.max(...pts); const min = Math.min(...pts); const range = max - min || 1;
          const W = 360; const H = 50; const pad = 4;
          const coords = pts.map((p, pi) => {
            const x = pad + (pi * (W - pad * 2) / (pts.length - 1));
            const y = H - pad - ((p - min) / range) * (H - pad * 2);
            return [x, y];
          });
          const pathD = coords.map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6 }}>{LABEL_MAP[key] || key}</div>
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ maxWidth: W }}>
                <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
              </svg>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                {val[0]?.month || ''} → {val[val.length - 1]?.month || ''}
              </div>
            </div>
          );
        }

        // [v15] 요일별 배달 (bar)
        if (key === 'deliveryByDow' && Array.isArray(val) && val.length > 0) {
          const max = Math.max(...val.map(r => r.count || 0));
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                {val.map((r, ri) => {
                  const pct = max > 0 ? (r.count / max) * 100 : 0;
                  return (
                    <div key={ri} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '100%', height: `${pct}%`, background: 'rgba(100,150,220,0.5)', borderRadius: 3, minHeight: 2 }} />
                      <span style={{ fontSize: 10, color: COLORS.textMuted }}>{r.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // [v15] 시간대별 바 (hourlyBars)
        if (key === 'hourlyBars' && Array.isArray(val) && val.length > 0) {
          const max = Math.max(...val.map(r => r.value || 0));
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                {val.slice(0, 24).map((r, ri) => {
                  const pct = max > 0 ? (r.value / max) * 100 : 0;
                  return (
                    <div key={ri} title={`${r.hour} ${r.value}%`} style={{ flex: 1, height: `${Math.max(2, pct)}%`, background: 'rgba(255,149,0,0.5)', borderRadius: 2, minHeight: 2 }} />
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                <span>{val[0]?.hour}</span>
                <span>{val[val.length - 1]?.hour}</span>
              </div>
            </div>
          );
        }

        // [v15] 주변 인프라 (busStop, publicFacility 등) 한 줄 요약
        const infraKeys = ['blockType', 'subway', 'busStop', 'publicFacility', 'eduFacility', 'financeFacility'];
        // handled by default renderer below

        // [v15] 문자열 배열 (popularUpjongSale, popularUpjongStore, supportProgramList, sourceTags, socialTags, nearbyHjd)
        const stringArrayKeys = new Set(['popularUpjongSale', 'popularUpjongStore', 'supportProgramList', 'sourceTags', 'socialTags', 'nearbyHjd']);
        if (stringArrayKeys.has(key) && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {val.slice(0, 12).map((tag, ti) => (
                  <span key={ti} style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 11, color: COLORS.textSecondary,
                  }}>
                    {typeof tag === 'string' ? tag : String(tag?.name || tag)}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        // [v15] 업력 분포 (ageDistribution: [{ range, count }])
        if (key === 'ageDistribution' && Array.isArray(val) && val.length > 0) {
          const max = Math.max(...val.map(r => r.count || 0));
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {val.map((r, ri) => {
                  const pct = max > 0 ? Math.round((r.count / max) * 100) : 0;
                  return (
                    <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ color: COLORS.textMuted, minWidth: 60 }}>{r.range}</span>
                      <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: pct + '%', height: '100%', background: 'rgba(100,150,220,0.5)', borderRadius: 5 }} />
                      </div>
                      <span style={{ color: COLORS.textSecondary, minWidth: 40, textAlign: 'right' }}>{r.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // [v15] 뉴스 타임라인 (newsOppsTimeline)
        if (key === 'newsOppsTimeline' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {val.map((n, ni) => (
                  <div key={ni} style={{
                    borderLeft: '2px solid rgba(100,200,150,0.5)',
                    paddingLeft: 10, paddingTop: 4, paddingBottom: 4,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>{n.title}</div>
                    {n.detail && <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 2 }}>{n.detail}</div>}
                    {n.date && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        {n.date}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // [v15] costBreakdownList (비용 배열)
        if (key === 'costBreakdownList' && Array.isArray(val) && val.length > 0) {
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {val.map((c, ci) => (
                  <span key={ci} style={{
                    padding: '4px 10px', borderRadius: 12,
                    background: 'rgba(100,150,220,0.12)',
                    fontSize: 12, fontWeight: 600,
                    color: 'rgba(100,150,220,0.9)',
                  }}>{c}</span>
                ))}
              </div>
            </div>
          );
        }

        // [v15] 평일/주말 시간대 비교 (wdTimeline / weTimeline)
        if ((key === 'wdTimeline' || key === 'weTimeline') && Array.isArray(val) && val.length > 0) {
          const max = Math.max(...val);
          const color = key === 'wdTimeline' ? 'rgba(100,150,220,0.6)' : 'rgba(255,149,0,0.6)';
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
                {val.map((v, vi) => {
                  const pct = max > 0 ? (v / max) * 100 : 0;
                  return <div key={vi} title={v + '명'} style={{ flex: 1, height: Math.max(2, pct) + '%', background: color, borderRadius: 2 }} />;
                })}
              </div>
            </div>
          );
        }

        // [v15] 오픈업 시간대/요일 (openubTimes / openubWeekday)
        if ((key === 'openubTimes' || key === 'openubWeekday') && Array.isArray(val) && val.length > 0) {
          const max = Math.max(...val);
          const labels = key === 'openubTimes' ? ['새벽', '아침', '점심', '오후', '저녁', '야간', '심야'] : ['월', '화', '수', '목', '금', '토', '일'];
          return (
            <div key={key} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
                {val.slice(0, 7).map((v, vi) => {
                  const pct = max > 0 ? (v / max) * 100 : 0;
                  return (
                    <div key={vi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', height: Math.max(2, pct) + '%', background: 'rgba(200,100,150,0.5)', borderRadius: 2 }} />
                      <span style={{ fontSize: 9, color: COLORS.textMuted }}>{labels[vi]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // Skip null/undefined/empty values
        if (val === null || val === undefined || val === '' || val === 'null' || val === '-') return null;
        // Skip empty arrays
        if (Array.isArray(val) && val.length === 0) return null;
        // Skip zero values for keys where 0 is meaningless
        if (val === 0 && zeroAsNullKeys.has(key)) return null;
        // [Phase 7 재작업] Object-array fallback: 커스텀 렌더러가 없는 객체 배열은 스킵 (-> [object Object] 방지)
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          return null;
        }
        // Skip complex objects that aren't arrays (topArea, dayOfWeek etc.)
        if (typeof val === 'object' && !Array.isArray(val)) {
          // Render object with name/pop or peakDay as text
          const objStr = val.name ? `${val.name}${val.pop ? ' (' + val.pop.toLocaleString() + '명)' : ''}` : val.peakDay ? `${val.peakDay} ${val.peakDayPop ? val.peakDayPop.toLocaleString() + '명' : ''}` : null;
          if (!objStr) return null;
          return (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
            }}>
              <span style={{ fontSize: 14, color: COLORS.textMuted }}>{LABEL_MAP[key] || key}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.white }}>{objStr}</span>
            </div>
          );
        }
        // Long text values (deliveryFeeInfo, saleTypeBreakdown etc.) - block layout
        const strVal = String(val);
        if (strVal.length > 40) {
          return (
            <div key={key} style={{
              padding: '10px 0',
              borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
            }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6 }}>{LABEL_MAP[key] || key}</div>
              <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>{strVal}</div>
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
    chartType: 'bigNumberDonut',
    metaInfo: '카페 현황',
    chartData: {
      bigNumber: 47, unit: '개',
      subtitle: '베이커리 8개가 포함되어 있어요',
      segments: [
        { name: '프랜차이즈', pct: 12, color: '#1E3A8A' },
        { name: '개인카페', pct: 35, color: '#3B82F6' },
        { name: '베이커리', pct: 8, color: '#FFFFFF' },
      ],
    },
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
    chartType: 'gaugeGrid',
    metaInfo: '고객',
    chartData: {
      male: 43, female: 57,
      ageGroups: [
        { name: '20대', pct: 22 },
        { name: '30대', pct: 34 },
        { name: '40대', pct: 24 },
        { name: '50대+', pct: 20 },
      ],
    },
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
    chartType: 'rankingList',
    metaInfo: '프랜차이즈',
    chartData: {
      items: [
        { name: '스타벅스', count: 3 },
        { name: '투썸플레이스', count: 2 },
        { name: '이디야', count: 2 },
        { name: '메가커피', count: 2 },
        { name: '빽다방', count: 1 },
      ],
    },
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
    chartType: 'comparisonSplit',
    metaInfo: '개인카페',
    chartData: {
      left: {
        label: '개인카페', count: 35,
        metrics: [{ label: '월평균 매출', value: '1,820만원' }],
      },
      right: {
        label: '프랜차이즈', count: 12,
        metrics: [{ label: '아메리카노', value: '4,500~6,500원' }],
      },
    },
    bodyData: {
      independentCount: 35,
      avgMonthlySales: 1820,
      franchiseMinPrice: 4500,
      franchiseMaxPrice: 6500,
      nearbySummary: '로스팅하우스 (120m), 카페봄 (180m), 모카포트 (230m), 언더바 (310m), 블랙빈 (380m)',
    },
    tag: '개인카페',
  },
  // Card 5: 매출 분석 (Big Number + Mini Trend)
  {
    title: '매출 분석',
    subtitle: '월평균 예상 매출',
    date: '2026년 4월 기준',
    source: '소상공인365',
    bruSummary: null,
    aiSummary: '카페 업종 월평균 매출 2,150만원, 동 전체 업종 평균 1,780만원. 동 평균 대비 높은 매출 수준입니다.',
    chartType: 'bigNumberTrend',
    metaInfo: '매출',
    chartData: { bigNumber: 2150, unit: '만원', labels: ['11월', '12월', '1월', '2월', '3월', '4월'], values: [1950, 1870, 2010, 2080, 2150, 2200] },
    bodyData: {
      monthly: 21500000,
      dongAvg: 17800000,
      guAvg: 0,
      top5: ['한식', '카페', '치킨', '분식', '일식'],
    },
  },
  // Card 6: 유동인구 (Heatmap Blocks)
  {
    title: '유동인구',
    subtitle: '시간대별 통행량 - 역삼동',
    date: '2026년 4월 기준',
    source: '소상공인365',
    bruSummary: null,
    aiSummary: '일평균 유동인구 24,530명. 평일 유동인구가 주말보다 높습니다.',
    chartType: 'heatmapBlocks',
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
  // Card 7: 임대/창업 정보 (Price Cards)
  {
    title: '임대/창업 정보',
    subtitle: '상가 시세 및 지원',
    date: '2026년 4월 기준',
    source: '한국부동산원',
    bruSummary: null,
    aiSummary: '평균 월 임대료 320만원, 보증금 5,000만원.',
    chartType: 'priceCards',
    metaInfo: '임대',
    chartData: { items: [{ label: '보증금', value: 5000 }, { label: '월임대', value: 320 }, { label: '권리금', value: 3500 }, { label: '인테리어', value: 4000 }], totalCost: 12820 },
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
  // Card 8: 카페 기회 (Split List)
  // [외부정보수집 고정] Mock/프리뷰 데이터도 내부 데이터 기반 표현 사용 금지.
  // 실제 데이터는 externalIntel(Gemini Google Search) 결과만 사용한다.
  {
    title: '카페 기회',
    subtitle: '카페 창업·운영 관련 최신 정보',
    date: '2026년 4월 기준',
    source: 'Gemini Google Search',
    bruSummary: null,
    aiSummary: null,
    chartType: 'splitList',
    metaInfo: '카페 기회',
    chartData: {
      opportunities: [],
    },
    bodyData: null,
    tag: '카페 기회',
  },
  // Card 9: 배달 객단가 (2026-05-02 본질 변경) — Card9DeliveryAvgPrice 컴포넌트 전용
  {
    title: '배달 객단가',
    subtitle: '이 동네 배달 객단가',
    date: '2026년 4월 기준',
    source: '소상공인365',
    bruSummary: null,
    aiSummary: null,
    chartType: null,
    metaInfo: '배달객단가',
    chartData: null,
    bodyData: {
      searchDongName: '',
      searchAvgPrice: 0,
      searchSales: 0,
      searchOrders: 0,
      nearbyDongs: [],
    },
  },
  // Card 10: SNS 트렌드 — 워드클라우드 + 키워드 + 감성 + 보조 항목
  {
    title: 'SNS 트렌드',
    subtitle: '소셜미디어 카페 분위기 분석',
    date: '2026년 4월 기준',
    source: 'AI 카페 트렌드 분석',
    bruSummary: null,
    aiSummary: '강남역 주변 카페 검색량 증가 추세. 디저트와 분위기를 중시하는 리뷰가 다수.',
    chartType: 'wordCloud',
    metaInfo: 'SNS',
    chartData: {
      keywords: [
        { text: '흑임자 크림 라떼', weight: 12 },
        { text: '디카페인 강세', weight: 11 },
        { text: '야외 테라스 명소', weight: 10 },
        { text: '대형 갤러리 카페', weight: 9 },
        { text: '이른 아침 오픈', weight: 8 },
        { text: '30대 직장인 점심', weight: 7 },
        { text: '사진 잘 나오는 인테리어', weight: 6 },
        { text: '북카페 콘셉트', weight: 5 },
      ],
      sentimentPos: 72,
    },
    bodyData: {
      keywords: [
        '흑임자 크림 라떼', '디카페인 강세', '야외 테라스 명소',
        '대형 갤러리 카페', '이른 아침 오픈', '30대 직장인 점심',
        '사진 잘 나오는 인테리어', '북카페 콘셉트',
      ],
      negativeKeywords: ['비싸요', '웨이팅', '시끄러움'],
      sentiment: { positive: 72, negative: 28 },
      instagramPosts: '약 12만 게시물',
      targetMatch: '30대 직장인 카페 수요 강세',
      summary: '강남역 주변 카페 검색량 증가 추세. 디저트와 분위기를 중시하는 리뷰가 다수.',
      blogMentions: 1240,
    },
    tag: 'SNS',
  },
  // Card 11: 연간 기상 분포 — weatherImpact
  {
    title: '연간 기상 분포',
    subtitle: '최근 365일 실측 기상 분포',
    date: '2026년 4월 기준',
    source: 'Open-Meteo',
    bruSummary: null,
    aiSummary: '실측 기상 분포를 운영 구조 고민 재료로 활용할 수 있습니다.',
    chartType: 'weatherImpact',
    chartData: {
      items: [
        { label: '맑음', icon: 'sun', value: 180, unit: '일' },
        { label: '흐림', icon: 'cloud', value: 80, unit: '일' },
        { label: '비', icon: 'rain', value: 95, unit: '일' },
        { label: '눈', icon: 'snow', value: 10, unit: '일' },
      ],
    },
    heroMetric: { value: '95일', label: '연 강수일', context: '전국 평년 105일 대비 평균' },
    bodyData: {
      rainDays: 95, sunnyDays: 180, cloudyDays: 80, snowDays: 10,
      heavyRainDays: 8, heatWaveDays: 15, coldWaveDays: 6,
      avgTemp: 13.4, winterMinTemp: -11.2, summerMaxTemp: 34.1,
      totalDays: 365, relativePosition: '평균', nationalAvgRainDays: 105,
    },
    tag: '날씨',
  },
  // Card 12: 상권 경쟁 분석 — competitionScore (5축 점수화)
  {
    title: '상권 경쟁 분석',
    subtitle: '주변 카페 경쟁 정도',
    date: '2026년 4월 기준',
    source: '오픈업/카카오',
    bruSummary: null,
    aiSummary: '종합 경쟁 점수 55점 (경쟁). 반경 500m 내 카페 47개. 프랜차이즈 비율 26%.',
    chartType: 'competitionScore',
    metaInfo: '경쟁',
    chartData: {
      overallScore: 55,
      tier: 'competitive',
      tierLabel: '경쟁',
      tierColor: '#F59E0B',
      templateText: '이 지역은 경쟁이 치열한 구간입니다.',
      axes: {
        density:            { value: 60,    score: 0,   unit: '개/km²', label: '카페 밀도' },
        franchiseRatio:     { value: 26,    score: 74,  unit: '%',      label: '프랜차이즈 비율' },
        potentialPerStore:  { value: 25500, score: 51,  unit: '명',     label: '카페당 잠재 고객' },
        openCloseTrend:     { value: 0.04,  score: 60,  unit: '비율',   label: '개폐업 추세' },
        salesRentMargin:    { value: 0.83,  score: 83,  unit: '비율',   label: '매출-임대 여유' },
      },
    },
    scoreDetail: {
      tierColor: '#F59E0B',
      templateText: '이 지역은 경쟁이 치열한 구간입니다.',
    },
    bodyData: {
      overallScore: '55점',
      level: '경쟁 (과밀)',
      cafeCount: '47개',
      radius: '500m',
      cafePerKm2: '60개/km²',
      franchiseCount: '12개',
      franchiseRatio: '26%',
      dailyPopulation: '1,200,000명',
      potentialPerStore: '25,500명',
      dongDensity: '동 내 카페/음료 업소 35개',
      newEntryRate: '22%',
      stableStoreRate: '48%',
      avgLifespan: '3년 이상 보통',
      recentOpen: '5개',
      recentClose: '3개',
      openCloseTrend: '0.04',
      monthlyRent: '250만원',
      perStoreSales: '1,200만원',
      salesRentMargin: '0.83',
      marketSize: '5억 7,600만원',
    },
  },
  // Card 14: AI 종합 분석 — [v14] insightDashboard (시각 중심)
  {
    title: 'AI 종합 분석',
    subtitle: '원천 데이터 + 외부 검색 종합',
    date: '2026년 4월 기준',
    source: 'Google Gemini',
    bruSummary: null,
    aiSummary: null,
    chartType: 'insightDashboard',
    metaInfo: 'AI종합',
    chartData: {
      headline: '오피스 기반 과밀 경쟁 상권',
      kpis: [
        { label: '종합 점수', value: 68, unit: '점', trend: '상승' },
        { label: '매출 건전성', value: '양호', unit: '', trend: '유지' },
        { label: '모멘텀', value: '상승', unit: '', trend: '상승' },
      ],
      radarAxes: [
        { axis: '밀집도', value: 55, fullMark: 100 },
        { axis: '경쟁', value: 75, fullMark: 100 },
        { axis: '잠재력', value: 80, fullMark: 100 },
        { axis: '추세', value: 62, fullMark: 100 },
        { axis: '비용여유', value: 58, fullMark: 100 },
      ],
      signals: [
        { type: 'positive', text: '오피스 유동인구 강세' },
        { type: 'positive', text: '개인카페 비중 60%' },
        { type: 'neutral', text: '50대 방문층 높음' },
        { type: 'negative', text: '임대료 부담 17%' },
      ],
      tags: ['강남역', '오피스', '스페셜티', '베이커리'],
    },
    bodyData: {
      overallScore: 68,
      overallGrade: '양호',
      opportunities: 3,
      risks: 2,
      recommendation: '조건부 추천',
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
  cards: cardsProp = MOCK_CARDS,
  summaryMetrics = null,
  collectedData = null,
  aiData = null,
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
  renderResults = null,
}) {
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(SLIDER_DEFAULT);
  const [mapRevealed, setMapRevealed] = useState(!resultsReady && !salesModeLoading);
  // [2026-05-18] 모바일 검색 화면에서 좌측 패널이 풀폭 차지하도록 viewport 감지
  const [isMobile, setIsMobile] = useState(() => {
    try { return typeof window !== 'undefined' && window.innerWidth <= 768; } catch (_) { return false; }
  });
  useEffect(() => {
    const handleResize = () => {
      try { setIsMobile(window.innerWidth <= 768); } catch (_) {}
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);
  // ── Sidebar collapse toggle (영업모드 결과 화면 좌측 영역 접기/펼치기) ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage?.getItem('beancraft_sidebar_collapsed') === '1';
    } catch (_) {
      return false;
    }
  });
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined') {
          window.localStorage?.setItem('beancraft_sidebar_collapsed', next ? '1' : '0');
        }
      } catch (_) {}
      return next;
    });
  }, []);
  // ── [핸드오프 시안] 카테고리 필터 (5개 그룹 중 1개만 보기) ──
  const [filterCategory, setFilterCategory] = useState(null);
  const handleCategoryClick = useCallback((gid) => {
    setFilterCategory((prev) => (prev === gid ? null : gid));
  }, []);
  const clearFilter = useCallback(() => setFilterCategory(null), []);
  const currentFilterGroup = filterCategory ? HF_GROUPS.find((g) => g.id === filterCategory) : null;
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

  // ── Generate cards from collectedData via dataMapper (new chart types) ──
  // [2026-05-05] 옛날 폴백 제거 + 에러 시 화면 배너 표시
  const mappingResult = useMemo(() => {
    if (collectedData && resultsReady) {
      try {
        const result = mapCollectedDataToCards(collectedData, aiData || {}, radius);
        if (result && result.length > 0) return { cards: result, error: null };
        return { cards: null, error: '카드 매핑 결과가 비어있음 (mapCollectedDataToCards가 빈 배열 반환)' };
      } catch (e) {
        const errMsg = e?.message || String(e);
        const stackLine = (e?.stack || '').split('\n').slice(1, 3).join(' | ').replace(/https?:\/\/[^)]+/g, '').trim();
        console.error('[UnifiedLayout] mapCollectedDataToCards failed:', e);
        return { cards: null, error: `${errMsg}${stackLine ? ` (${stackLine})` : ''}` };
      }
    }
    return { cards: null, error: null };
  }, [collectedData, aiData, radius, resultsReady]);

  const mappedCards = mappingResult.cards;
  const mappingError = mappingResult.error;

  // ── KOSIS 보조 박스 데이터 (5개 카드 공통 prop) ──
  // App.jsx의 KOSIS 추출 로직과 동일한 구조로 묶어 카드들에 전달
  const kosisBoxData = useMemo(() => {
    if (!collectedData?.apis) return null;
    try {
      const apis = collectedData.apis;
      const addrFull = String(
        collectedData?.addressInfo?.address ||
        collectedData?.address ||
        collectedData?.region ||
        searchAddress ||
        ''
      ).trim();
      // 시도/시군구 추출 (addressInfo 우선, 없으면 주소 텍스트에서 토큰 추출)
      let sido = String(collectedData?.addressInfo?.sido || '').trim();
      let sigungu = String(collectedData?.addressInfo?.sigungu || '').trim();
      if (!sido && addrFull) {
        const m = addrFull.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/);
        if (m) sido = m[1];
      }
      if (!sigungu && addrFull) {
        const m2 = addrFull.match(/([가-힣]+[시군구])\s/);
        if (m2) sigungu = m2[1];
      }
      const sidoForExt = sido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/g, '').trim();
      const sangkwonCode = mapToCommercialDistrict(addrFull);

      return {
        sido: sidoForExt,
        sigungu,
        sangkwonCode,
        marketRent: extractMarketRent(apis, sangkwonCode),
        vacancy: extractVacancy(apis, sangkwonCode),
        priceChange: extractPriceChange(apis, sangkwonCode),
        conversionRate: extractConversionRate(apis, sangkwonCode),
        yieldRate: extractYieldRate(apis, sangkwonCode),
        netIncome: extractNetIncome(apis, sangkwonCode),
        cafeClosure: extractCafeClosure(apis, sidoForExt),
        cafeClosureNation: extractCafeClosure(apis, ''),
        regionClosure: extractRegionClosure(apis, sigungu),
        consumerSentiment: extractConsumerSentiment(apis, sidoForExt),
        marketRentSeries: extractMarketRentSeries(apis, sangkwonCode, 8) || extractMarketRentSeries(apis, null, 8),
        vacancySeries: extractVacancySeries(apis, sangkwonCode, 8) || extractVacancySeries(apis, null, 8),
        priceIndexSeries: extractPriceIndexSeries(apis, sangkwonCode, 12) || extractPriceIndexSeries(apis, null, 12),
        cafeClosureSeries: extractCafeClosureSeries(apis, sidoForExt, 11) || extractCafeClosureSeries(apis, '', 11),
        consumerSentimentSeries: extractConsumerSentimentSeries(apis, sidoForExt, 12) || extractConsumerSentimentSeries(apis, '', 12),
        integratedRent: buildIntegratedRent(apis, sangkwonCode),
      };
    } catch (e) {
      console.warn('[UnifiedLayout] kosisBoxData build failed:', e?.message || e);
      return null;
    }
  }, [collectedData, searchAddress]);

  // [2026-05-05] 옛날 cardsProp 폴백 경로 삭제 - 에러 발견 즉시 화면에 노출되도록 함
  const cards = mappedCards || [];

  // ──────────────────────────────────────────────────────────
  // [2026-05-18] 시안 iframe 통합: 14개 카드 body 데이터를 시안용으로 변환
  // 기존 cards.map 안의 hfBody 빌드 로직을 그대로 외부 useMemo로 추출.
  // 빌드된 BC_DATA를 iframe(public/handoff_ref/index.html)에 __BC_DATA__로 푸시.
  // ──────────────────────────────────────────────────────────
  const bcCardsBodies = useMemo(() => {
    if (!Array.isArray(cards) || cards.length === 0) return [];
    return cards.slice(0, 14).map((card, i) => {
      const hfBody = {
        ...(card.bodyData || {}),
        bodyData: card.bodyData || {},
        chartData: card.chartData || {},
        kosisBoxData,
        sigungu: card.sigungu || kosisBoxData?.sigungu || '',
      };
      if (i === 13) {
        hfBody.totalScore = card.bodyData?.overallScore || 0;
        hfBody.opportunities = card.bodyData?.opportunities || 0;
        hfBody.risks = card.bodyData?.risks || 0;
        hfBody.recommendation = card.bodyData?.recommendation || '';
        const c13bd = cards[12]?.bodyData || {};
        hfBody.axes = [
          { label: '시장 매력도', max: 20, score: Number(c13bd.scoreMarket) || 0 },
          { label: '경쟁 환경', max: 20, score: Number(c13bd.scoreCompete) || 0 },
          { label: '시장 변화', max: 15, score: Number(c13bd.scoreChange) || 0 },
          { label: '생존 기반', max: 30, score: Number(c13bd.scoreSurvival) || 0 },
          { label: '비용 부담', max: 15, score: Number(c13bd.scoreCost) || 0 },
        ];
        const sig = card.chartData?.signals || [];
        if (Array.isArray(sig) && sig.length > 0) {
          hfBody.signals = sig;
        } else {
          const opps = card.chartData?.opportunities || [];
          const risks = card.chartData?.risks || [];
          hfBody.signals = [
            ...opps.map(o => ({ type: 'positive', text: o.title ? `${o.title} — ${o.detail || ''}` : (o.detail || '') })),
            ...risks.map(r => ({ type: 'negative', text: r.title ? `${r.title} — ${r.detail || ''}` : (r.detail || '') })),
          ];
        }
        hfBody.tags = card.chartData?.tags || [];
      }
      if (i === 12) {
        const bd = card.bodyData || {};
        const c1bd = cards[0]?.bodyData || {};
        const c5bd = cards[5]?.bodyData || {};
        const c2bd = cards[2]?.bodyData || {};
        hfBody.totalScore = bd.score || 0;
        hfBody.scoreMarket = bd.scoreMarket || 0;
        hfBody.scoreCompete = bd.scoreCompete || 0;
        hfBody.scoreChange = bd.scoreChange || 0;
        hfBody.scoreSurvival = bd.scoreSurvival || 0;
        hfBody.scoreCost = bd.scoreCost || 0;
        // [2026-05-18] 카드 13 "3년 생존" KPI는 카드 03(card12) survivalRate3y와 동일하게 표시
        // 카드 03이 폴백(전국평균 39%)까지 포함해 항상 값을 보장하므로 c2bd 우선
        hfBody.survival3y = c2bd.survivalRate3y || bd.survival3yr || 0;
        hfBody.cafeSales = bd.cafeSales || c5bd.monthly || 0;
        hfBody.guAvg = bd.guAvg || c5bd.guAvg || 0;
        hfBody.cafeCount = bd.cafeCount || bd.totalCafes || c1bd.cafes || 0;
        // [2026-05-19] 시장 변화 폴백용: 신규/폐업 수 주입 (cards-c.jsx Card13 scoreChange 폴백)
        hfBody.openCount = Number(c2bd.openCount) || Number(c1bd.newOpen) || 0;
        hfBody.closeCount = Number(c2bd.closeCount) || Number(c1bd['폐업 매장']) || 0;
        hfBody.franchiseCount = bd.franchiseCount || c1bd.franchise || 0;
        hfBody.individualCount = bd.indieCount || bd.independentCount || c1bd.individual || 0;
        hfBody.avgRent = bd.avgRent || (kosisBoxData?.integratedRent?.value || 0);
        hfBody.premiumCost = bd.premiumCost || 0;
        hfBody.weatherLabel = bd.externalIndicators?.weatherLabel || '';
        hfBody.weatherScore = bd.externalIndicators?.weatherScore || 0;
        hfBody.externalIndicators = bd.externalIndicators || null;
        const c12bdRising = cards[2]?.bodyData || {};
        if (bd.risingMenu) hfBody.risingMenu = bd.risingMenu;
        else if (Array.isArray(bd.risingMenus) && bd.risingMenus.length > 0) hfBody.risingMenu = bd.risingMenus[0];
        else if (Array.isArray(c12bdRising.risingMenus) && c12bdRising.risingMenus.length > 0) hfBody.risingMenu = c12bdRising.risingMenus[0];
        else hfBody.risingMenu = null;
        const _popList = Array.isArray(bd.popularMenus) && bd.popularMenus.length > 0
          ? bd.popularMenus
          : (Array.isArray(c12bdRising.popularMenus) ? c12bdRising.popularMenus : []);
        if (_popList.length > 0) {
          hfBody.popularMenuTop = _popList[0];
          hfBody.popularMenuCount = _popList.length;
        }
      }
      if (i === 8) {
        const bd = card.bodyData || {};
        const c12bd = cards[2]?.bodyData || {};
        const c1bd = cards[0]?.bodyData || {};
        const c11bd = cards[12]?.bodyData || {};
        hfBody.vacancy = kosisBoxData?.vacancy?.value || 0;
        hfBody.newOpen = Number(bd.recentOpen) || Number(bd.openCount)
          || Number(c12bd.openCount) || Number(c11bd.recentOpen)
          || Number(c1bd.newOpen) || 0;
        hfBody.closed = Number(bd.recentClose) || Number(bd.closeCount)
          || Number(c12bd.closeCount) || Number(c11bd.recentClose)
          || Number(c1bd['폐업 매장']) || 0;
        hfBody.cafeMonthly = (cards[5]?.bodyData?.monthly) || 0;
        hfBody.guAvg = (cards[5]?.bodyData?.guAvg) || 0;
        hfBody.individualPct = (() => {
          if (bd.totalCafes > 0) return Math.round(((bd.independentCount || 0) / bd.totalCafes) * 100);
          const _c1Total = Number(c1bd.cafes) || 0;
          const _c1Indi = Number(c1bd.individual) || 0;
          if (_c1Total > 0 && _c1Indi >= 0) return Math.round((_c1Indi / _c1Total) * 100);
          return 0;
        })();
        hfBody.survival3y = (cards[2]?.bodyData?.survivalRate3y) || 0;
      }
      if (i === 4) {
        // Card 5 (개인 카페 분석, 시안 표시 위치 06): null/0 필드 폴백
        const _bd = card.bodyData || {};
        const _c5bd = cards[5]?.bodyData || {};
        if (!hfBody.bodyData) hfBody.bodyData = { ..._bd };
        if (!Number(hfBody.bodyData.avgMonthlySales)) {
          // c5.monthly가 만원 단위로 들어옴 → 그대로 사용
          const _m = Number(_c5bd.monthly) || 0;
          if (_m > 0) hfBody.bodyData.avgMonthlySales = _m;
        }
        if (!Number(hfBody.bodyData.franchiseMinPrice)) {
          hfBody.bodyData.franchiseMinPrice = 2500; // 저가 브랜드 (메가/컴포즈)
        }
        if (!Number(hfBody.bodyData.franchiseMaxPrice)) {
          hfBody.bodyData.franchiseMaxPrice = 4700; // 스타벅스 톨 아메
        }
      }
      if (i === 5) {
        const c1 = cards[0]?.bodyData || {};
        hfBody.bodyData = { ...(card.bodyData || {}), totalCafes: c1.cafes || 0 };
        const bd = card.bodyData || {};
        if (!hfBody.bodyData.bizmapAvgUnitPrice && bd.bizmapAvgPayment) {
          hfBody.bodyData.bizmapAvgUnitPrice = `${Number(bd.bizmapAvgPayment).toLocaleString()}원`;
        }
        // [2026-05-19 객단가 폴백 추가] 정답지 카드 06 매출분석 사양:
        //   비즈맵 raw가 없을 때 카드 03 popularMenus 가중평균으로 객단가 폴백.
        //   공식: Σ(avgPrice × salesRate) / Σ(salesRate)
        if (!hfBody.bodyData.bizmapAvgUnitPrice) {
          const _popList = (cards[2]?.bodyData?.popularMenus) || [];
          if (Array.isArray(_popList) && _popList.length > 0) {
            let _sumWP = 0, _sumR = 0;
            _popList.forEach(m => {
              const p = Number(m?.avgPrice) || 0;
              const r = Number(m?.salesRate) || 0;
              if (p > 0 && r > 0) { _sumWP += p * r; _sumR += r; }
            });
            if (_sumR > 0) {
              const _wAvg = Math.round(_sumWP / _sumR);
              if (_wAvg > 0 && _wAvg < 100000) {
                hfBody.bodyData.popularMenuWeightedAvg = _wAvg;
              }
            }
          }
        }
      }
      if (i === 0) {
        const bd = card.bodyData || {};
        hfBody.cafeCount = bd.cafes || 0;
        hfBody.franchise = bd.franchise || 0;
        hfBody.individual = bd.individual || 0;
        hfBody.bakery = bd.bakery || 0;
        hfBody.newOpen = bd.newOpen || 0;
        hfBody.closed = bd['폐업 매장'] || 0;
        // [unit-safe] integratedRent는 unit이 '만원/평' (이미 만원)인 경우 그대로,
        // '원/평' 단위라면 /10000. marketRent는 항상 '원/평'이므로 /10000.
        {
          const _ir = kosisBoxData?.integratedRent;
          hfBody.rentPerPyeong = _ir?.value
            ? (typeof _ir.unit === 'string' && _ir.unit.indexOf('만원') >= 0
                ? Math.round(_ir.value)
                : Math.round(_ir.value / 10000))
            : (kosisBoxData?.marketRent?.value ? Math.round(kosisBoxData.marketRent.value / 10000) : 0);
        }
        hfBody.vacancyRate = kosisBoxData?.vacancy?.value || 0;
        hfBody.priceChange = kosisBoxData?.priceChange?.value || 0;
        hfBody.rentSeries = kosisBoxData?.marketRentSeries?.series || null;
        hfBody.vacancySeries = kosisBoxData?.vacancySeries?.series || null;
        hfBody.priceSeries = kosisBoxData?.priceIndexSeries?.series || null;
      }
      if (i === 1) {
        const cd = card.chartData || {};
        const bd = card.bodyData || {};
        const c6bd = cards[6]?.bodyData || {};
        hfBody.topAge = cd.topAge || bd.topAge || '';
        hfBody.maleRatio = bd.male ?? cd.male ?? 0;
        hfBody.femaleRatio = bd.female ?? cd.female ?? 0;
        hfBody.weekdayPct = bd.weekdayPct ?? cd.weekdayPct ?? c6bd.weekdayPct ?? 0;
        hfBody.weekendPct = bd.weekendPct ?? cd.weekendPct ?? c6bd.weekendPct ?? 0;
        const _pickPeak = (...vals) => {
          for (const v of vals) {
            if (v == null) continue;
            const s = String(v).trim();
            if (!s || s === '-' || s === '–') continue;
            return s;
          }
          return '-';
        };
        hfBody.peakHour = _pickPeak(bd.peakTime, bd.peakHour, cd.peakHour, c6bd.peakHour, c6bd.popPeakHour, c6bd.bizmapPeakHour);
        // [2026-05-19] customerYrEarn·라이프스타일 bodyData 명시 전달 (Card02.jsx가 body.bodyData.* 로 읽음)
        // 시안 카드(Card02.jsx)는 body.bodyData.customerYrEarn, body.bodyData.maleLifestyle/femaleLifestyle 을 읽는다.
        // hfBody는 위에서 ...bd 로 스프레드되지만, 명시적으로 한 번 더 bodyData 객체 보장.
        if (!hfBody.bodyData) hfBody.bodyData = { ...bd };
        // 폴백: customerYrEarn이 비었으면 chartData에 있는 경우 가져옴
        if (!hfBody.bodyData.customerYrEarn && cd.customerYrEarn) {
          hfBody.bodyData.customerYrEarn = cd.customerYrEarn;
        }
      }
      if (i === 2) {
        // Card 03 (상권 변화 추이): popularMenus/risingMenus가 비면
        // SNS(cards[10]) searchIntents를 폴백으로 노출하기 위해 카드 03 body에 주입
        const c10bd = cards[10]?.bodyData || {};
        if (Array.isArray(c10bd.searchIntents) && c10bd.searchIntents.length > 0) {
          hfBody.searchIntents = c10bd.searchIntents;
        }
        // survivalInsight 폴백: 1/3/5년 생존율로 한 줄 인사이트 생성
        const _bd = card.bodyData || {};
        if (!hfBody.bodyData) hfBody.bodyData = { ..._bd };
        if (!hfBody.bodyData.survivalInsight) {
          const _s1 = Number(_bd.survivalRate1y) || 0;
          const _s3 = Number(_bd.survivalRate3y) || 0;
          const _s5 = Number(_bd.survivalRate5y) || 0;
          if (_s3 > 0) {
            const _band = _s3 >= 60 ? '상위' : _s3 >= 40 ? '평균' : '주의';
            hfBody.bodyData.survivalInsight =
              `1년 ${_s1 || 65}% · 3년 ${_s3}% · 5년 ${_s5 || 28}% — ${_band} 권역.`;
          }
        }
        // avgOperatingYears 0이면 표시 제거(undefined) — 빈 값 노출 방지
        if (!Number(_bd.avgOperatingYears)) {
          hfBody.bodyData.avgOperatingYears = undefined;
        }
      }
      if (i === 6) {
        const bd = card.bodyData || {};
        if (!hfBody.bodyData) hfBody.bodyData = { ...bd };
        if (!hfBody.bodyData.peakHour || hfBody.bodyData.peakHour === '-') {
          hfBody.bodyData.peakHour = bd.popPeakHour || bd.bizmapPeakHour || '-';
        }
        if (!hfBody.bodyData.popPeakHour && bd.bizmapPeakHour) {
          hfBody.bodyData.popPeakHour = bd.bizmapPeakHour;
          hfBody.bodyData.popPeakHourPct = bd.bizmapPeakHourPct || 0;
        }
      }
      if (i === 7) {
        const bd = card.bodyData || {};
        const cd2 = card.chartData || {};
        const c8bd = cards[8]?.bodyData || {};
        const _bizmapProfit = Number(c8bd.bizmapOpIncomePct) || 0;
        const _kosisCafe = cd2.kosisCafe || null;
        if (_kosisCafe && (!_kosisCafe.profitMargin || _kosisCafe.profitMargin === 0) && _bizmapProfit > 0) {
          hfBody.chartData = { ...(hfBody.chartData || {}), kosisCafe: { ..._kosisCafe, profitMargin: _bizmapProfit } };
        } else if (!_kosisCafe && _bizmapProfit > 0) {
          hfBody.chartData = { ...(hfBody.chartData || {}), kosisCafe: { profitMargin: _bizmapProfit } };
        }
        if (cd2.premium) {
          const _pAvgManwon = Number(cd2.premium.sidoAvg) || Number(cd2.premium.nationalAvg) || 0;
          const _pRegion = cd2.premium.sidoKey || (cd2.premium.sidoAvg ? '' : '전국');
          if (_pAvgManwon > 0) {
            hfBody.chartData = { ...(hfBody.chartData || {}), premium: { ...cd2.premium, value: _pAvgManwon * 10000, region: _pRegion } };
          }
        }
        if (hfBody.chartData?.premium?.value && (!hfBody.kosisBoxData || !hfBody.kosisBoxData.premium)) {
          hfBody.kosisBoxData = { ...(hfBody.kosisBoxData || {}), premium: hfBody.chartData.premium };
        }
        if (!hfBody.chartData?.premium?.value && bd.premiumCost) {
          const _pc = Number(bd.premiumCost) || 0;
          if (_pc > 0) {
            hfBody.chartData = { ...(hfBody.chartData || {}), premium: { value: _pc * 10000, region: '' } };
          }
        }
        // [2026-05-18] Card08 단위 정규화 (만원/평 기준 통일)
        // 시안 Card08 라인 10이 integratedRent.value/10000 하므로,
        // 여기서 bodyData에 'rentPerPyeongManwon' 만원 단위 값을 미리 넣어
        // 시안이 그 값을 직접 표시하도록 한다.
        const _ir = kosisBoxData?.integratedRent;
        const _rentManwon = _ir?.value
          ? (typeof _ir.unit === 'string' && _ir.unit.indexOf('만원') >= 0
              ? Math.round(_ir.value)
              : Math.round(_ir.value / 10000))
          : (kosisBoxData?.marketRent?.value ? Math.round(kosisBoxData.marketRent.value / 10000) : 0);
        if (!hfBody.bodyData) hfBody.bodyData = { ...bd };
        if (_rentManwon > 0) hfBody.bodyData.rentPerPyeongManwon = _rentManwon;
        // [2026-05-18] bd.totalStartupCost 단위 정규화
        // Gemini 응답이 원 단위로 큰 값(예: 40,000,000)으로 올 때가 있어 만원 단위로 환산.
        // 만원 단위로 들어온 경우(예: 4,100)는 그대로 둔다.
        // 1,000,000 이상이면 원 단위로 보고 /10000.
        // 100,000 이상이면 천원 단위로 보고 /10.
        const _tsRaw = Number(bd.totalStartupCost) || 0;
        if (_tsRaw > 0) {
          let _tsManwon = _tsRaw;
          if (_tsRaw >= 1000000) _tsManwon = Math.round(_tsRaw / 10000);          // 원 단위
          else if (_tsRaw >= 100000) _tsManwon = Math.round(_tsRaw / 10);          // 천원 단위
          hfBody.bodyData.totalStartupCostManwon = _tsManwon;
        }
        // [2026-05-18] bd.deposit 단위 정규화 (만원 단위 기준)
        const _depRaw = Number(bd.deposit) || 0;
        if (_depRaw > 0) {
          let _depManwon = _depRaw;
          if (_depRaw >= 100000000) _depManwon = Math.round(_depRaw / 10000);       // 원 단위 (1억 이상)
          hfBody.bodyData.depositManwon = _depManwon;
        }
      }
      if (i === 9) {
        // [2026-05-18 / 2026-05-19 재보정] Card10 배달 매출/객단가 단위 정규화
        // delivery API mmavgSlsAmt 단위는 응답에 따라 (a)만원·(b)원 두 가지로 들어옴.
        // searchAvgPrice = sales / orders (dataMapper에서 raw 그대로 계산되어 들어옴)
        // → searchSales 만원 환산 + searchAvgPrice 원 단위로 다시 정합.
        // 정답지 카드10: searchSales(만원), searchOrders(건), searchAvgPrice(원).
        const bd = card.bodyData || {};
        if (!hfBody.bodyData) hfBody.bodyData = { ...bd };
        const _sRaw = Number(bd.searchSales) || 0;
        const _oRaw = Number(bd.searchOrders) || 0;
        const _avgRaw = Number(bd.searchAvgPrice) || 0;

        // [단위 추론] avgPrice가 1,000원 이상 100,000원 미만이면 raw sales는 원 단위(=avg×orders)
        // 그 외에는 sales가 이미 만원 단위로 들어왔다고 본다.
        let _sManwon = _sRaw;
        let _avgWon = _avgRaw;
        if (_sRaw > 0) {
          if (_avgRaw >= 1000 && _avgRaw < 100000 && _oRaw > 0) {
            // sales raw는 원 단위 (= avg × orders)
            // 만원 환산
            _sManwon = Math.round(_sRaw / 10000);
          } else if (_sRaw >= 1000000000) {
            _sManwon = Math.round(_sRaw / 10000); // 10억+ → 원으로 보고 /10000
          } else if (_sRaw >= 10000000) {
            _sManwon = Math.round(_sRaw / 10000); // 1천만+ → 원으로 보고 /10000
          }
          // _avgWon이 너무 작거나 0이면 만원 단위 sales × 10000 / orders 로 재계산
          if (_oRaw > 0 && (!(_avgWon > 0 && _avgWon < 100000))) {
            const _v = Math.round((_sManwon * 10000) / _oRaw);
            if (_v > 0 && _v < 100000) _avgWon = _v;
          }
          hfBody.bodyData.searchSales = _sManwon;
          if (_avgWon > 0) hfBody.bodyData.searchAvgPrice = _avgWon;
        }
        // cafeDeliveryAmount도 같은 보정 (만원 단위로 정규화)
        const _cRaw = Number(bd.cafeDeliveryAmount) || 0;
        if (_cRaw > 0) {
          let _cManwon = _cRaw;
          if (_cRaw >= 1000000000) _cManwon = Math.round(_cRaw / 10000);
          else if (_cRaw >= 10000000) _cManwon = Math.round(_cRaw / 10000);
          hfBody.bodyData.cafeDeliveryAmount = _cManwon;
        }
      }
      if (i === 10) {
        const bd = card.bodyData || {};
        if (!hfBody.bodyData) hfBody.bodyData = { ...bd };
        // [2026-05-18] blogMentions: 더 큰 값 우선 (naverBlog 단순 검색 < naverBlogMenus 후기 카운트)
        const _bdBlog = Number(bd.blogMentions) || 0;
        const _apiBlog = Number(collectedData?.apis?.naverBlog?.total) || 0;
        const _menuBlog = Number(collectedData?.apis?.naverBlogMenus?.data?.totalItems) || 0;
        const blogCount = Math.max(_bdBlog, _apiBlog, _menuBlog);
        if (blogCount > 0) {
          hfBody.bodyData.blogMentions = blogCount;
        }
      }
      return { n: String(i + 1).padStart(2, '0'), body: hfBody };
    });
  }, [cards, kosisBoxData, collectedData]);

  // [2026-05-18] 시안 cards-a.jsx 끝에서 window.Card05/Card06이 스왑되어 있음
  //   Object.assign(window, { Card05: Card06, Card06: Card05 })
  // → renderCard("05") = 매출 분석 컴포넌트, renderCard("06") = 개인 카페 컴포넌트
  // 우리 데이터 인덱스: cards[4] = 개인 카페, cards[5] = 매출 분석
  // 따라서 시안에 push할 때 인덱스 4와 5를 스왑해야 화면-데이터 정합성이 맞음
  const bcCardsBodiesSwapped = useMemo(() => {
    if (!Array.isArray(bcCardsBodies) || bcCardsBodies.length < 6) return bcCardsBodies;
    const out = bcCardsBodies.slice();
    const t = out[4]; out[4] = out[5]; out[5] = t;
    // n(자리 번호)은 그대로 둠 — 시안 카드 자리는 5/6 그대로
    if (out[4]) out[4] = { ...out[4], n: '05' };
    if (out[5]) out[5] = { ...out[5], n: '06' };
    return out;
  }, [bcCardsBodies]);

  // iframe → 시안 데이터 푸시
  const handoffIframeRef = useRef(null);
  // [2026-05-28] iframe 마운트 지연:
  //   결과 화면 진입 시 카드 모션(opacity+x 슬라이드) 500ms와 iframe src 로딩이
  //   동시에 시작되면 메인 스레드가 막혀 frame drop이 발생한다.
  //   resultsReady가 true가 된 직후 한 차례 모션 프레임을 보낸 뒤 iframe을 마운트한다.
  const [iframeReady, setIframeReady] = useState(false);
  useEffect(() => {
    if (!resultsReady) {
      setIframeReady(false);
      return;
    }
    // 카드 진입 모션(0.5s) 시작 직후 한 프레임만 양보. 약간 더 여유 둠.
    const id = setTimeout(() => setIframeReady(true), 80);
    return () => clearTimeout(id);
  }, [resultsReady]);
  // [2026-05-19] 검색 주소가 시안 TopBar 기본값("강남역 1번 출구")으로 덮이지 않도록
  // collectedData / searchAddress에서 실제 주소를 추출해 iframe으로 함께 푸시한다.
  const bcSearchAddress = useMemo(() => {
    const _addr =
      collectedData?.addressInfo?.address ||
      collectedData?.address ||
      collectedData?.region ||
      searchAddress ||
      '';
    return String(_addr).trim();
  }, [collectedData, searchAddress]);
  useEffect(() => {
    if (!resultsReady) return;
    const win = handoffIframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.__BC_DATA__ = { cards: bcCardsBodiesSwapped, address: bcSearchAddress, radius };
      if (typeof win.__bcRender === 'function') win.__bcRender();
    } catch (e) {
      // iframe cross-origin/not ready
    }
  }, [bcCardsBodiesSwapped, resultsReady, bcSearchAddress, radius]);

  // iframe 안에서 '다시 검색하기' 클릭 시 부모로 전달
  useEffect(() => {
    if (!resultsReady) return;
    const handler = (ev) => {
      if (!ev?.data) return;
      if (ev.data.type === 'bc:research') {
        // 영업관리 검색 화면으로 복귀 시그널
        try { window.dispatchEvent(new CustomEvent('bc:research')); } catch (_) {}
      } else if (ev.data.type === 'bc:search') {
        // iframe 검색 모달에서 '분석 시작' → 실제 새 분석 실행
        const addr = typeof ev.data.address === 'string' ? ev.data.address.trim() : '';
        if (!addr) return;
        const rad = Number(ev.data.radius);
        if (typeof window.__bcDoSearch === 'function') {
          window.__bcDoSearch(addr, Number.isFinite(rad) && rad > 0 ? rad : undefined);
        } else {
          // 폴백: onSearch prop 직접 호출
          try { onSearch(addr, Number.isFinite(rad) && rad > 0 ? rad : radius); } catch (_) {}
        }
      } else if (ev.data.type === 'bc:map') {
        // iframe 카드의 '지도로 보기' → 부모의 진짜 네이버 지도 오버레이 열기
        setShowCafeMap(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [resultsReady, onSearch, radius]);

  // ── Card navigation state (toss-style one-card-per-viewport) ──
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const cardScrollRef = useRef(null);
  const cardSectionRefs = useRef([]);

  // Reset refs length when card count changes
  useEffect(() => {
    cardSectionRefs.current = cardSectionRefs.current.slice(0, cards.length);
  }, [cards.length]);

  // IntersectionObserver: track which card is currently centered in the scroll area
  // [bugfix] refs are populated after AnimatePresence mounts the cards branch.
  // We retry with rAF until at least one section is mounted so the observer doesn't
  // silently attach to zero targets (the root case of the "nav stuck on 01" bug).
  useEffect(() => {
    if (!resultsReady) return;
    if (!cards || cards.length === 0) return;

    let observer = null;
    let rafId = null;
    let cancelled = false;

    const attach = () => {
      if (cancelled) return;
      const root = cardScrollRef.current;
      const observed = cardSectionRefs.current.filter(Boolean);
      if (!root || observed.length === 0) {
        rafId = requestAnimationFrame(attach);
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          let best = null;
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
          });
          if (best) {
            const idx = Number(best.target.getAttribute('data-card-section-index'));
            if (!Number.isNaN(idx)) setActiveCardIndex(idx);
          }
        },
        {
          root,
          // lower threshold so the first-frame intersection registers even when
          // the section height exceeds the viewport
          threshold: [0.1, 0.25, 0.5, 0.75],
          // narrow the "active band" to the vertical center of the scroll root
          rootMargin: '-35% 0px -35% 0px',
        }
      );
      observed.forEach((el) => observer.observe(el));
    };

    attach();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
    };
  }, [resultsReady, cards.length]);

  // Scroll to a specific card by index (smooth)
  // [bugfix] using offsetTop relative to a non-offsetParent root returned the
  // wrong coordinate when the sections' wrapper was the offsetParent; switch to
  // querying by data attribute + using getBoundingClientRect so the math is
  // correct regardless of intermediate layout wrappers.
  // [v14.1] 마지막 카드(14)가 스크롤 스냅/높이 계산 때문에 이동 안 되던 버그 수정:
  // 마지막 카드는 항상 scrollHeight - clientHeight (바닥)로 스크롤하도록 보장.
  // 또한 이미 근접한 경우에도 activeCardIndex는 반드시 업데이트.
  const scrollToCard = useCallback((idx) => {
    const root = cardScrollRef.current;
    if (!root) return;
    const el =
      cardSectionRefs.current[idx] ||
      root.querySelector(`[data-card-section-index="${idx}"]`);
    if (!el) return;
    const rootRect = root.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let top = root.scrollTop + (elRect.top - rootRect.top);
    // 마지막 카드는 스크롤 바닥으로 강제 (scroll-snap + minHeight:100vh 환경에서
    // 계산된 top이 이미 현재 scrollTop과 동일하거나 스냅이 되돌리는 경우 대비)
    const isLast = idx === (cardSectionRefs.current.length - 1) || idx === (cards.length - 1);
    if (isLast) {
      top = Math.max(top, root.scrollHeight - root.clientHeight);
    }
    // 음수/초과 방지
    top = Math.max(0, Math.min(top, root.scrollHeight - root.clientHeight));
    root.scrollTo({ top, behavior: 'smooth' });
    setActiveCardIndex(idx);
  }, [cards.length]);

  // ── Sync initialHomepageOpen prop (양방향 동기화: 부모가 닫으면 같이 닫힘) ──
  useEffect(() => {
    setShowHomepage(initialHomepageOpen);
  }, [initialHomepageOpen]);

  // ── Notify parent when homepage panel closes ──
  const handleCloseHomepage = useCallback(() => {
    setShowHomepage(false);
    if (onHomepageClosed) onHomepageClosed();
  }, [onHomepageClosed]);

  // ── Data Source Modal State ──
  const [showSourceModal, setShowSourceModal] = useState(false);

  // ── Startup Program Popup State ──
  const [showStartupPopup, setShowStartupPopup] = useState(false);
  const [startupPopupTab, setStartupPopupTab] = useState('region'); // 'region' | 'all'
  const [startupCatPage, setStartupCatPage] = useState({}); // 카테고리별 현재 페이지

  // ── AI Director Popup State ──
  const [showDirectorPopup, setShowDirectorPopup] = useState(false);
  const [directorTab, setDirectorTab] = useState('market');
  const [directorMuted, setDirectorMuted] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const audioRef = useRef(null);

  // ── Cafe Map Modal State ──
  const [showCafeMap, setShowCafeMap] = useState(false);
  const [cafeMapRadius, setCafeMapRadius] = useState(500);
  const [cafeMapSelectedCategory, setCafeMapSelectedCategory] = useState(null);
  const cafeMapRef = useRef(null);
  const cafeMapCircleRef = useRef(null);
  const cafeMapMarkersRef = useRef([]);
  const cafeMapInfoWindowRef = useRef(null);
  const cafeMapAnimFrameRef = useRef(null);
  const [cafeMapLoading, setCafeMapLoading] = useState(false);
  const [cafeMapError, setCafeMapError] = useState(false);
  const [cafeMapRetryTick, setCafeMapRetryTick] = useState(0);

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

  const updateCafeMarkerVisibility = useCallback((r, selectedCat) => {
    cafeMapMarkersRef.current.forEach(item => {
      if (!item.marker || item.type === 'center') return;
      if (!item.dist) return;
      try {
        const inRadius = r >= 500 || item.dist <= r;
        // Category matching logic
        let matchesCategory = true;
        if (selectedCat) {
          if (selectedCat === 'newOpen') {
            matchesCategory = !!item.isNewOpen || (item.clusterCafes && item.clusterCafes.some(c => c.isNewOpen));
          } else {
            const itemTypes = item.clusterCafes ? item.clusterCafes.map(c => c._type) : [item.type];
            matchesCategory = itemTypes.includes(selectedCat);
          }
        }
        const el = item.marker.getElement ? item.marker.getElement() : null;
        if (el) {
          el.style.transition = 'opacity 0.3s ease';
          if (!inRadius) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          } else if (selectedCat && !matchesCategory) {
            el.style.opacity = '0.25';
            el.style.pointerEvents = 'auto';
          } else {
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
          }
        } else if (item.marker.setVisible) {
          item.marker.setVisible(inRadius);
        }
      } catch (e) {}
    });
  }, []);

  const handleCafeMapRadiusChange = useCallback((newR, selectedCat) => {
    const prevR = cafeMapCircleRef.current ? cafeMapCircleRef.current.getRadius() : 500;
    setCafeMapRadius(newR);
    animateCafeCircleRadius(prevR, newR);
    updateCafeMarkerVisibility(newR, selectedCat !== undefined ? selectedCat : cafeMapSelectedCategory);
  }, [animateCafeCircleRadius, updateCafeMarkerVisibility, cafeMapSelectedCategory]);

  const handleCafeMapCategoryClick = useCallback((catKey) => {
    const newCat = cafeMapSelectedCategory === catKey ? null : catKey;
    setCafeMapSelectedCategory(newCat);
    updateCafeMarkerVisibility(cafeMapRadius, newCat);
  }, [cafeMapSelectedCategory, cafeMapRadius, updateCafeMarkerVisibility]);

  // ── Cafe Map: Naver Map rendering ──
  useEffect(() => {
    const cd = collectedData;
    const coords = cd?.coordinates;
    if (!showCafeMap || !coords) return;
    setCafeMapRadius(500);
    setCafeMapSelectedCategory(null);
    setCafeMapLoading(true);
    setCafeMapError(false);
    if (!window.naver?.maps) {
      setCafeMapLoading(false);
      setCafeMapError(true);
      return;
    }
    const timer = setTimeout(() => {
      try {
        const container = document.getElementById('unified-cafe-map-container');
        if (!container) { setCafeMapLoading(false); setCafeMapError(true); return; }
        if (!window.naver?.maps?.LatLng) { setCafeMapLoading(false); setCafeMapError(true); return; }
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
        const circle = new window.naver.maps.Circle({ map, center, radius: 500, strokeColor: '#3182F6', strokeWeight: 2, fillColor: '#3182F6', fillOpacity: 0.08 });
        cafeMapCircleRef.current = circle;
        // Flag/pin SVGs for map markers
        const mugSvg = (color) => `<svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/><path d="M10 10 L10 15 L15 12.5 Z" fill="${color}"/></svg>`;
        // Center marker
        const centerMarker = new window.naver.maps.Marker({ map, position: center, icon: { content: mugSvg('#EF4444'), anchor: new window.naver.maps.Point(12, 36) }, zIndex: 100 });
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
        // 개별 카페 마커 생성 헬퍼 (단일 카페용)
        const createSingleMarker = (c) => {
          if (!window.naver?.maps?.LatLng) return;
          const pos=new window.naver.maps.LatLng(parseFloat(c.lat),parseFloat(c.lng));
          const color = c._type==='bakery'?'#F59E0B':c._type==='franchise'?(c.isNewOpen?'#A855F7':'#3B82F6'):(c.isNewOpen?'#A855F7':'#22C55E');
          const icon=mugSvg(color);
          const marker=new window.naver.maps.Marker({map,position:pos,icon:{content:icon,anchor:new window.naver.maps.Point(12,36)}});
          const displayName=c._type==='bakery'?c.name+' (베이커리)':(c.isNewOpen?c.name+' (신규)':c.name);
          window.naver.maps.Event.addListener(marker,'click',()=>{infoWindow.setContent(makeInfo(displayName,c.addr,c.dist));infoWindow.open(map,marker);});
          const dist=typeof c.dist==='number'?c.dist:parseFloat(c.dist)||999;
          cafeMapMarkersRef.current.push({marker,dist,type:c._type,origIcon:icon,isNewOpen:!!c.isNewOpen});
        };
        Object.values(groups).forEach(group => {
          if (group.length >= 2) {
            // 2개 이상 → 클러스터 마커
            if (!window.naver?.maps?.LatLng) return;
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
          } else {
            // 단일 카페 또는 빈 그룹 → 개별 핀 마커 (클러스터 원 "1" 방지)
            group.forEach(c => createSingleMarker(c));
          }
        });
        setCafeMapLoading(false);
      } catch(e) { console.warn('[CafeMap] init failed:', e.message); setCafeMapLoading(false); setCafeMapError(true); }
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
  }, [showCafeMap, collectedData?.coordinates, collectedData?.nearbyFranchiseList, collectedData?.nearbyIndependentList, collectedData?.nearbyBakeryList, cafeMapRetryTick]);

  // Preload bg
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/cafe-bg.jpg';
  }, []);

  // Initialize Naver Map
  useEffect(() => {
    if (!mapRevealed || !mapContainerRef.current) return;

    let ro;
    loadNaverMapSDK()
      .then(() => {
        if (!window.naver?.maps?.Map || !window.naver?.maps?.LatLng || !mapContainerRef.current) {
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
    console.log('[MapUpdate] naverReady:', naverReady, 'mapRef:', !!naverMapRef.current, 'coords:', collectedData?.coordinates);
    if (!naverReady || !naverMapRef.current || !window.naver?.maps?.LatLng) return;
    const coords = collectedData?.coordinates;
    if (!coords?.lat || !coords?.lng) return;

    const coord = new window.naver.maps.LatLng(coords.lat, coords.lng);
    naverMapRef.current.setCenter(coord);
    naverMapRef.current.setZoom(15);

    // Remove existing marker/circle
    if (naverMarkerRef.current) naverMarkerRef.current.setMap(null);
    if (naverCircleRef.current) naverCircleRef.current.setMap(null);

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
  }, [naverReady, collectedData?.coordinates?.lat, collectedData?.coordinates?.lng, radius]);

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
        if (!window.naver?.maps?.LatLng) return;
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
          setKakaoSuggestions((data.documents || []).map(d => {
            const _lat = parseFloat(d.y);
            const _lng = parseFloat(d.x);
            const _coordsValid = !isNaN(_lat) && !isNaN(_lng) && _lat > 33 && _lat < 39 && _lng > 124 && _lng < 132;
            return {
              place_name: d.place_name,
              address_name: d.address_name || d.road_address_name || '',
              coords: _coordsValid ? { lat: _lat, lng: _lng } : null,
            };
          }));
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
      ...kakao.map(k => ({ type: 'kakao', label: k.place_name, sub: k.address_name, coords: k.coords || null })),
    ].slice(0, 6);
  })();

  const handleAddressChange = useCallback((e) => {
    const val = e.target.value;
    setAddress(val);
    setAutoCompleteOpen(val.length >= 1);
    fetchKakaoSuggestions(val);
  }, [fetchKakaoSuggestions]);

  // ═══ [수집능력 고정 - 수정 금지] 자동완성 POI 좌표 획득 ═══
  // 역/출구 패턴 감지 → "XX역 XX호선 X번출구" 전체로 카카오 키워드 검색
  // → 원천 보고서와 0m 오차 좌표 획득
  // [2026-05-19] 2자리 출구(예: 14번)도 정확히 잡히도록 size=15 + 출구번호 매칭 우선 로직 도입
  const handleSuggestionClick = useCallback((label, originalLabel, suggestionCoords) => {
    setAddress(label);
    setAutoCompleteOpen(false);
    setKakaoSuggestions([]);
    // 원래 검색어에 "역" 패턴이 있으면 역 이름으로 카카오 키워드 검색하여 POI 좌표 전달
    const _origLabel = originalLabel || label;
    const _stMatch = _origLabel.match(/(\S+역)/);
    if (_stMatch) {
      (async () => {
        try {
          // 원래 label 전체로 검색 (예: "강남역 2호선 1번출구") → 정확한 출구 좌표
          const _kwQuery = _origLabel.includes('출구') ? _origLabel : _stMatch[1];
          // 출구 번호 추출 (1~2자리 모두 허용 — \d+)
          const _exitMatch = _origLabel.match(/(\d+)\s*번\s*출구/);
          const _exitNum = _exitMatch ? _exitMatch[1] : null;
          // size=15로 받아 출구 번호가 정확히 일치하는 결과 우선 선택
          const kwRes = await fetch(`/.netlify/functions/kakao-proxy?type=keyword&query=${encodeURIComponent(_kwQuery)}&size=15`);
          const kwData = await kwRes.json();
          const docs = Array.isArray(kwData.documents) ? kwData.documents : [];
          let picked = null;
          if (_exitNum && docs.length > 0) {
            const _exitPatterns = [
              new RegExp(`${_exitNum}\\s*번\\s*출구`),
              new RegExp(`${_exitNum}번출구`)
            ];
            picked = docs.find(d => {
              const name = (d.place_name || '') + ' ' + (d.address_name || '');
              return _exitPatterns.some(re => re.test(name));
            }) || null;
          }
          if (!picked && docs.length > 0) picked = docs[0];
          if (picked) {
            const lat = parseFloat(picked.y);
            const lng = parseFloat(picked.x);
            if (!isNaN(lat) && !isNaN(lng) && lat > 33 && lat < 39 && lng > 124 && lng < 132) {
              console.log('[POI-FIX] 자동완성 역 패턴 감지, 카카오 키워드 좌표 보정:', _stMatch[1], picked.place_name, lat, lng, '| exitNum:', _exitNum);
              onSearch(label, radius, { poiCoords: { lat, lng } });
              return;
            }
          }
        } catch (e) { /* 폴백 */ }
        onSearch(label, radius);
      })();
    } else {
      // 비역(도로명·상권명·교차로 등) — 자동완성 항목이 들고 있는 카카오 좌표를 그대로 POI 좌표로 전달
      // 좌표가 없거나 무효면 3번째 인자 생략 → searchSalesModeRegion 의 resolvePOICoords 폴백이 그대로 동작
      const _sc = suggestionCoords;
      if (_sc && typeof _sc.lat === 'number' && typeof _sc.lng === 'number'
          && !isNaN(_sc.lat) && !isNaN(_sc.lng)
          && _sc.lat > 33 && _sc.lat < 39 && _sc.lng > 124 && _sc.lng < 132) {
        console.log('[POI-FIX] 자동완성 비역 패턴, 카카오 좌표 전달:', label, _sc.lat, _sc.lng);
        onSearch(label, radius, { poiCoords: { lat: _sc.lat, lng: _sc.lng } });
      } else {
        onSearch(label, radius);
      }
    }
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

  // [2026-05-18] 결과 화면(resultsReady)에서는 시안 iframe이 화면 100% 점유.
  // 우리 영업관리 사이드바(좌측 패널)와 토글 버튼 전부 숨김.
  // [2026-05-18] 모바일에서는 검색 화면에서 좌측 패널(검색+지도)을 부모 100%로,
  // PC는 기존 100vw 유지. resultsReady=true면 좌측 패널 0px (시안 사이드바가 따로 들어감)
  const leftWidth = resultsReady
    ? '0px'
    : salesModeLoading
      ? LAYOUT.mapPanelWidth
      : (isMobile ? '100%' : '100vw');
  // 토글 버튼 제거 (결과 화면에서 우리 UI 0건)
  const showSidebarToggle = false;
  // 결과 화면에서는 항상 collapsed 처리 — CSS로 left panel 완전 차단
  const sidebarCollapsedAttr = resultsReady ? 'true' : 'false';

  return (
    <div
      style={{
        position: embedded ? 'absolute' : 'fixed',
        inset: 0,
        background: COLORS.black,
        overflow: 'hidden',
        display: 'flex',
      }}
      className={'unified-layout-root' + (resultsReady ? ' bc-app theme-dark bc-shell ' + (sidebarCollapsed ? 'sb-closed' : 'sb-open') : '')}
      data-results={resultsReady ? 'true' : 'false'}
      data-sidebar-collapsed={sidebarCollapsedAttr}
    >
      {/* [2026-05-05] 카드 매핑 실패 시 빨간 배너 (dev 환경만) - 옛날 폴백 차단 후 에러 즉시 노출용 */}
      {mappingError && import.meta.env.DEV && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999,
          background: '#dc2626', color: '#fff',
          padding: '12px 18px', fontSize: 13, fontWeight: 700,
          fontFamily: 'monospace', borderBottom: '2px solid #fff',
          boxShadow: '0 4px 16px rgba(220,38,38,0.5)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          [카드 데이터 매핑 실패] {mappingError}
        </div>
      )}
      {/* ── Cafe Map Modal (Stitch v2 midnight_foundry) ── */}
      <AnimatePresence>
      {showCafeMap && collectedData?.coordinates && (() => {
        // Compute in-radius count (filter by dist; avoids >=500 shortcut now that max=2000)
        const fr = collectedData?.nearbyFranchiseList || [];
        const ind = collectedData?.nearbyIndependentList || [];
        const bk = collectedData?.nearbyBakeryList || [];
        const allCafesForCount = [...fr, ...ind, ...bk].filter(c => c.lat && c.lng);
        const inRadiusCount = allCafesForCount.filter(c => {
          const d = typeof c.dist === 'number' ? c.dist : parseFloat(c.dist);
          return !isNaN(d) && d <= cafeMapRadius;
        }).length;
        const isEmpty = !cafeMapLoading && !cafeMapError && inRadiusCount === 0;
        const radiusLabel = cafeMapRadius < 1000 ? `${cafeMapRadius}m` : `${cafeMapRadius / 1000}km`;
        const categories = [
          { color: '#DC2626', label: '검색 위치', key: null },
          { color: '#3B82F6', label: '프랜차이즈', key: 'franchise' },
          { color: '#22C55E', label: '개인카페', key: 'independent' },
          { color: '#F59E0B', label: '베이커리', key: 'bakery' },
          { color: '#A855F7', label: '신규 오픈', key: 'newOpen' },
        ];
        return (
          <motion.div
            key="cafe-map-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => setShowCafeMap(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              willChange: 'opacity',
            }}
          >
            <motion.div
              key="cafe-map-panel"
              initial={{ opacity: 0, transform: 'translateY(40px) translateZ(0)' }}
              animate={{ opacity: 1, transform: 'translateY(0px) translateZ(0)' }}
              exit={{ opacity: 0, transform: 'translateY(40px) translateZ(0)' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '90vw', maxWidth: 600, height: '70vh',
                background: '#000000', borderRadius: 16,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                willChange: 'transform, opacity',
                backfaceVisibility: 'hidden',
                fontFamily: "'Inter', 'Pretendard', -apple-system, sans-serif",
              }}
            >
              {/* ───────── Header ───────── */}
              {cafeMapError ? (
                // Error header (_2 style): [map icon] [center title] [settings icon]
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px', paddingTop: 32, background: 'rgba(14,14,14,0.9)',
                }}>
                  <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" />
                      <line x1="16" y1="6" x2="16" y2="22" />
                    </svg>
                  </div>
                  <h3 style={{
                    fontSize: 18, fontWeight: 700, color: '#FFFFFF', margin: 0,
                    letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                  }}>
                    카페 위치 지도
                  </h3>
                  <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </div>
                </div>
              ) : isEmpty ? (
                // Empty header (_1 style): [map icon BLUE fill] + title + [settings icon]
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px', paddingTop: 32, background: 'rgba(14,14,14,0.9)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#3B82F6" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" stroke="#000" />
                      <line x1="16" y1="6" x2="16" y2="22" stroke="#000" />
                    </svg>
                    <h3 style={{
                      fontSize: 18, fontWeight: 700, color: '#FFFFFF', margin: 0,
                      letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                    }}>
                      카페 위치 지도
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCafeMap(false)}
                    aria-label="닫기"
                    style={{
                      width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', borderRadius: 9999,
                      cursor: 'pointer', padding: 0, transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1B1B1B'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8B8B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                // Default header (_5 style): [back arrow] + title | [close X]
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px', paddingTop: 32, background: 'rgba(14,14,14,0.9)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                      onClick={() => setShowCafeMap(false)}
                      aria-label="뒤로가기"
                      style={{
                        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8B8B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                    </button>
                    <h3 style={{
                      fontSize: 18, fontWeight: 500, color: '#FFFFFF', margin: 0,
                      letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                    }}>
                      카페 위치 지도
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCafeMap(false)}
                    aria-label="닫기"
                    style={{
                      width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', borderRadius: 9999,
                      cursor: 'pointer', padding: 0, transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1B1B1B'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8B8B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
              {/* Slider + Filter bar: hidden in error/empty state */}
              {!cafeMapError && !isEmpty && (
                <>
                  {/* ───────── Radius Slider ───────── */}
                  <div style={{
                    padding: '8px 24px 16px', borderBottom: '1px solid #1B1B1B',
                    background: 'rgba(14,14,14,0.9)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#B8B8B8' }}>검색 반경</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#3B82F6', letterSpacing: '-0.01em' }}>{radiusLabel}</span>
                    </div>
                    <input
                      type="range" min={100} max={500} step={50} value={cafeMapRadius}
                      onChange={e => handleCafeMapRadiusChange(Number(e.target.value))}
                      className="cafe-map-range"
                      style={{
                        width: '100%', height: 4, borderRadius: 8,
                        background: '#353535', accentColor: '#3B82F6',
                        appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#B8B8B8', opacity: 0.6 }}>100m</span>
                      <span style={{ fontSize: 11, color: '#B8B8B8', opacity: 0.6 }}>500m</span>
                    </div>
                  </div>
                  {/* ───────── Filter Bar: count + chips ───────── */}
                  <div style={{ background: '#000000', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '12px 24px' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#FFFFFF' }}>
                        총 <span style={{ color: '#3B82F6', fontWeight: 700 }}>{inRadiusCount}개</span>의 결과
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex', gap: 8, padding: '0 24px 16px',
                        overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
                      }}
                      className="cafe-map-chip-scroll"
                    >
                      {categories.map(item => {
                        const isClickable = item.key !== null;
                        const isSelected = cafeMapSelectedCategory === item.key;
                        const isDimmed = cafeMapSelectedCategory && !isSelected && isClickable;
                        // Active/default (_5 style): bg {color}1A, border {color}33, dot+text {color}
                        // Dimmed (_3 pattern): bg #1B1B1B, border transparent, dot+text #B8B8B8
                        const activeBg = `${item.color}1A`;
                        const activeBorder = `${item.color}33`;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={isClickable ? () => handleCafeMapCategoryClick(item.key) : undefined}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '6px 12px', borderRadius: 9999,
                              background: isDimmed ? '#1B1B1B' : activeBg,
                              border: `1px solid ${isDimmed ? 'transparent' : activeBorder}`,
                              cursor: isClickable ? 'pointer' : 'default',
                              whiteSpace: 'nowrap', flexShrink: 0,
                              transition: 'background 0.3s ease, border-color 0.3s ease',
                              userSelect: 'none',
                            }}
                          >
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: isDimmed ? '#B8B8B8' : item.color,
                              display: 'inline-block',
                            }} />
                            <span style={{
                              fontSize: 12, fontWeight: 500,
                              color: isDimmed ? '#B8B8B8' : item.color,
                            }}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              {/* Hide Naver Maps logo/watermark + hide chip scrollbar */}
              <style>{`
                #unified-cafe-map-container .nmap_logo_area,
                #unified-cafe-map-container a[href*="naver.com"],
                #unified-cafe-map-container img[src*="naver"] {
                  display: none !important;
                  opacity: 0 !important;
                  visibility: hidden !important;
                }
                .cafe-map-chip-scroll::-webkit-scrollbar { display: none; }
                @keyframes cafeMapSpin { to { transform: rotate(360deg); } }
              `}</style>
              {/* ───────── Map area with overlays ───────── */}
              <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#0E0E0E' }}>
                <div id="unified-cafe-map-container" style={{ position: 'absolute', inset: 0, transform: 'translateZ(0)' }} />
                {/* Loading overlay (kept from previous impl) */}
                {cafeMapLoading && !cafeMapError && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 14,
                    background: 'rgba(0,0,0,0.55)', zIndex: 5, pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6',
                      animation: 'cafeMapSpin 0.9s linear infinite',
                    }} />
                    <span style={{ fontSize: 12, color: '#B8B8B8' }}>카페 정보를 불러오는 중...</span>
                  </div>
                )}
                {/* Empty state overlay (_1 fullscreen) */}
                {isEmpty && (
                  <div style={{
                    position: 'absolute', inset: 0, background: '#050505',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4, overflow: 'hidden',
                  }}>
                    {/* Grid pattern overlay */}
                    <div style={{
                      position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
                      backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                      backgroundSize: '64px 64px',
                    }} />
                    {/* Atmospheric glow */}
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 192, height: 192, borderRadius: '50%',
                      background: '#1E3A8A', opacity: 0.08,
                      filter: 'blur(60px)', pointerEvents: 'none',
                    }} />
                    <div style={{
                      position: 'relative', zIndex: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      textAlign: 'center', padding: '0 24px', maxWidth: 384,
                    }}>
                      {/* Info icon (thin stroke) */}
                      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </div>
                      <h2 style={{
                        fontSize: 18, fontWeight: 500, color: '#FFFFFF',
                        margin: '0 0 8px', letterSpacing: '-0.02em',
                      }}>반경 내 카페가 없습니다</h2>
                      <p style={{
                        fontSize: 14, fontWeight: 300, color: '#B8B8B8', margin: 0,
                      }}>반경을 늘려보세요</p>
                    </div>
                  </div>
                )}
                {/* Error state overlay (_2 fullscreen) */}
                {cafeMapError && (
                  <div style={{
                    position: 'absolute', inset: 0, background: '#1B1B1B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20, zIndex: 10, overflow: 'hidden',
                  }}>
                    {/* Dimmed grid decoration */}
                    <div style={{
                      position: 'absolute', inset: 0, opacity: 0.2, pointerEvents: 'none',
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)',
                      gap: 2,
                    }}>
                      <div style={{ background: '#353535', gridColumn: 'span 2', gridRow: 'span 1', borderRadius: 2 }} />
                      <div style={{ background: '#353535', gridColumn: 'span 1', gridRow: 'span 2', borderRadius: 2 }} />
                      <div style={{ background: '#353535', gridColumn: 'span 1', gridRow: 'span 1', borderRadius: 2 }} />
                      <div style={{ background: '#353535', gridColumn: 'span 1', gridRow: 'span 1', borderRadius: 2 }} />
                      <div style={{ background: '#353535', gridColumn: 'span 2', gridRow: 'span 2', borderRadius: 2 }} />
                      <div style={{ background: '#353535', gridColumn: 'span 1', gridRow: 'span 3', borderRadius: 2 }} />
                      <div style={{ background: '#353535', gridColumn: 'span 1', gridRow: 'span 1', borderRadius: 2 }} />
                      <div style={{ background: '#353535', gridColumn: 'span 2', gridRow: 'span 1', borderRadius: 2 }} />
                    </div>
                    {/* Error card */}
                    <div style={{
                      position: 'relative', zIndex: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: 32, maxWidth: 320, width: '100%',
                      background: '#000000', borderRadius: 16,
                      border: '1px solid rgba(68,70,81,0.2)',
                    }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'rgba(147,0,10,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 24,
                      }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
                          <path d="M12 2 L1 21 L23 21 Z" />
                          <rect x="11" y="9" width="2" height="6" fill="#000" />
                          <circle cx="12" cy="17.5" r="1.1" fill="#000" />
                        </svg>
                      </div>
                      <h4 style={{
                        fontSize: 18, fontWeight: 700, color: '#FFFFFF',
                        margin: '0 0 8px', letterSpacing: '-0.02em',
                      }}>
                        지도를 불러올 수 없습니다
                      </h4>
                      <p style={{
                        fontSize: 14, fontWeight: 300, color: '#B8B8B8',
                        margin: '0 0 32px', textAlign: 'center',
                      }}>
                        네이버 지도 인증에 실패했습니다
                      </p>
                      <button
                        type="button"
                        onClick={() => { setCafeMapError(false); setCafeMapRetryTick(t => t + 1); }}
                        style={{
                          width: '100%', padding: '12px 24px', borderRadius: 8,
                          background: 'transparent', border: '1px solid #FFFFFF',
                          color: '#FFFFFF', fontSize: 14, fontWeight: 500,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          cursor: 'pointer', transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="23 4 23 10 17 10" />
                          <polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                        </svg>
                        <span>다시 시도</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
      </AnimatePresence>

      {/* ── Startup Program Popup Modal ── */}
      <AnimatePresence>
      {showStartupPopup && (() => {
        const startupCard = cards?.find(c => c.metaInfo === '창업지원');
        if (!startupCard) return null;
        const regionProgs = startupCard.regionPrograms || [];
        const allProgs = startupCard.allPrograms || [];
        const region = startupCard.bodyData?.region || '';
        const activeProgs = startupPopupTab === 'region' ? regionProgs : allProgs;
        // AI 한 줄 요약: 제목+본문에서 실제 지원 내용/목적 추출
        const getShortDesc = (item) => {
          const text = ((item.summary || '') + ' ' + (item.title || '')).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ');
          const P = [
            { re: /융자|대출|자금지원|육성자금/i, d: '카페 오픈에 필요한 자금을 저금리로 빌릴 수 있습니다. 보증금이나 인테리어 비용이 부족하면 활용하세요.' },
            { re: /보증|특례보증|이차보전/i, d: '신용이 부족해도 보증을 통해 대출을 받을 수 있습니다. 담보가 없는 초기 창업자에게 유리합니다.' },
            { re: /응원금|지원금|장려금/i, d: '카페 창업 초기 비용을 지원금으로 받을 수 있습니다. 조건이 맞으면 상환 없이 받는 자금입니다.' },
            { re: /인테리어|리모델링|점포환경|시설개선/i, d: '카페 인테리어나 시설 개선 비용을 지원합니다. 매장 환경을 바꾸고 싶으면 활용하세요.' },
            { re: /임대료|상가|점포/i, d: '카페 임대료 부담을 줄여주는 지원 사업입니다. 월세가 부담되면 확인하세요.' },
            { re: /폐업|재기|새출발|사업정리/i, d: '폐업 후 재기를 지원합니다. 사업 정리 비용이나 재창업 준비에 활용할 수 있습니다.' },
            { re: /경영안정|경영개선|운영안정/i, d: '카페 운영이 어려울 때 경영 안정 자금을 받을 수 있습니다.' },
            { re: /청년|39세/i, d: '청년 소상공인을 위한 맞춤 지원입니다. 만 39세 이하라면 우선 확인하세요.' },
            { re: /소상공인|자영업|골목/i, d: '카페 같은 소상공인을 위한 지원 사업입니다. 자격 조건을 확인하고 신청하세요.' },
          ];
          for (const { re, d } of P) { if (re.test(text)) return d; }
          return '카페 창업 시 활용 가능한 지원 사업입니다. 상세보기에서 조건을 확인하세요.';
        };
        return (
          <motion.div
            key="startup-popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => setShowStartupPopup(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              willChange: 'opacity',
            }}
          >
            <motion.div
              key="startup-popup-panel"
              initial={{ opacity: 0, transform: 'translateY(40px) translateZ(0)' }}
              animate={{ opacity: 1, transform: 'translateY(0px) translateZ(0)' }}
              exit={{ opacity: 0, transform: 'translateY(40px) translateZ(0)' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '90vw', maxWidth: 600, height: '75vh',
                background: '#111111', borderRadius: 16,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                willChange: 'transform, opacity',
                backfaceVisibility: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderBottom: '1px solid #333',
              }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.white, margin: 0 }}>
                  카페 창업 지원 프로그램
                </h3>
                <button
                  onClick={() => setShowStartupPopup(false)}
                  style={{ background: 'none', border: 'none', color: COLORS.white, fontSize: 24, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                >
                  x
                </button>
              </div>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #333' }}>
                {region && (
                  <button
                    onClick={() => setStartupPopupTab('region')}
                    style={{
                      flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: startupPopupTab === 'region' ? 700 : 400,
                      color: startupPopupTab === 'region' ? COLORS.white : '#999',
                      background: 'transparent',
                      borderBottom: startupPopupTab === 'region' ? '2px solid #fff' : '2px solid transparent',
                      transition: 'all 0.2s',
                      fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    {region} ({regionProgs.length}건)
                  </button>
                )}
                <button
                  onClick={() => setStartupPopupTab('all')}
                  style={{
                    flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: startupPopupTab === 'all' ? 700 : 400,
                    color: startupPopupTab === 'all' ? COLORS.white : '#999',
                    background: 'transparent',
                    borderBottom: startupPopupTab === 'all' ? '2px solid #fff' : '2px solid transparent',
                    transition: 'all 0.2s',
                    fontFamily: 'Pretendard, sans-serif',
                  }}
                >
                  전체 ({allProgs.length}건)
                </button>
              </div>
              {/* Program list - 카테고리별 3개씩 페이지네이션 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {activeProgs.length > 0 ? (() => {
                  const catDefs = [
                    { key: 'fund', label: '자금 지원', re: /자금|융자|대출|보증|이차보전|응원금/i },
                    { key: 'space', label: '공간 / 시설', re: /인테리어|리모델링|임대료|점포|상가|시설/i },
                    { key: 'restart', label: '재기 / 전환', re: /폐업|재기|새출발|사업정리|경영안정/i },
                    { key: 'youth', label: '청년 소상공인', re: /청년|39세/i },
                  ];
                  const grouped = {};
                  const used = new Set();
                  catDefs.forEach(({ key, re }) => {
                    grouped[key] = activeProgs.filter((p, i) => {
                      if (used.has(i)) return false;
                      const t = ((p.summary || '') + ' ' + (p.title || '') + ' ' + (p.tags || '')).replace(/<[^>]*>/g, '');
                      if (re.test(t)) { used.add(i); return true; }
                      return false;
                    });
                  });
                  grouped['etc'] = activeProgs.filter((_, i) => !used.has(i));
                  const allCats = [...catDefs, { key: 'etc', label: '기타 지원' }].filter(c => (grouped[c.key] || []).length > 0);

                  return (
                    <>
                      {/* 카테고리 가로 스크롤 탭 */}
                      <div style={{
                        display: 'flex', gap: 0, overflowX: 'auto', borderBottom: '1px solid #222',
                        padding: '0 20px', flexShrink: 0,
                        scrollbarWidth: 'none', msOverflowStyle: 'none',
                      }}>
                        {allCats.map(({ key, label }) => {
                          const isActive = (startupCatPage._activeCat || allCats[0]?.key) === key;
                          return (
                            <div
                              key={key}
                              onClick={() => setStartupCatPage(prev => ({ ...prev, _activeCat: key, [key]: 0 }))}
                              style={{
                                padding: '10px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                                fontSize: 13, fontWeight: isActive ? 700 : 400,
                                color: isActive ? COLORS.white : '#666',
                                borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
                                transition: 'all 0.2s',
                              }}
                            >
                              {label} ({grouped[key].length})
                            </div>
                          );
                        })}
                      </div>
                      {/* 선택된 카테고리의 항목 3개씩 */}
                      {(() => {
                        const activeCatKey = startupCatPage._activeCat || allCats[0]?.key;
                        const items = grouped[activeCatKey] || [];
                        const PER = 3;
                        const page = startupCatPage[activeCatKey] || 0;
                        const totalPages = Math.ceil(items.length / PER);
                        const pageItems = items.slice(page * PER, (page + 1) * PER);

                        return (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* 카드 리스트 */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                              {pageItems.map((prog, pi) => {
                                // 제목에서 [지역] 추출
                                const regionMatch = prog.title.match(/^\[([^\]]+)\]/);
                                const regionTag = regionMatch ? regionMatch[1] : (prog.org || '').replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '').slice(0, 2);
                                const cleanTitle = prog.title.replace(/^\[[^\]]+\]\s*/, '');
                                return (
                                <div key={pi} style={{
                                  padding: '20px 16px', marginBottom: 12,
                                  background: '#1a1a1a', borderRadius: 12,
                                }}>
                                  {/* 상단: 지역 태그 + 대상 */}
                                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                                    {regionTag && (
                                      <span style={{
                                        fontSize: 12, color: '#ccc', background: '#2a2a2a',
                                        padding: '3px 8px', borderRadius: 4, fontWeight: 500,
                                      }}>{regionTag}</span>
                                    )}
                                    {prog.target && (
                                      <span style={{
                                        fontSize: 12, color: '#999', background: '#222',
                                        padding: '3px 8px', borderRadius: 4,
                                      }}>{prog.target}</span>
                                    )}
                                  </div>
                                  {/* 제목 */}
                                  <div style={{
                                    fontSize: 16, fontWeight: 700, color: COLORS.white,
                                    lineHeight: 1.5, marginBottom: 10,
                                  }}>
                                    {cleanTitle}
                                  </div>
                                  {/* 기관 + 기간 */}
                                  <div style={{ fontSize: 13, color: '#777', marginBottom: 12 }}>
                                    {prog.org}{prog.executor && prog.executor !== prog.org ? ` / ${prog.executor}` : ''}
                                    {prog.period ? `  |  ${prog.period}` : ''}
                                  </div>
                                  {/* AI 요약 */}
                                  <div style={{
                                    fontSize: 14, color: '#bbb', lineHeight: 1.7,
                                    paddingLeft: 12, borderLeft: '2px solid #333',
                                  }}>
                                    {getShortDesc(prog)}
                                  </div>
                                  {/* 상세보기 */}
                                  {prog.url && (
                                    <div style={{ textAlign: 'right', marginTop: 10 }}>
                                      <span
                                        onClick={() => window.open(prog.url, '_blank', 'noopener')}
                                        style={{
                                          display: 'inline-block',
                                          fontSize: 13, color: '#FFFFFF',
                                          background: 'transparent',
                                          border: '1px solid #FFFFFF',
                                          borderRadius: 8,
                                          padding: '6px 12px',
                                          cursor: 'pointer',
                                          transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                      >상세보기 →</span>
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                            {/* 페이지네이션 */}
                            {totalPages > 1 && (
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 4, padding: '12px 0', borderTop: '1px solid #222', flexShrink: 0,
                              }}>
                                <span
                                  onClick={() => page > 0 && setStartupCatPage(prev => ({ ...prev, [activeCatKey]: page - 1 }))}
                                  style={{ padding: '6px 10px', cursor: page > 0 ? 'pointer' : 'default', color: page > 0 ? '#ccc' : '#444', fontSize: 14 }}
                                >
                                  {'<'}
                                </span>
                                {Array.from({ length: totalPages }, (_, i) => (
                                  <span
                                    key={i}
                                    onClick={() => setStartupCatPage(prev => ({ ...prev, [activeCatKey]: i }))}
                                    style={{
                                      padding: '6px 11px', cursor: 'pointer', borderRadius: 6,
                                      fontSize: 14, fontWeight: i === page ? 700 : 400,
                                      color: i === page ? '#fff' : '#666',
                                      background: i === page ? '#333' : 'transparent',
                                    }}
                                  >
                                    {i + 1}
                                  </span>
                                ))}
                                <span
                                  onClick={() => page < totalPages - 1 && setStartupCatPage(prev => ({ ...prev, [activeCatKey]: page + 1 }))}
                                  style={{ padding: '6px 10px', cursor: page < totalPages - 1 ? 'pointer' : 'default', color: page < totalPages - 1 ? '#ccc' : '#444', fontSize: 14 }}
                                >
                                  {'>'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  );
                })() : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 15 }}>
                    {startupPopupTab === 'region'
                      ? `${region} 지역의 카페 창업 지원 프로그램이 없습니다.`
                      : '카페 창업 지원 프로그램 정보가 없습니다.'
                    }
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
      </AnimatePresence>


      {/* ── AI Director Dashboard Popup Modal (v2 redesign) ── */}
      <AnimatePresence>
      {showDirectorPopup && (() => {
        // AnimatedNumber: counts from 0 to target value with easeOutCubic
        const AnimatedNumber = ({ value, active, suffix = '', prefix = '' }) => {
          const [display, setDisplay] = React.useState(0);
          const rafRef = React.useRef(null);
          React.useEffect(() => {
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            if (!active) { setDisplay(0); return; }
            const target = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9]/g, '')) || 0;
            if (target === 0) return;
            const duration = 1200;
            const startTime = performance.now();
            const animate = (now) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setDisplay(Math.round(target * eased));
              if (progress < 1) rafRef.current = requestAnimationFrame(animate);
              else rafRef.current = null;
            };
            rafRef.current = requestAnimationFrame(animate);
            return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
          }, [active, value]);
          return <span>{prefix}{display.toLocaleString()}{suffix}</span>;
        };

        // ── Data extraction from cards ──
        const insightCard = cards?.find(c => c.metaInfo === 'AI\uC885\uD569');
        const director = insightCard?.chartData?.director || {};
        const dCard1 = cards?.find(c => c.metaInfo === '\uCE74\uD398 \uD604\uD669');
        const dCard2 = cards?.find(c => c.metaInfo === '\uACE0\uAC1D');
        const dCard3 = cards?.find(c => c.metaInfo === '\uD504\uB79C\uCC28\uC774\uC988');
        const dCard5 = cards?.find(c => c.metaInfo === '\uB9E4\uCD9C');
        const dCard6 = cards?.find(c => c.metaInfo === '\uC720\uB3D9\uC778\uAD6C');
        const dCard7 = cards?.find(c => c.metaInfo === '\uC784\uB300');
        const dCardWeather = cards?.find(c => c.chartType === 'weatherImpact');
        const dCard12 = cards?.find(c => c.metaInfo === '\uACBD\uC7C1');
        const dCard13 = cards?.find(c => c.metaInfo === '\uC0C1\uAD8C\uBCC0\uD654');

        // Section 1: Market overview
        const totalCafes = dCard1?.bodyData?.cafes || dCard1?.chartData?.bigNumber || 0;
        const franchiseCount = dCard1?.bodyData?.franchise || 0;
        const individualCount = dCard1?.bodyData?.individual || 0;
        const blockType = dCard1?.bodyData?.blockType || dCard1?.bodyData?.regionType || null;
        const closedCount = dCard1?.bodyData?.['\uD3D0\uC5C5 \uB9E4\uC7A5'] || 0;
        const dailyPop = dCard6?.bodyData?.totalPop || 0;
        const monthlyPop = dailyPop > 0 ? dailyPop * 30 : 0;

        // Section 2: Customer
        const maleRatio = dCard2?.chartData?.male || 50;
        const femaleRatio = dCard2?.chartData?.female || 50;
        const ageGroups = dCard2?.chartData?.ageGroups || [];
        // 원천 데이터(vstAgeRnk)에서 직접 방문 수 가져오기
        const _vstAge = collectedData?.apis?.vstAgeRnk?.data;
        const _ageCountMap = {};
        if (Array.isArray(_vstAge)) _vstAge.forEach(a => { const k = a.age?.replace('M','') + '대'; _ageCountMap[k] = a.pipcnt || 0; });
        const _ageOrder = ['10대','20대','30대','40대','50대','50대+','60대','60대+'];
        const ageBarData = ageGroups.map(g => ({ name: g.name, value: g.pct, count: _ageCountMap[g.name] || g.count || 0 })).sort((a, b) => _ageOrder.indexOf(a.name) - _ageOrder.indexOf(b.name));
        const maleLifestyle = dCard2?.bodyData?.maleLifestyle || null;
        const femaleLifestyle = dCard2?.bodyData?.femaleLifestyle || null;

        // Section 3: Competition
        const donutData = [];
        if (individualCount > 0) donutData.push({ name: '\uAC1C\uC778\uCE74\uD398', value: individualCount });
        if (franchiseCount > 0) donutData.push({ name: '\uD504\uB79C\uCC28\uC774\uC988', value: franchiseCount });
        const donutColors = ['#F59E0B', '#3182F6'];
        const indieRatio = (totalCafes > 0 && individualCount > 0) ? Math.round((individualCount / totalCafes) * 100) : 0;
        const fcBrandCount = collectedData?.nearbyFranchiseCounts ? Object.keys(collectedData.nearbyFranchiseCounts).length : (dCard3?.bodyData?.brands?.length || dCard3?.chartData?.items?.length || 0);
        const americanoPrice = collectedData?.cafeAvgPrices?.americano || dCard1?.bodyData?.avgAmericanoPrice || null;
        const dessertPrice = collectedData?.cafeAvgPrices?.dessert || null;

        // Section 4: Profit
        const monthlySales = dCard5?.bodyData?.monthly || 0;
        const avgRent = dCard7?.bodyData?.rentPerPyeong || 0;
        const survivalRate1y = dCard13?.bodyData?.survivalRate1y || null;
        // 매출등급: 기준표 적용 (S=일50만+ A=40~50만 B=30~40만 C=20~30만 D=20만미만)
        const _monthlySalesNum = parseInt(String(monthlySales).replace(/[^0-9]/g, '')) || 0;
        const _dailySales = _monthlySalesNum > 0 ? Math.round(_monthlySalesNum / 30) : 0;
        const salesGrade = _dailySales >= 50 ? 'S' : _dailySales >= 40 ? 'A' : _dailySales >= 30 ? 'B' : _dailySales >= 20 ? 'C' : _dailySales > 0 ? 'D' : (dCard12?.chartData?.tierLabel || null);
        const _deliveryDetail = collectedData?.deliveryDetail;
        const topDeliveryCat = _deliveryDetail?.categories?.[0]?.name || null;
        const deliveryTotal = _deliveryDetail?.totalOrders || 0;
        const sunnyDays = dCardWeather?.bodyData?.sunnyDays || null;
        const rainImpact = (() => {
          const ws = dCard13?.bodyData?.weatherSalesImpact;
          if (ws && typeof ws === 'string') {
            const m = ws.match(/([+-]?\d+)%/);
            return m ? m[1] + '%' : null;
          }
          return null;
        })();

        // Section 5: Direction
        const signals = insightCard?.chartData?.signals || [];

        // Format helpers
        const fmtNum = (v) => {
          if (v == null || isNaN(v)) return '\u2014';
          if (v >= 10000) return (v / 10000).toFixed(1) + '\uC5B5';
          if (v >= 1000) return Math.round(v).toLocaleString();
          return String(v);
        };
        const fmtPop = (v) => {
          if (v == null || isNaN(v)) return '\u2014';
          if (v >= 10000) return (v / 10000).toFixed(1) + '\uB9CC';
          return v.toLocaleString();
        };

        // ── Highlight style (GPU-accelerated, 60fps) ──
        const hlStyle = (section) => {
          const base = {
            transition: 'opacity 0.6s cubic-bezier(0.4,0,0.2,1), transform 0.6s cubic-bezier(0.4,0,0.2,1)',
            willChange: 'transform, opacity',
            transform: 'translateZ(0)',
          };
          if (!activeHighlight) return { ...base, opacity: 1 };
          if (activeHighlight === section) return {
            ...base, opacity: 1,
            boxShadow: '0 0 20px rgba(49,130,246,0.3)',
            borderColor: '#3182F6',
          };
          return { ...base, opacity: 0.3 };
        };

        // ── Section card style ──
        const sectionStyle = (section) => ({
          marginBottom: 20,
          padding: 16,
          background: '#1a1a1a',
          borderRadius: 12,
          border: '1px solid #222',
          ...hlStyle(section),
        });

        // ── Metric card style ──
        const metricCard = { background: '#111', borderRadius: 10, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid #222' };
        const metricLabel = { fontSize: 11, color: '#888', fontWeight: 500, letterSpacing: '0.02em' };
        const metricValue = { fontSize: 20, color: '#fff', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 };

        // ── TTS handler ──
        const handleTTS = async () => {
          if (isPlaying) {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
            setIsPlaying(false);
            setActiveHighlight(null);
            return;
          }
          const d = director;
          const hlSegments = [
            { section: 'market', text: (d.market || '').substring(0, 60) },
            { section: 'customer', text: (d.customer || '').substring(0, 60) },
            { section: 'competition', text: (d.competition || '').substring(0, 60) },
            { section: 'profit', text: (d.profit || '').substring(0, 60) },
            { section: 'direction', text: (d.direction || '').substring(0, 60) },
          ];
          const hlTotalChars = hlSegments.reduce((s, seg) => s + seg.text.length + 20, 0);

          const pcmToWav = (audioBytes) => {
            const sr = 24000;
            const wb = new ArrayBuffer(44 + audioBytes.length);
            const dv = new DataView(wb);
            const ws = (o, s) => { for (let ii = 0; ii < s.length; ii++) dv.setUint8(o + ii, s.charCodeAt(ii)); };
            ws(0, 'RIFF'); dv.setUint32(4, 36 + audioBytes.length, true);
            ws(8, 'WAVE'); ws(12, 'fmt ');
            dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
            dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
            dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
            ws(36, 'data'); dv.setUint32(40, audioBytes.length, true);
            new Uint8Array(wb, 44).set(audioBytes);
            return { wavBuf: wb, sampleRate: sr };
          };

          const playWithHighlight = (audioBytes) => {
            const { wavBuf, sampleRate } = pcmToWav(audioBytes);
            const blob = new Blob([wavBuf], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            audioRef.current.src = url;
            audioRef.current.play().then(() => {
              setIsPlaying(true);
              const totalDuration = audioBytes.length / (sampleRate * 2);
              let cumRatio = 0;
              const timings = hlSegments.map(seg => {
                const ratio = (seg.text.length + 20) / hlTotalChars;
                const start = cumRatio * totalDuration;
                cumRatio += ratio;
                return { section: seg.section, start, end: cumRatio * totalDuration };
              });
              const onTimeUpdate = () => {
                if (!audioRef.current) return;
                const ct = audioRef.current.currentTime;
                const active = timings.find(t => ct >= t.start && ct < t.end);
                setActiveHighlight(active ? active.section : null);
              };
              audioRef.current.addEventListener('timeupdate', onTimeUpdate);
              audioRef.current.onended = () => {
                setIsPlaying(false);
                setActiveHighlight(null);
                audioRef.current.removeEventListener('timeupdate', onTimeUpdate);
                URL.revokeObjectURL(url);
              };
            }).catch(err => {
              console.log('TTS play error:', err.message);
              URL.revokeObjectURL(url);
            });
          };

          if (window.__pregenTTS) {
            setIsAudioLoading(true);
            try {
              const binary = atob(window.__pregenTTS);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              playWithHighlight(bytes);
            } catch(e) { console.log('Pregen TTS error:', e.message); }
            setIsAudioLoading(false);
            return;
          }

          setIsAudioLoading(true);
          const script = `Client: \uC774 \uC0C1\uAD8C \uBD84\uC11D \uACB0\uACFC\uAC00 \uC5B4\uB5A4\uAC00\uC694?\nDirector: ${d.market || '\uB370\uC774\uD130\uB97C \uBD84\uC11D \uC911\uC785\uB2C8\uB2E4.'}\nClient: \uACE0\uAC1D\uC740 \uC5B4\uB5A4 \uD2B9\uC131\uC774 \uC788\uB098\uC694?\nDirector: ${d.customer || '\uACE0\uAC1D \uB370\uC774\uD130\uB97C \uD655\uC778 \uC911\uC785\uB2C8\uB2E4.'}\nClient: \uACBD\uC7C1 \uC0C1\uD669\uC740\uC694?\nDirector: ${d.competition || '\uACBD\uC7C1 \uAD6C\uC870\uB97C \uD30C\uC545 \uC911\uC785\uB2C8\uB2E4.'}\nClient: \uC218\uC775\uC131\uC740 \uAD1C\uCC2E\uC744\uAE4C\uC694?\nDirector: ${d.profit || '\uC218\uC775\uC131\uC744 \uACC4\uC0B0 \uC911\uC785\uB2C8\uB2E4.'}\nClient: \uC5B4\uB5A4 \uBC29\uD5A5\uC73C\uB85C \uC900\uBE44\uD558\uBA74 \uB420\uAE4C\uC694?\nDirector: ${d.direction || '\uBC29\uD5A5\uC744 \uC815\uB9AC \uC911\uC785\uB2C8\uB2E4.'}`;

          try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error('No API key');
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: script }] }],
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    multiSpeakerVoiceConfig: {
                      speakerVoiceConfigs: [
                        { speaker: 'Client', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
                        { speaker: 'Director', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } }
                      ]
                    }
                  }
                }
              })
            });
            const result = await response.json();
            const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!audioData) throw new Error('No audio');
            const binary = atob(audioData);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            playWithHighlight(bytes);
          } catch(e) { console.log('TTS error:', e.message); }
          setIsAudioLoading(false);
        };

        return (
          <motion.div
            key="director-popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => { setShowDirectorPopup(false); if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); setActiveHighlight(null); } }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              willChange: 'opacity',
            }}
          >
            <motion.div
              key="director-popup-panel"
              initial={{ opacity: 0, transform: 'translateY(40px) translateZ(0)' }}
              animate={{ opacity: 1, transform: 'translateY(0px) translateZ(0)' }}
              exit={{ opacity: 0, transform: 'translateY(40px) translateZ(0)' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '95vw', maxWidth: 900, height: '85vh',
                background: '#111111', borderRadius: 16,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                willChange: 'transform, opacity',
                backfaceVisibility: 'hidden',
              }}
            >
              {/* Header: close · title · mute toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderBottom: '1px solid #222', flexShrink: 0,
              }}>
                <button
                  onClick={() => { setShowDirectorPopup(false); if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); setActiveHighlight(null); } if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); }}
                  style={{ background: 'transparent', border: '1px solid #FFFFFF', color: '#FFFFFF', fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: 8, fontFamily: 'Pretendard, sans-serif' }}
                >
                  X 닫기
                </button>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, fontFamily: 'Pretendard, sans-serif' }}>
                  AI {'\uB514\uB809\uD130'}
                </h3>
                <button
                  onClick={() => setDirectorMuted(v => !v)}
                  title={directorMuted ? '음소거 해제' : '음소거'}
                  style={{ background: directorMuted ? 'rgba(255,255,255,0.12)' : 'transparent', border: '1px solid #FFFFFF', color: '#FFFFFF', fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: 8, fontFamily: 'Pretendard, sans-serif' }}
                >
                  {directorMuted ? '음소거' : '사운드'}
                </button>
              </div>

              {/* Tab navigation: 시장 · 경쟁 · 생존 (outline white, active = navy underline) */}
              <div style={{
                display: 'flex', gap: 6, padding: '10px 20px', borderBottom: '1px solid #222',
                background: '#000', flexShrink: 0, justifyContent: 'center',
              }}>
                {[
                  { key: 'market', label: '시장' },
                  { key: 'competition', label: '경쟁' },
                  { key: 'direction', label: '생존' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setDirectorTab(tab.key)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #FFFFFF',
                      borderBottom: directorTab === tab.key ? '2px solid #1E3A8A' : '1px solid #FFFFFF',
                      color: '#FFFFFF',
                      fontSize: 13, fontWeight: 600,
                      padding: '6px 18px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'Pretendard, sans-serif',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Cinematic Narration View (top of content) ── */}
              <div style={{ padding: '14px 20px 4px', background: '#000', flexShrink: 0 }}>
                {(() => {
                  // TODO: replace with Gemini-produced JSON (narrationScript field)
                  // from the insightCard once backend emits it. Uses real card
                  // values where available so the demo feels grounded.
                  const demoByTab = {
                    market: [
                      { text: `이 지역의 총 카페 수는 ${totalCafes || 0}개입니다`,
                        target: 'card1.count.totalCafe', anim: 'countUp',
                        duration: 4000, value: totalCafes || 0, unit: '개', emphasis: 'navy' },
                      { text: `월 유동인구는 약 ${fmtPop(monthlyPop) || '—'}명 수준입니다`,
                        target: 'card6.info.pop', anim: 'borderGlow',
                        duration: 4000, value: monthlyPop || 0, unit: '명', emphasis: 'mint' },
                    ],
                    competition: [
                      { text: `프랜차이즈 ${franchiseCount || 0}곳, 개인카페 ${individualCount || 0}곳입니다`,
                        target: 'card3.donut.franchise', anim: 'donutFill',
                        duration: 5000, value: indieRatio || 50, unit: '%', emphasis: 'gold' },
                      { text: `경쟁 구조와 가격대를 함께 살펴봅니다`,
                        target: 'card12.info.comp', anim: 'borderGlow',
                        duration: 4000, emphasis: 'red' },
                    ],
                    direction: [
                      { text: `월세 수준은 평당 ${avgRent ? avgRent.toLocaleString() + '원' : '—'}입니다`,
                        target: 'card5.slot.monthlyRent', anim: 'slotRoll',
                        duration: 5000, value: avgRent || 0, unit: '원', emphasis: 'navy' },
                      { text: `종합 점수와 생존 방향을 확인합니다`,
                        target: 'card14.ring.score', anim: 'ringProgress',
                        duration: 5000, value: 87, unit: '점', emphasis: 'navy' },
                    ],
                  };
                  const script = { segments: demoByTab[directorTab] || demoByTab.market };
                  return (
                    <AINarrationEngine
                      key={directorTab}
                      script={script}
                      muted={directorMuted}
                      onRequestMuteToggle={(v) => setDirectorMuted(v)}
                    />
                  );
                })()}
              </div>

              {/* Scrollable dashboard content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', fontFamily: 'Pretendard, sans-serif', background: '#000000' }}>

                {/* == Section 1: Market Overview == */}
                <div data-highlight="market" style={sectionStyle('market')}>
                  <div style={{ fontSize: 13, color: '#3182F6', fontWeight: 600, marginBottom: 12, letterSpacing: '0.04em' }}>{'\uC0C1\uAD8C \uC885\uD569'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <div style={metricCard}>
                      <span style={metricLabel}>{'\uCD1D \uCE74\uD398'}</span>
                      <span style={metricValue}>
                        {(activeHighlight === 'market' && totalCafes > 0) ? <AnimatedNumber value={totalCafes} active={true} suffix={'\uAC1C'} /> : (totalCafes > 0 ? totalCafes + '\uAC1C' : '\u2014')}
                      </span>
                    </div>
                    <div style={metricCard}>
                      <span style={metricLabel}>{'\uC0C1\uAD8C\uC720\uD615'}</span>
                      <span style={{ ...metricValue, fontSize: 16 }}>{blockType || '\u2014'}</span>
                    </div>
                    <div style={metricCard}>
                      <span style={metricLabel}>{'\uC6D4 \uC720\uB3D9\uC778\uAD6C'}</span>
                      <span style={metricValue}>
                        {(activeHighlight === 'market' && monthlyPop > 0) ? <AnimatedNumber value={monthlyPop} active={true} suffix={'\uBA85'} /> : (monthlyPop > 0 ? fmtPop(monthlyPop) + '\uBA85' : '\u2014')}
                      </span>
                    </div>
                    <div style={metricCard}>
                      <span style={metricLabel}>{'\uD3D0\uC5C5 \uB9E4\uC7A5'}</span>
                      <span style={{ ...metricValue, color: closedCount > 0 ? '#EF4444' : '#fff' }}>
                        {closedCount > 0 ? closedCount + '\uACF3' : '\u2014'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* == Section 2: Customer Analysis == */}
                <div data-highlight="customer" style={sectionStyle('customer')}>
                  <div style={{ fontSize: 13, color: '#3182F6', fontWeight: 600, marginBottom: 12, letterSpacing: '0.04em' }}>{'\uACE0\uAC1D \uBD84\uC11D'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
                    {/* Gender ratio */}
                    <div style={{ ...metricCard, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                      <span style={{ ...metricLabel, marginBottom: 8 }}>{'\uC131\uBCC4 \uBE44\uC728'}</span>
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#999', width: 20, textAlign: 'right' }}>{'\uB0A8'}</span>
                          <div style={{ flex: 1, height: 10, background: '#222', borderRadius: 5, overflow: 'hidden' }}>
                            <div style={{ width: maleRatio + '%', height: '100%', background: '#3182F6', borderRadius: 5, transition: 'width 1s ease-out' }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#3182F6', fontWeight: 600, width: 36 }}>{maleRatio}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#999', width: 20, textAlign: 'right' }}>{'\uC5EC'}</span>
                          <div style={{ flex: 1, height: 10, background: '#222', borderRadius: 5, overflow: 'hidden' }}>
                            <div style={{ width: femaleRatio + '%', height: '100%', background: '#F472B6', borderRadius: 5, transition: 'width 1s ease-out' }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#F472B6', fontWeight: 600, width: 36 }}>{femaleRatio}%</span>
                        </div>
                      </div>
                    </div>
                    {/* Age bar chart */}
                    <div style={metricCard}>
                      <span style={{ ...metricLabel, marginBottom: 4 }}>{'\uC5F0\uB839\uBCC4 \uBC29\uBB38'}</span>
                      {ageBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={ageBarData} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={36} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={activeHighlight === 'customer'} animationDuration={1200} animationEasing="ease-out" label={{ position: 'right', fill: '#888', fontSize: 10, formatter: (v) => v + '%' }}>
                              {ageBarData.map((entry, i) => {
                                const maxVal = Math.max(...ageBarData.map(d => d.value));
                                return <Cell key={i} fill={entry.value === maxVal ? '#F59E0B' : '#3182F6'} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 12 }}>{'\uB370\uC774\uD130 \uC218\uC9D1 \uC911'}</div>
                      )}
                    </div>
                  </div>
                  {/* Lifestyle */}
                  {(maleLifestyle || femaleLifestyle) && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                      {[maleLifestyle, femaleLifestyle].filter(Boolean).map((ls, i) => (
                        <div key={i} style={{ background: '#111', borderRadius: 8, padding: '8px 12px', border: '1px solid #222', fontSize: 11, color: '#aaa' }}>
                          <span style={{ color: '#666', marginRight: 6 }}>{i === 0 ? '\uB0A8\uC131' : '\uC5EC\uC131'} {'\uB77C\uC774\uD504\uC2A4\uD0C0\uC77C'}</span>
                          {ls}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* == Section 3: Competition == */}
                <div data-highlight="competition" style={sectionStyle('competition')}>
                  <div style={{ fontSize: 13, color: '#3182F6', fontWeight: 600, marginBottom: 12, letterSpacing: '0.04em' }}>{'\uACBD\uC7C1 \uAD6C\uC870'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* Donut chart */}
                    <div style={{ ...metricCard, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {donutData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                              <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} stroke="none" isAnimationActive={activeHighlight === 'competition'} animationDuration={1500} animationEasing="ease-out">
                                {donutData.map((_, i) => <Cell key={i} fill={donutColors[i % donutColors.length]} />)}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                            {donutData.map((d, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: donutColors[i % donutColors.length], flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: '#ccc' }}>{d.name} {d.value}{'\uAC1C'}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 12 }}>{'\uB370\uC774\uD130 \uC218\uC9D1 \uC911'}</div>
                      )}
                    </div>
                    {/* Competition metrics */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: '\uAC1C\uC778\uCE74\uD398 \uBE44\uC728', value: indieRatio > 0 ? indieRatio + '%' : '\u2014' },
                        { label: '\uD504\uB79C\uCC28\uC774\uC988 \uBE0C\uB79C\uB4DC', value: fcBrandCount > 0 ? fcBrandCount + '\uAC1C' : '\u2014' },
                        { label: '\uC544\uBA54\uB9AC\uCE74\uB178 \uD3C9\uADE0', value: americanoPrice ? Number(americanoPrice).toLocaleString() + '\uC6D0' : '\u2014' },
                        { label: '\uB514\uC800\uD2B8 \uD3C9\uADE0', value: dessertPrice ? Number(dessertPrice).toLocaleString() + '\uC6D0' : '\u2014' },
                      ].map((item, idx) => (
                        <div key={idx} style={{ ...metricCard, padding: '10px 12px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#888' }}>{item.label}</span>
                          <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* == Section 4: Profitability == */}
                <div data-highlight="profit" style={sectionStyle('profit')}>
                  <div style={{ fontSize: 13, color: '#3182F6', fontWeight: 600, marginBottom: 12, letterSpacing: '0.04em' }}>{'\uC218\uC775\uC131'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                    <div style={metricCard}>
                      <span style={metricLabel}>{'\uCE74\uD398 \uC6D4\uD3C9\uADE0 \uB9E4\uCD9C'}</span>
                      <span style={metricValue}>
                        {(activeHighlight === 'profit' && monthlySales > 0) ? <AnimatedNumber value={monthlySales} active={true} suffix={'\uB9CC\uC6D0'} /> : (monthlySales > 0 ? fmtNum(monthlySales) + '\uC6D0' : '\u2014')}
                      </span>
                    </div>
                    <div style={metricCard}>
                      <span style={metricLabel}>{'\uD3C9\uADE0 \uC784\uB300\uB8CC'}</span>
                      <span style={metricValue}>{avgRent > 0 ? avgRent.toLocaleString() + '\uB9CC\uC6D0' : '\u2014'}</span>
                    </div>
                    <div style={metricCard}>
                      <span style={metricLabel}>{'1\uB144 \uC0DD\uC874\uC728'}</span>
                      <span style={{ ...metricValue, color: survivalRate1y && survivalRate1y >= 50 ? '#3B82F6' : survivalRate1y ? '#EF4444' : '#fff' }}>
                        {survivalRate1y ? survivalRate1y + '%' : '\u2014'}
                      </span>
                    </div>
                    <div style={metricCard}>
                      <span style={metricLabel}>{'\uB9E4\uCD9C\uB4F1\uAE09'}</span>
                      <span style={{ ...metricValue, color: '#F59E0B' }}>{salesGrade || '\u2014'}</span>
                    </div>
                  </div>
                  {/* Sub-info: delivery + weather */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#111', borderRadius: 8, padding: '10px 12px', border: '1px solid #222' }}>
                      <span style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>{'\uBC30\uB2EC'}</span>
                      <span style={{ fontSize: 12, color: '#ccc' }}>
                        {(() => {
                          const _dd = collectedData?.deliveryDetail;
                          const _cafeCat = _dd?.categories?.find(c => /카페|커피|음료/i.test(c.name));
                          if (_cafeCat) return `카페 배달 ${_cafeCat.rank}위 (월 ${_cafeCat.count?.toLocaleString()}건)`;
                          if (_dd?.available) return '카페 배달: 5순위 밖 (매장/테이크아웃 중심)';
                          return '\u2014';
                        })()}
                      </span>
                    </div>
                    <div style={{ background: '#111', borderRadius: 8, padding: '10px 12px', border: '1px solid #222' }}>
                      <span style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>{'\uAE30\uC0C1'}</span>
                      <span style={{ fontSize: 12, color: '#ccc' }}>
                        {sunnyDays ? `\uB9D1\uC740 \uB0A0 ${sunnyDays}\uC77C/\uB144` : ''}
                        {rainImpact ? `, \uBE44 \uC601\uD5A5 ${rainImpact}` : ''}
                        {!sunnyDays && !rainImpact ? '\u2014' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* == Section 5: Direction (Beancraft pitch) == */}
                <div data-highlight="direction" style={sectionStyle('direction')}>
                  <div style={{ fontSize: 13, color: '#3182F6', fontWeight: 600, marginBottom: 12, letterSpacing: '0.04em' }}>{'\uCC3D\uC5C5 \uBC29\uD5A5'}</div>
                  <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>{'\uD504\uB79C\uCC28\uC774\uC988 \uB300\uC2E0 \uAC1C\uC778\uCE74\uD398\uB97C \uD574\uC57C \uD558\uB294 \uC774\uC720'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { title: '\uC800\uAC00 \uC6D0\uB450 \uB9E4\uCE6D', desc: '\uC794\uB2F9 400~500\uC6D0\uC73C\uB85C \uC544\uBA54\uB9AC\uCE74\uB178 \uAC00\uACA9 \uACBD\uC7C1 \uAC00\uB2A5' },
                      { title: '\uC2DC\uADF8\uB2C8\uCC98 \uB9C8\uC9C4', desc: '\uAC1D\uB2E8\uAC00 6,000~9,000\uC6D0\uC73C\uB85C \uB9C8\uC9C4 \uD655\uBCF4' },
                      { title: '\uB85C\uC5F4\uD2F0 \uC5C6\uC74C', desc: '\uC6D0\uB450/\uBA54\uB274/\uC2DC\uC98C \uAD50\uCCB4\uB97C \uBCF8\uC778\uC774 \uC9C1\uC811 \uACB0\uC815' },
                    ].map((item, idx) => (
                      <div key={idx} style={{
                        background: '#111', borderRadius: 10, padding: '16px 14px',
                        border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{item.title}</span>
                        <span style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>{item.desc}</span>
                      </div>
                    ))}
                  </div>
                  {/* AI Signals */}
                  {signals.length > 0 && (
                    <div style={{ background: '#111', borderRadius: 10, padding: '12px 14px', border: '1px solid #222' }}>
                      <span style={{ fontSize: 11, color: '#666', fontWeight: 600, display: 'block', marginBottom: 8 }}>{'AI \uC2DC\uADF8\uB110'}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {signals.slice(0, 6).map((sig, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                              background: sig.type === 'positive' ? '#3B82F6' : sig.type === 'negative' ? '#EF4444' : '#F59E0B',
                            }} />
                            <span style={{ fontSize: 11, color: '#ccc', lineHeight: 1.4 }}>{sig.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── TTS Button ── */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 16 }}>
                  <button
                    onClick={handleTTS}
                    disabled={isAudioLoading}
                    style={{
                      background: 'transparent',
                      color: '#FFFFFF', border: '1px solid #FFFFFF', borderRadius: 8,
                      padding: '10px 16px', fontSize: 14, fontWeight: 600,
                      cursor: isAudioLoading ? 'wait' : 'pointer',
                      opacity: isAudioLoading ? 0.6 : 1,
                      transition: 'background 0.15s',
                      fontFamily: 'Pretendard, sans-serif',
                    }}
                    onMouseEnter={e => { if (!isAudioLoading) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {isAudioLoading ? '\uC74C\uC131 \uC0DD\uC131 \uC911...' : isPlaying ? '\uC7AC\uC0DD \uC911\uC9C0' : '\uBCF4\uACE0\uC11C \uB4E3\uAE30'}
                  </button>
                </div>

              </div>
              <audio ref={audioRef} style={{ display: 'none' }} />
            </motion.div>
          </motion.div>
        );
      })()}
      </AnimatePresence>
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

      {/* ══════ LEFT PANEL (Map + Search) ══════
          [2026-05-28] width 애니메이션 제거 (layout-trigger property라 frame drop 유발).
          width는 inline style로 즉시 적용하고, framer는 opacity만 페이드.
          최초 마운트 시 flash 방지 → initial opacity 0 명시. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={PANEL_FADE}
        onAnimationComplete={handlePanelAnimComplete}
        style={{
          position: 'relative',
          zIndex: 1,
          width: leftWidth,
          height: '100%',
          background: resultsReady ? 'transparent' : 'rgba(0,0,0,0.5)',
          backdropFilter: resultsReady ? 'none' : `blur(${BLUR.cardBackdrop}px)`,
          WebkitBackdropFilter: resultsReady ? 'none' : `blur(${BLUR.cardBackdrop}px)`,
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRight: resultsReady ? `1px solid rgba(255,255,255,0.1)` : 'none',
          willChange: 'opacity',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
        className={'unified-left-panel' + (resultsReady ? ' bc-sidebar-wrap' : '')}
      >
        {resultsReady ? (
          /* ── [핸드오프 시안 100%] 원본 Sidebar 그대로 사용 ── */
          <HfSidebar
            active={String(activeCardIndex + 1).padStart(2, '0')}
            onNav={(n) => {
              const idx = parseInt(n, 10) - 1;
              if (!isNaN(idx)) scrollToCard(idx);
            }}
            onStartTour={() => { setDirectorTab('market'); setShowDirectorPopup(true); }}
            onCategoryClick={handleCategoryClick}
            onShowAll={clearFilter}
            isAll={!filterCategory}
            filterCategory={filterCategory}
            searchAddress={bcSearchAddress}
            radius={radius}
          />
        ) : (
        <>
        {/* Map area with radial wipe */}
        <motion.div
          initial={{ clipPath: (!resultsReady && !salesModeLoading) ? 'circle(150% at 50% 50%)' : 'circle(0% at 50% 50%)' }}
          animate={{ clipPath: mapRevealed ? 'circle(150% at 50% 50%)' : 'circle(0% at 50% 50%)' }}
          transition={{ duration: MAP_WIPE_DURATION, delay: MAP_WIPE_DELAY, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            willChange: 'clip-path',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Search input */}
          <motion.div
            initial={{ opacity: (!resultsReady && !salesModeLoading) ? 1 : 0, y: (!resultsReady && !salesModeLoading) ? 0 : -10 }}
            animate={{ opacity: mapRevealed ? 1 : 0, y: mapRevealed ? 0 : -10 }}
            transition={{ duration: CONTENT_FADE_DURATION, delay: (!resultsReady && !salesModeLoading) ? 0 : MAP_WIPE_DELAY + INPUT_APPEAR_DELAY, ease: [0.16, 1, 0.3, 1] }}
            style={{ padding: '20px 20px 0', flexShrink: 0, willChange: 'transform, opacity' }}
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
                      onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(item.type === 'kakao' ? (item.sub || item.label) : item.label, item.label, item.coords); }}
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
            transition={{ duration: CONTENT_FADE_DURATION, delay: (!resultsReady && !salesModeLoading) ? 0 : MAP_WIPE_DELAY + SLIDER_APPEAR_DELAY, ease: [0.16, 1, 0.3, 1] }}
            style={{ padding: '14px 20px 0', flexShrink: 0, willChange: 'transform, opacity' }}
          >
            <RadiusSlider value={radius} onChange={setRadius} />
          </motion.div>

          {/* Map area */}
          <div style={{
            flex: resultsReady ? '0 0 52%' : 1,
            position: 'relative',
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
        </>
        )}
      </motion.div>

      {/* ══════ Sidebar collapse toggle (영업모드 결과 화면 전용) ══════ */}
      {showSidebarToggle && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? '좌측 영역 펼치기' : '좌측 영역 접기'}
          title={sidebarCollapsed ? '좌측 영역 펼치기' : '좌측 영역 접기'}
          style={{
            position: 'absolute',
            top: '50%',
            left: sidebarCollapsed ? 16 : leftWidth,
            transform: sidebarCollapsed ? 'translate(0, -50%)' : 'translate(-50%, -50%)',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(15,15,18,0.92)',
            border: '1px solid rgba(59,130,246,0.55)',
            color: '#3B82F6',
            cursor: 'pointer',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
            transition: 'left 250ms ease, background 200ms ease, color 200ms ease',
            fontFamily: "'Material Symbols Outlined', sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.18)';
            e.currentTarget.style.color = '#60A5FA';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(15,15,18,0.92)';
            e.currentTarget.style.color = '#3B82F6';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {sidebarCollapsed ? (
              <polyline points="9 6 15 12 9 18" />
            ) : (
              <polyline points="15 6 9 12 15 18" />
            )}
          </svg>
        </button>
      )}

      {/* ══════ RIGHT PANEL (Cards / Empty State) ══════ */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        style={{
          // [2026-05-18] 모바일 검색 단계에서는 우측 패널 완전 제거 (좌측 풀폭 보장)
          flex: (isMobile && !resultsReady && !salesModeLoading) ? '0 0 0px' : 1,
          width: (isMobile && !resultsReady && !salesModeLoading) ? 0 : undefined,
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2,
          display: (resultsReady || salesModeLoading) ? 'flex' : 'none',
          flexDirection: 'column',
        }}
        className={'unified-right-panel' + (resultsReady ? ' bc-canvas' : '')}
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
              ref={cardScrollRef}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: (renderResults && !mappedCards) ? '0' : '0',
                scrollSnapType: 'none',
                scrollBehavior: 'smooth',
              }}
              className={'unified-cards-scroll bc-scroll bc-canvas-scroll' + (currentFilterGroup ? ' bc-app filtered' : '')}
            >
              {(renderResults && !mappedCards) ? (
                /* ── TossStyleResults from App.jsx (passed via renderResults prop) ── */
                renderResults
              ) : (
                /* ── [2026-05-18] 시안 통째로 iframe 임베드 ──
                   public/handoff_ref/index.html을 iframe으로 띄움.
                   bcCardsBodies(useMemo)가 시안 14개 카드 body를 만들고
                   useEffect가 iframe.contentWindow.__BC_DATA__에 푸시 + __bcRender 호출.
                   시안 내 우리 카드(window.Card01~14)는 bc-cards-override.jsx에서 덮어쓰기됨.
                   [2026-05-28] iframeReady 가드: 카드 진입 모션과 iframe 로딩 충돌 방지.
                   진입 모션 첫 프레임 양보 후 마운트 → 메인 스레드 frame drop 회피. */
                iframeReady ? (
                  <iframe
                    ref={handoffIframeRef}
                    src="/handoff_ref/index.html"
                    title="빈크래프트 결과 리포트"
                    loading="lazy"
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#0a0a0a' }}
                    onLoad={() => {
                      const win = handoffIframeRef.current?.contentWindow;
                      if (!win) return;
                      try {
                        win.__BC_DATA__ = { cards: bcCardsBodiesSwapped, address: bcSearchAddress, radius };
                        if (typeof win.__bcRender === 'function') win.__bcRender();
                      } catch (_) {}
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }} />
                )
              )}
              {false && (
                <>
                  {/* ── [핸드오프 시안] TopBar (대시보드 > 의뢰인 영업모드 > 결과 리포트 + 주소 + 우측 아이콘) ── */}
                  <HfTopBar
                    address={searchAddress || '강남역 1번 출구'}
                    crumbCur="결과 리포트"
                    onToggleSidebar={toggleSidebar}
                    sidebarOpen={!sidebarCollapsed}
                    filterLabel={currentFilterGroup ? currentFilterGroup.label : null}
                    onClearFilter={clearFilter}
                  />
                  {/* Data source warning banner (fixed overlay at top) */}
                  {(() => {
                    const ds = collectedData?._dataSources;
                    if (!ds) return null;
                    const errorKeys = Object.keys(ds).filter(k => k !== '_partial' && ds[k] === 'error');
                    const isPartial = ds._partial === true;
                    if (errorKeys.length === 0 && !isPartial) return null;
                    const msg = isPartial
                      ? 'AI 분석이 일부 누락되어 기본 데이터로 표시된 항목이 있습니다'
                      : `일부 API 수집 실패 (${errorKeys.join(', ')})`;
                    return (
                      <div style={{
                        position: 'sticky', top: 8, zIndex: 20,
                        margin: '8px auto 0',
                        maxWidth: 720, padding: '8px 12px', borderRadius: 6,
                        background: 'rgba(255, 180, 50, 0.12)',
                        border: '1px solid rgba(255, 180, 50, 0.25)',
                        fontSize: 11, color: 'rgba(255, 200, 100, 0.85)',
                        fontFamily: 'Pretendard, sans-serif',
                        lineHeight: 1.5,
                        backdropFilter: 'blur(12px)',
                      }}>
                        {msg}
                      </div>
                    );
                  })()}

                  {/* Cards list — each card wrapped in a snap-aligned section */}
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                  }}>
                    {cards.map((card, i) => {
                      // ── data-anim-id map for AI Narration Engine ──
                      // Each card gets an explicit id so the cinematic engine
                      // can zoom + animate against it. Additional granular
                      // ids are attached inline where the numeric targets live.
                      const narrationIdByMeta = {
                        '카페 현황': `card1.count.totalCafe`,
                        '고객': `card2.bar.age30m`,
                        '프랜차이즈': `card3.donut.franchise`,
                        '개인카페': `card4.info.indie`,
                        '매출': `card5.slot.monthlyRent`,
                        '유동인구': `card6.info.pop`,
                        '임대': `card5.slot.deposit`,
                        '기회리스크': `card8.info.oppRisk`,
                        '배달': `card9.info.delivery`,
                        'SNS': `card10.info.sns`,
                        '경쟁': `card12.info.comp`,
                        '상권변화': `card13.info.trend`,
                        'AI종합': `card14.ring.score`,
                      };
                      const animId = narrationIdByMeta[card.metaInfo] || `card${i + 1}.section`;
                      // ── [핸드오프 시안] 카테고리 필터: 선택된 그룹의 카드만 표시 ──
                      const cardN = String(i + 1).padStart(2, '0');
                      const hiddenByFilter = filterCategory && currentFilterGroup && !currentFilterGroup.cards.includes(cardN);
                      return (
                      <section
                        key={i}
                        ref={(el) => { cardSectionRefs.current[i] = el; }}
                        data-card-section-index={i}
                        data-card-index={i}
                        data-anim-id={animId}
                        style={{
                          // 카드별 자연 높이 + 카드 사이 간격으로 자유 스크롤
                          display: hiddenByFilter ? 'none' : 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          padding: 'clamp(16px, 2vh, 24px) clamp(16px, 2vw, 28px)',
                          boxSizing: 'border-box',
                        }}
                        className="beancraft-card-section"
                      >
                        <div style={{ width: '100%', maxWidth: sidebarCollapsed ? 1400 : 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(() => {
                          // ── Handoff body 객체: 시안 카드들이 받는 통일된 prop ──
                          const hfBody = {
                            ...(card.bodyData || {}),
                            bodyData: card.bodyData || {},
                            chartData: card.chartData || {},
                            kosisBoxData,
                            sigungu: card.sigungu || kosisBoxData?.sigungu || '',
                            onMapClick: () => setShowCafeMap(true),
                          };
                          // Card14는 totalScore/axes/signals/tags를 따로 전달
                          if (i === 13) {
                            hfBody.totalScore = card.bodyData?.overallScore || 0;
                            hfBody.opportunities = card.bodyData?.opportunities || 0;
                            hfBody.risks = card.bodyData?.risks || 0;
                            hfBody.recommendation = card.bodyData?.recommendation || '';
                            // 5축 점수 - Card13(상권경쟁)의 axes 점수에서 가져옴
                            const c13bd = cards[12]?.bodyData || {};
                            hfBody.axes = [
                              { label: '시장 매력도', max: 20, score: Number(c13bd.scoreMarket) || 0 },
                              { label: '경쟁 환경', max: 20, score: Number(c13bd.scoreCompete) || 0 },
                              { label: '시장 변화', max: 15, score: Number(c13bd.scoreChange) || 0 },
                              { label: '생존 기반', max: 30, score: Number(c13bd.scoreSurvival) || 0 },
                              { label: '비용 부담', max: 15, score: Number(c13bd.scoreCost) || 0 },
                            ];
                            // 시그널 = collectedData.aiData에서, 폴백으로 c14의 Opps/Risks
                            const sig = card.chartData?.signals || [];
                            if (Array.isArray(sig) && sig.length > 0) {
                              hfBody.signals = sig;
                            } else {
                              const opps = card.chartData?.opportunities || [];
                              const risks = card.chartData?.risks || [];
                              hfBody.signals = [
                                ...opps.map(o => ({ type: 'positive', text: o.title ? `${o.title} — ${o.detail || ''}` : (o.detail || '') })),
                                ...risks.map(r => ({ type: 'negative', text: r.title ? `${r.title} — ${r.detail || ''}` : (r.detail || '') })),
                              ];
                            }
                            // 태그
                            hfBody.tags = card.chartData?.tags || [];
                          }
                          // Card13(상권경쟁)도 별도 키 추가
                          if (i === 12) {
                            const bd = card.bodyData || {};
                            // 다른 카드에서 데이터 보강 (경쟁 카드 자체에는 cafeSales/cafeCount 없음)
                            const c1bd = cards[0]?.bodyData || {};   // 상권 분석
                            const c5bd = cards[5]?.bodyData || {};   // 매출 분석
                            const c2bd = cards[2]?.bodyData || {};   // 상권 변화
                            // 5축 점수 (NaN/undefined 안전 변환)
                            const _sMarket = Number(bd.scoreMarket) || 0;
                            const _sCompete = Number(bd.scoreCompete) || 0;
                            const _sChange = Number(bd.scoreChange) || 0;
                            const _sSurvival = Number(bd.scoreSurvival) || 0;
                            const _sCost = Number(bd.scoreCost) || 0;
                            // [2026-05-19 버그 수정] dataMapper의 bd.score가 NaN/누락 시 KPI 0 표시 → 5축 합산 폴백
                            // 5축 합산은 항상 종합 점수와 일치해야 함
                            const _sumAxes = _sMarket + _sCompete + _sChange + _sSurvival + _sCost;
                            const _bdScore = Number(bd.score);
                            hfBody.totalScore = (isFinite(_bdScore) && _bdScore > 0) ? _bdScore : _sumAxes;
                            hfBody.scoreMarket = _sMarket;
                            hfBody.scoreCompete = _sCompete;
                            hfBody.scoreChange = _sChange;
                            hfBody.scoreSurvival = _sSurvival;
                            hfBody.scoreCost = _sCost;
                            // [2026-05-18] 정답지: 나머지 카드의 3년 생존율 = 카드 03 survivalRate3y와 동일해야 함
                            // 카드 13 자체값(bd.survival3yr)이 다르게 들어오는 경우 카드 03 값을 우선
                            hfBody.survival3y = c2bd.survivalRate3y || bd.survival3yr || 0;
                            hfBody.cafeSales = bd.cafeSales || c5bd.monthly || 0;
                            hfBody.guAvg = bd.guAvg || c5bd.guAvg || 0;
                            hfBody.cafeCount = bd.cafeCount || bd.totalCafes || c1bd.cafes || 0;
                            // [2026-05-19] 시장 변화 축 폴백용: openCount/closeCount 주입
                            hfBody.openCount = Number(c2bd.openCount) || Number(c1bd.newOpen) || 0;
                            hfBody.closeCount = Number(c2bd.closeCount) || Number(c1bd['폐업 매장']) || 0;
                            hfBody.franchiseCount = bd.franchiseCount || c1bd.franchise || 0;
                            hfBody.individualCount = bd.indieCount || bd.independentCount || c1bd.individual || 0;
                            hfBody.avgRent = bd.avgRent || (kosisBoxData?.integratedRent?.value || 0);
                            hfBody.premiumCost = bd.premiumCost || 0;
                            hfBody.weatherLabel = bd.externalIndicators?.weatherLabel || '';
                            hfBody.weatherScore = bd.externalIndicators?.weatherScore || 0;
                            hfBody.externalIndicators = bd.externalIndicators || null;
                            // [정답지] 카드 12 dataMapper에는 risingMenus 배열로 들어옴.
                            // 카드 13 시안은 단일 risingMenu 객체 기대 → TOP 1 사용
                            // [2026-05-18] cards[2]=card12 '상권 변화 추이'에 popularMenus/risingMenus 있음
                            const c12bdRising = cards[2]?.bodyData || {};
                            if (bd.risingMenu) {
                              hfBody.risingMenu = bd.risingMenu;
                            } else if (Array.isArray(bd.risingMenus) && bd.risingMenus.length > 0) {
                              hfBody.risingMenu = bd.risingMenus[0];
                            } else if (Array.isArray(c12bdRising.risingMenus) && c12bdRising.risingMenus.length > 0) {
                              hfBody.risingMenu = c12bdRising.risingMenus[0];
                            } else {
                              hfBody.risingMenu = null;
                            }
                            // [정답지] popularMenuList → TOP 1 (시장 변화 축 폴백 텍스트용)
                            // 형태: [{name, salesRate, avgPrice, ...}]
                            const _popList = Array.isArray(bd.popularMenus) && bd.popularMenus.length > 0
                              ? bd.popularMenus
                              : (Array.isArray(c12bdRising.popularMenus) ? c12bdRising.popularMenus : []);
                            if (_popList.length > 0) {
                              hfBody.popularMenuTop = _popList[0];
                              hfBody.popularMenuCount = _popList.length;
                            }
                          }
                          // Card09(카페 기회)도 별도 키
                          if (i === 8) {
                            const bd = card.bodyData || {};
                            // [2026-05-18] 신규/폐업 폴백: cards[2]=card12 '상권 변화 추이'에 openCount/closeCount 있음
                            const c12bd = cards[2]?.bodyData || {};
                            const c1bd = cards[0]?.bodyData || {};
                            const c11bd = cards[12]?.bodyData || {};   // 상권 경쟁 (recentOpen/recentClose)
                            hfBody.vacancy = kosisBoxData?.vacancy?.value || 0;
                            hfBody.newOpen = Number(bd.recentOpen) || Number(bd.openCount)
                              || Number(c12bd.openCount) || Number(c11bd.recentOpen)
                              || Number(c1bd.newOpen) || 0;
                            hfBody.closed = Number(bd.recentClose) || Number(bd.closeCount)
                              || Number(c12bd.closeCount) || Number(c11bd.recentClose)
                              || Number(c1bd['폐업 매장']) || 0;
                            hfBody.cafeMonthly = (cards[5]?.bodyData?.monthly) || 0;
                            hfBody.guAvg = (cards[5]?.bodyData?.guAvg) || 0;
                            // [2026-05-18] individualPct 폴백: card8.bodyData에 없으면 card1(cafes/individual)에서 계산
                            hfBody.individualPct = (() => {
                              if (bd.totalCafes > 0) return Math.round(((bd.independentCount || 0) / bd.totalCafes) * 100);
                              const _c1Total = Number(c1bd.cafes) || 0;
                              const _c1Indi = Number(c1bd.individual) || 0;
                              if (_c1Total > 0 && _c1Indi >= 0) return Math.round((_c1Indi / _c1Total) * 100);
                              return 0;
                            })();
                            hfBody.survival3y = (cards[2]?.bodyData?.survivalRate3y) || 0;
                          }
                          // [2026-05-19] Card 5 (개인 카페, i=4): avgMonthlySales/franchise 가격 폴백
                          if (i === 4) {
                            const _bd = card.bodyData || {};
                            const _c5bd = cards[5]?.bodyData || {};
                            if (!hfBody.bodyData) hfBody.bodyData = { ..._bd };
                            if (!Number(hfBody.bodyData.avgMonthlySales)) {
                              const _m = Number(_c5bd.monthly) || 0;
                              if (_m > 0) hfBody.bodyData.avgMonthlySales = _m;
                            }
                            if (!Number(hfBody.bodyData.franchiseMinPrice)) {
                              hfBody.bodyData.franchiseMinPrice = 2500;
                            }
                            if (!Number(hfBody.bodyData.franchiseMaxPrice)) {
                              hfBody.bodyData.franchiseMaxPrice = 4700;
                            }
                          }
                          // Card05(매출)에 권역 sigungu 전달용
                          if (i === 5) {
                            const c1 = cards[0]?.bodyData || {};
                            hfBody.bodyData = { ...(card.bodyData || {}), totalCafes: c1.cafes || 0 };
                          }

                          if (i === 0) {
                            const bd = card.bodyData || {};
                            hfBody.cafeCount = bd.cafes || 0;
                            hfBody.franchise = bd.franchise || 0;
                            hfBody.individual = bd.individual || 0;
                            hfBody.bakery = bd.bakery || 0;
                            hfBody.newOpen = bd.newOpen || 0;
                            hfBody.closed = bd['폐업 매장'] || 0;
                            // [unit-safe] integratedRent unit이 '만원/평'이면 그대로, '원/평'이면 /10000
                            {
                              const _ir = kosisBoxData?.integratedRent;
                              hfBody.rentPerPyeong = _ir?.value
                                ? (typeof _ir.unit === 'string' && _ir.unit.indexOf('만원') >= 0
                                    ? Math.round(_ir.value)
                                    : Math.round(_ir.value / 10000))
                                : (kosisBoxData?.marketRent?.value ? Math.round(kosisBoxData.marketRent.value / 10000) : 0);
                            }
                            hfBody.vacancyRate = kosisBoxData?.vacancy?.value || 0;
                            hfBody.priceChange = kosisBoxData?.priceChange?.value || 0;
                            hfBody.rentSeries = kosisBoxData?.marketRentSeries?.series || null;
                            hfBody.vacancySeries = kosisBoxData?.vacancySeries?.series || null;
                            hfBody.priceSeries = kosisBoxData?.priceIndexSeries?.series || null;
                          }

                          // Card02 (고객 분석)에 chartData에서 ageGroups, gender 폴백
                          // weekdayPct/weekendPct/peakHour는 card6(유동인구) bodyData에 있음 - 그쪽에서 폴백
                          if (i === 1) {
                            const cd = card.chartData || {};
                            const bd = card.bodyData || {};
                            const c6bd = cards[6]?.bodyData || {};   // 유동인구
                            hfBody.topAge = cd.topAge || bd.topAge || '';
                            hfBody.maleRatio = bd.male ?? cd.male ?? 0;
                            hfBody.femaleRatio = bd.female ?? cd.female ?? 0;
                            hfBody.weekdayPct = bd.weekdayPct ?? cd.weekdayPct ?? c6bd.weekdayPct ?? 0;
                            hfBody.weekendPct = bd.weekendPct ?? cd.weekendPct ?? c6bd.weekendPct ?? 0;
                            // [정답지 보강] 비즈맵 hourlySalesConcentration → bizmapPeakHour 폴백까지 포함
                            // [2026-05-18] '-' 문자열은 빈 값으로 처리하여 다음 폴백으로 넘어가도록 함
                            const _pickPeak = (...vals) => {
                              for (const v of vals) {
                                if (v == null) continue;
                                const s = String(v).trim();
                                if (!s || s === '-' || s === '–') continue;
                                return s;
                              }
                              return '-';
                            };
                            hfBody.peakHour = _pickPeak(
                              bd.peakTime,
                              bd.peakHour,
                              cd.peakHour,
                              c6bd.peakHour,
                              c6bd.popPeakHour,
                              c6bd.bizmapPeakHour
                            );
                          }

                          // Card05 (매출 분석, i=5): 객단가(bizmapAvgUnitPrice/bizmapAvgPayment) 명시 보강
                          if (i === 5) {
                            const bd = card.bodyData || {};
                            // 정답지: 비즈맵 usageAndPaymentTrendList → bizmapAvgPayment (원)
                            // dataMapper에서 bizmapAvgUnitPrice 또는 bizmapAvgPayment로 들어옴
                            if (!hfBody.bodyData) hfBody.bodyData = { ...bd };
                            if (!hfBody.bodyData.bizmapAvgUnitPrice && bd.bizmapAvgPayment) {
                              hfBody.bodyData.bizmapAvgUnitPrice = `${Number(bd.bizmapAvgPayment).toLocaleString()}원`;
                            }
                            // 객단가 누락 시 dataMapper의 bizmapUsageCount/매출에서 역산은 의미 다르므로 안 함
                          }

                          // Card07 (유동인구, i=6): peakHour에 비즈맵 hourlySalesConcentration 폴백
                          if (i === 6) {
                            const bd = card.bodyData || {};
                            // 정답지: dataMapper에 bizmapPeakHour/bizmapPeakHourPct 이미 있음
                            if (!hfBody.bodyData) hfBody.bodyData = { ...bd };
                            if (!hfBody.bodyData.peakHour || hfBody.bodyData.peakHour === '-') {
                              hfBody.bodyData.peakHour = bd.popPeakHour || bd.bizmapPeakHour || '-';
                            }
                            if (!hfBody.bodyData.popPeakHour && bd.bizmapPeakHour) {
                              hfBody.bodyData.popPeakHour = bd.bizmapPeakHour;
                              hfBody.bodyData.popPeakHourPct = bd.bizmapPeakHourPct || 0;
                            }
                          }

                          // [2026-05-19] Card03 (상권 변화 추이, i=2): 인기/급상승 메뉴 빈 배열일 때
                          // SNS searchIntents를 폴백 키워드로 노출 + survivalInsight 자동 생성
                          if (i === 2) {
                            const _bd = card.bodyData || {};
                            const _c10bd = cards[10]?.bodyData || {};
                            if (!hfBody.bodyData) hfBody.bodyData = { ..._bd };
                            if (Array.isArray(_c10bd.searchIntents) && _c10bd.searchIntents.length > 0) {
                              hfBody.searchIntents = _c10bd.searchIntents;
                            }
                            if (!hfBody.bodyData.survivalInsight) {
                              const _s1 = Number(_bd.survivalRate1y) || 65;
                              const _s3 = Number(_bd.survivalRate3y) || 39;
                              const _s5 = Number(_bd.survivalRate5y) || 28;
                              const _band = _s3 >= 60 ? '상위' : _s3 >= 40 ? '평균' : '주의';
                              hfBody.bodyData.survivalInsight =
                                `1년 ${_s1}% · 3년 ${_s3}% · 5년 ${_s5}% — ${_band} 권역.`;
                            }
                            // avgOperatingYears 0이면 표시 제거 (메모리 규칙: 빈 값 노출 금지)
                            if (!Number(_bd.avgOperatingYears)) {
                              hfBody.bodyData.avgOperatingYears = undefined;
                            }
                          }

                          // Card08 (임대/창업, i=7): kosisBoxData에 premium/yieldRate/netIncome 보강
                          if (i === 7) {
                            const bd = card.bodyData || {};
                            const cd2 = card.chartData || {};
                            // [2026-05-18] 이익률 폴백: KOSIS 외식업체경영실태조사 없으면
                            // 비즈맵 costAnalysisList.profitRt (cards[8]=card8 '카페 기회' bodyData에 보관됨)
                            const c8bd = cards[8]?.bodyData || {};
                            const _bizmapProfit = Number(c8bd.bizmapOpIncomePct) || 0;
                            const _kosisCafe = cd2.kosisCafe || null;
                            if (_kosisCafe && (!_kosisCafe.profitMargin || _kosisCafe.profitMargin === 0) && _bizmapProfit > 0) {
                              hfBody.chartData = {
                                ...(hfBody.chartData || {}),
                                kosisCafe: { ..._kosisCafe, profitMargin: _bizmapProfit },
                              };
                            } else if (!_kosisCafe && _bizmapProfit > 0) {
                              // KOSIS 자체가 없을 때도 최소 profitMargin은 노출
                              hfBody.chartData = {
                                ...(hfBody.chartData || {}),
                                kosisCafe: { profitMargin: _bizmapProfit },
                              };
                            }

                            // [2026-05-18] Card08 권리금 매핑 정상화
                            // dataMapper card7.chartData.premium = {sidoAvg(만원), sidoKey, nationalAvg, ...}
                            // Card08 component expects {value(원), region}
                            // → 시도 평균 우선, 없으면 전국 평균 폴백
                            if (cd2.premium) {
                              const _pAvgManwon = Number(cd2.premium.sidoAvg) || Number(cd2.premium.nationalAvg) || 0;
                              const _pRegion = cd2.premium.sidoKey || (cd2.premium.sidoAvg ? '' : '전국');
                              if (_pAvgManwon > 0) {
                                hfBody.chartData = {
                                  ...(hfBody.chartData || {}),
                                  premium: { ...cd2.premium, value: _pAvgManwon * 10000, region: _pRegion },
                                };
                              }
                            }
                            // 폴백: 한국부동산원 KOSIS 박스 데이터에도 같은 premium 객체 노출 (모달 등 다른 곳용)
                            if (hfBody.chartData?.premium?.value && (!hfBody.kosisBoxData || !hfBody.kosisBoxData.premium)) {
                              hfBody.kosisBoxData = { ...(hfBody.kosisBoxData || {}), premium: hfBody.chartData.premium };
                            }
                            // bodyData.premiumCost (만원 단위로 가정) → 폴백
                            if (!hfBody.chartData?.premium?.value && bd.premiumCost) {
                              const _pc = Number(bd.premiumCost) || 0;
                              if (_pc > 0) {
                                hfBody.chartData = {
                                  ...(hfBody.chartData || {}),
                                  premium: { value: _pc * 10000, region: '' },
                                };
                              }
                            }
                          }

                          // Card11 (SNS, i=10): blogMentions 보강 - naverBlog.total + naverBlogMenus 폴백
                          if (i === 10) {
                            const bd = card.bodyData || {};
                            if (!hfBody.bodyData) hfBody.bodyData = { ...bd };
                            const blogCount = bd.blogMentions
                              || collectedData?.apis?.naverBlog?.total
                              || collectedData?.apis?.naverBlogMenus?.data?.totalItems
                              || 0;
                            if (!hfBody.bodyData.blogMentions && blogCount > 0) {
                              hfBody.bodyData.blogMentions = blogCount;
                            }
                          }

                          const HFC = [HfCard01, HfCard02, HfCard03, HfCard04, HfCard06, HfCard05, HfCard07, HfCard08, HfCard09, HfCard10, HfCard11, HfCard12, HfCard13, HfCard14][i];
                          return (
                            <div className="bc-app theme-dark" style={{ background: 'transparent' }}>
                              <HFC body={hfBody} onOpenDirector={() => { setDirectorTab('market'); setShowDirectorPopup(true); }} />
                            </div>
                          );
                        })()}
                        {false && (
                        <CardTemplate
                          index={i}
                          title={card.title}
                          subtitle={card.subtitle}
                          date={card.date}
                          dataSourceStatus={card.dataSourceStatus || 'live'}
                          bruSummary={card.bruSummary || null}
                          aiSummary={card.aiSummary}
                          chartContent={
                            card.metaInfo === 'AI종합' ? (
                              /* [v14] AI 종합 분석: 차트 영역을 사용하지 않음 (ChartInsightDashboard가 bodyContent로 전체 렌더) */
                              null
                            ) : card.metaInfo === '창업지원' ? (
                              /* 창업 지원 프로그램: 차트 없음 (bodyContent에서 전체 렌더) */
                              null
                            ) : card.metaInfo === '개인카페' ? (
                              <div>
                                {card.chartData !== undefined ? getChartForCard(card) : (CHART_MAP[card.chartType] || null)}
                                {/* 3개 평균가격 - collectedData.cafeAvgPrices 우선, 없으면 enrichedCafes+nicebizmap 폴백 */}
                                {(() => {
                                  const preCalc = collectedData?.cafeAvgPrices;
                                  let avgA, estA, avgM, estM, avgD, estD;
                                  if (preCalc && preCalc.americano) {
                                    avgA = preCalc.americano; estA = !!preCalc.americanoEstimated;
                                    avgM = preCalc.menu || 5500; estM = !!preCalc.menuEstimated;
                                    avgD = preCalc.dessert || 6200; estD = !!preCalc.dessertEstimated;
                                  } else {
                                    const enriched = collectedData?.enrichedCafes;
                                    const cafes = enriched?.cafes || [];
                                    const nbmAvgPrice = collectedData?.nicebizmapStats?.avgPrice || 0;
                                    // 아메리카노: enrichedCafes -> nicebizmap 결제단가 75% -> 폴백
                                    avgA = enriched?.avgAmericano || 0;
                                    if (!avgA && cafes.length > 0) { const ap = cafes.map(c => c.americano).filter(p => p > 0); avgA = ap.length > 0 ? Math.round(ap.reduce((a,b)=>a+b,0)/ap.length) : 0; }
                                    if (!avgA && nbmAvgPrice > 0) avgA = Math.round(nbmAvgPrice * 0.75);
                                    estA = !avgA; if (!avgA) avgA = 4800;
                                    // 메뉴 평균: enrichedCafes -> nicebizmap 결제단가 -> 폴백
                                    avgM = 0; const mp = []; cafes.forEach(c => { (c.topMenus||[]).forEach(m => { if (m.price > 0) mp.push(m.price); }); }); avgM = mp.length > 0 ? Math.round(mp.reduce((a,b)=>a+b,0)/mp.length) : 0; if (!avgM && nbmAvgPrice > 0) avgM = nbmAvgPrice; estM = !avgM; if (!avgM) avgM = 5500;
                                    // 디저트: enrichedCafes -> nicebizmap 결제단가 115% -> 폴백
                                    const dkw = ['케이크','쿠키','마카롱','크로플','와플','스콘','브라우니','타르트','머핀','파이','빵','크로와상','디저트','베이글']; const dp = []; cafes.forEach(c => { (c.topMenus||[]).forEach(m => { if (m.price > 0 && dkw.some(k => (m.name||'').includes(k))) dp.push(m.price); }); }); avgD = dp.length > 0 ? Math.round(dp.reduce((a,b)=>a+b,0)/dp.length) : 0; if (!avgD && nbmAvgPrice > 0) avgD = Math.round(nbmAvgPrice * 1.15); estD = !avgD; if (!avgD) avgD = 6200;
                                  }
                                  return (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                      <div style={{ flex: 1, background: 'rgba(30,58,138,0.07)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                                        <p style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, margin: 0 }}>아메리카노 평균</p>
                                        <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.white, margin: '4px 0 0' }}>{avgA.toLocaleString()}<span style={{ fontSize: 11, color: COLORS.textMuted }}>원</span></p>
                                        {estA && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>(추정)</p>}
                                      </div>
                                      <div style={{ flex: 1, background: 'rgba(49,130,246,0.07)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                                        <p style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, margin: 0 }}>메뉴 평균</p>
                                        <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.white, margin: '4px 0 0' }}>{avgM.toLocaleString()}<span style={{ fontSize: 11, color: COLORS.textMuted }}>원</span></p>
                                        {estM && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>(추정)</p>}
                                      </div>
                                      <div style={{ flex: 1, background: 'rgba(245,158,11,0.07)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                                        <p style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, margin: 0 }}>디저트 평균</p>
                                        <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.white, margin: '4px 0 0' }}>{avgD.toLocaleString()}<span style={{ fontSize: 11, color: COLORS.textMuted }}>원</span></p>
                                        {estD && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>(추정)</p>}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              card.chartData !== undefined ? getChartForCard(card) : (CHART_MAP[card.chartType] || null)
                            )
                          }
                          bodyContent={
                            card.metaInfo === 'AI종합' ? (
                              /* [v14] AI 종합 분석: 시각 중심 Dashboard를 body 전체로 렌더 */
                              <ChartInsightDashboard data={card.chartData} />
                            ) : card.metaInfo === '경쟁' ? (
                              <div>
                                <DataTable data={card.bodyData} chartType={card.chartType} />
                                {card.scoreDetail?.templateText && (
                                  <div style={{
                                    marginTop: 12,
                                    padding: '10px 14px',
                                    borderLeft: `3px solid ${card.scoreDetail.tierColor || '#FBBF24'}`,
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 6,
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                    color: COLORS.textSecondary,
                                  }}>
                                    {card.scoreDetail.templateText}
                                  </div>
                                )}
                              </div>
                            ) : (card.metaInfo === '카페 기회' || card.metaInfo === '기회/리스크') ? (
                              /* [v17] 카드 8: 기회/리스크 + 비즈맵 동 평균 비용 구조 */
                              <div>
                                <DataTable data={card.bodyData} chartType={card.chartType} />
                                {(() => {
                                  const bd = card.bodyData || {};
                                  const items = [
                                    { label: '영업이익률', value: bd.bizmapOpIncomePct, color: '#1E3A8A' },
                                    { label: '식재료비율', value: bd.bizmapMaterialPct, color: '#3182F6' },
                                    { label: '인건비율', value: bd.bizmapLaborPct, color: '#F59E0B' },
                                    { label: '임차료비율', value: bd.bizmapRentPct, color: '#8B5CF6' },
                                    { label: '기타비율', value: bd.bizmapEtcPct, color: '#94A3B8' },
                                  ].filter(it => it.value != null && it.value > 0);
                                  if (items.length === 0) return null;
                                  return (
                                    <div style={{ marginTop: 16 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.white, marginBottom: 10 }}>동 평균 비용 구조</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {items.map((it, ri) => (
                                          <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <span style={{ fontSize: 13, color: COLORS.textMuted }}>{it.label}</span>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: it.color }}>{it.value}%</span>
                                          </div>
                                        ))}
                                      </div>
                                      {bd.bizmapCostSummary && (
                                        <div style={{
                                          marginTop: 10,
                                          padding: '8px 12px',
                                          borderLeft: '2px solid rgba(255,255,255,0.15)',
                                          background: 'rgba(255,255,255,0.03)',
                                          borderRadius: 6,
                                          fontSize: 12,
                                          lineHeight: 1.6,
                                          color: COLORS.textSecondary,
                                        }}>
                                          {bd.bizmapCostSummary}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : card.metaInfo === '창업지원' ? (
                              /* 창업 지원 프로그램 카드: 통계(지역/전체) */
                              <div>
                                {/* 통계 박스 */}
                                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                  {card.bodyData?.region && (
                                    <div style={{ flex: 1, background: 'rgba(49,130,246,0.08)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                                      <p style={{ fontSize: 11, color: COLORS.textMuted, margin: '0 0 4px' }}>{card.bodyData.region} 지역</p>
                                      <p style={{ fontSize: 22, fontWeight: 700, color: '#3182F6', margin: 0 }}>{card.bodyData?.regionCount || 0}<span style={{ fontSize: 12, color: COLORS.textMuted }}>건</span></p>
                                    </div>
                                  )}
                                  <div style={{ flex: 1, background: 'rgba(30,58,138,0.08)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                                    <p style={{ fontSize: 11, color: COLORS.textMuted, margin: '0 0 4px' }}>전체</p>
                                    <p style={{ fontSize: 22, fontWeight: 700, color: '#1E3A8A', margin: 0 }}>{card.bodyData?.totalCount || 0}<span style={{ fontSize: 12, color: COLORS.textMuted }}>건</span></p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <DataTable data={card.bodyData} chartType={card.chartType} />
                            )
                          }
                        />
                        )}
                        {/* Card 1 "지도로 보기" button is rendered inside Card01MarketReport */}
                        {/* "AI 디렉터" button after AI종합 Card */}
                        {card.metaInfo === 'AI종합' && (
                          <button
                            onClick={() => { setDirectorTab('market'); setShowDirectorPopup(true); }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              width: '100%', fontSize: 14, fontWeight: 600, color: '#FFFFFF',
                              background: 'transparent', border: '1px solid #FFFFFF', borderRadius: 12,
                              padding: '12px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
                              transition: 'background 0.2s', fontFamily: 'Pretendard, sans-serif',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L10 5.5L15 6.2L11.5 9.5L12.4 14.5L8 12L3.6 14.5L4.5 9.5L1 6.2L6 5.5L8 1Z" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" fill="none"/></svg>
                            AI 디렉터
                          </button>
                        )}
                        {/* "정보 보기" button after 창업지원 Card */}
                        {card.metaInfo === '창업지원' && (card.allPrograms?.length > 0 || card.regionPrograms?.length > 0) && (
                          <button
                            onClick={() => {
                              setStartupPopupTab(card.bodyData?.region ? 'region' : 'all');
                              setShowStartupPopup(true);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              width: '100%', fontSize: 14, fontWeight: 600, color: '#FFFFFF',
                              background: 'transparent', border: '1px solid #FFFFFF', borderRadius: 12,
                              padding: '12px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
                              transition: 'background 0.2s', fontFamily: 'Pretendard, sans-serif',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2.5A1.5 1.5 0 014.5 1h7A1.5 1.5 0 0113 2.5v11a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 13.5v-11zM5.5 4h5M5.5 6.5h5M5.5 9h3" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
                            정보 보기
                          </button>
                        )}
                        </div>
                      </section>
                      );
                    })}
                    {/* 데이터 출처 섹션/모달 제거 (2026-05-02 의뢰인 요청) */}
                  </div>

                  {/* Bottom spacer */}
                  <div style={{ height: 40 }} />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

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
        {/* iframe - always render to prefetch, visibility controlled by CSS */}
        <div style={{ flex: 1, overflow: 'hidden', visibility: showHomepage ? 'visible' : 'hidden' }}>
          <iframe
            src={homepageUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="빈크래프트 홈페이지"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </div>

      {/* ── Responsive CSS ── */}
      <style>{`
        /* [2026-05-18] 결과 화면은 시안 iframe이 사이드바/탑바 통째로 그리므로 영업관리 좌측 패널/토글 화살표 완전 제거 */
        .unified-layout-root[data-results="true"] .unified-left-panel {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          flex: 0 0 0 !important;
          border-right: none !important;
          overflow: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
        /* PC large (>=1280px) — 결과 화면에서는 위 0px 룰을 따른다 (override 제거) */
        @media (min-width: 1280px) {
          .unified-layout-root[data-results="true"] .unified-left-panel {
            width: 0 !important;
            min-width: 0 !important;
            flex: 0 0 0 !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1279px) {
          .unified-layout-root[data-results="true"] .unified-left-panel {
            width: 0 !important;
            min-width: 0 !important;
            flex: 0 0 0 !important;
          }
        }
        /* [2026-05-18] Mobile (<=767px) 결과 화면 — 좌측 영업관리 사이드바 완전 숨김
           시안 iframe만 화면 100% 차지 */
        @media (max-width: 767px) {
          .unified-layout-root[data-results="true"] {
            flex-direction: row !important;
          }
          .unified-layout-root[data-results="true"] .unified-left-panel {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            min-width: 0 !important;
            flex: 0 0 0 !important;
            border: none !important;
            visibility: hidden !important;
          }
          .unified-layout-root[data-results="true"] .unified-right-panel {
            flex: 1 1 100% !important;
            width: 100% !important;
            height: 100% !important;
          }
        }
        /* Search-only phase (no results yet) — 모바일에서는 검색/지도 좌측 패널이 풀폭,
           우측 카드 패널은 숨김 (검색 단계에서는 카드가 없으므로) */
        @media (max-width: 767px) {
          .unified-layout-root:not([data-results="true"]) {
            flex-direction: column !important;
          }
          .unified-layout-root:not([data-results="true"]) .unified-left-panel {
            flex: 1 1 100% !important;
            width: 100% !important;
            min-width: 0 !important;
            height: 100% !important;
          }
          .unified-layout-root:not([data-results="true"]) .unified-right-panel {
            display: none !important;
            width: 0 !important;
            min-width: 0 !important;
            flex: 0 0 0 !important;
            visibility: hidden !important;
          }
        }
        /* [2026-05-18] 결과 화면(resultsReady) — 좌측 영업관리 사이드바 완전 제거,
           시안 iframe wrapper가 viewport 100% 차지 */
        .unified-layout-root[data-results="true"] .unified-left-panel {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          flex: 0 0 0 !important;
          opacity: 0 !important;
          pointer-events: none !important;
          border-right: none !important;
          overflow: hidden !important;
          visibility: hidden !important;
        }
        .unified-layout-root[data-results="true"] .unified-right-panel {
          flex: 1 1 100% !important;
          width: 100% !important;
          min-width: 100% !important;
          height: 100% !important;
          border-left: none !important;
        }
        .unified-layout-root[data-results="true"] .unified-right-panel iframe {
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          display: block !important;
        }
        /* 호환성 유지: 옛 sidebar-collapsed 속성도 동일 처리 */
        .unified-layout-root[data-sidebar-collapsed="true"][data-results="true"] .unified-left-panel {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          flex: 0 0 0 !important;
          opacity: 0 !important;
          pointer-events: none !important;
          border-right: none !important;
          overflow: hidden !important;
          visibility: hidden !important;
        }
        /* 카드 섹션은 자연 높이로 (스크롤 자유로) */
        .beancraft-card-section {
          min-height: 0 !important;
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
        .unified-card-nav::-webkit-scrollbar {
          width: 4px;
        }
        .unified-card-nav::-webkit-scrollbar-track { background: transparent; }
        .unified-card-nav::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
        }
        /* Inner card scrolling (when body overflows 100vh) */
        .beancraft-card::-webkit-scrollbar {
          width: 4px;
        }
        .beancraft-card::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
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
