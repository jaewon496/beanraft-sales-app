import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS, TIMING, BLUR } from './constants';

// ─── Animation Constants ───
const LINE_GAP_INITIAL = 0;
const LINE_GAP_EXPANDED = 160;
const LINE_WIDTH = 280;
const LINE_HEIGHT = 2;
const LINE_GLOW_SPREAD = 8;
const TITLE_DELAY = 0.6;
const BUTTONS_DELAY = 1.0;
const BG_SCALE_FROM = 1.0;
const BG_SCALE_TO = 1.15;
const MAGNETIC_STRENGTH = 0.15;
const MAGNETIC_RANGE = 120;
const TEXT_SLIDE_DURATION = 0.3;
const CLOSING_DURATION = 0.8;     // seconds for lines to close back
const BLACKOUT_DURATION = 0.6;    // seconds to hold black before navigating

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function MagneticButton({ children, onClick, disabled = false, hoverText, hoverColor = COLORS.white }) {
  const ref = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < MAGNETIC_RANGE) {
      const factor = MAGNETIC_STRENGTH * (1 - dist / MAGNETIC_RANGE);
      setOffset({ x: dx * factor, y: dy * factor });
    } else {
      setOffset({ x: 0, y: 0 });
    }
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  return (
    <motion.button
      ref={ref}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'transparent',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.2)' : (isHovered ? COLORS.navy : COLORS.whiteBorder)}`,
        borderRadius: 6,
        padding: '10px 32px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        minWidth: 120,
        height: 44,
        boxShadow: isHovered && !disabled ? `0 0 12px ${COLORS.navyTranslucent}` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <motion.span
        animate={{ x: isHovered && !disabled ? -60 : 0, opacity: isHovered && !disabled ? 0 : 1 }}
        transition={{ duration: TEXT_SLIDE_DURATION }}
        style={{ display: 'block', color: COLORS.white, fontSize: 14, fontWeight: 500, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
      >
        {children}
      </motion.span>
      <motion.span
        animate={{ x: isHovered && !disabled ? 0 : 60, opacity: isHovered && !disabled ? 1 : 0 }}
        transition={{ duration: TEXT_SLIDE_DURATION }}
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, color: hoverColor, fontSize: 14, fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap',
        }}
      >
        {hoverText || children}
        {!disabled && <ArrowRightIcon />}
      </motion.span>
    </motion.button>
  );
}

