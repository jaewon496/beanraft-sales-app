import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS, TIMING, BLUR } from './constants';

// ─── Expand/Collapse Icon (SVG chevron) ───
const ChevronIcon = ({ expanded }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    style={{
      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: `transform ${TIMING.hoverLift}ms ease`,
    }}
  >
    <path
      d="M4 6L8 10L12 6"
      stroke={COLORS.white}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── Source Avatar (small circle with initial) ───
const SourceAvatar = ({ source }) => {
  const initial = source ? source.charAt(0).toUpperCase() : 'D';
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        color: COLORS.white,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
};

// ─── Card Template ───
const CardTemplate = ({
  title = '',
  subtitle = '',
  date = '',
  source = '',
  chartContent = null,
  bruSummary = null,
  aiSummary = '',
  bodyContent = null,
  metaInfo = '',
  defaultExpanded = false,
  index = 0,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const staggerDelay = index * (TIMING.cardStagger / 1000);

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: staggerDelay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{
        y: -4,
        boxShadow: '0 8px 32px rgba(255,255,255,0.08)',
        transition: { duration: TIMING.hoverLift / 1000 },
      }}
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: `blur(${BLUR.cardBackdrop}px)`,
        WebkitBackdropFilter: `blur(${BLUR.cardBackdrop}px)`,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        color: COLORS.white,
        width: '100%',
        cursor: 'default',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        scrollSnapAlign: 'start',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: '20px 24px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 14,
                color: COLORS.textMuted,
                fontWeight: 400,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {date && (
            <span style={{ fontSize: 11, color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
              {date}
            </span>
          )}
          {/* 출처는 카드 최하단에만 표시 */}
        </div>
      </div>

      {/* ── Chart Area ── */}
      {chartContent && (
        <div
          style={{
            borderTop: `1px solid rgba(255,255,255,0.1)`,
            borderBottom: `1px solid rgba(255,255,255,0.1)`,
            padding: '0',
            minHeight: 150,
            maxHeight: 300,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {chartContent}
        </div>
      )}

      {/* ── AI Summary ── */}
      {(bruSummary || aiSummary) && (
        <div style={{ padding: '14px 24px' }}>
          {bruSummary && (
            <div
              style={{
                background: COLORS.aiFeedbackBg,
                borderLeft: '3px solid #10b981',
                padding: '8px 12px',
                marginBottom: aiSummary ? 10 : 0,
                borderRadius: '0 6px 6px 0',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
                color: COLORS.textSecondary,
              }}
            >
              {bruSummary}
            </div>
          )}
          {aiSummary && (
            <div
              style={{
                borderLeft: `2px solid rgba(255,255,255,0.15)`,
                paddingLeft: 14,
                paddingTop: 4,
                paddingBottom: 4,
                fontSize: 14,
                lineHeight: 1.6,
                fontStyle: 'normal',
                fontWeight: 400,
                color: COLORS.textSecondary,
              }}
            >
              {aiSummary}
            </div>
          )}
        </div>
      )}

      {/* ── Body (Collapsible) ── */}
      <AnimatePresence initial={false}>
        {expanded && bodyContent && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0 24px 16px',
                borderTop: `1px solid ${COLORS.divider}`,
                paddingTop: 14,
                fontSize: 14,
                color: COLORS.textSecondary,
                flex: 1,
              }}
            >
              {bodyContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ── */}
      <div
        style={{
          padding: '10px 24px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid rgba(255,255,255,0.1)`,
          marginTop: 'auto',
          position: 'relative',
          zIndex: 5,
        }}
      >
        {bodyContent ? (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              color: COLORS.white,
              fontSize: 13,
              cursor: 'pointer',
              padding: '8px 0',
              position: 'relative',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: 0.7,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            {expanded ? '접기' : '더 보기'}
            <ChevronIcon expanded={expanded} />
          </button>
        ) : (
          <span />
        )}
        {metaInfo && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 4,
              border: `1px solid ${COLORS.whiteTranslucent}`,
              color: COLORS.textMuted,
              letterSpacing: '0.02em',
            }}
          >
            {metaInfo}
          </span>
        )}
      </div>

      {/* 출처는 UnifiedLayout 하단에 통합 표시 */}
    </motion.article>
  );
};

export default CardTemplate;
