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
  // [bugfix 2026-05-19] 함수형 업데이터로 변경: 동시 setState 와 충돌해도 phase 가
  // closing/blackout/done 이면 절대 waitClick 으로 되돌아가지 않도록 가드.
  // [bugfix 2026-05-19 v2] progress prop 이 100 도달 못해도 displayProgress 가
  // 100 도달했으면 waitClick 으로 전환 (사용자 화면에 "분석 완료" 보이면 클릭 가능해야 함).
  //   원인: ClientMode가 progressRef 가드로 setLoadingProgress(100) 누락 시
  //   progress prop은 100 미만이지만 displayProgress 보간으로 100 도달 가능.
  useEffect(() => {
    if (displayProgress >= 100) {
      setPhase((cur) => (cur === 'ready' ? 'waitClick' : cur));
    }
  }, [displayProgress, progress]);

  // 재검색 버튼 — 현재 분석 중단 + 검색 시작 화면으로 복귀
  const handleReSearchClick = () => {
    if (typeof onCancel === 'function') {
      onCancel();
    } else if (typeof onSearch === 'function') {
      // 폴백: 부모가 onCancel을 제공하지 않으면 빈 문자열 전달
      onSearch('');
    }
  };

  // [bugfix 2026-05-19] 클릭이 발생해도 phase 가 closing 으로 안 바뀌는 배포 버그.
  // 원인: motion.button + whileTap 의 pointer-event 처리가 React 합성 onClick 과 충돌해
  //       onClick 콜백 안에서 호출한 setState 가 다음 commit 직전에 가로채진 사례가 있음.
  // 해법:
  //  1) motion.button -> 일반 button 으로 교체 (아래 렌더 부분)
  //  2) setPhase 를 함수형 업데이터로 변경해 클로저 stale 값 위험 제거
  //  3) ready 상태에서도 한 번에 closing 으로 보낼 수 있게 가드 완화 (waitClick 이펙트보다 빨라도 OK)
  //  4) 클릭 발생을 배포에서 확인할 수 있도록 console.log 1회만 출력
  const completeClickedRef = useRef(false);
  const handleCompleteClick = () => {
    if (completeClickedRef.current) return; // 중복 클릭/이중 발화 차단
    setPhase((cur) => {
      // [bugfix 2026-05-19 v2] progress prop 의존 제거. displayProgress 만 100 이면 클릭 허용.
      if (cur === 'waitClick' || (cur === 'ready' && displayProgress >= 100)) {
        completeClickedRef.current = true;
        if (typeof console !== 'undefined') console.log('[LoadingScreen] complete click -> closing');
        return 'closing';
      }
      if (typeof console !== 'undefined') console.log('[LoadingScreen] complete click ignored, phase=', cur);
      return cur;
    });
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
        transition={{ duration: 0.8, delay: contentVisible ? 0.5 : 0 }}
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
                // [bugfix 2026-05-19 v3] pointerdown 단계에서 먼저 트리거.
                //   원인 가설: 부모 motion.div 의 framer-motion 변환(scale/opacity)
                //   재계산 타이밍과 button 의 click 사이클이 충돌해 onClick 이 발화
                //   되지 않음. pointerdown 은 click 보다 먼저 발생하고 motion 변환과
                //   독립적이므로 가장 확실한 트리거 경로.
                if (phase === 'waitClick') {
                  e.stopPropagation();
                  handleCompleteClick();
                }
              }}
              onMouseDown={(e) => {
                // 보조: 일부 데스크톱 브라우저에서 pointerdown 미발화 사례 대비.
                if (phase === 'waitClick') {
                  e.stopPropagation();
                  handleCompleteClick();
                }
              }}
              onPointerUp={(e) => {
                // 보조 트리거: 일부 브라우저(특히 모바일 PWA)에서 click 이 안 올라오는 경우 대비
                if (phase === 'waitClick') {
                  e.stopPropagation();
                  handleCompleteClick();
                }
              }}
              className="bc-loading-complete-btn"
              data-active={phase === 'waitClick' ? 'true' : 'false'}
              style={{
                // [bugfix 2026-05-19 v3] 동일 zIndex 스택에서 motion 형제 요소가
                // 클릭을 가로채지 않도록 position+zIndex 명시.
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
                cursor: phase === 'waitClick' ? 'pointer' : 'default',
                transition: 'background-color 0.15s, transform 0.1s',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                // 클릭 가로채기 방지
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
        {displayProgress >= 100 ? '분석 완료를 눌러주세요' : '잠시만 기다려주세요'}
      </motion.span>
    </motion.div>
  );
}
