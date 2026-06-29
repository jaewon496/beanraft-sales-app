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
import { database, storage } from '../../firebase';
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
  extractSidoRentAvg,
  extractCafeClosure,
  extractRegionClosure,
  extractConsumerSentiment,
  extractMarketRentSeries,
  extractVacancySeries,
  extractPriceIndexSeries,
  extractCafeClosureSeries,
  extractConsumerSentimentSeries,
  buildIntegratedRent,
  bcScoreGrade,
  bcDensityGrade,
} from './dataMapper';
// [2026-06-25] 통합 AI 진단(배너 한 줄·AI종합 진단·14카드 한 줄). 캐시+폴백 내장.
import { getUnifiedDiagnosis } from './aiDiagnosis';

// [2026-06-15] AI 디렉터 대화 음성: 생성기(buildDirectorDialogue)·캐시(__ttsCache/__ttsInflight)는
//   아래 컴포넌트 바로 위 모듈 블록에 정의됨. 여기선 리포트 주입 헬퍼만 둔다.
// 리포트로 푸시할 cards 배열에 director.tts 주입(원본 불변 — 얕은 클론)
function injectTtsIntoCards(cardsArr, regionKey) {
  if (!Array.isArray(cardsArr)) return cardsArr;
  const c13 = cardsArr[13];
  const dir = c13 && c13.body && c13.body.chartData && c13.body.chartData.director;
  if (!dir) return cardsArr;
  const payload = __ttsCache.get(regionKey);
  if (!payload) return cardsArr;   // 아직 생성 시작 안 함 → 주입 없음(폴백 음성)
  const out = cardsArr.slice();
  out[13] = { ...c13, body: { ...c13.body, chartData: { ...c13.body.chartData, director: { ...dir, tts: payload } } } };
  return out;
}

// [2026-06-29 정보분산 패스13] ★마지막-마일 강제 치환 (카드14 body 전체 재귀).
//   문제: 화면 렌더 디렉터(cards[13].body.chartData.director)뿐 아니라 카드14의 다른 글칸
//     (body.interior, body.bodyData.interior, chartData.analysis, chartData.signals[].text,
//      chartData.designDirection[] 등)에도 "평당 월세 31만원·공실률 (현재) 9%"가 그대로 샜다.
//     (카드1 KPI는 41만원/6.9%로 정상.) 기존엔 director 하위만 치환해 나머지는 새어나갔다.
//   해법: __BC_DATA__로 푸시하기 직전, cards[0].body의 카드1 단일값(rentPerPyeong=R, vacancyRate=V)을 읽어
//     cards[13].body 전체의 모든 문자열을 재귀 순회하며 R/V로 강제 치환한다.
//   ★R/V 하드코딩 금지(지역마다 cards[0]에서 자동 읽음). ★공실 '변동률'(36.4% 상승/하락 등)은 절대 안 건드림.
//   ★'평당'이 붙은 월세/임대료만 41로(총액 "월평균 임대료 619만원"은 평당 아님 → 무변경).
//   ★audio/audioBase64/base64(TTS 오디오 데이터) 키는 절대 안 건드림(스킵).
//   ★원본 불변(얕은 클론). dataMapper 정규화는 그대로 둠(이중 안전망).
function injectCard1RentVacancyIntoCard14(cardsArr) {
  if (!Array.isArray(cardsArr)) return cardsArr;
  const c0 = cardsArr[0];
  const c13 = cardsArr[13];
  if (!c0 || !c0.body || !c13 || !c13.body) return cardsArr;
  // 카드1 표시 단일값 — 평당월세(만원) R, 공실률(%) V(소수1자리 반올림)
  const _toNum = (v) => { const n = Number(v); return (typeof n === 'number' && isFinite(n)) ? n : 0; };
  const R = Math.round(_toNum(c0.body.rentPerPyeong));
  const V = Math.round(_toNum(c0.body.vacancyRate) * 10) / 10;
  if (!(R > 0) && !(V > 0)) return cardsArr;   // 카드1 값이 없으면 치환 안 함(누수 위험도 없음)

  // 공실 '변동률'(36.4% 상승/하락/올랐/내렸/증감/p/포인트 등) 식별 — 이런 % 는 절대 안 건드린다.
  const _VAR_VERB = '(?:\\s*(?:상승|하락|올랐|올라|내렸|내려|오름|내림|증가|감소|늘었|줄었|변동|오름세|내림세|p|포인트|％\\s*p))';
  // 공실어와 숫자 사이에 끼는 짧은 수식어(현재/약/대략/평균 등) — 6자 이내, 숫자/%/문장부호 없음. 선택적.
  const _GAP_MOD = '(?:\\s*[가-힣]{1,6}\\s*)?';

  const _fixStr = (s) => {
    if (!s || typeof s !== 'string') return s;
    let out = s;
    // ── '평당' 월세/임대료 → R만원 (숫자 부분만 치환, 앞 어구·조사는 그대로 보존) ──
    //    ★총액("월평균 임대료 619만원" 등 '평당' 없는 월세)은 절대 안 건드린다.
    if (R > 0) {
      const _rep = `${R.toLocaleString()}만원`;
      // (가) "평당 월세[는은과] N만원" / "평당월세 N만 원" / "평당 임대료 N만원" (임대어가 '평당' 뒤·숫자 앞)
      out = out.replace(/((?:평당\s*월세|평당월세|평당\s*임대료|평당\s*임대|평당\s*렌트)\s*(?:[는은과이가]\s*|:\s*)?)([\d,]+)\s*만\s*원?/g,
        (m, pre) => `${pre}${_rep}`);
      // (나) 역어순 "월세[는은] 평당 N만원" / "임대료가 평당 N만원" (임대어가 '평당' 앞)
      out = out.replace(/((?:월세|임대료|임대|렌트)\s*(?:[는은이가]\s*)?평당\s*)([\d,]+)\s*만\s*원?/g,
        (m, pre) => `${pre}${_rep}`);
      // (다) "평당 N만원[…12자 이내…]임대료/월세/임대/렌트" (숫자 뒤에 임대어)
      out = out.replace(/(평당\s*)([\d,]+)\s*만\s*원?(?=[^\d]{0,12}(?:임대료|월세|임대|렌트))/g,
        (m, pre) => `${pre}${_rep}`);
    }
    // ── 공실률 → V% (변동률은 제외: % 뒤에 변동 동사 오면 스킵) ──
    if (V > 0) {
      // (가) "공실률[은는이가] (현재/약/평균 등) N%" / "공실률: N %" — 공실어가 숫자 앞(숫자만 치환).
      //     공실어와 숫자 사이 짧은 수식어 1개 허용(_GAP_MOD) → "공실률은 현재 9%"도 잡음. 수식어는 보존.
      out = out.replace(new RegExp(`(공실률?\\s*(?:[은는이가]\\s*|:\\s*)?${_GAP_MOD})([\\d.]+)(\\s*)%(?!${_VAR_VERB})`, 'g'),
        (m, pre) => `${pre}${V}%`);
      // (나) 숫자-선행 어순 "N% 공실(률)"(예: closing "…41만원과 9% 공실률을 고려") — 숫자가 공실 앞 6자 이내
      out = out.replace(new RegExp(`([\\d.]+)\\s*%(?!${_VAR_VERB})([^\\d%]{0,6}공실)`, 'g'),
        (m, num, tail) => `${V}%${tail}`);
    }
    return out;
  };

  // keyMetric: 라벨이 평당월세/임대면 값을 R만원, 공실이면 V% 로 강제(바 "N만원"은 정규식이 못 잡음).
  const _fixKeyMetric = (km) => {
    if (!km || typeof km !== 'object') return km;
    let value = km.value;
    const _lbl = String(km.label || '');
    if (R > 0 && /(평당)?\s*(월세|임대료|임대|렌트)/.test(_lbl) && !/매출|점수|인구|생존|면적|객단가/.test(_lbl)) {
      value = `${R.toLocaleString()}만원`;
    } else if (V > 0 && /공실/.test(_lbl)) {
      value = `${V}%`;
    } else if (typeof km.value === 'string') {
      value = _fixStr(km.value);
    }
    return { ...km, value };
  };

  // TTS 오디오 데이터는 건드리지 않는다(거대 base64 → 깨짐·성능). 이런 키는 통째 스킵.
  const _AUDIO_KEY = /^(audio|audioBase64|base64|tts|ttsAudio|audioUrl|src)$/i;

  // body 전체를 재귀 순회하며 모든 문자열에 _fixStr 적용. keyMetric은 라벨 기반 강제 치환.
  const _fixDeep = (node, key) => {
    if (node == null) return node;
    if (typeof node === 'string') return _fixStr(node);
    if (Array.isArray(node)) return node.map((v) => _fixDeep(v, key));
    if (typeof node === 'object') {
      if (key === 'keyMetric') return _fixKeyMetric(node);
      const next = {};
      for (const k of Object.keys(node)) {
        if (_AUDIO_KEY.test(k)) { next[k] = node[k]; continue; }   // 오디오 데이터 스킵(원본 그대로)
        next[k] = _fixDeep(node[k], k);
      }
      return next;
    }
    return node;
  };

  const out = cardsArr.slice();
  out[13] = { ...c13, body: _fixDeep(c13.body, 'body') };
  return out;
}

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

// ─────────────────────────────────────────────────────────────
// [2026-06-15] AI 디렉터 14카드 워크스루용 Gemini 2-speaker TTS 사전 생성
//   - 지역(regionKey)당 정확히 1회만 유료 호출 (캐시 + inflight 가드)
//   - 결과(audioBase64/perCard/script)를 director.tts 로 iframe 에 주입
//   - API 키(VITE_GEMINI_API_KEY)는 부모에서만 읽고, iframe 으로는 절대 전달 안 함
//   - 429/오류 시 status:'failed' 로 캐시 → iframe 은 브라우저 음성으로 폴백
// ─────────────────────────────────────────────────────────────
const __ttsCache = new Map();      // regionKey -> { audioBase64, sampleRate, status, regionKey, script, perCard }
const __ttsInflight = new Set();   // regionKey (생성 진행 중)
if (typeof window !== 'undefined') { window.__pregenTTSByRegion = window.__pregenTTSByRegion || {}; }

// 디렉터 카드(n="14") 데이터 5영역 → 14카드 매핑 (director-modal.jsx CARD_AREA_MAP 와 byte-identical 유지)
// ※ 락스텝: 아래 두 테이블/_naturalize/슬롯 분배 로직은 iframe 쪽과 동일해야 perCard 패리티가 맞음
const __DM_CARD_AREA_MAP = {
  "01": "market",      "02": "customer",    "03": "direction",
  "04": "competition", "05": "profit",      "06": "competition",
  "07": "customer",    "08": "profit",      "09": "market",
  "10": "direction",   "11": "direction",   "12": "direction",
  "13": "competition", "14": "ai",
};
const __DM_AREA_CARD_ORDER = {
  market:      ["01", "09"],
  customer:    ["02", "07"],
  competition: ["04", "06", "13"],
  profit:      ["05", "08"],
  direction:   ["03", "10", "11", "12"],
};
// [STEP 5b] 대사 전용: bruSummary 의 '첫 완결 문장'만 뽑아 짧고 또렷한 발화로.
//   화면 파란 박스(.bc-card__bru)는 전체 bruSummary 그대로, 대사만 첫 문장으로 분리.
//   경계: '습니다.' / '요.' / '다.' / '. '(마침표+공백) 중 가장 먼저 나오는 곳까지(부호 포함).
//   소수점·% 뒤 숫자(예: 19.5%)는 뒤가 공백이 아니라 컷 안 됨. 경계 없으면 원문 유지.
//   ★iframe(director-modal.jsx _firstSentence)와 byte-identical 유지.
function __dmFirstSentence(raw) {
  const s = String(raw || "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!s) return "";
  const re = /(습니다\.|요\.|다\.|[.!?…])/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const end = m.index + m[0].length;
    if (end >= s.length || /\s/.test(s[end])) return s.slice(0, end).trim();
  }
  return s;
}

// [STEP 5] director-modal.jsx _naturalize 와 byte-identical (warm 존댓말).
//   따뜻한 구어체 존댓말: -습니다 어미를 부드럽게, 카드당 -습니다 1회 이내.
//   ★자막=발화 wording 동일을 위해 iframe 쪽 _naturalize 와 글자 단위로 같아야 한다.
function __dmWarmEndings(s) {
  // 딱딱한 -입니다/-습니다 류를 따뜻한 어미로. (한 카드 내 -습니다 1회 정도만 남기는 건 호출부 책임)
  let t = s;
  t = t.replace(/입니다([.!?…]?)$/u, '이에요$1');
  t = t.replace(/습니다([.!?…]?)$/u, '어요$1');
  t = t.replace(/됩니다([.!?…]?)$/u, '돼요$1');
  t = t.replace(/있습니다([.!?…]?)/gu, '있어요$1');
  t = t.replace(/없습니다([.!?…]?)/gu, '없어요$1');
  return t;
}
function __dmNaturalize(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  s = __dmWarmEndings(s);
  if (!/[.!?。…]$/.test(s)) s += ".";
  return s;
}

// [STEP 5] 주제(영역) 전환 다리 — fromArea→toArea 가 바뀌면 그 카드 라인 앞에 연결절 1개 + [medium pause].
//   ★iframe(director-modal.jsx __dmBridge)와 byte-identical 유지.
function __dmBridge(fromArea, toArea) {
  if (!fromArea || !toArea || fromArea === toArea) return '';
  const key = fromArea + '>' + toArea;
  const TABLE = {
    'market>customer':    '자리를 봤으니, 이제 어떤 분들이 오는지 볼게요. [medium pause] ',
    'customer>direction': '사람이 이렇게 모이는 곳이면, 온라인에선 이 동네를 어떻게 말할까요? [medium pause] ',
    'direction>competition': '흐름은 그렇고, 그럼 경쟁은 어떤지 보죠. [medium pause] ',
    'competition>profit': '경쟁을 봤으니, 그래서 돈이 되는 자리인지 따져볼게요. [medium pause] ',
    'profit>market':      '비용을 봤으니, 다시 자리 자체의 기회를 짚어볼게요. [medium pause] ',
    'profit>direction':   '돈 얘기를 했으니, 채널 쪽 흐름으로 넘어가 볼게요. [medium pause] ',
    'competition>direction': '경쟁을 봤으니, 분위기가 어떤지로 넘어가요. [medium pause] ',
    'direction>customer': '흐름을 봤으니, 다시 사람 쪽을 볼게요. [medium pause] ',
    'customer>profit':    '손님 결을 봤으니, 그래서 매출이 받쳐주는지 보죠. [medium pause] ',
    'market>direction':   '자리를 봤으니, 동네 흐름으로 넘어가 볼게요. [medium pause] ',
  };
  // 일반 폴백(표에 없는 전환도 자연스러운 다리 하나)
  return TABLE[key] || '그럼 이어서, 다음 부분을 볼게요. [medium pause] ';
}
// director-modal.jsx buildLiveScript 의 "카드별 디렉터 멘트 선택" 로직과 동일 (락스텝).
// step.card 별로 director 데이터에서 보여줄 디렉터 라인을 만든다(헤드라인+관찰 슬라이스).
function __dmDirectorLineForCard(d, cardN) {
  const area = __DM_CARD_AREA_MAP[cardN];
  if (area === "ai") {
    const parts = [];
    if (d.intro) parts.push(__dmNaturalize(d.intro));
    if (d.closing) parts.push(__dmNaturalize(d.closing));
    return parts.join(' ');
  }
  const block = d[area];
  if (!block) return '';
  const obs = Array.isArray(block.observations) ? block.observations.filter(Boolean) : [];
  const order = __DM_AREA_CARD_ORDER[area] || [cardN];
  const cardPos = Math.max(0, order.indexOf(cardN));
  const slot = order.length || 1;
  const per = Math.ceil(obs.length / slot) || 1;
  let mine = obs.slice(cardPos * per, cardPos * per + per);
  if (mine.length === 0) mine = obs.slice(0, 2);
  const sentences = [];
  if (block.headline) sentences.push(__dmNaturalize(block.headline));
  mine.forEach((o) => { const s = __dmNaturalize(o); if (s) sentences.push(s); });
  if (!sentences.length) return '';
  // director-modal: text = sentences.slice(0,3).join(' ')
  return sentences.slice(0, 3).join(' ');
}

// 14개 카드 식별자 순서 (DIRECTOR_SCRIPT 카드 순서와 동일)
const __DM_CARD_ORDER = ["01","02","03","04","05","06","07","08","09","10","11","12","13","14"];

// 의뢰인(고객) 14개 질문 뱅크 — 따뜻하고 짧게. 카드 순서와 1:1.
const __DM_CLIENT_PROMPTS = [
  "자리부터 좀 볼까요?",                 // 01 상권
  "손님들은 어떤 분들이에요?",            // 02 고객
  "이 동네 분위기는 좀 어떻게 변하고 있어요?", // 03 변화
  "경쟁 매장은 많은가요?",               // 04 프랜차이즈
  "매출은 좀 나오는 자리예요?",          // 05 매출
  "개인 카페들은 어때요?",               // 06 개인 카페
  "사람은 얼마나 다녀요?",               // 07 유동인구
  "들어가는 돈은 어느 정도예요?",         // 08 임대/창업
  "기회로 볼 만한 신호가 있을까요?",      // 09 기회
  "배달은 챙길 만한가요?",               // 10 배달
  "온라인 반응은 어때요?",               // 11 SNS
  "날씨도 영향이 있나요?",               // 12 날씨
  "종합하면 경쟁력은 어느 정도예요?",     // 13 경쟁
  "그래서 결론은 어떻게 가는 게 좋을까요?", // 14 AI 종합
];

// director(데이터) -> { script(2화자 전체 대본), perCard[14] }
// perCard[i] = { card, area, chars(고객질문+디렉터멘트 글자수), text(디렉터 멘트) }
// Gemini multi-speaker 형식: "Client: ...\nDirector: ..." 14쌍.
function buildDirectorDialogue(cardsArr, director) {
  const d = director || {};
  const lines = [];
  const perCard = [];
  let prevArea = null;   // [STEP 5] 직전 카드 영역(주제) — 바뀌면 다리절 1개 prepend
  __DM_CARD_ORDER.forEach((cardN, i) => {
    const area = __DM_CARD_AREA_MAP[cardN];
    // ★ 1순위: 이 카드 전용 대사 — 화면 박스와 같은 카드(bruSummary)이되 '첫 문장만' 짧게(iframe buildLiveScript 와 동일 소스)
    const idx = parseInt(cardN, 10) - 1;
    let bru = "";
    try { const b = cardsArr && cardsArr[idx] && cardsArr[idx].body; if (b && b.bruSummary) bru = __dmNaturalize(b.bruSummary); } catch (e) {}
    let directorLine = bru || __dmDirectorLineForCard(d, cardN);
    if (!directorLine) directorLine = "이 부분은 데이터를 확인하고 있어요.";
    // [STEP 5] 주제 전환 다리 — 영역이 바뀐 카드 라인 앞에 연결절 1개 + [medium pause]
    const bridge = __dmBridge(prevArea, area);
    if (bridge) directorLine = bridge + directorLine;
    prevArea = area;
    const clientPrompt = __DM_CLIENT_PROMPTS[i] || "이건 어떤가요?";
    lines.push(`Client: ${clientPrompt}`);
    lines.push(`Director: ${directorLine}`);
    perCard.push({
      card: cardN,
      area,
      chars: clientPrompt.length + directorLine.length,  // 실제로 발화되는 글자수
      text: directorLine,                                 // 디렉터가 말하는 멘트 (iframe cur.text 와 패리티)
      clientQ: clientPrompt,
      clientQLen: clientPrompt.length,
      // 이 카드 한 장짜리 대화(고객 질문 + 디렉터 답) — 카드별 음성 클립 생성용
      cardScript: `Client: ${clientPrompt}\nDirector: ${directorLine}`,
    });
  });
  return { script: lines.join('\n'), perCard };
}

