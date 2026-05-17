import React from 'react';
import { motion } from 'framer-motion';
import { COLORS, BLUR } from '../constants';

// ─── AI Output Sanitizer (mirrors CardTemplate.jsx) ───
const sanitizeAiOutput = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\b_[a-zA-Z][a-zA-Z0-9_]*\b/g, '')
    .replace(/\[[^\]]*지시사항[^\]]*\]/g, '')
    .replace(/\[[^\]]*톤 지침[^\]]*\]/g, '')
    .replace(/\[[^\]]*필수 생성 규칙[^\]]*\]/g, '')
    .replace(/\[[^\]]*출력 금지 규칙[^\]]*\]/g, '')
    .replace(/\[[^\]]*현장 보정[^\]]*\]/g, '')
    .replace(/\|[-:]+\|[-:|\s]+/g, '')
    .replace(/^#{2,3}\s+.*$/gm, '')
    .replace(/buildCardPrompt/g, '')
    .replace(/AI_CHARACTER_PROMPT/g, '')
    .replace(/bruFeedback/g, '')
    .replace(/bruSummary/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const sanitizeEmoji = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/[\u{20E3}]/gu, '')
    .replace(/[\u{E0020}-\u{E007F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const extractFeedbackText = (text) => {
  if (!text || typeof text !== 'string') return text;
  if (!text.trim().startsWith('{')) return text;
  try {
    const parsed = JSON.parse(text);
    if (parsed.bruFeedback) return parsed.bruFeedback;
    if (parsed.insight?.bruFeedback) return parsed.insight.bruFeedback;
    if (parsed.feedback) return parsed.feedback;
    if (parsed.insight && typeof parsed.insight === 'string') return parsed.insight;
  } catch (e) { /* not JSON */ }
  return text;
};

// ─── Sparkles icon (inline SVG, no external dep) ───
const SparklesIcon = ({ size = 16, color = '#1E3A8A' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 1L9.2 5.2L13.4 6.4L9.2 7.6L8 11.8L6.8 7.6L2.6 6.4L6.8 5.2L8 1Z"
      fill={color}
    />
    <path d="M13 10L13.6 11.6L15.2 12.2L13.6 12.8L13 14.4L12.4 12.8L10.8 12.2L12.4 11.6L13 10Z" fill={color} />
    <path d="M3.5 11L3.9 12.1L5 12.5L3.9 12.9L3.5 14L3.1 12.9L2 12.5L3.1 12.1L3.5 11Z" fill={color} />
  </svg>
);

// ─── Map pin icon (matches outlined map glyph) ───
const MapIcon = ({ size = 16, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M15 19L9 17L3 19V5L9 3L15 5L21 3V17L15 19ZM15 19V5M9 17V3"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── Donut chart (SVG, matches Stitch spec) ───
// r=40, stroke-width=12 -> circumference = 2*PI*40 = 251.2
const CIRCUMFERENCE = 251.2;

const Donut = ({ segments = [] }) => {
  // Normalize to 0-100
  const total = segments.reduce((s, seg) => s + (seg.pct || 0), 0) || 100;

  let runningOffset = 0;
  const computed = segments.map((seg) => {
    const ratio = (seg.pct || 0) / total;
    const dash = ratio * CIRCUMFERENCE;
    const item = {
      ...seg,
      dash,
      dashArray: `${dash.toFixed(2)} ${CIRCUMFERENCE}`,
      dashOffset: -runningOffset,
    };
    runningOffset += dash;
    return item;
  });

  return (
    <div
      style={{
        position: 'relative',
        width: 'clamp(140px, 40vw, 180px)',
        height: 'clamp(140px, 40vw, 180px)',
        flexShrink: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* track */}
        <circle cx={50} cy={50} r={40} fill="transparent" stroke="#1b1b1b" strokeWidth={12} />
        {computed.map((seg, i) => (
          <circle
            key={i}
            cx={50}
            cy={50}
            r={40}
            fill="transparent"
            stroke={seg.color}
            strokeWidth={12}
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.dashOffset}
          />
        ))}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: '0.2em',
            color: '#B8B8B8',
            textTransform: 'uppercase',
            fontWeight: 500,
            fontFamily: 'Pretendard, sans-serif',
          }}
        >
          비율
        </span>
      </div>
    </div>
  );
};

const Legend = ({ segments = [] }) => {
  const total = segments.reduce((s, seg) => s + (seg.pct || 0), 0) || 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: seg.color,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 14, color: '#B8B8B8', fontWeight: 400, fontFamily: 'Pretendard, sans-serif' }}>
                {seg.name}
              </span>
            </div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 300,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                fontFamily: 'Pretendard, sans-serif',
              }}
            >
              {Math.round(((seg.pct || 0) / total) * 100)}%
            </span>
          </div>
          {i < segments.length - 1 && (
            <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.12)' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const MetricRow = ({ label, value, last }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 0',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.2)',
    }}
  >
    <span style={{ fontSize: 15, color: '#B8B8B8', fontFamily: 'Pretendard, sans-serif', fontWeight: 400 }}>
      {label}
    </span>
    <span style={{ fontSize: 15, color: '#FFFFFF', fontFamily: 'Pretendard, sans-serif', fontWeight: 500 }}>
      {value}
    </span>
  </div>
);

