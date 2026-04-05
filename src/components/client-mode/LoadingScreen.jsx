import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS } from './constants';

const TEXT_SLIDE_DURATION = 0.3;

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function HoverSlideButton({ onClick, label, hoverLabel }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileTap={{ scale: 0.96 }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '10px 32px',
        background: 'transparent',
        border: `1px solid ${isHovered ? COLORS.navy : COLORS.whiteBorder}`,
        borderRadius: 6,
        cursor: 'pointer',
        minWidth: 120,
        height: 44,
        boxShadow: isHovered ? `0 0 12px ${COLORS.navyTranslucent}` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <motion.span
        animate={{ x: isHovered ? -60 : 0, opacity: isHovered ? 0 : 1 }}
        transition={{ duration: TEXT_SLIDE_DURATION }}
        style={{ display: 'block', color: COLORS.white, fontSize: 14, fontWeight: 500, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
      >
        {label}
      </motion.span>
      <motion.span
        animate={{ x: isHovered ? 0 : 60, opacity: isHovered ? 1 : 0 }}
        transition={{ duration: TEXT_SLIDE_DURATION }}
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, color: COLORS.white, fontSize: 14, fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap',
        }}
      >
        {hoverLabel}
        <ArrowRightIcon />
      </motion.span>
    </motion.button>
  );
}

/* ─── EntryScreen과 동일한 값 ─── */
const LINE_WIDTH = 280;
const LINE_HEIGHT = 2;
const LINE_GLOW_SPREAD = 8;
const LINE_GAP_EXPANDED = 160;
const LINE_EXPAND_DURATION = 1.2;
const LOGO_CONTAINER_HEIGHT = 126;
const LOGO_RENDER_HEIGHT = 360;
const SHOCKWAVE_DURATION = 0.5;
const CLOSING_DURATION = 0.8;
const BLACKOUT_DURATION = 0.6;

const GPU_LAYER = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
};