export default function EntryScreen({
  onNavigate = () => {},
  loading = false,
  complete = false,
  progress = 0,
  progressText = '',
  onAbortAnalysis = null,
  onGoHome = null,
  onComplete = null,
}) {
  // phases: lines -> expanded -> ready -> closing -> blackout -> done
  const [phase, setPhase] = useState('init');  // init -> lines -> expanded -> ready
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgVisible, setBgVisible] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/cafe-bg.jpg';
  }, []);

  useEffect(() => {
    // init(검정 1초) -> lines(선 페이드인 + 배경 서서히) -> 1초 후 expanded(선 벌어짐) -> ready(콘텐츠)
    const t0 = setTimeout(() => {
      setPhase('lines');
      setBgVisible(true);
    }, 1000);
    const t1 = setTimeout(() => setPhase('expanded'), 1000 + 1000);
    const t2 = setTimeout(() => setPhase('ready'), 1000 + 1000 + TIMING.entryLineExpand);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Handle closing -> blackout -> navigate
  useEffect(() => {
    if (phase === 'closing') {
      const t = setTimeout(() => setPhase('blackout'), CLOSING_DURATION * 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'blackout') {
      const t = setTimeout(() => {
        setPhase('done');
        onNavigate('search');
      }, BLACKOUT_DURATION * 1000);
      return () => clearTimeout(t);
    }
  }, [phase, onNavigate]);

  const handleStartClick = useCallback(() => {
    if (phase === 'ready') {
      setPhase('closing');
    }
  }, [phase]);

  const isClosingOrDone = phase === 'closing' || phase === 'blackout' || phase === 'done';
  const linesExpanded = (phase === 'expanded' || phase === 'ready') && !isClosingOrDone;
  const linesVisible = phase !== 'init';
  const contentVisible = phase === 'ready';

  // ─── Loading Mode ───
  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: COLORS.black,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
        }}
      >
        {/* Top line */}
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            marginLeft: -(LINE_WIDTH / 2),
            marginTop: -(LINE_GAP_EXPANDED + LINE_HEIGHT / 2),
            zIndex: 1,
            width: LINE_WIDTH,
            height: LINE_HEIGHT,
            background: COLORS.white,
            borderRadius: LINE_HEIGHT,
            boxShadow: `0 0 ${LINE_GLOW_SPREAD}px rgba(255,255,255,0.6)`,
          }}
        />

        {/* Bottom line */}
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            marginLeft: -(LINE_WIDTH / 2),
            marginTop: LINE_GAP_EXPANDED - LINE_HEIGHT / 2,
            zIndex: 1,
            width: LINE_WIDTH,
            height: LINE_HEIGHT,
            background: COLORS.white,
            borderRadius: LINE_HEIGHT,
            boxShadow: `0 0 ${LINE_GLOW_SPREAD}px rgba(255,255,255,0.6)`,
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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
          }}
        >
          {/* BEANCRAFT Logo */}
          <div style={{ overflow: 'hidden', height: 126, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src="/logo.png"
              alt="BEANCRAFT"
              style={{
                height: 360,
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Progress/Complete + Homepage buttons */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {complete ? (
              <MagneticButton onClick={onComplete} hoverText="결과 보기" hoverColor={COLORS.white}>
                분석 완료
              </MagneticButton>
            ) : (
              <MagneticButton disabled onClick={() => {}} hoverText={`${progress}%`} hoverColor={COLORS.white}>
                {progress}%
              </MagneticButton>
            )}
            {onGoHome && (
              <MagneticButton onClick={onGoHome} hoverText="홈페이지" hoverColor={COLORS.white}>
                홈페이지
              </MagneticButton>
            )}
          </div>

          {/* Abort button - 로딩 중에만 표시 */}
          {!complete && onAbortAnalysis && (
            <button
              onClick={onAbortAnalysis}
              style={{
                marginTop: 4, padding: '6px 18px', borderRadius: 4, fontSize: 11, fontWeight: 400,
                background: 'transparent', color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                transition: 'all 0.2s', fontFamily: 'Pretendard, sans-serif',
              }}
            >
              분석 중지
            </button>
          )}
        </div>

        {/* Bottom text */}
        <span
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
            opacity: 0.4,
          }}
        >
          {complete ? '분석이 완료되었습니다' : (progressText || '잠시만 기다려주세요')}
        </span>
      </div>
    );
  }

  // ─── Intro Mode (original) ───
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.black,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background image with Ken Burns */}
      <motion.div
        initial={{ opacity: 0, scale: BG_SCALE_FROM }}
        animate={{
          opacity: isClosingOrDone ? 0 : (bgLoaded && bgVisible ? 0.4 : 0),
          scale: bgLoaded && bgVisible ? BG_SCALE_TO : BG_SCALE_FROM,
        }}
        transition={{
          opacity: { duration: isClosingOrDone ? CLOSING_DURATION : 2.5, ease: 'easeOut' },
          scale: { duration: TIMING.kenBurnsSpeed, ease: 'linear' },
        }}
        style={{
          position: 'absolute',
          inset: -40,
          backgroundImage: 'url(/cafe-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: `blur(${BLUR.bgBlur}px)`,
          willChange: 'transform, opacity',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          pointerEvents: 'none',
        }}
      />

      {/* Content: BEANCRAFT + buttons — ready 이후에만 렌더링 */}
      {(contentVisible || isClosingOrDone) && (
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
              opacity: isClosingOrDone ? 0 : 1,
              scale: isClosingOrDone ? 0.9 : 1,
            }}
            transition={{ duration: isClosingOrDone ? 0.3 : 0.8 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 40,
              pointerEvents: contentVisible ? 'auto' : 'none',
            }}
          >
            <div style={{ overflow: 'hidden', height: 126, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/logo.png"
                alt="BEANCRAFT"
                style={{
                  height: 360,
                  width: 'auto',
                  objectFit: 'contain',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <MagneticButton disabled={false} onClick={() => {}} hoverText="사용법" hoverColor={COLORS.white}>
                사용법
              </MagneticButton>
              <MagneticButton onClick={handleStartClick} hoverText="시작하기" hoverColor={COLORS.white}>
                검색
              </MagneticButton>
            </div>
          </motion.div>
        </div>
      )}

      {/* Top line: margin으로 중앙 정렬 (transform 안 씀 → framer y 충돌 없음) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          y: linesExpanded ? -LINE_GAP_EXPANDED : 0,
          opacity: (isClosingOrDone || phase === 'init') ? 0 : 1,
        }}
        transition={{
          y: { duration: isClosingOrDone ? CLOSING_DURATION : TIMING.entryLineExpand / 1000, ease: [0.22, 1, 0.36, 1] },
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
        }}
      />

      {/* Bottom line: margin으로 중앙 정렬 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          y: linesExpanded ? LINE_GAP_EXPANDED : 0,
          opacity: (isClosingOrDone || phase === 'init') ? 0 : 1,
        }}
        transition={{
          y: { duration: isClosingOrDone ? CLOSING_DURATION : TIMING.entryLineExpand / 1000, ease: [0.22, 1, 0.36, 1] },
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
        }}
      />

      {/* 하단 선 아래 텍스트 — ready 이후만 */}
      {(contentVisible || isClosingOrDone) && <motion.span
        initial={{ opacity: 0 }}
        animate={{
          opacity: isClosingOrDone ? 0 : 0.4,
        }}
        transition={{ duration: 0.8, delay: !isClosingOrDone ? 0.3 : 0 }}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          marginTop: LINE_GAP_EXPANDED + 16,
          marginLeft: 0,
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
        상권 분석 프로그램
      </motion.span>}
    </div>
  );
}