// ─── 미니 SVG 라인 차트 (다크모드 톤) ───
//   series: [{period, value}], height/width 작게
//   baseLine: 기준선 값 (예: 공실률 10, 임대가격지수 100). 옵션. 있을 때만 표시.
const MiniLineChart = ({ series = [], color = '#3B82F6', label = '', unit = '', latestValue = null, periodLabel = '', tone = 'up', baseLine = null }) => {
  if (!Array.isArray(series) || series.length === 0) return null;
  const values = series.map(s => Number(s.value) || 0);
  const periods = series.map(s => s.period || '');
  if (values.length < 2) return null;
  const w = 120, h = 40;
  const padX = 4, padY = 6;
  // baseLine 값이 있으면 차트 범위에 포함시켜서 보이게
  const hasBaseLine = baseLine != null && Number.isFinite(Number(baseLine));
  const baseLineNum = hasBaseLine ? Number(baseLine) : null;
  const maxV = hasBaseLine ? Math.max(...values, baseLineNum) : Math.max(...values);
  const minV = hasBaseLine ? Math.min(...values, baseLineNum) : Math.min(...values);
  const range = (maxV - minV) || 1;
  const stepX = (w - padX * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = h - padY - ((v - minV) / range) * (h - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  // 면적 채우기용 path
  const lastX = padX + (values.length - 1) * stepX;
  const areaPath = `M ${padX},${h} L ${points.split(' ').join(' L ')} L ${lastX.toFixed(1)},${h} Z`;
  // 최근값 = 시계열 끝 (props으로 넘어온 latestValue가 있으면 우선)
  const showVal = latestValue != null ? latestValue : values[values.length - 1];
  // 처음→끝 변화율 (참고)
  const first = values[0];
  const last = values[values.length - 1];
  const changePct = first > 0 ? Math.round((last - first) / first * 1000) / 10 : 0;
  const up = changePct > 0;
  const down = changePct < 0;
  // tone='up'은 상승=빨강(임대료/가격), tone='down'은 상승=빨강(공실률)
  // tone='neutral'은 상승=초록 사용 (소비심리)
  const changeColor = (() => {
    if (tone === 'neutral') return up ? '#10B981' : (down ? '#EF4444' : '#9CA3AF');
    return up ? '#EF4444' : (down ? '#10B981' : '#9CA3AF');
  })();
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: '#B8B8B8', fontWeight: 500, fontFamily: 'Pretendard, sans-serif' }}>{label}</span>
        {(up || down) && (
          <span style={{ fontSize: 10, fontWeight: 700, color: changeColor }}>
            {up ? '+' : ''}{changePct}%
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1, fontFamily: 'Pretendard, sans-serif' }}>
          {Number(showVal).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
          <span style={{ fontSize: 10, color: '#B8B8B8', marginLeft: 3, fontWeight: 400 }}>{unit}</span>
        </div>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`mlc-grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#mlc-grad-${label})`} />
        {/* 기준선 (옵션): 공실률 10, 임대가격지수 100 등 */}
        {hasBaseLine && (() => {
          const by = h - padY - ((baseLineNum - minV) / range) * (h - padY * 2);
          return (
            <line
              x1={padX} y1={by}
              x2={w - padX} y2={by}
              stroke="#9CA3AF"
              strokeWidth="0.8"
              strokeDasharray="2.5,2"
              opacity="0.6"
            />
          );
        })()}
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* 마지막 점 */}
        {(() => {
          const lx = padX + (values.length - 1) * stepX;
          const ly = h - padY - ((last - minV) / range) * (h - padY * 2);
          return <circle cx={lx} cy={ly} r="2.2" fill={color} />;
        })()}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#777' }}>
        <span>{(periods[0] || '').replace(/(\d{4})Q(\d)/, '$1·$2분기').replace(/(\d{4})(\d{2})/, '$1·$2월')}</span>
        <span>{(periods[periods.length - 1] || '').replace(/(\d{4})Q(\d)/, '$1·$2분기').replace(/(\d{4})(\d{2})/, '$1·$2월')}</span>
      </div>
    </div>
  );
};

