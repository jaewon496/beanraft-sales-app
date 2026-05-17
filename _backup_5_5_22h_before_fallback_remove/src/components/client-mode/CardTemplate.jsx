import React from 'react';
import { motion } from 'framer-motion';
import { COLORS, BLUR } from './constants';

// ─── AI Output Sanitizer (strips machine-generated artifacts from AI text) ───
const sanitizeAiOutput = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    // underscore-prefixed variable names (e.g. _analysisFrame, _crossDataStr)
    .replace(/\b_[a-zA-Z][a-zA-Z0-9_]*\b/g, '')
    // bracket-enclosed directives
    .replace(/\[[^\]]*지시사항[^\]]*\]/g, '')
    .replace(/\[[^\]]*톤 지침[^\]]*\]/g, '')
    .replace(/\[[^\]]*필수 생성 규칙[^\]]*\]/g, '')
    .replace(/\[[^\]]*출력 금지 규칙[^\]]*\]/g, '')
    .replace(/\[[^\]]*현장 보정[^\]]*\]/g, '')
    // Markdown table syntax (|---|---|)
    .replace(/\|[-:]+\|[-:|\s]+/g, '')
    // lines starting with ## or ### (prompt headings)
    .replace(/^#{2,3}\s+.*$/gm, '')
    // literal internal variable/function names that should never leak
    .replace(/buildCardPrompt/g, '')
    .replace(/AI_CHARACTER_PROMPT/g, '')
    .replace(/bruFeedback/g, '')
    .replace(/bruSummary/g, '')
    // collapse leftover whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// ─── Emoji Sanitizer (removes unicode emoji from user-facing text) ───
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

// ─── JSON bruFeedback 추출 (Gemini가 JSON으로 응답한 경우 텍스트만 추출) ───
const extractFeedbackText = (text) => {
  if (!text || typeof text !== 'string') return text;
  if (!text.trim().startsWith('{')) return text;
  try {
    const parsed = JSON.parse(text);
    if (parsed.bruFeedback) return parsed.bruFeedback;
    if (parsed.insight?.bruFeedback) return parsed.insight.bruFeedback;
    if (parsed.feedback) return parsed.feedback;
    if (parsed.insight && typeof parsed.insight === 'string') return parsed.insight;
  } catch (e) { /* JSON 아니면 그대로 */ }
  return text;
};

// ─── Format card number (01, 02, ... 14) ───
const formatCardNumber = (idx) => {
  const n = Number(idx) + 1;
  return n < 10 ? `0${n}` : `${n}`;
};

// ─── Card Template (one-card-per-viewport, toss style) ───
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
  defaultExpanded = true, // kept for backward compat (no longer used)
  index = 0,
  cardNumber = null,
  dataSourceStatus = 'live',
}) => {
  const numberLabel = cardNumber != null ? cardNumber : formatCardNumber(index);

  return (
    <motion.article
      data-card-index={index}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: `blur(${BLUR.cardBackdrop}px)`,
        WebkitBackdropFilter: `blur(${BLUR.cardBackdrop}px)`,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        color: COLORS.white,
        width: '100%',
        margin: '0 auto',
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        // 자유 스크롤 환경: 카드는 자체 최대 높이 제한 없이 자연 높이로 확장
      }}
      className="beancraft-card"
    >
      {/* ── Status marker (cache / fallback) ── */}
      {dataSourceStatus === 'cache' && (
        <span style={{
          position: 'absolute', top: 10, right: 14,
          fontSize: 11, color: 'rgba(255,255,255,0.4)',
          fontFamily: 'Pretendard, sans-serif',
          zIndex: 2, pointerEvents: 'none', lineHeight: 1,
        }}>
          캐시 데이터
        </span>
      )}
      {dataSourceStatus === 'fallback' && (
        <span style={{
          position: 'absolute', top: 10, right: 14,
          fontSize: 11, color: 'rgba(255,255,255,0.4)',
          fontFamily: 'Pretendard, sans-serif',
          zIndex: 2, pointerEvents: 'none', lineHeight: 1,
        }}>
          참고 데이터
        </span>
      )}

      {/* ── Header: number + title + context label ── */}
      <div
        style={{
          padding: 'clamp(18px, 2.4vw, 28px) clamp(20px, 2.4vw, 28px) 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 'clamp(12px, 1vw, 14px)',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.08em',
                fontFeatureSettings: '"tnum"',
              }}
            >
              {numberLabel}
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: 'clamp(20px, 2vw, 26px)',
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h3>
          </div>
          {subtitle && (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 'clamp(12px, 1vw, 14px)',
                color: COLORS.textMuted,
                fontWeight: 400,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {date && (
          <span
            style={{
              fontSize: 11,
              color: COLORS.textMuted,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              paddingTop: 4,
            }}
          >
            {date}
          </span>
        )}
      </div>

      {/* ── Chart Area ── */}
      {chartContent && (
        <div
          style={{
            borderTop: `1px solid rgba(255,255,255,0.1)`,
            borderBottom: `1px solid rgba(255,255,255,0.1)`,
            padding: '0',
            minHeight: 150,
            maxHeight: 'clamp(220px, 30vh, 320px)',
            flex: 'none',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {chartContent}
          </div>
        </div>
      )}

      {/* ── AI Summary ── */}
      {(bruSummary || aiSummary) && (
        <div style={{ padding: 'clamp(12px, 1.4vw, 18px) clamp(20px, 2.4vw, 28px)' }}>
          {bruSummary && (
            <div
              style={{
                background: COLORS.aiFeedbackBg,
                borderLeft: '3px solid #1E3A8A',
                padding: '10px 14px',
                marginBottom: aiSummary ? 10 : 0,
                borderRadius: '0 6px 6px 0',
                fontSize: 'clamp(13px, 1vw, 15px)',
                fontWeight: 600,
                lineHeight: 1.55,
                color: COLORS.textSecondary,
              }}
            >
              {typeof bruSummary === 'string' ? sanitizeAiOutput(sanitizeEmoji(extractFeedbackText(bruSummary))) : bruSummary}
            </div>
          )}
          {aiSummary && (
            <div
              style={{
                // Card 1(상권 분석 리포트, index=0) 전용: 3px 네이비 #1E3A8A
                borderLeft: index === 0
                  ? '3px solid #1E3A8A'
                  : '2px solid rgba(255,255,255,0.15)',
                paddingLeft: 14,
                paddingTop: 4,
                paddingBottom: 4,
                fontSize: 'clamp(13px, 1vw, 15px)',
                lineHeight: 1.65,
                fontStyle: 'normal',
                fontWeight: 400,
                color: COLORS.textSecondary,
              }}
            >
              {typeof aiSummary === 'string' ? sanitizeAiOutput(sanitizeEmoji(extractFeedbackText(aiSummary))) : aiSummary}
            </div>
          )}
        </div>
      )}

      {/* ── Body (always expanded — no toggle) ── */}
      {bodyContent && (
        <div
          style={{
            padding: 'clamp(12px, 1.4vw, 18px) clamp(20px, 2.4vw, 28px) clamp(18px, 2vw, 24px)',
            borderTop: `1px solid ${COLORS.divider}`,
            fontSize: 'clamp(13px, 1vw, 14px)',
            color: COLORS.textSecondary,
          }}
        >
          {bodyContent}
        </div>
      )}
    </motion.article>
  );
};

export default CardTemplate;