export default function LoadingScreen({ progress = 0, onComplete, onGoHomepage }) {
  // phases: expanding -> ready -> shockwave -> closing -> blackout -> done
  const [phase, setPhase] = useState('expanding');
  const [linesExpanded, setLinesExpanded] = useState(false);

  // Lines expand on mount
  useEffect(() => {
    const t = setTimeout(() => {
      setLinesExpanded(true);
      setPhase('ready');
    }, 200);
    return () => clearTimeout(t);
  }, []);

  // 100% → waitClick (사용자 클릭 대기)
  useEffect(() => {
    if (progress >= 100 && phase === 'ready') {
      setPhase('waitClick');
    }
  }, [progress, phase]);

  const handleCompleteClick = () => {
    if (phase === 'waitClick') {
      setPhase('closing');
    }
  };

  useEffect(() => {
    if (phase === 'closing') {
      setLinesExpanded(false);
      const t = setTimeout(() => setPhase('blackout'), CLOSING_DURATION * 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'blackout') {
      const t = setTimeout(() => {
        setPhase('done');
        onComplete?.();
      }, BLACKOUT_DURATION * 1000);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  const clampedProgress = Math.min(100, Math.max(0, progress));
  const isClosing = phase === 'closing' || phase === 'blackout' || phase === 'done';
  const contentVisible = !isClosing && phase !== 'expanding';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'done' ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,1)',
        ...GPU_LAYER,
      }}
    >
      {/* Top line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          y: linesExpanded ? -LINE_GAP_EXPANDED : 0,
          opacity: isClosing ? 0 : 1,
        }}
        transition={{
          y: { duration: isClosing ? CLOSING_DURATION : LINE_EXPAND_DURATION, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.8 },
        }}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          marginLeft: -(LINE_WIDTH / 2),
          marginTop: -(LINE_HEIGHT / 2),
          zIndex: 1,
          width: LINE_WIDTH,
          height: LINE_HEIGHT,
          background: COLORS.white,
          borderRadius: LINE_HEIGHT,
          boxShadow: `0 0 ${LINE_GLOW_SPREAD}px rgba(255,255,255,0.6)`,
          willChange: 'transform',
          ...GPU_LAYER,
        }}
      />

      {/* Bottom line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          y: linesExpanded ? LINE_GAP_EXPANDED : 0,
          opacity: isClosing ? 0 : 1,
        }}
        transition={{
          y: { duration: isClosing ? CLOSING_DURATION : LINE_EXPAND_DURATION, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.8 },
        }}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          marginLeft: -(LINE_WIDTH / 2),
          marginTop: -(LINE_HEIGHT / 2),
          zIndex: 1,
          width: LINE_WIDTH,
          height: LINE_HEIGHT,
          background: COLORS.white,
          borderRadius: LINE_HEIGHT,
          boxShadow: `0 0 ${LINE_GLOW_SPREAD}px rgba(255,255,255,0.6)`,
          willChange: 'transform',
          ...GPU_LAYER,
        }}
      />

      {/* Center content */}
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2,
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: contentVisible ? 1 : 0,
            scale: isClosing ? 0.9 : 1,
          }}
          transition={{ duration: isClosing ? 0.3 : 0.8, delay: contentVisible && !isClosing ? 0.4 : 0 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 40,
            ...GPU_LAYER,
          }}
        >
          {/* 로고 — clip-path 채우기 */}
          <div style={{
            overflow: 'hidden',
            height: LOGO_CONTAINER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <img
              src="/logo.png"
              alt="BEANCRAFT"
              style={{
                height: LOGO_RENDER_HEIGHT,
                width: 'auto',
                objectFit: 'contain',
                filter: 'grayscale(100%) brightness(0.8)',
                opacity: 0.3,
                ...GPU_LAYER,
              }}
            />
            <img
              src="/logo.png"
              alt="BEANCRAFT"
              style={{
                position: 'absolute',
                height: LOGO_RENDER_HEIGHT,
                width: 'auto',
                objectFit: 'contain',
                clipPath: `inset(0 ${100 - clampedProgress}% 0 0)`,
                transition: 'clip-path 0.5s ease-out',
                willChange: 'clip-path',
                ...GPU_LAYER,
              }}
            />
            <AnimatePresence>
              {phase === 'shockwave' && (
                <motion.div
                  initial={{ width: 0, height: 0, opacity: 0.8 }}
                  animate={{ width: 600, height: 600, opacity: 0 }}
                  transition={{ duration: SHOCKWAVE_DURATION, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    border: `2px solid ${COLORS.white}`,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* 버튼 영역 */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <motion.button
              onClick={handleCompleteClick}
              whileHover={phase === 'waitClick' ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
              whileTap={phase === 'waitClick' ? { scale: 0.96 } : {}}
              style={{
                minWidth: 120,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${COLORS.whiteBorder}`,
                borderRadius: 6,
                padding: '10px 32px',
                background: 'transparent',
                cursor: phase === 'waitClick' ? 'pointer' : 'default',
              }}
            >
              <span style={{
                color: COLORS.white,
                fontSize: 14,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.05em',
              }}>
                {clampedProgress >= 100 ? '분석 완료' : `${Math.round(clampedProgress)}%`}
              </span>
            </motion.button>

            <HoverSlideButton onClick={onGoHomepage} label="홈페이지" hoverLabel="바로가기" />
          </div>
        </motion.div>
      </div>

      {/* "잠시만 기다려주세요" — 하단 선 아래 */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: contentVisible ? 0.4 : 0 }}
        transition={{ duration: 0.8, delay: contentVisible ? 0.6 : 0 }}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          marginTop: LINE_GAP_EXPANDED + 16,
          transform: 'translateX(-50%)',
          zIndex: 2,
          color: COLORS.white,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {clampedProgress >= 100 ? '분석 완료를 눌러주세요' : '잠시만 기다려주세요'}
      </motion.span>
    </motion.div>
  );
}