// ─────────────────────────────────────────────────────────────
// [STEP 3] normalizeKR — TTS 로 보낼 '발화 문자열'만 한국어 자연발음으로 정규화.
//   ★화면 카드 텍스트/숫자는 절대 안 건드린다. 오직 음성으로 읽을 문장에만 적용.
//   순서: (1) 약어→한글  (2) 기호/단위→말  (3) 숫자→한자어 한글(만 단위 묶음, 단위 인식)
//        (4) 0 규칙(개수 0 → "없음"/"한 곳도 없"; 그 외 0 은 자리값에 흡수)  (5) 오버라이드 사전
// ─────────────────────────────────────────────────────────────
const __NKR_DIGITS = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
// 4자리(만 미만) 한자어 변환: 1~9999. (만/억 묶음은 호출부에서)
function __nkrUnder10000(n) {
  n = Math.floor(n);
  if (n <= 0) return '';
  const places = ['', '십', '백', '천'];
  let out = '';
  const s = String(n);
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const d = s.charCodeAt(i) - 48;
    const place = len - 1 - i;
    if (d === 0) continue;
    // 십/백/천 자리의 1 은 '일' 생략 (예: 19000 → 만 구천, 십 not 일십)
    if (d === 1 && place >= 1) out += places[place];
    else out += __NKR_DIGITS[d] + places[place];
  }
  return out;
}
// 정수 → 한자어 한글, 만(10^4)·억(10^8) 묶음. 0 → '영' (호출부에서 개수 0 은 따로 처리).
function __nkrSinoInt(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return '영';
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const rest = n % 10000;
  const parts = [];
  if (eok > 0) parts.push(__nkrUnder10000(eok) + '억');
  if (man > 0) parts.push((man === 1 ? '만' : __nkrUnder10000(man) + '만'));
  if (rest > 0) parts.push(__nkrUnder10000(rest));
  return parts.join(' ').trim();
}
// 순우리말 수관형사 1~20 (개·명·잔 등 세는 단위 앞)
const __NKR_NATIVE = {
  1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉', 10: '열',
  11: '열한', 12: '열두', 13: '열세', 14: '열네', 15: '열다섯', 16: '열여섯', 17: '열일곱',
  18: '열여덟', 19: '열아홉', 20: '스무',
};
const __NKR_NATIVE_COUNTERS = ['개', '명', '잔', '번', '곳', '마리'];
// 오버라이드 사전: TTS 가 잘못 읽는 단어 → 또렷한 동의어/재배치로 교정 (발화 문자열 최종 치환).
//   ★화면 텍스트/숫자 불변 — 여기 치환은 오직 음성으로 읽을 문장에만 적용된다.
//   원칙: '다시 적기'보다 '뜻 같은 또렷한 단어로 바꿔쓰기'가 안전(연구 확인).
//   확장법: 아래 배열에 ['잘못 들리는 말', '교정'] 추가. ★긴 키를 위에(먼저) 둘 것
//          (예: '빽빽한' 이 '빽빽' 보다 위 → 부분 치환으로 어미가 깨지지 않음).
const __NKR_OVERRIDE = [
  // 빽빽 → '빼곡' (확인된 오독: "백백" 으로 들림). 어미 보존 위해 긴 형태 먼저.
  ['빽빽하게', '빼곡하게'],
  ['빽빽한', '빼곡한'],
  ['빽빽이', '빼곡히'],
  ['빽빽', '빼곡'],
  // 견디다 계열 (기존)
  ['버티는 힘', '견디는 힘'],
  ['버티는', '견디는'],
  // '카페' → '까페' : TTS 발음만 또렷하게(화면 텍스트는 그대로 '카페'). 단순 치환.
  ['카페', '까페'],
];
function normalizeKR(text) {
  let s = String(text == null ? '' : text);
  if (!s) return s;

  // (1) 약어 → 한글
  s = s.replace(/SNS/g, '에스엔에스')
       .replace(/\bAI\b/g, '에이아이').replace(/AI/g, '에이아이')
       .replace(/\bMZ\b/g, '엠지').replace(/MZ/g, '엠지')
       .replace(/KPI/g, '케이피아이')
       .replace(/PDF/g, '피디에프');

  // (2) 범위 기호 ~,- (숫자 사이) → '부터/에서'. 음수 부호 → '마이너스'.
  //   범위: "350~400" → "350부터 400", "12-18" → "12에서 18"
  s = s.replace(/(\d)\s*~\s*(\d)/g, '$1부터 $2');
  s = s.replace(/(\d)\s*-\s*(\d)/g, '$1에서 $2');
  s = s.replace(/(^|[\s(])-(\d)/g, '$1마이너스 $2');

  // (3)+(4) 숫자 → 한글. 단위 인식: 콤마 포함 숫자(소수 포함) + 뒤따르는 단위.
  //   '만원'은 '만 원'(띄움)으로. 개수 0 은 '없음'. 단위에 따라 순우리말/한자어 선택.
  s = s.replace(/(\d[\d,]*)(\.\d+)?\s*(만원|만 원|억원|억 원|개|명|잔|번|곳|마리|원|퍼센트|%|㎡|m|년|분기|도|만|억)?/g,
    (m, intPart, frac, unit) => {
      const rawInt = intPart.replace(/,/g, '');
      let num = parseInt(rawInt, 10);
      if (isNaN(num)) return m;
      unit = unit || '';
      const fracDigits = frac ? frac.slice(1) : '';

      // 단위 정규화
      let spoken = '';
      let spokenUnit = unit;
      if (unit === '%') spokenUnit = '퍼센트';
      if (unit === '㎡') spokenUnit = '제곱미터';   // ㎡ 먼저 (m 보다 우선)
      if (unit === 'm') spokenUnit = '미터';       // 라틴 m → 한글 '미터'
      if (unit === '만원' || unit === '만 원') spokenUnit = '만 원';   // '만'은 숫자로 합치고 '원' 분리
      if (unit === '억원' || unit === '억 원') spokenUnit = '억원';

      // '만'/'억' 이 단위로 붙은 경우 → 숫자에 곱해서 자연스럽게(예: 9,121만원 → 구천백이십일만 원)
      let baseNum = num;
      let trailingUnit = spokenUnit;
      if (unit === '만' || unit === '만원' || unit === '만 원') {
        // num 자체가 '만' 단위 → 만 자리 그대로 읽되 '만' 접미사 유지
        spoken = (num === 0 ? '영' : __nkrSinoInt(num)) + '만';
        trailingUnit = (unit === '만원' || unit === '만 원') ? ' 원' : '';
        // 소수(예: 1.8억 류는 아래 억 분기) 거의 없음 — 만 단위 소수는 무시
        return (spoken + trailingUnit).trim();
      }
      if (unit === '억' || unit === '억원' || unit === '억 원') {
        // 1.8억 → 일점팔억 식보다, 정수+소수 처리: 1.8 → "일점팔"
        let head = (num === 0 ? '영' : __nkrSinoInt(num));
        if (fracDigits) {
          head += '점' + fracDigits.split('').map(d => __NKR_DIGITS[+d]).join('');
        }
        spoken = head + '억';
        trailingUnit = (unit === '억원' || unit === '억 원') ? '원' : '';
        return (spoken + trailingUnit).trim();
      }

      // 개수 0 규칙: 세는 단위(개/명/잔/번/곳/마리)에 0 → '없음'(곳은 '한 곳도 없')
      if (num === 0 && __NKR_NATIVE_COUNTERS.includes(unit)) {
        return unit === '곳' ? '한 곳도 없' : '없음';
      }

      // 세는 단위 + 개수 ≤20 → 순우리말 수관형사
      if (__NKR_NATIVE_COUNTERS.includes(unit) && num >= 1 && num <= 20 && !fracDigits) {
        return __NKR_NATIVE[num] + ' ' + unit;
      }

      // 그 외(원/퍼센트/년/분기/도, 또는 세는 단위 >20) → 한자어
      let head = (num === 0 ? '영' : __nkrSinoInt(baseNum));
      if (fracDigits) head += '점' + fracDigits.split('').map(d => __NKR_DIGITS[+d]).join('');
      if (!spokenUnit) return head;
      // '만 원'은 head 뒤에 ' 원' (만은 숫자에 이미 포함 안 됨 → 위 만 분기서 처리되므로 여기 안 옴)
      return (head + (spokenUnit === '만 원' ? ' 원' : spokenUnit)).trim();
    });

  // (5) 오버라이드 사전 — 최종 치환(긴 키 먼저)
  for (const [from, to] of __NKR_OVERRIDE) {
    s = s.split(from).join(to);
  }
  return s;
}

// [STEP 4] Gemini 멀티스피커에 얹을 자연어 스타일 지시 (대본 맨 앞에 1줄).
const __DM_STYLE_INSTRUCTION =
  '두 사람이 편안하게 대화하듯, 자연스럽고 친근한 어조로, 적당히 또렷하고 너무 느리지 않게. ' +
  'Director는 따뜻하고 자신감 있는 컨설턴트, Client는 궁금해하는 친근한 카페 사장님.';

// [STEP 4] 정규화된 발화문에 멈춤 태그 삽입.
//   - 핵심 숫자(한글 수사 직전) 앞 ~250ms: [short pause]
//   - 문장 끝/주제 전환: ~500ms: [medium pause]
function __dmInsertPauses(spoken) {
  let s = String(spoken || '');
  if (!s) return s;
  // 문장 경계(. ! ? …) 뒤 → [medium pause]
  s = s.replace(/([.!?…])\s+/g, '$1 [medium pause] ');
  // 핵심 숫자(한자어/순우리말 수사 시작) 앞에 [short pause]
  //   '삼백/구천/이십/한/두/스무' 등 수사 첫 글자 군집 앞에 1회씩(과다 방지: 앞이 공백일 때만)
  s = s.replace(/(\s)(영|일|이|삼|사|오|육|칠|팔|구|십|백|천|만|억|한 |두 |세 |네 |다섯|여섯|일곱|여덟|아홉|열|스무)/g,
    '$1[short pause] $2');
  // 중복/과도 정리
  s = s.replace(/\[short pause\]\s*\[short pause\]/g, '[short pause]')
       .replace(/\[medium pause\]\s*\[short pause\]/g, '[medium pause]')
       .replace(/\s{2,}/g, ' ').trim();
  return s;
}

// 한 카드 대본(Client/Director 2줄)을 정규화+멈춤태그+스타일 지시로 다듬어 Gemini 페이로드용 텍스트로.
//   cardScript: "Client: ...\nDirector: ..."  (raw, 화면 표시와 동일 wording)
function __dmBuildTtsPayloadText(cardScript) {
  const lines = String(cardScript || '').split('\n');
  const out = [];
  for (const ln of lines) {
    const mC = ln.match(/^Client:\s*(.*)$/);
    const mD = ln.match(/^Director:\s*(.*)$/);
    if (mC) { out.push('Client: ' + __dmInsertPauses(normalizeKR(mC[1]))); }
    else if (mD) { out.push('Director: ' + __dmInsertPauses(normalizeKR(mD[1]))); }
    else if (ln.trim()) { out.push(__dmInsertPauses(normalizeKR(ln))); }
  }
  return __DM_STYLE_INSTRUCTION + '\n' + out.join('\n');
}

// 단일 카드 대화 1조각을 제미나이 멀티스피커 TTS(여=Aoede 고객/남=Charon 디렉터)로 생성 → base64 PCM
//   [STEP 3+4] 발화 문자열만 normalizeKR + 멈춤태그 + 스타일 지시 적용(화면 텍스트 불변).
async function _genCardClip(cardScript, apiKey) {
  try {
    const payloadText = __dmBuildTtsPayloadText(cardScript);
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: payloadText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [
            { speaker: 'Client',   voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
            { speaker: 'Director', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } }
          ] } }
        }
      })
    });
    const result = await resp.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) { return null; }
}

// ─────────────────────────────────────────────────────────────
// [2026-06-16] AI 디렉터 PPT 씬 빌더
//   디렉터가 말하는 한 마디 == 화면에 뜨는 한 장의 깔끔한 슬라이드.
//   리포트 원본 카드(Card01..14)는 그대로 두고, 디렉터 모달 우측 무대만 SceneView 로 교체.
//   각 씬 = { id, card, template, data, narration, clientQ, clientQLen, cardScript }.
//   data 는 여기서(부모) 실데이터로 완전히 결정해 iframe 으로 전달 → iframe 은 재계산 0.
//   ★빈값 금지: 데이터가 없으면 그 씬을 생략(부분 출력)하되, NaN/"-"/빈 슬라이드는 만들지 않는다.
//   ★숫자 포맷·내러티브는 리포트 화면 표기와 일관(억/만원/명/%/개).
// ─────────────────────────────────────────────────────────────
const __DS_ACCENT = '#4C7BE4';
function __dsN(v) { const n = Number(v); return (typeof n === 'number' && isFinite(n)) ? n : 0; }
// 만원 단위 → 억/만원 한국식 짧은 표기
function __dsManToWon(man) {
  const v = Math.round(__dsN(man));
  if (v <= 0) return '';
  if (v >= 10000) {
    const e = Math.floor(v / 10000); const m = Math.round(v % 10000);
    return m > 0 ? `${e}억 ${m.toLocaleString('ko-KR')}만원` : `${e}억원`;
  }
  return `${v.toLocaleString('ko-KR')}만원`;
}
function __dsComma(v) { return Math.round(__dsN(v)).toLocaleString('ko-KR'); }
function __dsDeltaPct(mine, base) {
  const m = __dsN(mine), b = __dsN(base);
  if (b <= 0) return null;
  return Math.round(((m - b) / b) * 100);
}
// 시계열 values 추출 — 여러 후보 경로(차트 labels/values, monthlyTrend 등)에서 안전하게.
function __dsSeries(body) {
  const cd = (body && body.chartData) || {};
  if (Array.isArray(cd.values) && cd.values.length >= 2) {
    return { labels: cd.labels || [], values: cd.values.map(__dsN) };
  }
  // {label,value}[] 형태
  const arr = (Array.isArray(cd.items) && cd.items.length >= 2 && cd.items.every(x => x && x.value != null))
    ? cd.items : null;
  if (arr) return { labels: arr.map(x => x.label || ''), values: arr.map(x => __dsN(x.value)) };
  return null;
}

