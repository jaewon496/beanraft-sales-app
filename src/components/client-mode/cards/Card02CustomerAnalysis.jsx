import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Card02DetailPopup from './Card02DetailPopup';

// ─── AI Output Sanitizer (mirrors Card01MarketReport.jsx) ───
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

// ─── Inline SVG Icons ───
const SparklesIcon = ({ size = 18, color = '#3B82F6' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 1L9.2 5.2L13.4 6.4L9.2 7.6L8 11.8L6.8 7.6L2.6 6.4L6.8 5.2L8 1Z"
      fill={color}
    />
    <path d="M13 10L13.6 11.6L15.2 12.2L13.6 12.8L13 14.4L12.4 12.8L10.8 12.2L12.4 11.6L13 10Z" fill={color} />
    <path d="M3.5 11L3.9 12.1L5 12.5L3.9 12.9L3.5 14L3.1 12.9L2 12.5L3.1 12.1L3.5 11Z" fill={color} />
  </svg>
);

const GroupIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Helpers ───
// Extract number + unit from a string like "30대" → { num: '30', unit: '대' }
const splitAgeLabel = (label) => {
  if (!label || typeof label !== 'string') return { num: '-', unit: '' };
  const m = label.match(/^(\d+)\s*(.*)$/);
  if (m) return { num: m[1], unit: m[2] || '대' };
  return { num: label, unit: '' };
};

// Parse a lifestyle string like "생활 구매(22.6%), 외식 활동(22.2%), 문화 여가(12.3%)"
// into an array of { name, pct } items
const parseLifestyleItems = (str) => {
  if (!str || typeof str !== 'string') return [];
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const m = item.match(/^(.+?)\((.+?)\)\s*$/);
      if (m) return { name: m[1].trim(), pct: m[2].trim() };
      return { name: item, pct: '' };
    });
};

// Sort age groups into a canonical display order: 20대 → 30대 → 40대 → 50대+
const AGE_ORDER = ['20대', '30대', '40대', '50대+', '50+'];
const sortAgeGroups = (groups) => {
  if (!Array.isArray(groups)) return [];
  const ranked = [...groups].filter((g) => g && typeof g.pct === 'number');
  ranked.sort((a, b) => {
    const ia = AGE_ORDER.findIndex((k) => (a.name || '').startsWith(k.replace('+', '')) || a.name === k);
    const ib = AGE_ORDER.findIndex((k) => (b.name || '').startsWith(k.replace('+', '')) || b.name === k);
    const ax = ia < 0 ? 99 : ia;
    const bx = ib < 0 ? 99 : ib;
    return ax - bx;
  });
  return ranked;
};

