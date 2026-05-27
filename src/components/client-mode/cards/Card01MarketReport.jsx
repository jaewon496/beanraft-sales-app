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
        // seoulFclty는 값이 없어도 항상 표시 (폴백 문구)
        if (isSeoulFclty) {
          return { label: def.label, value: '서울 외 지역 미지원' };
        }
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
        return { label: def.label, value: v };
      }
      const numeric = Number(v);
      if (!Number.isFinite(numeric)) {
        if (isSeoulFclty) {
          return { label: def.label, value: '서울 외 지역 미지원' };
        }
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
            {/* date 표시 제거 (사용자 요청) */}
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
