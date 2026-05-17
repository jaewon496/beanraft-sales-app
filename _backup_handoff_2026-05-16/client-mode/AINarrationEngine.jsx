import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AINarrationEngine
 * ─────────────────
 * Cinematic narration engine that plays a JSON script { segments: [...] }
 * over live card elements in the DOM. Each segment zooms into a target
 * (matched by data-anim-id), blurs siblings, runs an animation preset,
 * speaks the narration via Web Speech API and renders a subtitle.
 *
 * TODO: replace `script` prop consumer with Gemini-produced JSON once
 *       the backend narration pipeline lands.
 *
 * Script schema:
 *   interface NarrationSegment {
 *     text: string;
 *     target: string;  // must match a data-anim-id somewhere in document
 *     anim: 'barFill' | 'donutFill' | 'slotRoll' | 'countUp' | 'ringProgress' | 'borderGlow';
 *     duration: number;  // ms
 *     value?: number;
 *     unit?: string;
 *     emphasis?: 'gold' | 'mint' | 'red' | 'navy';
 *   }
 */

// ─── Emphasis palette (dark-mode aware, matches design system) ───
const EMPHASIS_COLORS = {
  gold: '#F5B93A',
  mint: '#3ED7B3',
  red: '#F04452',
  navy: '#1E3A8A',
};

const getEmphasisColor = (key) => EMPHASIS_COLORS[key] || EMPHASIS_COLORS.navy;

// ─── Utility: format a number with a Korean unit ───
const formatNumberWithUnit = (value, unit) => {
  if (value == null || isNaN(value)) return '';
  const rounded = Math.round(value);
  const withComma = rounded.toLocaleString();
  return unit ? `${withComma}${unit}` : withComma;
};

// ─── Select a Korean female voice when available ───
const pickKoreanVoice = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  const ko = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('ko'));
  if (ko.length === 0) return null;
  const female = ko.find((v) => /female|여성|yuna|heami|sora|nara|seoyeon/i.test(v.name));
  return female || ko[0];
};

// ─── Easing helpers ───
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Run an animation preset against a target DOM element. Returns a cleanup
 * function that restores the original inline style.
 */
const runAnimPreset = ({ anim, target, duration, value, unit, emphasis }) => {
  if (!target) return () => {};

  const color = getEmphasisColor(emphasis);
  const originalStyle = target.getAttribute('style') || '';
  const originalText = target.textContent;
  let rafId = null;
  let pulseTimers = [];

  const restore = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    pulseTimers.forEach(clearTimeout);
    pulseTimers = [];
    target.setAttribute('style', originalStyle);
    // Only restore text content for presets that mutate it
    if (['countUp', 'slotRoll', 'ringProgress'].includes(anim)) {
      target.textContent = originalText;
    }
  };

  if (anim === 'countUp') {
    const start = performance.now();
    const from = 0;
    const to = Number(value) || 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      target.textContent = formatNumberWithUnit(from + (to - from) * eased, unit);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  } else if (anim === 'slotRoll') {
    // Slot-machine feel: rapid scrambling counts that converge to the target.
    const start = performance.now();
    const to = Number(value) || 0;
    target.style.transition = 'transform 0.2s ease-out';
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      if (t < 0.8) {
        const jitter = Math.floor(Math.random() * to * (1 - eased));
        target.textContent = formatNumberWithUnit(Math.round(to * eased) + jitter, unit);
      } else {
        target.textContent = formatNumberWithUnit(to * eased, unit);
      }
      if (t < 1) rafId = requestAnimationFrame(step);
      else target.textContent = formatNumberWithUnit(to, unit);
    };
    rafId = requestAnimationFrame(step);
  } else if (anim === 'barFill') {
    // Use a scaleY transform so any element can "fill". Keep natural layout by
    // wrapping via transform-origin.
    target.style.transformOrigin = 'bottom center';
    target.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    target.style.transform = 'scaleY(0.05)';
    // Next tick: expand.
    pulseTimers.push(setTimeout(() => { target.style.transform = 'scaleY(1)'; }, 30));
  } else if (anim === 'donutFill') {
    // Rotate + reveal using conic-gradient overlay would need injection;
    // simulate via rotation + scale for generic elements.
    const pct = Math.max(0, Math.min(1, (Number(value) || 0) / 100));
    target.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    target.style.transform = 'rotate(0deg) scale(0.95)';
    pulseTimers.push(setTimeout(() => {
      target.style.transform = `rotate(${360 * pct}deg) scale(1)`;
    }, 30));
  } else if (anim === 'ringProgress') {
    // Animate numeric content (0 -> value) while pulsing a ring glow.
    const start = performance.now();
    const to = Number(value) || 0;
    target.style.transition = `box-shadow ${duration}ms ease-out`;
    target.style.boxShadow = `0 0 0px ${color}00`;
    pulseTimers.push(setTimeout(() => {
      target.style.boxShadow = `0 0 24px ${color}`;
    }, 30));
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      target.textContent = formatNumberWithUnit(to * eased, unit);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  } else if (anim === 'borderGlow') {
    // Two-pulse border glow.
    target.style.transition = `box-shadow 500ms ease-out, border-color 500ms ease-out`;
    const pulse = (delay) => {
      pulseTimers.push(setTimeout(() => {
        target.style.boxShadow = `0 0 20px ${color}`;
      }, delay));
      pulseTimers.push(setTimeout(() => {
        target.style.boxShadow = `0 0 0 ${color}00`;
      }, delay + 500));
    };
    pulse(0);
    pulse(900);
  } else {
    // Fallback: gentle glow
    target.style.transition = `box-shadow ${duration}ms ease-out`;
    target.style.boxShadow = `0 0 16px ${color}`;
  }

  return restore;
};

