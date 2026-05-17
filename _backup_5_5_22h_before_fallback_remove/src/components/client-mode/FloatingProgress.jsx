import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS, TIMING } from './constants';

/* ─── Constants ─── */
const RING_SIZE = 56;
const STROKE_WIDTH = 3;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const BADGE_DELAY = 0.3;

export default function FloatingProgress({ progress = 0, onReturnToResults }) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (progress >= 100 && !isComplete) {
      setIsComplete(true);
    }
  }, [progress, isComplete]);

  const clampedProgress = Math.min(100, Math.max(0, progress));
  const dashOffset = CIRCUMFERENCE - (clampedProgress / 100) * CIRCUMFERENCE;
  const ringColor = isComplete ? COLORS.navy : COLORS.white;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.8 }}
      animate={isComplete
        ? { opacity: 1, y: [0, -18, 0], scale: [1, 1.1, 1] }
        : { opacity: 1, y: 0, scale: 1 }
      }
      exit={{ opacity: 0, y: 40, scale: 0.8 }}
      transition={isComplete
        ? { duration: 0.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.4 }
        : { type: 'spring', stiffness: 300, damping: 25 }
      }
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 10001,
        cursor: 'pointer',
      }}
      onClick={onReturnToResults}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Pulse ring when complete */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: `1.5px solid ${COLORS.navy}`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Main circle */}
      <div
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* Background ring */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={COLORS.whiteBorder}
            strokeWidth={STROKE_WIDTH}
          />
          {/* Progress ring */}
          <motion.circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '50% 50%',
            }}
          />
        </svg>

        {/* Center text — 항상 흰색 */}
        <span
          style={{
            color: COLORS.white,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontVariantNumeric: 'tabular-nums',
            position: 'relative',
            zIndex: 1,
            lineHeight: 1,
          }}
        >
          {Math.round(clampedProgress)}
        </span>
      </div>

      {/* Completion badge */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ delay: BADGE_DELAY, type: 'spring', stiffness: 400, damping: 20 }}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              backgroundColor: COLORS.navy,
              color: COLORS.white,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
            }}
          >
            완료
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