// ─── Main Card 01 component ───
const Card01MarketReport = ({
  title = '상권 분석 리포트',
  subtitle = '반경 500m 카페 현황',
  date = '',
  cardNumber = '01',
  index = 0,
  dataSourceStatus = 'live',
  bruSummary = null,
  aiSummary = '',
  chartData = null,
  bodyData = null,
  onMapClick = null,
  showMapButton = false,
  kosisBoxData = null,
}) => {
  // ── Palette (Stitch spec, fixed) ──
  const CARD1_COLOR = {
    '프랜차이즈': '#1E3A8A',
    '개인카페': '#3B82F6',
    '개인 카페': '#3B82F6',
    '베이커리': '#FFFFFF',
  };

  // ── Donut segments ── (Stitch order: 개인카페 55%, 프랜차이즈 25%, 베이커리 20%)
  const rawSegs = chartData?.segments || [];
  // Normalize order to match Stitch: 개인카페 → 프랜차이즈 → 베이커리
  const findSeg = (nameMatcher) => rawSegs.find((s) => nameMatcher(s.name || ''));
  const indiv =
    findSeg((n) => n.includes('개인')) || { name: '개인 카페', pct: 0, color: '#3B82F6' };
  const franch =
    findSeg((n) => n.includes('프랜차이즈')) || { name: '프랜차이즈', pct: 0, color: '#1E3A8A' };
  const bakery =
    findSeg((n) => n.includes('베이커리')) || { name: '베이커리', pct: 0, color: '#FFFFFF' };
  const donutSegments = [
    { name: '개인 카페', pct: indiv.pct || 0, color: CARD1_COLOR['개인카페'] },
    { name: '프랜차이즈', pct: franch.pct || 0, color: CARD1_COLOR['프랜차이즈'] },
    { name: '베이커리', pct: bakery.pct || 0, color: CARD1_COLOR['베이커리'] },
  ];

  const bigNumber = chartData?.bigNumber ?? bodyData?.cafes ?? 0;
  const unit = chartData?.unit || '곳';

  // ── AI summary text (sanitize + strip JSON wrappers) ──
  const aiText = (() => {
    const raw = bruSummary || aiSummary || '';
    if (typeof raw !== 'string') return '';
    return sanitizeAiOutput(sanitizeEmoji(extractFeedbackText(raw)));
  })();

  // ── Metric rows (ordered as Stitch) ──
  const metricDefs = [
    { key: 'cafes', label: '카페 수', suffix: '개' },
    { key: 'franchise', label: '프랜차이즈', suffix: '개' },
    { key: 'individual', label: '개인카페', suffix: '개' },
    { key: 'bakery', label: '베이커리 카페', suffix: '개' },
    { key: 'newOpen', label: '신규 오픈', suffix: '개' },
    { key: '폐업 매장', label: '폐업 매장', suffix: '개' },
    { key: 'seoulFclty', label: '서울 집객시설', suffix: '개' },
  ];

  const metricRows = metricDefs
    .map((def) => {
      const v = bodyData?.[def.key];
      const isSeoulFclty = def.key === 'seoulFclty';
      if (v === undefined || v === null || v === '') {
        // 서울 집객시설은 비수도권에서 데이터 없음 -> 행 자체 숨김 (폴백 문구 노출 금지)
        return null;
      }
      // If value is a string like "서울 집객시설 12개", extract the numeric portion.
      if (typeof v === 'string') {
        const m = v.match(/(\d[\d,]*)\s*([가-힣%]*)/);
        if (m) {
          const num = Number(m[1].replace(/,/g, ''));
          const suffix = m[2] || def.suffix;
          if (Number.isFinite(num)) {
            return { label: def.label, value: `${num.toLocaleString('ko-KR')}${suffix}` };
          }
        }
        // 서울 집객시설인데 숫자 추출 실패 -> 비수도권 가능성, 행 숨김
        if (isSeoulFclty) return null;
        return { label: def.label, value: v };
      }
      const numeric = Number(v);
      if (!Number.isFinite(numeric)) {
        // 비수도권/데이터 없음 -> 행 자체 숨김
        return null;
      }
      return { label: def.label, value: `${numeric.toLocaleString('ko-KR')}${def.suffix}` };
    })
    .filter(Boolean);

  return (
    <motion.article
      data-card-index={index}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: `blur(${BLUR.cardBackdrop}px)`,
        WebkitBackdropFilter: `blur(${BLUR.cardBackdrop}px)`,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        color: COLORS.white,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      className="beancraft-card"
    >
      {/* ── Status marker ── */}
      {dataSourceStatus === 'cache' && (
        <span style={{
          position: 'absolute', top: 10, right: 14,
          fontSize: 11, color: 'rgba(255,255,255,0.4)',
          fontFamily: 'Pretendard, sans-serif', zIndex: 2, pointerEvents: 'none', lineHeight: 1,
        }}>캐시 데이터</span>
      )}
      {dataSourceStatus === 'fallback' && (
        <span style={{
          position: 'absolute', top: 10, right: 14,
          fontSize: 11, color: 'rgba(255,255,255,0.4)',
          fontFamily: 'Pretendard, sans-serif', zIndex: 2, pointerEvents: 'none', lineHeight: 1,
        }}>참고 데이터</span>
      )}

      {/* ── Inner content ── */}
      <div
        style={{
          padding: 'clamp(20px, 3vw, 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(24px, 3vw, 40px)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(22px, 2.6vw, 30px)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                lineHeight: 1.2,
                fontFamily: 'Pretendard, sans-serif',
              }}
            >
              {cardNumber} {title}
            </h2>
            {date && (
              <span
                style={{
                  fontSize: 11,
                  color: COLORS.textMuted,
                  whiteSpace: 'nowrap',
                  marginLeft: 'auto',
                }}
              >
                {date}
              </span>
            )}
          </div>
          {subtitle && (
            <span style={{ fontSize: 14, color: '#B8B8B8', fontWeight: 400, fontFamily: 'Pretendard, sans-serif' }}>
              {subtitle}
            </span>
          )}
        </div>

        {/* ── Bento Grid: left total count + right donut/legend ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 16,
          }}
          className="card01-bento"
        >
          {/* Left: total count */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 14,
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span
              style={{
                fontSize: 12,
                letterSpacing: '0.1em',
                color: '#B8B8B8',
                textTransform: 'uppercase',
                fontWeight: 500,
                fontFamily: 'Pretendard, sans-serif',
              }}
            >
              총 매장 수
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span
                style={{
                  fontSize: 'clamp(48px, 7vw, 64px)',
                  fontWeight: 300,
                  letterSpacing: '-0.04em',
                  color: '#FFFFFF',
                  lineHeight: 1,
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                {Number(bigNumber).toLocaleString('ko-KR')}
              </span>
              <span
                style={{
                  fontSize: 'clamp(18px, 2vw, 24px)',
                  color: '#B8B8B8',
                  marginLeft: 8,
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                {unit}
              </span>
            </div>
          </div>

          {/* Right: donut + legend */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 14,
              padding: 'clamp(20px, 3vw, 32px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 28,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            className="card01-chart-box"
          >
            <Donut segments={donutSegments} />
            <Legend segments={donutSegments} />
          </div>
        </div>

        {/* ── AI Summary box ── */}
        {aiText && (
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              padding: '18px 20px 18px 26px',
              borderLeft: '3px solid #1E3A8A',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#1E3A8A',
              }}
            >
              <SparklesIcon size={16} color="#1E3A8A" />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: '#1E3A8A',
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                AI 요약
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.65,
                color: '#E0E0E0',
                fontWeight: 300,
                fontFamily: 'Pretendard, sans-serif',
              }}
            >
              {aiText}
            </p>
          </div>
        )}

        {/* ── Metric list ── */}
        {metricRows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {metricRows.map((row, i) => (
              <MetricRow
                key={row.label}
                label={row.label}
                value={row.value}
                last={i === metricRows.length - 1}
              />
            ))}
          </div>
        )}

        {/* ── 한국부동산원 우리 상권 요약 박스 ── */}
        {kosisBoxData && (kosisBoxData.marketRent || kosisBoxData.vacancy || kosisBoxData.priceChange) && (() => {
          const mr = kosisBoxData.marketRent;
          const vc = kosisBoxData.vacancy;
          const pc = kosisBoxData.priceChange;
          const mrManwon = mr ? Math.round(mr.value / 10000) : null;
          const pcVal = pc?.value;
          const pcUp = pcVal != null && pcVal > 0;
          const pcDown = pcVal != null && pcVal < 0;
          const pcColor = pcUp ? '#EF4444' : pcDown ? '#3B82F6' : '#B8B8B8';
          const pcSign = pcUp ? '+' : '';
          const periodTxt = mr?.period || vc?.period || pc?.period || '';
          const regionTxt = mr?.region || vc?.region || pc?.region || '';
          const scope = (mr?.scope || vc?.scope || pc?.scope) === '시도평균' ? ' (시도 평균)' : '';
          // 분기 형식 정리: 2024Q3 → 2024 3분기
          const periodLabel = /^\d{4}Q\d$/.test(periodTxt)
            ? `${periodTxt.slice(0, 4)} ${periodTxt.slice(5)}분기`
            : periodTxt;
          const rowStyle = {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontFamily: 'Pretendard, sans-serif',
          };
          const labelStyle = { fontSize: 13, color: '#B8B8B8', fontWeight: 400 };
          const valueStyle = { fontSize: 14, color: '#FFFFFF', fontWeight: 600 };
          return (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '20px 22px',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#FFFFFF',
                marginBottom: 8, fontFamily: 'Pretendard, sans-serif',
                letterSpacing: '-0.01em',
              }}>
                이 상권 임대 시세
              </div>
              {mrManwon != null && (
                <div style={rowStyle}>
                  <span style={labelStyle}>평당 월세</span>
                  <span style={valueStyle}>{mrManwon.toLocaleString('ko-KR')}<span style={{ fontSize: 12, color: '#B8B8B8', marginLeft: 4, fontWeight: 400 }}>만원/평</span></span>
                </div>
              )}
              {vc && (
                <div style={rowStyle}>
                  <span style={labelStyle}>공실률</span>
                  <span style={valueStyle}>{Number(vc.value).toFixed(1)}<span style={{ fontSize: 12, color: '#B8B8B8', marginLeft: 4, fontWeight: 400 }}>%</span></span>
                </div>
              )}
              {pcVal != null && (
                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                  <span style={labelStyle}>1년 변동률</span>
                  <span style={{ ...valueStyle, color: pcColor }}>
                    {pcSign}{Number(pcVal).toFixed(1)}<span style={{ fontSize: 12, marginLeft: 4, fontWeight: 400, color: pcColor }}>%</span>
                  </span>
                </div>
              )}
              <div style={{
                fontSize: 11, color: '#B8B8B8', marginTop: 8,
                fontFamily: 'Pretendard, sans-serif', textAlign: 'right',
              }}>
                한국부동산원 {periodLabel}{regionTxt ? ` (${regionTxt} 기준${scope})` : scope}
              </div>
            </div>
          );
        })()}

        {/* ── 한국부동산원 분기 추이 (임대료/공실률 8분기 + 임대가격지수 12분기) ── */}
        {kosisBoxData && (
          kosisBoxData.marketRentSeries?.series?.length > 1
          || kosisBoxData.vacancySeries?.series?.length > 1
          || kosisBoxData.priceIndexSeries?.series?.length > 1
        ) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: '#B8B8B8',
              fontFamily: 'Pretendard, sans-serif', letterSpacing: '-0.01em',
            }}>
              분기별 추이 (한국부동산원)
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {kosisBoxData.marketRentSeries?.series?.length > 1 && (
                <MiniLineChart
                  series={kosisBoxData.marketRentSeries.series}
                  color="#F59E0B"
                  label="평당 월세 (만원/평)"
                  unit=""
                  tone="up"
                />
              )}
              {kosisBoxData.vacancySeries?.series?.length > 1 && (
                <MiniLineChart
                  series={kosisBoxData.vacancySeries.series}
                  color="#EF4444"
                  label="공실률 (%)"
                  unit=""
                  tone="up"
                  baseLine={10}
                />
              )}
              {kosisBoxData.priceIndexSeries?.series?.length > 1 && (
                <MiniLineChart
                  series={kosisBoxData.priceIndexSeries.series}
                  color="#8B5CF6"
                  label="임대가격지수"
                  unit=""
                  tone="up"
                  baseLine={100}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Map button (always shown when onMapClick provided) ── */}
        {onMapClick && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <button
              type="button"
              onClick={onMapClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'transparent',
                border: '1px solid #FFFFFF',
                color: '#FFFFFF',
                borderRadius: 8,
                padding: '12px 32px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'Pretendard, sans-serif',
                transition: 'background 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <MapIcon size={16} color="#FFFFFF" />
              지도로 보기
            </button>
          </div>
        )}
      </div>

      {/* ── Responsive bento: 2-col on lg+ ── */}
      <style>{`
        @media (min-width: 900px) {
          .card01-bento {
            grid-template-columns: 5fr 7fr !important;
          }
          .card01-chart-box {
            flex-direction: row !important;
            align-items: center !important;
          }
        }
      `}</style>
    </motion.article>
  );
};

export default Card01MarketReport;