/**
 * Apply the cinematic zoom + sibling blur. Returns cleanup.
 */
const applyZoomFocus = (target, emphasis) => {
  if (!target) return () => {};
  const color = getEmphasisColor(emphasis);

  // Save originals
  const prevTransform = target.style.transform;
  const prevTransition = target.style.transition;
  const prevZIndex = target.style.zIndex;
  const prevPosition = target.style.position;
  const prevBoxShadow = target.style.boxShadow;
  const prevOutline = target.style.outline;

  // Zoom in.
  target.style.transition = 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 500ms ease-out';
  if (!prevPosition || prevPosition === 'static') target.style.position = 'relative';
  target.style.zIndex = '5';
  target.style.transform = 'scale(1.08)';
  target.style.boxShadow = `0 0 32px ${color}aa`;
  target.style.outline = `2px solid ${color}`;

  // Blur & dim siblings within the same dashboard scroller.
  const scroller =
    target.closest('.unified-cards-scroll') ||
    target.closest('[data-narration-root]') ||
    document.body;
  const siblings = scroller.querySelectorAll('[data-card-section-index]');
  const restoreList = [];
  siblings.forEach((sib) => {
    if (sib.contains(target) || target.contains(sib)) return;
    const prevFilter = sib.style.filter;
    const prevOpacity = sib.style.opacity;
    const prevSibTransition = sib.style.transition;
    sib.style.transition = 'filter 600ms ease-out, opacity 600ms ease-out';
    sib.style.filter = 'blur(6px)';
    sib.style.opacity = '0.3';
    restoreList.push(() => {
      sib.style.filter = prevFilter;
      sib.style.opacity = prevOpacity;
      sib.style.transition = prevSibTransition;
    });
  });

  return () => {
    // Zoom out.
    target.style.transform = prevTransform || 'scale(1)';
    target.style.boxShadow = prevBoxShadow || '';
    target.style.outline = prevOutline || '';
    // Restore after the transition completes.
    setTimeout(() => {
      target.style.transition = prevTransition;
      target.style.zIndex = prevZIndex;
      target.style.position = prevPosition;
    }, 700);
    restoreList.forEach((fn) => fn());
  };
};

// ─── Outline button (transparent + white border, spec) ───
const OutlineBtn = ({ onClick, children, active = false, title, style: extra = {} }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
      border: '1px solid #FFFFFF',
      color: '#FFFFFF',
      borderRadius: 8,
      padding: '6px 12px',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      letterSpacing: '0.02em',
      fontFamily: 'Pretendard, sans-serif',
      transition: 'background 0.15s ease-out',
      whiteSpace: 'nowrap',
      ...extra,
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.background = 'transparent';
    }}
  >
    {children}
  </button>
);