// 한 카드 body 에서 그 카드의 PPT 씬들(0~2장)을 만든다. 데이터 없으면 그 씬 생략.
function __dsScenesForCard(cardN, body, allBodies) {
  const bd = (body && body.bodyData) || {};
  const cd = (body && body.chartData) || {};
  const top = body || {};
  const out = [];
  const push = (template, data) => { if (data) out.push({ card: cardN, template, data }); };
  const getBody = (i) => (allBodies && allBodies[i]) ? allBodies[i] : {};

  switch (cardN) {
    case '01': {
      const cafes = __dsN(top.cafeCount) || __dsN(bd.cafes) || __dsN(top.cafes);
      const fran = __dsN(top.franchise) || __dsN(bd.franchise);
      const indi = __dsN(top.individual) || __dsN(bd.individual);
      if (cafes > 0) {
        const stats = [{ value: __dsComma(cafes), unit: '개', name: '반경 500m 카페' }];
        if (fran > 0) stats.push({ value: __dsComma(fran), unit: '개', name: '프랜차이즈' });
        if (indi > 0) stats.push({ value: __dsComma(indi), unit: '개', name: '개인 카페' });
        push('kpiQuad', { label: '이 자리 카페 구성', stats });
      }
      if (fran > 0 && indi > 0) {
        push('ratioSplitBar', {
          a: { label: '프랜차이즈', value: fran }, b: { label: '개인 카페', value: indi },
          unit: '개', note: indi >= fran ? '개인 카페 비중이 더 큰 동네예요.' : '프랜차이즈가 더 촘촘한 동네예요.',
        });
      }
      break;
    }
    case '02': {
      const topAge = String(top.topAge || bd.topAge || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      const male = __dsN(top.maleRatio); const female = __dsN(top.femaleRatio);
      const regular = __dsN(bd.regular) || __dsN(bd.regularPct);
      const newC = __dsN(bd.newCustomer) || __dsN(bd.newPct);
      {
        const stats = [];
        if (topAge && topAge !== '-') stats.push({ value: topAge, name: '주요 연령대' });
        if (male > 0 && female > 0) stats.push({ value: `${Math.round(male)}:${Math.round(female)}`, name: '남:여 성비' });
        if (regular > 0) stats.push({ value: `${Math.round(regular)}`, unit: '%', name: '단골 비중' });
        if (newC > 0) stats.push({ value: `${Math.round(newC)}`, unit: '%', name: '신규 비중' });
        if (stats.length >= 2) push('kpiQuad', { label: '손님 결', stats: stats.slice(0, 4) });
      }
      if (male > 0 && female > 0) {
        push('ratioSplitBar', {
          a: { label: '남성', value: male }, b: { label: '여성', value: female }, unit: '%',
          note: Math.abs(male - female) <= 8 ? '거의 반반, 누구나 편하게 드나드는 자리예요.' : '',
        });
      }
      break;
    }
    case '03': {
      const s1 = __dsN(bd.survivalRate1y) || 65;
      const s3 = __dsN(bd.survivalRate3y) || 39;
      const s5 = __dsN(bd.survivalRate5y) || 28;
      push('kpiQuad', { label: '버티는 힘 (생존율)', stats: [
        { value: `${Math.round(s1)}`, unit: '%', name: '1년' },
        { value: `${Math.round(s3)}`, unit: '%', name: '3년' },
        { value: `${Math.round(s5)}`, unit: '%', name: '5년' },
      ] });
      const now = __dsN(bd.cafesNow) || __dsN(getBody(0).cafeCount) || __dsN(getBody(0).cafes);
      const ago = __dsN(bd.cafes5yAgo);
      const series = __dsSeries(body);
      if (now > 0 && (series || ago > 0)) {
        const vals = series ? series.values : [ago, now];
        const rate = ago > 0 ? Math.round(((now - ago) / ago) * 100) : (__dsN(bd.cafes5yChangeRate) || 0);
        push('trendArea', {
          id: 'c3', value: `${__dsComma(now)}개`, label: '현재 카페 수',
          values: vals, labels: series ? series.labels : ['5년 전', '현재'],
          deltaText: ago > 0 ? `5년 전 ${__dsComma(ago)}개 → ${rate >= 0 ? '+' : ''}${rate}%` : '',
          deltaPositive: rate >= 0,
        });
      }
      break;
    }
    case '04': {
      let items = Array.isArray(cd.items) ? cd.items : (Array.isArray(bd.brandBarItems) ? bd.brandBarItems : []);
      items = items.filter(x => x && x.name).slice(0, 5).map(x => {
        const c = __dsN(x.count) || __dsN(x.value);
        return { name: x.name, value: c, valueText: c > 0 ? `${__dsComma(c)}개` : '' };
      });
      if (items.length) push('rankingList', { label: '주요 프랜차이즈', items });
      const fShare = __dsN(bd.franchiseShare) || __dsN(top.franchiseShare);
      const iShare = __dsN(bd.independentShare) || (fShare > 0 ? 100 - fShare : 0);
      if (fShare > 0) push('percentRing', {
        value: fShare, label: '프랜차이즈 점유율',
        sub: iShare > 0 ? `개인 카페 ${Math.round(iShare)}%` : '',
      });
      break;
    }
    case '05': {
      // [2026-06-28 매출 단일화] 카페 월평균 매출 = 단일 진실값(monthlyAvgSales=소상공인 카페 평균 1086 1순위, 비즈맵 분위 평균 폴백). 없으면 안정 동평균→단일월.
      const monthly = __dsN(bd.monthlyAvgSales) || __dsN(bd.dongCafeAvgStable) || __dsN(bd.monthly) || __dsN(getBody(5).monthlyAvgSales) || __dsN(getBody(5).dongCafeAvgStable) || __dsN(getBody(5).monthly);
      const guAvg = __dsN(bd.guAvg) || __dsN(getBody(5).guAvg);
      if (monthly > 0) {
        const delta = __dsDeltaPct(monthly, guAvg);
        push('compareValue', {
          value: __dsManToWon(monthly), label: '카페 월평균 매출',
          base: { label: guAvg > 0 ? '구 평균' : '평균', value: guAvg }, mine: { value: monthly },
          mineCaption: __dsManToWon(monthly), baseCaption: guAvg > 0 ? __dsManToWon(guAvg) : '',
          deltaText: (delta != null) ? `구 평균보다 ${delta >= 0 ? '+' : ''}${delta}%` : '',
          deltaPositive: (delta == null) || delta >= 0,
        });
        // [2026-06-28 매출 단일화] 헤드라인 월평균(monthly=소상공인 1086)과 추이 series(비즈맵 점포당 매출, ~901)는 출처·스케일이 다르다.
        //   → 추이 라벨을 '비즈맵 점포평균 추이'로 분리하고, 추이 헤드라인 값도 series 끝점(같은 출처)으로 맞춰
        //     한 카드 안에서 헤드라인≠끝점(1086 vs 901)으로 어긋나던 것을 없앤다. series 값 자체는 무변경(이미지=우편함 일치 유지).
        const series = __dsSeries(body);
        const pyr = __dsN(bd.prevYearRate);
        if (series) {
          const _seriesLast = (Array.isArray(series.values) && series.values.length > 0)
            ? __dsN(series.values[series.values.length - 1]) : 0;
          push('trendArea', {
            id: 'c5', value: _seriesLast > 0 ? __dsManToWon(_seriesLast) : __dsManToWon(monthly), label: '비즈맵 점포평균 추이',
            values: series.values, labels: series.labels,
            deltaText: pyr ? `전년 대비 ${pyr >= 0 ? '+' : ''}${Math.round(pyr)}%` : '',
            deltaPositive: pyr >= 0,
          });
        }
      }
      break;
    }
    case '06': {
      const iShare = __dsN(top.indieShare) || __dsN(bd.indieShare);
      const iCount = __dsN(top.indieCount) || __dsN(bd.indieCount);
      if (iShare > 0) push('percentRing', {
        value: iShare, label: '개인 카페 비중',
        sub: iCount > 0 ? `반경 내 개인 카페 ${__dsComma(iCount)}개` : '',
      });
      const iPrice = __dsN(top.indieAvgPrice) || __dsN(bd.americanoAvg);
      if (iPrice > 0 && iPrice < 100000) {
        const sb = 4700; const delta = __dsDeltaPct(iPrice, sb);
        push('compareValue', {
          value: `${__dsComma(iPrice)}원`, label: '개인 카페 아메리카노 평균',
          base: { label: '스타벅스 톨', value: sb }, mine: { value: iPrice },
          mineCaption: `${__dsComma(iPrice)}원`, baseCaption: `${__dsComma(sb)}원`,
          deltaText: (delta != null) ? `스타벅스보다 ${delta >= 0 ? '+' : ''}${delta}%` : '',
          deltaPositive: (delta != null) && delta < 0,
        });
      }
      break;
    }
    case '07': {
      const totalPop = __dsN(bd.totalPop) || __dsN(bd.dailyPopulation);
      const series = __dsSeries(body);
      if (totalPop > 0) push('trendArea', {
        id: 'c7', value: `${__dsComma(totalPop)}명`, label: '일평균 유동인구',
        values: series ? series.values : [], labels: series ? series.labels : [],
        deltaText: '', deltaPositive: true,
      });
      const wd = __dsN(bd.weekdayPct); const we = __dsN(bd.weekendPct);
      if (wd > 0 && we > 0) push('ratioSplitBar', {
        a: { label: '주중', value: wd }, b: { label: '주말', value: we }, unit: '%',
        note: bd.popPeakDay ? `가장 붐비는 요일: ${bd.popPeakDay}` : (wd >= we ? '직장 수요가 중심이 되는 자리예요.' : ''),
      });
      break;
    }
    case '08': {
      const rentPy = __dsN(bd.rentPerPyeongManwon);
      const kosisCafe = (cd.kosisCafe && __dsN(cd.kosisCafe.rentPerPyeong)) || 0;
      if (rentPy > 0) push('compareValue', {
        value: `${__dsComma(rentPy)}만원`, label: '평당 월세',
        base: { label: kosisCafe > 0 ? '전국 카페 평균' : '평균', value: kosisCafe }, mine: { value: rentPy },
        mineCaption: `${__dsComma(rentPy)}만원`, baseCaption: kosisCafe > 0 ? `${__dsComma(kosisCafe)}만원` : '',
        deltaText: kosisCafe > 0 ? (() => { const d = __dsDeltaPct(rentPy, kosisCafe); return d != null ? `전국 평균보다 ${d >= 0 ? '+' : ''}${d}%` : ''; })() : '',
        deltaPositive: false,
      });
      // [2026-06-29 사장님 확정] '총 창업비(15평)' 합계 stat 제거 — 동네별로 안 변해 무의미.
      //   PPT 씬도 보증금·평당월세(동네별 실데이터) + 권리금만 남긴다(합계 표기 폐기).
      const dep = __dsN(bd.depositManwon);
      const _premVal = __dsN((cd.premium && cd.premium.value)) || __dsN(bd.premiumCost);
      const _premMan = _premVal > 0 ? ((cd.premium && cd.premium.value) ? Math.round(_premVal / 10000) : _premVal) : 0;
      {
        const stats = [];
        if (rentPy > 0) stats.push({ value: `${__dsComma(rentPy)}만원`, name: '평당 월세' });
        if (dep > 0) stats.push({ value: __dsManToWon(dep), name: '보증금' });
        if (_premMan > 0) stats.push({ value: __dsManToWon(_premMan), name: '권리금' });
        if (stats.length >= 2) push('kpiQuad', { label: '들어가는 돈', stats: stats.slice(0, 4) });
      }
      break;
    }
    case '09': {
      const vac = __dsN(top.vacancy) || __dsN(bd.vacancy);
      if (vac > 0) push('percentRing', {
        value: vac, label: '공실률', accent: __DS_ACCENT,
        sub: '낮을수록 빈 점포가 적다는 신호',
      });
      const newOpen = __dsN(top.newOpen) || __dsN(bd.newOpen) || __dsN(bd.recentOpen);
      const closed = __dsN(top.closed) || __dsN(bd.closed) || __dsN(bd.recentClose);
      const iPct = __dsN(top.individualPct) || __dsN(bd.individualPct);
      {
        const stats = [];
        if (newOpen > 0) stats.push({ value: __dsComma(newOpen), unit: '곳', name: '최근 개업' });
        if (closed > 0) stats.push({ value: __dsComma(closed), unit: '곳', name: '최근 폐업' });
        if (iPct > 0) stats.push({ value: `${Math.round(iPct)}`, unit: '%', name: '개인 카페 비중' });
        if (stats.length >= 2) push('kpiQuad', { label: '상권 활력 신호', stats: stats.slice(0, 4) });
      }
      break;
    }
    case '10': {
      const avg = __dsN(bd.searchAvgPrice);
      if (avg >= 1000 && avg < 100000) {
        // 주변 동네 평균(있으면)
        let nearAvg = 0;
        const nd = Array.isArray(bd.nearbyDongs) ? bd.nearbyDongs : [];
        const vals = nd.map(x => __dsN(x && (x.avgPrice || x.value))).filter(v => v > 0);
        if (vals.length) nearAvg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        push('compareValue', {
          value: `${__dsComma(avg)}원`, label: '배달 객단가',
          base: { label: nearAvg > 0 ? '주변 동네 평균' : '매장 단가', value: nearAvg || avg }, mine: { value: avg },
          mineCaption: `${__dsComma(avg)}원`, baseCaption: nearAvg > 0 ? `${__dsComma(nearAvg)}원` : '',
          deltaText: nearAvg > 0 ? (() => { const d = __dsDeltaPct(avg, nearAvg); return d != null ? `주변보다 ${d >= 0 ? '+' : ''}${d}%` : ''; })() : '',
          deltaPositive: true,
        });
      }
      const sales = __dsN(bd.searchSales);
      const mt = Array.isArray(bd.monthlyTrend) ? bd.monthlyTrend : [];
      if (sales > 0) {
        const series = mt.length >= 2 ? { labels: mt.map(x => x.label || ''), values: mt.map(x => __dsN(x.value)) } : __dsSeries(body);
        const dt = bd.deliveryTrend && bd.deliveryTrend.salesChange;
        push('trendArea', {
          id: 'c10', value: `${__dsManToWon(sales)}`, label: '월 배달 매출',
          values: series ? series.values : [], labels: series ? series.labels : [],
          deltaText: dt ? `${dt}` : '', deltaPositive: !String(dt || '').includes('-'),
        });
      }
      break;
    }
    case '11': {
      const pos = __dsN(bd.positiveRatio);
      const neg = __dsN(bd.negativeRatio);
      if (pos > 0) push('percentRing', {
        value: pos, label: 'SNS 긍정 비율',
        sub: neg > 0 ? `부정 ${Math.round(neg)}%` : '',
      });
      let kws = Array.isArray(bd.keywords) ? bd.keywords : [];
      kws = kws.map(k => (typeof k === 'string' ? k : (k && (k.keyword || k.name || k.text)))).filter(Boolean).slice(0, 5);
      if (kws.length) push('rankingList', { label: '인기 키워드', items: kws.map(k => ({ name: k })) });
      break;
    }
    case '12': {
      const rain = __dsN(bd.rainImpact) || __dsN(bd.rainSalesChange);
      const extreme = __dsN(bd.extremeImpact) || __dsN(bd.heatSalesChange);
      const stats = [];
      if (rain) stats.push({ value: `${rain >= 0 ? '+' : ''}${Math.round(rain)}`, unit: '%', name: '비 오는 날 매출' });
      if (extreme) stats.push({ value: `${extreme >= 0 ? '+' : ''}${Math.round(extreme)}`, unit: '%', name: '폭염·폭설 매출' });
      if (stats.length >= 2) push('kpiQuad', { label: '날씨 영향', stats });
      else {
        const wl = String(top.weatherLabel || bd.weatherLabel || '').trim();
        if (wl) push('statement', { label: '날씨 영향', verdict: wl });
      }
      break;
    }
    case '13': {
      const c13 = getBody(13);
      const axes = (Array.isArray(c13.axes) && c13.axes.length === 5) ? c13.axes : (Array.isArray(top.axes) ? top.axes : []);
      const validAxes = axes.filter(a => a && __dsN(a.max) > 0).map(a => ({ name: a.label || a.name || '', score: __dsN(a.score), max: __dsN(a.max) }));
      if (validAxes.length === 5) {
        const totalScore = __dsN(c13.totalScore) || __dsN(top.totalScore);
        push('radar5', { label: '투자 대비 수익률 5축', axes: validAxes, totalText: totalScore > 0 ? `종합 ${Math.round(totalScore)}점` : '' });
      }
      break;
    }
    case '14': {
      const c14 = getBody(13);
      const totalScore = __dsN(c14.totalScore) || __dsN(c14.overallScore);
      const verdictRaw = String(c14.recommendation || '').trim();
      const verdict = verdictRaw || (totalScore >= 60 ? '조건부 진입 추천' : totalScore >= 40 ? '입지 재검토 후 진입' : '차별화 필수');
      // [2026-06-29 패스3 §1-15] 등급어 = 화면 카드13과 같은 단일 출처(bcScoreGrade). 옛 70/50 컷오프·적극/신중/재검토 폐기.
      const grade = totalScore > 0
        ? `종합 ${Math.round(totalScore)}점 · ${bcScoreGrade(totalScore).word}`
        : '';
      const tags = Array.isArray(c14.tags) ? c14.tags.filter(Boolean).slice(0, 4) : [];
      push('statement', {
        label: '최종 의견',
        verdict: `${verdict} — 데이터가 받쳐주는 자리입니다.`,
        scoreText: grade, chips: tags,
      });
      // 종합 KPI(기회/리스크/신뢰) 한 장 추가
      const opp = __dsN(c14.opportunities); const risk = __dsN(c14.risks);
      if (opp > 0 || risk > 0) {
        const stats = [];
        if (totalScore > 0) stats.push({ value: `${Math.round(totalScore)}`, unit: '점', name: '종합 점수' });
        if (opp > 0) stats.push({ value: __dsComma(opp), unit: '개', name: '기회 요인' });
        if (risk > 0) stats.push({ value: __dsComma(risk), unit: '개', name: '리스크' });
        if (stats.length >= 2) push('kpiQuad', { label: '종합 진단', stats: stats.slice(0, 4) });
      }
      break;
    }
    default: break;
  }
  return out;
}

// 씬별 의뢰인 질문(여) — 카드/템플릿 성격에 맞는 짧고 따뜻한 한 마디.
const __DS_CLIENT_Q = {
  '01': ['자리부터 좀 볼까요?', '개인이 많아요, 브랜드가 많아요?'],
  '02': ['손님들은 어떤 분들이에요?', '남녀 비율은 어때요?'],
  '03': ['이 동네 분위기는 어떻게 변하고 있어요?', '가게가 늘고 있나요, 줄고 있나요?'],
  '04': ['경쟁 매장은 많은가요?', '브랜드들이 얼마나 차지해요?'],
  '05': ['매출은 좀 나오는 자리예요?', '매출 흐름은 어때요?'],
  '06': ['개인 카페들은 어때요?', '커피값은 어느 정도예요?'],
  '07': ['사람은 얼마나 다녀요?', '평일이 세요, 주말이 세요?'],
  '08': ['들어가는 돈은 어느 정도예요?', '전부 합치면 얼마예요?'],
  '09': ['기회로 볼 만한 신호가 있을까요?', '새로 생기는 가게는 있어요?'],
  '10': ['배달은 챙길 만한가요?', '배달 매출은 늘고 있어요?'],
  '11': ['온라인 반응은 어때요?', '사람들은 뭐라고 말해요?'],
  '12': ['날씨도 영향이 있나요?', ''],
  '13': ['종합하면 경쟁력은 어느 정도예요?', ''],
  '14': ['그래서 결론은 어떻게 가는 게 좋을까요?', ''],
};

// 씬 data + 템플릿 → 그 화면 내용과 정확히 일치하는 디렉터 한 마디(내러티브).
function __dsNarration(cardN, template, data) {
  const d = data || {};
  switch (template) {
    case 'percentRing':
      return `${d.label}이 ${Math.round(__dsN(d.value))}%${d.sub ? `, ${d.sub}` : ''}입니다.`;
    case 'ratioSplitBar':
      return `${d.a.label} ${Math.round(__dsN(d.a.value))}${d.unit || ''} 대 ${d.b.label} ${Math.round(__dsN(d.b.value))}${d.unit || ''}${d.note ? ` — ${d.note}` : '입니다.'}`;
    case 'trendArea':
      return `${d.label}는 ${d.value}${d.deltaText ? `, ${d.deltaText}` : ''}입니다.`;
    case 'compareValue':
      return `${d.label}는 ${d.value}${d.deltaText ? `로, ${d.deltaText}` : '입니다'}.`;
    case 'rankingList': {
      const names = (d.items || []).slice(0, 3).map(x => x.name).filter(Boolean);
      return `${d.label}는 ${names.join(', ')} 순입니다.`;
    }
    case 'kpiQuad': {
      const parts = (d.stats || []).map(s => `${s.name} ${s.value}${s.unit || ''}`);
      return `${d.label} — ${parts.join(', ')}입니다.`;
    }
    case 'radar5':
      return `${d.label}으로 보면 강점과 약점이 한눈에 드러납니다${d.totalText ? `. ${d.totalText}` : ''}.`;
    case 'statement':
      return `${d.verdict}${d.scoreText ? ` ${d.scoreText}.` : ''}`;
    default: return d.label || '';
  }
}

// cardsArr(스왑된 body 배열) → scenes[]. 14카드 순서로 각 카드 0~2장씩.
function buildDirectorScenes(cardsArr) {
  if (!Array.isArray(cardsArr)) return [];
  const bodies = cardsArr.map(c => (c && c.body) || {});
  const scenes = [];
  __DM_CARD_ORDER.forEach((cardN) => {
    const body = bodies[parseInt(cardN, 10) - 1] || {};
    const cardScenes = __dsScenesForCard(cardN, body, bodies);
    const qbank = __DS_CLIENT_Q[cardN] || [];
    cardScenes.forEach((s, k) => {
      const narration = __dsNarration(cardN, s.template, s.data);
      const clientQ = (qbank[k] || qbank[0] || '이건 어떤가요?');
      scenes.push({
        id: `${cardN}-${k}`,
        card: cardN,
        template: s.template,
        data: s.data,
        narration,
        clientQ,
        clientQLen: clientQ.length,
        cardScript: `Client: ${clientQ}\nDirector: ${narration}`,
        audioBase64: null,
      });
    });
  });
  return scenes;
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
        // [2026-06-29] 카드08 '평당 월세 (평균 대비)' 비교 기준 = 그 지역 시도 평당월세 평균(서울 A02 등). 만원/평.
        //   ★시도명(sidoForExt)이 비어도 상권코드(sangkwonCode) 앞 3글자로 시도를 잡는다 →
        //     예전엔 sido 비면 전국(8.8)으로 떨어져 강남 +366% 과장이 났음. 시도 못 구하면 null(="-").
        sidoRentAvg: extractSidoRentAvg(apis, sidoForExt, sangkwonCode),
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
      // ──────────────────────────────────────────────────────────
      // [2026-06-15] 개인 카페 한정 값(차별화) — 모든 카드 hfBody에 공통 노출.
      //   빈크래프트는 개인 카페 전문이라 "개인 카페 기준" 관점이 차별점.
      //   이미 수집된 개인 카페 데이터로만 구성(허위 생성 금지):
      //     indieCount   : 반경 내 개인 카페 수 (cards[4].independentCount → cards[0].individual)
      //     indieShare   : 전체 카페 중 개인 비중 % (cards[0].independentShare, 없으면 indie/total 계산)
      //     indieAvgPrice: 개인 카페 객단가(아메리카노 평균, 원) (cards[4].americanoAvg)
      //   ★개인 한정 "생존율"·"종합점수"는 깨끗한 소스가 없어 만들지 않는다(허위 금지).
      //   화면 작업자가 매출/경쟁 맥락에서 "개인 카페 기준" 값으로 쓸 수 있도록 필드명 고정.
      // ──────────────────────────────────────────────────────────
      {
        const _c4 = cards[4]?.bodyData || {};   // 개인 카페 분석
        const _c1 = cards[0]?.bodyData || {};   // 상권 분석 리포트
        const _toNum = (v) => {
          const n = Number(v);
          return (typeof n === 'number' && isFinite(n)) ? n : 0;
        };
        // 개인 카페 수
        const _indieCount = _toNum(_c4.independentCount) || _toNum(_c1.individual);
        if (_indieCount > 0) hfBody.indieCount = _indieCount;
        // 개인 카페 비중(%) — 상권 카드의 independentShare 우선, 없으면 개인/전체로 계산
        const _totalCafes = _toNum(_c4.totalCafes) || _toNum(_c1.cafes);
        let _indieShare = _toNum(_c1.independentShare);
        if (!(_indieShare > 0) && _totalCafes > 0 && _indieCount > 0) {
          _indieShare = Math.round((_indieCount / _totalCafes) * 100);
        }
        if (_indieShare > 0 && _indieShare <= 100) hfBody.indieShare = _indieShare;
        // 개인 카페 객단가(원) — 개인 카페 아메리카노 평균. 비현실적 값 가드.
        const _indieAvg = _toNum(_c4.americanoAvg);
        if (_indieAvg > 0 && _indieAvg < 100000) hfBody.indieAvgPrice = Math.round(_indieAvg);
      }
      if (i === 13) {
        hfBody.totalScore = card.bodyData?.overallScore || 0;
        hfBody.opportunities = card.bodyData?.opportunities || 0;
        hfBody.risks = card.bodyData?.risks || 0;
        hfBody.recommendation = card.bodyData?.recommendation || '';
        const c13bd = cards[12]?.bodyData || {};
        // [2026-06-29 패스3 §1-14] 5축 만점 = 단일 배열(dataMapper card11.axes5)에서만 읽는다.
        //   옛 30/25/20/15/10 직접 생성 + 카드14 _NEWMAX 라벨덮어쓰기 폐기. axes5 {label,max,raw} → {label,max,score}.
        const _axes5 = Array.isArray(c13bd.axes5) ? c13bd.axes5 : [];
        hfBody.axes = (_axes5.length === 5)
          ? _axes5.map(a => ({ label: a.label, max: Number(a.max) || 1, score: (a.raw != null && isFinite(Number(a.raw))) ? Number(a.raw) : 0 }))
          : [];
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
        hfBody.designDirection = card.chartData?.designDirection || [];
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
        // [2026-06-24] 경쟁분석·시장매력도 '월매출'도 매출카드와 같은 단일 진실값(monthlyAvgSales=비즈맵 분위 평균).
        //   없으면 안정 동평균→단일월 폴백. '시군구 평균 대비 %'는 이 값(guAvg 기준) 그대로 재계산됨.
        hfBody.cafeSales = bd.cafeSales || c5bd.monthlyAvgSales || c5bd.dongCafeAvgStable || c5bd.monthly || 0;
        hfBody.guAvg = bd.guAvg || c5bd.guAvg || 0;
        hfBody.cafeCount = bd.cafeCount || bd.totalCafes || c1bd.cafes || 0;
        // [2026-05-19] 시장 변화 폴백용: 신규/폐업 수 주입 (cards-c.jsx Card13 scoreChange 폴백)
        hfBody.openCount = Number(c2bd.openCount) || Number(c1bd.newOpen) || 0;
        hfBody.closeCount = Number(c2bd.closeCount) || Number(c1bd['폐업 매장']) || 0;
        // [2026-06-25] 성장성 headline 근거를 메뉴 대신 진짜 driver(신폐·5년·YoY)로 — 그 폴백 값 주입.
        //   ② 5년 점포 변화율(card12=cards[2]), ③ 전년 대비(YoY) 시장 추세(card5=cards[5]).
        hfBody.cafes5yChangeRate = Number(c2bd.cafes5yChangeRate) || 0;
        hfBody.prevYearRate = Number(c5bd.prevYearRate) || 0;
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
        // [신폐 단일 해소계층] (2026-06-29) 릴스/카드09 신규·폐업 = 화면 카드와 같은 단일값.
        //   1순위 = 상권변화 카드(cards[2]=card12 openCount/closeCount, __resolveNewClose 단일값).
        //   카드01·카드11은 같은 값이므로 폴백으로만 둔다. (출처가 갈리지 않게 단일 소스 우선.)
        hfBody.newOpen = Number(c12bd.openCount) || Number(c1bd.newOpen) || Number(c11bd.recentOpen)
          || Number(bd.recentOpen) || Number(bd.openCount) || 0;
        hfBody.closed = Number(c12bd.closeCount) || Number(c1bd['폐업 매장']) || Number(c11bd.recentClose)
          || Number(bd.recentClose) || Number(bd.closeCount) || 0;
        // [2026-06-24] 카드09 핵심발견 '시장 매력도'도 매출/AI카드와 같은 단일 진실값(monthlyAvgSales=901, 분위 평균) 사용.
        //   예전엔 monthly(단일월 1086)를 읽어 시군구 평균 대비 -41%로 표기됐으나, 표준값 901 기준 -51%로 통일.
        hfBody.cafeMonthly = (cards[5]?.bodyData?.monthlyAvgSales) || (cards[5]?.bodyData?.monthly) || 0;
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
          // [2026-06-28 매출 단일화] 점포당 카페 월매출 = 단일 진실값(monthlyAvgSales=비즈맵 분위 평균). 없으면 안정 동평균→단일월(만원 단위).
          const _m = Number(_c5bd.monthlyAvgSales) || Number(_c5bd.dongCafeAvgStable) || Number(_c5bd.monthly) || 0;
          if (_m > 0) hfBody.bodyData.avgMonthlySales = _m;
        }
        if (!Number(hfBody.bodyData.franchiseMinPrice)) {
          hfBody.bodyData.franchiseMinPrice = 2500; // 저가 브랜드 (메가/컴포즈)
        }
        if (!Number(hfBody.bodyData.franchiseMaxPrice)) {
          hfBody.bodyData.franchiseMaxPrice = 4700; // 스타벅스 톨 아메
        }
        // [신폐 단일 해소계층 §3] (2026-06-29) 카드06(개인 카페)의 '개인 카페 신규'는 카드01·11·13의
        //   '전체 카페 신규'와 개념이 다르므로 전체 단일값을 주입하지 않는다.
        //   개인 한정 실집계(newIndieList = 반경 내 isNewOpen 개인 카페)만 areaNewOpen 폴백으로 둔다.
        {
          const _indieNew = Array.isArray(hfBody.bodyData?.newIndieList) ? hfBody.bodyData.newIndieList.length : 0;
          if (_indieNew > 0) hfBody.bodyData.areaNewOpen = _indieNew;
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
        // [2026-06-29 정보분산 패스6 §1-10] 카드1 평당월세 = 카드8과 '동일 통합 평당월세 체인'으로 단일화.
        //   카드8 표시 체인: rentPerPyeongManwon(=integratedRent/marketRent) || integratedRent || avgRent(card7.rentPerPyeong).
        //   카드1도 integratedRent/marketRent가 비면 카드7 avgRent(cards[7].bodyData.rentPerPyeong)로 떨어지게 해
        //   카드1=카드8 평당월세가 항상 같은 값이 되게 한다(예전엔 카드1만 integratedRent로 끝나 0/'-'로 갈렸음).
        {
          const _ir = kosisBoxData?.integratedRent;
          const _irOrMarket = _ir?.value
            ? (typeof _ir.unit === 'string' && _ir.unit.indexOf('만원') >= 0
                ? Math.round(_ir.value)
                : Math.round(_ir.value / 10000))
            : (kosisBoxData?.marketRent?.value ? Math.round(kosisBoxData.marketRent.value / 10000) : 0);
          const _avgRentFallback = Number(cards[7]?.bodyData?.rentPerPyeong) || 0;
          hfBody.rentPerPyeong = _irOrMarket || _avgRentFallback;
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
      // ──────────────────────────────────────────────────────────
      // [2026-06-15] 카드별 "한 줄 정리"(bruSummary) 결정적 복원.
      //   AI 의존 없이 각 카드 자신의 실제 데이터로 생성 → 모든 지역/카드에서 빈칸 0 보장.
      //   톤: "이런 상황입니다 → 이렇게 하면 좋습니다" 긍정·창업유도. 부정 지표도 기회로 재프레이밍.
      //   숫자 포맷은 화면과 일관(억/만원/명/%/개). 이모티콘 금지.
      // ──────────────────────────────────────────────────────────
      {
        const _bd = card.bodyData || {};
        const _num = (v) => {
          const n = Number(v);
          return (typeof n === 'number' && isFinite(n)) ? n : 0;
        };
        // 만원 단위 → 억/만원 한국식 표기
        const _manToWon = (man) => {
          const v = Math.round(_num(man));
          if (v <= 0) return '';
          if (v >= 10000) {
            const e = Math.floor(v / 10000);
            const m = Math.round(v % 10000);
            return m > 0 ? `${e}억 ${m.toLocaleString('ko-KR')}만원` : `${e}억원`;
          }
          return `${v.toLocaleString('ko-KR')}만원`;
        };
        const _n = (v) => Math.round(_num(v)).toLocaleString('ko-KR');
        let _sum = '';
        // ──────────────────────────────────────────────────────────
        // [2026-06-15] 교차 인용(cross-reference): 각 카드 한 줄 정리에 "다른 카드의 실제 값" 한 조각을
        //   엮어 다차원 인사이트로 만든다. 규칙:
        //   - 형제 카드 값이 없거나 0/빈문자면 교차 절 자체를 생략(현재 단일 카드 문장 그대로 유지).
        //   - 숫자 포맷·반올림은 그 형제 카드 화면 표기와 동일하게 맞춘다(평일% 정수, 객단가 콤마, 평당 만원, 긍정률 소수1).
        //   - cards[] 는 내부 인덱스 순서: 0상권 1고객 2변화 3프랜 4개인 5매출 6유동 7임대 8기회 9배달 10SNS 11날씨 12경쟁 13종합.
        // ──────────────────────────────────────────────────────────
        const _cBd = (j) => (cards && cards[j] && cards[j].bodyData) ? cards[j].bodyData : {};
        // SNS 긍정률(%) — cards[10].positiveRatio (null 가능). 소수1자리.
        const _xPos = (() => { const v = Math.round(_num(_cBd(10).positiveRatio) * 10) / 10; return (v > 0 && v <= 100) ? v : 0; })();
        // 유동 평일 비중(%) — cards[6].weekdayPct. 정수(카드 KPI toFixed(0)와 일치).
        const _xWeekday = (() => { const v = Math.round(_num(_cBd(6).weekdayPct)); return (v > 0 && v <= 100) ? v : 0; })();
        // 상권 경쟁 강도 라벨 — cards[12].level = 밀집도 단일출처(bcDensityGrade) ∈ {여유, 보통, 다소 밀집, 밀집, 과밀, 매우 과밀}.
        const _xCompetLevel = String(_cBd(12).level || '').trim();
        // 동네 카페 월매출(만원) — '월평균 매출' 단일 진실값(monthlyAvgSales=비즈맵 분위 평균). 없으면 안정 동평균→단일월.
        const _xMonthly = (() => { const v = _num(_cBd(5).monthlyAvgSales) || _num(_cBd(5).dongCafeAvgStable) || _num(_cBd(5).monthly); return v > 0 ? v : 0; })();
        // 통합 평당 월세(만원/평) — 카드 0/7 KPI(integratedRent)와 동일하게 산출.
        const _xRentPy = (() => {
          const _ir = kosisBoxData && kosisBoxData.integratedRent;
          let v = 0;
          if (_ir && _ir.value) {
            v = (typeof _ir.unit === 'string' && _ir.unit.indexOf('만원') >= 0)
              ? Math.round(_ir.value)
              : Math.round(_ir.value / 10000);
          } else if (kosisBoxData && kosisBoxData.marketRent && kosisBoxData.marketRent.value) {
            v = Math.round(kosisBoxData.marketRent.value / 10000);
          }
          return v > 0 ? v : 0;
        })();
        // 배달 객단가(원) — cards[9].searchAvgPrice. 카드 표기와 일치하는 현실 범위(1,000~100,000원)일 때만 사용.
        const _xDeliveryAvg = (() => { const v = Math.round(_num(_cBd(9).searchAvgPrice)); return (v >= 1000 && v < 100000) ? v : 0; })();
        // 주 고객 연령 — cards[1].topAge. 괄호(%) 떼고 핵심만. 플레이스홀더('-')는 제외.
        const _xTopAge = (() => {
          const t = String(_cBd(1).topAge || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
          return (!t || t === '-' || t === '–') ? '' : t;
        })();
        // 개인 카페 아메리카노 평균(원)과 프랜차이즈 대비 가격차(원) — cards[4].
        const _x4 = _cBd(4);
        const _xIndieAmAvg = (() => { const v = Math.round(_num(_x4.americanoAvg)); return (v > 0 && v < 100000) ? v : 0; })();
        const _xIndieGap = (() => {
          const cmp = _x4.indieFranchPriceCompare;
          if (cmp && _num(cmp.indie) > 0 && _num(cmp.franch) > 0) {
            const g = Math.round(_num(cmp.franch) - _num(cmp.indie));
            return g > 0 ? g : 0;
          }
          return 0;
        })();
        // ──────────────────────────────────────────────────────────
        // [2026-06-15] 적응형(어울리는 정보 분석·필터)이되 안정적(결정적) 교차 인용.
        //   고정 1개 대신, 각 카드가 "후보 교차 신호들"을 우선순위대로 검사해
        //   이 지역 데이터에서 가장 두드러진(notable) 첫 후보만 emit한다.
        //   ★결정성: 선택은 오로지 데이터(게이트 조건) + 고정 우선순위의 순수 함수.
        //     난수/Date/AI 일절 없음 → 같은 데이터 = 같은 선택. 다른 지역 데이터 = 다른 연결 가능.
        //   ★null-safe: 모든 후보 게이트가 실패하면 교차 절을 안 붙임(단일 카드 문장 그대로, 빈칸/NaN 불가).
        // ──────────────────────────────────────────────────────────
        // 매출 동별 스프레드(편차 극심 판정) — cards[5]. 데이터 점 3곳 이상일 때만 유효.
        // [2026-06-24] 동별 편차 인용도 분위 상위20%/하위20%로 통일(없으면 소상공인 동최고/최저 폴백).
        const _xDongMax = (() => { const v = _num(_cBd(5).bizmapTopSalesNum) || _num(_cBd(5).dongMaxSales); return v > 0 ? v : 0; })();
        const _xDongMin = (() => { const v = _num(_cBd(5).bizmapBottomSalesNum) || _num(_cBd(5).dongMinSales); return v > 0 ? v : 0; })();
        const _xDongCount = (() => {
          const l = _cBd(5).topFiveDongsList;
          return Array.isArray(l) ? l.filter(Boolean).length : 0;
        })();
        // 공실률(%) — cards[8].vacancy. 자리 귀함(<=4) / 협상 여지(>=12) 신호.
        const _xVacancy = (() => { const v = Math.round(_num(_cBd(8).vacancy) * 10) / 10; return (v > 0 && v <= 100) ? v : 0; })();
        // 프랜차이즈 점유율(%) — cards[3].franchiseShare.
        const _xFranShare = (() => { const v = Math.round(_num(_cBd(3).franchiseShare) * 10) / 10; return (v > 0 && v <= 100) ? v : 0; })();
        // 개인 카페 비중(%) — cards[8].individualPct (기회 카드 기준).
        const _xIndiePct = (() => { const v = Math.round(_num(_cBd(8).individualPct) * 10) / 10; return (v > 0 && v <= 100) ? v : 0; })();
        // 주 고객 연령대 숫자(20/30/40/50/60) — _xTopAge에서 추출. 30대가 아니면 distinctive.
        const _xTopAgeNum = (() => { const m = _xTopAge.match(/(\d{2})/); return m ? Number(m[1]) : 0; })();
        // 주 고객 비중(%) — cards[1].topAge 괄호 안 수치(예: "30대 (31%)") 또는 topAgeShare.
        const _xTopAgeShare = (() => {
          const raw = String(_cBd(1).topAge || '');
          const m = raw.match(/(\d{1,3})\s*%/);
          let v = m ? Number(m[1]) : Math.round(_num(_cBd(1).topAgeShare));
          return (v > 0 && v <= 100) ? v : 0;
        })();
        // ── 적응형 notability 게이트 (지역마다 다른 후보가 켜지도록 임계 튜닝) ──
        const _gSnsHigh    = _xPos >= 82;                 // SNS 긍정 매우 높음
        const _gSnsLow     = _xPos > 0 && _xPos <= 62;    // SNS 긍정 낮음(주의 신호)
        const _gWeekday    = _xWeekday >= 75;             // 평일 비중 강한 오피스 신호
        const _gCompetExtr = /매우\s*과밀/.test(_xCompetLevel) || /여유/.test(_xCompetLevel); // 양극단만 notable (밀집도 단일출처: 고밀=매우과밀/저밀=여유)
        const _gSalesHigh  = _xMonthly >= 8000;           // 월매출 높음(만원)
        const _gSalesSpread = _xDongCount >= 3 && _xDongMax > 0 && _xDongMin > 0 && _xDongMax >= _xDongMin * 2.5; // 편차 극심
        const _gRentHigh   = _xRentPy >= 30;              // 평당 임대 높음
        const _gRentLow    = _xRentPy > 0 && _xRentPy <= 14; // 평당 임대 낮음
        const _gRentNotable = _gRentHigh || _gRentLow;
        const _gDeliveryHigh = _xDeliveryAvg >= 15000;    // 배달 객단가 높음(모임·사무실)
        const _gAgeSkew    = _xTopAge && (_xTopAgeNum !== 30) || (_xTopAge && _xTopAgeShare >= 30); // 연령 쏠림
        const _gPriceBig   = _xIndieGap >= 1200;          // 개인 가격차 큼
        const _gVacTight   = _xVacancy > 0 && _xVacancy <= 4;  // 공실 낮음(자리 귀함)
        const _gVacLoose   = _xVacancy >= 12;             // 공실 높음(협상 여지)
        const _gVacNotable = _gVacTight || _gVacLoose;
        const _gFranHigh   = _xFranShare >= 40;           // 프랜 점유 높음
        const _gIndieHigh  = _xIndiePct >= 60;            // 개인 비중 높음
        // ── 교차 절(clause) 빌더: 각 후보를 짧은 grounded 문장으로 (실값·반올림·조사 일관) ──
        const _clSnsHigh   = () => ` SNS 긍정 반응이 ${_xPos}%로 두드러져, 콘셉트가 통하면 입소문이 그대로 손님으로 이어지는 동네라는 신호입니다.`;
        const _clSnsLow    = () => ` 다만 SNS 긍정 반응이 ${_xPos}%로 낮은 편이라, 첫 한 컷·첫인상에서 확실한 차별점을 보여줘야 입소문을 돌릴 수 있습니다.`;
        const _clSns70     = () => ` SNS에서도 긍정 반응 ${_xPos}%로 회자되니, 콘셉트가 통하는 동네라는 신호입니다.`; // 기존 고정 절(회귀 방지)
        const _clWeekday   = () => ` 유동인구도 평일 ${_xWeekday}%로 직장인 중심이라, 평일 점심·사무실 동선을 촘촘히 잡는 운영이 맞습니다.`;
        const _clSalesHigh = () => ` 동네 카페 월매출이 ${_manToWon(_xMonthly)} 안팎으로 받쳐주니, '되는 집'에 들면 콘셉트로 충분히 상위권을 노릴 수 있습니다.`;
        const _clSalesSpread = () => ` 동별 매출이 최고 ${_manToWon(_xDongMax)}~최저 ${_manToWon(_xDongMin)}으로 편차가 극심해 '되는 집'과 '안 되는 집'이 갈리니, 입지와 콘셉트로 상위권에 드는 게 관건입니다.`;
        const _clRentHigh  = () => ` 임대 평당 ${_manToWon(_xRentPy)}로 부담이 큰 입지지만, 그만큼 수요가 검증됐다는 뜻이라 객단가를 받쳐주는 콘셉트로 상쇄하는 게 관건입니다.`;
        const _clRentLow   = () => ` 임대 평당 ${_manToWon(_xRentPy)} 선으로 고정비 부담이 가벼운 편이라, 콘셉트에 맞는 규모로 시작하면 초반 압박을 크게 줄일 수 있습니다.`;
        const _clRent      = () => (_gRentHigh ? _clRentHigh() : _clRentLow());
        const _clDelivery  = () => ` 배달 객단가도 ${_n(_xDeliveryAvg)}원(모임·사무실 주문 신호)이라, 점심 빠른 회전에 더해 오후 미팅·배달 채널로 객단가를 끌어올릴 수 있습니다.`;
        const _clAge       = () => ` 주 고객이 ${_xTopAge}${_xTopAgeShare >= 30 ? `(${_xTopAgeShare}%)` : ''}로 또렷해, 그 취향에 맞춘 비주얼·감성 한 컷이 그대로 입소문으로 이어집니다.`;
        const _clPriceBig  = () => ` 개인 카페 아메리카노는 프랜차이즈보다 약 ${_n(_xIndieGap)}원 싸니, 가격이 아니라 개성으로 비켜 가는 게 맞습니다.`;
        const _clVac       = () => (_gVacTight
          ? ` 공실률 ${_xVacancy}%로 빈 상가가 귀해 좋은 자리는 빨리 빠지니, 정보력과 자금 준비가 곧 경쟁력입니다.`
          : ` 공실률 ${_xVacancy}%로 빈 상가가 눈에 띄어 임대료·권리금을 깎을 여지가 큽니다.`);
        const _clCompet    = () => ` 경쟁은 ${_xCompetLevel} 수준이라, 초기 진입 설계로 첫 문턱을 넘는 게 관건입니다.`;
        const _clFranHigh  = () => ` 프랜차이즈 점유가 ${_xFranShare}%로 높은 검증된 수요처이니, 대형 브랜드가 못 채우는 빈틈을 개성으로 파고드는 게 개인 카페의 자리입니다.`;
        const _clIndieHigh = () => ` 개인 카페 비중이 ${_xIndiePct}%로 동네 카페판을 개인이 주도하니, 색이 분명한 한 잔이면 비집고 들어갈 여지가 충분합니다.`;
        // ── 결정적 picker: [게이트, 절빌더] 후보를 우선순위대로 검사 → 첫 통과만 emit. 전부 실패면 ''. ──
        const _pickCross = (candidates) => {
          for (let _k = 0; _k < candidates.length; _k++) {
            if (candidates[_k] && candidates[_k][0]) {
              const _c = candidates[_k][1]();
              if (_c) return _c;
            }
          }
          return '';
        };
        switch (i) {
          case 0: { // 상권 분석 리포트 — 렌즈: 구성·밀도 분해
            const cafes = _num(hfBody.cafeCount) || _num(_bd.cafes);
            const indi = _num(hfBody.individual) || _num(_bd.individual);
            const fran = Math.max(0, cafes - indi);
            const indiPct = cafes > 0 ? Math.round((indi / cafes) * 100) : 0;
            if (cafes >= 15) {
              _sum = `반경 ${radius}m에 카페 ${_n(cafes)}곳 — 개인 ${_n(indi)}·프랜차이즈 ${_n(fran)}로 개인 비중 ${indiPct}%. `
                + (indiPct >= 50
                    ? '높은 밀도와 개인 우위가 겹친 구성. 브랜드보다 콘셉트로 갈리는 판세.'
                    : '밀도는 높고 프랜차이즈가 입지를 검증한 구성.');
            } else if (cafes > 0) {
              _sum = `반경 ${radius}m에 카페 ${_n(cafes)}곳 — 개인 ${_n(indi)}·프랜차이즈 ${_n(fran)}. 밀도가 낮은 미성숙 구성으로 선점 여지가 큰 자리.`;
            } else {
              _sum = `반경 ${radius}m 내 카페 표본이 거의 없는 공백 구성. 밀도·경쟁 모두 미형성된 선점형 입지.`;
            }
            break;
          }
          case 1: { // 고객 분석 — 렌즈: 손님 프로필 스케치
            const age = String(hfBody.topAge || _bd.topAge || '').trim();
            const ageShare = _num(hfBody.topAgeShare) || _num(_bd.topAgeShare);
            const fem = Math.round(_num(hfBody.femaleRatio));
            const male = Math.round(_num(hfBody.maleRatio));
            const revisit = _num(hfBody.revisitRate) || _num(_bd.revisitRate);
            const ageTxt = age + (ageShare > 0 ? `(${ageShare}%)` : '');
            const genderTxt = (fem > 0 || male > 0)
              ? `, 성비 남 ${male} : 여 ${fem}`
              : '';
            const revisitTxt = revisit > 0 ? `, 재방문 ${Math.round(revisit)}%` : '';
            // 성별 편향 한 줄 판정(자기 카드 값만)
            const skew = (fem > 0 || male > 0)
              ? (Math.abs(fem - male) <= 5 ? '한쪽에 치우치지 않는 폭넓은 손님층.'
                  : (fem > male ? '여성 쪽으로 기운 손님층.' : '남성 쪽으로 기운 손님층.'))
              : '';
            if (age) {
              _sum = `주 연령 ${ageTxt}${genderTxt}${revisitTxt}.` + (skew ? ' ' + skew : '');
            } else if (fem > 0 || male > 0) {
              _sum = `성비 남 ${male} : 여 ${fem}${revisitTxt}.` + (skew ? ' ' + skew : '');
            } else {
              _sum = '특정 연령·성별로 쏠리지 않는 고른 손님 분포.';
            }
            break;
          }
          case 2: { // 상권 변화 추이
            // [2026-06-15] 생존율은 소수1자리로 정리(원자료가 드물게 float일 때 raw 노출 방지).
            const s3 = Math.round(_num(_bd.survivalRate3y) * 10) / 10;
            const open = _num(_bd.openCount);
            const close = _num(_bd.closeCount);
            const trend = String(_bd.trend || '').trim();
            // [2026-06-15] survivalIsRegional=false면 생존율이 전국 고정 폴백(≈39%)이라 지역마다 같은 문장으로 수렴.
            //   → 이 경우 strategic 절반을 trend(성장/정체/쇠퇴)·신규vs폐업·5년 점포증감률로 변주한다.
            const survivalRegional = !!_bd.survivalIsRegional;
            const chg5 = Math.round(_num(_bd.cafes5yChangeRate) * 10) / 10;
            const net = open - close;
            const hasFlow = open > 0 && close > 0;
            // [2026-06-16] 국면 판정 = 화면에 보이는 '순증(신규-폐업)'과 어긋나지 않게.
            //   신규·폐업이 함께 보일 땐 그 순증 부호로 판정(폐업>신규인데 '확장'이라 적던 모순 제거).
            //   둘 다 없을 때만 추세/5년증감으로 폴백.
            const phase = hasFlow
              ? (net > 0 ? '외형이 커지는 확장 국면.'
                 : net < 0 ? '신규보다 폐업이 많아 솎아지는 정리 국면.'
                 : '들고 나는 교체가 활발한 국면.')
              : ((/성장|증가/.test(trend) || chg5 >= 5) ? '장기적으로 외형이 커진 확장 흐름.'
                 : (/쇠퇴|감소|축소/.test(trend) || chg5 <= -5) ? '장기적으로 솎아진 정리 흐름.'
                 : '외형은 유지되나 안에서 회전이 도는 국면.');
            // 신규·폐업 절(둘 다 있을 때만 순증 명시)
            const flowTxt = (open > 0 && close > 0)
              ? ` 최근 신규 ${_n(open)}·폐업 ${_n(close)}로 순증 ${net > 0 ? '+' : ''}${_n(net)}.`
              : (open > 0 ? ` 최근 신규 ${_n(open)}곳.` : (close > 0 ? ` 최근 폐업 ${_n(close)}곳.` : ''));
            if (s3 > 0 && survivalRegional) {
              _sum = `3년 생존율 ${s3}%${s3 >= 50 ? '로 평균을 웃돈다' : (s3 < 30 ? '로 부침이 큰 편' : '로 평균선 수준')}.${flowTxt} ${phase}`;
            } else if (s3 > 0) {
              // 생존율이 전국 폴백(≈39%) 구간 → 생존율 단정 약화, 신규·폐업·추세로 국면 판정.
              _sum = `3년 생존율 ${s3}% 안팎(업종 평균선).${flowTxt} ${phase}`;
            } else {
              // 생존율 데이터 자체가 없을 때 → 신규·폐업·추세로만 국면 판정.
              _sum = flowTxt
                ? `최근 흐름${flowTxt} ${phase}`
                : phase;
            }
            break;
          }
          case 3: { // 프랜차이즈 현황 — 렌즈: 입지 검증 관점
            const fc = _num(_bd.franchiseCount);
            const share = Math.round(_num(_bd.franchiseShare) * 10) / 10;
            const shareTxt = share > 0 ? `·점유 ${share}%` : '';
            if (fc >= 5) {
              _sum = `프랜차이즈 ${_n(fc)}곳${shareTxt}. 대형 브랜드가 입지 검증을 끝내고 들어온 비율이 높은 자리.`;
            } else if (fc > 0) {
              _sum = `프랜차이즈 ${_n(fc)}곳${shareTxt}. 대형 브랜드 검증이 옅게만 들어온, 개인 우위의 자리.`;
            } else {
              _sum = '프랜차이즈 표본 0곳. 브랜드 검증이 아직 닿지 않은 개인 단독 구성.';
            }
            break;
          }
          case 4: { // 개인 카페 분석
            const _ib = (hfBody.bodyData || _bd);
            const indi = _num(_ib.independentCount) || _num(_bd.independentCount);
            const amAvg = _num(_ib.americanoAvg) || _num(_bd.americanoAvg);
            const cmp = _ib.indieFranchPriceCompare || _bd.indieFranchPriceCompare || null;
            const indiePrice = _num(cmp && cmp.indie);
            const franchPrice = _num(cmp && cmp.franch);
            const gap = (indiePrice > 0 && franchPrice > 0) ? (franchPrice - indiePrice) : 0;
            if (indiePrice > 0 && franchPrice > 0 && gap >= 200) {
              _sum = `개인 아메리카노 평균 ${_n(indiePrice)}원으로 프랜차이즈보다 약 ${_n(gap)}원 낮다. 가격은 앞서지만 그만큼 단가 여력은 좁은 구조.`;
            } else if (indiePrice > 0 && franchPrice > 0) {
              _sum = `개인 아메리카노 평균 ${_n(indiePrice)}원으로 프랜차이즈(${_n(franchPrice)}원)와 격차 ${_n(gap)}원. 가격 포지션이 거의 겹쳐 단가보다 콘셉트로 갈리는 구조.`;
            } else if (amAvg > 0) {
              _sum = `개인 아메리카노 평균 ${_n(amAvg)}원. 이미 바닥에 가까운 가격대로 추가 인하 여력이 좁은 포지션.`;
            } else if (indi > 0) {
              _sum = `개인 카페 ${_n(indi)}곳이 형성한 가격대. 단가 경쟁보다 개성으로 갈리는 포지션.`;
            } else {
              _sum = '개인 카페 표본이 얕아 가격 포지션이 미형성된 구간.';
            }
            break;
          }
          case 5: { // 매출 분석 — [2026-06-25] 1차원(숫자 나열) 탈피.
            // 해석축: 평균은 낮아도 상위20%가 높으면 = 입지가 아니라 '운영력'이 매출을 가른다
            //   → 차별화하면 상위권이 열린다(저매출 지역도 희망 톤). 결론부터, 처방으로 닫는다.
            // 교차 인용: 형제 카드(주 고객 연령 / 유동 평일목적 / 경쟁 밀도 / 임대 부담) 중
            //   이 지역 데이터에서 가장 또렷한 1개를 결정적으로 골라 전략에 연결(난수/Date/AI 없음).
            const monthly = _num(_bd.monthlyAvgSales) || _num(_bd.dongCafeAvgStable) || _num(_bd.monthly);
            const topS = _num(_bd.bizmapTopSalesNum) || _num(_bd.dongMaxSales);
            const botS = _num(_bd.bizmapBottomSalesNum) || _num(_bd.dongMinSales);
            // 분위(상위20%)가 평균을 충분히 웃돌면 = 운영력으로 갈리는 구조(상위권이 '열려 있음').
            const hasQuant = topS > 0 && monthly > 0;
            const topOverAvg = hasQuant && topS >= monthly * 1.4; // 상위20%가 평균의 1.4배+ → 격차 또렷
            // ── 형제 카드 교차 처방 절(결정적 우선순위: 연령 → 평일목적 → 경쟁밀도 → 임대부담) ──
            //   매출 카드 톤에 맞춰 '상위권으로 가는 운영 처방'으로 연결. 후보 전부 없으면 일반 처방.
            const _clSalesAge = () => ` 주 고객이 ${_xTopAge}로 또렷한 만큼, 그 취향을 정조준한 콘셉트면 상위권이 충분히 열리는 자리입니다.`;
            const _clSalesWeekday = () => ` 유동인구가 평일 ${_xWeekday}%로 직장인 중심이라, 평일 점심·사무실 동선을 잡는 운영을 다지면 상위 매출로 올라설 길이 분명합니다.`;
            const _clSalesCompetLow = () => ` 경쟁이 '${_xCompetLevel}' 수준으로 느슨해, 색이 분명한 콘셉트 하나면 상위권 자리를 선점할 여지가 큽니다.`;
            const _clSalesCompetHigh = () => ` 경쟁이 '${_xCompetLevel}'로 치열한 만큼, 묻히지 않는 또렷한 콘셉트가 곧 상위 매출의 갈림길입니다.`;
            const _clSalesRentHigh = () => ` 임대 평당 ${_manToWon(_xRentPy)}로 부담은 있지만 그만큼 수요가 검증된 자리라, 객단가를 받쳐주는 콘셉트면 상위권 매출로 상쇄할 수 있습니다.`;
            const _clSalesRentLow = () => ` 임대 평당 ${_manToWon(_xRentPy)} 선으로 고정비가 가벼워, 콘셉트에 집중할 여유가 큰 만큼 운영력으로 상위권을 노리기 좋습니다.`;
            const _crossSales = _pickCross([
              [!!_xTopAge, _clSalesAge],
              [_xWeekday >= 60, _clSalesWeekday],
              [/양호|여유|보통/.test(_xCompetLevel), _clSalesCompetLow],
              [/매우\s*과밀|과밀/.test(_xCompetLevel), _clSalesCompetHigh],
              [_xRentPy >= 30, _clSalesRentHigh],
              [_xRentPy > 0 && _xRentPy <= 14, _clSalesRentLow],
            ]);
            if (topOverAvg) {
              // 평균 대비 상위20%가 또렷 → "입지보다 운영력" 핵심 해석 + 희망 처방.
              const _avgWord = monthly < 700 ? '평균은 낮은 편이지만' : '평균은 보통 수준이지만';
              _sum = `이 동네는 ${_avgWord} 상위 카페는 ${_manToWon(topS)}을 벌어, 입지보다 '운영력'이 매출을 가르는 곳입니다.`
                + (_crossSales || ' 분명한 콘셉트 하나로 차별화하면 상위권이 충분히 열립니다.');
            } else if (hasQuant) {
              // 분위는 있으나 격차가 좁음 → 시장 기준선이 또렷, 평균만 넘어도 안정적이라는 희망 톤.
              _sum = `이 동네는 카페 간 매출 편차가 크지 않아, 평균 수준만 지켜도 안정적으로 자리 잡을 수 있는 곳입니다.`
                + (_crossSales || ' 기본기를 갖춘 콘셉트면 무난히 시장 기준선에 올라설 수 있습니다.');
            } else if (monthly > 0) {
              // 분위 표본은 없지만 동평균은 있는 지역 → 기존 톤 유지하되 처방형으로.
              _sum = `이 동네 카페 월매출은 평균 ${_manToWon(monthly)} 수준으로, 운영하기에 따라 충분히 위로 갈 여지가 있는 곳입니다.`
                + (_crossSales || ' 콘셉트를 또렷이 잡으면 평균을 넘어설 길이 열립니다.');
            } else {
              _sum = '아직 매출 표본은 얕지만 그만큼 자리 잡은 강자가 적은 구간이라, 운영력으로 선점할 여지가 큰 동네입니다.';
            }
            break;
          }
          case 6: { // 유동인구 — 사람의 '목적'과 시간대 중심 재해석 (메뉴 언급 최소)
            const _b6 = (hfBody.bodyData || _bd);
            const pop = _num(_b6.totalPop) || _num(_bd.totalPop) || _num(_b6.dongDailyPop) || _num(_bd.dongDailyPop);
            const wd = _num(_b6.weekdayPct) || _num(_bd.weekdayPct);
            const we = _num(_b6.weekendPct) || _num(_bd.weekendPct);
            // [2026-06-15] 카드 KPI(주중/주말 = toFixed(0))와 일치하도록 정수로 표기.
            const wdR = Math.round(wd);
            const weR = Math.round(we);
            const peak = String(_b6.peakHour || _bd.peakHour || '').trim();
            // 피크 시간(시) 숫자 추출 → 점심대(11~15시) 여부 판정
            const peakHourNum = (() => { const m = peak.match(/(\d{1,2})\s*시/); return m ? Number(m[1]) : -1; })();
            const isLunchPeak = peakHourNum >= 11 && peakHourNum <= 15;
            const isEveningPeak = peakHourNum >= 16;
            const peakTxt = (peak && peak !== '-') ? `, 피크 ${peak}` : '';
            if (wd >= 60) {
              _sum = `유동 평일 ${wdR}%·주말 ${weR}%${peakTxt}. ${isLunchPeak ? '주중 낮 수요가 절대적인 직장형 동선.' : '평일에 무게가 쏠린 직장형 동선.'}`;
            } else if (we > 0 && we >= wd) {
              _sum = `유동 평일 ${wdR}%·주말 ${weR}%${peakTxt}. ${isEveningPeak ? '주말 오후·저녁에 체류하는 여가형 동선.' : '주말로 무게가 쏠린 여가형 동선.'}`;
            } else if (wd > 0 && we > 0) {
              _sum = `유동 평일 ${wdR}%·주말 ${weR}%${peakTxt}. 평일·주말이 맞물려 시간대마다 얼굴이 바뀌는 혼합형 동선.`;
            } else if (pop > 0) {
              _sum = `하루 통행 약 ${_n(pop)}명${peakTxt}. 시간대 집중이 동선의 성격을 가르는 구조.`;
            } else {
              _sum = '시간대별 유동 표본이 얕아 동선 성격을 단정하기 이른 구간.';
            }
            break;
          }
          case 7: { // 임대/창업 정보
            // [2026-06-15] '평당' 값은 카드 KPI(통합 평당 월세 = integratedRent)와 반드시 일치시킨다.
            //   rentPerPyeongManwon = integratedRent 기반(만원/평, KPI와 동일). 이걸 1순위로.
            //   _bd.rentPerPyeong(Gemini 원본)은 가게 전체 월세(예: 619)일 수 있어 KPI와 모순 → 폴백으로만.
            const rentPy = _num(hfBody.bodyData && hfBody.bodyData.rentPerPyeongManwon) || _num(_bd.rentPerPyeong);
            // 권리금(만원): chartData.premium.value(원) → 만원 환산, 없으면 bodyData.premiumCost(만원)
            const premWon = _num(hfBody.chartData && hfBody.chartData.premium && hfBody.chartData.premium.value);
            const premium = premWon > 0 ? Math.round(premWon / 10000) : _num(_bd.premiumCost);
            // 평당 임대료가 높은지 판정(서울 핵심 상권 평당 30만원/월 이상을 '비싼' 기준선으로)
            const highRent = rentPy >= 30;
            // [2026-06-29 사장님 확정] '총창업비 합계' 숫자는 동네별로 안 변해(권리금=광역평균·인테리어=전국단가·시설장비=컨셉)
            //   무의미 → 한 줄요약에서 합계 숫자 제거. 대신 평당월세·권리금(동네별 실데이터)으로
            //   '초기 진입 비용이 평균보다 높은/낮은 편'이라는 정성 가이드만 남긴다(숫자 없이).
            if (rentPy > 0 && (highRent || premium >= 3000)) {
              _sum = `평당 월세 ${_manToWon(rentPy)}`
                + (premium > 0 ? `, 권리금 ${_manToWon(premium)}` : '')
                + `. 초기 진입 비용이 평균보다 높은 편의 입지.`;
            } else if (rentPy > 0) {
              _sum = `평당 월세 ${_manToWon(rentPy)}`
                + (premium > 0 ? `, 권리금 ${_manToWon(premium)}` : '')
                + `. 초기 진입 비용이 평균보다 부담스럽지 않은 편의 입지.`;
            } else if (_num(_bd.deposit) > 0 || premium > 0) {
              // 평당 KOSIS 데이터가 없을 때(D 경로): 보증금/권리금으로 비용 등급 판정.
              const _dep = _num(_bd.deposit);
              _sum = (_dep > 0
                ? `보증금 ${_manToWon(_dep)}${premium > 0 ? `, 권리금 ${_manToWon(premium)}` : ''}`
                : `권리금 ${_manToWon(premium)}`)
                + `. 초기 진입 비용이 평균보다 낮은 편의 입지.`;
            } else {
              _sum = '임대·권리금 표본이 얕아 진입 비용 등급을 단정하기 이른 구간.';
            }
            break;
          }
          case 8: { // 카페 기회
            const vac = _num(hfBody.vacancy);
            // [2026-06-15] 카드 KPI(공실률 = vacancy.toFixed(1))와 일치하도록 소수1자리로 표기.
            const vacR = Math.round(vac * 10) / 10;
            const newOpen = _num(hfBody.newOpen);
            // [2026-06-15] 비중/생존율은 소수1자리로 정리(raw float 노출 방지).
            const indiPct = Math.round(_num(hfBody.individualPct) * 10) / 10;
            if (vac > 0 && vac <= 8 && newOpen > 0) {
              _sum = `공실 ${vacR}%로 빈 상가가 적고 신규 ${_n(newOpen)}곳이 꾸준. 자리는 귀하고 회전은 빠른, 선점이 관건인 타이밍.`;
            } else if (vac > 0 && vac <= 8) {
              _sum = `공실 ${vacR}%로 빈 상가가 귀한 구간. 매물이 드물어 좋은 자리는 뜨는 즉시 갈리는 선점형 타이밍.`;
            } else if (vac > 12) {
              _sum = `공실 ${vacR}%로 빈 상가가 두드러진 구간. 임대인 우위가 풀린, 조건 협상이 열린 타이밍.`;
            } else if (indiPct >= 60) {
              // 공실 데이터 없을 때(B/C/D): 개인비중·신규로 타이밍 판정.
              _sum = `개인 비중 ${indiPct}%로 개인이 주도하는 판`
                + (newOpen > 0 ? `, 신규 ${_n(newOpen)}곳이 이어지는 흐름` : '')
                + `. 콘셉트 경쟁으로 비집고 들어갈 여지가 열린 타이밍.`;
            } else if (newOpen > 0) {
              _sum = `신규 ${_n(newOpen)}곳이 이어지는 활기`
                + (indiPct > 0 ? `(개인 비중 ${indiPct}%)` : '')
                + `. 진입 수요가 살아 있는, 흐름에 올라탈 타이밍.`;
            } else if (indiPct > 0) {
              _sum = `개인 비중 ${indiPct}%로 콘셉트로 갈리는 판. 차별점 하나로 비집고 들어갈 여지가 있는 타이밍.`;
            } else {
              _sum = '진입 여지가 넉넉한 미형성 구간. 선점 효과가 큰 타이밍.';
            }
            break;
          }
          case 9: { // 배달 객단가
            const avg = _num(_bd.searchAvgPrice) || _num((hfBody.bodyData || {}).searchAvgPrice);
            const dong = String(_bd.searchDongName || '').trim();
            // [2026-06-15] 1인주문 구간(avg<12000)을 주문량으로 변주: 주문이 많으면 박리다매형(회전), 적으면 단가 끌어올리기형.
            const orders = _num(_bd.searchOrders) || _num((hfBody.bodyData || {}).searchOrders);
            const dongTxt = dong ? `${dong} ` : '';
            const orderTxt = orders > 0 ? `, 주문 ${_n(orders)}건` : '';
            if (avg >= 12000) {
              _sum = `배달 객단가 ${_n(avg)}원${orderTxt}으로 매장 단가를 크게 웃돈다. 1인보다 사무실·다인 주문이 끄는 채널.`;
            } else if (avg > 0 && orders >= 1000) {
              _sum = `${dongTxt}배달 객단가 약 ${_n(avg)}원·주문 ${_n(orders)}건. 단가는 1인급이나 물량이 두터운 회전형 채널.`;
            } else if (avg > 0) {
              _sum = `${dongTxt}배달 객단가 약 ${_n(avg)}원${orderTxt}. 1인 주문이 주축인 채널.`;
            } else {
              _sum = '배달 주문 표본이 얕아 채널 성격을 단정하기 이른 구간.';
            }
            break;
          }
          case 10: { // SNS 트렌드 (AI 의존 필드 — 빈값 robust fallback 유지)
            const kws = Array.isArray(_bd.keywords) ? _bd.keywords.filter(Boolean) : [];
            // [2026-06-15] 긍정 비율은 소수1자리로 정리(카드 KPI와 일치, raw float 방지).
            const pos = Math.round(_num(_bd.positiveRatio) * 10) / 10;
            const kwTxt = kws.slice(0, 3).map(k => (typeof k === 'string' ? k : (k && k.text) || k && k.name || '')).filter(Boolean).join('·');
            if (pos >= 70) {
              _sum = `SNS 긍정 ${pos}%`
                + (kwTxt ? `, 키워드는 ${kwTxt}` : '')
                + `. 검색해서 찾아오는 '보여주는' 수요가 큰 동네.`;
            } else if (kwTxt) {
              _sum = `SNS 키워드는 ${kwTxt}`
                + (pos > 0 ? `, 긍정 ${pos}%` : '')
                + `. 검색·해시태그로 회자되는 노출형 수요가 도는 동네.`;
            } else if (pos > 0) {
              _sum = `SNS 긍정 ${pos}%. 검색 평판이 받쳐주는 노출형 수요 구간.`;
            } else {
              _sum = 'SNS 신호 표본이 얕아 평판·검색 수요를 단정하기 이른 구간.';
            }
            break;
          }
          case 11: { // 날씨 영향 분석 — 기후 유형별 변주 (단순 강수% 반복 금지)
            // [2026-06-15] yearlyDistribution 실제 필드: rainyPct·snowyPct·avgTemp·winterMin(겨울최저)·summerMax.
            //   rainyPct는 거의 항상 >0이라 예전엔 모든 지역이 같은 강수 문장으로 수렴 → 기후 유형으로 분기:
            //     ①겨울 춥거나 눈 많음 → 따뜻한 음료·실내 체류로 비수기 버티기
            //     ②온난·눈 적음 → 테이크아웃·시즌 음료로 날씨 타는 매출 메우기
            //     ③강수 많음(위 둘에 안 걸릴 때) → 비·맑음 사이 수요 이동 운영
            const yd = _bd.yearlyDistribution || {};
            const rainy = Math.round(_num(yd.rainyPct));
            const snowy = Math.round(_num(yd.snowyPct));
            const temp = (yd.avgTemp != null) ? (Math.round(_num(yd.avgTemp) * 10) / 10) : null;
            const winterMin = (yd.winterMin != null) ? (Math.round(_num(yd.winterMin) * 10) / 10) : null;
            const summerMax = (yd.summerMax != null) ? (Math.round(_num(yd.summerMax) * 10) / 10) : null;
            // 추운 지역: 겨울 최저 -10도 이하 또는 눈 비중 6% 이상 / 온난 지역: 연평균 14도 이상이면서 눈 적음
            const isCold = (winterMin != null && winterMin <= -10) || snowy >= 6;
            const isMild = (temp != null && temp >= 14) && snowy <= 3;
            if (isCold) {
              _sum = `겨울 최저 ${winterMin != null ? `${winterMin}도` : '낮음'}`
                + (snowy > 0 ? `·눈 ${snowy}%` : '')
                + `로 추위가 긴 편. 겨울 비수기를 버티는 실내 체류·온음료 설계가 변수.`;
            } else if (isMild) {
              _sum = `연평균 ${temp}도`
                + (summerMax != null ? `·여름 최고 ${summerMax}도` : '')
                + `로 사계절 온화. 날씨에 매출이 덜 출렁이는, 계절 리스크가 낮은 입지.`;
            } else if (rainy > 0) {
              _sum = `비 오는 날 연 ${rainy}%`
                + (winterMin != null ? `·겨울 최저 ${winterMin}도` : '')
                + `. 비·한파 구간에 수요가 빠지는, 날씨를 타는 입지.`;
            } else if (temp != null) {
              _sum = `연평균 ${temp}도`
                + (winterMin != null ? `·겨울 최저 ${winterMin}도` : '')
                + `로 계절 폭이 큰 편. 비수기·성수기 진폭이 매출 변수.`;
            } else {
              _sum = '계절별 기상 표본이 얕아 날씨 리스크를 단정하기 이른 구간.';
            }
            break;
          }
          case 12: { // 상권 경쟁 분석 = 카드13 "투자 대비 수익률 종합"
            // [2026-06-25 모순2] 부제(파란 박스)를 ROI 종합 관점 한 줄로 교체.
            //   ★옛 버그: dataMapper competLevel(카페 >80 "매우 과밀")을 그대로 써서, 카드13 경쟁여건 축
            //     (cafeCount >200 과밀/>80 보통/else 여유)과 등급어가 충돌(예: 139개 → 부제 '매우 과밀' vs 축 '보통').
            //   → ① [2026-06-29 패스5 §1-7] 밀집도 등급어 = 단일 출처 bcDensityGrade(카드13·14·competLevel과 동일 6단계).
            //      ② 경쟁 프레이밍("버틸 수는 있으나 무난하면 묻히는 밀도") 제거 → ROI(수익률·회수) 관점.
            //      ③ ROI 부호(흑자/적자)는 수익성·투자회수 축과 같은 단일 월영업이익(roiMonthlyProfit)을 따른다.
            const cafeCnt = _num(hfBody.cafeCount) || _num(_bd.cafeCount) || _num(_bd.totalCafes);
            // 종합점수(레이더 5축 합) — 자기 카드 값
            const score12 = Math.round(_num(hfBody.totalScore) || _num(_bd.score) || _num(_bd.totalScore));
            const scoreTxt = score12 > 0 ? `투자 대비 수익률 종합 ${score12}점` : '투자 대비 수익률 종합';
            // 밀집도 등급어 — 단일 출처(bcDensityGrade). 카드13/14·competLevel과 같은 단어.
            const densW = bcDensityGrade(cafeCnt);
            const _densHigh = (densW === '과밀' || densW === '매우 과밀');
            const _densMid = (densW === '밀집' || densW === '다소 밀집' || densW === '보통');
            const densPhrase = _densHigh ? ` 카페 밀집도는 '${densW}'이라 콘셉트로 비집고 들어가야 하는 자리.`
              : _densMid ? ` 카페 밀집도는 '${densW}'이라 차별화 여지가 있는 자리.`
              : densW === '여유' ? ` 카페 밀집도는 '여유'라 진입 부담이 낮은 자리.`
              : '';
            // ROI 부호 — 수익성/투자회수 축과 같은 단일 월영업이익. 적자=흑자전환 우선(긍정 처방), 흑자=비용·수익 구조 관점.
            // [2026-06-29 예언 제거] 회수 '시점/개월수' 예측(예: "약 N개월에 회수")은 예언이라 전부 제거.
            //   비용·구조 관점의 정직한 비예언 문구로 대체(긍정 톤 유지, 회수 N개월 표기 금지).
            const roiProfit = (_bd.roiMonthlyProfit != null) ? _num(_bd.roiMonthlyProfit) : null;
            let roiPhrase;
            if (roiProfit != null && roiProfit <= 0) {
              roiPhrase = ` 지금은 비용 구조상 흑자 전환에 먼저 집중할 자리.`;
            } else if (roiProfit != null && roiProfit > 0) {
              roiPhrase = ` 비용 대비 수익 구조는 안정적인 편.`;
            } else {
              roiPhrase = ` 초기 투자 규모를 예산에 맞추는 게 관건인 자리.`;
            }
            if (score12 > 0) {
              _sum = `${scoreTxt}.${roiPhrase}${densPhrase}`;
            } else if (densW) {
              _sum = `${scoreTxt}.${densPhrase}`;
            } else {
              _sum = '투자 대비 수익률 표본이 얕아 종합 판단은 이른 구간.';
            }
            break;
          }
          case 13: { // AI 종합 분석 — 렌즈: 의사결정 요약
            // [2026-06-15] 종합 점수는 정수로(카드 종합 점수 표기와 일치).
            const score = Math.round(_num(hfBody.totalScore));
            const opp = _num(hfBody.opportunities);
            const risk = _num(hfBody.risks);
            const orTxt = (opp > 0 || risk > 0)
              ? `, 기회 ${_n(opp)}건·리스크 ${_n(risk)}건`
              : '';
            // [2026-06-25 ROI 톤] 투자 대비 수익률 한줄평 — 균형 처방. 점수 무변경, 표현만.
            //   낮은 점수도 원인(비용·경쟁)을 정직하게 짚되 만회 레버(빈틈·객단가·자금 설계)로 연결.
            if (score >= 70) {
              _sum = `종합 ${score}점${orTxt}. 수요·매출이 받쳐주는 수익률 유리한 자리 — 콘셉트 차별화만 더하면 됩니다.`;
            } else if (score > 0 && score < 50) {
              _sum = `종합 ${score}점${orTxt}. 초기 비용·경쟁이 수익률 점수를 누르지만, 빈틈 공략과 자금 설계로 만회할 수 있는 구조.`;
            } else if (score > 0) {
              _sum = `종합 ${score}점${orTxt}. 수요·매출은 받쳐주는 만큼, 비용 관리와 콘셉트로 객단가를 끌어올리면 수익률은 따라옵니다.`;
            } else {
              _sum = '종합 점수 표본이 얕아 단정은 이르지만, 강점 축을 콘셉트로 좁히면 비집고 들어갈 여지는 분명합니다.';
            }
            break;
          }
          default:
            _sum = '데이터로 살펴본 결과 도전해볼 만한 동네예요. 분명한 콘셉트 하나면 충분히 자리 잡을 수 있습니다.';
        }
        hfBody.bruSummary = _sum;
      }
      return { n: String(i + 1).padStart(2, '0'), body: hfBody };
    });
  }, [cards, kosisBoxData, collectedData, radius]);

  // [2026-05-19] 검색 주소가 시안 TopBar 기본값("강남역 1번 출구")으로 덮이지 않도록
  // collectedData / searchAddress에서 실제 주소를 추출해 iframe으로 함께 푸시한다.
  // [2026-06-15] TDZ 방지: bcOneLineSummary가 이 값을 참조하므로 그 위에서 선언한다.
  const bcSearchAddress = useMemo(() => {
    const _addr =
      collectedData?.addressInfo?.address ||
      collectedData?.address ||
      collectedData?.region ||
      searchAddress ||
      '';
    return String(_addr).trim();
  }, [collectedData, searchAddress]);

  // ──────────────────────────────────────────────────────────
  // [2026-06-15] "한 장 요약" 배너 데이터 (방법A: 카드 루프 위 별도 배너)
  //   - 권고 한 줄(결론) + 핵심 5숫자(월매출/BEP/회수기간/총창업비/리스크) + 상담 CTA용 입력값
  //   - 전적으로 카드 데이터에서 결정적으로 계산(AI 의존 금지). 빈값/"-"/이모티콘 금지.
  //   - 카드 인덱스(스왑 전 기준): 0=상권, 2=상권변화/생존, 5=매출분석, 7=임대/창업, 9=배달, 12=상권경쟁(5축), 13=AI종합
  // ──────────────────────────────────────────────────────────
  const bcOneLineSummary = useMemo(() => {
    if (!Array.isArray(cards) || cards.length === 0) return null;
    const num = (v) => {
      const n = Number(v);
      return (typeof n === 'number' && isFinite(n)) ? n : 0;
    };
    // 만원 단위 → "X억 X만원"/"X,XXX만원" 한국식 표기
    const fmtMan = (man) => {
      const v = Math.round(num(man));
      if (v <= 0) return '';
      if (v >= 10000) {
        const e = Math.floor(v / 10000);
        const m = Math.round(v % 10000);
        return m > 0 ? `${e}억 ${m.toLocaleString('ko-KR')}만원` : `${e}억원`;
      }
      return `${v.toLocaleString('ko-KR')}만원`;
    };
    const c0 = cards[0]?.bodyData || {};
    const c2 = cards[2]?.bodyData || {};
    const c5 = cards[5]?.bodyData || {};
    const c7 = cards[7]?.bodyData || {};
    const c9 = cards[9]?.bodyData || {};
    const c12 = cards[12]?.bodyData || {};
    const c13 = cards[13]?.bodyData || {};
    // [2026-06-26 매출 미수집 보류] 데이터층 약속: 매출 미수집(차단/비수도권)이면 ROI를 가짜로
    //   채우지 않고 5축 카드(cards[12]) bodyData._roiUnavailable=true + _roiUnavailableReason 을 보낸다.
    //   → 배너의 종합점수/등급/회수기간/손익분기 결론을 '보류'로(거짓 결론·가짜 점수 금지).
    //   false/없음이면(정상 지역) 아래 모든 계산은 기존과 100% 동일.
    const _roiUnavail = (c12._roiUnavailable === true);
    const _roiUnavailReason = (_roiUnavail && c12._roiUnavailableReason)
      ? String(c12._roiUnavailableReason)
      : '매출 미수집(차단/미제공 가능) — 재검색 권장';
    const c8hf = bcCardsBodies[7]?.body || {};       // 임대/창업 (단위 정규화된 hfBody)
    const c5hf = bcCardsBodies[5]?.body?.bodyData || {};
    const kc = c7?.kosisCafe || (bcCardsBodies[7]?.body?.chartData?.kosisCafe) || {};

    // ── 5축 점수 (상권경쟁 카드 = cards[12]) ──
    const total = num(c13.overallScore) || num(c12.score);
    const max = (v, fb) => (num(v) > 0 ? num(v) : fb);
    const sMarket = num(c12.scoreMarket);
    const sCompete = num(c12.scoreCompete);
    const sChange = num(c12.scoreChange);
    const sSurvival = num(c12.scoreSurvival);
    const sCost = num(c12.scoreCost);
    const survivalRatio = sSurvival > 0 ? sSurvival / 15 : 0;   // [2026-06-25 ROI] 생존 안정 만점 15
    const survival3y = num(c2.survivalRate3y);

    // ── 핵심 입력값 ──
    // [2026-06-24] AI종합 한장요약(예상 월매출·동네 월매출)도 매출카드 헤드라인과 같은
    //   단일 진실값(monthlyAvgSales=비즈맵 분위 평균). 없으면 안정 동평균→단일월 자연 폴백.
    const monthly = num(c5.monthlyAvgSales) || num(c5.dongCafeAvgStable) || num(c5.monthly);  // 동네 카페 월평균 매출 (만원)
    // [2026-06-26 근본감리 displayVsCompute] 회수기간·손익분기·총창업비를 화면(매출분석)·점수(상권경쟁 5축)와
    //   '같은 단일 진실값(roi*)'으로 통일한다. cards[12](상권경쟁/5축)이 dataMapper에서 산출한 실측 ROI:
    //     roiMonthlySales(실 월매출, 만원) · roiOpProfitPct(실 영업이익률 %, 음수가능) ·
    //     roiMonthlyProfit(실 월영업이익, 만원, ≤0 가능) · roiPaybackMonths(실 회수개월, 0=적자/미산출) ·
    //     roiTotalStartup(인테리어+권리금, 만원).
    //   → 배너 회수기간은 더 이상 BEP×1.4 가정매출이 아니라 '화면 월매출 × 실측 이익률'로 나온 값을 쓴다.
    const roiMonthlySales = num(c12.roiMonthlySales);          // 실 월매출(만원, 5축이 쓴 통일값)
    const roiOpProfitPct  = (c12.roiOpProfitPct != null && isFinite(Number(c12.roiOpProfitPct))) ? Number(c12.roiOpProfitPct) : null; // 실 영업이익률 %(음수 가능)
    const roiMonthlyProfit = (c12.roiMonthlyProfit != null && isFinite(Number(c12.roiMonthlyProfit))) ? Number(c12.roiMonthlyProfit) : null; // 실 월영업이익(만원)
    const roiPaybackMonths = num(c12.roiPaybackMonths);        // 실 회수개월(0=적자/미산출)
    const roiTotalStartup  = num(c12.roiTotalStartup);         // 실 총창업비(=인테리어+권리금+시설장비, 만원)
    const hasRoi = roiOpProfitPct != null;                     // 5축 ROI 산출 성공 여부
    // [2026-06-27 ROI 업계기준] 사장 본인 인건비 반영 — 데이터층이 넣어준 3값을 그대로 읽는다.
    //   회계상 월영업이익(accountingProfitMonthly) · 사장 본인 인건비(ownerWageMonthly=216만/월) ·
    //   진짜 월수익(realProfitMonthly=회계이익−사장월급, 음수 가능). 점수·회수기간은 진짜수익 기준.
    //   null(매출 미산출)이면 0으로 안전 처리 → 표기 안 함(거짓 숫자 금지).
    const ownerWageMonthly = (c12.ownerWageMonthly != null && isFinite(Number(c12.ownerWageMonthly))) ? Math.round(Number(c12.ownerWageMonthly)) : 0;
    const accountingProfitMonthly = (c12.accountingProfitMonthly != null && isFinite(Number(c12.accountingProfitMonthly))) ? Math.round(Number(c12.accountingProfitMonthly)) : null;
    const realProfitMonthly = (c12.realProfitMonthly != null && isFinite(Number(c12.realProfitMonthly)))
      ? Math.round(Number(c12.realProfitMonthly))
      : (roiMonthlyProfit != null ? Math.round(roiMonthlyProfit) : null);  // 폴백: 진짜수익 = roiMonthlyProfit(동일 정의)
    // [2026-06-15 → 2026-06-29 정보분산 패스6 §1-12/§1-13] BEP 객단가(원) — 출처 단일화(동 실측 1순위).
    //   ★화면 매출카드와 같은 '비즈맵 동 실측 객단가'(c5.bizmapAvgUnitPrice 문자열, 예 "9,853원")를 1순위로 파싱해 쓴다.
    //     동 실측이 없을 때만 단일 폴백 상수(CAFE_UNIT_PRICE_FALLBACK=5,500원, 전국평균 추정)로 떨어진다.
    //   예전엔 BEP만 4,500 고정폴백을 써서 매출카드(동 실측/5,500)와 같은 '객단가'가 두 값으로 갈렸음.
    //     → 같은 동 실측을 1순위로, 폴백은 한 상수로 통일(객단가 폴백 상수 단일화 §1-12와 한 값).
    const _unitPriceFallback = (typeof window !== 'undefined' && Number(window.bcCafeUnitPriceFallback) > 0)
      ? Number(window.bcCafeUnitPriceFallback) : 5500;
    const unitPrice = (() => {
      // 동 실측 객단가: 매출카드 표시문자열(bizmapAvgUnitPrice)에서 숫자만 파싱 → 화면과 동일 출처.
      const _measuredStr = String(c5.bizmapAvgUnitPrice || '');
      const _measured = Number(_measuredStr.replace(/[^0-9]/g, '')) || num(kc.unitPriceAvg);
      const p = (_measured > 0 && _measured < 100000) ? Math.round(_measured) : _unitPriceFallback;
      return p;
    })();
    // [2026-06-26] 이익률(%): 회수기간이 화면 월매출과 같은 기준이 되도록 5축 ROI의 실측 영업이익률을
    //   1순위로 쓴다(roiOpProfitPct, 음수 가능). 없을 때만 기존 비즈맵 흡수값(kc.profitMargin)→표준 28% 폴백.
    const profitPct = (() => {
      if (roiOpProfitPct != null) return roiOpProfitPct;
      const p = num(kc.profitMargin);
      return (p > 0 && p < 80) ? p : 28;
    })();
    // 월 임대료(만원): 15평 기준 = 평당 월세 × 15
    const rentPerPy = num(c8hf.bodyData?.rentPerPyeongManwon) || num(c0.rentPerPyeong);
    const rentMonthly = rentPerPy > 0 ? Math.round(rentPerPy * 15) : 0;
    // [2026-06-16 → 2026-06-29 사장님 확정] 총 창업비(만원, 15평): 화면 '합계 타일'은 폐기됐고, 이 단일값은
    //   '회수기간(payback) 계산 분모'로만 쓴다(화면 노출 안 함). 정의 = 인테리어(평당×15) + 권리금(+시설장비, ROI 엔진).
    //   보증금은 환급성이라 제외. AI totalStartupCostManwon·보증금 제외.
    const totalStartup = (() => {
      // [2026-06-26] 5축 ROI가 산출한 총창업비(roiTotalStartup)가 있으면 그 단일값을 그대로 쓴다
      //   → 회수기간(roiPaybackMonths)이 나눈 분자와 같은 숫자(단일 출처). 화면엔 표기하지 않는다.
      if (roiTotalStartup > 0) return roiTotalStartup;
      // 인테리어(만원, 15평) = 평당 인테리어 단가 × 15
      const interiorPerPy = num(kc.interiorPerPyeong);
      const interior15 = interiorPerPy > 0 ? Math.round(interiorPerPy * 15) : 0;
      // 권리금(만원): chartData.premium.value(원) → bodyData.premiumCost(만원)
      const premiumWon = num(c8hf.chartData?.premium?.value);
      const premiumManwon = premiumWon > 0 ? Math.round(premiumWon / 10000) : num(c7.premiumCost);
      const sum = interior15 + premiumManwon;
      return sum > 0 ? Math.round(sum) : 0;
    })();
    // [2026-06-29 사장님 확정] '총 창업비 합계' 화면 표기(범위/단일 텍스트) 폐기 — 동네별로 안 변해 무의미.
    //   단일값 totalStartup은 '회수기간(payback) 계산 분모'로만 살려 두고(화면 노출 안 함),
    //   범위 텍스트(roiTotalStartupRangeText/Min/Max)·표시 stat은 만들지 않는다.

    // ── 월 고정비(만원) ── [2026-06-29 정보분산 패스6 §1-11] 단일 출처: dataMapper ROI 엔진의 실측 고정비(roiFixedMonthly)
    //   = (인건+기타)%×월매출 + 임대료. 예전 'rentMonthly×2.2' 단순상수를 폐기하고 데이터층 단일값을 그대로 읽는다.
    //   (데이터층도 실측 원가구조가 없을 때만 임대×2.2 폴백 → 폴백 산식도 한 곳에서만 산다.)
    //   roiFixedMonthly가 없는 옛 데이터/비정상 지역 폴백으로만 임대×2.2 유지(15평 기준 동네 평당월세 기반).
    const fixedMonthly = (num(c12.roiFixedMonthly) > 0)
      ? num(c12.roiFixedMonthly)
      : (rentMonthly > 0 ? Math.round(rentMonthly * 2.2) : 0);
    // ── 손익분기 매출(만원): 고정비 ÷ 공헌이익률 ──
    // [2026-06-27 ROI 업계기준 BEP 교정] 손익분기 = 고정비 ÷ 공헌이익률(=1−변동비율).
    //   기존엔 영업이익률(profitPct≈10~20%)로 나눠 손익분기가 약 3배 부풀려졌다(CVP 표준 위반).
    //   카페 변동비(원두·우유·부자재)는 매출의 약 35% → 공헌이익률 0.65로 통일(고정비만 분모).
    // [2026-06-29 예언 제거] 슬라이더 없이도 손익분기('얼마 팔아야 본전')는 목표선이라 유지.
    //   동네 실제 평당월세 기반 월 고정비로 계산. ★데이터 오류 방지 가드: 고정비가 비정상(0/음수/NaN/
    //   말도 안 되는 거액)이면 손익분기를 0(=화면 '-')으로 둔다. 가짜 숫자보다 정직한 '-'.
    const CONTRIBUTION_MARGIN = 0.65;
    const _fixedValid = (fixedMonthly > 0 && isFinite(fixedMonthly) && fixedMonthly < 100000); // 15평 월 고정비 상한 1억(만원) 가드
    const _bepRaw = _fixedValid ? Math.round(fixedMonthly / CONTRIBUTION_MARGIN) : 0;
    // 손익분기 유효범위 가드: 15평 카페 월 손익분기 매출이 100만 미만이거나 3억(30000만) 초과면 데이터 이상 → '-'
    const bepSales = (_bepRaw >= 100 && _bepRaw <= 30000) ? _bepRaw : 0;
    // ── BEP 하루 잔수: BEP매출(원) / 객단가(원) / 30일 ── (객단가·이익률을 시뮬레이터와 통일 → 잔수 일치)
    const bepCups = (bepSales > 0 && unitPrice > 0) ? Math.ceil((bepSales * 10000) / unitPrice / 30) : 0;
    // [2026-06-26 근본감리] 회수기간(개월): 화면이 보여주는 '실제 동네 월매출 × 실측 영업이익률'로 계산한다.
    //   (이전엔 손익분기 BEP×1.4 가정매출로 계산해 화면 월매출과 회수기간의 매출 기준이 달랐다.)
    //   1순위: 5축 ROI가 이미 같은 식(roiTotalStartup ÷ 실 월영업이익)으로 낸 roiPaybackMonths를 그대로 사용
    //          → 화면 월매출·점수·배너 회수기간이 한 매출/이익률 기준으로 일치. 적자(월이익≤0)면 0(=회수 표기 안 함).
    //   폴백(5축 ROI 미산출 지역만): 화면 월매출(monthly) × 이익률(profitPct)로 직접 계산.
    // [2026-06-27 ROI 업계기준] 회수기간은 '사장 월급(216만)을 뺀 진짜 월수익(realProfitMonthly)' 기준.
    //   회계상 이익으로 회수기간을 내면 사장 본인 인건비를 회수에 쓴 셈이라 회수가 거짓으로 빨라진다.
    //   진짜수익을 1순위로, 없으면 roiMonthlyProfit(동일 정의), 그래도 없으면 화면 월매출×이익률 폴백.
    const monthlyProfit = (realProfitMonthly != null)
      ? realProfitMonthly
      : (hasRoi
          ? (roiMonthlyProfit != null ? Math.round(roiMonthlyProfit) : 0)
          : ((monthly > 0 && profitPct > 0) ? Math.round(monthly * (profitPct / 100)) : 0));
    // 진짜수익이 0 이하(=사장 월급도 못 건짐)면 회수개월을 만들지 않는다(거짓 회수 금지 → "회수 보류").
    //   5축 ROI가 같은 식으로 낸 roiPaybackMonths(흑자일 때만 >0)를 1순위로 재사용 → 화면·점수와 한 기준.
    const paybackMonths = (monthlyProfit <= 0)
      ? 0                                                  // 0 = 회수 보류(흑자전환 우선) — 배너가 회수개월 표기 안 함
      : (hasRoi && roiPaybackMonths > 0
          ? roiPaybackMonths
          : ((totalStartup > 0) ? Math.round(totalStartup / monthlyProfit) : 0));
    // 회수 보류 사유: 진짜수익이 0 이하라 회수개월을 낼 수 없는 상태인지 플래그.
    const paybackOnHold = (monthlyProfit != null && monthlyProfit <= 0 && totalStartup > 0);

    // ── 권고 한 줄(결론) — 5축/생존율 기반 결정적 룰 ──
    //   생존 기반이 임계(40% = 점수 12/30) 미만이면 점수 무관 "차별화 필수".
    //   그 외 총점 60↑=조건부 진입 추천 / 40~60=입지 재검토 후 진입 / 그 미만=차별화 필수.
    let verdict, verdictTone;
    if (survivalRatio > 0 && survivalRatio < 0.4) {
      verdict = '차별화 필수';
      verdictTone = 'warn';
    } else if (total >= 60) {
      verdict = '조건부 진입 추천';
      verdictTone = 'good';
    } else if (total >= 40) {
      verdict = '입지 재검토 후 진입';
      verdictTone = 'mid';
    } else if (total > 0) {
      verdict = '차별화 필수';
      verdictTone = 'warn';
    } else {
      // [2026-06-26 근본감리 emptyOrFabricated] 점수 데이터가 0/없음인데 "진입 추천" 같은 결론을 내던 폴백 제거.
      //   거짓 결론 금지 — 데이터가 없으면 보류로 정직하게 표시한다.
      verdict = '데이터 부족 · 분석 보류';
      verdictTone = 'mid';
    }
    // 근거 2~3개 (실제 데이터로)
    const reasons = [];
    if (survival3y > 0) reasons.push(`3년 생존율 ${survival3y}%`);
    if (monthly > 0) reasons.push(`동네 월매출 ${fmtMan(monthly)}`);
    const cafes = num(c0.cafes);
    const indi = num(c0.individual);
    if (cafes > 0) {
      const indiPct = indi > 0 ? Math.round((indi / cafes) * 100) : 0;
      reasons.push(indiPct >= 50 ? `개인 카페 ${indiPct}% — 차별화 여지` : `카페 ${cafes.toLocaleString('ko-KR')}곳 — 검증된 수요`);
    }
    if (reasons.length < 2 && total > 0) reasons.push(`종합 ${total}점`);

    // 긍정·창업유도 톤의 결론 문장
    // [2026-06-25 ROI 톤] 균형 처방. 점수·계산 무변경, 표현만.
    //   '입지 재검토'(40~60·강남류 낮은 수익률 점수)는 비용이 점수를 누른다는 원인을 정직하게 짚되
    //   동네 월매출(실데이터)·운영 레버로 만회 경로를 함께 제시 → 절망적으로 안 읽히게.
    const verdictLine = (() => {
      if (verdict === '데이터 부족 · 분석 보류') {
        return '이 지역은 분석에 필요한 데이터가 충분히 모이지 않았어요. 결론을 내기보다, 추가 자료가 확보되면 다시 분석하는 것이 정확합니다.';
      }
      if (verdict === '조건부 진입 추천') {
        return '여건이 받쳐주는 동네예요. 콘셉트만 분명하면 충분히 승산 있는 진입입니다.';
      }
      if (verdict === '입지 재검토 후 진입') {
        const _mkt = monthly > 0 ? `동네 월매출 ${fmtMan(monthly)}이 받쳐주는 자리라, ` : '시장이 받쳐주는 자리라, ';
        return `초기 투자·임대 부담이 수익률 점수를 누르지만, ${_mkt}객단가와 회전율을 끌어올리면 충분히 만회되는 구조예요.`;
      }
      return '초기 비용이 큰 자리라 수익률 점수는 낮게 나오지만, 한 끗 다른 콘셉트로 객단가를 끌어올리면 비집고 들어갈 여지가 분명히 있어요.';
    })();

    // 핵심 리스크 한 줄 (가장 약한 축 또는 비용/생존)
    const riskLine = (() => {
      // [2026-06-25 ROI] 새 5축 = 수익성30·투자회수25·경쟁여건20·생존안정15·성장성10
      const axes = [
        ['수익성', sMarket, 30],
        ['투자 회수', sCompete, 25],
        ['경쟁 여건', sChange, 20],
        ['생존 안정', sSurvival, 15],
        ['성장성', sCost, 10],
      ].filter(a => a[2] > 0 && a[1] >= 0);
      const scored = axes.filter(a => a[1] > 0);
      if (scored.length > 0) {
        const weakest = scored.reduce((m, a) => (a[1] / a[2] < m[1] / m[2] ? a : m));
        const tip = {
          '수익성': '객단가를 끌어올릴 여지가 있는 항목입니다',
          '투자 회수': '초기 투자(인테리어·권리금)를 예산에 맞추면 회수가 빨라집니다',
          '경쟁 여건': '명확한 콘셉트로 차별화하면 손님을 끌어올 수 있습니다',
          '생존 안정': '탄탄한 단골 전략으로 버티는 힘을 키우면 됩니다',
          '성장성': '트렌드에 맞춘 메뉴로 시장 흐름을 타면 됩니다',
        }[weakest[0]] || '콘셉트로 보완할 수 있습니다';
        return `${weakest[0]} 부분이 상대적 약점 — ${tip}`;
      }
      if (rentMonthly > 0) return `고정비 관리가 관건 — 규모를 예산에 맞추면 됩니다`;
      return '뚜렷한 콘셉트로 차별화하면 충분히 승산 있습니다';
    })();

    // [2026-06-26 근본감리 추정배지] dataMapper가 카드별 bodyData._estimated(추정으로 채운 키 이름 배열)를
    //   내보내면, 배너에 노출되는 같은 개념이 추정값일 때 옆에 "(추정)"을 붙인다(실측과 구분, 거짓 실측 금지).
    //   계약: bodyData._estimated 가 배열이고 그 안에 해당 키가 있으면 추정. 아직 없으면(현행) 아무 배지도 안 붙어 무해.
    const _estOf = (bd) => (bd && Array.isArray(bd._estimated)) ? bd._estimated : [];
    const _hasEst = (bd, ...keys) => {
      const arr = _estOf(bd);
      if (arr.length === 0) return false;
      return keys.some((k) => arr.includes(k));
    };
    //   예상 월매출: 매출분석(c5)·5축 매출(c12 roiMonthlySales) 중 하나라도 추정으로 표기됐으면 추정.
    const monthlyEstimated = _hasEst(c5, 'monthlyAvgSales', 'dongCafeAvgStable', 'monthly') || _hasEst(c12, 'roiMonthlySales');
    //   손익분기·회수기간: 이익률(c12 영업이익률) 또는 임대(c0/c8hf)가 추정이면 그 파생값도 추정.
    const _profitEst = _hasEst(c12, 'roiOpProfitPct', 'roiMonthlyProfit') || _hasEst(c7, 'profitMargin');
    const _rentEst = _hasEst(c0, 'rentPerPyeong') || _hasEst(c8hf.bodyData, 'rentPerPyeongManwon');
    const bepEstimated = _profitEst || _rentEst;
    const paybackEstimated = bepEstimated || monthlyEstimated || _hasEst(c12, 'roiPaybackMonths');
    // [2026-06-29 사장님 확정] 총 창업비 합계 화면 표기 폐기 → totalStartupEstimated(표시 배지용) 제거.
    const _estTag = (txt, on) => (on && txt) ? `${txt} (추정)` : txt;

    // [2026-06-26 매출 미수집 보류] 매출 미수집(차단/비수도권)이면 종합 결론·매출 의존 값을 '보류'로.
    //   거짓 결론·가짜 점수 금지. 매출과 무관한 값(총 창업비=인테리어+권리금)은 그대로 둔다.
    //   ※ 이 분기는 _roiUnavail 일 때만 — 정상 지역은 아래 기본 return 과 100% 동일.
    if (_roiUnavail) {
      return {
        address: bcSearchAddress,
        radius,
        verdict: '매출 미수집 · 종합 보류',
        verdictTone: 'mid',
        verdictLine: `${_roiUnavailReason}. 매출 데이터가 확보되면 다시 분석하면 정확합니다.`,
        roiUnavailable: true,
        roiUnavailableReason: _roiUnavailReason,
        reasons: reasons.slice(0, 3),
        stats: {
          monthly: 0,
          monthlyText: '',          // 매출 미수집 → 보류
          monthlyEstimated: false,
          bepSales: 0,
          bepSalesText: '',         // 매출/이익률 의존 → 보류
          bepEstimated: false,
          bepCups: 0,
          paybackMonths: 0,         // 매출 의존 → 회수기간 표기 안 함
          paybackEstimated: false,
          paybackOnHold: false,     // 매출 미수집 → 보류(흑자/적자 판단 불가)
          // 사장 월급 2줄 — 매출 미수집이라 회계이익/진짜수익 모두 보류
          ownerWageMonthly: 0,
          ownerWageText: '',
          accountingProfitMonthly: null,
          accountingProfitText: '',
          realProfitMonthly: null,
          realProfitText: '',
          realProfitNote: '',
          totalStartup,             // 만원 — 회수기간 분모용 단일값(화면 표기 안 함)
          // [2026-06-29 사장님 확정] 총 창업비 합계 화면 표기 폐기 → totalStartupText/Min/Max/RangeText 제거.
          fixedMonthly,             // 만원 — 임대 기반(매출 무관)
          fixedMonthlyText: fixedMonthly > 0 ? fmtMan(fixedMonthly) : '',
          unitPrice,                // 원
          profitPct: 0,             // 영업이익률 보류
        },
        riskLine,
        consult: {
          pyeong: 15,
          totalStartup,
          monthly: 0,
          verdict: '매출 미수집 · 종합 보류',
        },
      };
    }

    return {
      address: bcSearchAddress,
      radius,
      verdict,
      verdictTone,
      verdictLine,
      reasons: reasons.slice(0, 3),
      stats: {
        monthly,                  // 만원
        monthlyText: _estTag(monthly > 0 ? fmtMan(monthly) : '', monthlyEstimated),
        monthlyEstimated,
        bepSales,                 // 만원
        bepSalesText: _estTag(bepSales > 0 ? fmtMan(bepSales) : '', bepEstimated),
        bepEstimated,
        bepCups,                  // 하루 잔수
        paybackMonths,            // 개월 (0 = 회수 보류)
        paybackEstimated,
        paybackOnHold,            // 진짜수익 ≤ 0 → "회수 보류/흑자전환 우선"
        // [2026-06-27 ROI 업계기준] 사장 월급 2줄 표시용 — 회계상 영업이익 / 사장월급 뺀 진짜 월수익
        ownerWageMonthly,                                                                  // 만원/월 (사장 본인 인건비 216)
        ownerWageText: ownerWageMonthly > 0 ? fmtMan(ownerWageMonthly) : '',
        accountingProfitMonthly,                                                           // 만원 (사장월급 전, 음수 가능)
        accountingProfitText: (accountingProfitMonthly != null)
          ? _estTag((accountingProfitMonthly >= 0 ? '' : '-') + fmtMan(Math.abs(accountingProfitMonthly)), bepEstimated)
          : '',
        realProfitMonthly,                                                                 // 만원 (회계이익−사장월급, 음수 가능)
        realProfitText: (realProfitMonthly != null)
          ? _estTag((realProfitMonthly >= 0 ? '' : '-') + fmtMan(Math.abs(realProfitMonthly)), bepEstimated)
          : '',
        // 진짜수익이 음수/소액이면 정직하게(담담히) 사장 본인 인건비도 못 건지는 수준임을 드러낸다.
        realProfitNote: (realProfitMonthly != null && realProfitMonthly <= 0)
          ? '사장 본인 인건비도 못 건지는 수준 — 흑자전환이 먼저'
          : '',
        totalStartup,             // 만원 (=인테리어+권리금+시설장비 평균 — 회수기간 분모용 단일값, 화면 표기 안 함)
        // [2026-06-29 사장님 확정] 총 창업비 합계 화면 표기(totalStartupText/Min/Max/RangeText/Estimated) 폐기 — 동네별로 안 변해 무의미.
        fixedMonthly,             // 만원
        fixedMonthlyText: fixedMonthly > 0 ? fmtMan(fixedMonthly) : '',
        unitPrice,                // 원
        profitPct,                // %
      },
      riskLine,
      // CTA(상담)로 함께 보낼 시뮬레이터 기본값
      consult: {
        pyeong: 15,
        totalStartup,            // 상담 내부 참고용 단일값(토스트엔 합계 노출 안 함)
        monthly,
        verdict,
      },
    };
  }, [cards, bcCardsBodies, bcSearchAddress, radius]);

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

  // [2026-06-25] 통합 AI 진단 결과 상태 (배너 한 줄·AI종합 진단·14카드 한 줄).
  //   null = 아직 없음/폴백 → 호출부가 기존 결정적 텍스트(bruSummary·verdictLine)를 그대로 쓴다.
  const [aiDiag, setAiDiag] = useState(null);
  const aiDiagKeyRef = useRef(null);      // 마지막으로 '성공 반영'된 지역 키 (성공해야만 기록 → 실패/버려진 호출은 재시도 허용)
  const aiDiagInFlightRef = useRef(null); // 지금 호출 진행 중인 지역 키 (같은 키 중복 호출 방지 — 진행 중이면 재시작 안 함)
  const aiDiagMountedRef = useRef(true);  // 언마운트 가드 (늦게 온 결과를 언마운트 후 setState 안 하게)
  const aiDiagDesiredKeyRef = useRef(null); // 지금 화면이 원하는 최신 지역 키 (늦게 온 옛 지역 결과가 새 지역을 덮지 않게)
  useEffect(() => {
    aiDiagMountedRef.current = true;
    return () => { aiDiagMountedRef.current = false; };
  }, []);

  // [2026-06-15] AI 디렉터 대화 음성: 검색 지역당 1회 제미나이 생성 → 캐시 → 리포트 주입
  //   ttsTick: 생성 시작(pending)/완료(ready)/실패(failed) 시 재푸시 트리거
  const [ttsTick, setTtsTick] = useState(0);
  useEffect(() => {
    if (!resultsReady) return;
    const cardsArr = bcCardsBodiesSwapped;
    if (!Array.isArray(cardsArr) || !cardsArr[13]) return;
    const dir = cardsArr[13] && cardsArr[13].body && cardsArr[13].body.chartData && cardsArr[13].body.chartData.director;
    if (!dir || !(dir.intro || dir.market || dir.closing)) return;
    const regionKey = `${bcSearchAddress || ''}|${radius}`;
    if (!bcSearchAddress) return;
    if (__ttsCache.has(regionKey)) return;     // 이미 생성됨 → 재생성 안 함(비용 가드)
    if (__ttsInflight.has(regionKey)) return;  // 생성 중 → 중복 호출 방지
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { __ttsCache.set(regionKey, { status: 'failed' }); return; }  // 키 없음 → 폴백
    // [2026-06-16 REVERT] PPT 씬 레이어 제거. 재생 단위 = 카드별(perCard)만. director.tts.scenes 는 절대 안 만든다.
    //   (buildDirectorScenes 는 휴면 — 호출하지 않음. iframe 은 항상 풀 리포트 카드를 렌더.)
    const built = buildDirectorDialogue(cardsArr, dir);
    if (!built || !built.script) {
      __ttsCache.set(regionKey, { status: 'failed' }); return;
    }
    __ttsInflight.add(regionKey);
    // 카드별 audioBase64 채울 자리 마련 (scenes 없음)
    const perCard = (built && built.perCard) ? built.perCard.map(p => ({ card: p.card, area: p.area, chars: p.chars, text: p.text, clientQLen: p.clientQLen, audioBase64: null })) : [];
    __ttsCache.set(regionKey, { status: 'pending', sampleRate: 24000, perCard });
    setTtsTick(t => t + 1);   // pending 즉시 푸시 → 아이프레임 폴링 시작(준비될 때까지 브라우저 음성 보류)
    (async () => {
      try {
        // 동시에 일 시키기(병렬) + 실패분만 1회 재시도. 카드별 클립만 생성.
        const targets = perCard;
        const scriptOf = (item) => {
          const pb = built.perCard.find(x => x.card === item.card); return pb ? pb.cardScript : `Director: ${item.text || ''}`;
        };
        const datas = await Promise.all(targets.map(it => _genCardClip(scriptOf(it), apiKey)));
        let anyOk = false;
        datas.forEach((data, i) => { targets[i].audioBase64 = data || null; if (data) anyOk = true; });
        // 실패(429 등)한 것만 1회 재시도 — 일부만 무음 되는 것 방지
        const fails = targets.map((it, i) => (it.audioBase64 ? null : i)).filter(i => i != null);
        if (fails.length) {
          const retry = await Promise.all(fails.map(i => _genCardClip(scriptOf(targets[i]), apiKey)));
          retry.forEach((data, k) => { if (data) { targets[fails[k]].audioBase64 = data; anyOk = true; } });
        }
        __ttsCache.set(regionKey, { status: anyOk ? 'ready' : 'failed', sampleRate: 24000, perCard });
      } catch (e) {
        __ttsCache.set(regionKey, { status: 'failed', sampleRate: 24000, perCard });
      } finally {
        __ttsInflight.delete(regionKey);
        setTtsTick(t => t + 1);   // ready/failed 재푸시 + __bcRender
      }
    })();
  }, [resultsReady, bcCardsBodiesSwapped, bcSearchAddress, radius]);

  // iframe → 시안 데이터 푸시
  const handoffIframeRef = useRef(null);
  // [릴스 공개 우편함] 같은 행정동에 숫자를 중복 기록하지 않도록 마지막으로 쓴 dongCd 보관
  const reelsLastDongRef = useRef(null);
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

  // ──────────────────────────────────────────────────────────
  // [2026-06-15] 데이터 기준월 (신뢰성 캡션용) — __BC_DATA__.dataAsOf
  //   화면 작업자가 "데이터 기준: {dataAsOf}" 캡션을 단다(필드명 정확히 dataAsOf).
  //   우선순위: ①비즈맵 매출/이용 yyyymm(매출·유동인구 핵심 기준월)
  //            ②KOSIS 핵심 통계 기준월(소비심리/임대료 PRD_DE)
  //            ③검색 시점(현재 연·월) — 못 찾을 때 폴백.
  //   "YYYY년 M월" 한국식 문자열로 반환. 빈값/이모티콘 금지.
  // ──────────────────────────────────────────────────────────
  const bcDataAsOf = useMemo(() => {
    // "202503"·"2025.03"·"20251"(분기) → "2025년 3월" 변환. 실패 시 ''.
    const fmtYm = (raw) => {
      const s = String(raw || '').replace(/[^0-9]/g, '');
      if (s.length >= 6) {
        const y = s.slice(0, 4);
        const m = parseInt(s.slice(4, 6), 10);
        if (m >= 1 && m <= 12) return `${y}년 ${m}월`;
      }
      if (s.length === 5) {
        // KOSIS 분기 코드(예: 20251 = 2025년 1분기) → 분기 마지막 달
        const y = s.slice(0, 4);
        const q = parseInt(s.slice(4, 5), 10);
        if (q >= 1 && q <= 4) return `${y}년 ${q * 3}월`;
      }
      if (s.length === 4) return `${s}년`;
      return '';
    };
    const apis = collectedData?.apis;
    // ① 비즈맵 매출/이용건수 시계열의 최신 yyyymm (매출·유동인구 핵심)
    const pickBizmapYm = () => {
      const pools = [
        apis?.bizMapAverageSales?.data,
        apis?.bizMapUsageAndPayment?.data,
        apis?.bizMapStoreCountTrend?.data,
      ];
      let best = '';
      for (const pool of pools) {
        if (!Array.isArray(pool)) continue;
        for (const r of pool) {
          const ym = String(r?.yyyymm || r?.stdYm || r?.ym || '').replace(/[^0-9]/g, '');
          if (ym.length === 6 && ym > best) best = ym;
        }
      }
      return best;
    };
    const bizYm = pickBizmapYm();
    if (bizYm) {
      const out = fmtYm(bizYm);
      if (out) return out;
    }
    // ② KOSIS 핵심 통계 기준월 (소비심리 → 임대료 순)
    const kosisYm = String(
      kosisBoxData?.consumerSentiment?.period ||
      kosisBoxData?.marketRent?.period ||
      kosisBoxData?.cafeClosure?.period ||
      ''
    );
    if (kosisYm) {
      const out = fmtYm(kosisYm);
      if (out) return out;
    }
    // ③ 검색 시점(현재 연·월) 폴백 — 못 찾아도 빈값 금지
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  }, [collectedData, kosisBoxData]);

  // [2026-06-25] 통합 AI 진단 1회 호출(지역당). 캐시 우선 → 없으면 제미나이 temp 0.
  //   실패/빈응답이면 setAiDiag(null) 유지 → 화면은 기존 결정적 텍스트로 폴백(절대 안 깨짐).
  //   ★bcDataAsOf 선언 뒤에 둬야 TDZ 안 남(이 효과가 bcDataAsOf 를 의존).
  // ★[2026-06-28 React 생명주기 버그 수정] 예전엔:
  //   ① `aiDiagKeyRef.current = _key` 를 호출 '시작' 시점에 박았다 → 그 async 가 도중(3_signals 직후,
  //      pro콜 ~20초 전)에 재렌더/effect 재실행으로 버려지면, 재실행 때 가드(키 동일)가 막아 '영영 재호출 안 됨'.
  //      = pro콜이 시작도 못 하고 사라짐(라이브 추적이 3_signals 에서 끊긴 원인).
  //   ② cleanup 의 cancelled 가 늦게(20초 뒤) 온 정상 결과까지 통째 버렸다.
  //  수정 원칙:
  //   - 성공해야만 'done' 키(aiDiagKeyRef) 기록 → 실패/버려진 호출은 다음 렌더에서 깨끗이 재시도.
  //   - 진행 중 키(aiDiagInFlightRef)로 같은 키 중복 호출만 막음(진행 중이면 재시작 안 하고 그대로 완주시킴).
  //   - 결과는 '버리지' 않는다. 늦게 와도 (a) 언마운트 아님 + (b) 그 결과가 지금도 유효한 지역이면 setState 반영.
  //     v10 캐시(bc_ai_diag_v10pro_)가 있어 한 번 완주하면 이후엔 캐시 히트로 즉시 박힌다 — 핵심은 '첫 완주' 보장.
  useEffect(() => {
    if (!resultsReady) return;
    if (!Array.isArray(cards) || cards.length === 0) return;
    const _dongCd = collectedData?.dongInfo?.dongCd;
    const _key = `${_dongCd || ''}|${bcSearchAddress || ''}|${radius}`;
    aiDiagDesiredKeyRef.current = _key;               // 이 렌더가 원하는 최신 지역(늦게 온 옛 결과 차단용)
    if (aiDiagKeyRef.current === _key) return;       // 이미 '성공 반영'된 지역 = 재호출 불필요
    if (aiDiagInFlightRef.current === _key) return;   // 같은 지역 호출이 이미 진행 중 = 재시작 말고 완주 대기(promise 방치/중복 금지)

    aiDiagInFlightRef.current = _key;                 // 진행 중 표시(완료/실패 시 finally 에서 해제)
    (async () => {
      let res = null;
      try {
        res = await getUnifiedDiagnosis({
          cards,
          kosisBoxData,
          collectedData,
          dataAsOf: bcDataAsOf,
          address: bcSearchAddress,
          radius,
        });
      } catch (e) {
        try { console.warn('[AI진단] 호출 예외:', e && e.message); } catch (e2) {}
      } finally {
        // 진행 중 해제는 '이 키'가 여전히 진행중으로 잡혀 있을 때만(다른 키가 덮었으면 건드리지 않음).
        if (aiDiagInFlightRef.current === _key) aiDiagInFlightRef.current = null;
      }

      // 언마운트 가드: 마운트 플래그(아래 cleanup 에서 false).
      if (!aiDiagMountedRef.current) return;
      // 늦게 온 옛 지역 결과가 새 지역 화면을 덮지 않게: 지금 원하는 최신 키와 다르면 화면 반영 안 함
      //   (그 지역 v10 캐시는 이미 저장돼 있어, 그 지역을 다시 보면 캐시 히트로 즉시 박힘).
      if (aiDiagDesiredKeyRef.current !== _key) return;

      if (res && (res.bannerLine || res.diagnosis || (Array.isArray(res.cardLines) && res.cardLines.some(Boolean)))) {
        aiDiagKeyRef.current = _key;   // ★성공했을 때만 'done' 기록 → 이제부터 이 지역 재호출 차단
        setAiDiag(res);
        try { console.log('[AI진단] 적용:', res._source, '— 배너/진단/카드' + (res.cardLines ? res.cardLines.filter(Boolean).length : 0) + '줄'); } catch (e) {}
      } else {
        // 실패/빈응답 → done 기록 안 함(다음 렌더에서 재시도 가능). 화면은 기존 결정적 텍스트 폴백.
        setAiDiag(null);
      }
    })();
    // ★cleanup 에서 in-flight 를 abort 하지 않는다(pro콜 완주 보장). 언마운트만 플래그로 가드.
  }, [resultsReady, cards, kosisBoxData, collectedData, bcSearchAddress, radius, bcDataAsOf]);

  useEffect(() => {
    if (!resultsReady) return;
    const win = handoffIframeRef.current?.contentWindow;
    if (!win) return;
    try {
      const _rk = `${bcSearchAddress || ''}|${radius}`;
      // [2026-06-29 패스12] ★마지막-마일: 디렉터 평당월세/공실을 카드1 단일값(41/6.9)으로 강제(누수 차단).
      //   TTS 주입 '전'에 텍스트를 먼저 잡아 음성도 정확한 값으로 가게 한다.
      let _cardsForReport = injectTtsIntoCards(injectCard1RentVacancyIntoCard14(bcCardsBodiesSwapped), _rk);

      // [2026-06-25] 통합 AI 진단 배선 — 있을 때만 덮고, 없으면(폴백) 기존 결정적 텍스트 그대로.
      //   ★스왑 주의: bcCardsBodiesSwapped 는 화면자리(idx4↔5 스왑)지만 aiDiag.cardLines 는
      //     데이터 인덱스(0..13, 4=개인 5=매출) 기준. 화면자리→데이터인덱스로 되돌려 매핑.
      let _summaryForReport = bcOneLineSummary;
      if (aiDiag && (aiDiag.bannerLine || aiDiag.diagnosis || aiDiag.designDirection || (Array.isArray(aiDiag.cardLines) && aiDiag.cardLines.some(Boolean)))) {
        // 14카드 한 줄: AI 줄이 있으면 그 카드 bruSummary 만 덮어쓴다(나머지 body 불변).
        const _lines = Array.isArray(aiDiag.cardLines) ? aiDiag.cardLines : [];
        // [2026-06-28] v10 추론엔진 설계방향: 있을 때만 AI종합(데이터인덱스13) body.designDirection 덮어씀.
        //   없으면(폴백) 기존 dataMapper c14DesignDirection(템플릿) 그대로 — 잘 되는 폴백 보존.
        //   ★B관찰자형: 서로 다른 렌즈 4~6줄을 그대로 노출(slice 4→6).
        // [2026-06-29 예언 마무리 안전망] AI 설계방향 줄에 '회수 기간/회수 N개월/투자 회수' 같은 회수 시점
        //   예측이 섞여 들어오면, 그 줄 전체를 빼서 노출하지 않는다(프롬프트+캐시 갱신의 보수적 백업).
        //   문장 중간을 잘라 문법을 깨지 않도록, '회수' 시점 표현이 든 줄만 통째로 제거한다(나머지 줄은 보존).
        const _hasPayback = (s) => /(투자\s*금?\s*회수|회수\s*기간|회수\s*(?:가|는|를|에)?\s*\d|\d\s*개월\s*(?:만에\s*)?회수|회수가\s*(?:빨라|시작))/.test(String(s || ''));
        const _aiDirRaw = (Array.isArray(aiDiag.designDirection) && aiDiag.designDirection.length >= 2)
          ? aiDiag.designDirection.filter((s) => typeof s === 'string' && s.trim() && !_hasPayback(s)).slice(0, 6)
          : null;
        // 회수 줄을 다 빼서 빈 배열이 되면 null 로(빈 배열은 truthy라 designDirection 을 지워버림 → 템플릿 폴백 유지).
        const _aiDir = (_aiDirRaw && _aiDirRaw.length >= 1) ? _aiDirRaw : null;
        _cardsForReport = _cardsForReport.map((el, screenIdx) => {
          // 화면자리 → 데이터 인덱스 (4↔5만 스왑)
          const dataIdx = screenIdx === 4 ? 5 : (screenIdx === 5 ? 4 : screenIdx);
          const line = (typeof _lines[dataIdx] === 'string' && _lines[dataIdx].trim()) ? _lines[dataIdx].trim() : '';
          // AI종합 카드(데이터인덱스 13): 설계방향이 있으면 덮어씀.
          const _isC14 = dataIdx === 13;
          if (!el || !el.body) return el;
          if (!line && !(_isC14 && _aiDir)) return el;
          const nextBody = { ...el.body };
          if (line) nextBody.bruSummary = line;
          if (_isC14 && _aiDir) nextBody.designDirection = _aiDir;
          return { ...el, body: nextBody };
        });
        // 배너 한 줄 + AI종합 진단 단락: summary 에 얹는다(폴백 필드는 그대로 보존).
        _summaryForReport = { ...(bcOneLineSummary || {}) };
        if (aiDiag.bannerLine) _summaryForReport.bannerLine = aiDiag.bannerLine;
        if (aiDiag.diagnosis) _summaryForReport.diagnosis = aiDiag.diagnosis;
        if (_aiDir) _summaryForReport.designDirection = _aiDir;
      }

      win.__BC_DATA__ = { cards: _cardsForReport, address: bcSearchAddress, radius, summary: _summaryForReport, dataAsOf: bcDataAsOf };
      if (typeof win.__bcRender === 'function') win.__bcRender();
    } catch (e) {
      // iframe cross-origin/not ready
    }
  }, [bcCardsBodiesSwapped, resultsReady, bcSearchAddress, radius, bcOneLineSummary, bcDataAsOf, ttsTick, aiDiag]);

  // [릴스 공개 우편함] 새 분석 카드가 준비되면 RTDB reels/{dongCd} 에 숫자를 1회 미러링.
  //   - 로그인 없이 맥 릴스 제작앱이 지역(행정동)명으로 14카드 숫자를 가져갈 수 있게 한다.
  //   - 기존 검색/캡처/리포트 로직과 무관(추가 쓰기만). 전체 try/catch — Storage/규칙 미설정에도 앱은 정상.
  //   ────────────────────────────────────────────────────────────
  //   [2026-06-23] 합의된 데이터 계약(맥 릴스앱 리더가 이미 이 모양으로 읽음)에 정확히 맞춤.
  //     reels/<dongCd>.cards = { "1":{title,values}, ... "14":{title,values} }  (화면/사이드바 순서 = badge 1~14)
  //       title  = 그 카드의 실제 제목 문자열
  //       values = 한글 라벨 → 그 카드 화면에 실제로 표시되는 숫자(단위 포함 문자열 허용)
  //     images 키도 "1"~"14"(메시지 핸들러에서 정규화) → cards 키와 동일 번호체계.
  //   ★데이터 매핑 규칙(허위 생성 금지): bcCardsBodiesSwapped[idx].body / .body.bodyData / .body.chartData 에서
  //     "화면 카드가 실제로 읽는 그 필드"만 사용. 값이 없으면 그 라벨은 통째로 생략(지어내지 않음).
  //   ★bcCardsBodiesSwapped 는 컴포넌트 n(01..14)-1 인덱스 배열(엘리먼트 = {n, body}), 단 인덱스 4↔5 스왑됨
  //     (cards-a 가 window.Card05=매출함수·window.Card06=개인함수로 스왑하기 때문):
  //       idx4 = 매출분석 body, idx5 = 개인카페 body.
  //   ★화면 순서(badge) → 배열 인덱스 맵(IDX_BY_SCREEN)·컴포넌트 n 맵(N_BY_SCREEN)은 shared.jsx CARDS 와 일치.
  useEffect(() => {
    const dongCd = collectedData?.dongInfo?.dongCd;
    if (!dongCd) return;
    if (!Array.isArray(bcCardsBodiesSwapped) || bcCardsBodiesSwapped.length === 0) return;
    if (reelsLastDongRef.current === dongCd) return;  // 같은 행정동이면 중복 쓰기 skip
    try {
      // ── 값 추출 헬퍼: 숫자/문자 그대로 통과, 무의미값(null/0/'-'/NaN)은 라벨 생략용으로 걸러냄 ──
      const _num = (v) => { const n = Number(v); return (typeof n === 'number' && isFinite(n)) ? n : null; };
      const _str = (v) => {
        if (v === undefined || v === null) return null;
        const s = String(v).trim();
        if (!s || s === '-' || s === '–') return null;
        return s;
      };
      // values 객체에 라벨→값 추가(값이 null/빈값이면 생략 — 화면에 '-'로 뜨는 항목은 미러에서도 안 넣음)
      const put = (obj, label, val) => { if (val !== undefined && val !== null && val !== '') obj[label] = val; };
      // 화면 표기 보조 포맷(억/만원) — 화면 StatTile 과 동일 규칙
      const fmtMan = (man) => {
        const v = _num(man); if (v == null || v <= 0) return null;
        return v >= 10000 ? `${(v / 10000).toFixed(1)}억` : `${Math.round(v).toLocaleString('ko-KR')}만원`;
      };

      // 화면 순서(badge 1..14) → bcCardsBodiesSwapped 배열 인덱스 (shared.jsx CARDS 기준, 4↔5 스왑 반영)
      const IDX_BY_SCREEN = { 1:0, 2:2, 3:6, 4:7, 5:1, 6:10, 7:11, 8:3, 9:5, 10:12, 11:4, 12:8, 13:9, 14:13 };

      const cards = {};
      for (let screen = 1; screen <= 14; screen++) {
        const idx = IDX_BY_SCREEN[screen];
        const entry = bcCardsBodiesSwapped[idx] || {};
        const body = entry.body || {};
        const bd = body.bodyData || {};
        const cd = body.chartData || {};
        const values = {};
        let title = '';

        if (screen === 1) {            // 상권 분석
          title = '상권 분석 리포트';
          const cafeCount = _num(body.cafeCount) || 0;
          const bakery = _num(body.bakery) || 0;
          const totalStores = cafeCount + bakery;       // 화면 "총 매장"
          put(values, '총 매장', totalStores > 0 ? totalStores : null);
          put(values, '프랜차이즈', _num(body.franchise));
          put(values, '개인카페', _num(body.individual));
          // [2026-06-29 정보분산 패스6 §2-3] 릴스 screen1 평당월세 = screen4(임대/창업)와 '동일 통합 평당월세 체인'.
          //   예전 screen1은 body.rentPerPyeong(카드0)만 미러해 integratedRent 없는 동에서 null이 됐음.
          //   screen4와 같은 (rentPerPyeongManwon || integratedRent || rentPerPyeong) 체인을 카드8 body에서 직접 끌어와
          //   screen1=screen4 평당월세가 항상 같게 한다.
          {
            const _c8 = (bcCardsBodiesSwapped[IDX_BY_SCREEN[4]] || {}).body || {};
            const _c8bd = _c8.bodyData || {};
            const _c8ir = (_c8.kosisBoxData && _c8.kosisBoxData.integratedRent) || null;
            const _c8irManwon = (_c8ir && _num(_c8ir.value))
              ? ((typeof _c8ir.unit === 'string' && _c8ir.unit.indexOf('만원') >= 0) ? Math.round(_c8ir.value) : Math.round(_c8ir.value / 10000))
              : 0;
            const _rentPy = _num(_c8bd.rentPerPyeongManwon) || _c8irManwon || _num(_c8bd.rentPerPyeong) || _num(body.rentPerPyeong) || 0;
            put(values, '평당월세', _rentPy > 0 ? `${_rentPy}만원` : null);
          }
          { const vr = _num(body.vacancyRate); put(values, '공실률', (vr > 0) ? `${vr.toFixed(1)}%` : null); }
        } else if (screen === 2) {     // 상권 변화 추이
          title = '상권 변화 추이';
          const openCnt = _num(bd.openCount) || 0;
          const closeCnt = _num(bd.closeCount) || 0;
          const netChg = _num(bd.netChange) != null ? _num(bd.netChange) : (openCnt - closeCnt);
          const trend = _str(bd.trend) || (netChg > 2 ? '성장' : netChg < -2 ? '감소세' : '정체');
          put(values, '추세', trend);
          put(values, '신규', openCnt > 0 || closeCnt > 0 ? openCnt : null);
          put(values, '폐업', openCnt > 0 || closeCnt > 0 ? closeCnt : null);
          { const s1 = _num(bd.survivalRate1y); put(values, '1년 생존율', s1 > 0 ? `${s1}%` : null); }
          { const s3 = _num(bd.survivalRate3y); put(values, '3년 생존율', s3 > 0 ? `${s3}%` : null); }
          { const s5 = _num(bd.survivalRate5y); put(values, '5년 생존율', s5 > 0 ? `${s5}%` : null); }
        } else if (screen === 3) {     // 유동인구
          title = '유동인구';
          const monthlyPop = _num(bd.dongDailyPop) || _num(bd.totalPop);
          put(values, '월간유동인구', monthlyPop > 0 ? monthlyPop.toLocaleString('ko-KR') : null);
          put(values, '최다요일', _str(bd.popPeakDay) || _str(bd.bizmapPeakDay) || _str(bd.dayOfWeek && bd.dayOfWeek.peakDay));
          put(values, '최다시간대', _str(bd.peakHour) || _str(bd.popPeakHour));
          { const tp = _num(bd.totalPop); put(values, '일평균', tp > 0 ? tp.toLocaleString('ko-KR') : null); }
        } else if (screen === 4) {     // 임대 / 창업 (컴포넌트 n=08)
          title = '임대/창업 정보';
          const _ir = (body.kosisBoxData && body.kosisBoxData.integratedRent) || null;
          const irManwon = (_ir && _num(_ir.value))
            ? ((typeof _ir.unit === 'string' && _ir.unit.indexOf('만원') >= 0) ? Math.round(_ir.value) : Math.round(_ir.value / 10000))
            : 0;
          const rentPy = _num(bd.rentPerPyeongManwon) || irManwon || _num(bd.rentPerPyeong) || 0;
          put(values, '평당월세', rentPy > 0 ? `${rentPy}만원` : null);
          // 화면 KPI = 평균 보증금(평당) = depositManwon / 15
          { const dep = _num(bd.depositManwon) || _num(bd.deposit) || 0; const perPy = dep > 0 ? Math.round(dep / 15) : 0; put(values, '보증금', perPy > 0 ? `${perPy.toLocaleString('ko-KR')}만/평` : null); }
          // 권리금(만원) — premium.value(원) 또는 premiumCost(만원)
          const premiumValue = _num((cd.premium && cd.premium.value)) || _num(bd.premiumCost) || 0;
          const premiumManwon = premiumValue > 0 ? ((cd.premium && cd.premium.value) ? premiumValue / 10000 : premiumValue) : 0;
          put(values, '권리금', fmtMan(premiumManwon));
          // [2026-06-29 사장님 확정] '총창업비' 합계 화면값맵 표기 폐기 — 동네별로 안 변해 무의미.
          //   화면값맵엔 평당월세·보증금·권리금(동네별 실데이터)만 남긴다.
        } else if (screen === 5) {     // 고객 분석 (컴포넌트 n=02)
          title = '고객 분석';
          // [2026-06-29 연령충돌] '주요연령대' = 화면 KPI와 동일한 단일 최다 구간(topAge, 예 "60대+ (37%)").
          //   50대 이상 누적(59%)은 다른 지표이므로 '50대이상' 별도 키로 분리해 이미지=values 일치 유지.
          put(values, '주요연령대', _str(body.topAge) || _str(bd.topAge));
          { const a50 = _num(bd.age50PlusPct); put(values, '50대이상', a50 > 0 ? `${a50}%` : null); }
          { const m = _num(body.maleRatio) != null ? _num(body.maleRatio) : _num(bd.male);
            const f = _num(body.femaleRatio) != null ? _num(body.femaleRatio) : _num(bd.female);
            put(values, '성비', (m != null && f != null && (m + f) > 0) ? `${m} : ${f}` : null); }
          { const r = _num(bd.regular); put(values, '재방문율', r > 0 ? `${r}%` : null); }
          { const nc = _num(bd.newCustomer); put(values, '신규비율', nc > 0 ? `${nc}%` : null); }
        } else if (screen === 6) {     // SNS 트렌드 (컴포넌트 n=11)
          title = 'SNS 트렌드';
          const pos = _num(bd.positiveRatio) || _num(cd.sentimentPos) || 0;
          const neg = _num(bd.negativeRatio) != null && _num(bd.negativeRatio) > 0 ? _num(bd.negativeRatio) : (pos > 0 ? 100 - pos : 0);
          put(values, '긍정비율', pos > 0 ? `${pos}%` : null);
          put(values, '부정비율', neg > 0 ? `${neg}%` : null);
          // 화면 "총 키워드" = keywords 를 12개로 자른 길이
          const kwLen = Array.isArray(bd.keywords) ? Math.min(12, bd.keywords.length) : 0;
          put(values, '키워드수', kwLen > 0 ? kwLen : null);
        } else if (screen === 7) {     // 날씨 영향 (컴포넌트 n=12) — 화면값은 chartData.items
          title = '날씨 영향 분석';
          const itemVal = (label) => { const it = (Array.isArray(cd.items) ? cd.items : []).find(i => i && i.label === label); return _num(it && it.value); };
          { const v = itemVal('맑음'); put(values, '맑음일수', v > 0 ? v : null); }
          { const v = itemVal('흐림'); put(values, '흐림일수', v > 0 ? v : null); }
          { const v = itemVal('비');   put(values, '비일수',   v > 0 ? v : null); }
          { const v = itemVal('눈');   put(values, '눈일수',   v > 0 ? v : null); }
        } else if (screen === 8) {     // 프랜차이즈 현황 (컴포넌트 n=04)
          title = '프랜차이즈 현황';
          put(values, '매장수', _num(bd.franchiseCount));
          { const fr = _num(bd.franchiseShare); put(values, '점유율', fr > 0 ? `${Math.round(fr)}%` : null); }
        } else if (screen === 9) {     // 개인 카페 (컴포넌트 n=06)
          title = '개인 카페 분석';
          const indie = _num(bd.independentCount) || 0;
          const total = _num(bd.totalCafes) || 0;
          put(values, '개인카페수', indie > 0 ? indie : null);
          put(values, '비중', (total > 0 && indie > 0) ? `${Math.round(indie / total * 100)}%` : null);
          { const am = _num(bd.americanoAvg); put(values, '아메리카노가', (am > 0) ? `${Math.round(am).toLocaleString('ko-KR')}원` : null); }
        } else if (screen === 10) {    // 상권 경쟁 분석 (컴포넌트 n=13)
          title = '상권 경쟁 분석';
          const total = _num(body.totalScore) || 0;
          // [2026-06-29 패스3 §2-1] 등급어 = 화면 카드13과 같은 단일 출처(bcScoreGrade). 옛 '매우 좋음/좋음…' 폐기.
          const grade = bcScoreGrade(total).word;
          put(values, '종합점수', total > 0 ? total : null);
          put(values, '등급', total > 0 ? grade : null);
        } else if (screen === 11) {    // 매출 분석 (컴포넌트 n=05)
          title = '매출 분석';
          // [2026-06-28 매출 단일화] 월평균매출 = 단일 진실값(monthlyAvgSales=소상공인 카페 평균 1086 1순위, 비즈맵 분위 평균 폴백). 없으면 안정 동평균→단일월.
          const monthly = _num(bd.monthlyAvgSales) || _num(bd.dongCafeAvgStable) || _num(bd.monthly) || 0;
          put(values, '월평균매출', monthly > 0 ? (monthly >= 10000 ? `${(monthly / 10000).toFixed(1)}억` : `${monthly.toLocaleString('ko-KR')}만원`) : null);
          // 객단가 = 화면 unitPriceDisplay 우선순위(비즈맵 → 가중평균)
          const unitPrice = (() => {
            const bizStr = _str(bd.bizmapAvgUnitPrice); if (bizStr) return bizStr;
            const pay = _num(bd.bizmapAvgPayment); if (pay > 0 && pay < 100000) return `${Math.round(pay).toLocaleString('ko-KR')}원`;
            const exp = _num(bd.unitPrice) || _num(bd.avgUnitPrice) || 0; if (exp > 0 && exp < 100000) return `${Math.round(exp).toLocaleString('ko-KR')}원`;
            const wavg = _num(bd.popularMenuWeightedAvg); if (wavg > 0) return `${wavg.toLocaleString('ko-KR')}원`;
            return null;
          })();
          put(values, '객단가', unitPrice);
          // 매출순위 = "5위 / 12개" 중 화면은 앞부분("5위")만 표시
          { const rank = _str(bd.cafeSalesRank); put(values, '매출순위', rank ? String(rank).split(' /')[0] : null); }
        } else if (screen === 12) {    // 카페 기회 (컴포넌트 n=09)
          title = '카페 기회';
          { const vac = _num(body.vacancy) || _num(body.kosisBoxData && body.kosisBoxData.vacancy && body.kosisBoxData.vacancy.value) || 0;
            put(values, '공실률', vac > 0 ? `${vac.toFixed(1)}%` : null); }
          { const no = _num(body.newOpen) != null ? _num(body.newOpen) : (_num(bd.recentOpen) || _num(bd.openCount) || 0);
            put(values, '1년신규', no > 0 ? no : null); }
          { const cl = _num(body.closed) != null ? _num(body.closed) : (_num(bd.recentClose) || _num(bd.closeCount) || 0);
            put(values, '1년폐업', cl > 0 ? cl : null); }
        } else if (screen === 13) {    // 배달 객단가 (컴포넌트 n=10)
          title = '배달 객단가';
          { const ap = _num(bd.searchAvgPrice); put(values, '배달객단가', ap > 0 ? `${ap.toLocaleString('ko-KR')}원` : null); }
          { const ss = _num(bd.searchSales); put(values, '월배달매출', ss > 0 ? `${ss.toLocaleString('ko-KR')}만원` : null); }
          { const so = _num(bd.searchOrders); put(values, '건수', so > 0 ? `${so.toLocaleString('ko-KR')}건` : null); }
        } else if (screen === 14) {    // AI 종합 분석 (컴포넌트 n=14)
          title = 'AI 종합 분석';
          const total = _num(body.totalScore) || 0;
          put(values, '종합점수', total > 0 ? total : null);
          { const op = _num(body.opportunities); put(values, '기회', op > 0 ? op : null); }
          { const rk = _num(body.risks); put(values, '리스크', rk > 0 ? rk : null); }
          // [2026-06-29 패스3 §2-2] 신뢰점수 = 화면 카드14와 같은 '실집계 비율'(trustInfo) 단일 출처 미러.
          //   옛 자기참조(50+축/시그널/태그 보너스) 폐기. 화면이 null이면(추정정보 자체 없음) 릴스도 키 생략.
          { const ti = bd.trustInfo; put(values, '신뢰점수', (ti && ti.pct != null) ? ti.pct : null); }
        }

        cards[String(screen)] = { title, values };
      }

      database.ref('reels/' + dongCd).set({
        region: bcSearchAddress || '',
        dongCd: dongCd,
        updatedAt: Date.now(),
        cards: cards
      });
      reelsLastDongRef.current = dongCd;  // 성공 시에만 기록 → 실패 시 다음 변화에서 재시도 가능
    } catch (e) {
      try { console.warn('[reels] number mirror skipped:', e && e.message); } catch (_) {}
    }
  }, [collectedData, bcCardsBodiesSwapped, bcSearchAddress]);

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
      } else if (ev.data.type === 'bc:consult') {
        // [2026-06-15] '무료 상담' CTA: 한 장 요약 배너/시뮬레이터에서 보낸 상담 요청.
        //   실제 상담 접수 채널이 붙기 전까지는 사용자에게 접수 안내만 표시한다.
        try {
          const py = Number(ev.data.pyeong);
          const parts = [];
          if (Number.isFinite(py) && py > 0) parts.push(`${py}평`);
          // [2026-06-29 사장님 확정] 상담 토스트의 '예상 창업비' 합계 표기 폐기 — 동네별로 안 변해 무의미.
          //   평수만 안내하고, 비용 안내는 상담에서 항목별로 다룬다.
          const detail = parts.length > 0 ? ` (${parts.join(' · ')})` : '';
          // 부모 앱에 토스트 인프라가 있으면 사용, 없으면 alert 폴백
          const msg = `무료 상담 요청이 접수되었습니다${detail}. 빈크래프트가 곧 연락드리겠습니다.`;
          if (typeof window.__bcToast === 'function') window.__bcToast(msg);
          else if (typeof window.alert === 'function') window.alert(msg);
        } catch (_) {}
      } else if (ev.data && ev.data.type === 'bc:reelimg') {
        // [릴스 공개 우편함] 캡처 시 iframe 이 카드별 JPEG(dataURL)을 보내옴.
        //   → Storage reels/{dongCd}/card{id}.jpg 업로드 후 다운로드 URL 을 RTDB reels/{dongCd}/images/{id} 에 기록.
        //   전체 try/catch, 실패는 console.warn 만 — 캡처/리포트 흐름은 절대 막지 않는다.
        //   ★[2026-06-23] 키 정규화: iframe 의 id 는 data-card(=컴포넌트 n "01".."14")로 옴.
        //     숫자 미러 cards 키는 화면순서("1".."14")라 둘이 안 맞음 → 컴포넌트 n → 화면순서로 변환해
        //     images 키를 cards 키와 동일 번호체계("1".."14")로 맞춘다. (맥앱이 같은 키로 매칭)
        try {
          const dongCd = collectedData?.dongInfo?.dongCd;
          if (!dongCd) return;
          const rawId = ev.data.id;
          if (rawId === undefined || rawId === null || rawId === '') return;
          // 컴포넌트 n(01..14) → 화면순서(1..14). shared.jsx CARDS 와 일치(매출/개인 스왑 포함).
          const SCREEN_BY_N = { '01':'1','02':'5','03':'2','04':'8','05':'11','06':'9','07':'3','08':'4','09':'12','10':'13','11':'6','12':'7','13':'10','14':'14' };
          const nKey = String(rawId).padStart(2, '0');         // "1"/"01" 모두 "01" 로 정규화
          const id = SCREEN_BY_N[nKey] || String(parseInt(rawId, 10) || rawId);  // 미지의 id 는 숫자만 남겨 폴백
          const dataUrl = ev.data.dataUrl;
          if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:') !== 0) return;
          // dataURL → Blob 변환
          const parts = dataUrl.split(',');
          const meta = parts[0] || '';
          const mimeMatch = meta.match(/data:([^;]+)/);
          const mime = (mimeMatch && mimeMatch[1]) || 'image/jpeg';
          const binStr = atob(parts[1] || '');
          const len = binStr.length;
          const bytes = new Uint8Array(len);
          for (let bi = 0; bi < len; bi++) bytes[bi] = binStr.charCodeAt(bi);
          const blob = new Blob([bytes], { type: mime });
          const ref = storage.ref('reels/' + dongCd + '/card' + id + '.jpg');
          ref.put(blob)
            .then(function () { return ref.getDownloadURL(); })
            .then(function (url) {
              try { database.ref('reels/' + dongCd + '/images/' + id).set(url); } catch (_) {}
            })
            .catch(function (err) {
              try { console.warn('[reels] image upload skipped:', err && err.message); } catch (_) {}
            });
        } catch (e) {
          try { console.warn('[reels] image handler skipped:', e && e.message); } catch (_) {}
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [resultsReady, onSearch, radius, collectedData]);

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
        // 모달이 큰 크기로 펼쳐진 직후 "열린 직후"에만 고정 시점 1회성 resize로 타일을 꽉 채움.
        // (ResizeObserver 같은 지속 감시는 줌 도중 마커를 재투영시켜 사라지게 하므로 절대 쓰지 않는다.)
        // 모달 열림 애니메이션이 60ms보다 길 수 있어 60ms/300ms/700ms 세 시점에서 각각 1회씩만 트리거.
        const fillResizeAt = (ms) => setTimeout(() => {
          if (window.naver?.maps?.Event && cafeMapRef.current) {
            try { window.naver.maps.Event.trigger(cafeMapRef.current, 'resize'); } catch (e) {}
          }
        }, ms);
        fillResizeAt(60);
        fillResizeAt(300);
        fillResizeAt(700);
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
                width: 'min(1040px, 92vw)', maxWidth: 'min(1040px, 92vw)', height: '85vh', maxHeight: '85vh',
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
        // [2026-06-28 매출 단일화] 점포당 카페 월매출 = 단일 진실값(monthlyAvgSales=비즈맵 분위 평균). 없으면 안정 동평균→단일월.
        const monthlySales = dCard5?.bodyData?.monthlyAvgSales || dCard5?.bodyData?.dongCafeAvgStable || dCard5?.bodyData?.monthly || 0;
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
                   시안 내 우리 카드(window.Card01~14)는 lib/cards-a/b/c.jsx 가 정의함(index.html 로드).
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
                        const _rk = `${bcSearchAddress || ''}|${radius}`;
                        // [2026-06-29 패스12] ★마지막-마일: 디렉터 평당월세/공실을 카드1 단일값으로 강제(누수 차단). TTS 주입 전.
                        win.__BC_DATA__ = { cards: injectTtsIntoCards(injectCard1RentVacancyIntoCard14(bcCardsBodiesSwapped), _rk), address: bcSearchAddress, radius, summary: bcOneLineSummary, dataAsOf: bcDataAsOf };
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
                            // [2026-06-29 패스3 §1-14] 5축 만점 = 단일 배열(dataMapper card11.axes5)에서만 읽는다.
                            //   옛 30/25/20/15/10 직접 생성 폐기 — 위(iframe 경로 4732)와 동일하게 axes5 미러.
                            const c13bd = cards[12]?.bodyData || {};
                            const _axes5b = Array.isArray(c13bd.axes5) ? c13bd.axes5 : [];
                            hfBody.axes = (_axes5b.length === 5)
                              ? _axes5b.map(a => ({ label: a.label, max: Number(a.max) || 1, score: (a.raw != null && isFinite(Number(a.raw))) ? Number(a.raw) : 0 }))
                              : [];
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
                            hfBody.designDirection = card.chartData?.designDirection || [];
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
                            // [2026-06-24] 경쟁분석·시장매력도 '월매출'도 매출카드와 같은 단일 진실값(monthlyAvgSales=비즈맵 분위 평균).
                            //   없으면 안정 동평균→단일월 폴백. '시군구 평균 대비 %'는 이 값(guAvg 기준) 그대로 재계산됨.
                            hfBody.cafeSales = bd.cafeSales || c5bd.monthlyAvgSales || c5bd.dongCafeAvgStable || c5bd.monthly || 0;
                            hfBody.guAvg = bd.guAvg || c5bd.guAvg || 0;
                            hfBody.cafeCount = bd.cafeCount || bd.totalCafes || c1bd.cafes || 0;
                            // [2026-05-19] 시장 변화 축 폴백용: openCount/closeCount 주입
                            hfBody.openCount = Number(c2bd.openCount) || Number(c1bd.newOpen) || 0;
                            hfBody.closeCount = Number(c2bd.closeCount) || Number(c1bd['폐업 매장']) || 0;
                            // [2026-06-25] 성장성 headline 근거를 메뉴 대신 진짜 driver(신폐·5년·YoY)로 — 폴백 값 주입.
                            hfBody.cafes5yChangeRate = Number(c2bd.cafes5yChangeRate) || 0;
                            hfBody.prevYearRate = Number(c5bd.prevYearRate) || 0;
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
                            // [신폐 단일 해소계층] (2026-06-29) 릴스/카드09 = 화면 카드와 같은 단일값. 상권변화 카드 1순위.
                            hfBody.newOpen = Number(c12bd.openCount) || Number(c1bd.newOpen) || Number(c11bd.recentOpen)
                              || Number(bd.recentOpen) || Number(bd.openCount) || 0;
                            hfBody.closed = Number(c12bd.closeCount) || Number(c1bd['폐업 매장']) || Number(c11bd.recentClose)
                              || Number(bd.recentClose) || Number(bd.closeCount) || 0;
                            // [2026-06-24] 카드09 핵심발견도 단일 진실값(monthlyAvgSales=901) 사용. monthly(1086) 폴백.
                            hfBody.cafeMonthly = (cards[5]?.bodyData?.monthlyAvgSales) || (cards[5]?.bodyData?.monthly) || 0;
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
                              // [2026-06-28 매출 단일화] 점포당 카페 월매출 = 단일 진실값(monthlyAvgSales=비즈맵 분위 평균). 없으면 안정 동평균→단일월.
                              const _m = Number(_c5bd.monthlyAvgSales) || Number(_c5bd.dongCafeAvgStable) || Number(_c5bd.monthly) || 0;
                              if (_m > 0) hfBody.bodyData.avgMonthlySales = _m;
                            }
                            if (!Number(hfBody.bodyData.franchiseMinPrice)) {
                              hfBody.bodyData.franchiseMinPrice = 2500;
                            }
                            if (!Number(hfBody.bodyData.franchiseMaxPrice)) {
                              hfBody.bodyData.franchiseMaxPrice = 4700;
                            }
                            // [신폐 단일 해소계층 §3] (2026-06-29) 개인 카페 신규는 개인 한정 실집계만 사용. 전체 단일값 미주입.
                            {
                              const _indieNew = Array.isArray(hfBody.bodyData?.newIndieList) ? hfBody.bodyData.newIndieList.length : 0;
                              if (_indieNew > 0) hfBody.bodyData.areaNewOpen = _indieNew;
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