// ─── Main Card 02 component ───
const Card02CustomerAnalysis = ({
  title = '고객 분석',
  subtitle = '방문 고객 특성',
  date = '',
  cardNumber = '02',
  index = 1,
  dataSourceStatus = 'live',
  bruSummary = null,
  aiSummary = '',
  chartData = null,
  bodyData = null,
  collectedData = null,
  onMapClick = null,
  // eslint-disable-next-line no-unused-vars
  showMapButton = false,
}) => {
  const [detailOpen, setDetailOpen] = useState(false);
  // ── Chart data extraction ──
  const male = Number(chartData?.male ?? 0);
  const female = Number(chartData?.female ?? 0);
  const ageGroupsRaw = Array.isArray(chartData?.ageGroups) ? chartData.ageGroups : [];
  const ageGroupsSorted = sortAgeGroups(ageGroupsRaw);
  const topAgeGroup = [...ageGroupsSorted].sort((a, b) => (b.pct || 0) - (a.pct || 0))[0] || null;
  const secondAgeGroup = [...ageGroupsSorted].sort((a, b) => (b.pct || 0) - (a.pct || 0))[1] || null;

  const topAgeLabel = bodyData?.topAge || topAgeGroup?.name || '';
  const { num: topAgeNum, unit: topAgeUnit } = splitAgeLabel(topAgeLabel);

  // ── AI summary text (sanitize + strip JSON wrappers) ──
  const aiText = (() => {
    const raw = bruSummary || aiSummary || '';
    if (typeof raw !== 'string') return '';
    return sanitizeAiOutput(sanitizeEmoji(extractFeedbackText(raw)));
  })();

  // ── Donut dasharray (circumference = 2π*15.915 ≈ 100) ──
  // Stitch uses stroke-dasharray="57 43" — we mirror that with female/male pct
  const genderValid = (male > 0 || female > 0) && (male + female) > 0;
  const femaleDash = genderValid ? (female / (male + female)) * 100 : 0;
  const maleDash = genderValid ? 100 - femaleDash : 0;

  // ── Metric rows (Stitch v2 8-row spec, skip missing) ──
  // Row types: 'text' | 'visitors' | 'regular'
  const metricRows = (() => {
    const rows = [];

    // 1. 주요 연령대
    if (topAgeLabel && topAgeGroup?.pct != null) {
      rows.push({ type: 'text', label: '주요 연령대', value: `${topAgeLabel} (${Math.round(topAgeGroup.pct)}%)` });
    } else if (topAgeLabel) {
      rows.push({ type: 'text', label: '주요 연령대', value: topAgeLabel });
    }

    // 2. 2순위 연령대
    if (secondAgeGroup && secondAgeGroup.pct != null) {
      rows.push({ type: 'text', label: '2순위 연령대', value: `${secondAgeGroup.name} (${Math.round(secondAgeGroup.pct)}%)` });
    }

    // 3. 성별 비율
    if (genderValid) {
      rows.push({ type: 'text', label: '성별 비율', value: `여 ${Math.round(female)}% / 남 ${Math.round(male)}%` });
    } else if (bodyData?.genderRatio) {
      rows.push({ type: 'text', label: '성별 비율', value: bodyData.genderRatio });
    }

    // 4. 피크 시간
    if (bodyData?.peakTime) {
      rows.push({ type: 'text', label: '피크 시간', value: bodyData.peakTime });
    }

    // 5. 일평균 방문객 (residentPop 또는 openubPopulation) — 숫자만 파란색 강조
    const visitors = bodyData?.residentPop ?? bodyData?.openubPopulation ?? null;
    if (visitors != null && Number(visitors) > 0) {
      rows.push({
        type: 'visitors',
        label: '일평균 방문객',
        visitorNum: Number(visitors).toLocaleString('ko-KR'),
      });
    }

    // 6. 재방문율 — 우측 미니 진행바
    if (bodyData?.regular != null && Number(bodyData.regular) > 0) {
      const regularPct = Math.round(Number(bodyData.regular));
      rows.push({
        type: 'regular',
        label: '재방문율',
        regularPct,
      });
    }

    // 7. 신규 고객 비율
    if (bodyData?.newCustomer != null && Number(bodyData.newCustomer) > 0) {
      rows.push({
        type: 'text',
        label: '신규 고객 비율',
        value: `${Math.round(Number(bodyData.newCustomer) * 10) / 10}%`,
      });
    }

    // 8. 라이프스타일 (최하단) — 여/남 TOP3 전체 (스티치 v3 스펙)
    const femaleLife = bodyData?.femaleLifestyle;
    const maleLife = bodyData?.maleLifestyle;
    if (femaleLife || maleLife) {
      rows.push({
        type: 'lifestyle',
        label: '라이프스타일',
        femaleLife: typeof femaleLife === 'string' ? femaleLife : '',
        maleLife: typeof maleLife === 'string' ? maleLife : '',
      });
    }

    return rows;
  })();

  // Hero metric progress bar width — reflect top age share (fallback to 75%)
  const heroBarPct = topAgeGroup?.pct ? Math.min(100, Math.max(5, Math.round(topAgeGroup.pct * 2))) : 75;

  // ── 방문 손님 연 평균소득 (카드 9에서 이동) ──
  const customerYrEarn = bodyData?.customerYrEarn || null;
  const hasCustomerYrEarn =
    customerYrEarn &&
    (Number(customerYrEarn.male) > 0 || Number(customerYrEarn.female) > 0);

  return (
    <motion.article
      data-card-index={index}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        background: '#0E0E0E',
        borderRadius: 16,
        overflow: 'hidden',
        color: '#FFFFFF',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        fontFamily: 'Pretendard, sans-serif',
      }}
      className="beancraft-card card02-customer"
    >
      {/* ── Atmospheric glow (top radial gradient) ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% -20%, rgba(59, 130, 246, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

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

      {/* ── Inner content (p-6 = 24px) ── */}
      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ── Card Header (mb-8 = 32px) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2
              style={{
                margin: 0,
                fontSize: 30,
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
            <p
              style={{
                margin: 0,
                marginTop: 4,
                fontSize: 14,
                fontWeight: 300,
                color: '#B8B8B8',
                fontFamily: 'Pretendard, sans-serif',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* ── Bento Grid (grid-cols-12, gap-3, mb-4) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {/* Hero Metric (col-span-5) */}
          <div
            style={{
              gridColumn: 'span 5 / span 5',
              background: '#1B1B1B',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 130,
            }}
          >
            <span style={{ fontSize: 14, color: '#B8B8B8', fontFamily: 'Pretendard, sans-serif' }}>
              주요 연령대
            </span>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline' }}>
              <span
                style={{
                  fontSize: 60,
                  fontWeight: 300,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  color: '#FFFFFF',
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                {topAgeNum}
              </span>
              <span
                style={{
                  fontSize: 18,
                  marginLeft: 4,
                  color: '#FFFFFF',
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                {topAgeUnit || '대'}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                background: '#353535',
                marginTop: 8,
                borderRadius: 9999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: '#3B82F6',
                  height: '100%',
                  width: `${heroBarPct}%`,
                }}
              />
            </div>
          </div>

          {/* Gender Donut (col-span-7) */}
          <div
            style={{
              gridColumn: 'span 7 / span 7',
              background: '#1B1B1B',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 36 36"
                style={{ transform: 'rotate(-90deg)' }}
              >
                <circle
                  cx="18"
                  cy="18"
                  fill="transparent"
                  r="15.915"
                  stroke="#1E3A8A"
                  strokeWidth="4"
                />
                {genderValid && (
                  <circle
                    cx="18"
                    cy="18"
                    fill="transparent"
                    r="15.915"
                    stroke="#3B82F6"
                    strokeDasharray={`${femaleDash.toFixed(2)} ${maleDash.toFixed(2)}`}
                    strokeDashoffset="0"
                    strokeWidth="4"
                  />
                )}
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#3B82F6',
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                여성 {genderValid ? Math.round(female) : 0}%
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#DCE1FF',
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                남성 {genderValid ? Math.round(male) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* ── Age Distribution (bg-surface-container-low, rounded-xl, p-5, mb-4) ── */}
        {ageGroupsSorted.length > 0 && (
          <div
            style={{
              background: '#1B1B1B',
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {ageGroupsSorted.map((grp) => {
              const isTop = topAgeGroup && grp.name === topAgeGroup.name;
              const pct = Math.round(grp.pct || 0);
              return (
                <div
                  key={grp.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      fontSize: 14,
                      color: isTop ? '#FFFFFF' : '#B8B8B8',
                      fontWeight: isTop ? 500 : 400,
                      fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    {grp.name}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 12,
                      background: '#353535',
                      borderRadius: 9999,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, pct)}%`,
                        background: isTop ? '#3B82F6' : '#444651',
                        boxShadow: isTop ? '0 0 12px rgba(59,130,246,0.5)' : 'none',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      width: 40,
                      textAlign: 'right',
                      fontSize: 14,
                      color: isTop ? '#FFFFFF' : '#B8B8B8',
                      fontWeight: isTop ? 700 : 400,
                      fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 방문 손님 연 평균소득 (카드 9에서 이동) ── */}
        {hasCustomerYrEarn && (
          <div
            style={{
              background: '#1B1B1B',
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: '#B8B8B8',
                  fontWeight: 300,
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                방문 손님 연 평균소득
              </span>
              {customerYrEarn.period && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.45)',
                    fontFamily: 'Pretendard, sans-serif',
                  }}
                >
                  {customerYrEarn.period}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {Number(customerYrEarn.male) > 0 && (
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(59,130,246,0.10)',
                    border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#3B82F6',
                      fontWeight: 500,
                      marginBottom: 4,
                      fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    남성
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#FFFFFF',
                      fontFamily: 'Pretendard, sans-serif',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {Number(customerYrEarn.male).toLocaleString('ko-KR')}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: '#B8B8B8',
                        marginLeft: 3,
                      }}
                    >
                      {customerYrEarn.unit || '만원'}
                    </span>
                  </div>
                </div>
              )}
              {Number(customerYrEarn.female) > 0 && (
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(236,72,153,0.10)',
                    border: '1px solid rgba(236,72,153,0.25)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#EC4899',
                      fontWeight: 500,
                      marginBottom: 4,
                      fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    여성
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#FFFFFF',
                      fontFamily: 'Pretendard, sans-serif',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {Number(customerYrEarn.female).toLocaleString('ko-KR')}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: '#B8B8B8',
                        marginLeft: 3,
                      }}
                    >
                      {customerYrEarn.unit || '만원'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI Summary Box ── */}
        {aiText && (
          <div
            style={{
              background: '#1F1F1F',
              borderRadius: 12,
              padding: 20,
              borderLeft: '3px solid #1E3A8A',
              marginBottom: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <SparklesIcon size={18} color="#3B82F6" />
              <h4
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 500,
                  color: '#FFFFFF',
                  fontFamily: 'Pretendard, sans-serif',
                }}
              >
                AI 요약
              </h4>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 300,
                color: '#B8B8B8',
                lineHeight: 1.7,
                fontFamily: 'Pretendard, sans-serif',
              }}
            >
              {aiText}
            </p>
          </div>
        )}

        {/* ── Metric List (mb-8 = 32px) ── */}
        {metricRows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 32 }}>
            {metricRows.map((row, i) => {
              const isLast = i === metricRows.length - 1;
              const rowWrapStyle = {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.1)',
              };
              const labelStyle = {
                fontSize: 14,
                fontWeight: 300,
                color: '#B8B8B8',
                fontFamily: 'Pretendard, sans-serif',
              };

              if (row.type === 'visitors') {
                return (
                  <div key={`${row.label}-${i}`} style={rowWrapStyle}>
                    <span style={labelStyle}>{row.label}</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        fontFamily: 'Pretendard, sans-serif',
                      }}
                    >
                      <span style={{ color: '#3B82F6' }}>{row.visitorNum}</span>
                      <span style={{ color: '#FFFFFF' }}>명</span>
                    </span>
                  </div>
                );
              }

              if (row.type === 'lifestyle') {
                const femaleItems = parseLifestyleItems(row.femaleLife);
                const maleItems = parseLifestyleItems(row.maleLife);
                const lifestyleWrapStyle = {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '16px 0',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.1)',
                };
                const lineStyle = {
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#FFFFFF',
                  fontFamily: 'Pretendard, sans-serif',
                  whiteSpace: 'nowrap',
                };
                const pctStyle = {
                  fontSize: 10,
                  fontWeight: 400,
                  color: '#B8B8B8',
                  fontFamily: 'Pretendard, sans-serif',
                };
                const renderLine = (prefix, items) => (
                  <div style={lineStyle}>
                    <span>{prefix}</span>
                    {items.map((it, idx) => (
                      <React.Fragment key={`${prefix}-${idx}`}>
                        <span>{it.name}</span>
                        {it.pct && <span style={pctStyle}>({it.pct})</span>}
                        {idx < items.length - 1 && <span>, </span>}
                      </React.Fragment>
                    ))}
                  </div>
                );
                return (
                  <div key={`${row.label}-${i}`} style={lifestyleWrapStyle}>
                    <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>{row.label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {femaleItems.length > 0 && renderLine('여: ', femaleItems)}
                      {maleItems.length > 0 && renderLine('남: ', maleItems)}
                    </div>
                  </div>
                );
              }

              if (row.type === 'regular') {
                const barWidth = Math.max(0, Math.min(100, row.regularPct));
                return (
                  <div key={`${row.label}-${i}`} style={rowWrapStyle}>
                    <span style={labelStyle}>{row.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 4,
                          background: '#353535',
                          borderRadius: 9999,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${barWidth}%`,
                            background: '#3B82F6',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#FFFFFF',
                          fontFamily: 'Pretendard, sans-serif',
                        }}
                      >
                        {row.regularPct}%
                      </span>
                    </div>
                  </div>
                );
              }

              // default: text
              return (
                <div key={`${row.label}-${i}`} style={rowWrapStyle}>
                  <span style={labelStyle}>{row.label}</span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#FFFFFF',
                      fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CTA Button ── */}
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          style={{
            width: '100%',
            padding: '16px 0',
            border: '1px solid #FFFFFF',
            borderRadius: 12,
            background: 'transparent',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 16,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'Pretendard, sans-serif',
            transition: 'background 0.2s, transform 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1B1B1B';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.98)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <GroupIcon size={20} color="#FFFFFF" />
          연령대별 상세 보기
        </button>
      </div>

      {/* ── Detail Popup (Stitch v7) ── */}
      <Card02DetailPopup
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        bodyData={bodyData}
        chartData={chartData}
        collectedData={collectedData}
      />
    </motion.article>
  );
};

export default Card02CustomerAnalysis;