const AINarrationEngine = ({
  script,
  muted = false,
  onRequestMuteToggle = null,
  autoPlay = false,
}) => {
  const segments = Array.isArray(script?.segments) ? script.segments : [];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [subtitle, setSubtitle] = useState('');
  const [localMuted, setLocalMuted] = useState(muted);

  // Refs for cleanup across renders
  const cleanupRefs = useRef([]);
  const segmentTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const currentUtterRef = useRef(null);
  const resolvedVoiceRef = useRef(null);

  // Keep local muted state in sync with prop.
  useEffect(() => { setLocalMuted(muted); }, [muted]);

  // Preload voices. Chrome fires voiceschanged asynchronously.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => { resolvedVoiceRef.current = pickKoreanVoice(); };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, []);

  // Clear all running effects/timers/TTS.
  const clearAll = useCallback(() => {
    cleanupRefs.current.forEach((fn) => { try { fn(); } catch {} });
    cleanupRefs.current = [];
    if (segmentTimerRef.current) { clearTimeout(segmentTimerRef.current); segmentTimerRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    currentUtterRef.current = null;
  }, []);

  // Speak a segment via Web Speech API.
  const speak = useCallback((text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (localMuted) return;
    if (!text) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ko-KR';
      utter.rate = speed;
      utter.pitch = 1;
      utter.volume = 1;
      if (resolvedVoiceRef.current) utter.voice = resolvedVoiceRef.current;
      currentUtterRef.current = utter;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      // Silent-fail: engine still works without TTS.
    }
  }, [localMuted, speed]);

  // Play a single segment (kick animations, subtitle, TTS) then schedule next.
  const playSegment = useCallback((i) => {
    const seg = segments[i];
    if (!seg) {
      setPlaying(false);
      return;
    }

    // Clean up any prior segment.
    cleanupRefs.current.forEach((fn) => { try { fn(); } catch {} });
    cleanupRefs.current = [];

    setSubtitle(seg.text || '');

    // Find target in live DOM by data-anim-id; fall back to subtree of any
    // element so that we work both inside and outside the dashboard.
    const target = document.querySelector(`[data-anim-id="${seg.target}"]`);

    if (target) {
      const zoomCleanup = applyZoomFocus(target, seg.emphasis);
      const animCleanup = runAnimPreset({
        anim: seg.anim,
        target,
        duration: Math.max(400, (seg.duration || 3000) - 400),
        value: seg.value,
        unit: seg.unit,
        emphasis: seg.emphasis,
      });
      cleanupRefs.current.push(animCleanup, zoomCleanup);
    }

    // TTS (skip if muted — subtitle still shows).
    speak(seg.text || '');

    // Advance.
    const realDur = Math.max(1500, (seg.duration || 3000) / speed);
    segmentTimerRef.current = setTimeout(() => {
      // 0.3s breathing room between segments.
      cleanupRefs.current.forEach((fn) => { try { fn(); } catch {} });
      cleanupRefs.current = [];
      if (i + 1 < segments.length) {
        setTimeout(() => {
          setIndex(i + 1);
          playSegment(i + 1);
        }, 300);
      } else {
        setPlaying(false);
        setSubtitle('');
      }
    }, realDur);
  }, [segments, speak, speed]);

  const handlePlay = useCallback(() => {
    if (segments.length === 0) return;
    setPlaying(true);
    setElapsed(0);
    // Start elapsed ticker for the scrubber.
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => setElapsed((e) => e + 100), 100);
    playSegment(index);
  }, [segments.length, playSegment, index]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    clearAll();
  }, [clearAll]);

  const handleRestart = useCallback(() => {
    clearAll();
    setIndex(0);
    setElapsed(0);
    setSubtitle('');
    // Defer one tick so cleanups settle before we replay.
    setTimeout(() => {
      setPlaying(true);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(() => setElapsed((e) => e + 100), 100);
      playSegment(0);
    }, 50);
  }, [clearAll, playSegment]);

  const handleScrub = useCallback((i) => {
    const target = Math.max(0, Math.min(segments.length - 1, i));
    clearAll();
    setIndex(target);
    setElapsed(0);
    setSubtitle(segments[target]?.text || '');
    if (playing) {
      setTimeout(() => playSegment(target), 50);
    }
  }, [clearAll, playSegment, playing, segments]);

  const handleToggleMute = useCallback(() => {
    const next = !localMuted;
    setLocalMuted(next);
    if (typeof window !== 'undefined' && window.speechSynthesis && next) {
      window.speechSynthesis.cancel();
    }
    if (onRequestMuteToggle) onRequestMuteToggle(next);
  }, [localMuted, onRequestMuteToggle]);

  // Auto-play if requested.
  useEffect(() => {
    if (autoPlay && segments.length > 0) {
      handlePlay();
    }
    return () => clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When speed changes mid-play, re-voice current utter.
  useEffect(() => {
    if (currentUtterRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
      // SpeechSynthesis does not support mid-speech rate change; we swap on next segment.
    }
  }, [speed]);

  // Unmount: nuke everything.
  useEffect(() => () => clearAll(), [clearAll]);

  if (segments.length === 0) {
    return (
      <div
        data-narration-root="true"
        style={{
          background: '#000',
          borderRadius: 12,
          padding: 20,
          color: 'rgba(255,255,255,0.6)',
          fontSize: 13,
          textAlign: 'center',
          fontFamily: 'Pretendard, sans-serif',
        }}
      >
        나레이션 스크립트가 없습니다.
      </div>
    );
  }

  const cur = segments[index] || {};
  const totalDuration = segments.reduce((s, x) => s + (x.duration || 3000), 0);

  return (
    <div
      data-narration-root="true"
      style={{
        background: '#000000',
        borderRadius: 12,
        padding: 14,
        color: '#FFFFFF',
        fontFamily: 'Pretendard, sans-serif',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* ── Top row: status + segment index ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)' }}>
          시네마틱 나레이션 엔진
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
          {index + 1} / {segments.length}
        </div>
      </div>

      {/* ── Subtitle band ── */}
      <div
        style={{
          minHeight: 54,
          background: 'rgba(0,0,0,0.55)',
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          border: `1px solid ${getEmphasisColor(cur.emphasis)}55`,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={subtitle || 'empty'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: '#FFFFFF',
              lineHeight: 1.5,
              textAlign: 'center',
              letterSpacing: '-0.005em',
            }}
          >
            {subtitle || '재생 버튼을 눌러 나레이션을 시작하세요.'}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Controls row ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!playing ? (
            <OutlineBtn onClick={handlePlay} title="재생">▶ 재생</OutlineBtn>
          ) : (
            <OutlineBtn onClick={handlePause} title="일시정지">❚❚ 일시정지</OutlineBtn>
          )}
          <OutlineBtn onClick={handleRestart} title="다시보기">↺ 다시보기</OutlineBtn>
          <OutlineBtn onClick={handleToggleMute} title="음소거" active={localMuted}>
            {localMuted ? '음소거 해제' : '음소거'}
          </OutlineBtn>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 1.5, 2].map((s) => (
            <OutlineBtn
              key={s}
              active={speed === s}
              onClick={() => setSpeed(s)}
              title={`${s}x 속도`}
            >
              {s}x
            </OutlineBtn>
          ))}
        </div>
      </div>

      {/* ── Timeline scrubber ── */}
      <div style={{ marginTop: 12 }}>
        <input
          type="range"
          min={0}
          max={Math.max(0, segments.length - 1)}
          step={1}
          value={index}
          onChange={(e) => handleScrub(Number(e.target.value))}
          style={{
            width: '100%',
            accentColor: getEmphasisColor(cur.emphasis),
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'rgba(255,255,255,0.4)',
            marginTop: 4,
          }}
        >
          <span>세그먼트 {index + 1}</span>
          <span>전체 {Math.round(totalDuration / 1000)}s</span>
        </div>
      </div>
    </div>
  );
};

export default AINarrationEngine;
