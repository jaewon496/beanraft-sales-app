import React, { useEffect, useRef, useState } from 'react';
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
        initial={{ x: 0, opacity: 1 }}
        animate={{ x: isHovered ? -60 : 0, opacity: isHovered ? 0 : 1 }}
        transition={{ duration: TEXT_SLIDE_DURATION }}
        style={{
          display: 'block', color: COLORS.white, fontSize: 14, fontWeight: 500, letterSpacing: '0.05em', whiteSpace: 'nowrap',
          willChange: 'transform, opacity', transform: 'translateZ(0)', backfaceVisibility: 'hidden',
        }}
      >
        {label}
      </motion.span>
      <motion.span
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: isHovered ? 0 : 60, opacity: isHovered ? 1 : 0 }}
        transition={{ duration: TEXT_SLIDE_DURATION }}
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, color: COLORS.white, fontSize: 14, fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap',
          willChange: 'transform, opacity', transform: 'translateZ(0)', backfaceVisibility: 'hidden',
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
  transform: 'translateZ(0)',
};

export default function LoadingScreen({ progress = 0, onComplete, onGoHomepage, onSearch, onCancel }) {
  // phases: expanding -> ready -> shockwave -> closing -> blackout -> done
  const [phase, setPhase] = useState('expanding');
  const [linesExpanded, setLinesExpanded] = useState(false);
  // 화면에 표시되는 진행률 — 실제 progress 값에 1씩 부드럽게 따라간다
  const [displayProgress, setDisplayProgress] = useState(0);

  // Lines expand on mount
  useEffect(() => {
    const t = setTimeout(() => {
      setLinesExpanded(true);
      setPhase('ready');
    }, 200);
    return () => clearTimeout(t);
  }, []);

  // displayProgress가 실제 progress에 1씩 부드럽게 따라가도록 보간
  useEffect(() => {
    const target = Math.min(100, Math.max(0, progress));
    if (displayProgress === target) return;
    // 차이가 클수록 빠르게 (40ms~12ms), 작을수록 자연스럽게
    const diff = Math.abs(target - displayProgress);
    const stepMs = Math.max(12, Math.min(40, Math.round(400 / Math.max(1, diff))));
    const id = setTimeout(() => {
      setDisplayProgress((cur) => {
        if (cur === target) return cur;
        return cur < target ? cur + 1 : cur - 1;
      });
    }, stepMs);
    return () => clearTimeout(id);
  }, [progress, displayProgress]);

  // 100% → waitClick (사용자 클릭 대기) — 표시 진행률 기준으로 전환
  // [bugfix 2026-05-19 v4] 진단 로그 추가: displayProgress/phase 추적
  useEffect(() => {
    if (typeof console !== 'undefined') {
      console.log('[LoadingScreen] tick progress=', progress, 'displayProgress=', displayProgress, 'phase=', phase);
    }
    if (displayProgress >= 100) {
      setPhase((cur) => (cur === 'ready' ? 'waitClick' : cur));
    }
  }, [displayProgress, progress, phase]);

  // 재검색 버튼 — 현재 분석 중단 + 검색 시작 화면으로 복귀
  const handleReSearchClick = () => {
    if (typeof onCancel === 'function') {
      onCancel();
    } else if (typeof onSearch === 'function') {
      // 폴백: 부모가 onCancel을 제공하지 않으면 빈 문자열 전달
      onSearch('');
    }
  };

  // [bugfix 2026-05-19 v4] phase 검사 자체를 제거.
  //   배경: v1~v3 까지 phase('ready'/'waitClick') 가드를 두고 클릭을 거르려 했지만,
  //         실제로는 displayProgress 보간 useEffect 가 발화되지 않아 phase 가 'ready'
  //         에 머무는 사례가 있었음. 가드를 두면 '버튼이 보이는데도 클릭이 무시되는'
  //         최악의 UX 가 발생. 가드 제거 + ref 중복 차단으로 단순화.
  //   - 사용자가 버튼을 누르면 무조건 'closing' 으로 전환.
  //   - completeClickedRef 로 다중 클릭/다중 이벤트 발화(pointerdown+click 중복) 차단.
  const completeClickedRef = useRef(false);
  const handleCompleteClick = () => {
    if (completeClickedRef.current) return; // 중복 클릭/이중 발화 차단
    completeClickedRef.current = true;
    if (typeof console !== 'undefined') console.log('[LoadingScreen] complete click -> closing');
    setPhase('closing');
  };

  // [bugfix 2026-05-19] onComplete 가 매 렌더마다 새 reference면 (부모가 inline 함수로 전달)
  // 이 effect의 cleanup이 매번 호출되어 closing/blackout setTimeout이 취소+재시작 됨.
  // 또한 setTimeout 콜백 안에서 setPhase('done') + onComplete() 두 가지가 호출되는데,
  // 콜백 실행 직후 onComplete 가 변경되면 useEffect 재실행되어 또 setTimeout 이 걸리고,
  // 결과적으로 setPhase('done') + onComplete() 가 두 번 호출되는 경우가 있음.
  // → onComplete 를 ref 로 안정화하고, 의존성에서 제거.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    if (phase === 'closing') {
      setLinesExpanded(false);
      const t = setTimeout(() => setPhase('blackout'), CLOSING_DURATION * 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'blackout') {
      const t = setTimeout(() => {
        setPhase('done');
        onCompleteRef.current?.();
      }, BLACKOUT_DURATION * 1000);
      return () => clearTimeout(t);
    }
  }, [phase]);

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
        // [bugfix 2026-05-19] zIndex 100 → 10002. FloatingProgress 가 10001 로 떠 있어
        // 동일 LOADING 단계에서 isHomepageOpen 이면 LoadingScreen 위를 덮어 클릭을
        // 가로채는 사례가 관찰됨. LoadingScreen 을 무조건 최상단으로 끌어올림.
        zIndex: 10002,
        backgroundColor: 'rgba(0,0,0,1)',
        ...GPU_LAYER,
      }}
    >
      {/* 모바일 반응형 — 2개 네모가 좁은 화면에서도 한 줄 유지되도록 패딩/최소너비 축소 */}
      <style>{`
        @media (max-width: 480px) {
          .bc-loading-actions { gap: 8px !important; }
          .bc-loading-actions > button { min-width: 88px !important; padding-left: 12px !important; padding-right: 12px !important; }
          .bc-loading-research { font-size: 13px !important; }
        }
        @media (max-width: 360px) {
          .bc-loading-actions { gap: 6px !important; }
          .bc-loading-actions > button { min-width: 76px !important; padding-left: 8px !important; padding-right: 8px !important; }
        }
        .bc-loading-research:hover { text-decoration: underline; opacity: 1 !important; }
        .bc-loading-complete-btn[data-active="true"]:hover { background-color: rgba(255,255,255,0.1) !important; }
        .bc-loading-complete-btn[data-active="true"]:active { transform: scale(0.96); }
      `}</style>

      {/* 재검색 텍스트 — 상단 흰 선 위쪽 (이전 검색 입력창 자리) */}
      <motion.span
        role="button"
        tabIndex={0}
        onClick={handleReSearchClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleReSearchClick();
          }
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: contentVisible ? 0.85 : 0 }}
        transition={{ duration: 0.6, delay: contentVisible ? 0.5 : 0, ease: [0.16, 1, 0.3, 1] }}
        className="bc-loading-research"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          marginTop: -(LINE_GAP_EXPANDED + 40),
          transform: 'translateX(-50%)',
          zIndex: 3,
          color: COLORS.white,
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '6px 12px',
        }}
      >
        재검색
      </motion.span>

      {/* Top line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          y: linesExpanded ? -LINE_GAP_EXPANDED : 0,
          opacity: isClosing ? 0 : 1,
        }}
        transition={{
          y: { duration: isClosing ? CLOSING_DURATION : LINE_EXPAND_DURATION, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
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
          willChange: 'transform, opacity',
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
          y: { duration: isClosing ? CLOSING_DURATION : LINE_EXPAND_DURATION, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
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
          willChange: 'transform, opacity',
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
          transition={{ duration: isClosing ? 0.3 : 0.7, delay: contentVisible && !isClosing ? 0.4 : 0, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 40,
            willChange: 'transform, opacity',
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
                clipPath: `inset(0 ${100 - displayProgress}% 0 0)`,
                transition: 'clip-path 80ms linear',
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

          {/* 버튼 영역 — 2개 네모 (진행률 / 홈페이지) */}
          <div
            className="bc-loading-actions"
            style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' }}
          >
            {/* 진행률 / 분석 완료 — [bugfix 2026-05-19] motion.button 의 pointer-event 가 onClick 을 가로채는
                케이스가 배포에서 관찰됨. framer-motion 의존을 제거하고 일반 button + CSS hover 로 교체. */}
            <button
              type="button"
              onClick={handleCompleteClick}
              onPointerDown={(e) => {
                // [bugfix 2026-05-19 v4] phase 가드 제거. completeClickedRef 가 다중 발화를 막음.
                e.stopPropagation();
                handleCompleteClick();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleCompleteClick();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                handleCompleteClick();
              }}
              className="bc-loading-complete-btn"
              data-active={(phase === 'waitClick' || (phase === 'ready' && displayProgress >= 100)) ? 'true' : 'false'}
              style={{
                position: 'relative',
                zIndex: 5,
                minWidth: 120,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${COLORS.whiteBorder}`,
                borderRadius: 6,
                padding: '10px 32px',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.15s, transform 0.1s',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                pointerEvents: 'auto',
              }}
            >
              <span style={{
                color: COLORS.white,
                fontSize: 14,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.05em',
                pointerEvents: 'none', // 텍스트가 클릭을 가로채지 않도록
              }}>
                {displayProgress >= 100 ? '분석 완료' : `${displayProgress}%`}
              </span>
            </button>

            {/* 홈페이지 */}
            <HoverSlideButton onClick={onGoHomepage} label="홈페이지" hoverLabel="바로가기" />
          </div>
        </motion.div>
      </div>

      {/* "잠시만 기다려주세요" — 하단 선 아래 */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: contentVisible ? 0.4 : 0 }}
        transition={{ duration: 0.6, delay: contentVisible ? 0.6 : 0, ease: [0.16, 1, 0.3, 1] }}
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
        {displayProgress >= 100 ? '분석 완료를 눌러주세요' : '잠시만 기다려주세요'}
      </motion.span>
    </motion.div>
  );
}
