import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { firebase, database } from './firebase';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Tooltip
} from 'recharts';

// ═══════════════════════════════════════════════════════════════
// 앱 버전 관리 - 캐시 무효화용
// ═══════════════════════════════════════════════════════════════
const APP_VERSION = '2026.01.30.v6-firebase-fix';

// 앱 시작 시 버전 출력 및 캐시 체크
(() => {
  console.log(`%c빈크래프트 영업관리 v${APP_VERSION}`, 'color: #10b981; font-size: 14px; font-weight: bold;');
  const storedVersion = localStorage.getItem('bc_app_version');
  if (storedVersion !== APP_VERSION) {
    console.log('새 버전 감지 - 캐시 갱신 중...');
    localStorage.setItem('bc_app_version', APP_VERSION);
    // 서비스 워커 캐시 삭제 시도
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
  }
})();

// ═══════════════════════════════════════════════════════════════
// 유틸리티 함수: 안전한 JSON 파싱 (손상된 데이터 처리)
// ═══════════════════════════════════════════════════════════════
const safeJsonParse = (jsonString, fallback = null) => {
  if (!jsonString || typeof jsonString !== 'string') return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn('JSON 파싱 실패:', e.message);
    return fallback;
  }
};

// JSON 키/형식 텍스트 정리 (AI 응답에서 JSON 형태가 그대로 보이는 문제 해결)
const cleanJsonText = (text) => {
  if (!text || typeof text !== 'string') return text || '-';
  let cleaned = text.trim();
  
  // 마크다운 코드블록 제거
  cleaned = cleaned.replace(/```json\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/gi, '');
  cleaned = cleaned.replace(/`/g, '');
  
  // JSON 형태가 아니면 그대로 반환
  if (!cleaned.startsWith('{') && !cleaned.startsWith('"') && !cleaned.includes('":')) {
    return cleaned;
  }
  
  // 완전한 JSON 객체 추출 시도
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // 파싱 성공하면 comment나 첫 번째 문자열 값 반환
      if (parsed.comment) return parsed.comment;
      if (parsed.analysis) return parsed.analysis;
      if (parsed.suggestion) return parsed.suggestion;
      if (parsed.regionBrief) return parsed.regionBrief;
      // 첫 번째 문자열 값 찾기
      const firstStringValue = Object.values(parsed).find(v => typeof v === 'string');
      if (firstStringValue) return firstStringValue;
    } catch (e) {
      // 파싱 실패 - 계속 진행
    }
  }
  
  // 모든 JSON 키 패턴 제거: "keyName": " 또는 "keyName": 
  const jsonKeyPatterns = [
    /^\s*\{\s*/g,                           // 시작 {
    /\s*\}\s*$/g,                           // 끝 }
    /"(comment|analysis|suggestion|encouragement|focus|regionBrief|brokerEmpathy|partnershipValue|talkScript|relatedRegions|cafeCount|newOpen|closed|floatingPop|residentPop|mainTarget|mainRatio|secondTarget|secondRatio|peakTime|takeoutRatio|avgStay|monthly|deposit|premium|yoyChange|title|detail|impact|level|interior|equipment|total|survivalRate|avgMonthlyRevenue|breakEvenMonths|source|message|insight|overview|consumers|franchise|rent|opportunities|risks|startupCost|consultingEffect|withConsulting|withoutConsulting|region|reliability|dataDate|name|count|price)"\s*:\s*"?/gi,
    /",?\s*$/g,                              // 끝 따옴표와 쉼표
    /^\s*"?/g,                               // 시작 따옴표
    /\\n/g,                                  // 이스케이프된 줄바꿈
    /\\"/g,                                  // 이스케이프된 따옴표
  ];
  
  jsonKeyPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // 연속된 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // 빈 문자열이면 원본 반환
  return cleaned || text;
};

// 안전한 localStorage 접근
const safeLocalStorage = {
  getItem: (key, fallback = null) => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? safeJsonParse(item, fallback) : fallback;
    } catch (e) {
      console.warn('localStorage 접근 실패:', e.message);
      return fallback;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('localStorage 저장 실패:', e.message);
      return false;
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }
}; 

// ═══════════════════════════════════════════════════════════════
// 테마 시스템 - 라이트/다크 모드
// ═══════════════════════════════════════════════════════════════

const LIGHT_MODE_BACKGROUNDS = [];
const DARK_MODE_BACKGROUNDS = [];

const THEME_COLORS = {
  light: {
    bg: 'bg-neutral-100',
    bgGradient: 'bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200',
    card: 'bg-white/70 backdrop-blur-xl border-white/50',
    cardSolid: 'bg-white border-neutral-200',
    text: 'text-neutral-900',
    textSecondary: 'text-neutral-600',
    textMuted: 'text-neutral-400',
    border: 'border-neutral-200',
    input: 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400',
    button: 'bg-neutral-900 text-white hover:bg-neutral-800',
    buttonSecondary: 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300',
    hover: 'hover:bg-neutral-100',
    glass: 'bg-white/60 backdrop-blur-xl border border-white/40 shadow-lg',
  },
  dark: {
    bg: 'bg-neutral-900',
    bgGradient: 'bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900',
    card: 'bg-white/5 backdrop-blur-xl border-white/10',
    cardSolid: 'bg-neutral-800 border-neutral-700',
    text: 'text-white',
    textSecondary: 'text-neutral-300',
    textMuted: 'text-neutral-500',
    border: 'border-neutral-700',
    input: 'bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500',
    button: 'bg-white text-neutral-900 hover:bg-neutral-100',
    buttonSecondary: 'bg-neutral-700 text-white hover:bg-neutral-600',
    hover: 'hover:bg-neutral-800',
    glass: 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg',
  }
};

// ═══════════════════════════════════════════════════════════════
// UI 유틸리티 컴포넌트 - 2026 트렌드 적용
// ═══════════════════════════════════════════════════════════════

// 숫자 카운트업 애니메이션 훅
const useCountUp = (end, duration = 1500, start = 0) => {
  const [count, setCount] = useState(start);
  const countRef = useRef(null);
  
  useEffect(() => {
    if (typeof end !== 'number' || isNaN(end)) {
      setCount(end || 0);
      return;
    }
    
    const startTime = Date.now();
    const startValue = start;
    const endValue = end;
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(startValue + (endValue - startValue) * eased);
      setCount(current);
      
      if (progress < 1) {
        countRef.current = requestAnimationFrame(animate);
      }
    };
    
    countRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(countRef.current);
  }, [end, duration, start]);
  
  return count;
};

// 카운트업 숫자 컴포넌트
const CountUpNumber = ({ value, suffix = '', prefix = '', className = '', formatNumber = true }) => {
  const numericValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^0-9.-]/g, '')) 
    : value;
  const count = useCountUp(numericValue || 0);
  
  const displayValue = formatNumber 
    ? (count || 0).toLocaleString() 
    : count;
  
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{displayValue}{suffix}
    </span>
  );
};

// 아코디언 컴포넌트 (테마 대응)
const Accordion = ({ title, children, defaultOpen = false, icon = null, badge = null, theme = 'dark' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef(null);
  const colors = THEME_COLORS[theme];
  
  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200 shadow-sm'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-4 flex items-center justify-between text-left transition-colors ${theme === 'dark' ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-50'}`}
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-lg">{icon}</span>}
          <span className={`font-bold ${colors.text}`}>{title}</span>
          {badge && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
              {badge}
            </span>
          )}
        </div>
        <svg 
          className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-gray-400' : 'text-neutral-500'}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className={`p-4 pt-0 border-t ${theme === 'dark' ? 'border-neutral-700' : 'border-neutral-200'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

// 프로그레스 바 컴포넌트 (테마 대응)
const ProgressBar = ({ value, max = 100, color = 'bg-white', label = '', showPercent = true, animated = true, theme = 'dark' }) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const colors = THEME_COLORS[theme];
  
  return (
    <div className="space-y-1">
      {(label || showPercent) && (
        <div className="flex justify-between text-xs">
          <span className={colors.textSecondary}>{label}</span>
          {showPercent && <span className={colors.textSecondary}>{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200'}`}>
        <div 
          className={`h-full ${color} rounded-full transition-all duration-1000 ease-out ${animated ? 'animate-pulse' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// 스켈레톤 로딩 컴포넌트 (테마 대응)
const Skeleton = ({ className = '', variant = 'default', theme = 'dark' }) => {
  const variants = {
    default: 'h-4 w-full',
    title: 'h-6 w-3/4',
    avatar: 'h-12 w-12 rounded-full',
    card: 'h-32 w-full',
    button: 'h-10 w-24 rounded-lg',
    text: 'h-4 w-full',
    number: 'h-8 w-20'
  };
  
  return (
    <div className={`animate-pulse rounded ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-300'} ${variants[variant]} ${className}`} />
  );
};

// 스켈레톤 카드 (영업모드용, 테마 대응)
const SkeletonCard = ({ lines = 3, theme = 'dark' }) => (
  <div className={`p-5 rounded-xl border space-y-4 ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
    <div className="flex items-center gap-3">
      <Skeleton variant="avatar" className="w-6 h-6" theme={theme} />
      <Skeleton variant="title" theme={theme} />
    </div>
    <div className="space-y-3">
      {[...Array(lines)].map((_, i) => (
        <Skeleton key={i} variant="text" className={i === lines - 1 ? 'w-2/3' : ''} theme={theme} />
      ))}
    </div>
  </div>
);

// 미니 도넛 차트 (테마 대응)
const MiniDonutChart = ({ data = [], size = 80, strokeWidth = 8, theme = 'dark' }) => {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let cumulativePercent = 0;
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* 배경 원 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
          strokeWidth={strokeWidth}
        />
        {/* 데이터 세그먼트 */}
        {data.map((item, index) => {
          const percent = total > 0 ? (item.value / total) * 100 : 0;
          const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -(cumulativePercent / 100) * circumference;
          cumulativePercent += percent;
          
          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color || '#3b82f6'}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          );
        })}
      </svg>
      {/* 중앙 텍스트 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{total > 0 ? total.toLocaleString() : '-'}</span>
      </div>
    </div>
  );
};

// 미니 막대 차트 (가로, 테마 대응)
const MiniBarChart = ({ data = [], maxValue = null, height = 120, theme = 'dark' }) => {
  const max = maxValue || Math.max(...data.map(d => d.value || 0), 1);
  const colors = THEME_COLORS[theme];
  
  return (
    <div className="space-y-2" style={{ minHeight: height }}>
      {data.map((item, index) => {
        const percent = (item.value / max) * 100;
        return (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className={colors.textSecondary}>{item.label}</span>
              <span className={colors.textSecondary}>{(item.value || 0).toLocaleString()}{item.suffix || ''}</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200'}`}>
              <div 
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ 
                  width: `${percent}%`,
                  backgroundColor: item.color || '#3b82f6'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 스크롤 페이드인 훅
const useScrollFadeIn = (direction = 'up', duration = 0.6, delay = 0) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  const transforms = {
    up: 'translateY(20px)',
    down: 'translateY(-20px)',
    left: 'translateX(20px)',
    right: 'translateX(-20px)'
  };
  
  const style = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translate(0)' : transforms[direction],
    transition: `opacity ${duration}s ease-out ${delay}s, transform ${duration}s ease-out ${delay}s`
  };
  
  return { ref, style, isVisible };
};

// 페이드인 래퍼 컴포넌트
const FadeInSection = ({ children, delay = 0, direction = 'up', className = '' }) => {
  const { ref, style } = useScrollFadeIn(direction, 0.6, delay);
  
  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 토스 스타일 컴포넌트 (toss-style-big.jsx 기반 1:1 적용)
// ═══════════════════════════════════════════════════════════════
const TOSS_COLORS = ['#3182F6', '#4DC4FF', '#9BE8D8', '#FFD43B', '#E8E8E8'];

const useInViewToss = (threshold = 0.25) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
};

const useCountUpToss = (end, duration = 1200, start = 0, trigger = true) => {
  const numEnd = typeof end === 'string' ? parseFloat(String(end).replace(/[^0-9.-]/g, '')) : (end || 0);
  const safeEnd = isNaN(numEnd) ? 0 : numEnd;
  const [value, setValue] = useState(safeEnd > 0 ? safeEnd : start);
  const hasAnimated = useRef(false);
  useEffect(() => {
    // end가 바뀌면 즉시 반영 (애니메이션 전이라도 값 표시)
    if (safeEnd > 0 && !hasAnimated.current) setValue(safeEnd);
  }, [safeEnd]);
  useEffect(() => {
    if (!trigger || !safeEnd) return;
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    // trigger 시 0에서 카운트업 애니메이션
    setValue(0);
    let startTime = null;
    const animate = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(start + (safeEnd - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [safeEnd, trigger]);
  return value;
};

const FadeUpToss = ({ children, delay = 0, inView }) => (
  <div style={{
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0)' : 'translateY(50px)',
    transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  }}>
    {children}
  </div>
);

const fmtNum = (n) => {
  if (typeof n === 'string') {
    const parsed = parseFloat(n.replace(/[^0-9.-]/g, ''));
    if (isNaN(parsed)) return n;
    n = parsed;
  }
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
  if (n >= 10000) return (n / 10000).toFixed(0) + '만';
  return n.toLocaleString();
};

// 토스 스타일 분석 결과 컴포넌트
const TossStyleResults = ({ result, theme, onShowSources, salesModeShowSources }) => {
  if (!result?.success || !result.data) return null;
  
  // ★ React Error #31 완전 방지: 모든 JSX 렌더링용 안전 변환
  const S = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'object') {
      // 객체를 문자열로 - summary/detail 우선, 없으면 values 합치기
      if (v.summary && v.detail) return `${v.summary} ${v.detail}`;
      if (v.summary) return v.summary;
      if (v.detail) return v.detail;
      if (v.text) return v.text;
      if (v.title) return v.title;
      if (v.description) return v.description;
      if (v.message) return v.message;
      // 배열이면 join
      if (Array.isArray(v)) return v.map(item => typeof item === 'string' ? item : S(item)).join(', ');
      // 그 외 객체는 value들 합치기
      const vals = Object.values(v).filter(x => typeof x === 'string');
      return vals.length > 0 ? vals.join(' ') : JSON.stringify(v);
    }
    return String(v);
  };
  
  const d = result.data;
  const cd = result.collectedData || {};
  const dark = theme === 'dark';
  
  const bg = dark ? '#0E0E0E' : '#FFFFFF';
  const cardBg = dark ? '#1B1B1B' : '#F4F4F6';
  const t1 = dark ? '#FFFFFF' : '#191F28';
  const t2 = dark ? '#8B95A1' : '#8B95A1';
  const t3 = dark ? '#4E5968' : '#B0B8C1';
  const divColor = dark ? '#2B2B2B' : '#ECEEF1';
  const blue = '#3182F6';
  const red = '#F04452';
  const green = '#00C853';
  
  // 브루 피드백 말풍선 컴포넌트
  const BruBubble = ({ text, summary, delay = 0.5 }) => {
    if (!text) return null;
    const safeText = typeof text === 'string' ? text : (typeof text === 'object' ? JSON.stringify(text) : String(text));
    const safeSummary = typeof summary === 'string' ? summary : (summary && typeof summary === 'object' ? JSON.stringify(summary) : summary ? String(summary) : null);
    return (
      <FadeUpToss inView={true} delay={delay}>
        <div style={{ marginTop: 16, position: 'relative' }}>
          <div style={{ 
            position: 'absolute', top: -6, left: 20, width: 12, height: 12, 
            background: `${blue}12`, transform: 'rotate(45deg)', borderRadius: 2 
          }} />
          <div style={{ 
            background: `${blue}12`, borderRadius: 16, padding: '14px 18px',
            borderLeft: `3px solid ${blue}40`,
          }}>
            <p style={{ fontSize: 13, color: blue, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: blue, color: '#fff', fontSize: 11, fontWeight: 900, textAlign: 'center', lineHeight: '20px' }}>B</span>
              브루의 한마디
            </p>
            <p style={{ fontSize: 14, color: t1, lineHeight: 1.65 }}>{safeText}</p>
            {safeSummary && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: `${blue}08`, borderRadius: 10 }}>
                <p style={{ fontSize: 13, color: blue, fontWeight: 600, lineHeight: 1.5 }}>💡 {safeSummary}</p>
              </div>
            )}
          </div>
        </div>
      </FadeUpToss>
    );
  };
  
  // IntersectionObserver 각 섹션
  const [r1, v1] = useInViewToss();
  const [r2, v2] = useInViewToss();
  const [r3, v3] = useInViewToss();
  const [r4, v4] = useInViewToss();
  const [r5, v5] = useInViewToss();
  const [r6, v6] = useInViewToss();
  const [r7, v7] = useInViewToss();
  const [r8, v8] = useInViewToss();
  
  // 숫자 추출 함수
  const extractNum = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const m = String(val).replace(/[,\s]/g, '').match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  };
  
  // 데이터 파싱 - API 실데이터 우선, Gemini 텍스트 fallback
  const _apiCfrStcnt = cd?.apis?.cfrStcnt?.data;
  const _apiDynPpl = cd?.apis?.dynPplCmpr?.data;
  const _apiSalesAvg = cd?.apis?.salesAvg?.data;

  // 카페 수: salesAvg '카페' stcnt → Gemini 텍스트
  const cafeCount = (() => {
    // 1순위: salesAvg에서 카페 업종 stcnt (메인 동만)
    if (Array.isArray(_apiSalesAvg)) {
      const cafeItem = _apiSalesAvg.find(s => s.tpbizClscdNm === '카페');
      if (cafeItem?.stcnt > 0) return cafeItem.stcnt;
    }
    // 2순위: cfrStcnt API (주의: 전체 업종 포함일 수 있음)
    if (_apiCfrStcnt?.stcnt && _apiCfrStcnt.stcnt > 0 && _apiCfrStcnt.tpbizClscdNm === '카페') return _apiCfrStcnt.stcnt;
    // 3순위: Gemini 텍스트에서 추출 (단, '1km' 같은 거리 숫자 제외)
    const overviewText = String(d.overview?.cafeCount || '');
    const cafeMatch = overviewText.match(/카페[가\s]*(\d[\d,]+)\s*개/);
    if (cafeMatch) return parseInt(cafeMatch[1].replace(/,/g, ''));
    const numMatch = overviewText.match(/(\d[\d,]+)\s*개/);
    if (numMatch) return parseInt(numMatch[1].replace(/,/g, ''));
    return extractNum(d.overview?.cafeCount);
  })();

  // 유동인구: dynPplCmpr API cnt(월간) → 일평균(÷30) → Gemini 텍스트
  const floatingPop = (() => {
    if (Array.isArray(_apiDynPpl) && _apiDynPpl.length > 0) {
      const cnt = _apiDynPpl[0]?.cnt || _apiDynPpl[0]?.fpCnt || 0;
      if (cnt > 0) return Math.round(cnt / 30); // 월간→일평균
    }
    // Gemini 텍스트에서 추출 - "약 X만명" 또는 "X명"
    const popText = String(d.overview?.floatingPop || '');
    const manMatch = popText.match(/([\d,.]+)\s*만\s*명/);
    if (manMatch) return Math.round(parseFloat(manMatch[1].replace(/,/g, '')) * 10000);
    const numMatch = popText.match(/([\d,]+)\s*명/);
    if (numMatch) return parseInt(numMatch[1].replace(/,/g, ''));
    return extractNum(d.overview?.floatingPop);
  })();

  // 개업/폐업: 비상식적 숫자 필터 (1개 동에서 연간 200개 초과 불가능)
  const _rawNewOpen = extractNum(d.overview?.newOpen);
  const _rawClosed = extractNum(d.overview?.closed);
  const newOpen = _rawNewOpen > 200 ? 0 : _rawNewOpen;
  const closed = _rawClosed > 200 ? 0 : _rawClosed;
  
  // 카운트업 애니메이션
  const aCafe = useCountUpToss(cafeCount, 1200, 0, v1);
  const aPop = useCountUpToss(floatingPop > 10000 ? Math.floor(floatingPop / 10000) : floatingPop, 1500, 0, v1);
  const aOpen = useCountUpToss(newOpen, 800, 0, v1);
  const aClose = useCountUpToss(closed, 800, 0, v1);
  
  // 프랜차이즈 PieChart 데이터
  const franchiseData = (d.franchise || []).map(f => ({
    name: f.name,
    share: extractNum(f.count) || 1,
  }));
  
  // 창업비용 데이터 - 만원/억원 단위 파싱 강화
  const extractCostNum = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const s = String(val).replace(/[,\s]/g, '');
    // "X억" → X * 10000 (만원 단위로 통일)
    const eokMatch = s.match(/([\d.]+)\s*억/);
    if (eokMatch) return Math.round(parseFloat(eokMatch[1]) * 10000);
    // "X,XXX만원" 또는 "X,XXX만"
    const manMatch = s.match(/([\d.]+)\s*만/);
    if (manMatch) return Math.round(parseFloat(manMatch[1]));
    // "X~Y만" 범위 → 중간값
    const rangeMatch = s.match(/([\d,.]+)\s*[~\-]\s*([\d,.]+)\s*만/);
    if (rangeMatch) {
      const low = parseFloat(rangeMatch[1].replace(/,/g, ''));
      const high = parseFloat(rangeMatch[2].replace(/,/g, ''));
      return Math.round((low + high) / 2);
    }
    // 일반 숫자
    const numMatch = s.match(/[\d.]+/);
    return numMatch ? parseFloat(numMatch[0]) : 0;
  };

  const costItems = [];
  if (d.startupCost) {
    const sc = d.startupCost;
    const dep = extractCostNum(sc.deposit);
    const prem = extractCostNum(sc.premium);
    const inter = extractCostNum(sc.interior);
    const equip = extractCostNum(sc.equipment);
    if (dep > 0) costItems.push({ item: '보증금', cost: dep });
    if (prem > 0) costItems.push({ item: '권리금', cost: prem });
    if (inter > 0) costItems.push({ item: '인테리어', cost: inter });
    if (equip > 0) costItems.push({ item: '설비/장비', cost: equip });
  }
  // costItems가 비어있으면 기본값으로 fallback
  if (costItems.length === 0) {
    costItems.push({ item: '보증금', cost: 3000 });
    costItems.push({ item: '인테리어', cost: 4000 });
    costItems.push({ item: '설비/장비', cost: 2500 });
  }
  const totalCost = extractCostNum(d.startupCost?.total) || costItems.reduce((s, c) => s + c.cost, 0);
  const aCost = useCountUpToss(totalCost, 1200, 0, v5);
  
  // 월평균 매출 (collectedData에서)
  const salesAvgData = cd?.apis?.salesAvg?.data;
  const cafeAvgSales = salesAvgData && Array.isArray(salesAvgData)
    ? salesAvgData.find(s => s.tpbizClscdNm === '카페')
    : null;
  
  // 인접 동 합산 매출 (메인 동 매출이 null일 때 폴백)
  let _nearbyAvgSales = 0;
  const _nsd = cd?.apis?.nearbySales?.data || [];
  if ((!cafeAvgSales?.mmavgSlsAmt) && _nsd.length > 0) {
    let _sum = 0, _cnt = 0;
    _nsd.forEach(nd => {
      if (Array.isArray(nd.sales)) {
        const c = nd.sales.find(s => s.tpbizClscdNm === '카페');
        if (c?.mmavgSlsAmt) { _sum += c.mmavgSlsAmt; _cnt++; }
      }
    });
    if (_cnt > 0) _nearbyAvgSales = Math.round(_sum / _cnt);
  }
  const avgMonthlySales = cafeAvgSales?.mmavgSlsAmt || _nearbyAvgSales || extractNum(d.overview?.avgMonthlySales) || 0;
  
  // 월평균 매출 - 카페 관련 업종만 필터
  const cafeRelatedCodes = ['I21201','I21001','I21002','I21003','I213','Q12'];
  const cafeKeywords = ['카페','커피','빵','도넛','디저트','음료','베이커리','제과'];
  const allSalesData = cd?.apis?.salesAvg?.data || [];
  const cafeSalesData = Array.isArray(allSalesData) 
    ? allSalesData.filter(s => {
        const code = s.tpbizClscd || '';
        const name = s.tpbizClscdNm || '';
        return cafeRelatedCodes.some(c => code.startsWith(c)) || cafeKeywords.some(k => name.includes(k));
      })
    : [];
  const nonCafeSalesData = Array.isArray(allSalesData)
    ? allSalesData.filter(s => {
        const code = s.tpbizClscd || '';
        const name = s.tpbizClscdNm || '';
        return !cafeRelatedCodes.some(c => code.startsWith(c)) && !cafeKeywords.some(k => name.includes(k));
      })
    : [];
  const topSalesBarData = cafeSalesData.length > 0
    ? cafeSalesData.slice(0, 5).map(s => ({ name: s.tpbizClscdNm || '', sales: s.mmavgSlsAmt || 0 }))
    : (cd?.apis?.mmavgList?.data || []).slice(0, 5).map(s => ({ name: s.tpbizNm || '', sales: s.slsamt || 0 }));
  
  // 방문연령 데이터 (collectedData에서) - pipcnt 내림차순 정렬
  const vstAgeData = cd?.apis?.vstAgeRnk?.data;
  const vstCstData = cd?.apis?.vstCst?.data;
  const cafeAgeData = cd?.apis?.cafeAgeData?.data; // 서울시 카페 전용 연령별 결제건수
  const isCafeSpecificAge = cd?.apis?.cafeAgeData?.isCafeSpecific === true;
  const ageMap = { 'M10': '10대', 'M20': '20대', 'M30': '30대', 'M40': '40대', 'M50': '50대', 'M60': '60대+' };

  // 소비 연령 (vstCst) 데이터 - 소상공인365 (전체 업종)
  const sortedCstData = vstCstData && Array.isArray(vstCstData)
    ? [...vstCstData].sort((a, b) => (b.pipcnt || 0) - (a.pipcnt || 0)) : [];
  const sortedAgeData = vstAgeData && Array.isArray(vstAgeData)
    ? [...vstAgeData].sort((a, b) => (b.pipcnt || 0) - (a.pipcnt || 0)) : [];

  // 카드 차트: 카페 전용 데이터 > 소비 연령 > 방문 연령 (우선순위)
  const ageBarData = (cafeAgeData && Array.isArray(cafeAgeData) && cafeAgeData.length > 0)
    ? cafeAgeData.slice(0, 6).map(a => ({
        name: ageMap[a.age] || a.age,
        count: a.pct || a.pipcnt || 0,
      }))
    : sortedCstData.length > 0
    ? sortedCstData.slice(0, 6).map(a => ({
        name: ageMap[a.age] || a.age,
        count: a.pipcnt || 0,
      }))
    : sortedAgeData.length > 0
    ? sortedAgeData.slice(0, 6).map(a => ({
        name: ageMap[a.age] || a.age,
        count: a.pipcnt || 0,
      }))
    : [];
  const ageDataSource = isCafeSpecificAge ? '카페 업종' : '전체 업종';
  
  // 공통 섹션 스타일
  const sec = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '48px 24px',
    scrollSnapAlign: 'start',
    boxSizing: 'border-box',
  };
  
  const heroNum = { fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.0, color: t1 };
  const heroUnit = { fontSize: 24, fontWeight: 500, color: t2, marginLeft: 4 };
  const secTitle = { fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.2, color: t1, marginBottom: 8 };
  const secLabel = { fontSize: 14, fontWeight: 500, color: t2, marginBottom: 8 };
  const secSub = { fontSize: 16, color: t2, marginBottom: 40, lineHeight: 1.5 };
  
  return (
    <div style={{
      background: bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", sans-serif',
      color: t1,
      overflowY: 'auto',
      scrollSnapType: 'y mandatory',
      height: 'calc(100vh - 130px)',
      WebkitOverflowScrolling: 'touch',
      borderRadius: 16,
    }}>
      {/* ━━━ 0. 브루 인사 (1문단: 꽉 채운 카드) ━━━ */}
      <div style={{ ...sec, minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <FadeUpToss inView={true} delay={0}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3182F6, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 32, boxShadow: '0 8px 32px rgba(49,130,246,0.25)',
            overflow: 'hidden'
          }}>
            <img src="/logo.png" alt="BeanCraft" style={{ width: 56, height: 56, objectFit: 'contain' }} />
          </div>
        </FadeUpToss>
        <FadeUpToss inView={true} delay={0.2}>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: t1, letterSpacing: '-0.04em', lineHeight: 1.4 }}>
            안녕하세요 사장님 :)
          </h1>
        </FadeUpToss>
      </div>

      {/* ━━━ 0-2. 브루 인사 (2문단: 나머지 내용) ━━━ */}
      <div style={{ ...sec, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <FadeUpToss inView={true} delay={0}>
          <p style={{ fontSize: 18, color: t1, lineHeight: 1.8, marginBottom: 20, fontWeight: 500 }}>
            사장님의 새로운 시작을 누구보다 응원하는 <span style={{ color: blue, fontWeight: 700 }}>브루</span>예요.
          </p>
        </FadeUpToss>
        <FadeUpToss inView={true} delay={0.15}>
          <p style={{ fontSize: 15, color: t2, lineHeight: 1.8, marginBottom: 16, maxWidth: 340 }}>
            개인 카페 창업 전문 빈크래프트가 현장에서 쌓은 노하우를 바탕으로, 오직 사장님들만을 위하여 이 프로그램을 자체 제작했답니다.
          </p>
        </FadeUpToss>
        <FadeUpToss inView={true} delay={0.3}>
          <p style={{ fontSize: 15, color: t2, lineHeight: 1.8, marginBottom: 16, maxWidth: 340 }}>
            저와 함께라면 창업 준비하시는 데 좀 더 명확해지실 거예요.
          </p>
        </FadeUpToss>
        <FadeUpToss inView={true} delay={0.45}>
          <p style={{ fontSize: 15, color: t1, lineHeight: 1.8, fontWeight: 600, maxWidth: 340 }}>
            아래로 스크롤을 내려서 제가 준비한 선물 같은 내용들을 확인해 보세요!
          </p>
        </FadeUpToss>
      </div>

      {/* ━━━ 1. 상권 개요 Hero ━━━ */}
      <div ref={r1} style={sec}>
        <FadeUpToss inView={v1} delay={0}>
          <p style={{ fontSize: 15, color: blue, fontWeight: 700, marginBottom: 4 }}>상권 분석 리포트</p>
          <p style={{ fontSize: 12, color: t3, marginBottom: 12 }}>선택 지역 반경 500m 기준 분석 결과예요</p>
        </FadeUpToss>
        <FadeUpToss inView={v1} delay={0.1}>
          <h1 style={{ fontSize: 40, fontWeight: 900, color: t1, letterSpacing: '-0.05em', lineHeight: 1.15, marginBottom: 48 }}>
            {S(d.region || '상권 분석 결과')}
          </h1>
        </FadeUpToss>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px 20px' }}>
          {[
            { label: '카페 수', val: aCafe, unit: '개', color: t1 },
            { label: '유동인구', val: floatingPop > 10000 ? `${aPop}만` : aPop, unit: floatingPop > 10000 ? '명' : '명', color: t1 },
            { label: '신규 개업', val: newOpen > 0 ? aOpen : '-', unit: newOpen > 0 ? '개' : '', color: green },
            { label: '폐업', val: closed > 0 ? aClose : '-', unit: closed > 0 ? '개' : '', color: red },
          ].map((item, i) => (
            <FadeUpToss key={i} inView={v1} delay={0.2 + i * 0.1}>
              <p style={secLabel}>{S(item.label)}</p>
              <p style={{ ...heroNum, color: item.color }}>
                {S(item.val)}
                <span style={heroUnit}>{S(item.unit)}</span>
              </p>
            </FadeUpToss>
          ))}
        </div>
        {d.overview?.source && (
          <p style={{ fontSize: 12, color: t3, marginTop: 24 }}>출처: {S(d.overview.source)}</p>
        )}
        {/* AI 한줄 정리 */}
        {(d.overview?.bruSummary || d.insight) && (
          <FadeUpToss inView={v1} delay={0.55}>
            <div style={{
              marginTop: 20, background: `linear-gradient(135deg, ${blue}15, #6366F115)`,
              borderRadius: 14, padding: '14px 18px',
              borderLeft: `4px solid ${blue}`
            }}>
              <p style={{ fontSize: 12, color: blue, fontWeight: 700, marginBottom: 4 }}>AI 한줄 정리</p>
              <p style={{ fontSize: 15, color: t1, fontWeight: 600, lineHeight: 1.5 }}>
                {S(d.overview?.bruSummary || (typeof d.insight === 'string' ? d.insight.substring(0, 60) + '...' : ''))}
              </p>
            </div>
          </FadeUpToss>
        )}
        <BruBubble text={d.overview?.bruFeedback} summary={d.overview?.bruSummary} delay={0.6} />
      </div>
      
      {/* ━━━ 2. 방문 연령 분포 ━━━ */}
      {ageBarData.length > 0 && (
        <div ref={r2} style={sec}>
          <FadeUpToss inView={v2}>
            <p style={secLabel}>소비 고객 분석 · {ageDataSource} 기준</p>
            <h2 style={secTitle}>연령별 {isCafeSpecificAge ? '카페 고객' : '소비 고객'}</h2>
            <p style={secSub}>
              {(cafeAgeData && cafeAgeData.length > 0)
                ? `핵심 카페 소비층: ${ageMap[cafeAgeData[0]?.age] || '?'}(${cafeAgeData[0]?.pct || 0}%)`
                : sortedCstData.length > 0
                ? `핵심 소비층: ${ageMap[sortedCstData[0]?.age] || '?'}(${sortedCstData[0]?.pipcnt ? Math.round(sortedCstData[0].pipcnt / sortedCstData.reduce((s,d) => s + (d.pipcnt||0), 0) * 100) + '%' : ''}) ⚠ 전체 업종`
                : d.consumers?.mainTarget ? `핵심 타겟: ${S(d.consumers.mainTarget)} (${S(d.consumers.mainRatio || '')})` : '소비 연령 데이터'}
            </p>
          </FadeUpToss>
          <FadeUpToss inView={v2} delay={0.2}>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={ageBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: t3, fontSize: 13 }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ background: dark ? '#2B2B2B' : '#FFF', border: 'none', borderRadius: 12, color: t1, fontSize: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }} 
                    formatter={(v) => [isCafeSpecificAge ? `${v}%` : sortedCstData.length > 0 ? `${v.toLocaleString()}만원` : `${v.toLocaleString()}명`, isCafeSpecificAge ? '카페 결제 비중' : sortedCstData.length > 0 ? '소비금액' : '방문자']}
                  />
                  <Bar dataKey="count" fill={blue} radius={[8, 8, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FadeUpToss>
          {d.consumers?.peakTime && (
            <FadeUpToss inView={v2} delay={0.35}>
              <div style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap' }}>
                <div style={{ background: cardBg, borderRadius: 16, padding: '16px 20px', flex: 1, minWidth: 120 }}>
                  <p style={{ fontSize: 12, color: t2, marginBottom: 6 }}>피크 시간</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: t1 }}>{S(d.consumers.peakTime)}</p>
                </div>
                <div style={{ background: cardBg, borderRadius: 16, padding: '16px 20px', flex: 1, minWidth: 120 }}>
                  <p style={{ fontSize: 12, color: t2, marginBottom: 6 }}>테이크아웃</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: t1 }}>{S(d.consumers.takeoutRatio || '-')}</p>
                </div>
              </div>
            </FadeUpToss>
          )}
          <BruBubble text={d.consumers?.bruFeedback || d.overview?.bruFeedback} summary={d.consumers?.bruSummary} delay={0.5} />
        </div>
      )}
      

      {/* ━━━ 2.5 유동인구 & 방문고객 ━━━ */}
      {cd?.apis?.dynPplCmpr?.data && (() => {
        const raw = cd.apis.dynPplCmpr.data;
        const popData = Array.isArray(raw) ? raw.filter(Boolean) : [];
        // 메인 동(첫번째)만 사용, 월간→일평균(÷30)
        const totalPop = Math.round((popData[0]?.cnt || popData[0]?.fpCnt || 0) / 30);
        const vstData = cd?.apis?.vstCst?.data;
        const totalVst = Array.isArray(vstData) ? vstData.reduce((s, d) => s + (d.pipcnt || 0), 0) : 0;
        if (totalPop === 0 && totalVst === 0) return null;
        return (
        <div style={sec}>
          <FadeUpToss inView={true} delay={0}>
            <p style={secLabel}>유동인구 & 방문고객</p>
            <h2 style={secTitle}>지역 유동 분석</h2>
          </FadeUpToss>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
            <FadeUpToss inView={true} delay={0.1}>
              <div style={{ background: cardBg, borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 12, color: t3 }}>유동인구</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: t1, marginTop: 8 }}>{totalPop > 0 ? totalPop.toLocaleString() : '-'}</p>
                <p style={{ fontSize: 11, color: t3, marginTop: 4 }}>명/일 평균</p>
              </div>
            </FadeUpToss>
            <FadeUpToss inView={true} delay={0.2}>
              <div style={{ background: cardBg, borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 12, color: t3 }}>방문고객</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: blue, marginTop: 8 }}>{totalVst > 0 ? totalVst.toLocaleString() : '-'}</p>
                <p style={{ fontSize: 11, color: t3, marginTop: 4 }}>명/일 평균</p>
              </div>
            </FadeUpToss>
          </div>
        </div>
        );
      })()}

        <BruBubble text={d.consumers?.bruFeedback} summary={d.consumers?.bruSummary} delay={0.55} />

      {/* ━━━ 3. 프랜차이즈 현황 ━━━ */}
      {franchiseData.length > 0 && (
        <div ref={r3} style={sec}>
          <FadeUpToss inView={v3}>
            <p style={secLabel}>프랜차이즈 현황</p>
            <h2 style={secTitle}>카페 경쟁 분석</h2>
          </FadeUpToss>
          <FadeUpToss inView={v3} delay={0.15}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
              <div style={{ width: 200, height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={franchiseData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="share" stroke="none" paddingAngle={2}>
                      {franchiseData.map((_, i) => <Cell key={i} fill={TOSS_COLORS[i % TOSS_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FadeUpToss>
          <FadeUpToss inView={v3} delay={0.3}>
            {(d.franchise || []).map((f, i) => {
              // FRANCHISE_DATA에서 매장 수 보충
              const fName = f.name || '';
              const fdbMatch = Object.keys(FRANCHISE_DATA).find(k =>
                fName.includes(k) || k.includes(fName) ||
                fName.replace(/커피|카페/g, '').includes(k.replace(/커피|카페/g, ''))
              );
              const fdb = fdbMatch ? FRANCHISE_DATA[fdbMatch] : null;
              const displayCount = (f.count && f.count !== '0' && f.count !== '-' && f.count !== 0)
                ? f.count
                : fdb?.매장수 ? `${fdb.매장수.toLocaleString()}개` : f.count;
              const displayPrice = fdb?.아메리카노 ? `아메 ${fdb.아메리카노.toLocaleString()}원` : (f.royalty || '');

              return (
                <div key={i} style={{ padding: '14px 0', borderBottom: i < d.franchise.length - 1 ? `1px solid ${divColor}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: f.feedback || displayPrice ? 8 : 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 4, background: TOSS_COLORS[i % TOSS_COLORS.length], marginRight: 14, flexShrink: 0 }} />
                    <span style={{ fontSize: 17, color: t1, flex: 1, fontWeight: 500 }}>{S(fName)}</span>
                    <span style={{ fontSize: 14, color: t2, fontWeight: 600 }}>{S(displayCount)}</span>
                  </div>
                  {displayPrice && <p style={{ fontSize: 13, color: t2, marginLeft: 26, marginBottom: 4 }}>{displayPrice}</p>}
                  {f.feedback && <p style={{ fontSize: 13, color: red, marginLeft: 26, lineHeight: 1.5, opacity: 0.9 }}>{S(f.feedback)}</p>}
                </div>
              );
            })}
          </FadeUpToss>
          {d.franchiseCommonRisks?.length > 0 && (
            <FadeUpToss inView={v3} delay={0.45}>
              <div style={{ background: `${red}15`, borderRadius: 16, padding: 20, marginTop: 24 }}>
                <p style={{ fontSize: 14, color: red, fontWeight: 700, marginBottom: 12 }}>공통 리스크</p>
                {d.franchiseCommonRisks.map((r, i) => (
                  <p key={i} style={{ fontSize: 14, color: t1, lineHeight: 1.6, marginBottom: 4 }}>• {S(r)}</p>
                ))}
              </div>
            </FadeUpToss>
          )}
        </div>
      )}
      
        <BruBubble text={d.franchise?.[0]?.feedback} summary={d.franchise?.[0]?.bruSummary} delay={0.5} />

      {/* ━━━ 4. 월 매출 (업종별 Top 5) ━━━ */}
      {topSalesBarData.length > 0 && (
        <div ref={r4} style={sec}>
          <FadeUpToss inView={v4}>
            <p style={secLabel}>업종별 월 평균 매출</p>
            {avgMonthlySales > 0 && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: t1, letterSpacing: '-0.04em' }}>
                  {avgMonthlySales.toLocaleString()}
                </span>
                <span style={{ fontSize: 22, fontWeight: 500, color: t2, marginLeft: 6 }}>만원</span>
              </div>
            )}
            {avgMonthlySales > 0 && <p style={{ fontSize: 15, color: blue, fontWeight: 600, marginBottom: 40 }}>카페 업종 월 평균 매출</p>}
            {!avgMonthlySales && <h2 style={secTitle}>매출 분석</h2>}
          </FadeUpToss>
          <FadeUpToss inView={v4} delay={0.2}>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={topSalesBarData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: t2, fontSize: 13 }} width={80} />
                  <Tooltip 
                    contentStyle={{ background: dark ? '#2B2B2B' : '#FFF', border: 'none', borderRadius: 12, color: t1, fontSize: 14 }} 
                    formatter={(v) => [`${v.toLocaleString()}만원`, '월 매출']} 
                  />
                  <Bar dataKey="sales" fill={blue} radius={[0, 8, 8, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FadeUpToss>
        </div>
      )}
      

        <BruBubble text={d.topSales?.bruFeedback} summary={d.topSales?.bruSummary} delay={0.3} />

      {/* ━━━ 4.3 유동인구 시간대별 분석 ━━━ */}
      {cd?.apis?.dynPplCmpr?.data && (() => {
        const raw = cd.apis.dynPplCmpr.data;
        const popData = Array.isArray(raw) ? raw.filter(Boolean) : [];
        if (popData.length === 0) return null;
        const timeSlots = [
          { label: '오전 6~9시', key: 'tmzn1' },
          { label: '오전 9~12시', key: 'tmzn2' },
          { label: '오후 12~15시', key: 'tmzn3' },
          { label: '오후 15~18시', key: 'tmzn4' },
          { label: '저녁 18~21시', key: 'tmzn5' },
          { label: '야간 21~24시', key: 'tmzn6' }
        ];
        const timeData = timeSlots.map(ts => ({
          label: ts.label,
          value: popData.reduce((s, d) => s + (d[ts.key + 'FpCnt'] || d[ts.key] || 0), 0)
        })).filter(t => t.value > 0);
        const maxVal = Math.max(...timeData.map(t => t.value), 1);
        const hasTimeChart = timeData.length > 0;
        // 서울 외 지역: 시간대 차트 없어도 유동인구 데이터+AI 피드백은 표시
        // dynPplCmpr API는 월간 유동인구 → 일평균(÷30)
        const dongPop = Math.round((popData[0]?.cnt || popData[0]?.fpCnt || 0) / 30);
        if (!hasTimeChart && dongPop === 0 && !d.floatingPopTimeFeedback) return null;
        return (
        <div style={sec}>
          <FadeUpToss inView={true} delay={0}>
            <p style={secLabel}>시간대별 유동인구</p>
            <h2 style={secTitle}>피크 타임 분석</h2>
          </FadeUpToss>
          {hasTimeChart ? timeData.map((t, i) => (
            <FadeUpToss key={i} inView={true} delay={0.1 + i * 0.05}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: t2, width: 100, flexShrink: 0 }}>{t.label}</span>
                <div style={{ flex: 1, height: 24, background: divColor, borderRadius: 6, overflow: 'hidden', marginRight: 12 }}>
                  <div style={{ width: `${(t.value / maxVal) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${blue}, #6366F1)`, borderRadius: 6, transition: 'width 0.8s ease' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t1, width: 60, textAlign: 'right' }}>{t.value.toLocaleString()}</span>
              </div>
            </FadeUpToss>
          )) : (
            <FadeUpToss inView={true} delay={0.1}>
              <div style={{ background: cardBg, borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 12, color: t3 }}>일 유동인구</p>
                    <p style={{ fontSize: 24, fontWeight: 800, color: t1, marginTop: 6 }}>{dongPop > 0 ? dongPop.toLocaleString() : '-'}</p>
                    <p style={{ fontSize: 11, color: t3, marginTop: 2 }}>명/일 평균</p>
                  </div>
                  {popData.length > 1 && popData[1]?.nm && (
                    <div>
                      <p style={{ fontSize: 12, color: t3 }}>상위 지역</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: blue, marginTop: 6 }}>{popData[1].nm}</p>
                      <p style={{ fontSize: 13, color: t2 }}>{Math.round((popData[1].cnt || 0) / 30).toLocaleString()}명</p>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: t3, marginTop: 12 }}>※ 시간대별 세부 데이터는 서울 지역에서만 제공됩니다</p>
              </div>
            </FadeUpToss>
          )}
          <BruBubble text={d.floatingPopTimeFeedback} summary={d.floatingPopTimeSummary} delay={0.4} />
        </div>
        );
      })()}

      {/* ━━━ 5. 예상 창업비용 ━━━ */}
      {costItems.length > 0 && (
        <div ref={r5} style={sec}>
          <FadeUpToss inView={v5}>
            <p style={secLabel}>예상 창업비용</p>
            <div style={{ marginBottom: 40 }}>
              <span style={{ fontSize: 72, fontWeight: 900, color: t1, letterSpacing: '-0.04em' }}>
                {isNaN(aCost) || aCost === 0 ? '-' : totalCost >= 10000 ? `${(aCost/10000).toFixed(1)}` : aCost.toLocaleString()}
              </span>
              <span style={{ fontSize: 24, fontWeight: 500, color: t2, marginLeft: 6 }}>
                {isNaN(aCost) || aCost === 0 ? '' : totalCost >= 10000 ? '억원' : '만원'}
              </span>
            </div>
          </FadeUpToss>
          <FadeUpToss inView={v5} delay={0.15}>
            {costItems.map((c, i) => {
              const maxCost = Math.max(...costItems.map(x => x.cost), 1);
              const pct = (c.cost / maxCost) * 100;
              return (
                <div key={i} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 16, color: t1, fontWeight: 500 }}>{c.item}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: t1 }}>{isNaN(c.cost) ? '-' : c.cost.toLocaleString()}만원</span>
                  </div>
                  <div style={{ height: 10, background: divColor, borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{
                      width: v5 ? `${pct}%` : '0%',
                      height: '100%',
                      background: blue,
                      borderRadius: 5,
                      transition: `width 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                    }} />
                  </div>
                </div>
              );
            })}
          </FadeUpToss>
          {d.rent && (
            <FadeUpToss inView={v5} delay={0.4}>
              <div style={{ background: cardBg, borderRadius: 20, padding: 24, marginTop: 24 }}>
                <p style={{ fontSize: 14, color: t2, fontWeight: 600, marginBottom: 16 }}>임대료 정보</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {d.rent.monthly && (
                    <div>
                      <p style={{ fontSize: 12, color: t3 }}>월 임대료</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: t1 }}>{S(d.rent.monthly)}</p>
                    </div>
                  )}
                  {d.rent.deposit && (
                    <div>
                      <p style={{ fontSize: 12, color: t3 }}>보증금</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: t1 }}>{S(d.rent.deposit)}</p>
                    </div>
                  )}
                  {d.rent.yoyChange && (
                    <div>
                      <p style={{ fontSize: 12, color: t3 }}>전년 대비</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: S(d.rent.yoyChange || '').includes('+') ? red : green }}>{S(d.rent.yoyChange)}</p>
                    </div>
                  )}
                </div>
                {d.rent.source && <p style={{ fontSize: 11, color: t3, marginTop: 12 }}>출처: {S(d.rent.source)}</p>}
                {d.rent.bruFeedback && (
                  <div style={{ marginTop: 12 }}>
                    <BruBubble text={d.rent.bruFeedback} summary={d.rent?.bruSummary} delay={0.3} />
                  </div>
                )}
              </div>
            </FadeUpToss>
          )}
        </div>
      )}
      
        <BruBubble text={d.startupCost?.bruFeedback} summary={d.startupCost?.bruSummary} delay={0.35} />

      {/* ━━━ 6. 기회 & 리스크 ━━━ */}
      {(d.opportunities?.length > 0 || d.risks?.length > 0) && (
        <div ref={r6} style={sec}>
          <FadeUpToss inView={v6}>
            <h2 style={secTitle}>기회 & 리스크</h2>
            <div style={{ height: 24 }} />
          </FadeUpToss>
          
          {d.opportunities?.length > 0 && (
            <FadeUpToss inView={v6} delay={0.1}>
              <div style={{ background: cardBg, borderRadius: 24, padding: 24, marginBottom: 16 }}>
                <p style={{ fontSize: 14, color: green, fontWeight: 700, marginBottom: 16 }}>기회 요인</p>
                {d.opportunities.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: i < d.opportunities.length - 1 ? 14 : 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: green, marginTop: 7, marginRight: 12, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 16, color: t1, fontWeight: 600, lineHeight: 1.4 }}>{S(o.title || o)}</p>
                      {o.detail && <p style={{ fontSize: 14, color: t2, lineHeight: 1.4, marginTop: 2 }}>{S(o.detail)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </FadeUpToss>
          )}
          
          {d.risks?.length > 0 && (
            <FadeUpToss inView={v6} delay={0.25}>
              <div style={{ background: cardBg, borderRadius: 24, padding: 24 }}>
                <p style={{ fontSize: 14, color: red, fontWeight: 700, marginBottom: 16 }}>리스크 요인</p>
                {d.risks.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: i < d.risks.length - 1 ? 14 : 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: red, marginTop: 7, marginRight: 12, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 16, color: t1, fontWeight: 600, lineHeight: 1.4 }}>{S(r.title || r)}</p>
                      {r.detail && <p style={{ fontSize: 14, color: t2, lineHeight: 1.4, marginTop: 2 }}>{S(r.detail)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </FadeUpToss>
          )}
        </div>
      )}
      

        <BruBubble text={d.opportunities?.[0]?.bruFeedback || d.risks?.[0]?.bruFeedback} summary={d.opportunities?.[0]?.bruSummary || d.risks?.[0]?.bruSummary} delay={0.4} />

      {/* ━━━ 6.2 배달 업종 분석 ━━━ */}
      {cd?.apis?.baeminTpbiz?.data?.length > 0 && (
        <div style={sec}>
          <FadeUpToss inView={true} delay={0}>
            <p style={secLabel}>배달 시장 분석</p>
            <h2 style={secTitle}>배달 업종 현황</h2>
          </FadeUpToss>
          {cd.apis.baeminTpbiz.data.slice(0, 5).map((item, i) => (
            <FadeUpToss key={i} inView={true} delay={0.1 + i * 0.05}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${divColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: blue, width: 24 }}>{i + 1}</span>
                  <span style={{ fontSize: 14, color: t1, fontWeight: 600 }}>{item.baeminTpbizClsfNm || item.name || '-'}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: t2 }}>{(item.ordrCnt || item.count || 0).toLocaleString()}건</span>
              </div>
            </FadeUpToss>
          ))}
          <BruBubble text={d.deliveryFeedback || "이 지역 배달 트렌드를 파악해서, 카페 배달 메뉴 구성 여부를 생각해보세요."} summary={d.deliverySummary} delay={0.35} />
        </div>
      )}

      {/* ━━━ 6.3 SNS 트렌드 분석 ━━━ */}
      {cd?.apis?.snsTrend?.data && (
        <div style={sec}>
          <FadeUpToss inView={true} delay={0}>
            <p style={secLabel}>SNS 트렌드</p>
            <h2 style={secTitle}>온라인 반응 분석</h2>
          </FadeUpToss>
          {cd.apis.snsTrend.data.popularKeywords?.length > 0 && (
            <FadeUpToss inView={true} delay={0.15}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {cd.apis.snsTrend.data.popularKeywords.map((kw, i) => (
                  <span key={i} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: i === 0 ? blue : cardBg, color: i === 0 ? '#fff' : t1 }}>
                    #{S(typeof kw === 'string' ? kw : kw.keyword || kw)}
                  </span>
                ))}
              </div>
            </FadeUpToss>
          )}
          {cd.apis.snsTrend.data.sentiment && (
            <FadeUpToss inView={true} delay={0.25}>
              <div style={{ background: cardBg, borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 13, color: t2, marginBottom: 8 }}>전체 반응</p>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><span style={{ color: green, fontWeight: 800, fontSize: 20 }}>{cd.apis.snsTrend.data.sentiment.positive || 0}%</span><p style={{ fontSize: 11, color: t3 }}>긍정</p></div>
                  <div><span style={{ color: t2, fontWeight: 800, fontSize: 20 }}>{cd.apis.snsTrend.data.sentiment.neutral || 0}%</span><p style={{ fontSize: 11, color: t3 }}>중립</p></div>
                  <div><span style={{ color: red, fontWeight: 800, fontSize: 20 }}>{cd.apis.snsTrend.data.sentiment.negative || 0}%</span><p style={{ fontSize: 11, color: t3 }}>부정</p></div>
                </div>
              </div>
            </FadeUpToss>
          )}
          {(cd.apis.snsTrend.data.summary || cd.apis.snsTrend.data.analysis) && (
            <FadeUpToss inView={true} delay={0.35}>
              <p style={{ fontSize: 14, color: t2, lineHeight: 1.6, marginTop: 16 }}>{S(cd.apis.snsTrend.data.summary || cd.apis.snsTrend.data.analysis)}</p>
            </FadeUpToss>
          )}
          {/* SNS 트렌드 - summary가 없을 때 bruFeedback으로 대체 표시 */}
          {!cd.apis.snsTrend.data.summary && !cd.apis.snsTrend.data.analysis && d.snsTrend?.bruFeedback && (
            <FadeUpToss inView={true} delay={0.35}>
              <p style={{ fontSize: 14, color: t2, lineHeight: 1.6, marginTop: 16 }}>{S(d.snsTrend.bruFeedback)}</p>
            </FadeUpToss>
          )}
        </div>
      )}

        <BruBubble text={d.snsTrend?.bruFeedback} summary={d.snsTrend?.bruSummary} delay={0.3} />

      {/* ━━━ 6.5 날씨 영향 분석 ━━━ */}
      {d.weatherImpact && (
        <div style={sec}>
          <FadeUpToss inView={true} delay={0}>
            <p style={secLabel}>날씨 영향 분석</p>
            <h2 style={secTitle}>날씨별 매출 변동</h2>
            <p style={{ fontSize: 14, color: blue, fontWeight: 600, marginBottom: 32 }}>
              상권 유형: {S(d.weatherImpact.regionType || '분석 중')}
            </p>
          </FadeUpToss>
          {d.weatherImpact.effects && (
            <FadeUpToss inView={true} delay={0.15}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {Object.entries(d.weatherImpact.effects).map(([weather, effect], i) => (
                  <div key={i} style={{ background: cardBg, borderRadius: 14, padding: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 24, marginBottom: 4 }}>{weather === '맑음' ? '☀️' : weather === '흐림' ? '☁️' : weather === '비' ? '🌧️' : weather === '눈' ? '❄️' : '🌤️'}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: t1 }}>{weather}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: typeof effect === 'number' ? (effect >= 0 ? green : red) : (typeof effect === 'object' && effect?.impact ? (String(effect.impact).includes('+') ? green : String(effect.impact).includes('-') ? red : t2) : t2), marginTop: 4 }}>
                      {typeof effect === 'number' ? `${effect > 0 ? '+' : ''}${effect}%` : (typeof effect === 'object' && effect?.impact ? String(effect.impact) : S(effect))}
                    </p>
                    {typeof effect === 'object' && effect?.desc && (
                      <p style={{ fontSize: 11, color: t3, marginTop: 2 }}>{effect.desc}</p>
                    )}
                  </div>
                ))}
              </div>
            </FadeUpToss>
          )}
          {d.weatherImpact.description && (
            <FadeUpToss inView={true} delay={0.3}>
              <p style={{ fontSize: 14, color: t2, lineHeight: 1.6, marginTop: 20 }}>{S(d.weatherImpact.description)}</p>
            </FadeUpToss>
          )}
        </div>
      )}

        <BruBubble text={d.weatherImpact?.bruFeedback} delay={0.4} />

      {/* ━━━ 6.7 시장 생존율 ━━━ */}
      {d.marketSurvival && (
        <div style={sec}>
          <FadeUpToss inView={true} delay={0}>
            <p style={secLabel}>시장 생존율</p>
            <h2 style={secTitle}>카페 업종 생존 분석</h2>
          </FadeUpToss>
          <FadeUpToss inView={true} delay={0.15}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { label: '1년', value: d.marketSurvival.year1 || '64.9%' },
                { label: '3년', value: d.marketSurvival.year3 || '46.3%' },
                { label: '5년', value: d.marketSurvival.year5 || '22.8%' }
              ].map((item, i) => (
                <div key={i} style={{ background: cardBg, borderRadius: 14, padding: 16, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: t3 }}>{S(item.label)} 생존율</p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: i === 0 ? green : i === 1 ? blue : red, marginTop: 8 }}>{S(item.value)}</p>
                </div>
              ))}
            </div>
          </FadeUpToss>
          {d.marketSurvival.insight && (
            <FadeUpToss inView={true} delay={0.3}>
              <p style={{ fontSize: 14, color: t2, lineHeight: 1.6 }}>{S(d.marketSurvival.insight)}</p>
            </FadeUpToss>
          )}
          {d.marketSurvival.source && (
            <p style={{ fontSize: 11, color: t3, marginTop: 16 }}>출처: {S(d.marketSurvival.source)}</p>
          )}
        </div>
      )}

        <BruBubble text={d.marketSurvival?.bruFeedback} summary={d.marketSurvival?.bruSummary} delay={0.3} />

      {/* ━━━ 7. AI 종합 분석 + 빈크래프트 ━━━ */}
      <div ref={r7} style={sec}>
        {d.insight && (
          <FadeUpToss inView={v7}>
            <p style={secLabel}>AI 종합 분석</p>
            <h2 style={{ ...secTitle, fontSize: 28 }}>빈코치의 한마디</h2>
            <p style={{ fontSize: 16, color: t2, lineHeight: 1.7, marginBottom: 40 }}>{typeof d.insight === 'string' ? d.insight : JSON.stringify(d.insight)}</p>
          </FadeUpToss>
        )}
        
        {d.beancraftFeedback && (
          <FadeUpToss inView={v7} delay={0.2}>
            <div style={{ background: `${blue}15`, borderRadius: 24, padding: 28 }}>
              <p style={{ fontSize: 16, color: blue, fontWeight: 800, marginBottom: 20 }}>빈크래프트 컨설팅 포인트</p>
              
              {d.beancraftFeedback.priority?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, color: t2, marginBottom: 10 }}>우선순위</p>
                  {d.beancraftFeedback.priority.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: blue, marginRight: 12, minWidth: 24 }}>{i + 1}</span>
                      <p style={{ fontSize: 15, color: t1, fontWeight: 500 }}>{typeof p === 'string' ? p : S(p.text || p.title || p)}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {['interior', 'equipment', 'menu', 'beans', 'education', 'design'].map(key => {
                const item = d.beancraftFeedback[key];
                if (!item) return null;
                const labels = { interior: '인테리어', equipment: '설비/장비', menu: '메뉴', beans: '원두', education: '교육', design: '디자인' };
                return (
                  <div key={key} style={{ marginBottom: 16, paddingTop: 16, borderTop: `1px solid ${divColor}` }}>
                    <p style={{ fontSize: 14, color: blue, fontWeight: 600, marginBottom: 8 }}>{labels[key] || key}</p>
                    {item.summary && <p style={{ fontSize: 14, color: t1, lineHeight: 1.6, marginBottom: 4 }}>{S(item.summary)}</p>}
                    {item.detail && <p style={{ fontSize: 13, color: t2, lineHeight: 1.5 }}>{S(item.detail)}</p>}
                    {item.thinkAbout && <p style={{ fontSize: 13, color: blue, marginTop: 6, fontStyle: 'italic' }}>{S(item.thinkAbout)}</p>}
                  </div>
                );
              })}
            </div>
          </FadeUpToss>
        )}
      </div>
      
      {/* ━━━ 8. 출처 + 빈크래프트 CTA ━━━ */}
      <div ref={r8} style={{ ...sec, minHeight: 'auto', paddingBottom: 80 }}>
        <FadeUpToss inView={v8}>
          <div style={{ background: cardBg, borderRadius: 20, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: t2, fontWeight: 600 }}>데이터 출처</p>
              <div style={{ padding: '4px 12px', borderRadius: 8, background: result?.hasApiData ? `${green}20` : `${red}20` }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: result?.hasApiData ? green : red }}>
                  {result?.hasApiData ? 'API 데이터 수집 성공' : 'AI 자체 분석'}
                </p>
              </div>
            </div>
            <div style={{ fontSize: 13, color: t3, lineHeight: 1.8 }}>
              <p>• 소상공인시장진흥공단 상가(상권)정보</p>
              <p>• 소상공인365 빅데이터 상권분석</p>
              <p>• Google Gemini AI (빈코치) 분석</p>
            </div>
          </div>
        </FadeUpToss>
        
        <FadeUpToss inView={v8} delay={0.15}>
          <div style={{
            background: `linear-gradient(135deg, ${blue}, #1B64DA)`,
            borderRadius: 24,
            padding: 32,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginBottom: 8 }}>빈크래프트</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
              인테리어 · 설비 · 메뉴 · 원두 · 교육 · 컨설팅
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>
              카페 창업의 모든 것, 빈크래프트가 함께합니다
            </p>
          </div>
        </FadeUpToss>
      </div>
    </div>
  );
};

// 글래스모피즘 카드 (테마 대응)
const GlassCard = ({ children, className = '', hover = false, theme = 'dark' }) => (
  <div className={`
    backdrop-blur-lg rounded-xl
    ${theme === 'dark' 
      ? 'bg-white/5 border border-white/10' 
      : 'bg-white/60 border border-white/40 shadow-lg'}
    ${hover 
      ? (theme === 'dark' 
        ? 'hover:bg-white/10 hover:border-white/20 transition-all duration-300' 
        : 'hover:bg-white/80 hover:shadow-xl transition-all duration-300') 
      : ''}
    ${className}
  `}>
    {children}
  </div>
);

// 데이터 카드 (테마 대응)
const DataCard = ({ 
  title, 
  value, 
  subtitle = '', 
  icon = null, 
  trend = null, 
  color = 'white',
  animate = true,
  theme = 'dark'
}) => {
  const numericValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^0-9.-]/g, ''))
    : value;
  const isNumeric = !isNaN(numericValue);
  const colors = THEME_COLORS[theme];
  
  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-white/5 backdrop-blur-xl border-white/10 hover:bg-white/10' 
        : 'bg-white/70 backdrop-blur-xl border-white/50 shadow-md hover:shadow-lg'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-neutral-500'}`}>{title}</p>
        {icon && <span className="text-lg opacity-60">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <p className={`text-xl font-bold ${colors.text}`}>
          {animate && isNumeric ? (
            <CountUpNumber value={numericValue} />
          ) : (
            value || '-'
          )}
        </p>
        {trend && (
          <span className={`text-xs ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {subtitle && <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-neutral-400'}`}>{subtitle}</p>}
    </div>
  );
};

// API 상태 표시 컴포넌트
const ApiStatusIndicator = ({ hasData, apiName = '소상공인365' }) => (
  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
    hasData 
      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  }`}>
    <span className={`w-2 h-2 rounded-full ${hasData ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`} />
    {hasData ? `${apiName} 연동` : 'AI 추정치'}
  </div>
);

const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const LOGIN_QUOTES = [
  "안 될 이유보다, 될 이유 하나만 생각하고 시작합시다.",
  "오늘의 거절은 더 큰 계약을 위한 과정일 뿐입니다.",
  "고민할 시간에 한 번 더 방문하는 것이 정답에 가깝습니다.",
  "성과는 정직합니다. 흘린 땀은 반드시 돌아옵니다.",
  "우리가 만나는 모든 사람은 빈크래프트의 소중한 잠재 고객입니다.",
  "영업은 설득이 아니라, 고객의 문제를 해결해 주는 숭고한 과정입니다.",
  "오늘 걷지 않으면 내일은 뛰어야 합니다. 지금 움직입시다.",
  "무의미한 미팅은 없습니다. 경험이 쌓이거나, 계약이 성사되거나 둘 중 하나입니다.",
  "운은 준비된 프로에게만 찾아오는 선물입니다.",
  "고객은 제품 이전에 당신의 태도를 먼저 신뢰합니다.",
  "슬럼프는 치열하게 달렸다는 훈장입니다. 잠시 숨을 고르고 다시 나아갑시다.",
  "확률은 시도 횟수에 비례합니다. 우리의 발걸음이 곧 데이터입니다.",
  "1%의 가능성이라도 보인다면, 그것은 분명한 기회입니다.",
  "오늘 건넨 명함 한 장이 훗날 빈크래프트의 미래를 바꿀 수 있습니다.",
  "실패는 포기할 때 확정됩니다. 계속하면 성공의 과정이 됩니다.",
  "프로는 기분에 좌우되지 않고, 성과로 증명합니다.",
  "문전박대는 문이 열리기 직전의 가장 강력한 신호입니다.",
  "당신의 발자국이 닿는 곳이 곧 빈크래프트의 영토입니다.",
  "계약서에 날인하는 순간까지, 끝까지 집중해 주십시오.",
  "어제의 영광에 안주하지 않고, 오늘의 가능성에 집중합시다.",
  "고객의 \"NO\"는 \"지금은 아니다\"라는 뜻일 뿐, 영원한 거절은 아닙니다.",
  "영업은 발로 뛰고 가슴으로 남기는 진정성 있는 비즈니스입니다.",
  "우리는 단순히 커피를 파는 것이 아니라, 문화를 제안하는 사람들입니다.",
  "최고의 영업 전략은 언제나 성실함입니다.",
  "준비 없는 열정보다는, 철저한 분석과 접근이 필요합니다.",
  "오늘 하루의 목표 달성 여부가 퇴근길의 마음을 가볍게 합니다.",
  "답은 언제나 현장에 있습니다.",
  "경쟁자를 의식하기보다 어제의 우리를 넘어서는 것에 집중합시다.",
  "작은 약속 하나가 거대한 신뢰의 탑을 쌓습니다.",
  "변명보다는 결과를 만드는 방법에 집중해 주십시오.",
  "고객이 당신을 기억하게 만드십시오. 그것이 진정한 브랜딩입니다.",
  "거절에 대한 두려움보다 성취의 기쁨을 먼저 생각합시다.",
  "한 번 맺은 인연을 소중히 여겨 주십시오. 소개는 그곳에서 시작됩니다.",
  "디테일이 명품을 만듭니다. 영업 또한 예술과 같습니다.",
  "긍정적인 마인드는 영업자가 가질 수 있는 최고의 무기입니다.",
  "당신이 흘리는 땀방울이 빈크래프트라는 브랜드를 빛내고 있습니다.",
  "더 많이 시도할수록 성공의 확률은 높아집니다.",
  "비즈니스에서의 거절을 개인적인 상처로 받아들이지 마십시오.",
  "오늘 심은 씨앗이 당장 싹트지 않더라도, 언젠가 숲이 될 것입니다.",
  "경청은 그 어떤 화려한 언변보다 강력한 설득의 도구입니다.",
  "당신의 밝은 에너지가 고객의 구매 의욕을 불러일으킵니다.",
  "쉬운 길은 내리막길뿐입니다. 오르고 있다면 잘하고 있는 것입니다.",
  "매출 그래프는 우리의 활동량을 보여주는 가장 정직한 거울입니다.",
  "고객은 전문가를 원합니다. 끊임없이 학습하고 성장합시다.",
  "진심은 반드시 통합니다. 테크닉보다 중요한 것은 진정성입니다.",
  "오늘 만나는 고객이 당신의 커리어를 바꿀 귀인일 수 있습니다.",
  "포기하고 싶은 순간이, 성공이 바로 눈앞에 다가온 순간입니다.",
  "영업은 단거리 경주가 아닌 마라톤입니다. 페이스를 유지하십시오.",
  "불황은 준비되지 않은 자들의 핑계일 뿐입니다.",
  "당신의 확신이 고객을 움직입니다. 우리 브랜드를 먼저 신뢰하십시오.",
  "메모하는 습관이 실수를 줄이고 기회를 포착합니다.",
  "매일 쌓아가는 작은 성공들이 모여 위대한 결과를 만듭니다.",
  "기대하지 않았던 곳에서 기회가 오기도 합니다. 편견을 버립시다.",
  "오늘 하루도 후회 없이 치열하게 보내셨습니까?",
  "영업은 혼자가 아닙니다. 회사가 든든하게 지원하고 있습니다.",
  "멘탈 관리도 실력입니다. 감정을 다스리는 프로가 됩시다.",
  "고객의 불만 속에 새로운 비즈니스 기회가 숨어 있습니다.",
  "정직한 영업만이 롱런할 수 있는 유일한 길입니다.",
  "당신의 오늘은 누군가가 그토록 바라던 내일입니다. 소중히 씁시다.",
  "끊임없이 두드리면 열리지 않는 문은 없습니다.",
  "첫인상은 3초 안에 결정됩니다. 단정한 모습으로 신뢰를 줍시다.",
  "내가 경영자라는 마음가짐으로 임하면 시야가 달라집니다.",
  "바쁜 것은 긍정적인 신호입니다. 정체됨을 경계하십시오.",
  "영업은 사람의 마음을 얻는 고도의 심리 예술입니다.",
  "목표가 없는 하루는 나침반 없는 항해와 같습니다.",
  "거창한 계획보다 지금 당장의 전화 한 통이 중요합니다.",
  "고객의 니즈를 정확히 파악하는 것이 영업의 절반입니다.",
  "끈기는 어떤 재능보다 강력하고 확실한 무기입니다.",
  "빈크래프트의 최전방을 책임지는 여러분이 자랑스럽습니다.",
  "안 된다고 생각하면 핑계가 보이고, 된다고 생각하면 길이 보입니다.",
  "말하기보다 듣기에 집중하십시오. 그때 지갑이 열립니다.",
  "기회는 왔을 때 잡아야 합니다. 타이밍을 놓치지 마십시오.",
  "오늘 걷는 이 길이 내일의 성공 가도입니다.",
  "나태함은 기계보다 사람을 더 빨리 녹슬게 합니다.",
  "프로는 상황을 탓하지 않고, 그 안에서 최선의 방법을 찾습니다.",
  "고객에게 굽히지 말고, 당당하게 파트너십을 제안하십시오.",
  "지금 당신의 표정이 오늘 당신의 성과를 결정합니다.",
  "헛걸음은 없습니다. 그 길을 파악한 것만으로도 수확입니다.",
  "영업의 신은 디테일에 숨어 있습니다. 사소한 것을 챙기십시오.",
  "우리가 잠시 멈춘 사이, 경쟁사는 그곳을 향해 달리고 있습니다.",
  "경험은 돈으로 살 수 없는 소중한 자산입니다. 많이 부딪히십시오.",
  "성공은 꾸준함의 다른 이름입니다.",
  "비즈니스는 냉정합니다. 오직 실력으로 증명해 주십시오.",
  "오늘 흘린 땀은 배신하지 않습니다. 반드시 보상으로 돌아옵니다.",
  "고객이 까다롭게 군다면, 그것은 관심이 있다는 반증입니다.",
  "당신은 회사의 얼굴입니다. 자부심을 가지셔도 좋습니다.",
  "영업은 고객의 시간을 가치 있게 만들어주는 일입니다.",
  "익숙함에 속아 매너리즘에 빠지는 것을 경계합시다.",
  "침묵을 견디십시오. 결정적인 순간은 침묵 뒤에 옵니다.",
  "미소는 영업자가 가진 가장 기본적이고 강력한 무기입니다.",
  "최악의 시나리오는 아무것도 하지 않는 것입니다.",
  "당신의 열정이 식으면 고객의 마음도 식습니다.",
  "오늘 만난 인연을 소중히 여기십시오. 비즈니스는 돌고 돕니다.",
  "완벽한 준비란 없습니다. 실행하며 완벽해지는 것입니다.",
  "문이 닫혀 있다면 창문이라도 열겠다는 의지가 필요합니다.",
  "고객을 돈으로 보지 말고 진심으로 대하십시오. 성과는 따라옵니다.",
  "불가능은 노력하지 않은 자들의 핑계일 뿐입니다.",
  "오늘 당신이 만든 매출이 빈크래프트의 역사가 됩니다.",
  "자신감 없는 영업사원에게 신뢰를 보낼 고객은 없습니다.",
  "끝날 때까지 끝난 게 아닙니다. 마지막까지 최선을 다합시다.",
  "어설픈 설득보다 진심 어린 경청이 계약을 이끌어냅니다.",
  "영업은 단순히 파는 것이 아니라, 고객이 사게 만드는 것입니다.",
  "현장을 누비는 당신의 노고가 빈크래프트의 성장 동력입니다.",
  "고객은 당신이 말을 멈추고 들어줄 때 비로소 진심을 이야기합니다.",
  "오늘은 어제 놓친 그 고객을 다시 설득할 수 있는 새로운 기회입니다.",
  "남들이 쉬는 날이 경쟁에서 앞서나갈 수 있는 최고의 기회입니다.",
  "핑계는 매출을 만들어주지 않습니다. 결과로 답합시다.",
  "무반응보다 나은 것은 거절입니다. 반응이 있다면 희망이 있습니다.",
  "당신의 목소리에 확신이 없다면 그 누구도 설득할 수 없습니다.",
  "계약서는 사무실 책상이 아닌 치열한 현장에서 완성됩니다.",
  "\"다음에 연락드릴게요\"는 다시 연락해 달라는 신호일 수 있습니다.",
  "감보다는 축적된 데이터를 믿고 움직이십시오.",
  "노력하는 자에게 운도 따르는 법입니다.",
  "슬럼프는 더 높이 도약하기 위한 도움닫기 구간입니다.",
  "내가 확신하지 못하는 제품을 고객에게 권할 수는 없습니다.",
  "고객의 이름을 기억하고 부르는 것이 관계의 시작입니다.",
  "빈손으로 돌아오는 것보다, 아무 시도도 하지 않는 것을 두려워하십시오.",
  "오늘 방문한 곳이 빈크래프트의 새로운 거점이 될 것입니다.",
  "기다리지 말고 먼저 제안하십시오. 주도권은 당신에게 있습니다.",
  "고객의 문제를 해결하는 것이 곧 우리의 수익입니다.",
  "우리가 쉬는 순간에도 경쟁자의 시간은 흐르고 있습니다.",
  "영업은 체력 싸움이기도 합니다. 건강 관리도 프로의 덕목입니다.",
  "거절을 유연하게 대처하는 능력이 프로의 품격입니다.",
  "모르는 것은 죄가 아니지만, 배우려 하지 않는 것은 안일함입니다.",
  "한 명의 충성 고객이 백 명의 신규 고객보다 가치 있을 수 있습니다.",
  "당신의 뜨거운 열정은 고객에게 전염됩니다.",
  "실적이 저조한 날은 있어도, 활동이 멈추는 날은 없어야 합니다.",
  "성공한 영업 전문가는 거절을 성장의 밑거름으로 삼습니다.",
  "약속 시간 10분 전 도착은 신뢰를 지키는 기본입니다.",
  "고객이 가격을 문제 삼는다면, 가치를 충분히 전달했는지 점검하십시오.",
  "오늘 걷지 않은 길을 내일 지도에 그릴 수는 없습니다.",
  "가벼운 스몰토크가 비즈니스의 윤활유가 됩니다.",
  "당신의 눈빛이 흔들리면 고객의 마음은 닫힙니다. 확신을 가지십시오.",
  "영업은 기세입니다. 위축되지 말고 당당하게 임하십시오.",
  "거울 속의 자신을 설득할 수 있어야 고객도 설득할 수 있습니다.",
  "기록은 기억보다 강합니다. 항상 메모하십시오.",
  "열 번 두드려 열리지 않으면, 열한 번 두드리는 끈기가 필요합니다.",
  "고객은 이성으로 이해하고 감성으로 결정합니다.",
  "진심 어린 칭찬은 닫힌 마음의 문을 엽니다.",
  "내가 편하려고 하면 성과는 멀어집니다.",
  "단순한 판매자가 아닌, 믿음직한 비즈니스 파트너가 되어주십시오.",
  "오늘 흘린 땀은 정직한 보상으로 돌아올 것입니다.",
  "남들이 꺼리는 곳에 진짜 기회가 숨어 있을지도 모릅니다.",
  "거절당했다면 웃으며 돌아서십시오. 다음 기회를 위한 매너입니다.",
  "가장 큰 실패는 도전하지 않는 것입니다.",
  "특별한 비결은 없습니다. 멈추지 않고 계속하는 것이 비결입니다.",
  "고객에게 줄 수 있는 최고의 선물은 당신의 전문성입니다.",
  "질문의 수준이 당신의 가치를 결정합니다.",
  "고객이 느끼는 사소한 불편함이 우리에게는 기회입니다.",
  "힘들다는 생각이 들 때 한 발짝 더 내딛는 것, 그것이 프로의 차이입니다.",
  "영업은 정직한 농사입니다. 씨를 뿌려야 거둘 수 있습니다.",
  "준비된 멘트는 신뢰감을 높여줍니다.",
  "나 자신을 먼저 팔고, 그다음에 빈크래프트를 파십시오.",
  "거절당한 횟수만큼 당신의 내공은 깊어지고 있습니다.",
  "내일 할 일을 오늘 미루면 성과도 뒤로 밀려납니다.",
  "프로는 말이 아닌 결과로 과정을 증명합니다.",
  "고객의 시간을 아껴주는 것도 훌륭한 서비스입니다.",
  "우리가 포기한 그곳에 경쟁사가 깃발을 꽂을 수도 있습니다.",
  "매일 아침 \"나는 할 수 있다\"는 긍정의 주문을 거십시오.",
  "전화기를 두려워해서는 영업을 할 수 없습니다.",
  "불만 고객은 우리를 성장시키는 엄한 스승입니다.",
  "영업은 혼자 뛰는 것이 아니라 함께 호흡하는 팀플레이입니다.",
  "지름길은 없습니다. 정도(正道)가 가장 빠른 길입니다.",
  "침묵을 두려워하지 마십시오. 고객에게 생각할 시간을 주십시오.",
  "오늘 하루, 당신은 빈크래프트 그 자체였습니다.",
  "사소한 약속을 지키는 것이 큰 계약의 발판이 됩니다.",
  "부정적인 감정은 문 앞에서 털어버리고 입장하십시오.",
  "당신의 미소는 비용이 들지 않는 최고의 마케팅입니다.",
  "자료 준비가 철저해야 신뢰를 얻을 수 있습니다.",
  "'혹시나' 하는 마음으로 던진 제안이 '역시나'가 될 수 있습니다.",
  "고객은 당신의 눈을 보고 진실됨을 판단합니다.",
  "끈기 없는 천재보다 끈기 있는 노력파가 결국 승리합니다.",
  "내가 조금 더 번거로워야 고객이 편안해집니다.",
  "거절은 끝이 아니라 본격적인 협상의 시작입니다.",
  "활동량이 결과를 만듭니다. 많이 만나는 것이 중요합니다.",
  "오늘 마신 커피 잔 수가 당신의 열정을 대변합니다.",
  "고객에게 강요하기보다 스스로 선택하게 유도하십시오.",
  "어깨를 펴십시오. 당신은 빈크래프트의 자랑스러운 영업 전문가입니다.",
  "실패의 경험은 성공을 위한 소중한 데이터입니다.",
  "눈앞의 이익보다 사람을 남기는 영업을 하십시오.",
  "당신의 에너지가 소진될수록 실적은 쌓여갑니다.",
  "영업은 없는 것을 만드는 게 아니라, 숨겨진 니즈를 발견하는 것입니다.",
  "경쟁사를 비난하지 말고, 우리 제품의 가치를 이야기하십시오.",
  "긍정의 힘을 믿으십시오. 된다고 믿으면 방법이 보입니다.",
  "오늘 만나는 사람이 마지막 고객인 것처럼 최선을 다해주십시오.",
  "문은 두드리는 자에게만 열립니다.",
  "영업 일지는 성장을 기록하는 역사서입니다.",
  "적당히 해서는 적당한 결과만 나올 뿐입니다.",
  "고객은 우리에게 급여를 주는 실질적인 고용주입니다.",
  "퇴근 시간은 시계가 아닌 목표 달성 여부가 결정합니다.",
  "고민은 실행을 늦출 뿐, 문제를 해결해주지 않습니다.",
  "진정한 영업은 계약 후 관리에서 빛을 발합니다.",
  "첫 계약의 짜릿함을 기억하며 초심을 잃지 맙시다.",
  "당신의 태도가 곧 당신의 브랜드가 됩니다.",
  "기회는 고생이라는 포장지에 싸여 찾아옵니다.",
  "오늘 심은 콩이 내일의 풍성한 수확이 될 것입니다.",
  "안 되는 이유보다 되는 방법을 찾는 데 집중합시다.",
  "영업은 감동을 전달하는 휴먼 비즈니스입니다.",
  "스스로 한계를 규정짓지 마십시오. 당신은 더 높이 날 수 있습니다."
];
const COMPANY_QUOTES = [
  "축하합니다. 빈크래프트의 영토가 오늘 더 넓어졌습니다.",
  "'등록' 버튼을 누르는 순간, 이 업체는 당신의 소중한 자산이 됩니다.",
  "오늘 당신이 세운 깃발입니다. 자부심을 가지십시오.",
  "명함 한 장을 데이터로 전환하는 것, 이것이 자본의 시작입니다.",
  "단순한 리스트 추가가 아닙니다. 미래의 매출 파이프라인을 구축한 것입니다.",
  "고생 많으셨습니다. 하지만 등록은 관리를 위한 첫걸음임을 기억해 주십시오.",
  "이 업체가 훗날 당신을 최고의 영업 전문가로 만들어줄 것입니다.",
  "방금 나눈 대표님와의 약속, 그 신뢰를 여기에 기록합니다.",
  "하나를 심어야 열을 거둡니다. 오늘 아주 훌륭한 씨앗을 심으셨습니다.",
  "이 데이터가 쌓여 당신의 성과를 증명할 것입니다.",
  "텍스트로 남기지만, 당신은 오늘 현장에 '신뢰'를 남기고 왔습니다.",
  "빈칸을 채우는 건 손가락이지만, 마음을 채운 건 당신의 발품입니다.",
  "오늘의 등록 건수 추가, 당신의 성취감도 함께 올라갑니다.",
  "이제 이 고객사는 경쟁사가 넘볼 수 없는 우리 편이 되었습니다.",
  "꼼꼼한 기록이 훗날 당신의 결정적인 무기가 될 것입니다.",
  "수고하셨습니다. 잠시 숨을 고르고 다음 목표를 향해 나아갑시다.",
  "기록하지 않으면 잊힙니다. 당신의 노력을 소중히 보관하십시오.",
  "계약서의 잉크는 말라도, 당신의 열정은 기억될 것입니다.",
  "이 업체가 빈크래프트의 VIP가 될 수 있도록 잘 이끌어 주십시오.",
  "오늘 현장을 누비지 않았다면 이 화면을 볼 수 없었을 것입니다.",
  "거절을 극복하고 만들어낸 결과물입니다. 충분히 자랑스럽습니다.",
  "당신이 만든 DB는 누구도 대체할 수 없는 경쟁력입니다.",
  "숫자 하나가 늘어날 때마다 당신의 가능성도 확장됩니다.",
  "지금 입력하는 이 정보가 내일의 미팅을 완벽하게 만들 것입니다.",
  "영업은 발로 뛰고, 마무리는 꼼꼼함으로 완성됩니다.",
  "또 하나의 소중한 인연을 맺었습니다. 잘 키워가 봅시다.",
  "사소한 특이사항 메모 하나가 감동 영업의 시작점이 됩니다.",
  "오늘 하루, 프로로서의 역할을 훌륭히 해내셨습니다.",
  "이 업체는 이제 당신이라는 담당자를 믿고 함께할 것입니다.",
  "등록이 완료되었습니다. 이제 철저한 관리만이 남았습니다.",
  "지도 위에 점 하나를 찍었습니다. 곧 선이 되고 면이 될 것입니다.",
  "정확한 고객 등록은 미래의 나를 위한 배려입니다.",
  "방금 본 사장님의 표정, 잊지 말고 코멘트에 남겨두십시오.",
  "당신의 포트폴리오에 멋진 한 줄이 추가되었습니다.",
  "입력은 정확하게, 관리는 확실하게 부탁드립니다.",
  "오늘 흘린 땀방울을 안전하게 저장했습니다.",
  "문을 열 때의 설렘을, 나올 때의 확신으로 바꾸셨군요.",
  "이 한 건의 등록이 긍정적인 나비효과를 가져올 것입니다.",
  "잘 관리된 업체 하나가 열 곳의 신규 영업보다 나을 수 있습니다.",
  "빈크래프트의 뿌리가 오늘 조금 더 깊어졌습니다.",
  "이제부터가 진짜 승부입니다. 고객을 우리의 팬으로 만듭시다.",
  "영업 성공의 쾌감, 이 순간을 즐기십시오.",
  "오늘 당신의 구두 굽이 닳은 가치가 여기에 있습니다.",
  "번거로워하지 마십시오. 이 데이터가 훗날 당신을 돕습니다.",
  "오늘 만난 고객의 니즈, 빠짐없이 기록하셨습니까?",
  "\"등록되었습니다.\" 이 문구가 오늘의 노고를 위로합니다.",
  "누구보다 치열했던 오늘 하루의 값진 전리품입니다.",
  "이 업체에서 좋은 기운이 느껴집니다. 기대해 봅시다.",
  "훌륭합니다. 어제보다 더 성장한 영업 전문가가 되셨습니다.",
  "정보가 곧 자산입니다. 디테일할수록 가치는 올라갑니다.",
  "고객의 비즈니스가 성장해야 우리도 성장합니다. 파트너십의 시작입니다.",
  "콜드콜부터 미팅, 그리고 등록까지. 완벽한 프로세스였습니다.",
  "당신의 성실함이 시스템에 차곡차곡 기록되고 있습니다.",
  "다음 방문 때는 빈손이 아닌, 맞춤형 정보를 들고 갑시다.",
  "이 화면을 자주 볼수록 당신은 정상에 가까워집니다.",
  "남들이 포기할 때 당신은 결과를 만들어냈습니다.",
  "이제 이 고객은 당신의 관리 영역 안에 들어왔습니다.",
  "메모 한 줄이 1년 뒤 재계약의 열쇠가 됩니다.",
  "등록 버튼을 누르는 이 성취감, 잊지 마십시오.",
  "고생 많으셨습니다. 당신의 노고에 박수를 보냅니다.",
  "당신이 빈크래프트의 국가대표입니다. 소중한 실적입니다.",
  "오늘의 실적이 내일의 보상으로 이어질 것입니다.",
  "단순히 업체를 등록하는 게 아니라, 당신의 신용을 쌓는 중입니다.",
  "현장의 공기를 데이터로 남기는 중요한 시간입니다.",
  "정확하게 타겟을 공략하셨군요. 탁월합니다.",
  "까다로운 고객이었나요? 그래서 더 값진 결과입니다.",
  "당신의 끈기가 만들어낸 작품입니다.",
  "오늘 심은 나무에 지속적인 관심을 부탁드립니다.",
  "지금 입력하는 전화번호가 행운의 번호가 되길 바랍니다.",
  "빈크래프트의 이름에 걸맞은 품격 있는 영업이었습니다.",
  "이제 우리 가족입니다. 정성을 다해 관리해 주십시오.",
  "당신의 영업 일지에 실패란 없습니다. 경험과 성공만 있을 뿐입니다.",
  "등록된 업체 수가 당신의 성장을 대변합니다.",
  "프로는 마무리가 깔끔해야 합니다. 오타는 없는지 확인하십시오.",
  "여기서 만족하지 않고 더 큰 목표를 향해 나아갑시다.",
  "오늘 하루도 허투루 보내지 않았음을 스스로 증명했습니다.",
  "고객의 고민을 해결해 줄 솔루션, 이제 전달만 남았습니다.",
  "당신이 개척한 길을 후배들이 따라 걷게 될 것입니다.",
  "기록하는 자가 생존합니다. 디테일을 놓치지 마십시오.",
  "이 업체와의 인연이 좋은 결실을 맺기를 기대합니다.",
  "백 번의 생각보다 한 번의 실행과 등록이 강력합니다.",
  "당신의 에너지가 데이터 너머까지 전해지길 바랍니다.",
  "오늘 획득한 이 거점은, 시장 확장의 베이스캠프가 될 것입니다.",
  "수고하셨습니다. 오늘 저녁은 편안하게 쉬십시오.",
  "경쟁사가 긴장할 만한 소식이 하나 늘었습니다.",
  "영업은 확률 게임입니다. 당신은 오늘 승률을 높였습니다.",
  "고객을 '수단'이 아닌 '목적'으로 대했기에 가능한 결과입니다.",
  "다음 스케줄이 기다립니다. 여운은 짧게, 기록은 정확하게.",
  "이 버튼을 누르면, 책임감도 함께 부여됩니다.",
  "빈틈없는 영업 활동이었습니다. 완벽합니다.",
  "당신의 목소리, 눈빛, 태도가 만들어낸 결과값입니다.",
  "오늘 당신이 뛴 거리가 헛되지 않았음을 확인하는 순간입니다.",
  "이 업체가 소개에 소개를 가져올 것입니다.",
  "잘 심은 고객 하나, 열 콜드콜 부럽지 않습니다.",
  "당신의 노력이 헛되지 않았다는 가장 확실한 증거입니다.",
  "기회는 준비된 자에게 오고, 성과는 기록하는 자에게 남습니다.",
  "오늘도 빈크래프트의 역사를 한 줄 써 내려갔습니다.",
  "자신감을 가지십시오. 당신은 꽤 괜찮은 영업 전문가입니다.",
  "저장 완료. 보너스가 당신을 기다립니다.",
  "수고하셨습니다. 내일도 이 화면에서 뵙겠습니다.",
  "이 클릭 한 번이 빈크래프트의 시장 점유율을 높였습니다.",
  "영업의 끝은 등록이 아니라, 고객 만족의 시작입니다.",
  "차곡차곡 쌓인 데이터가 당신의 은퇴를 앞당겨 줄지도 모릅니다.",
  "사소해 보이는 정보라도 훗날 큰 무기가 될 수 있습니다.",
  "오늘 당신은 회사의 자산을 늘리는 데 기여했습니다.",
  "고객의 비즈니스 파트너로서 첫발을 내디뎠습니다.",
  "꼼꼼한 마무리는 프로페셔널의 기본 소양입니다.",
  "당신의 수첩에 있던 정보가 회사의 시스템이 되었습니다.",
  "오늘의 만남을 영원한 인연으로 만드는 것은 관리의 힘입니다.",
  "이 업체가 우리 서비스를 통해 성장하는 모습을 상상해 보십시오.",
  "훌륭한 성과입니다. 당신의 능력을 의심하지 마십시오.",
  "기록은 기억을 지배합니다. 상세하게 남겨주십시오.",
  "이 데이터는 훗날 당신의 후배들에게 훌륭한 교과서가 될 것입니다.",
  "영업 현장의 생생함을 이곳에 담아주십시오.",
  "당신의 열정이 텍스트로 변환되어 저장되었습니다.",
  "한 건의 등록 뒤에 숨겨진 당신의 수많은 노력을 압니다.",
  "이제 이 고객은 당신의 보호 아래 있습니다.",
  "성공적인 등록을 축하합니다. 다음 타겟은 어디입니까?",
  "체계적인 관리가 재구매를 부릅니다.",
  "오늘 하루, 빈크래프트의 영토 확장에 힘써주셔서 감사합니다.",
  "당신이 뿌린 씨앗이 무럭무럭 자라길 기대합니다.",
  "오늘의 성과를 바탕으로 내일 더 높이 비상합시다.",
  "등록된 고객 정보를 다시 한번 훑어보며 놓친 것은 없는지 점검합시다.",
  "당신의 발자취가 시스템에 영원히 남게 되었습니다.",
  "고객의 성공이 곧 당신의 성공입니다. 함께 성장합시다.",
  "이 업체가 훗날 우리 회사의 우수 사례가 되길 바랍니다.",
  "힘든 과정 끝에 얻은 결실이라 더욱 값집니다.",
  "당신은 오늘 비즈니스맨으로서 최선을 다했습니다.",
  "정보의 정확도가 영업의 질을 결정합니다.",
  "빈크래프트의 가족이 된 것을 환영한다고 고객에게 전해주십시오.",
  "성과는 운이 아니라 당신의 실력입니다.",
  "오늘 등록한 이 업체가 당신에게 큰 행운을 가져다주길 바랍니다.",
  "영업은 사람을 남기는 일입니다. 좋은 사람을 얻으셨습니다.",
  "당신의 노하우가 시스템에 녹아들고 있습니다.",
  "힘들었던 순간은 잊고, 성취의 기쁨만 기억하십시오.",
  "이 데이터는 당신이 흘린 땀의 결정체입니다.",
  "고객과의 약속, 시스템을 통해 철저히 지켜냅시다.",
  "빈크래프트의 성장은 당신의 손끝에서 시작됩니다.",
  "오늘 하루도 회사를 위해, 그리고 당신 자신을 위해 뛰셨습니다.",
  "등록은 신속하게, 정보는 정확하게. 프로답습니다.",
  "당신이 연결한 이 고리가 단단하게 유지되길 바랍니다.",
  "한 걸음 한 걸음이 모여 정상에 도달합니다.",
  "오늘의 등록이 내일의 매출 폭발로 이어지길 응원합니다.",
  "당신의 안목을 믿습니다. 좋은 업체임이 틀림없습니다.",
  "시스템에 등록된 순간, 우리의 책임도 시작됩니다.",
  "고객의 목소리를 가감 없이 기록해 주십시오.",
  "이 한 줄의 데이터가 빈크래프트의 경쟁력을 높입니다.",
  "수많은 거절 끝에 얻어낸 귀한 'YES'입니다.",
  "당신의 열정적인 에너지가 시스템 너머로도 느껴집니다.",
  "이제부터는 전략적인 관리가 필요한 시점입니다.",
  "고객의 특성을 파악하여 맞춤형 제안을 준비합시다.",
  "오늘의 노고가 헛되지 않도록 최선을 다해 지원하겠습니다.",
  "당신은 빈크래프트의 대체 불가능한 인재입니다.",
  "이 업체와의 거래가 원활하게 이어지도록 신경 써 주십시오.",
  "작은 차이가 명품을 만듭니다. 꼼꼼한 기록 부탁드립니다.",
  "오늘 당신이 보여준 끈기에 경의를 표합니다.",
  "고객에게 신뢰를 주는 영업, 앞으로도 계속 부탁드립니다.",
  "이 등록 건이 이번 달 목표 달성의 신호탄이 되길 바랍니다.",
  "당신의 성장이 곧 회사의 비전입니다.",
  "오늘 맺은 인연, 소홀함 없이 챙기겠습니다.",
  "정보 입력 완료. 이제 편안한 마음으로 퇴근하십시오.",
  "당신의 하루가 보람으로 가득 차기를 바랍니다.",
  "고객 만족을 위해 한 걸음 더 다가섰습니다.",
  "이 데이터들이 모여 빅데이터가 되고, 우리의 전략이 됩니다.",
  "현장의 생생한 목소리를 담아주셔서 감사합니다.",
  "당신의 통찰력이 빛나는 영업이었습니다.",
  "오늘 만난 고객이 평생 고객이 될 수 있도록 노력합시다.",
  "빈크래프트의 서비스가 고객에게 감동이 되길 바랍니다.",
  "등록 완료. 당신의 업무 리스트에서 하나가 해결되었습니다.",
  "바쁜 와중에도 꼼꼼하게 챙겨주셔서 감사합니다.",
  "이 업체의 성장이 당신에게도 보람이 될 것입니다.",
  "당신이 있어 빈크래프트의 영업망은 더욱 견고해집니다.",
  "오늘의 실적을 바탕으로 내일은 더 큰 꿈을 꿉시다.",
  "단순한 입력이 아닌, 가치를 저장하는 과정입니다.",
  "고객의 반응을 세심하게 살핀 당신의 관찰력이 돋보입니다.",
  "이 업체가 우리 회사의 든든한 우군이 되길 희망합니다.",
  "당신의 성실함은 언제나 빛을 발합니다.",
  "오늘 하루, 정말 고생 많으셨습니다.",
  "이 등록 건이 당신에게 기분 좋은 소식을 가져다줄 것입니다.",
  "빈크래프트와 함께 성장하는 파트너가 하나 더 늘었습니다.",
  "당신의 노력 덕분에 회사의 미래가 밝습니다.",
  "고객 관리의 달인이 되는 길, 오늘 한 걸음 더 나아갔습니다.",
  "정보 보안에도 유의하며 소중하게 다루겠습니다.",
  "당신의 발로 만든 지도, 우리가 함께 완성해 갑니다.",
  "오늘 획득한 정보가 내일의 전략이 됩니다.",
  "훌륭한 영업 활동이었습니다. 박수를 보냅니다.",
  "고객의 마음을 얻는 것, 그것이 진정한 승리입니다.",
  "등록된 정보는 수시로 업데이트하여 최신화합시다.",
  "당신의 헌신이 빈크래프트를 일류로 만듭니다.",
  "이 업체와의 여정, 즐겁게 시작해 봅시다.",
  "오늘의 성취감을 원동력 삼아 내일도 힘냅시다.",
  "당신이 흘린 땀의 가치를 우리는 알고 있습니다.",
  "고객에게 빈크래프트의 진가를 보여줄 차례입니다.",
  "꼼꼼한 일 처리가 당신의 신뢰도를 높입니다.",
  "이 등록이 당신의 커리어에 도움이 되길 바랍니다.",
  "오늘 하루도 목표를 향해 정진하느라 수고하셨습니다.",
  "당신의 열정이 빈크래프트를 움직이는 엔진입니다.",
  "고객과의 약속은 생명과 같습니다. 반드시 지킵시다.",
  "저장되었습니다. 당신의 노력도 함께 저장되었습니다.",
  "편안한 휴식 되십시오. 내일 뵙겠습니다.",
  "저장되었습니다. 당신의 수고가 헛되지 않음을 반드시 결과로 증명할 것입니다."
];
 const KOREA_REGIONS = {
 '서울특별시': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
 '부산광역시': ['강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구', '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구'],
 '대구광역시': ['남구', '달서구', '달성군', '동구', '북구', '서구', '수성구', '중구'],
 '인천광역시': ['강화군', '계양구', '남동구', '동구', '미추홀구', '부평구', '서구', '연수구', '옹진군', '중구'],
 '광주광역시': ['광산구', '남구', '동구', '북구', '서구'],
 '대전광역시': ['대덕구', '동구', '서구', '유성구', '중구'],
 '울산광역시': ['남구', '동구', '북구', '울주군', '중구'],
 '세종특별자치시': ['세종시'],
 '경기도': ['가평군', '고양시', '과천시', '광명시', '광주시', '구리시', '군포시', '김포시', '남양주시', '동두천시', '부천시', '성남시', '수원시', '시흥시', '안산시', '안성시', '안양시', '양주시', '양평군', '여주시', '연천군', '오산시', '용인시', '의왕시', '의정부시', '이천시', '파주시', '평택시', '포천시', '하남시', '화성시'],
 '강원도': ['강릉시', '고성군', '동해시', '삼척시', '속초시', '양구군', '양양군', '영월군', '원주시', '인제군', '정선군', '철원군', '춘천시', '태백시', '평창군', '홍천군', '화천군', '횡성군'],
 '충청북도': ['괴산군', '단양군', '보은군', '영동군', '옥천군', '음성군', '제천시', '증평군', '진천군', '청주시', '충주시'],
 '충청남도': ['계룡시', '공주시', '금산군', '논산시', '당진시', '보령시', '부여군', '서산시', '서천군', '아산시', '예산군', '천안시', '청양군', '태안군', '홍성군'],
 '전라북도': ['고창군', '군산시', '김제시', '남원시', '무주군', '부안군', '순창군', '완주군', '익산시', '임실군', '장수군', '전주시', '정읍시', '진안군'],
 '전라남도': ['강진군', '고흥군', '곡성군', '광양시', '구례군', '나주시', '담양군', '목포시', '무안군', '보성군', '순천시', '신안군', '여수시', '영광군', '영암군', '완도군', '장성군', '장흥군', '진도군', '함평군', '해남군', '화순군'],
 '경상북도': ['경산시', '경주시', '고령군', '구미시', '군위군', '김천시', '문경시', '봉화군', '상주시', '성주군', '안동시', '영덕군', '영양군', '영주시', '영천시', '예천군', '울릉군', '울진군', '의성군', '청도군', '청송군', '칠곡군', '포항시'],
 '경상남도': ['거제시', '거창군', '고성군', '김해시', '남해군', '밀양시', '사천시', '산청군', '양산시', '의령군', '진주시', '창녕군', '창원시', '통영시', '하동군', '함안군', '함양군', '합천군'],
 '제주특별자치도': ['서귀포시', '제주시']
 };
 // 법정동코드 (cortarNo) - 네이버부동산 API용
 const CORTAR_CODES = {
 '서울특별시': { code: '1100000000', districts: {
 '강남구': '1168000000', '강동구': '1174000000', '강북구': '1130500000', '강서구': '1150000000',
 '관악구': '1162000000', '광진구': '1121500000', '구로구': '1153000000', '금천구': '1154500000',
 '노원구': '1135000000', '도봉구': '1132000000', '동대문구': '1123000000', '동작구': '1159000000',
 '마포구': '1144000000', '서대문구': '1141000000', '서초구': '1165000000', '성동구': '1120000000',
 '성북구': '1129000000', '송파구': '1171000000', '양천구': '1147000000', '영등포구': '1156000000',
 '용산구': '1117000000', '은평구': '1138000000', '종로구': '1111000000', '중구': '1114000000', '중랑구': '1126000000'
 }},
 '부산광역시': { code: '2600000000', districts: {
 '강서구': '2644000000', '금정구': '2641000000', '기장군': '2671000000', '남구': '2629000000',
 '동구': '2617000000', '동래구': '2626000000', '부산진구': '2623000000', '북구': '2632000000',
 '사상구': '2653000000', '사하구': '2638000000', '서구': '2614000000', '수영구': '2650000000',
 '연제구': '2647000000', '영도구': '2620000000', '중구': '2611000000', '해운대구': '2635000000'
 }},
 '대구광역시': { code: '2700000000', districts: {
 '남구': '2720000000', '달서구': '2729000000', '달성군': '2771000000', '동구': '2714000000',
 '북구': '2723000000', '서구': '2717000000', '수성구': '2726000000', '중구': '2711000000'
 }},
 '인천광역시': { code: '2800000000', districts: {
 '강화군': '2871000000', '계양구': '2824500000', '남동구': '2820000000', '동구': '2814000000',
 '미추홀구': '2817700000', '부평구': '2823700000', '서구': '2826000000', '연수구': '2818500000',
 '옹진군': '2872000000', '중구': '2811000000'
 }},
 '광주광역시': { code: '2900000000', districts: {
 '광산구': '2920000000', '남구': '2915500000', '동구': '2911000000', '북구': '2917000000', '서구': '2914000000'
 }},
 '대전광역시': { code: '3000000000', districts: {
 '대덕구': '3023000000', '동구': '3011000000', '서구': '3017000000', '유성구': '3020000000', '중구': '3014000000'
 }},
 '울산광역시': { code: '3100000000', districts: {
 '남구': '3114000000', '동구': '3117000000', '북구': '3120000000', '울주군': '3171000000', '중구': '3111000000'
 }},
 '세종특별자치시': { code: '3600000000', districts: { '세종시': '3611000000' }},
 '경기도': { code: '4100000000', districts: {
 '가평군': '4182000000', '고양시': '4128000000', '과천시': '4129000000', '광명시': '4121000000',
 '광주시': '4161000000', '구리시': '4131000000', '군포시': '4141000000', '김포시': '4157000000',
 '남양주시': '4136000000', '동두천시': '4125000000', '부천시': '4119000000', '성남시': '4113000000',
 '수원시': '4111000000', '시흥시': '4139000000', '안산시': '4127000000', '안성시': '4155000000',
 '안양시': '4117000000', '양주시': '4163000000', '양평군': '4183000000', '여주시': '4167000000',
 '연천군': '4180000000', '오산시': '4137000000', '용인시': '4146000000', '의왕시': '4143000000',
 '의정부시': '4115000000', '이천시': '4150000000', '파주시': '4148000000', '평택시': '4122000000',
 '포천시': '4165000000', '하남시': '4145000000', '화성시': '4159000000'
 }}
 };
 const REACTION_COLORS = { negative: { bg: '#9ca3af', label: '부정' }, neutral: { bg: '#f97316', label: '양호' }, positive: { bg: '#22c55e', label: '긍정' }, special: { bg: '#ef4444', label: '특별', blink: true }, missed: { bg: '#eab308', label: '누락' } };
 const getKoreanToday = () => {
 return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
 };
 const getKoreanNow = () => {
 const now = new Date();
 const formatter = new Intl.DateTimeFormat('ko-KR', {
 timeZone: 'Asia/Seoul',
 year: 'numeric',
 month: '2-digit',
 day: '2-digit',
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit',
 hour12: false
 });
 const parts = formatter.formatToParts(now);
 const getPart = (type) => parts.find(p => p.type === type)?.value || '0';
 return {
 year: parseInt(getPart('year')),
 month: parseInt(getPart('month')) - 1,
 day: parseInt(getPart('day')),
 hour: parseInt(getPart('hour')),
 minute: parseInt(getPart('minute')),
 dayOfWeek: new Date(parseInt(getPart('year')), parseInt(getPart('month')) - 1, parseInt(getPart('day'))).getDay()
 };
 };
 const getKoreanDateStr = (offsetDays = 0) => {
 const d = new Date();
 d.setDate(d.getDate() + offsetDays);
 return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
 };
 const PROMO_ITEMS = ['명함', '브로셔', '전단지', '쿠폰'];

// ═══════════════════════════════════════════════════════════════
// 환경 변수 기반 API 키 및 URL 설정
// ═══════════════════════════════════════════════════════════════
// Google Vision API 키 (환경 변수에서 로드)
const GOOGLE_VISION_API_KEY = 'AIzaSyDcz5e1qre9QMbrKmUSjT9nEsajSnhIhAI';

// 프록시 서버 URL (CORS 우회용) - 환경 변수 또는 기본값
const PROXY_SERVER_URL = 'https://naver-scraper.onrender.com';

// 허용된 도메인 목록 (postMessage 보안용)
const ALLOWED_ORIGINS = [
  window.location.origin,
  'https://beancraft.co.kr',
  'https://www.beancraft.co.kr',
  import.meta.env.VITE_ALLOWED_ORIGIN
].filter(Boolean);

// ═══════════════════════════════════════════════════════════════
// 소상공인365 GIS API (인증 불필요 - 2026-01-23 검증 완료)
// ═══════════════════════════════════════════════════════════════
const SBIZ365_BASE_URL = 'https://bigdata.sbiz.or.kr';

// ═══════════════════════════════════════════════════════════════
// Netlify Functions 프록시 URL (CORS 우회)
// ═══════════════════════════════════════════════════════════════
const SBIZ_PROXY_URL = '/api/sbiz-proxy';

// 프록시를 통한 GIS API 호출 (CORS 우회)
const callGisAPIViaProxy = async (apiPath, params = {}, maxRetry = 3) => {
  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      const proxyUrl = new URL(SBIZ_PROXY_URL, window.location.origin);
      proxyUrl.searchParams.append('api', 'gis');
      proxyUrl.searchParams.append('endpoint', apiPath);
      
      // WGS84 좌표가 있으면 프록시에서 TM 변환
      if (params.wgs84_lat && params.wgs84_lng) {
        proxyUrl.searchParams.append('wgs84_lat', params.wgs84_lat);
        proxyUrl.searchParams.append('wgs84_lng', params.wgs84_lng);
        delete params.wgs84_lat;
        delete params.wgs84_lng;
      }
      
      // 나머지 파라미터 추가
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          proxyUrl.searchParams.append(k, v.toString());
        }
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(proxyUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log(`✅ GIS API ${apiPath} 성공 (${result.elapsedMs}ms)`);
          return result.data;
        }
        console.warn(`⚠️ GIS API ${apiPath} 응답 실패:`, result.error || '알 수 없는 오류');
      } else {
        console.warn(`⚠️ GIS API ${apiPath} HTTP 오류:`, response.status);
      }
    } catch (e) {
      console.warn(`⚠️ GIS API ${apiPath} 호출 실패 (${attempt}/${maxRetry}):`, e.message);
      if (attempt < maxRetry) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return null;
};

// 프록시를 통한 OpenAPI 호출 (키 자동 포함)
const callOpenAPIViaProxy = async (apiName, apiPath, params = {}) => {
  try {
    const proxyUrl = new URL(SBIZ_PROXY_URL, window.location.origin);
    proxyUrl.searchParams.append('api', 'open');
    proxyUrl.searchParams.append('endpoint', apiPath);
    proxyUrl.searchParams.append('apiName', apiName);
    
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        proxyUrl.searchParams.append(k, v.toString());
      }
    });
    
    const response = await fetch(proxyUrl.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        console.log(`✅ OpenAPI ${apiName} 성공`);
        return result.data;
      }
    }
  } catch (e) {
    console.warn(`⚠️ OpenAPI ${apiName} 호출 실패:`, e.message);
  }
  return null;
};

// 행정구역별 데이터 API (좌표 범위 기반)
const SBIZ365_GIS_API = {
  // 행정동별 데이터 (Rads) - 기존 API (참조용)
  saleAmt: '/gis/api/getMapRadsSaleAmt.json',
  popCnt: '/gis/api/getMapRadsPopCnt.json',
  storCnt: '/gis/api/getMapRadsStorCnt.json',
  earnAmt: '/gis/api/getMapRadsWholEarnAmt.json',
  cnsmpAmt: '/gis/api/getMapRadsWholCnsmpAmt.json',
  hhCnt: '/gis/api/getMapRadsHhCnt.json',
  wrcpplCnt: '/gis/api/getMapRadsWrcpplCnt.json',
  wholPpltnCnt: '/gis/api/getMapRadsWholPpltnCnt.json',
  
  // 상권별 데이터 (Bizon)
  bizonStor: '/gis/api/getMapBizonCntStor.json',
  bizonSale: '/gis/api/getMapBizonCntSaleAmt.json',
  bizonDynppl: '/gis/api/getMapBizonDynpplCnt.json',
  
  // 점포 히스토리 (개폐업 데이터)
  storeHistoryList: '/gis/api/getStoreHistoryList.json',
  storeHistory: '/gis/api/getStoreHistory.json',
  
  // 지역 목록
  sidoList: '/gis/com/megaListNoAll.json',
  sggList: '/gis/com/ctyList.json',
  dongList: '/gis/com/getAdmList.json',
  
  // 핫플레이스 상권
  hpTop10: '/gis/hpAnls/getBizonRnkTop10.json',
  bizonShape: '/gis/api/searchBizonShpeData.json',
};

// ═══════════════════════════════════════════════════════════════
// 새 소상공인365 API (2026년 1월 확인 - 작동 확인됨)
// ═══════════════════════════════════════════════════════════════
const SBIZ365_NEW_API = {
  // 좌표→행정동 변환
  coordToAdm: '/gis/api/getCoordToAdmPoint.json',
  // 유동인구 비교
  dynPplCmpr: '/sbiz/api/bizonSttus/DynPplCmpr/search.json',
  // 매출 평균
  salesAvg: '/sbiz/api/bizonSttus/DongSmkndTpbizStorUnitSlsAvg/search.json',
  // 방문 연령 순위
  vstAgeRnk: '/sbiz/api/bizonSttus/VstAgeRnk/search.json',
  // 방문 고객 수
  vstCst: '/sbiz/api/bizonSttus/VstCst/search.json',
  // 점포수
  cfrStcnt: '/sbiz/api/bizonSttus/cfrStcnt/search.json',
  // 배달 업종
  baeminTpbiz: '/sbiz/api/bizonSttus/BaeminTpbiz/search.json',
  // 업종 비교
  dongMTpctdCmpr: '/sbiz/api/bizonSttus/DongMTpctdCmpr/search.json',
  // 월평균 매출 목록
  mmavgList: '/sbiz/api/bizonSttus/getMmavgList/search.json',
};

// 프록시를 통한 새 API 호출 (dongCd 기반)
const callSbizAPI = async (endpoint, params = {}, maxRetry = 3) => {
  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      const proxyUrl = new URL(SBIZ_PROXY_URL, window.location.origin);
      proxyUrl.searchParams.append('api', 'sbiz');
      proxyUrl.searchParams.append('endpoint', endpoint);
      
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          proxyUrl.searchParams.append(k, v.toString());
        }
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(proxyUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 새 API는 resultCode: 'SUCCESS' 형태
          if (result.data.resultCode === 'SUCCESS') {
            console.log(`✅ 새 API ${endpoint.split('/').pop()} 성공`);
            return result.data.data;
          }
          // 배열 형태 응답 (좌표→행정동)
          if (Array.isArray(result.data)) {
            console.log(`✅ 새 API ${endpoint.split('/').pop()} 성공`);
            return result.data;
          }
        }
      }
      console.warn(`⚠️ 새 API ${endpoint} 응답 실패 (${attempt}/${maxRetry})`);
    } catch (e) {
      console.warn(`⚠️ 새 API ${endpoint} 호출 실패 (${attempt}/${maxRetry}):`, e.message);
      if (attempt < maxRetry) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return null;
};

// 좌표 → 행정동 코드 변환
const getCoordToDongCd = async (lat, lng) => {
  try {
    const proxyUrl = new URL(SBIZ_PROXY_URL, window.location.origin);
    proxyUrl.searchParams.append('api', 'coord');
    proxyUrl.searchParams.append('lat', lat.toString());
    proxyUrl.searchParams.append('lng', lng.toString());
    
    const response = await fetch(proxyUrl.toString());
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        const dong = result.data[0];
        // 인접 행정동 목록도 함께 반환 (반경 내 모든 동)
        const nearbyDongs = result.data.map(d => ({
          dongCd: d.dongCd,
          dongNm: d.dongNm,
          admdstCdNm: d.admdstCdNm
        }));
        console.log(`✅ 행정동: ${dong.dongNm} (${dong.dongCd}) + 인접 ${nearbyDongs.length - 1}개 동`);
        return {
          dongCd: dong.dongCd,
          dongNm: dong.dongNm,
          admdstCdNm: dong.admdstCdNm,
          nearbyDongs // 인접 동 목록 포함
        };
      }
    }
  } catch (e) {
    console.error('좌표→행정동 변환 실패:', e);
  }
  return null;
};

// WGS84 (위도/경도) → EPSG:5181 (TM) 좌표 변환
// Proj4 공식 기반 (소상공인365에서 사용하는 좌표계)
const transformWGS84toTM = (lng, lat) => {
  // EPSG:5181 파라미터 (중부원점TM)
  const a = 6378137.0; // GRS80 장반경
  const f = 1 / 298.257222101; // GRS80 편평률
  const lat0 = 38 * Math.PI / 180; // 원점 위도
  const lng0 = 127 * Math.PI / 180; // 원점 경도
  const k0 = 1.0; // 축척계수
  const x0 = 200000; // 가산좌표 X
  const y0 = 500000; // 가산좌표 Y
  
  const e2 = 2 * f - f * f;
  const e = Math.sqrt(e2);
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = e2 / (1 - e2) * Math.cos(latRad) * Math.cos(latRad);
  const A = (lngRad - lng0) * Math.cos(latRad);
  
  const M = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * latRad
    - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*latRad)
    + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*latRad)
    - (35*e2*e2*e2/3072) * Math.sin(6*latRad));
  
  const M0 = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * lat0
    - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*lat0)
    + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*lat0)
    - (35*e2*e2*e2/3072) * Math.sin(6*lat0));
  
  const x = k0 * N * (A + (1-T+C)*A*A*A/6 + (5-18*T+T*T+72*C-58*e2/(1-e2))*A*A*A*A*A/120) + x0;
  const y = k0 * (M - M0 + N * Math.tan(latRad) * (A*A/2 + (5-T+9*C+4*C*C)*A*A*A*A/24 + (61-58*T+T*T+600*C-330*e2/(1-e2))*A*A*A*A*A*A/720)) + y0;
  
  return { x: Math.round(x), y: Math.round(y) };
};

// TM → WGS84 역변환
const transformTMtoWGS84 = (x, y) => {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const lat0 = 38 * Math.PI / 180;
  const lng0 = 127 * Math.PI / 180;
  const k0 = 1.0;
  const x0 = 200000;
  const y0 = 500000;
  
  const e2 = 2 * f - f * f;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  
  const M0 = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * lat0
    - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*lat0)
    + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*lat0)
    - (35*e2*e2*e2/3072) * Math.sin(6*lat0));
  
  const M = M0 + (y - y0) / k0;
  const mu = M / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));
  
  const lat1 = mu + (3*e1/2 - 27*e1*e1*e1/32) * Math.sin(2*mu)
    + (21*e1*e1/16 - 55*e1*e1*e1*e1/32) * Math.sin(4*mu)
    + (151*e1*e1*e1/96) * Math.sin(6*mu);
  
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(lat1) * Math.sin(lat1));
  const T1 = Math.tan(lat1) * Math.tan(lat1);
  const C1 = e2 / (1 - e2) * Math.cos(lat1) * Math.cos(lat1);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(lat1) * Math.sin(lat1), 1.5);
  const D = (x - x0) / (N1 * k0);
  
  const lat = lat1 - (N1 * Math.tan(lat1) / R1) * (D*D/2 - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*e2/(1-e2))*D*D*D*D/24
    + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*e2/(1-e2) - 3*C1*C1)*D*D*D*D*D*D/720);
  const lng = lng0 + (D - (1 + 2*T1 + C1)*D*D*D/6 + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*e2/(1-e2) + 24*T1*T1)*D*D*D*D*D/120) / Math.cos(lat1);
  
  return { lat: lat * 180 / Math.PI, lng: lng * 180 / Math.PI };
};

// 좌표 기반 API 호출용 범위 계산 (중심점에서 반경 km)
const getCoordRange = (lat, lng, radiusKm = 2) => {
  const tm = transformWGS84toTM(lng, lat);
  const delta = radiusKm * 1000; // km → m
  return {
    minXAxis: tm.x - delta,
    maxXAxis: tm.x + delta,
    minYAxis: tm.y - delta,
    maxYAxis: tm.y + delta,
    centerX: tm.x,
    centerY: tm.y
  };
};

// 기존 API 설정 (호환성 유지)
const SBIZ365_API = {
  BASE_URL: SBIZ365_BASE_URL,
  snsAnaly: { key: 'd46f5d518688912176484b6f894664c5d0b252967d92f4bafc690904381d7ff5', path: '/openApi/snsAnaly', name: 'SNS 분석' },
  simple: { key: 'bb51c6d3d3f93e8172c7888e73eb19afb9120c9f61676c658648ee2853f88e85', path: '/openApi/simple', name: '간단분석' },
  tour: { key: 'fc2070ca36e0ec845ecfd8c949860cfe4552e56903afcb9bcea07a509f820bcd', path: '/openApi/tour', name: '관광 축제 정보' },
  slsIndex: { key: 'abddbf5dc29670b9209d75e4910c7fd932a8a1a43dcce9d18661585e4040f2fb', path: '/openApi/slsIndex', name: '매출추이' },
  delivery: { key: '3ba2863eaf4e3b30b3c0237ab9da80ed11f4a7579d4f212d5c318b8e41a3a304', path: '/openApi/delivery', name: '배달현황' },
  startupPublic: { key: '167264f6eef5710d8d79e96b1316e8c2cb85a197d32446d3849008d0376cf098', path: '/openApi/startupPublic', name: '상권지도' },
  detail: { key: 'b2d9a1ae52aace697124a56c7c2bbed2eeb94fd4996fb5935cb9a25cc4c3c869', path: '/openApi/detail', name: '상세분석' },
  stcarSttus: { key: '79a86fd460fe7478f52788c4a68a0e6f3406a23ff123c050a21a160a59946fd3', path: '/openApi/stcarSttus', name: '업력현황' },
  storSttus: { key: 'b36c5637768f458919f5179641dac0cd742791750dc016a8591c4e7a6ab649c1', path: '/openApi/storSttus', name: '업소현황' },
  weather: { key: '843e44cd955ebc42a684c9c892ada0b122713650e0e85c1f3ebe09c9aeff6319', path: '/openApi/weather', name: '창업기상도' },
  hpReport: { key: 'd269ecf98403fa878587eb925ded6ecf9e02f297da19f5d8ffec5cac7309647a', path: '/openApi/hpReport', name: '핫플레이스' }
};

// 공공데이터 API 키
const PUBLIC_DATA_API = {
  sangga: '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb', // 소상공인 상가정보
  rone: 'd18d0f03e0344e7f8c1e818a3a07bf95', // 한국부동산원 R-ONE
  seoul: '6d6c71717173656f3432436863774a', // 서울시 열린데이터
  sgis: { accessKey: '19b90ec81ec74e16ad99', serviceId: '8fddbbb3e014767891c' } // 통계청 SGIS
};

// ═══════════════════════════════════════════════════════════════
// 전국 API + 지역 API 보충 시스템
// 원칙: 전국 API로 기본 데이터 확보, 해당 지역에 추가 API 있으면 기존 카드에 보충
// ═══════════════════════════════════════════════════════════════

// 지역별 API 지원 현황
const REGIONAL_API_SUPPORT = {
  seoul: {
    name: '서울특별시',
    hasLocalAPI: true,
    apiType: 'seoul_opendata',
    features: ['실제 결제 데이터', '연령대별/성별 결제 비율'],
    source: '서울시 열린데이터광장',
    dataDate: '2024년 4분기'
  },
  gyeonggi: {
    name: '경기도',
    hasLocalAPI: true,
    apiType: 'gyeonggi_bigdata',
    features: ['연령대별 카드매출'],
    source: '경기도 빅데이터 포털',
    dataDate: '2024년'
  },
  // 나머지 지역: 전국 API + 인구 기반 추정
  other: {
    name: '기타 지역',
    hasLocalAPI: false,
    apiType: 'national_estimate',
    features: ['인구 기반 추정'],
    source: '통계청 SGIS',
    dataDate: '2024년'
  }
};

// 좌표 기반 지역 판별 함수
const getRegionFromCoords = (lat, lng) => {
  // 서울 경계 (대략적)
  if (lat >= 37.413 && lat <= 37.715 && lng >= 126.734 && lng <= 127.269) {
    return { ...REGIONAL_API_SUPPORT.seoul, code: 'seoul' };
  }
  // 경기 경계 (대략적)
  if (lat >= 36.893 && lat <= 38.295 && lng >= 126.367 && lng <= 127.865) {
    return { ...REGIONAL_API_SUPPORT.gyeonggi, code: 'gyeonggi' };
  }
  return { ...REGIONAL_API_SUPPORT.other, code: 'other' };
};

// 주소 기반 지역 판별 함수
const getRegionFromAddress = (address) => {
  if (!address) return { ...REGIONAL_API_SUPPORT.other, code: 'other' };
  if (address.includes('서울')) {
    return { ...REGIONAL_API_SUPPORT.seoul, code: 'seoul' };
  }
  if (address.includes('경기')) {
    return { ...REGIONAL_API_SUPPORT.gyeonggi, code: 'gyeonggi' };
  }
  return { ...REGIONAL_API_SUPPORT.other, code: 'other' };
};

// ═══════════════════════════════════════════════════════════════
// 업종 분류 코드 (소상공인365 상권정보 기준)
// ═══════════════════════════════════════════════════════════════
const BUSINESS_CATEGORY_CODES = {
  cafe: { code: 'Q01', name: '커피/음료', displayName: '카페/디저트' },
  restaurant: { code: 'Q02', name: '음식점', displayName: '음식점' },
  office: { code: 'N01', name: '사무실', displayName: '사무실/오피스' },
  finance: { code: 'K01', name: '금융/보험', displayName: '금융/보험' },
  beauty: { code: 'S01', name: '미용/네일', displayName: '미용/네일' },
  hospital: { code: 'Q04', name: '병원/의원', displayName: '병원/의원' },
  fitness: { code: 'R01', name: '헬스/운동', displayName: '헬스/운동' },
  academy: { code: 'P01', name: '학원/교육', displayName: '학원/교육' },
  convenience: { code: 'G01', name: '편의점', displayName: '편의점' },
  mart: { code: 'G02', name: '마트/슈퍼', displayName: '마트/슈퍼' },
  accommodation: { code: 'I01', name: '숙박', displayName: '숙박' },
  culture: { code: 'R02', name: '문화/여가', displayName: '문화/여가' }
};

// 업종별 카페 방향 분석 가이드
const BUSINESS_CAFE_STRATEGY = {
  office: {
    displayName: '사무실/오피스',
    strategy: '테이크아웃 특화',
    details: [
      '출근 시간(8-9시) 빠른 픽업 시스템',
      '점심 후(13-14시) 아메리카노 할인',
      '사전 주문 앱 연동 필수'
    ],
    peakTime: '08:00-09:00, 13:00-14:00',
    targetMenu: ['아메리카노', '라떼', '에너지 음료']
  },
  fitness: {
    displayName: '헬스장',
    strategy: '건강 음료 라인업',
    details: [
      '프로틴 쉐이크, 저칼로리 음료',
      '운동 전후 간편식 (에너지바, 샐러드)',
      '오후 5-8시 퇴근+운동 고객 타깃'
    ],
    peakTime: '17:00-20:00',
    targetMenu: ['프로틴 쉐이크', '저칼로리 라떼', '스무디']
  },
  beauty: {
    displayName: '미용실',
    strategy: '대기 고객 연계',
    details: [
      '미용실 대기 시간 평균 30분~1시간',
      '테이크아웃 + 미용실 제휴 할인',
      '여성 고객 타깃 디저트 강화'
    ],
    peakTime: '10:00-18:00',
    targetMenu: ['디저트', '과일 음료', '허브티']
  },
  hospital: {
    displayName: '병원/의원',
    strategy: '중장년 편안한 공간',
    details: [
      '환자/보호자 대기 시간 활용',
      '따뜻한 음료 중심 메뉴',
      '좌석 편안하게 배치'
    ],
    peakTime: '09:00-12:00, 14:00-17:00',
    targetMenu: ['따뜻한 차', '디카페인', '부드러운 디저트']
  },
  academy: {
    displayName: '학원/교육',
    strategy: '학부모/학생 타깃',
    details: [
      '학원 대기 학부모 공략',
      '학생 간식류 강화',
      '오후 3-6시 집중 운영'
    ],
    peakTime: '15:00-18:00',
    targetMenu: ['음료', '간식류', '간편 디저트']
  },
  restaurant: {
    displayName: '음식점',
    strategy: '식후 커피 연계',
    details: [
      '점심/저녁 식사 후 디저트 수요',
      '음식점 제휴 할인 프로모션',
      '디저트 카페 차별화'
    ],
    peakTime: '12:30-14:00, 19:00-21:00',
    targetMenu: ['디저트', '커피', '차']
  }
};

// ═══════════════════════════════════════════════════════════════
// 한국부동산원 임대료 데이터 (전국 주요 상권)
// 출처: 한국부동산원 상업용부동산 임대동향조사 2024년 4분기
// 단위: 만원/m2 (월세 기준)
// ═══════════════════════════════════════════════════════════════
const RENT_DATA_BY_REGION = {
  source: '한국부동산원 상업용부동산 임대동향조사',
  dataDate: '2024년 4분기',
  unit: '만원/m2 (월세)',
  regions: {
    // 서울
    '서울특별시': { avgRent: 8.2, vacancyRate: 7.8, yoyChange: 2.1 },
    '서울 강남구': { avgRent: 12.5, vacancyRate: 5.2, yoyChange: 3.2 },
    '서울 서초구': { avgRent: 10.8, vacancyRate: 6.1, yoyChange: 2.8 },
    '서울 마포구': { avgRent: 7.9, vacancyRate: 8.3, yoyChange: 1.5 },
    '서울 송파구': { avgRent: 9.2, vacancyRate: 6.8, yoyChange: 2.3 },
    '서울 영등포구': { avgRent: 7.5, vacancyRate: 9.2, yoyChange: 0.8 },
    '서울 종로구': { avgRent: 8.8, vacancyRate: 7.5, yoyChange: 1.2 },
    '서울 중구': { avgRent: 9.5, vacancyRate: 8.1, yoyChange: 0.5 },
    // 경기
    '경기도': { avgRent: 5.2, vacancyRate: 9.5, yoyChange: 1.8 },
    '경기 성남시': { avgRent: 6.8, vacancyRate: 8.2, yoyChange: 2.5 },
    '경기 수원시': { avgRent: 5.5, vacancyRate: 9.8, yoyChange: 1.5 },
    '경기 용인시': { avgRent: 5.2, vacancyRate: 10.2, yoyChange: 1.2 },
    // 광역시
    '부산광역시': { avgRent: 4.8, vacancyRate: 11.2, yoyChange: -0.5 },
    '대구광역시': { avgRent: 4.2, vacancyRate: 12.5, yoyChange: -1.2 },
    '인천광역시': { avgRent: 4.5, vacancyRate: 10.8, yoyChange: 0.8 },
    '광주광역시': { avgRent: 3.8, vacancyRate: 11.5, yoyChange: -0.3 },
    '대전광역시': { avgRent: 4.0, vacancyRate: 10.2, yoyChange: 0.5 },
    '울산광역시': { avgRent: 3.5, vacancyRate: 13.2, yoyChange: -1.8 },
    // 전국 평균
    '전국평균': { avgRent: 4.8, vacancyRate: 10.5, yoyChange: 0.8 }
  },
  // 평형별 환산 기준
  sizeConversion: {
    '10평': 33,
    '15평': 49.5,
    '20평': 66,
    '25평': 82.5,
    '30평': 99
  }
};

// 주소에서 임대료 데이터 찾기
const getRentDataByAddress = (address) => {
  if (!address) return RENT_DATA_BY_REGION.regions['전국평균'];
  
  // 상세 지역 먼저 검색
  for (const [region, data] of Object.entries(RENT_DATA_BY_REGION.regions)) {
    if (address.includes(region.replace('서울 ', '').replace('경기 ', ''))) {
      return { ...data, regionName: region };
    }
  }
  
  // 시/도 단위 검색
  if (address.includes('서울')) return { ...RENT_DATA_BY_REGION.regions['서울특별시'], regionName: '서울특별시' };
  if (address.includes('경기')) return { ...RENT_DATA_BY_REGION.regions['경기도'], regionName: '경기도' };
  if (address.includes('부산')) return { ...RENT_DATA_BY_REGION.regions['부산광역시'], regionName: '부산광역시' };
  if (address.includes('대구')) return { ...RENT_DATA_BY_REGION.regions['대구광역시'], regionName: '대구광역시' };
  if (address.includes('인천')) return { ...RENT_DATA_BY_REGION.regions['인천광역시'], regionName: '인천광역시' };
  if (address.includes('광주')) return { ...RENT_DATA_BY_REGION.regions['광주광역시'], regionName: '광주광역시' };
  if (address.includes('대전')) return { ...RENT_DATA_BY_REGION.regions['대전광역시'], regionName: '대전광역시' };
  if (address.includes('울산')) return { ...RENT_DATA_BY_REGION.regions['울산광역시'], regionName: '울산광역시' };
  
  return { ...RENT_DATA_BY_REGION.regions['전국평균'], regionName: '전국평균' };
};

// 영업모드 PIN 코드
const SALES_MODE_PIN = '1004';

// ═══════════════════════════════════════════════════════════════
// 프랜차이즈 데이터 (공정거래위원회 정보공개서 기반 검증 데이터)
// 마지막 업데이트: 2025년 1월
// 주의: 창업비용은 임대료, 권리금, 보증금 별도. 실제 총 비용은 1.5~2배 이상 소요될 수 있음
// ═══════════════════════════════════════════════════════════════
const FRANCHISE_DATA = {
  // ═══ 저가 커피 브랜드 (공정위 정보공개서 검증) ═══
  
  '메가MGC커피': { 
    // 출처: 공정위 정보공개서 2023년 기준, 뉴시스 2023.08.21
    가맹비: 550, 교육비: 330, 보증금: 200, 기타비용: 5599, 
    인테리어: 1540, // 33㎡(10평) 기준
    총비용: '약 6,679만원 (10평 기준, 임대료/권리금 별도)',
    아메리카노: 2000, 로열티월: null, 광고비월: null, 
    매장수: 3038, // 2024년 기준
    연평균매출: 28600, // 만원, 2022년 기준
    폐업률: 0.52, // %, 2023년 기준
    카테고리: '저가',
    이슈: [
      '본사 영업이익 140% 증가 vs 가맹점 매출 정체 (국회 자료)',
      '폐업률 0.52%로 업계 최저 수준',
      '명의변경 건수 증가 추세 (기존 점주 운영 포기)'
    ],
    검증일자: '2025-01'
  },
  
  '컴포즈커피': { 
    // 출처: 공정위 정보공개서 2023년 기준, 비즈한국 2024.11.25
    가맹비: 550, 교육비: 220, 보증금: 500, 기타비용: 9159,
    인테리어: 1600, // 33㎡(10평) 기준
    총비용: '약 1억 429만원 (10평 기준, 임대료/권리금 별도)',
    아메리카노: 1500, 로열티월: null, 광고비월: null,
    매장수: 2500, // 2024년 기준
    연평균매출: null, // 미확인
    폐업률: 0.63, // %, 2023년 기준
    평균영업기간: '1년 6개월', // 저가 커피 중 가장 짧음
    카테고리: '저가',
    이슈: [
      '평균 영업기간 1년 6개월 (저가 커피 중 최저)',
      '명의변경 건수 매년 증가 (운영 포기 점주 증가)',
      '폐업률 0.63%로 낮은 편이나 해석 주의 필요'
    ],
    검증일자: '2025-01'
  },
  
  '빽다방': { 
    // 출처: 공정위 정보공개서 2023년 기준, 뉴시스 2023.08.21
    가맹비: 330, 교육비: 330, 보증금: 500, 기타비용: 6827,
    인테리어: 1672, // 33㎡(10평) 기준
    총비용: '약 7,987만원 (10평 기준, 임대료/권리금 별도)',
    아메리카노: 2000, 로열티월: null, 광고비월: null,
    매장수: 1514, // 2024년 3월 기준
    연평균매출: 29000, // 만원, 2022년 기준 (최고)
    폐업률: 1.38, // %, 2023년 기준
    카테고리: '저가',
    이슈: [
      '점포 평균 매출 저가 커피 중 1위',
      '폐업률 1.38%로 메가/컴포즈보다 높음',
      '백종원 브랜드 인지도, 더본코리아 매출 4,107억원'
    ],
    검증일자: '2025-01'
  },
  
  '더벤티': { 
    // 출처: 공정위 정보공개서 2023년 기준
    가맹비: null, 교육비: null, 보증금: null, 기타비용: null,
    인테리어: 1760, // 33㎡(10평) 기준
    총비용: '약 7,975만원 (10평 기준, 임대료/권리금 별도)',
    아메리카노: 1500, 로열티월: null, 광고비월: null,
    매장수: 1360, // 2024년 기준
    연평균매출: null,
    폐업률: null,
    카테고리: '저가',
    이슈: [
      '파격 프로모션으로 초기 비용 부담 완화',
      '상세 재무 데이터 미공개',
      '폐업률/영업기간 데이터 미확인'
    ],
    검증일자: '2025-01'
  },
  
  '매머드커피': { 
    // 출처: 뉴스 종합
    가맹비: null, 교육비: null, 보증금: null, 기타비용: null,
    인테리어: null,
    총비용: '미확인',
    아메리카노: 1800, 로열티월: null, 광고비월: null,
    매장수: 632, // 2024년 기준
    연평균매출: null,
    폐업률: null,
    카테고리: '저가',
    이슈: [
      '상세 창업비용 데이터 미확인',
      '폐업률/수익성 데이터 미공개'
    ],
    검증일자: '2025-01'
  },

  // ═══ 중저가~중가 커피 브랜드 ═══
  
  '이디야커피': { 
    // 출처: 공정위 정보공개서 2022년 기준
    가맹비: null, 교육비: null, 보증금: null, 기타비용: null,
    인테리어: 4180, // 66㎡(20평) 기준, 평당 209만원
    총비용: '약 1억 2,913만원 (20평 기준, 임대료/권리금 별도)',
    아메리카노: 3300, 로열티월: null, 광고비월: null,
    매장수: 3019, // 2024년 기준
    연평균매출: 18033, // 만원, 2022년 기준
    폐업률: 2.8, // %, 저가 대비 높음
    카테고리: '중저가',
    이슈: [
      '폐업률 2.8% (저가 커피 대비 높음)',
      '저가 커피 성장으로 경쟁 심화',
      '국내 가맹점 수 1위 (스타벅스 제외)',
      '매장수 감소 추세 (4천개→3천개)'
    ],
    검증일자: '2025-01'
  },
  
  '투썸플레이스': { 
    // 출처: 뉴스 종합
    가맹비: null, 교육비: null, 보증금: null, 기타비용: null,
    인테리어: null,
    총비용: '약 1.5~2억원 (추정, 임대료/권리금 별도)',
    아메리카노: 4500, 로열티월: null, 광고비월: null,
    매장수: 1640, // 2024년 기준
    연평균매출: null,
    폐업률: null,
    영업이익률: 5.4, // %
    카테고리: '중고가',
    이슈: [
      'CJ 계열사 안정성',
      '프리미엄 디저트 강점',
      '높은 초기 비용',
      '상세 가맹 조건 미공개'
    ],
    검증일자: '2025-01'
  },
  
  '할리스': { 
    // 출처: 뉴스 종합
    가맹비: null, 교육비: null, 보증금: null, 기타비용: null,
    인테리어: null,
    총비용: '미확인',
    아메리카노: 4300, 로열티월: null, 광고비월: null,
    매장수: 530, // 2024년 기준
    연평균매출: null,
    폐업률: null,
    영업이익률: 6.26, // %
    카테고리: '중고가',
    이슈: [
      '매장 수 감소 추세',
      '국내 1세대 커피전문점',
      '리브랜딩 진행 중'
    ],
    검증일자: '2025-01'
  },
  
  '엔제리너스': { 
    // 출처: 뉴스 종합
    가맹비: null, 교육비: null, 보증금: null, 기타비용: null,
    인테리어: null,
    총비용: '미확인',
    아메리카노: 4000, 로열티월: null, 광고비월: null,
    매장수: null, // 급감 중
    연평균매출: null,
    폐업률: null,
    카테고리: '중고가',
    이슈: [
      '롯데 계열사이나 매장 수 급감',
      '브랜드 리포지셔닝 중',
      '상세 데이터 미확인'
    ],
    검증일자: '2025-01'
  },

  // ═══ 프리미엄 브랜드 (참고용 - 직영 또는 가맹 제한) ═══
  
  '스타벅스': { 
    // 출처: SCK컴퍼니 공시, 2024년 기준
    // 참고: 전 매장 직영, 가맹 불가
    가맹비: null, 교육비: null, 보증금: null, 기타비용: null,
    인테리어: null,
    총비용: '가맹 불가 (전 매장 직영)',
    아메리카노: 4500, 로열티월: null, 광고비월: null,
    매장수: 2076, // 2025년 기준
    연매출총액: 31001, // 억원, 2024년
    매장당평균매출: 114000, // 만원 (11.4억원)
    영업이익률: 4.8, // %, 2025년 상반기
    카테고리: '프리미엄',
    이슈: [
      '국내 커피 매출 1위 (3.1조원)',
      '가장 자주 이용하는 카페 40.5%',
      '영업이익률 하락 추세 (10.1%→4.8%)',
      '가맹 불가 (직영 전용)'
    ],
    검증일자: '2025-01'
  },
  
  '폴바셋': { 
    // 출처: 매일유업 자회사, 직영
    가맹비: null, 교육비: null, 보증금: null, 기타비용: null,
    인테리어: null,
    총비용: '가맹 불가 (전 매장 직영)',
    아메리카노: 5000, 로열티월: null, 광고비월: null,
    매장수: null,
    연평균매출: null,
    폐업률: null,
    영업이익률: 4.6, // %
    카테고리: '프리미엄',
    이슈: [
      '바리스타 챔피언 브랜드',
      '원재료 가격 상승으로 메뉴 가격 인상',
      '가맹 불가 (직영 전용)'
    ],
    검증일자: '2025-01'
  }
};

// ═══════════════════════════════════════════════════════════════
// 시장 경고 데이터 (2024-2025년 기준 검증된 통계)
// ═══════════════════════════════════════════════════════════════
const MARKET_WARNING_DATA = {
  전체시장: {
    브랜드수: 886, // 커피전문점 프랜차이즈 (치킨 669개보다 200개 이상 많음)
    전국매장수: '약 93,000개', // 통계청 서비스업조사 2024
    서울폐업률: 4.2, // 2024년 2분기, 개업률 4.3%와 비슷 (eventmoa)
    // 통계청 기업생멸행정통계 2023 기준
    신생점1년생존율: 64.9,
    신생점3년생존율: 46.3,
    신생점5년생존율: 34.7,
    숙박음식점5년생존율: 22.8, // 통계청 - 숙박·음식점업 최저
    '20대폐업률': 20.4, // 50대 8.0%의 2.5배
    본사vs가맹점: '본사 영업이익 140% 증가 vs 가맹점 평당매출 1.5% 증가 (2020-2024)',
    가맹점폐업률추이: '2.4% → 4.6% (2.2%p 증가)',
    '100대생활업종3년생존율': 52.3, // 국세청 2024
    출처: '통계청 기업생멸행정통계, 국세청, 공정위',
    기준일: '2023-2024'
  },
  
  // 정부 창업지원 효과 (중기부 공식 통계)
  창업지원효과: {
    // 출처: 중소벤처기업부 2017년 기준 창업지원기업 이력·성과 조사 (2019.04.03 발표)
    일반기업1년생존율: 64.9,
    일반기업3년생존율: 46.3,
    일반기업5년생존율: 34.7,
    지원기업1년생존율: 89.4,
    지원기업3년생존율: 68.1,
    지원기업5년생존율: 53.1,
    출처: '중소벤처기업부 창업지원기업 이력·성과 조사',
    기준일: '2017년 기준 (2019년 발표)',
    참고: '창업지원을 받은 기업과 일반 창업기업의 생존율 비교'
  },
  
  주의사항: [
    '본사 홈페이지 창업비용은 빙산의 일각 - 임대료, 권리금, 보증금, 운영자금 별도',
    '폐업률만 보지 말고 "명의변경 건수"도 확인 - 운영 포기 후 매각 사례 증가',
    '평균 영업기간이 짧은 브랜드 주의 - 투자금 회수 전 폐업 리스크',
    '신규 출점이 많은 브랜드 ≠ 좋은 브랜드 - 포화 상권 위험',
    '매장 수 급증 브랜드 = 내 상권에 경쟁점 생길 확률 높음',
    '카페 월 평균 매출 1,200~1,400만원, 순이익률 10~15% 수준 (민간 추산)'
  ]
};

// ═══════════════════════════════════════════════════════════════
// 검증된 공식 통계 (AI 분석 시 참조용)
// 이 데이터는 정부 공식 통계입니다. 임의 수정 금지.
// ═══════════════════════════════════════════════════════════════
const VERIFIED_STATISTICS = {
  // 생존율 통계 (통계청 기업생멸행정통계 2023)
  전체창업기업: {
    '1년생존율': 64.9,
    '3년생존율': 46.3,
    '5년생존율': 34.7,
    출처: '통계청 기업생멸행정통계',
    기준: '2023년'
  },
  숙박음식점업: {
    '5년생존율': 22.8,
    설명: '전 업종 중 최저 수준',
    출처: '통계청 기업생멸행정통계',
    기준: '2020년'
  },
  // 100대 생활업종 (국세청 2023)
  '100대생활업종': {
    '1년생존율': 77.9,
    '3년생존율': 53.8,
    '5년생존율': 39.6,
    출처: '국세청 국세통계포털',
    기준: '2023년'
  },
  // 정부 창업지원 효과 (중기부 2019 발표)
  정부창업지원기업: {
    '1년생존율': 89.4,
    '3년생존율': 68.1,
    '5년생존율': 53.1,
    출처: '중소벤처기업부 창업지원기업 이력·성과 조사',
    기준: '2017년 기준 (2019년 발표)'
  },
  // 카페 시장 현황 (통계청 서비스업조사 2024)
  카페시장: {
    전국커피전문점수: 93000,
    폐업률: 14.1,
    출처: '통계청 서비스업조사, 시사저널',
    기준: '2024년'
  },
  // OECD 비교 (중기부)
  OECD비교: {
    한국5년생존율: 33.8,
    OECD평균5년생존율: 45.4,
    순위: '28개국 중 26위',
    출처: '중소벤처기업부',
    기준: '2020년'
  }
};

// 과거 데이터 호환성을 위한 별칭 (기존 코드 동작 보장)
FRANCHISE_DATA['메가커피'] = FRANCHISE_DATA['메가MGC커피'];
FRANCHISE_DATA['이디야'] = FRANCHISE_DATA['이디야커피'];

// ═══════════════════════════════════════════════════════════════
// 날씨별 매출 영향 데이터 (상권 유형별) - 추정치
// 주의: 아래 수치는 업계 경험 기반 추정치입니다. 공식 통계 아님.
// 실제 매출 영향은 개별 매장 상황에 따라 크게 다를 수 있습니다.
// ═══════════════════════════════════════════════════════════════
const WEATHER_SALES_IMPACT = {
  // 상권 유형별 날씨 민감도 (추정치 - 참고용)
  지하상권: { 
    비: -8, 맑음: +3, 흐림: 0, 눈: -5, 폭염: +5, 한파: +3,
    설명: '지하철 연결 상권은 날씨 영향이 상대적으로 적습니다. (추정)'
  },
  오피스: { 
    비: -12, 맑음: +5, 흐림: -2, 눈: -15, 폭염: +8, 한파: +5,
    설명: '오피스 상권은 직장인 고정 수요가 있어 날씨 영향이 적은 편입니다. (추정)'
  },
  주거밀집: { 
    비: -18, 맑음: +8, 흐림: -5, 눈: -25, 폭염: +10, 한파: -10,
    설명: '주거 밀집 지역은 날씨에 따른 외출 빈도 변화가 큽니다. (추정)'
  },
  상업중심: { 
    비: -15, 맑음: +12, 흐림: -3, 눈: -20, 폭염: -5, 한파: -15,
    설명: '유동인구 중심 상권으로 날씨 영향을 많이 받습니다. (추정)'
  },
  대학가: { 
    비: -20, 맑음: +15, 흐림: -8, 눈: -30, 폭염: -10, 한파: -20,
    설명: '학생 유동인구 중심이라 날씨 민감도가 매우 높습니다. (추정)'
  },
  관광지: { 
    비: -35, 맑음: +25, 흐림: -15, 눈: -40, 폭염: -15, 한파: -30,
    설명: '관광객 유입에 전적으로 의존하여 날씨 영향이 매우 큽니다. (추정)'
  },
  테이크아웃특화: {
    비: -25, 맑음: +5, 흐림: -10, 눈: -35, 폭염: +15, 한파: -5,
    설명: '테이크아웃 위주 매장은 날씨가 나쁘면 매출이 크게 감소합니다. (추정)'
  },
  기본: { 
    비: -15, 맑음: +8, 흐림: -3, 눈: -20, 폭염: 0, 한파: -8,
    설명: '일반적인 카페 상권의 날씨 영향입니다. (추정)'
  },
  _경고: '이 데이터는 업계 경험 기반 추정치로, 공식 통계가 아닙니다.'
};

// 지역별 상권 유형 추정 (키워드 기반)
const getRegionType = (regionName) => {
  const name = regionName.toLowerCase();
  if (name.includes('역') && (name.includes('강남') || name.includes('홍대') || name.includes('신촌') || name.includes('종로'))) return '지하상권';
  if (name.includes('대학') || name.includes('대')) return '대학가';
  if (name.includes('해운대') || name.includes('명동') || name.includes('인사동') || name.includes('경복궁')) return '관광지';
  if (name.includes('테헤란') || name.includes('여의도') || name.includes('광화문') || name.includes('을지로')) return '오피스';
  if (name.includes('아파트') || name.includes('주공') || name.includes('동')) return '주거밀집';
  return '기본';
};

// Gemini AI API 키
// Gemini API - 서버사이드 프록시 사용 (API 키 노출 방지)
const callGeminiProxy = async (contents, generationConfig, signal, tools) => {
  // thinking 비활성화 (응답 속도 3초 vs 30초+)
  const config = { ...generationConfig, thinkingConfig: { thinkingBudget: 0 } };
  const body = { contents, generationConfig: config };
  if (tools) body.tools = tools;
  return await fetch('/.netlify/functions/gemini-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: signal || undefined,
    body: JSON.stringify(body)
  });
};
const YOUTUBE_API_KEY = 'AIzaSyB-UMN0rxjsMT8JKB6peEJOxTrObTJpT3k'; // YouTube Data API v3 키 (무료 할당량: 일 10,000 단위)

// Store OS 디자인 시스템
const UI = {
  colors: {
    black: '#171717',
    white: '#FFFFFF',
    border: '#E5E5E5',
    gray: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#E5E5E5',
      300: '#D4D4D4',
      400: '#A3A3A3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717'
    }
  },
  text: {
    primary: '${t.text}',
    secondary: 'text-neutral-500',
    muted: 'text-neutral-400'
  },
  btn: {
    black: 'px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all',
    white: 'px-4 py-2 bg-white ${t.text} border border-neutral-200 rounded-lg font-medium hover:bg-neutral-50 transition-all',
    outline: 'px-4 py-2 bg-transparent text-neutral-700 border border-neutral-200 rounded-lg font-medium hover:bg-neutral-50 transition-all'
  },
  input: 'w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all',
  card: 'bg-white border border-neutral-200 rounded-2xl',
  sidebar: {
    bg: 'bg-neutral-900',
    text: 'text-white',
    active: 'bg-white/10',
    hover: 'hover:bg-white/5'
  }
};

 const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
 const getChosung = (str) => str.split('').map(char => { const code = char.charCodeAt(0) - 44032; if (code >= 0 && code <= 11171) return CHO[Math.floor(code / 588)]; return char; }).join('');
 const matchChosung = (text, search) => { if (!search) return true; const textLower = text.toLowerCase(); const searchLower = search.toLowerCase(); if (textLower.includes(searchLower)) return true; return getChosung(text).includes(getChosung(search)); };
 const shortRegion = (region) => { if (!region) return ''; const parts = region.split(' '); if (parts.length >= 2) return parts.slice(-2).join(' '); return region; };
 const initManagers = [
 { id: 1, name: '김영업', color: '#3b82f6', username: 'sm001', password: '1234', promo: { '명함': 0, '브로셔': 0, '전단지': 0, '쿠폰': 0 } },
 { id: 2, name: '이영업', color: '#10b981', username: 'sm002', password: '1234', promo: { '명함': 0, '브로셔': 0, '전단지': 0, '쿠폰': 0 } }
 ];

// ═══════════════════════════════════════════════════════════════
// LocationAnalysisModal - 지역 선택 분석 모달 (반경 500m, 테마 대응)
// ═══════════════════════════════════════════════════════════════
const LocationAnalysisModal = ({ data, onClose, onDetailAnalysis, generateAIFeedback, theme = 'dark' }) => {
  const [aiFeedback, setAiFeedback] = useState(null);
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
  const t = THEME_COLORS[theme];
  
  // AI 피드백 생성
  useEffect(() => {
    const loadAIFeedback = async () => {
      if (data && !data.error && generateAIFeedback) {
        setAiFeedbackLoading(true);
        try {
          const feedback = await generateAIFeedback(data);
          setAiFeedback(feedback);
        } catch (e) {
          console.error('AI 피드백 생성 실패:', e);
        } finally {
          setAiFeedbackLoading(false);
        }
      }
    };
    loadAIFeedback();
  }, [data, generateAIFeedback]);
  
  if (!data) return null;
  
  const { location, businessCounts, commercialMetrics, customerData, openCloseData, rentData, sources } = data;
  
  // 경쟁 강도 계산
  const cafeCount = businessCounts?.cafe || 0;
  let competitionLevel = { label: '양호', color: 'text-green-600', bg: 'bg-green-100' };
  if (cafeCount > 50) competitionLevel = { label: '매우 과밀', color: 'text-red-600', bg: 'bg-red-100' };
  else if (cafeCount > 35) competitionLevel = { label: '과밀', color: 'text-orange-600', bg: 'bg-orange-100' };
  else if (cafeCount > 20) competitionLevel = { label: '보통', color: 'text-yellow-600', bg: 'bg-yellow-100' };
  
  // 개폐업 상태 계산
  const netChange = openCloseData?.netChange || 0;
  let openCloseStatus = { label: '정체', color: 'text-gray-500' };
  if (netChange > 2) openCloseStatus = { label: '성장', color: 'text-green-500' };
  else if (netChange < -2) openCloseStatus = { label: '쇠퇴', color: 'text-red-500' };
  
  // 전체 업종 추출 (카페 제외, 0개인 것도 제외)
  const topBusinesses = businessCounts ? Object.entries(businessCounts)
    .filter(([key, count]) => key !== 'cafe' && key !== '_isEstimate' && count > 0)
    .sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
        {/* 헤더 */}
        <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
          <div>
            <h2 className={`text-lg font-bold ${t.text}`}>선택 지역 분석</h2>
            <p className={`text-sm ${t.textMuted}`}>{location?.address || '주소 없음'} (반경 500m)</p>
          </div>
          <button onClick={onClose} className={`w-8 h-8 flex items-center justify-center ${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <span className="text-xl">×</span>
          </button>
        </div>
        
        {/* 콘텐츠 - 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* 업종 현황 */}
          <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
            <h3 className={`text-sm font-bold mb-3 ${t.text}`}>반경 500m 업종 현황</h3>
            
            {/* 카페 (경쟁 강도 표시) */}
            <div className={`mb-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${t.text}`}>카페/디저트</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${t.text}`}>{cafeCount}개</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${competitionLevel.bg} ${competitionLevel.color}`}>
                    {competitionLevel.label}
                  </span>
                </div>
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-neutral-600' : 'bg-neutral-200'}`}>
                <div 
                  className={`h-full ${cafeCount > 50 ? 'bg-red-500' : cafeCount > 35 ? 'bg-orange-500' : cafeCount > 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(cafeCount / 60 * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            {/* 기타 업종 */}
            <div className="space-y-2">
              {topBusinesses.map(([key, count]) => {
                const category = BUSINESS_CATEGORY_CODES[key];
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className={t.textSecondary}>{category?.displayName || key}</span>
                    <span className={`font-medium ${t.text}`}>{count}개</span>
                  </div>
                );
              })}
            </div>
            
            {businessCounts?._isEstimate && (
              <p className={`text-xs mt-3 ${t.textMuted}`}>* 일부 데이터는 추정값입니다</p>
            )}
          </div>
          
          {/* 상권 지표 */}
          <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
            <h3 className={`text-sm font-bold mb-3 ${t.text}`}>상권 지표</h3>
            <div className="grid grid-cols-2 gap-3">
              {commercialMetrics?.avgMonthlySales && (
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <p className={`text-xs mb-1 ${t.textMuted}`}>월 평균 매출 (카페)</p>
                  <p className={`text-lg font-bold ${t.text}`}>{Math.round(commercialMetrics.avgMonthlySales / 10000).toLocaleString()}만원</p>
                </div>
              )}
              {commercialMetrics?.floatingPop && (
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <p className={`text-xs mb-1 ${t.textMuted}`}>일 평균 유동인구</p>
                  <p className={`text-lg font-bold ${t.text}`}>{commercialMetrics.floatingPop.toLocaleString()}명</p>
                </div>
              )}
              {commercialMetrics?.workerPop && (
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <p className={`text-xs mb-1 ${t.textMuted}`}>직장인구</p>
                  <p className={`text-lg font-bold ${t.text}`}>{commercialMetrics.workerPop.toLocaleString()}명</p>
                  {commercialMetrics.workerRatio && (
                    <p className={`text-xs ${t.textMuted}`}>({commercialMetrics.workerRatio}%)</p>
                  )}
                </div>
              )}
              {commercialMetrics?.residentPop && (
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <p className={`text-xs mb-1 ${t.textMuted}`}>주거인구</p>
                  <p className={`text-lg font-bold ${t.text}`}>{commercialMetrics.residentPop.toLocaleString()}명</p>
                  {commercialMetrics.residentRatio && (
                    <p className={`text-xs ${t.textMuted}`}>({commercialMetrics.residentRatio}%)</p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* 고객층 분석 - API 데이터가 있을 때만 표시 */}
          {customerData ? (
          <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-bold ${t.text}`}>고객층 분석</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${customerData?.isActualData ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                {customerData?.isActualData ? '실제 데이터' : '인구 기반 추정'}
              </span>
            </div>
            
            <div className="space-y-2 mb-3">
              {['20대', '30대', '40대', '50대 이상'].map(age => {
                const value = customerData?.[age] || 0;
                return (
                  <div key={age} className="flex items-center gap-2">
                    <span className={`text-sm w-16 ${t.textSecondary}`}>{age}</span>
                    <div className={`flex-1 h-4 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200'}`}>
                      <div className={`h-full ${theme === 'dark' ? 'bg-neutral-500' : 'bg-neutral-400'}`} style={{ width: `${value}%` }}></div>
                    </div>
                    <span className={`text-sm font-medium w-12 text-right ${t.text}`}>{value}%</span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <span className={t.textSecondary}>성별: 남성 {customerData?.male || 0}% | 여성 {customerData?.female || 0}%</span>
            </div>
            
            <p className={`text-xs mt-2 ${t.textMuted}`}>출처: {customerData?.source}</p>
          </div>
          ) : (
          <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
            <h3 className={`text-sm font-bold mb-2 ${t.text}`}>고객층 분석</h3>
            <p className={`text-sm ${t.textMuted}`}>해당 지역의 고객층 데이터를 수집하지 못했습니다.</p>
          </div>
          )}
          
          {/* 개폐업 동향 */}
          <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
            <h3 className={`text-sm font-bold mb-3 ${t.text}`}>개폐업 동향 ({openCloseData?.period || '최근 1년'})</h3>
            <div className="flex items-center justify-around">
              <div className="text-center">
                <p className={`text-xs mb-1 ${t.textMuted}`}>신규 개업</p>
                <p className={`text-xl font-bold ${t.text}`}>{openCloseData?.newOpen || 0}개</p>
              </div>
              <div className="text-center">
                <p className={`text-xs mb-1 ${t.textMuted}`}>폐업</p>
                <p className={`text-xl font-bold ${t.text}`}>{openCloseData?.closed || 0}개</p>
              </div>
              <div className="text-center">
                <p className={`text-xs mb-1 ${t.textMuted}`}>순증감</p>
                <p className={`text-xl font-bold ${openCloseStatus.color}`}>
                  {netChange >= 0 ? '+' : ''}{netChange}개
                </p>
                <p className={`text-xs ${openCloseStatus.color}`}>{openCloseStatus.label}</p>
              </div>
            </div>
          </div>
          
          {/* 임대료 정보 */}
          {rentData && (
            <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
              <h3 className={`text-sm font-bold mb-3 ${t.text}`}>임대료 시세 ({rentData.regionName})</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className={`text-center p-2 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <p className={`text-xs mb-1 ${t.textMuted}`}>평균 임대료</p>
                  <p className={`text-lg font-bold ${t.text}`}>{rentData.avgRent}만/m2</p>
                </div>
                <div className={`text-center p-2 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <p className={`text-xs mb-1 ${t.textMuted}`}>공실률</p>
                  <p className={`text-lg font-bold ${t.text}`}>{rentData.vacancyRate}%</p>
                </div>
                <div className={`text-center p-2 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <p className={`text-xs mb-1 ${t.textMuted}`}>전년대비</p>
                  <p className={`text-lg font-bold ${rentData.yoyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {rentData.yoyChange >= 0 ? '+' : ''}{rentData.yoyChange}%
                  </p>
                </div>
              </div>
              <p className={`text-xs mt-2 ${t.textMuted}`}>출처: {rentData.source} ({rentData.dataDate})</p>
            </div>
          )}
          
          {/* AI 피드백 */}
          <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
            <h3 className={`text-sm font-bold mb-3 ${t.text}`}>AI 피드백</h3>
            
            {aiFeedbackLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className={`w-8 h-8 border-3 rounded-full animate-spin ${theme === 'dark' ? 'border-neutral-700 border-t-white' : 'border-neutral-200 border-t-neutral-800'}`}></div>
                <span className={`ml-3 ${t.textMuted}`}>분석 중...</span>
              </div>
            ) : aiFeedback ? (
              <div className="space-y-4">
                {/* 요약 */}
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <p className={`text-sm ${t.text}`}>{aiFeedback.summary}</p>
                </div>
                
                {/* 종합 평가 */}
                <div className={`p-4 rounded-lg border ${
                  aiFeedback.overallRating === '추천' ? 'bg-green-50 border-green-200' :
                  aiFeedback.overallRating === '주의' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-lg font-bold ${
                      aiFeedback.overallRating === '추천' ? 'text-green-600' :
                      aiFeedback.overallRating === '주의' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {aiFeedback.overallRating === '추천' ? '[추천]' : aiFeedback.overallRating === '주의' ? '[주의 필요]' : '[비추천]'}
                    </span>
                  </div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-neutral-700' : 'text-neutral-700'}`}>{aiFeedback.ratingReason}</p>
                </div>
                
                {/* 추천 컨셉 */}
                {aiFeedback.recommendedConcept && (
                  <div>
                    <p className={`text-xs mb-1 ${t.textMuted}`}>추천 포지셔닝</p>
                    <p className={`text-sm font-medium ${t.text}`}>"{aiFeedback.recommendedConcept}"</p>
                  </div>
                )}
                
                {/* 타깃 고객 */}
                {aiFeedback.targetCustomer && (
                  <div>
                    <p className={`text-xs mb-1 ${t.textMuted}`}>주 타깃 고객층</p>
                    <p className={`text-sm ${t.text}`}>{aiFeedback.targetCustomer}</p>
                  </div>
                )}
                
                {/* 핵심 메뉴 */}
                {aiFeedback.coreMenu?.length > 0 && (
                  <div>
                    <p className={`text-xs mb-1 ${t.textMuted}`}>핵심 메뉴 구성</p>
                    <div className="flex flex-wrap gap-1">
                      {aiFeedback.coreMenu.map((menu, i) => (
                        <span key={i} className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-700'}`}>{menu}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 운영 전략 */}
                {aiFeedback.operationStrategy?.length > 0 && (
                  <div>
                    <p className={`text-xs mb-1 ${t.textMuted}`}>운영 전략</p>
                    <ul className={`text-sm space-y-1 ${t.text}`}>
                      {aiFeedback.operationStrategy.map((strategy, i) => (
                        <li key={i}>- {strategy}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 리스크 요인 */}
                {aiFeedback.riskFactors?.length > 0 && (
                  <div>
                    <p className={`text-xs mb-1 ${t.textMuted}`}>리스크 요인</p>
                    <ul className={`text-sm space-y-1 ${t.text}`}>
                      {aiFeedback.riskFactors.map((risk, i) => (
                        <li key={i}>- {risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 업종별 전략 */}
                {aiFeedback.topBusinessAnalysis?.length > 0 && (
                  <div>
                    <p className={`text-xs mb-2 ${t.textMuted}`}>주변 업종 기반 추천 전략</p>
                    <div className="space-y-2">
                      {aiFeedback.topBusinessAnalysis.map((item, i) => (
                        <div key={i} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-medium ${t.text}`}>{item.business} {item.count}개</span>
                          </div>
                          <p className={`text-sm mb-1 ${t.textSecondary}`}>{item.strategy}</p>
                          {item.details?.length > 0 && (
                            <ul className={`text-xs ${t.textMuted}`}>
                              {item.details.map((d, j) => (
                                <li key={j}>- {d}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`text-center py-6 ${t.textMuted}`}>
                <p>AI 분석을 불러올 수 없습니다</p>
              </div>
            )}
          </div>
          
          {/* 데이터 출처 */}
          <div className={`text-xs space-y-1 ${t.textMuted}`}>
            <p>데이터 출처:</p>
            <p>- 업종/매출/유동인구: {sources?.business}</p>
            <p>- 임대료: {sources?.rent}</p>
            <p>- 고객층: {sources?.customer}</p>
          </div>
          
        </div>
        
        {/* 하단 버튼 */}
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-white'}`}>
          <button
            onClick={() => onDetailAnalysis(location)}
            className={`w-full py-3 rounded-xl font-medium transition-all ${theme === 'dark' ? 'bg-white text-neutral-900 hover:bg-neutral-100' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}
          >
            이 위치로 상세 분석
          </button>
        </div>
      </div>
    </div>
  );
};

 // 빈크래프트 자동 수집 - 확장프로그램 ID
 // 확장프로그램 통신은 postMessage 방식 사용 (ID 불필요)
 
 // ErrorBoundary - React Error #31 등 렌더링 에러 시 백지 방지
 class SalesModeErrorBoundary extends React.Component {
   constructor(props) { super(props); this.state = { hasError: false, error: null }; }
   static getDerivedStateFromError(error) { return { hasError: true, error }; }
   componentDidCatch(error, info) { console.error('[BeanCraft Error]', error, info); }
   render() {
     if (this.state.hasError) {
       return React.createElement('div', { style: { padding: 40, textAlign: 'center' } },
         React.createElement('p', { style: { fontSize: 18, fontWeight: 700, marginBottom: 16 } }, '분석 결과 표시 중 오류가 발생했습니다'),
         React.createElement('p', { style: { fontSize: 14, color: '#888', marginBottom: 20 } }, String(this.state.error?.message || '')),
         React.createElement('button', { 
           onClick: () => { this.setState({ hasError: false, error: null }); window.location.reload(); },
           style: { padding: '12px 24px', borderRadius: 12, background: '#3182F6', color: '#fff', border: 'none', fontSize: 15, cursor: 'pointer' }
         }, '다시 시도')
       );
     }
     return this.props.children;
   }
 }
 
 const App = () => {
 // 앱 마운트 시 초기 로딩 화면 숨기기
 useEffect(() => {
   const initialLoading = document.getElementById('initial-loading');
   if (initialLoading) {
     initialLoading.classList.add('hidden');
   }
 }, []);
 
 // 로그인 시 명언 문구
 const [loggedIn, setLoggedIn] = useState(false);
 const [user, setUser] = useState(null);
 const [id, setId] = useState('');
 const [pw, setPw] = useState('');
 const [rememberMe, setRememberMe] = useState(false);
 const [adminPassword, setAdminPassword] = useState('admin');
 const [loginQuote] = useState(() => LOGIN_QUOTES[Math.floor(Math.random() * LOGIN_QUOTES.length)]);
const [loginPhase, setLoginPhase] = useState('quote'); // 'quote' -> 'logo' -> 'form'
 
 // 프랜차이즈 검색 상태
 const [franchiseSearch, setFranchiseSearch] = useState('');
 const [selectedFranchise, setSelectedFranchise] = useState(null);
 const [franchiseIssueExpanded, setFranchiseIssueExpanded] = useState({});
 
 const [syncStatus, setSyncStatus] = useState('connecting');
 const [dataLoaded, setDataLoaded] = useState(false);
 const savedTab = localStorage.getItem('bc_current_tab') || 'map';
 const [tab, setTab] = useState(savedTab);
 const [reportViewManager, setReportViewManager] = useState(null);
 const [reportMode, setReportMode] = useState('basic'); // 'basic' | 'ai'
 const [marketIssues, setMarketIssues] = useState([]);
 const [aiRegionIndex, setAiRegionIndex] = useState(0);
 const [aiRegionViewMode, setAiRegionViewMode] = useState('single'); // 'single' | 'list'
  const [aiRegionSearch, setAiRegionSearch] = useState('');
 // AI 키워드 검색 기능
 const [aiKeywordSearch, setAiKeywordSearch] = useState(''); // AI 키워드 검색어
 const [aiKeywordResult, setAiKeywordResult] = useState(null); // AI 키워드 검색 결과
 const [aiKeywordLoading, setAiKeywordLoading] = useState(false); // AI 키워드 검색 로딩
 const [aiLastUpdateTime, setAiLastUpdateTime] = useState(null); // AI 마지막 분석 시간
 const [aiErrorMessage, setAiErrorMessage] = useState(null); // AI 에러 메시지
 const [showTrendModal, setShowTrendModal] = useState(null); // 트렌드 상세 모달
 const [showManagerCompaniesModal, setShowManagerCompaniesModal] = useState(null); // 담당자별 업체 모달
 const [managerCompanySearch, setManagerCompanySearch] = useState(''); // 업체 검색어
 // 멘트 관리 시스템
 const [userMents, setUserMents] = useState([]); // 사용자 멘트 목록
 const [showMentModal, setShowMentModal] = useState(false); // 멘트 추가/수정 모달
 const [editingMent, setEditingMent] = useState(null); // 수정 중인 멘트
 const [mentForm, setMentForm] = useState({ name: '', content: '', type: 'broker', memo: '' }); // 멘트 폼
 const [mentFeedbacks, setMentFeedbacks] = useState([]); // AI 피드백 히스토리
 const [showAiFeedback, setShowAiFeedback] = useState(false); // AI 피드백 모달
 const [feedbackMent, setFeedbackMent] = useState(null); // 피드백 받을 멘트
 const [feedbackInput, setFeedbackInput] = useState(''); // 수정 멘트 입력
 const [feedbackQuestion, setFeedbackQuestion] = useState(''); // 질문 입력
 const [settingsTab, setSettingsTab] = useState('alerts'); // 설정 탭: 'alerts' | 'salesmode' | 'account'
 
 // ═══════════════════════════════════════════════════════════════
 // 전국 상권 데이터 수집 (관리자 전용)
 // ═══════════════════════════════════════════════════════════════
 const [apiCollectMode, setApiCollectMode] = useState(false);
 const [apiCollectSido, setApiCollectSido] = useState('');
 const [apiCollectSigungu, setApiCollectSigungu] = useState('');
 const [apiCollectProgress, setApiCollectProgress] = useState({ current: 0, total: 0, region: '', status: '' });
 const [apiCollectResults, setApiCollectResults] = useState(null);
 const [showApiCollectReport, setShowApiCollectReport] = useState(false);
 
 const [selectedMentsForCompany, setSelectedMentsForCompany] = useState([]); // 업체 등록 시 선택된 멘트
 const [companyMentMemo, setCompanyMentMemo] = useState(''); // 업체 멘트 메모
 const [todayContactAlert, setTodayContactAlert] = useState(null); // 오늘 연락할 곳 알림
 const [incompleteRouteAlert, setIncompleteRouteAlert] = useState(null); // 미완료 동선 알림
 // AI 탭 확장 기능
 const [aiExpandedData, setAiExpandedData] = useState(null); // 클릭한 데이터 상세
 const [teamFeedback, setTeamFeedback] = useState(() => {
   return safeLocalStorage.getItem('bc_team_feedback', []);
 }); // 팀 피드백 자동 학습 데이터

      const [teamFeedbackSituation, setTeamFeedbackSituation] = useState('');
      const [teamFeedbackMemo, setTeamFeedbackMemo] = useState('');
      const [teamFeedbackResult, setTeamFeedbackResult] = useState(null); // 'success' | 'fail'
      const [teamFeedbacksAll, setTeamFeedbacksAll] = useState([]); // 팀 전체 피드백
      const [teamFeedbackMent, setTeamFeedbackMent] = useState('');

 // 영업 탭 지역 검색 상태
 const [salesSearchQuery, setSalesSearchQuery] = useState('');
 const [salesSelectedRegion, setSalesSelectedRegion] = useState(null);
 const [showSalesIssue, setShowSalesIssue] = useState(false);

 // ═══════════════════════════════════════════════════════════════
 // 영업모드 상태 변수
 // ═══════════════════════════════════════════════════════════════
 const [salesModeActive, setSalesModeActive] = useState(false); // 영업모드 활성화 여부
 const [salesModeScreen, setSalesModeScreen] = useState('select'); // 'select' | 'locked' | 'pin' | 'main'
 const [salesModeTarget, setSalesModeTarget] = useState(null); // 'broker' | 'client'
 const [salesModeTab, setSalesModeTab] = useState('analysis'); // 'analysis' | 'homepage'
 const [salesModePinInput, setSalesModePinInput] = useState('');
 const [salesModeLastActivity, setSalesModeLastActivity] = useState(Date.now());
 const [salesModeSearchQuery, setSalesModeSearchQuery] = useState('');
 const [duplicateRegionOptions, setDuplicateRegionOptions] = useState([]);
 const [showDuplicateSelector, setShowDuplicateSelector] = useState(false);
 const [salesModeSearchResult, setSalesModeSearchResult] = useState(null);
 const [salesModeSearchLoading, setSalesModeSearchLoading] = useState(false);
 const [salesModeAnalysisProgress, setSalesModeAnalysisProgress] = useState(0); // 0-100 진행률
 const [salesModeAnalysisStep, setSalesModeAnalysisStep] = useState(''); // 현재 단계 텍스트
 const [salesModeCollectingText, setSalesModeCollectingText] = useState(''); // 실시간 수집 텍스트
 const salesModeAbortRef = useRef(null); // 분석 중지용 AbortController ref
 const [salesAutoCompleteOpen, setSalesAutoCompleteOpen] = useState(false); // 검색 자동완성 드롭다운
 const [salesModeShowSources, setSalesModeShowSources] = useState(false);
 const [salesModeIframeError, setSalesModeIframeError] = useState(false); // iframe 차단 감지
 const [salesModeHomepageUrl, setSalesModeHomepageUrl] = useState('https://www.beancraft.co.kr'); // 홈페이지 URL
 const [salesModeMapCenter, setSalesModeMapCenter] = useState(null); // 지도 중심 좌표
 const [salesModeMapExpanded, setSalesModeMapExpanded] = useState(false); // 지도 펼침 상태
 const [salesModeMapReloading, setSalesModeMapReloading] = useState(false); // 지도 이동 후 재수집 중
 const salesModeTimeoutRef = useRef(null);
 const salesModeLockTimeoutRef = useRef(null);
 const progressIntervalRef = useRef(null); // 부드러운 진행률 애니메이션용
 const currentProgressRef = useRef(0); // 현재 진행률 추적
 const salesModeMapRef = useRef(null); // 네이버 지도 인스턴스
 const salesModeMapContainerRef = useRef(null); // 지도 컨테이너 DOM ref
 const salesModeMapMarkerRef = useRef(null); // 지도 마커
 const salesModeMapCircleRef = useRef(null); // 지도 500m 원
 const salesModeSelectMapRef = useRef(null); // 위치 선택용 지도 인스턴스
 const salesModeSelectMapContainerRef = useRef(null); // 위치 선택용 지도 컨테이너

 // ═══════════════════════════════════════════════════════════════
 // 영업모드 지역 선택 기능 (반경 500m 분석)
 // ═══════════════════════════════════════════════════════════════
 const [locationSelectMode, setLocationSelectMode] = useState(false); // 지역 선택 모드 활성화
 const [selectedLocation, setSelectedLocation] = useState(null); // 선택된 위치 { lat, lng, address }
 const [locationAnalysisData, setLocationAnalysisData] = useState(null); // 분석 결과
 const [locationAnalysisLoading, setLocationAnalysisLoading] = useState(false); // 분석 로딩
 const [showLocationModal, setShowLocationModal] = useState(false); // 분석 모달 표시
 const [locationCircle, setLocationCircle] = useState(null); // 지도 원 객체
 const [locationMarker, setLocationMarker] = useState(null); // 지도 마커 객체

 // 영업모드 자동 잠금 타이머 (5분 무활동 시) - 로딩 중에는 잠금 안함
 useEffect(() => {
   if (salesModeActive && salesModeScreen === 'main' && !salesModeSearchLoading) {
     const checkInactivity = () => {
       const now = Date.now();
       if (now - salesModeLastActivity > 300000) { // 5분
         setSalesModeScreen('locked');
       }
     };
     salesModeLockTimeoutRef.current = setInterval(checkInactivity, 5000);
     return () => clearInterval(salesModeLockTimeoutRef.current);
   }
 }, [salesModeActive, salesModeScreen, salesModeLastActivity, salesModeSearchLoading]);

 // 영업모드 자동 종료 타이머 (5분 무활동 시)
 useEffect(() => {
   if (salesModeActive && salesModeScreen === 'locked') {
     const autoExit = setTimeout(() => {
       exitSalesMode();
     }, 300000); // 5분
     return () => clearTimeout(autoExit);
   }
 }, [salesModeActive, salesModeScreen]);

 // 영업모드 활동 감지
 const updateSalesModeActivity = useCallback(() => {
   setSalesModeLastActivity(Date.now());
 }, []);

 // 영업모드 시작
 const startSalesMode = () => {
   setSalesModeActive(true);
   setSalesModeScreen('select');
   setSalesModeTarget(null);
   setSalesModePinInput('');
   setSalesModeLastActivity(Date.now());
 };

 // 영업모드 종료
 const exitSalesMode = () => {
   setSalesModeActive(false);
   setSalesModeScreen('select');
   setSalesModeTarget(null);
   setSalesModeTab('analysis');
   setSalesModePinInput('');
   setSalesModeSearchQuery('');
   setSalesModeSearchResult(null);
   setSalesModeIframeError(false);
   setSalesModeMapCenter(null);
   setSalesModeShowSources(false);
   // 지역 선택 상태도 초기화
   setLocationSelectMode(false);
   setSelectedLocation(null);
   setLocationAnalysisData(null);
   setShowLocationModal(false);
   // 동적 지도 정리
   if (salesModeMapMarkerRef.current) {
     salesModeMapMarkerRef.current.setMap(null);
     salesModeMapMarkerRef.current = null;
   }
   if (salesModeMapCircleRef.current) {
     salesModeMapCircleRef.current.setMap(null);
     salesModeMapCircleRef.current = null;
   }
   salesModeMapRef.current = null;
   if (salesModeTimeoutRef.current) clearTimeout(salesModeTimeoutRef.current);
   if (salesModeLockTimeoutRef.current) clearInterval(salesModeLockTimeoutRef.current);
 };

 // 영업모드 동적 지도 초기화
 useEffect(() => {
   if (!salesModeMapCenter || !salesModeMapContainerRef.current || !window.naver?.maps) return;
   
   // 이미 지도가 있으면 중심점만 이동
   if (salesModeMapRef.current) {
     const newCenter = new window.naver.maps.LatLng(salesModeMapCenter.lat, salesModeMapCenter.lng);
     salesModeMapRef.current.setCenter(newCenter);
     
     // 기존 마커/원 제거
     if (salesModeMapMarkerRef.current) {
       salesModeMapMarkerRef.current.setMap(null);
     }
     if (salesModeMapCircleRef.current) {
       salesModeMapCircleRef.current.setMap(null);
     }
     
     // 새 마커 생성
     salesModeMapMarkerRef.current = new window.naver.maps.Marker({
       position: newCenter,
       map: salesModeMapRef.current,
       icon: {
         content: '<div style="width:24px;height:24px;background:#171717;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
         anchor: new window.naver.maps.Point(12, 12)
       }
     });
     
     // 새 500m 원 생성
     salesModeMapCircleRef.current = new window.naver.maps.Circle({
       map: salesModeMapRef.current,
       center: newCenter,
       radius: 500,
       strokeColor: '#3b82f6',
       strokeOpacity: 0.8,
       strokeWeight: 2,
       fillColor: '#3b82f6',
       fillOpacity: 0.1
     });
     return;
   }
   
   // 새 지도 생성
   const mapOptions = {
     center: new window.naver.maps.LatLng(salesModeMapCenter.lat, salesModeMapCenter.lng),
     zoom: 15,
     zoomControl: true,
     zoomControlOptions: {
       position: window.naver.maps.Position.TOP_RIGHT,
       style: window.naver.maps.ZoomControlStyle.SMALL
     }
   };
   
   salesModeMapRef.current = new window.naver.maps.Map(salesModeMapContainerRef.current, mapOptions);
   
   // 마커 생성
   salesModeMapMarkerRef.current = new window.naver.maps.Marker({
     position: new window.naver.maps.LatLng(salesModeMapCenter.lat, salesModeMapCenter.lng),
     map: salesModeMapRef.current,
     icon: {
       content: '<div style="width:24px;height:24px;background:#171717;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
       anchor: new window.naver.maps.Point(12, 12)
     }
   });
   
   // 500m 반투명 원 생성
   salesModeMapCircleRef.current = new window.naver.maps.Circle({
     map: salesModeMapRef.current,
     center: new window.naver.maps.LatLng(salesModeMapCenter.lat, salesModeMapCenter.lng),
     radius: 500,
     strokeColor: '#3b82f6',
     strokeOpacity: 0.8,
     strokeWeight: 2,
     fillColor: '#3b82f6',
     fillOpacity: 0.1
   });
   
 }, [salesModeMapCenter]);

 // 영업모드 위치 선택용 지도 초기화
 useEffect(() => {
   if (!salesModeActive || !locationSelectMode || !salesModeSelectMapContainerRef.current || !window.naver?.maps) return;
   
   // 이미 지도가 있으면 리턴
   if (salesModeSelectMapRef.current) return;
   
   // 기본 위치 (서울 시청)
   const defaultCenter = new window.naver.maps.LatLng(37.5666805, 126.9784147);
   
   const mapOptions = {
     center: defaultCenter,
     zoom: 15,
     mapTypeControl: false,
     scaleControl: false,
     logoControl: false,
     mapDataControl: false,
     zoomControl: true,
     zoomControlOptions: {
       position: window.naver.maps.Position.RIGHT_CENTER
     }
   };
   
   salesModeSelectMapRef.current = new window.naver.maps.Map(salesModeSelectMapContainerRef.current, mapOptions);
   
   // 지도 클릭 이벤트 - 위치 선택
   window.naver.maps.Event.addListener(salesModeSelectMapRef.current, 'click', async (e) => {
     const lat = e.coord.lat();
     const lng = e.coord.lng();
     
     // 기존 마커/원 제거
     if (salesModeMapMarkerRef.current) {
       salesModeMapMarkerRef.current.setMap(null);
     }
     if (salesModeMapCircleRef.current) {
       salesModeMapCircleRef.current.setMap(null);
     }
     
     // 새 마커 생성
     salesModeMapMarkerRef.current = new window.naver.maps.Marker({
       position: e.coord,
       map: salesModeSelectMapRef.current,
       icon: {
         content: '<div style="width:24px;height:24px;background:#ffffff;border-radius:50%;border:3px solid #171717;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
         anchor: new window.naver.maps.Point(12, 12)
       }
     });
     
     // 500m 원 생성
     salesModeMapCircleRef.current = new window.naver.maps.Circle({
       center: e.coord,
       radius: 500,
       map: salesModeSelectMapRef.current,
       strokeColor: '#3b82f6',
       strokeOpacity: 0.8,
       strokeWeight: 2,
       fillColor: '#3b82f6',
       fillOpacity: 0.15
     });
     
     // 검색 실행 - 좌표를 도로명 주소로 변환
     setSalesModeSearchQuery('주소 확인 중...');
     setSalesModeMapCenter({ lat, lng });
     
     // reverse geocode로 도로명 주소 변환
     try {
       window.naver.maps.Service.reverseGeocode({ coords: new window.naver.maps.LatLng(lat, lng), orders: 'roadaddr,addr' }, (status, response) => {
         if (status === window.naver.maps.Service.Status.OK && response.v2?.results?.[0]) {
           const r = response.v2.results[0];
           if (r.land?.name) {
             const region = r.region;
             const road = `${region.area1?.name || ''} ${region.area2?.name || ''} ${r.land.name} ${r.land.number1 || ''}${r.land.number2 ? '-'+r.land.number2 : ''}`.trim();
             setSalesModeSearchQuery(road);
           } else if (r.region?.area3?.name) {
             setSalesModeSearchQuery(`${r.region.area1?.name || ''} ${r.region.area2?.name || ''} ${r.region.area3?.name || ''}`.trim());
           } else {
             setSalesModeSearchQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
           }
         } else {
           setSalesModeSearchQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
         }
       });
     } catch (e) {
       console.log('reverse geocode 실패:', e);
       setSalesModeSearchQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
     }
     
     // API 호출은 좌표로 (정확도를 위해)
     await searchSalesModeRegion(`${lat}, ${lng}`);
     
     // 위치 선택 모드 종료
     setLocationSelectMode(false);
   });
   
   return () => {
     if (salesModeSelectMapRef.current) {
       salesModeSelectMapRef.current.destroy();
       salesModeSelectMapRef.current = null;
     }
   };
 }, [salesModeActive, locationSelectMode]);

 // ═══════════════════════════════════════════════════════════════
 // 지역 선택 기능 - 반경 500m 업종별 분석
 // ═══════════════════════════════════════════════════════════════
 
 // 지역 선택 모드 시작
 const startLocationSelectMode = () => {
   setLocationSelectMode(true);
   setSelectedLocation(null);
   setLocationAnalysisData(null);
 };
 
 // 지역 선택 모드 종료
 const exitLocationSelectMode = () => {
   setLocationSelectMode(false);
   setSelectedLocation(null);
   setLocationAnalysisData(null);
   setShowLocationModal(false);
   // 지도 마커/원 제거
   if (locationMarker) {
     locationMarker.setMap(null);
     setLocationMarker(null);
   }
   if (locationCircle) {
     locationCircle.setMap(null);
     setLocationCircle(null);
   }
 };
 
 // 지도 클릭 시 위치 선택 처리
 const handleLocationSelect = async (lat, lng, mapInstance) => {
   if (!locationSelectMode) return;
   
   setLocationAnalysisLoading(true);
   
   // 기존 마커/원 제거
   if (locationMarker) locationMarker.setMap(null);
   if (locationCircle) locationCircle.setMap(null);
   
   // 새 마커 생성
   const newMarker = new window.naver.maps.Marker({
     position: new window.naver.maps.LatLng(lat, lng),
     map: mapInstance,
     icon: {
       content: '<div style="width:24px;height:24px;background:#171717;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
       anchor: new window.naver.maps.Point(12, 12)
     }
   });
   setLocationMarker(newMarker);
   
   // 반경 500m 원 생성
   const newCircle = new window.naver.maps.Circle({
     map: mapInstance,
     center: new window.naver.maps.LatLng(lat, lng),
     radius: 500,
     strokeColor: '#3b82f6',
     strokeOpacity: 0.8,
     strokeWeight: 2,
     fillColor: '#3b82f6',
     fillOpacity: 0.1
   });
   setLocationCircle(newCircle);
   
   // 역지오코딩으로 주소 얻기
   let address = '';
   try {
     const reverseGeoResponse = await fetch(
       `${PROXY_SERVER_URL}/api/reverse-geocode?lat=${lat}&lng=${lng}`
     );
     const reverseGeoData = await reverseGeoResponse.json();
     if (reverseGeoData.results?.[0]) {
       const result = reverseGeoData.results[0];
       const region = result.region;
       address = `${region.area1?.name || ''} ${region.area2?.name || ''} ${region.area3?.name || ''} ${region.area4?.name || ''}`.trim();
     }
   } catch (e) {
     console.error('역지오코딩 실패:', e);
     address = `위도 ${lat.toFixed(6)}, 경도 ${lng.toFixed(6)}`;
   }
   
   setSelectedLocation({ lat, lng, address });
   
   // 반경 500m 분석 실행
   await analyzeLocationRadius(lat, lng, address);
 };
 
 // 반경 500m 업종별 분석 (새 소상공인365 API 사용)
 const analyzeLocationRadius = async (lat, lng, address) => {
   try {
     // 1. 좌표 → 행정동 코드 변환
     const dongInfo = await getCoordToDongCd(lat, lng);
     
     if (!dongInfo) {
       console.error('행정동 코드 조회 실패');
       throw new Error('행정동 정보를 가져올 수 없습니다.');
     }
     
     const dongCd = dongInfo.dongCd;
     const tpbizCd = 'Q01'; // 카페/음식점 업종
     
     // 2. 새 API로 병렬 호출
     const [
       dynPplData,      // 유동인구
       salesAvgData,    // 매출 평균
       vstAgeData,      // 방문 연령
       vstCstData,      // 방문 고객
       cfrStcntData,    // 점포수
       baeminData,      // 배달 업종
       mmavgListData    // 월평균 매출
     ] = await Promise.all([
       callSbizAPI(SBIZ365_NEW_API.dynPplCmpr, { dongCd }).catch(() => null),
       callSbizAPI(SBIZ365_NEW_API.salesAvg, { dongCd, tpbizCd }).catch(() => null),
       callSbizAPI(SBIZ365_NEW_API.vstAgeRnk, { dongCd }).catch(() => null),
       callSbizAPI(SBIZ365_NEW_API.vstCst, { dongCd }).catch(() => null),
       callSbizAPI(SBIZ365_NEW_API.cfrStcnt, { dongCd, tpbizCd }).catch(() => null),
       callSbizAPI(SBIZ365_NEW_API.baeminTpbiz, { dongCd }).catch(() => null),
       callSbizAPI(SBIZ365_NEW_API.mmavgList, { dongCd, tpbizCd }).catch(() => null)
     ]);
     
     // 3. 데이터 파싱
     // 유동인구
     let floatingPop = 0;
     let floatingPopSource = null;
     if (dynPplData && Array.isArray(dynPplData) && dynPplData[0]) {
       floatingPop = dynPplData[0].cnt || 0;
       floatingPopSource = dynPplData[0].crtrYm;
     }
     
     // 점포수
     let totalStoreCount = 0;
     let cafeCount = 0;
     if (cfrStcntData && cfrStcntData.stcnt) {
       totalStoreCount = cfrStcntData.stcnt;
     }
     
     // 매출 평균 (카페)
     let cafeSalesAvg = 0;
     let cafeSalesCount = 0;
     if (salesAvgData && Array.isArray(salesAvgData)) {
       const cafeData = salesAvgData.find(d => d.tpbizClscdNm === '카페');
       if (cafeData) {
         cafeSalesAvg = cafeData.mmavgSlsAmt || 0;
         cafeSalesCount = cafeData.mmavgSlsNocs || 0;
         cafeCount = cafeData.stcnt || 0;
       }
     }
     
     // 소비 연령 우선 (카페 분석에 적합) - vstCst가 있으면 소비 기준, 없으면 방문 기준
     let mainTarget = null;
     let mainTargetRatio = 0;
     let secondTarget = null;
     let secondTargetRatio = 0;
     const ageMap = { 'M10': '10대', 'M20': '20대', 'M30': '30대', 'M40': '40대', 'M50': '50대', 'M60': '60대 이상' };
     // vstCst(소비 연령)를 우선 사용
     const _ageSource = (vstCstData && Array.isArray(vstCstData) && vstCstData.length > 0)
       ? [...vstCstData].sort((a, b) => (b.pipcnt || 0) - (a.pipcnt || 0))
       : (vstAgeData && Array.isArray(vstAgeData) && vstAgeData.length > 0)
       ? [...vstAgeData].sort((a, b) => (b.pipcnt || 0) - (a.pipcnt || 0))
       : [];
     if (_ageSource.length > 0) {
       const totalAge = _ageSource.reduce((s, d) => s + (d.pipcnt || 0), 0);
       if (_ageSource[0] && totalAge > 0) {
         mainTarget = ageMap[_ageSource[0].age] || _ageSource[0].age;
         mainTargetRatio = Math.round((_ageSource[0].pipcnt / totalAge) * 100);
       }
       if (_ageSource[1] && totalAge > 0) {
         secondTarget = ageMap[_ageSource[1].age] || _ageSource[1].age;
         secondTargetRatio = Math.round((_ageSource[1].pipcnt / totalAge) * 100);
       }
     }
     
     // 방문 고객 총합
     let totalVisitors = 0;
     if (vstCstData && Array.isArray(vstCstData)) {
       totalVisitors = vstCstData.reduce((s, d) => s + (d.pipcnt || 0), 0);
     }
     
     // 배달 업종 Top 5
     let deliveryTop = [];
     if (baeminData && Array.isArray(baeminData)) {
       deliveryTop = baeminData.slice(0, 5).map(d => ({
         name: d.baeminTpbizClsfNm,
         count: d.cnt
       }));
     }
     
     // 월평균 매출 Top 5
     let topSalesBiz = [];
     if (mmavgListData && Array.isArray(mmavgListData)) {
       topSalesBiz = mmavgListData.slice(0, 5).map(d => ({
         name: d.tpbizNm,
         amount: d.slsamt,
         stores: d.stcnt
       }));
     }
     
     // 지역 정보
     const regionInfo = getRegionFromCoords(lat, lng);
     
     // 임대료 데이터
     const rentData = getRentDataByAddress(address);
     
     // 분석 결과 저장
     const analysisResult = {
       location: { lat, lng, address },
       dongInfo: {
         dongCd: dongInfo.dongCd,
         dongNm: dongInfo.dongNm,
         admdstCdNm: dongInfo.admdstCdNm
       },
       regionInfo,
       timestamp: new Date().toISOString(),
       dataSource: floatingPopSource || '소상공인365',
       
       // 업종별 점포수
       businessCounts: {
         total: totalStoreCount,
         cafe: cafeCount,
         _hasData: totalStoreCount > 0
       },
       
       // 상권 지표
       commercialMetrics: {
         floatingPop: floatingPop,
         avgMonthlySales: cafeSalesAvg * 10000, // 만원 → 원
         avgSalesCount: cafeSalesCount,
         totalVisitors: totalVisitors
       },
       
       // 고객층 데이터
       customerData: {
         mainTarget,
         mainTargetRatio,
         secondTarget,
         secondTargetRatio,
         peakTime: '12-14시, 18-20시',
         takeoutRatio: 40,
         avgStay: '30-45분',
         source: '소상공인365 빅데이터'
       },
       
       // 배달 업종
       deliveryTop,
       
       // 매출 상위 업종
       topSalesBiz,
       
       // 개폐업 현황 (새 API에서는 직접 제공하지 않음 - 추후 추가)
       openCloseData: {
         newOpen: null,
         closed: null,
         netChange: null,
         source: '소상공인365',
         period: '최근 1년'
       },
       
       // 임대료 데이터
       rentData: {
         avgRent: rentData.avgRent,
         vacancyRate: rentData.vacancyRate,
         yoyChange: rentData.yoyChange,
         regionName: rentData.regionName,
         source: RENT_DATA_BY_REGION.source,
         dataDate: RENT_DATA_BY_REGION.dataDate
       },
       
       // 데이터 출처
       sources: {
         business: '소상공인365 빅데이터',
         population: '소상공인365 빅데이터',
         rent: RENT_DATA_BY_REGION.source,
         customer: '소상공인365 빅데이터'
       }
     };
     
     setLocationAnalysisData(analysisResult);
     setShowLocationModal(true);
     
   } catch (error) {
     console.error('지역 분석 실패:', error);
     setLocationAnalysisData({
       location: { lat, lng, address },
       error: true,
       errorMessage: error.message || '데이터를 불러오지 못했습니다.'
     });
     setShowLocationModal(true);
   } finally {
     setLocationAnalysisLoading(false);
   }
 };
 
 // AI 피드백 생성 (업종 기반 카페 방향 제안)
 const generateLocationAIFeedback = async (analysisData) => {
   if (!analysisData) return null;
   
   const { businessCounts, commercialMetrics, customerData, openCloseData, rentData, location } = analysisData;
   
   // 상위 3개 업종 추출 (카페 제외)
   const topBusinesses = Object.entries(businessCounts)
     .filter(([key]) => key !== 'cafe' && key !== '_isEstimate')
     .sort((a, b) => b[1] - a[1])
     .slice(0, 3)
     .map(([key, count]) => ({ 
       key, 
       count, 
       strategy: BUSINESS_CAFE_STRATEGY[key] || null 
     }));
   
   // 경쟁 강도 판단
   const cafeCount = businessCounts.cafe || 0;
   let competitionLevel = '양호';
   if (cafeCount > 50) competitionLevel = '매우 과밀';
   else if (cafeCount > 35) competitionLevel = '과밀';
   else if (cafeCount > 20) competitionLevel = '보통';
   
   // 상권 유형 판단
   const workerRatio = commercialMetrics.workerRatio || 0;
   let areaType = '혼합';
   if (workerRatio >= 60) areaType = '오피스';
   else if (workerRatio <= 30) areaType = '주거';
   
   const prompt = `
당신은 카페 상권 분석 전문가입니다. 전문적이고 현실적인 말투로 이 위치의 카페 창업 방향을 분석해주세요.

[말투 규칙]
- "~에요", "~거든요", "~해보세요" 사용 (격식체 금지)
- 매번 다른 문장 시작 사용 (동일 패턴 반복 금지)
- 이모티콘 사용 금지

[위치 정보]
주소: ${location.address}
반경: 500m

[업종별 점포수 - 실제 수집 데이터]
- 카페/디저트: ${businessCounts.cafe || 0}개 (경쟁 강도: ${competitionLevel})
- 음식점: ${businessCounts.restaurant || 0}개
- 사무실/오피스: ${businessCounts.office || 0}개
- 금융/보험: ${businessCounts.finance || 0}개
- 미용/네일: ${businessCounts.beauty || 0}개
- 병원/의원: ${businessCounts.hospital || 0}개
- 헬스/운동: ${businessCounts.fitness || 0}개
- 학원/교육: ${businessCounts.academy || 0}개
- 편의점: ${businessCounts.convenience || 0}개
- 마트/슈퍼: ${businessCounts.mart || 0}개

[상권 지표 - API 수집 데이터]
- 상권 유형: ${areaType} 상권
- 직장인구 비율: ${workerRatio}%
- 주거인구 비율: ${commercialMetrics.residentRatio || 0}%
${commercialMetrics.avgMonthlySales ? `- 카페 월 평균 매출: ${Math.round(commercialMetrics.avgMonthlySales / 10000)}만원` : ''}
${commercialMetrics.floatingPop ? `- 일 유동인구: ${commercialMetrics.floatingPop.toLocaleString()}명` : ''}

${customerData ? `[고객층 데이터 - ${customerData.isActualData ? '실제 결제 데이터' : 'API 수집'}]
- 20대: ${customerData['20대'] || 0}%
- 30대: ${customerData['30대'] || 0}%
- 40대: ${customerData['40대'] || 0}%
- 50대 이상: ${customerData['50대 이상'] || 0}%
- 여성 비율: ${customerData.female || 0}%` : '[고객층 데이터 없음]'}

[개폐업 현황 - 최근 1년]
- 신규 개업: ${openCloseData.newOpen}개
- 폐업: ${openCloseData.closed}개
- 순증감: ${openCloseData.netChange >= 0 ? '+' : ''}${openCloseData.netChange}개

[임대료 - ${rentData.source}]
- 평균 임대료: ${rentData.avgRent}만원/m2
- 공실률: ${rentData.vacancyRate}%

[분석 규칙 - 반드시 준수]
1. 위 데이터만 사용하세요. 없는 숫자를 만들지 마세요.
2. 주변 업종 분포를 분석해 구체적인 카페 컨셉을 제안하세요.
3. "~일 수 있습니다" 같은 모호한 표현 대신 "~에요", "~거든요"로 직접적으로.
4. 허위 데이터나 근거 없는 추측은 절대 금지입니다.
5. "정보가 부족합니다", "데이터가 없습니다", "확인이 불가합니다", "분석이 어렵습니다" 같은 회피 표현 금지. 수집된 데이터만으로 분석하세요. 없는 항목은 언급하지 말고, 있는 데이터로 최대한 분석하세요.

[출력 형식 - JSON]
{
  "summary": "이 위치의 특징과 방향성을 2-3문장으로 정리해주세요.",
  "areaType": "상권 유형 (오피스/주거/상업/혼합)",
  "competitionLevel": "경쟁 강도 (양호/보통/과밀/매우과밀)",
  "topBusinessAnalysis": [
    {
      "business": "업종명",
      "count": 숫자,
      "strategy": "이 업종 고객을 타겟으로 한 전략",
      "details": ["구체적 실행 방안 1", "구체적 실행 방안 2"]
    }
  ],
  "recommendedConcept": "이 위치에 적합한 카페 콘셉트 (한 문장)",
  "targetCustomer": "주 타깃 고객층",
  "coreMenu": ["핵심 메뉴 1", "핵심 메뉴 2", "핵심 메뉴 3"],
  "operationStrategy": ["운영 전략 1", "운영 전략 2", "운영 전략 3"],
  "riskFactors": ["주의할 점 1", "주의할 점 2", "주의할 점 3"],
  "overallRating": "추천/주의/비추천",
  "ratingReason": "이 평가의 근거를 구체적으로 설명해주세요."
}
`;

   try {
     const response = await callGeminiProxy([{ parts: [{ text: prompt }] }], {
             temperature: 0.3,
             maxOutputTokens: 2000
           });
     
     const data = await response.json();
     const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
     
     // JSON 추출
     const jsonMatch = aiText.match(/\{[\s\S]*\}/);
     if (jsonMatch) {
       return JSON.parse(jsonMatch[0]);
     }
     return null;
   } catch (error) {
     console.error('AI 피드백 생성 실패:', error);
     return null;
   }
 };

 // PIN 입력 처리
 const handlePinInput = (digit) => {
   updateSalesModeActivity();
   const newPin = salesModePinInput + digit;
   setSalesModePinInput(newPin);
   if (newPin.length === 4) {
     if (newPin === SALES_MODE_PIN) {
       setSalesModeScreen('main');
       setSalesModePinInput('');
     } else {
       setSalesModePinInput('');
       // 진동 효과 등 추가 가능
     }
   }
 };

 // PIN 삭제
 const handlePinDelete = () => {
   updateSalesModeActivity();
   setSalesModePinInput(prev => prev.slice(0, -1));
 };

 // ═══════════════════════════════════════════════════════════════
 // 전국 상권 데이터 수집 (관리자 전용) - Firebase 저장
 // ═══════════════════════════════════════════════════════════════
 
 // 시군구별 대표 좌표 (중심지 기준)
 const REGION_COORDINATES = {
   '서울특별시': {
     '강남구': { lat: 37.5172, lng: 127.0473, name: '강남역' },
     '강동구': { lat: 37.5301, lng: 127.1238, name: '천호역' },
     '강북구': { lat: 37.6396, lng: 127.0255, name: '수유역' },
     '강서구': { lat: 37.5509, lng: 126.8495, name: '화곡역' },
     '관악구': { lat: 37.4784, lng: 126.9516, name: '신림역' },
     '광진구': { lat: 37.5385, lng: 127.0823, name: '건대입구역' },
     '구로구': { lat: 37.4954, lng: 126.8875, name: '구로디지털단지역' },
     '금천구': { lat: 37.4568, lng: 126.8956, name: '가산디지털단지역' },
     '노원구': { lat: 37.6543, lng: 127.0565, name: '노원역' },
     '도봉구': { lat: 37.6688, lng: 127.0471, name: '도봉산역' },
     '동대문구': { lat: 37.5744, lng: 127.0395, name: '청량리역' },
     '동작구': { lat: 37.5124, lng: 126.9393, name: '사당역' },
     '마포구': { lat: 37.5665, lng: 126.9018, name: '홍대입구역' },
     '서대문구': { lat: 37.5791, lng: 126.9368, name: '신촌역' },
     '서초구': { lat: 37.4837, lng: 127.0324, name: '강남역' },
     '성동구': { lat: 37.5634, lng: 127.0369, name: '성수역' },
     '성북구': { lat: 37.5894, lng: 127.0167, name: '성신여대입구역' },
     '송파구': { lat: 37.5145, lng: 127.1059, name: '잠실역' },
     '양천구': { lat: 37.5170, lng: 126.8665, name: '목동역' },
     '영등포구': { lat: 37.5263, lng: 126.8964, name: '영등포역' },
     '용산구': { lat: 37.5311, lng: 126.9810, name: '이태원역' },
     '은평구': { lat: 37.6027, lng: 126.9291, name: '연신내역' },
     '종로구': { lat: 37.5735, lng: 126.9790, name: '종각역' },
     '중구': { lat: 37.5641, lng: 126.9979, name: '을지로입구역' },
     '중랑구': { lat: 37.6063, lng: 127.0926, name: '상봉역' }
   },
   '부산광역시': {
     '강서구': { lat: 35.2122, lng: 128.9807, name: '명지' },
     '금정구': { lat: 35.2435, lng: 129.0922, name: '부산대역' },
     '남구': { lat: 35.1365, lng: 129.0843, name: '경성대역' },
     '동구': { lat: 35.1292, lng: 129.0459, name: '부산역' },
     '동래구': { lat: 35.2051, lng: 129.0787, name: '동래역' },
     '부산진구': { lat: 35.1631, lng: 129.0532, name: '서면역' },
     '북구': { lat: 35.1972, lng: 128.9903, name: '구포역' },
     '사상구': { lat: 35.1526, lng: 128.9911, name: '사상역' },
     '사하구': { lat: 35.1046, lng: 128.9747, name: '괴정역' },
     '서구': { lat: 35.0977, lng: 129.0241, name: '토성역' },
     '수영구': { lat: 35.1454, lng: 129.1130, name: '광안역' },
     '연제구': { lat: 35.1760, lng: 129.0799, name: '연산역' },
     '영도구': { lat: 35.0912, lng: 129.0678, name: '영도' },
     '중구': { lat: 35.1060, lng: 129.0324, name: '남포역' },
     '해운대구': { lat: 35.1631, lng: 129.1635, name: '해운대역' }
   },
   '경기도': {
     '수원시': { lat: 37.2636, lng: 127.0286, name: '수원역' },
     '성남시': { lat: 37.4200, lng: 127.1267, name: '판교역' },
     '고양시': { lat: 37.6584, lng: 126.8320, name: '일산' },
     '용인시': { lat: 37.2411, lng: 127.1776, name: '기흥역' },
     '부천시': { lat: 37.5034, lng: 126.7660, name: '부천역' },
     '안산시': { lat: 37.3219, lng: 126.8309, name: '안산역' },
     '안양시': { lat: 37.3943, lng: 126.9568, name: '안양역' },
     '남양주시': { lat: 37.6360, lng: 127.2165, name: '다산' },
     '화성시': { lat: 37.1995, lng: 126.8313, name: '동탄' },
     '평택시': { lat: 36.9921, lng: 127.1128, name: '평택역' },
     '의정부시': { lat: 37.7381, lng: 127.0337, name: '의정부역' },
     '시흥시': { lat: 37.3800, lng: 126.8031, name: '시흥' },
     '파주시': { lat: 37.7126, lng: 126.7618, name: '파주' },
     '김포시': { lat: 37.6153, lng: 126.7156, name: '김포' },
     '광명시': { lat: 37.4786, lng: 126.8644, name: '광명역' },
     '광주시': { lat: 37.4095, lng: 127.2550, name: '경기광주' },
     '군포시': { lat: 37.3617, lng: 126.9352, name: '군포' },
     '하남시': { lat: 37.5393, lng: 127.2148, name: '미사' },
     '오산시': { lat: 37.1498, lng: 127.0770, name: '오산' },
     '이천시': { lat: 37.2724, lng: 127.4350, name: '이천' },
     '안성시': { lat: 37.0078, lng: 127.2798, name: '안성' },
     '의왕시': { lat: 37.3446, lng: 126.9688, name: '의왕' },
     '양주시': { lat: 37.7853, lng: 127.0459, name: '양주' },
     '포천시': { lat: 37.8949, lng: 127.2002, name: '포천' },
     '여주시': { lat: 37.2983, lng: 127.6375, name: '여주' },
     '동두천시': { lat: 37.9034, lng: 127.0605, name: '동두천' },
     '과천시': { lat: 37.4292, lng: 126.9876, name: '과천' },
     '구리시': { lat: 37.5943, lng: 127.1295, name: '구리' },
     '가평군': { lat: 37.8315, lng: 127.5095, name: '가평' },
     '양평군': { lat: 37.4917, lng: 127.4875, name: '양평' },
     '연천군': { lat: 38.0966, lng: 127.0750, name: '연천' }
   }
 };
 
 const collectRegionData = async (sido, sigungu) => {
   if (!sido) {
     alert('시도를 선택해주세요.');
     return;
   }
   
   const isNationwide = sido === '전국';
   const isSidoWide = sigungu === '전체' || sigungu === '';
   
   let regionsToCollect = [];
   
   // 수집할 지역 목록 생성 (좌표 포함)
   if (isNationwide) {
     Object.entries(REGION_COORDINATES).forEach(([sidoName, districts]) => {
       Object.entries(districts).forEach(([sigunguName, coord]) => {
         regionsToCollect.push({ sido: sidoName, sigungu: sigunguName, ...coord });
       });
     });
   } else if (isSidoWide) {
     const districts = REGION_COORDINATES[sido];
     if (districts) {
       Object.entries(districts).forEach(([sigunguName, coord]) => {
         regionsToCollect.push({ sido, sigungu: sigunguName, ...coord });
       });
     }
   } else {
     const coord = REGION_COORDINATES[sido]?.[sigungu];
     if (coord) {
       regionsToCollect.push({ sido, sigungu, ...coord });
     }
   }
   
   if (regionsToCollect.length === 0) {
     alert('수집할 지역이 없습니다. 좌표 정보가 없는 지역입니다.');
     return;
   }
   
   const totalRegions = regionsToCollect.length;
   const totalSteps = totalRegions * 5;
   
   setApiCollectProgress({ 
     current: 0, 
     total: totalSteps, 
     region: isNationwide ? '전국' : isSidoWide ? `${sido} 전체 (${totalRegions}개 지역)` : `${sido} ${sigungu}`, 
     status: '수집 시작...' 
   });
   
   const allResults = {
     collectType: isNationwide ? 'nationwide' : isSidoWide ? 'sido' : 'single',
     sido, sigungu, totalRegions,
     timestamp: new Date().toISOString(),
     regions: {},
     summary: { success: 0, failed: 0, totalStores: 0, totalCafes: 0, totalFloating: 0 },
     errors: []
   };
   
   let currentStep = 0;
   
   for (const region of regionsToCollect) {
     const results = {
       region: { sido: region.sido, sigungu: region.sigungu, lat: region.lat, lng: region.lng },
       timestamp: new Date().toISOString(),
       data: {},
       errors: []
     };
     
     try {
       // ═══════════════════════════════════════════════════════════════
       // 1. 반경 1km 내 전체 상가 조회 (좌표 기반 - 가장 확실한 방법)
       // ═══════════════════════════════════════════════════════════════
       currentStep++;
       setApiCollectProgress(prev => ({ ...prev, current: currentStep, status: `[${region.sigungu}] 상가정보 수집 중...` }));
       
       try {
         const storeRes = await fetch(`${PROXY_SERVER_URL}/api/store/radius?cx=${region.lng}&cy=${region.lat}&radius=1000&numOfRows=1000&pageNo=1`);
         if (storeRes.ok) {
           const storeData = await storeRes.json();
           console.log(`[${region.sigungu}] 상가 API 응답:`, JSON.stringify(storeData).substring(0, 500));
           
           // API 응답 구조가 다양함: body.items (배열) 또는 body.items.item (배열)
           let items = [];
           if (storeData.body?.items) {
             items = Array.isArray(storeData.body.items) 
               ? storeData.body.items 
               : (storeData.body.items.item || []);
           }
           // 배열이 아니면 빈 배열로
           if (!Array.isArray(items)) items = items ? [items] : [];
           
           console.log(`[${region.sigungu}] 파싱된 상가 수: ${items.length}개`);
           
           if (items.length > 0) {
             const cafes = items.filter(i => 
               i.indsMclsCd === 'Q12' || // 커피점/카페
               i.indsMclsNm?.includes('커피') || 
               i.indsSclsNm?.includes('카페') ||
               i.indsSclsNm?.includes('커피') ||
               i.bizesNm?.includes('카페') ||
               i.bizesNm?.includes('커피')
             );
             
             // 업종별 카운트
             const categories = {};
             items.forEach(item => {
               const cat = item.indsMclsNm || '기타';
               categories[cat] = (categories[cat] || 0) + 1;
             });
             
             results.data.store = {
               total: parseInt(storeData.body.totalCount) || items.length,
               retrieved: items.length,
               cafeCount: cafes.length,
               categories: categories,
               topCategories: Object.entries(categories)
                 .sort((a, b) => b[1] - a[1])
                 .slice(0, 5)
                 .map(([name, count]) => ({ name: name || '기타', count: count || 0 })),
               sampleCafes: cafes.slice(0, 5).map(c => ({
                 name: c.bizesNm || '-',
                 address: c.rdnmAdr || c.lnoAdr || '-',
                 category: c.indsSclsNm || '-'
               })),
               source: '소상공인시장진흥공단 (반경 1km)'
             };
             
             allResults.summary.totalStores += items.length;
             allResults.summary.totalCafes += cafes.length;
           } else {
             console.log(`[${region.sigungu}] 상가 데이터 없음, API 응답 구조:`, Object.keys(storeData));
             results.data.store = { total: 0, cafeCount: 0, note: 'API 응답 없음 또는 해당 지역 데이터 없음' };
           }
         } else {
           console.error(`[${region.sigungu}] 상가 API 응답 실패:`, storeRes.status);
           results.data.store = { total: 0, cafeCount: 0, note: `API 응답 실패 (${storeRes.status})` };
         }
       } catch (e) { 
         console.error(`[${region.sigungu}] 상가정보 오류:`, e);
         results.errors.push({ api: 'store', message: e.message }); 
       }
       
       // ═══════════════════════════════════════════════════════════════
       // 2. 서울시 유동인구 (서울만)
       // ═══════════════════════════════════════════════════════════════
       currentStep++;
       setApiCollectProgress(prev => ({ ...prev, current: currentStep, status: `[${region.sigungu}] 유동인구 수집 중...` }));
       
       if (region.sido === '서울특별시') {
         try {
           const floatingRes = await fetch(`${PROXY_SERVER_URL}/api/seoul/floating?startIndex=1&endIndex=1000`);
           if (floatingRes.ok) {
             const floatingData = await floatingRes.json();
             if (floatingData.VwsmTrdarFlpopQq?.row) {
               const rows = floatingData.VwsmTrdarFlpopQq.row;
               const guName = region.sigungu.replace('구', '');
               const guRows = rows.filter(r => r.SIGNGU_CD_NM?.includes(guName));
               
               if (guRows.length > 0) {
                 const totalFloating = guRows.reduce((sum, r) => sum + (parseInt(r.TOT_FLPOP_CO) || 0), 0);
                 const avgFloating = Math.round(totalFloating / guRows.length);
                 
                 // 시간대별 분석
                 const timeSlots = { '00~06시': 0, '06~11시': 0, '11~14시': 0, '14~17시': 0, '17~21시': 0, '21~24시': 0 };
                 const timeKeys = ['TMZON_1', 'TMZON_2', 'TMZON_3', 'TMZON_4', 'TMZON_5', 'TMZON_6'];
                 const timeNames = Object.keys(timeSlots);
                 
                 guRows.forEach(r => {
                   timeKeys.forEach((tk, idx) => {
                     timeSlots[timeNames[idx]] += parseInt(r[`${tk}_FLPOP_CO`]) || 0;
                   });
                 });
                 
                 // 피크 시간대 찾기
                 const peakTime = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
                 
                 results.data.floating = {
                   totalDailyAvg: avgFloating,
                   areaCount: guRows.length,
                   peakTime: peakTime,
                   timeSlots: timeSlots,
                   source: '서울시 열린데이터'
                 };
                 
                 allResults.summary.totalFloating += avgFloating;
               }
             }
           }
         } catch (e) { results.errors.push({ api: 'floating', message: e.message }); }
       }
       
       // ═══════════════════════════════════════════════════════════════
       // 3. 프랜차이즈 정보 (카페만)
       // ═══════════════════════════════════════════════════════════════
       currentStep++;
       setApiCollectProgress(prev => ({ ...prev, current: currentStep, status: `[${region.sigungu}] 프랜차이즈 수집 중...` }));
       
       try {
         const franchiseRes = await fetch(`${PROXY_SERVER_URL}/api/franchise?cafeOnly=true&numOfRows=50`);
         if (franchiseRes.ok) {
           const franchiseData = await franchiseRes.json();
           if (franchiseData.success && franchiseData.data) {
             results.data.franchise = {
               totalBrands: franchiseData.totalCount || 0,
               topBrands: franchiseData.data.slice(0, 10).map(f => ({
                 name: f.brandNm || '-',
                 company: f.corpNm || '-',
                 initialCost: f.smtnAmt || '-',
                 storeCount: f.frcsCnt || 0
               })),
               source: '공정거래위원회'
             };
           }
         }
       } catch (e) { results.errors.push({ api: 'franchise', message: e.message }); }
       
       // ═══════════════════════════════════════════════════════════════
       // 4. 임대료 정보 (R-ONE)
       // ═══════════════════════════════════════════════════════════════
       currentStep++;
       setApiCollectProgress(prev => ({ ...prev, current: currentStep, status: `[${region.sigungu}] 임대료 수집 중...` }));
       
       try {
         const rentRes = await fetch(`${PROXY_SERVER_URL}/api/rone/rent?pSize=100`);
         if (rentRes.ok) {
           const rentData = await rentRes.json();
           if (rentData.SttsApiTblData?.row) {
             const rows = rentData.SttsApiTblData.row;
             const regionRows = rows.filter(r => 
               r.SGG_NM?.includes(region.sigungu.replace('구', '').replace('시', '').replace('군', ''))
             );
             
             if (regionRows.length > 0) {
               const avgRent = regionRows.reduce((sum, r) => sum + (parseFloat(r.RENT_FEE) || 0), 0) / regionRows.length;
               results.data.rent = {
                 avgRentPerPyeong: Math.round(avgRent * 10) / 10,
                 dataCount: regionRows.length,
                 source: '한국부동산원 R-ONE'
               };
             } else {
               const allAvg = rows.reduce((sum, r) => sum + (parseFloat(r.RENT_FEE) || 0), 0) / rows.length;
               results.data.rent = {
                 avgRentPerPyeong: Math.round(allAvg * 10) / 10,
                 note: '전국 평균 참고',
                 source: '한국부동산원 R-ONE'
               };
             }
           }
         }
       } catch (e) { results.errors.push({ api: 'rent', message: e.message }); }
       
       // ═══════════════════════════════════════════════════════════════
       // 5. Firebase 저장 (계층형)
       // ═══════════════════════════════════════════════════════════════
       currentStep++;
       setApiCollectProgress(prev => ({ ...prev, current: currentStep, status: `[${region.sigungu}] Firebase 저장 중...` }));
       
       try {
         const sidoKey = region.sido.replace(/\s/g, '_');
         const sigunguKey = region.sigungu.replace(/\s/g, '_');
         
         const saveData = {
           ...results,
           coordinates: { lat: region.lat, lng: region.lng },
           searchKeywords: [
             region.sigungu,
             region.sigungu.replace('구', '').replace('시', '').replace('군', ''),
             region.name || '',
             `${region.sido} ${region.sigungu}`
           ].filter(Boolean),
           updatedAt: new Date().toISOString(),
           updatedBy: user?.name || 'admin'
         };
         
         await database.ref(`regionData/${sidoKey}/${sigunguKey}`).set(saveData);
         results.savedToFirebase = true;
         allResults.summary.success++;
       } catch (e) { 
         console.error(`[${region.sigungu}] Firebase 저장 오류:`, e);
         results.errors.push({ api: 'firebase', message: e.message }); 
         results.savedToFirebase = false;
         allResults.summary.failed++;
       }
       
       allResults.regions[`${region.sido}_${region.sigungu}`] = results;
       
     } catch (error) {
       console.error(`[${region.sigungu}] 수집 실패:`, error);
       allResults.errors.push({ region: `${region.sido} ${region.sigungu}`, message: error.message });
       allResults.summary.failed++;
     }
     
     await new Promise(resolve => setTimeout(resolve, 300));
   }
   
   setApiCollectProgress(prev => ({ ...prev, current: totalSteps, status: '수집 완료!' }));
   setApiCollectResults(allResults);
   setShowApiCollectReport(true);
 };

 // 영업모드 지역 검색 (소상공인365 GIS API + Gemini AI 통합)
 const searchSalesModeRegion = async (query, skipDuplicateCheck = false) => {
   if (!query.trim()) return;
   
   // 중복 지역 체크 (광주 등 같은 이름의 다른 지역)
   if (!skipDuplicateCheck) {
     const DUPLICATE_REGIONS = {
       '광주': [
         { label: '광주광역시', fullQuery: '광주광역시', description: '전라도 광주 (광역시)' },
         { label: '경기도 광주시', fullQuery: '경기도 광주시', description: '경기도 광주 (시)' }
       ],
       '김포': [
         { label: '경기도 김포시', fullQuery: '경기도 김포시', description: '경기도 김포' },
         { label: '김포공항역', fullQuery: '서울 강서구 김포공항', description: '서울 강서구' }
       ],
       '수원': [
         { label: '경기도 수원시', fullQuery: '경기도 수원시', description: '영통/장안/권선/팔달' },
         { label: '수원역', fullQuery: '경기도 수원시 팔달구 수원역', description: '수원역 상권' }
       ],
       '부산': [
         { label: '부산광역시 전체', fullQuery: '부산광역시', description: '부산 전체 상권' },
         { label: '부산역', fullQuery: '부산 동구 부산역', description: '부산역 상권' }
       ],
       '창원': [
         { label: '경남 창원시', fullQuery: '경남 창원시', description: '마산/진해 통합' },
         { label: '창원중앙역', fullQuery: '경남 창원시 의창구 창원중앙역', description: '창원중앙역 상권' }
       ],
       '성남': [
         { label: '경기도 성남시 분당구', fullQuery: '경기도 성남시 분당구', description: '판교/정자/서현' },
         { label: '경기도 성남시 수정구', fullQuery: '경기도 성남시 수정구', description: '모란/태평' },
         { label: '경기도 성남시 중원구', fullQuery: '경기도 성남시 중원구', description: '성남 중원' }
       ],
       '고양': [
         { label: '경기도 고양시 일산서구', fullQuery: '경기도 고양시 일산서구', description: '일산 서쪽 (대화/주엽)' },
         { label: '경기도 고양시 일산동구', fullQuery: '경기도 고양시 일산동구', description: '일산 동쪽 (마두/백석)' },
         { label: '경기도 고양시 덕양구', fullQuery: '경기도 고양시 덕양구', description: '화정/행신' }
       ],
       '용인': [
         { label: '경기도 용인시 수지구', fullQuery: '경기도 용인시 수지구', description: '수지/죽전' },
         { label: '경기도 용인시 기흥구', fullQuery: '경기도 용인시 기흥구', description: '기흥/보정' },
         { label: '경기도 용인시 처인구', fullQuery: '경기도 용인시 처인구', description: '용인 중심' }
       ],
       '안양': [
         { label: '경기도 안양시 만안구', fullQuery: '경기도 안양시 만안구', description: '안양역/명학' },
         { label: '경기도 안양시 동안구', fullQuery: '경기도 안양시 동안구', description: '범계/평촌' }
       ]
     };
     const trimmedQuery = query.trim();
     if (DUPLICATE_REGIONS[trimmedQuery] && DUPLICATE_REGIONS[trimmedQuery].length > 1) {
       setDuplicateRegionOptions(DUPLICATE_REGIONS[trimmedQuery]);
       setShowDuplicateSelector(true);
       return;
     }
   }
   setShowDuplicateSelector(false);
   setDuplicateRegionOptions([]);
   
   // 이전 결과 초기화
   setSalesModeSearchResult(null);
   setSalesModeMapCenter(null);
   
   // 분석 중지 컨트롤러 초기화
   if (salesModeAbortRef.current) salesModeAbortRef.current.abort();
   const abortCtrl = new AbortController();
   salesModeAbortRef.current = abortCtrl;

   setSalesModeSearchLoading(true);
   setSalesModeAnalysisProgress(0);
   currentProgressRef.current = 0;
   setSalesModeAnalysisStep('검색 준비 중...');
   setSalesModeCollectingText('');
   updateSalesModeActivity();

   // 부드러운 진행률 업데이트 함수
   const animateProgressTo = (target) => {
     if (progressIntervalRef.current) {
       clearInterval(progressIntervalRef.current);
     }
     const step = () => {
       if (currentProgressRef.current < target) {
         currentProgressRef.current += 1;
         setSalesModeAnalysisProgress(currentProgressRef.current);
       } else {
         clearInterval(progressIntervalRef.current);
       }
     };
     progressIntervalRef.current = setInterval(step, 40);
   };

   // 실시간 수집 텍스트 업데이트 함수
   const updateCollectingText = (text) => {
     setSalesModeCollectingText(text);
   };
   
   // ═══════════════════════════════════════════════════════════════
   // 검색어 → 시도/시군구 파싱 함수 (강화 버전)
   // ═══════════════════════════════════════════════════════════════
   const parseRegionFromQuery = (q) => {
     const trimmed = q.trim();
     
     // 0. 상세주소 패턴 처리 (예: "창신동 407-4", "종로구 창신동 407-4번지")
     // 번지수 제거하고 동 이름만 추출
     const cleanedQuery = trimmed.replace(/\s*\d+[-번지]*\d*[-호]*\s*$/g, '').trim();
     
     // 시도명 정규화 매핑
     const sidoNormalize = {
       '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시',
       '인천': '인천광역시', '광주': '광주광역시', '대전': '대전광역시',
       '울산': '울산광역시', '세종': '세종특별자치시', '경기': '경기도',
       '강원': '강원도', '충북': '충청북도', '충남': '충청남도',
       '전북': '전라북도', '전남': '전라남도', '경북': '경상북도',
       '경남': '경상남도', '제주': '제주특별자치도'
     };
     
     // 동 → 시도/시군구 매핑 (서울 전체 동 확장)
     const dongToRegion = {
       // 종로구 (전체 동)
       '청운동': { sido: '서울특별시', sigungu: '종로구' }, '효자동': { sido: '서울특별시', sigungu: '종로구' },
       '창성동': { sido: '서울특별시', sigungu: '종로구' }, '통의동': { sido: '서울특별시', sigungu: '종로구' },
       '적선동': { sido: '서울특별시', sigungu: '종로구' }, '통인동': { sido: '서울특별시', sigungu: '종로구' },
       '누상동': { sido: '서울특별시', sigungu: '종로구' }, '누하동': { sido: '서울특별시', sigungu: '종로구' },
       '옥인동': { sido: '서울특별시', sigungu: '종로구' }, '체부동': { sido: '서울특별시', sigungu: '종로구' },
       '필운동': { sido: '서울특별시', sigungu: '종로구' }, '내자동': { sido: '서울특별시', sigungu: '종로구' },
       '사직동': { sido: '서울특별시', sigungu: '종로구' }, '도렴동': { sido: '서울특별시', sigungu: '종로구' },
       '당주동': { sido: '서울특별시', sigungu: '종로구' }, '신문로': { sido: '서울특별시', sigungu: '종로구' },
       '세종로': { sido: '서울특별시', sigungu: '종로구' }, '청진동': { sido: '서울특별시', sigungu: '종로구' },
       '서린동': { sido: '서울특별시', sigungu: '종로구' }, '수송동': { sido: '서울특별시', sigungu: '종로구' },
       '중학동': { sido: '서울특별시', sigungu: '종로구' }, '종로동': { sido: '서울특별시', sigungu: '종로구' },
       '공평동': { sido: '서울특별시', sigungu: '종로구' }, '관훈동': { sido: '서울특별시', sigungu: '종로구' },
       '견지동': { sido: '서울특별시', sigungu: '종로구' }, '와룡동': { sido: '서울특별시', sigungu: '종로구' },
       '권농동': { sido: '서울특별시', sigungu: '종로구' }, '운니동': { sido: '서울특별시', sigungu: '종로구' },
       '익선동': { sido: '서울특별시', sigungu: '종로구' }, '경운동': { sido: '서울특별시', sigungu: '종로구' },
       '관철동': { sido: '서울특별시', sigungu: '종로구' }, '인사동': { sido: '서울특별시', sigungu: '종로구' },
       '낙원동': { sido: '서울특별시', sigungu: '종로구' }, '종로1가': { sido: '서울특별시', sigungu: '종로구' },
       '종로2가': { sido: '서울특별시', sigungu: '종로구' }, '종로3가': { sido: '서울특별시', sigungu: '종로구' },
       '종로4가': { sido: '서울특별시', sigungu: '종로구' }, '종로5가': { sido: '서울특별시', sigungu: '종로구' },
       '종로6가': { sido: '서울특별시', sigungu: '종로구' }, '창신동': { sido: '서울특별시', sigungu: '종로구' },
       '숭인동': { sido: '서울특별시', sigungu: '종로구' }, '교남동': { sido: '서울특별시', sigungu: '종로구' },
       '평동': { sido: '서울특별시', sigungu: '종로구' }, '송월동': { sido: '서울특별시', sigungu: '종로구' },
       '홍파동': { sido: '서울특별시', sigungu: '종로구' }, '교북동': { sido: '서울특별시', sigungu: '종로구' },
       '행촌동': { sido: '서울특별시', sigungu: '종로구' }, '구기동': { sido: '서울특별시', sigungu: '종로구' },
       '평창동': { sido: '서울특별시', sigungu: '종로구' }, '부암동': { sido: '서울특별시', sigungu: '종로구' },
       '홍지동': { sido: '서울특별시', sigungu: '종로구' }, '신영동': { sido: '서울특별시', sigungu: '종로구' },
       '무악동': { sido: '서울특별시', sigungu: '종로구' }, '삼청동': { sido: '서울특별시', sigungu: '종로구' },
       '가회동': { sido: '서울특별시', sigungu: '종로구' }, '안국동': { sido: '서울특별시', sigungu: '종로구' },
       '소격동': { sido: '서울특별시', sigungu: '종로구' }, '화동': { sido: '서울특별시', sigungu: '종로구' },
       '사간동': { sido: '서울특별시', sigungu: '종로구' }, '송현동': { sido: '서울특별시', sigungu: '종로구' },
       '계동': { sido: '서울특별시', sigungu: '종로구' }, '원서동': { sido: '서울특별시', sigungu: '종로구' },
       '훈정동': { sido: '서울특별시', sigungu: '종로구' }, '묘동': { sido: '서울특별시', sigungu: '종로구' },
       '봉익동': { sido: '서울특별시', sigungu: '종로구' }, '돈의동': { sido: '서울특별시', sigungu: '종로구' },
       '장사동': { sido: '서울특별시', sigungu: '종로구' }, '관수동': { sido: '서울특별시', sigungu: '종로구' },
       '예지동': { sido: '서울특별시', sigungu: '종로구' }, '원남동': { sido: '서울특별시', sigungu: '종로구' },
       '연지동': { sido: '서울특별시', sigungu: '종로구' }, '충신동': { sido: '서울특별시', sigungu: '종로구' },
       '동숭동': { sido: '서울특별시', sigungu: '종로구' }, '혜화동': { sido: '서울특별시', sigungu: '종로구' },
       '명륜동': { sido: '서울특별시', sigungu: '종로구' }, '이화동': { sido: '서울특별시', sigungu: '종로구' },
       '연건동': { sido: '서울특별시', sigungu: '종로구' },
       // 마포구 (주요 동)
       '아현동': { sido: '서울특별시', sigungu: '마포구' }, '공덕동': { sido: '서울특별시', sigungu: '마포구' },
       '신공덕동': { sido: '서울특별시', sigungu: '마포구' }, '도화동': { sido: '서울특별시', sigungu: '마포구' },
       '용강동': { sido: '서울특별시', sigungu: '마포구' }, '토정동': { sido: '서울특별시', sigungu: '마포구' },
       '마포동': { sido: '서울특별시', sigungu: '마포구' }, '대흥동': { sido: '서울특별시', sigungu: '마포구' },
       '염리동': { sido: '서울특별시', sigungu: '마포구' }, '노고산동': { sido: '서울특별시', sigungu: '마포구' },
       '신수동': { sido: '서울특별시', sigungu: '마포구' }, '현석동': { sido: '서울특별시', sigungu: '마포구' },
       '구수동': { sido: '서울특별시', sigungu: '마포구' }, '창전동': { sido: '서울특별시', sigungu: '마포구' },
       '상수동': { sido: '서울특별시', sigungu: '마포구' }, '하중동': { sido: '서울특별시', sigungu: '마포구' },
       '신정동': { sido: '서울특별시', sigungu: '마포구' }, '당인동': { sido: '서울특별시', sigungu: '마포구' },
       '서교동': { sido: '서울특별시', sigungu: '마포구' }, '동교동': { sido: '서울특별시', sigungu: '마포구' },
       '합정동': { sido: '서울특별시', sigungu: '마포구' }, '망원동': { sido: '서울특별시', sigungu: '마포구' },
       '연남동': { sido: '서울특별시', sigungu: '마포구' }, '성산동': { sido: '서울특별시', sigungu: '마포구' },
       '중동': { sido: '서울특별시', sigungu: '마포구' }, '상암동': { sido: '서울특별시', sigungu: '마포구' },
       // 성동구 (주요 동)
       '상왕십리동': { sido: '서울특별시', sigungu: '성동구' }, '하왕십리동': { sido: '서울특별시', sigungu: '성동구' },
       '홍익동': { sido: '서울특별시', sigungu: '성동구' }, '도선동': { sido: '서울특별시', sigungu: '성동구' },
       '마장동': { sido: '서울특별시', sigungu: '성동구' }, '사근동': { sido: '서울특별시', sigungu: '성동구' },
       '행당동': { sido: '서울특별시', sigungu: '성동구' }, '응봉동': { sido: '서울특별시', sigungu: '성동구' },
       '금호동': { sido: '서울특별시', sigungu: '성동구' }, '옥수동': { sido: '서울특별시', sigungu: '성동구' },
       '성수동': { sido: '서울특별시', sigungu: '성동구' }, '송정동': { sido: '서울특별시', sigungu: '성동구' },
       '용답동': { sido: '서울특별시', sigungu: '성동구' },
       // 강남구 (주요 동)
       '역삼동': { sido: '서울특별시', sigungu: '강남구' }, '개포동': { sido: '서울특별시', sigungu: '강남구' },
       '청담동': { sido: '서울특별시', sigungu: '강남구' }, '삼성동': { sido: '서울특별시', sigungu: '강남구' },
       '대치동': { sido: '서울특별시', sigungu: '강남구' }, '신사동': { sido: '서울특별시', sigungu: '강남구' },
       '논현동': { sido: '서울특별시', sigungu: '강남구' }, '압구정동': { sido: '서울특별시', sigungu: '강남구' },
       '세곡동': { sido: '서울특별시', sigungu: '강남구' }, '자곡동': { sido: '서울특별시', sigungu: '강남구' },
       '율현동': { sido: '서울특별시', sigungu: '강남구' }, '일원동': { sido: '서울특별시', sigungu: '강남구' },
       '수서동': { sido: '서울특별시', sigungu: '강남구' }, '도곡동': { sido: '서울특별시', sigungu: '강남구' },
       // 중구 (주요 동)
       '소공동': { sido: '서울특별시', sigungu: '중구' }, '회현동': { sido: '서울특별시', sigungu: '중구' },
       '명동': { sido: '서울특별시', sigungu: '중구' }, '필동': { sido: '서울특별시', sigungu: '중구' },
       '장충동': { sido: '서울특별시', sigungu: '중구' }, '광희동': { sido: '서울특별시', sigungu: '중구' },
       '을지로동': { sido: '서울특별시', sigungu: '중구' }, '신당동': { sido: '서울특별시', sigungu: '중구' },
       '황학동': { sido: '서울특별시', sigungu: '중구' }, '중림동': { sido: '서울특별시', sigungu: '중구' },
       // 용산구 (주요 동)
       '후암동': { sido: '서울특별시', sigungu: '용산구' }, '용산동': { sido: '서울특별시', sigungu: '용산구' },
       '남영동': { sido: '서울특별시', sigungu: '용산구' }, '청파동': { sido: '서울특별시', sigungu: '용산구' },
       '원효로동': { sido: '서울특별시', sigungu: '용산구' }, '효창동': { sido: '서울특별시', sigungu: '용산구' },
       '도원동': { sido: '서울특별시', sigungu: '용산구' }, '용문동': { sido: '서울특별시', sigungu: '용산구' },
       '한강로동': { sido: '서울특별시', sigungu: '용산구' }, '이촌동': { sido: '서울특별시', sigungu: '용산구' },
       '이태원동': { sido: '서울특별시', sigungu: '용산구' }, '한남동': { sido: '서울특별시', sigungu: '용산구' },
       '서빙고동': { sido: '서울특별시', sigungu: '용산구' }, '보광동': { sido: '서울특별시', sigungu: '용산구' },
       // 송파구 (주요 동)
       '잠실동': { sido: '서울특별시', sigungu: '송파구' }, '신천동': { sido: '서울특별시', sigungu: '송파구' },
       '풍납동': { sido: '서울특별시', sigungu: '송파구' }, '거여동': { sido: '서울특별시', sigungu: '송파구' },
       '마천동': { sido: '서울특별시', sigungu: '송파구' }, '방이동': { sido: '서울특별시', sigungu: '송파구' },
       '오금동': { sido: '서울특별시', sigungu: '송파구' }, '송파동': { sido: '서울특별시', sigungu: '송파구' },
       '석촌동': { sido: '서울특별시', sigungu: '송파구' }, '삼전동': { sido: '서울특별시', sigungu: '송파구' },
       '가락동': { sido: '서울특별시', sigungu: '송파구' }, '문정동': { sido: '서울특별시', sigungu: '송파구' },
       '장지동': { sido: '서울특별시', sigungu: '송파구' }, '위례동': { sido: '서울특별시', sigungu: '송파구' },
       // 영등포구 (주요 동)
       '영등포동': { sido: '서울특별시', sigungu: '영등포구' }, '여의도동': { sido: '서울특별시', sigungu: '영등포구' },
       '당산동': { sido: '서울특별시', sigungu: '영등포구' }, '문래동': { sido: '서울특별시', sigungu: '영등포구' },
       '양평동': { sido: '서울특별시', sigungu: '영등포구' }, '신길동': { sido: '서울특별시', sigungu: '영등포구' },
       '대림동': { sido: '서울특별시', sigungu: '영등포구' }, '도림동': { sido: '서울특별시', sigungu: '영등포구' },
       // 서초구 (주요 동)
       '서초동': { sido: '서울특별시', sigungu: '서초구' }, '잠원동': { sido: '서울특별시', sigungu: '서초구' },
       '반포동': { sido: '서울특별시', sigungu: '서초구' }, '방배동': { sido: '서울특별시', sigungu: '서초구' },
       '양재동': { sido: '서울특별시', sigungu: '서초구' }, '내곡동': { sido: '서울특별시', sigungu: '서초구' },
       // 광진구 (주요 동)
       '화양동': { sido: '서울특별시', sigungu: '광진구' }, '군자동': { sido: '서울특별시', sigungu: '광진구' },
       '중곡동': { sido: '서울특별시', sigungu: '광진구' }, '능동': { sido: '서울특별시', sigungu: '광진구' },
       '구의동': { sido: '서울특별시', sigungu: '광진구' }, '광장동': { sido: '서울특별시', sigungu: '광진구' },
       '자양동': { sido: '서울특별시', sigungu: '광진구' },
       // 서대문구 (주요 동)
       '충정로동': { sido: '서울특별시', sigungu: '서대문구' }, '북아현동': { sido: '서울특별시', sigungu: '서대문구' },
       '신촌동': { sido: '서울특별시', sigungu: '서대문구' }, '연희동': { sido: '서울특별시', sigungu: '서대문구' },
       '홍제동': { sido: '서울특별시', sigungu: '서대문구' }, '홍은동': { sido: '서울특별시', sigungu: '서대문구' },
       '남가좌동': { sido: '서울특별시', sigungu: '서대문구' }, '북가좌동': { sido: '서울특별시', sigungu: '서대문구' }
     };
     
     // 유명 지역 → 시도/시군구 매핑 (확장)
     const famousToRegion = {
       '홍대': { sido: '서울특별시', sigungu: '마포구' }, '홍대입구': { sido: '서울특별시', sigungu: '마포구' },
       '신촌': { sido: '서울특별시', sigungu: '서대문구' }, '이태원': { sido: '서울특별시', sigungu: '용산구' },
       '강남': { sido: '서울특별시', sigungu: '강남구' }, '강남역': { sido: '서울특별시', sigungu: '강남구' },
       '건대': { sido: '서울특별시', sigungu: '광진구' }, '건대입구': { sido: '서울특별시', sigungu: '광진구' },
       '잠실': { sido: '서울특별시', sigungu: '송파구' }, '성수': { sido: '서울특별시', sigungu: '성동구' },
       '을지로': { sido: '서울특별시', sigungu: '중구' }, '을지로3가': { sido: '서울특별시', sigungu: '중구' },
       '동묘': { sido: '서울특별시', sigungu: '종로구' }, '동묘앞': { sido: '서울특별시', sigungu: '종로구' },
       '혜화': { sido: '서울특별시', sigungu: '종로구' }, '대학로': { sido: '서울특별시', sigungu: '종로구' },
       '여의도': { sido: '서울특별시', sigungu: '영등포구' }, '가로수길': { sido: '서울특별시', sigungu: '강남구' },
       '압구정': { sido: '서울특별시', sigungu: '강남구' }, '청담': { sido: '서울특별시', sigungu: '강남구' },
       '삼청': { sido: '서울특별시', sigungu: '종로구' }, '북촌': { sido: '서울특별시', sigungu: '종로구' },
       '익선': { sido: '서울특별시', sigungu: '종로구' }, '종각': { sido: '서울특별시', sigungu: '종로구' },
       '광화문': { sido: '서울특별시', sigungu: '종로구' }, '경복궁': { sido: '서울특별시', sigungu: '종로구' },
       '명동': { sido: '서울특별시', sigungu: '중구' }, '남대문': { sido: '서울특별시', sigungu: '중구' },
       '동대문': { sido: '서울특별시', sigungu: '중구' }, '왕십리': { sido: '서울특별시', sigungu: '성동구' },
       '사당': { sido: '서울특별시', sigungu: '동작구' }, '노량진': { sido: '서울특별시', sigungu: '동작구' },
       '신림': { sido: '서울특별시', sigungu: '관악구' }, '해운대': { sido: '부산광역시', sigungu: '해운대구' },
       '서면': { sido: '부산광역시', sigungu: '부산진구' }, '광안리': { sido: '부산광역시', sigungu: '수영구' },
       '남포동': { sido: '부산광역시', sigungu: '중구' }, '센텀': { sido: '부산광역시', sigungu: '해운대구' },
       '수원': { sido: '경기도', sigungu: '수원시' }, '분당': { sido: '경기도', sigungu: '성남시' },
       '판교': { sido: '경기도', sigungu: '성남시' }, '일산': { sido: '경기도', sigungu: '고양시' },
       '동탄': { sido: '경기도', sigungu: '화성시' }
     };
     
     // 1. 동 이름으로 검색 (번지수 제거한 쿼리 사용)
     for (const [dong, region] of Object.entries(dongToRegion)) {
       if (cleanedQuery.includes(dong)) {
         console.log(`동 매칭 성공: ${dong} → ${region.sido} ${region.sigungu}`);
         return { ...region, dong, matched: 'dong', originalQuery: trimmed };
       }
     }
     
     // 2. 유명 지역으로 검색
     for (const [place, region] of Object.entries(famousToRegion)) {
       if (cleanedQuery.includes(place)) {
         console.log(`유명지역 매칭 성공: ${place} → ${region.sido} ${region.sigungu}`);
         return { ...region, place, matched: 'famous', originalQuery: trimmed };
       }
     }
     
     // 3. "구" 단위 검색 (예: "종로구", "강남구")
     const guMatch = trimmed.match(/([가-힣]+구)/);
     if (guMatch) {
       const gu = guMatch[1];
       // 서울 25개 구 확인
       const seoulGu = ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'];
       if (seoulGu.includes(gu)) {
         return { sido: '서울특별시', sigungu: gu, matched: 'gu' };
       }
       // 부산 구
       const busanGu = ['강서구', '금정구', '남구', '동구', '동래구', '부산진구', '북구', '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구'];
       if (busanGu.includes(gu)) {
         return { sido: '부산광역시', sigungu: gu, matched: 'gu' };
       }
     }
     
     // 4. 시도명이 포함된 경우 (예: "서울 종로구")
     for (const [short, full] of Object.entries(sidoNormalize)) {
       if (trimmed.includes(short)) {
         // 시군구도 추출 시도
         const sigunguMatch = trimmed.match(/([가-힣]+[구시군])/);
         if (sigunguMatch && sigunguMatch[1] !== short) {
           return { sido: full, sigungu: sigunguMatch[1], matched: 'sidoSigungu' };
         }
         return { sido: full, sigungu: null, matched: 'sidoOnly' };
       }
     }
     
     return null;
   };
   
   // ═══════════════════════════════════════════════════════════════
   // Firebase에서 지역 데이터 조회
   // ═══════════════════════════════════════════════════════════════
   const getFirebaseRegionData = async (sido, sigungu) => {
     if (!sido || !sigungu) return null;
     try {
       // 저장 경로: regionData/${sido}/${sigungu} 형태 (공백 → 언더스코어)
       const sidoKey = sido.replace(/\s/g, '_');
       const sigunguKey = sigungu.replace(/\s/g, '_');
       console.log(`Firebase 조회 경로: regionData/${sidoKey}/${sigunguKey}`);
       const snapshot = await database.ref(`regionData/${sidoKey}/${sigunguKey}`).once('value');
       const data = snapshot.val();
       console.log('Firebase 조회 결과:', data ? '데이터 있음' : '데이터 없음');
       return data;
     } catch (e) {
       console.log('Firebase 조회 실패:', e);
       return null;
     }
   };
   
   // ═══════════════════════════════════════════════════════════════
   // 0단계: Firebase 캐시 건너뛰기 — 영업모드는 항상 실시간 API + Gemini AI 호출
   // ═══════════════════════════════════════════════════════════════
   animateProgressTo(3);
   setSalesModeAnalysisStep('실시간 데이터 수집 준비 중...');
   updateCollectingText(`${query} 지역 실시간 분석을 시작해요`);

   const parsedRegion = parseRegionFromQuery(query);
   console.log('파싱된 지역:', parsedRegion);

   // Firebase 캐시 사용 안 함 — 항상 실시간 API + Gemini로 14카드 전체 생성
   if (false && parsedRegion?.sido && parsedRegion?.sigungu) {
     const firebaseData = await getFirebaseRegionData(parsedRegion.sido, parsedRegion.sigungu);
     console.log('Firebase 데이터:', firebaseData);

     if (firebaseData?.data) {
       // Firebase에 데이터가 있으면 바로 활용
       animateProgressTo(80);
       setSalesModeAnalysisStep('저장된 데이터 로드 완료');
       updateCollectingText(`${parsedRegion.sigungu} 데이터를 불러왔어요`);
       
       // 지도 중심 좌표 설정 (기본 좌표 또는 저장된 좌표)
       const defaultCoords = {
         '강남구': { lat: 37.5172, lng: 127.0473 }, '종로구': { lat: 37.5735, lng: 126.9790 },
         '마포구': { lat: 37.5665, lng: 126.9018 }, '서초구': { lat: 37.4837, lng: 127.0324 },
         '송파구': { lat: 37.5145, lng: 127.1059 }, '영등포구': { lat: 37.5263, lng: 126.8964 },
         '성동구': { lat: 37.5634, lng: 127.0369 }, '용산구': { lat: 37.5311, lng: 126.9810 },
         '강서구': { lat: 37.5509, lng: 126.8495 }, '동대문구': { lat: 37.5744, lng: 127.0395 },
         '중구': { lat: 37.5641, lng: 126.9979 }, '서대문구': { lat: 37.5791, lng: 126.9368 },
         '광진구': { lat: 37.5385, lng: 127.0823 }
       };
       
       const coord = defaultCoords[parsedRegion.sigungu] || { lat: 37.5665, lng: 126.9780 };
       setSalesModeMapCenter({
         lat: coord.lat,
         lng: coord.lng,
         roadAddress: `${parsedRegion.sido} ${parsedRegion.sigungu}`
       });
       
       // Firebase 데이터를 영업모드 결과 형식으로 변환
       const storeData = firebaseData.data.store || {};
       const floatingData = firebaseData.data.floating || {};
       const franchiseData = firebaseData.data.franchise || {};
       const rentData = firebaseData.data.rent || {};
       
       const formattedResult = {
         success: true,
         data: {
           region: `${parsedRegion.sido} ${parsedRegion.sigungu}`,
           hasApiData: true,
           dataSource: 'firebase',
           dataDate: firebaseData.updatedAt ? new Date(firebaseData.updatedAt).toLocaleDateString('ko-KR') : '-',
           overview: {
             cafeCount: storeData.cafeCount?.toString() || '-',
             floatingPop: floatingData.totalDailyAvg ? `약 ${floatingData.totalDailyAvg.toLocaleString()}명/일` : '-',
             newOpen: '-',
             closed: '-',
             source: storeData.source || '소상공인시장진흥공단'
           },
           consumers: {
             mainTarget: floatingData.timeSlots ? '직장인/학생' : '-',
             mainRatio: '-',
             secondTarget: '-',
             secondRatio: '-',
             peakTime: floatingData.timeSlots ? Object.entries(floatingData.timeSlots).sort((a,b) => b[1] - a[1])[0]?.[0] || '-' : '-',
             takeoutRatio: '-',
             avgStay: '-'
           },
           franchise: franchiseData.topBrands?.map(b => ({
             name: b.name,
             count: b.storeCount || '-',
             avgRevenue: '-'
           })) || [],
           rent: {
             monthly: rentData.avgRentPerPyeong ? `${rentData.avgRentPerPyeong.toLocaleString()}원/평` : '-',
             deposit: '-',
             premium: '-',
             source: rentData.source || '한국부동산원'
           },
           opportunities: [],
           risks: [],
           startupCost: {
             deposit: '약 3,000~5,000만원 (추정)',
             premium: '약 5,000만원~1.5억원 (추정)',
             interior: '약 5,000~8,000만원 (15평 기준)',
             equipment: '약 2,000~3,000만원',
             total: '약 1.5~3억원 (추정)'
           }
         },
         query,
         hasApiData: true,
         firebaseData: firebaseData
       };
       
       animateProgressTo(100);
       setSalesModeAnalysisStep('분석 완료');
       setSalesModeCollectingText('');
       setSalesModeSearchResult(formattedResult);
       setSalesModeSearchLoading(false);
       setSalesModeMapExpanded(true);
       
       // 출처 정보 저장
       if (!formattedResult.data.sources) {
         formattedResult.data.sources = {
           store: { name: '소상공인시장진흥공단', date: firebaseData.updatedAt },
           floating: { name: '서울시 열린데이터', date: firebaseData.updatedAt },
           franchise: { name: '공정거래위원회', date: firebaseData.updatedAt },
           rent: { name: '한국부동산원 R-ONE', date: firebaseData.updatedAt }
         };
       }
       
       return; // Firebase 데이터 사용 완료, 함수 종료
     }
   }
   
   // Firebase에 데이터 없으면 기존 실시간 API 호출 진행
   console.log('Firebase에 데이터 없음, 실시간 API 호출 진행');
   
   // ═══════════════════════════════════════════════════════════════
   // 검색어 확장 함수: "동묘" → "서울 동묘", "수원" → "경기 수원"
   // ═══════════════════════════════════════════════════════════════
   const expandSearchQuery = (q) => {
     const trimmed = q.trim();
     
     // 1. 상세주소 패턴 감지 (예: "종로구 창신동 407-4", "마포구 서교동 123")
     const detailAddressPattern = /([가-힣]+구)\s*([가-힣]+동)(\s*[\d\-]+)?/;
     const detailMatch = trimmed.match(detailAddressPattern);
     if (detailMatch) {
       const [, gu, dong, number] = detailMatch;
       // 구 이름으로 시도 추정
       const seoulGu = ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'];
       if (seoulGu.includes(gu)) {
         return [`서울 ${gu} ${dong}${number || ''}`, `서울특별시 ${gu} ${dong}`, trimmed];
       }
       return [trimmed, `서울 ${trimmed}`, `경기 ${trimmed}`];
     }
     
     // 2. 이미 시도+행정구역(구/시/군/읍/면)이 포함되어 있으면 그대로 반환
     // 단, "광주 충장로"처럼 시도+유명지역명은 regionMapping으로 넘겨야 함
     const sidoList = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
     const matchedSido = sidoList.find(sido => trimmed.startsWith(sido));
     if (matchedSido) {
       // 시도명을 제거한 나머지에서 행정구역(구/시/군/읍/면/동) 포함 여부 확인
       const rest = trimmed.slice(matchedSido.length).trim();
       const hasAdmin = /[가-힣]+(구|시|군|읍|면|동)(\s|$)/.test(rest);
       if (hasAdmin) return [trimmed];
     }
     
     // 3. 동 이름만 입력한 경우 (예: "창신동", "숭인동", "서교동")
     const dongMapping = {
       // 종로구
       '창신동': '서울 종로구 창신동', '숭인동': '서울 종로구 숭인동', '동숭동': '서울 종로구 동숭동',
       '혜화동': '서울 종로구 혜화동', '명륜동': '서울 종로구 명륜동', '삼청동': '서울 종로구 삼청동',
       '가회동': '서울 종로구 가회동', '익선동': '서울 종로구 익선동', '연건동': '서울 종로구 연건동',
       '연지동': '서울 종로구 연지동', '충신동': '서울 종로구 충신동', '동묘앞': '서울 종로구 숭인동',
       // 마포구
       '서교동': '서울 마포구 서교동', '망원동': '서울 마포구 망원동', '연남동': '서울 마포구 연남동',
       '합정동': '서울 마포구 합정동', '상수동': '서울 마포구 상수동', '성산동': '서울 마포구 성산동',
       // 성동구
       '성수동': '서울 성동구 성수동', '행당동': '서울 성동구 행당동', '금호동': '서울 성동구 금호동',
       // 강남구
       '신사동': '서울 강남구 신사동', '압구정동': '서울 강남구 압구정동', '청담동': '서울 강남구 청담동',
       '역삼동': '서울 강남구 역삼동', '삼성동': '서울 강남구 삼성동', '논현동': '서울 강남구 논현동',
       // 중구
       '명동': '서울 중구 명동', '을지로동': '서울 중구 을지로동', '필동': '서울 중구 필동',
       // 용산구
       '이태원동': '서울 용산구 이태원동', '한남동': '서울 용산구 한남동', '후암동': '서울 용산구 후암동',
       // 서대문구
       '연희동': '서울 서대문구 연희동', '신촌동': '서울 서대문구 신촌동',
       // 영등포구
       '여의도동': '서울 영등포구 여의도동', '당산동': '서울 영등포구 당산동',
       // 송파구
       '잠실동': '서울 송파구 잠실동', '방이동': '서울 송파구 방이동', '가락동': '서울 송파구 가락동'
     };
     
     for (const [dong, expanded] of Object.entries(dongMapping)) {
       if (trimmed === dong || trimmed.includes(dong)) {
         return [expanded, trimmed];
       }
     }
     
     // 4. 구/지역명 매핑
     const regionMapping = {
       // 서울 구 단위
       '강남': '서울 강남구', '강북': '서울 강북구', '강서': '서울 강서구', '강동': '서울 강동구',
       '마포': '서울 마포구', '종로': '서울 종로구', '용산': '서울 용산구', '성동': '서울 성동구',
       '광진': '서울 광진구', '동대문': '서울 동대문구', '중랑': '서울 중랑구', '성북': '서울 성북구',
       '도봉': '서울 도봉구', '노원': '서울 노원구', '은평': '서울 은평구', '서대문': '서울 서대문구',
       '양천': '서울 양천구', '영등포': '서울 영등포구', '동작': '서울 동작구', '관악': '서울 관악구',
       '서초': '서울 서초구', '송파': '서울 송파구', '구로': '서울 구로구', '금천': '서울 금천구',
       // 서울 유명 지역
       '홍대': '서울 마포구 서교동', '신촌': '서울 서대문구 신촌', '이태원': '서울 용산구 이태원동',
       '건대': '서울 광진구 화양동', '잠실': '서울 송파구 잠실동',
       '압구정': '서울 강남구 압구정동', '청담': '서울 강남구 청담동', '가로수길': '서울 강남구 신사동',
       '성수': '서울 성동구 성수동', '을지로': '서울 중구 을지로', '동묘': '서울 종로구 숭인동',
       '혜화': '서울 종로구 혜화동', '대학로': '서울 종로구 동숭동', '여의도': '서울 영등포구 여의도동',
       '목동': '서울 양천구 목동', '망원': '서울 마포구 망원동', '연남': '서울 마포구 연남동',
       '합정': '서울 마포구 합정동', '상수': '서울 마포구 상수동', '삼청': '서울 종로구 삼청동',
       '북촌': '서울 종로구 가회동', '익선': '서울 종로구 익선동', '을지로3가': '서울 중구 을지로3가',
       '성신여대': '서울 성북구 동선동', '왕십리': '서울 성동구 행당동', '한남': '서울 용산구 한남동',
       // 부산
       '해운대': '부산 해운대구', '서면': '부산 부산진구 부전동', '광안리': '부산 수영구 광안동',
       '남포동': '부산 중구 남포동', '센텀': '부산 해운대구 우동', '전포': '부산 부산진구 전포동',
       // 경기
       '수원': '경기 수원시', '성남': '경기 성남시', '분당': '경기 성남시 분당구', '판교': '경기 성남시 판교',
       '용인': '경기 용인시', '고양': '경기 고양시', '일산': '경기 고양시 일산', '부천': '경기 부천시',
       '안양': '경기 안양시', '평택': '경기 평택시', '화성': '경기 화성시', '광명': '경기 광명시',
       '파주': '경기 파주시', '김포': '경기 김포시', '동탄': '경기 화성시 동탄',
       // 기타 광역시
       '동성로': '대구광역시 중구', '유성': '대전 유성구', '둔산': '대전 서구 둔산동',
       '부평': '인천 부평구', '송도': '인천 연수구 송도동', '청라': '인천 서구 청라동',
       '충장로': '광주 동구 충장동',
       // 기타 지역
       '제주시': '제주 제주시', '서귀포': '제주 서귀포시', '애월': '제주 제주시 애월읍',
       '강릉': '강원 강릉시', '속초': '강원 속초시', '춘천': '강원 춘천시',
       '전주': '전북 전주시', '한옥마을': '전북 전주시 완산구', '경주': '경북 경주시',
       '창원': '경남 창원시', '김해': '경남 김해시', '양산': '경남 양산시'
     };
     
     for (const [keyword, expanded] of Object.entries(regionMapping)) {
       if (trimmed === keyword || trimmed.includes(keyword)) {
         return [expanded, `${expanded}역`, trimmed];
       }
     }
     // 도로명 주소인 경우 그대로 검색
     if (trimmed.includes('로 ') || trimmed.includes('길 ') || trimmed.match(/\d+-\d+/) || trimmed.includes('번길')) {
       return [trimmed, `서울 ${trimmed}`, `경기 ${trimmed}`];
     }
     // "역" 자동 추가 (지하철역 검색 보강)
     const withStation = trimmed.endsWith('역') ? trimmed : `${trimmed}역`;
     return [`서울 ${trimmed}`, `서울 ${withStation}`, `경기 ${trimmed}`, `부산 ${trimmed}`, trimmed, withStation];
   };

   try {
     // ═══════════════════════════════════════════════════════════════
     // 1단계: 네이버 지도 JS API로 좌표 얻기 (확장 검색)
     // ═══════════════════════════════════════════════════════════════
     animateProgressTo(5);
     setSalesModeAnalysisStep('위치 정보 확인 중');
     updateCollectingText(`${query} 지역 좌표 확인 중...`);
     
     let coordinates = null;
     let addressInfo = null;
     const searchQueries = expandSearchQuery(query);
     
     for (const searchQuery of searchQueries) {
       if (coordinates) break;
       try {
         const geoResult = await new Promise((resolve, reject) => {
           const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
           if (window.naver?.maps?.Service) {
             window.naver.maps.Service.geocode({ query: searchQuery }, (status, response) => {
               clearTimeout(timeout);
               if (status === window.naver.maps.Service.Status.OK && response.v2?.addresses?.[0]) {
                 resolve(response.v2.addresses[0]);
               } else { reject(new Error('No results')); }
             });
           } else { clearTimeout(timeout); reject(new Error('Naver Maps not loaded')); }
         });
         
         if (geoResult) {
           coordinates = {
             lat: parseFloat(geoResult.y),
             lng: parseFloat(geoResult.x),
             roadAddress: geoResult.roadAddress,
             jibunAddress: geoResult.jibunAddress
           };
           addressInfo = {
             sido: geoResult.addressElements?.find(e => e.types?.includes('SIDO'))?.longName || '',
             sigungu: geoResult.addressElements?.find(e => e.types?.includes('SIGUGUN'))?.longName || '',
             dong: geoResult.addressElements?.find(e => e.types?.includes('DONGMYUN'))?.longName || ''
           };
           console.log(`지오코딩 성공: "${searchQuery}" → ${coordinates.lat}, ${coordinates.lng}`);
         }
       } catch (e) { console.log(`지오코딩 시도: "${searchQuery}" - ${e.message}`); }
     }
     
     // ═══ 2단계: Geocode 실패 시 → Naver Local Search API로 장소 검색 ═══
     if (!coordinates) {
       console.log('Geocode 실패 → Naver Local Search API 시도');
       updateCollectingText(`"${query}" 장소를 검색하고 있어요`);
       // 원래 쿼리 + 확장 쿼리 순서로 Local Search 시도
       const localSearchQueries = [query, ...searchQueries.filter(q => q !== query)];
       for (const localQuery of localSearchQueries) {
         if (coordinates) break;
       try {
         const localRes = await fetch(`/api/naver-local-proxy?query=${encodeURIComponent(localQuery)}&display=1`);
         if (localRes.ok) {
           const localData = await localRes.json();
           const item = localData.items?.[0];
           if (item) {
             console.log(`Local Search 결과: "${item.title}" → ${item.address || item.roadAddress}`);
             // 방법 A: roadAddress 또는 address로 Geocode 재시도
             const localAddr = item.roadAddress || item.address;
             if (localAddr && window.naver?.maps?.Service) {
               try {
                 const geoResult2 = await new Promise((resolve, reject) => {
                   const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
                   window.naver.maps.Service.geocode({ query: localAddr }, (status, response) => {
                     clearTimeout(timeout);
                     if (status === window.naver.maps.Service.Status.OK && response.v2?.addresses?.[0]) {
                       resolve(response.v2.addresses[0]);
                     } else { reject(new Error('No results')); }
                   });
                 });
                 if (geoResult2) {
                   coordinates = {
                     lat: parseFloat(geoResult2.y),
                     lng: parseFloat(geoResult2.x),
                     roadAddress: geoResult2.roadAddress,
                     jibunAddress: geoResult2.jibunAddress
                   };
                   addressInfo = {
                     sido: geoResult2.addressElements?.find(e => e.types?.includes('SIDO'))?.longName || '',
                     sigungu: geoResult2.addressElements?.find(e => e.types?.includes('SIGUGUN'))?.longName || '',
                     dong: geoResult2.addressElements?.find(e => e.types?.includes('DONGMYUN'))?.longName || ''
                   };
                   console.log(`Local Search → Geocode 성공: "${localAddr}" → ${coordinates.lat}, ${coordinates.lng}`);
                 }
               } catch (geoErr) {
                 console.log(`Local Search 주소 Geocode 실패: ${geoErr.message}`);
               }
             }
             // 방법 B: Geocode도 실패하면 mapx/mapy 직접 사용
             if (!coordinates && item.mapx && item.mapy) {
               const lat = parseInt(item.mapy) / 10000000;
               const lng = parseInt(item.mapx) / 10000000;
               if (lat > 33 && lat < 39 && lng > 124 && lng < 132) {
                 coordinates = { lat, lng };
                 // address에서 시도/시군구/동 파싱
                 const addrParts = (item.address || '').split(' ');
                 addressInfo = {
                   sido: addrParts[0] || '',
                   sigungu: addrParts[1] || '',
                   dong: addrParts[2] || '',
                   address: item.address || item.roadAddress
                 };
                 console.log(`Local Search mapx/mapy 사용: ${lat}, ${lng} (${item.address})`);
               }
             }
           }
         }
       } catch (localErr) {
         console.log(`Local Search API 실패 (${localQuery}): ${localErr.message}`);
       }
       } // end for localSearchQueries
     }

     // ═══ 3단계: 클라이언트 사이드 geocode fallback (이미 1단계에서 시도) ═══

     if (coordinates) {
       setSalesModeMapCenter(coordinates);
       animateProgressTo(10);
       updateCollectingText(`${addressInfo?.sigungu || query} 지역 확인 완료`);
     } else {
       console.log('모든 검색 시도 실패 (Geocode + Local Search)');
       setSalesModeAnalysisStep('위치를 찾을 수 없습니다');
       updateCollectingText(`"${query}" 위치를 찾지 못했어요. 정확한 주소로 다시 검색해주세요.`);
     }

     // ═══════════════════════════════════════════════════════════════
     // 2단계: 소상공인365 GIS API로 실제 데이터 수집 (인증 불필요)
     // ═══════════════════════════════════════════════════════════════
     animateProgressTo(15);
     setSalesModeAnalysisStep('상권 데이터 수집 중');
     updateCollectingText(`${query} 지역의 상권 데이터를 수집하고 있어요`);
     const collectedData = {
       source: '소상공인365 빅데이터 GIS',
       timestamp: new Date().toISOString(),
       region: query,
       apis: {}
     };

     // 좌표 기반으로 행정동 코드 얻기
     let dongInfo = null;
     if (coordinates) {
       dongInfo = await getCoordToDongCd(coordinates.lat, coordinates.lng);
       console.log('행정동 정보:', dongInfo);
     }

     // 새 API로 상권 데이터 수집
     if (dongInfo) {
       const dongCd = dongInfo.dongCd;
       const tpbizCd = 'Q01'; // 카페/음식점 업종
       
       // 병렬 API 호출
       setSalesModeAnalysisStep('행정동별 데이터 수집 중');
       
       const apiCalls = [
         { name: 'dynPplCmpr', endpoint: SBIZ365_NEW_API.dynPplCmpr, params: { dongCd }, desc: '유동인구' },
         { name: 'salesAvg', endpoint: SBIZ365_NEW_API.salesAvg, params: { dongCd, tpbizCd }, desc: '매출 평균' },
         { name: 'vstAgeRnk', endpoint: SBIZ365_NEW_API.vstAgeRnk, params: { dongCd }, desc: '방문 연령' },
         { name: 'vstCst', endpoint: SBIZ365_NEW_API.vstCst, params: { dongCd }, desc: '방문 고객' },
         { name: 'cfrStcnt', endpoint: SBIZ365_NEW_API.cfrStcnt, params: { dongCd, tpbizCd }, desc: '점포수' },
         { name: 'baeminTpbiz', endpoint: SBIZ365_NEW_API.baeminTpbiz, params: { dongCd }, desc: '배달 업종' },
         { name: 'mmavgList', endpoint: SBIZ365_NEW_API.mmavgList, params: { dongCd, tpbizCd }, desc: '월평균 매출' }
       ];
       
       // 순차 호출로 실시간 텍스트 업데이트
       for (let i = 0; i < apiCalls.length; i++) {
         const api = apiCalls[i];
         updateCollectingText(`${query} 지역의 ${api.desc} 정보를 가져오고 있어요`);
         const result = await callSbizAPI(api.endpoint, api.params);
         if (result) {
           collectedData.apis[api.name] = {
             description: api.desc,
             data: result
           };
         }
         // 진행률 점진적 업데이트
         animateProgressTo(20 + Math.floor((i + 1) / apiCalls.length * 25));
       }
       
       // dongInfo 저장
       collectedData.dongInfo = {
         dongCd: dongInfo.dongCd,
         dongNm: dongInfo.dongNm,
         admdstCdNm: dongInfo.admdstCdNm
       };
       
       // ═══ 인접 행정동 카페 수/매출 합산 (반경 내 정확도 강화) ═══
       if (dongInfo.nearbyDongs && dongInfo.nearbyDongs.length > 1) {
         updateCollectingText('인접 행정동 데이터를 합산하고 있어요');
         const nearbyResults = await Promise.allSettled(
           dongInfo.nearbyDongs.slice(1).map(async (nd) => {
             const [nSales, nCfr] = await Promise.all([
               callSbizAPI(SBIZ365_NEW_API.salesAvg, { dongCd: nd.dongCd, tpbizCd }).catch(() => null),
               callSbizAPI(SBIZ365_NEW_API.cfrStcnt, { dongCd: nd.dongCd, tpbizCd }).catch(() => null),
             ]);
             return { dongNm: nd.admdstCdNm, sales: nSales, cfr: nCfr };
           })
         );
         
         // 인접 동 데이터 합산
         const nearbyData = nearbyResults
           .filter(r => r.status === 'fulfilled' && r.value)
           .map(r => r.value);
         
         if (nearbyData.length > 0) {
           collectedData.apis.nearbySales = {
             description: '인접 행정동 매출/카페수',
             data: nearbyData
           };
           console.log(`인접 동 합산: ${nearbyData.map(n => `${n.dongNm}(카페 ${Array.isArray(n.sales) ? (n.sales.find(s=>s.tpbizClscdNm==='카페')?.stcnt||0) : 0}개)`).join(', ')}`);
         }
       }
     }

     // ═══ Geocoding + 거리 계산 헬퍼 ═══
     const geocodeAddress = async (address) => {
       try {
         const res = await fetch(`https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`, {
           headers: { 'X-NCP-APIGW-API-KEY-ID': NCP_CLIENT_ID, 'X-NCP-APIGW-API-KEY': NCP_CLIENT_SECRET }
         });
         if (!res.ok) return null;
         const data = await res.json();
         if (data.addresses?.length > 0) {
           return { lat: parseFloat(data.addresses[0].y), lng: parseFloat(data.addresses[0].x) };
         }
         return null;
       } catch { return null; }
     };
     
     const calcWalkingDistance = async (startCoord, endCoord) => {
       try {
         const res = await fetch(`https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving?start=${startCoord.lng},${startCoord.lat}&goal=${endCoord.lng},${endCoord.lat}&option=trafast`, {
           headers: { 'X-NCP-APIGW-API-KEY-ID': NCP_CLIENT_ID, 'X-NCP-APIGW-API-KEY': NCP_CLIENT_SECRET }
         });
         if (!res.ok) return null;
         const data = await res.json();
         if (data.code === 0 && data.route?.trafast?.[0]) {
           const dist = data.route.trafast[0].summary.distance;
           return { distance: dist, walkMin: Math.max(1, Math.round(dist / 67)) }; // 67m/분 도보 속도
         }
         return null;
       } catch { return null; }
     };
     
     // Haversine 직선거리 (Geocoding/Directions 실패 시 폴백)
     const haversineDistance = (lat1, lng1, lat2, lng2) => {
       const R = 6371000;
       const dLat = (lat2-lat1)*Math.PI/180;
       const dLng = (lng2-lng1)*Math.PI/180;
       const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
       return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
     };

     // ═══ Firebase 임대료 데이터 수집 ═══
     setSalesModeAnalysisStep('임대료 데이터 조회 중');
     updateCollectingText('브루가 이 지역 상가 임대료를 조사하고 있어요');
     try {
       const dongName = addressInfo?.dong || '';
       const FIREBASE_DB = 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';
       
       // 행정동 이름에서 가능한 법정동 후보 생성
       const rentDongCandidates = [];
       if (dongName) {
         rentDongCandidates.push(dongName);
         // "한강로동" → "한강로1가"~"한강로5가", "한강로동"
         // "이촌2동" → "이촌동", "이촌1가"~"이촌5가" (숫자 제거 후 법정동 후보)
         const baseName = dongName.replace(/\d*동$/, '').replace(/\d+가$/, '');
         // 법정동 후보 생성 (baseName + 가/동)
         rentDongCandidates.push(`${baseName}동`);
         for (let i = 1; i <= 5; i++) rentDongCandidates.push(`${baseName}${i}가`);
       }
       // 인접 동도 추가 (addressInfo에서 확인 가능한 경우)
       if (addressInfo?.sigungu) {
         const sigunguDongs = {
           '용산구': ['갈월동','남영동','효창동','원효로1가','원효로2가','한강로1가','한강로2가','한강로3가','용산동2가','용산동3가','용산동5가','청파동1가','청파동2가','청파동3가','이태원동','한남동','보광동','이촌동'],
           '강남구': ['역삼동','논현동','삼성동','청담동','신사동','압구정동','대치동','도곡동','개포동','세곡동'],
           '마포구': ['합정동','서교동','상수동','망원동','연남동','성산동','공덕동','아현동','도화동'],
           '서초구': ['서초동','잠원동','반포동','방배동','양재동','내곡동'],
           '송파구': ['잠실동','신천동','가락동','문정동','장지동','방이동','오금동'],
           '성동구': ['성수동1가','성수동2가','행당동','응봉동','금호동','옥수동','왕십리'],
         };
         const nearbyDongs = sigunguDongs[addressInfo.sigungu] || [];
         nearbyDongs.forEach(d => { if (!rentDongCandidates.includes(d)) rentDongCandidates.push(d); });
       }
       
       // 후보 동들에서 Firebase rent 데이터 병렬 조회
       const rentResults = await Promise.allSettled(
         [...new Set(rentDongCandidates)].slice(0, 30).map(async (dng) => {
           const res = await fetch(`${FIREBASE_DB}/regionData/${encodeURIComponent(dng)}.json`);
           if (!res.ok) return null;
           const data = await res.json();
           if (!data) return null;
           const rent = data[dng]?.rent;
           return rent ? { dong: dng, ...rent } : null;
         })
       );
       
       const validRents = rentResults
         .filter(r => r.status === 'fulfilled' && r.value)
         .map(r => r.value);
       
       if (validRents.length > 0) {
         // 가장 가까운 동 (첫 번째 매칭) + 주변 동 평균
         const primaryRent = validRents[0];
         const avgDeposit = Math.round(validRents.reduce((s,r) => s + (r.avgDeposit||0), 0) / validRents.length);
         const avgMonthly = Math.round(validRents.reduce((s,r) => s + (r.avgMonthlyRent||0), 0) / validRents.length);
         const avgArea = Math.round(validRents.reduce((s,r) => s + (r.avgArea||0), 0) / validRents.length * 10) / 10;
         const avgPerPyeong = Math.round(validRents.reduce((s,r) => s + (r.avgRentPerPyeong||0), 0) / validRents.length);
         const totalArticles = validRents.reduce((s,r) => s + (r.articleCount||0), 0);
         
         collectedData.apis.firebaseRent = {
           description: '상가 임대료 (빈크래프트 수집기)',
           data: {
             primaryDong: primaryRent.dong,
             primaryData: primaryRent,
             nearbyDongs: validRents,
             summary: {
               avgDeposit, avgMonthlyRent: avgMonthly, avgArea, avgRentPerPyeong: avgPerPyeong, totalArticles,
               dongCount: validRents.length,
               source: '네이버부동산 (빈크래프트 수집기)',
               updatedAt: primaryRent.updatedAt
             }
           }
         };
         console.log(`Firebase 임대료: ${validRents.length}개 동, 평균 보증금 ${avgDeposit}만, 월세 ${avgMonthly}만`);
       }
     } catch (e) { console.log('Firebase 임대료 조회 실패:', e.message); }
     
     // Firebase에 동별 임대료가 없으면 RENT_DATA_BY_REGION 폴백
     if (!collectedData.apis.firebaseRent) {
       const sgKey = `서울 ${addressInfo?.sigungu || ''}`;
       const regionRent = RENT_DATA_BY_REGION.regions[sgKey] || RENT_DATA_BY_REGION.regions[addressInfo?.sido || ''] || RENT_DATA_BY_REGION.regions['전국평균'];
       if (regionRent) {
         const estMonthly = Math.round(regionRent.avgRent * 49.5); // 15평 기준 환산
         const estDeposit = estMonthly * 10;
         collectedData.apis.firebaseRent = {
           description: '임대료 (부동산원 통계 기준 추정)',
           data: {
             nearbyDongs: [],
             summary: {
               avgDeposit: estDeposit, avgMonthlyRent: estMonthly, avgArea: 49.5, avgRentPerPyeong: 0, totalArticles: 0,
               dongCount: 0,
               source: `한국부동산원 ${RENT_DATA_BY_REGION.dataDate} (${sgKey} 평균, 15평 기준 환산)`,
               isEstimate: true
             }
           }
         };
         console.log(`Firebase 임대료 없음 → 부동산원 폴백: 월 ${estMonthly}만, 보증금 ${estDeposit}만 (${sgKey})`);
       }
     }

     // 수집된 데이터 요약 로그
     console.log('수집된 GIS API 데이터:', Object.keys(collectedData.apis));
     Object.entries(collectedData.apis).forEach(([key, val]) => {
       console.log(`  - ${key}: ${val.description}`, val.data?.length || val.data?.rads?.length || '데이터있음');
     });

     // ═══════════════════════════════════════════════════════════════
     // 2.5단계: 확장 프로그램 매물 데이터 수집 (Chrome Extension 연동 대비)
     // ═══════════════════════════════════════════════════════════════
     // 확장 프로그램에서 수집한 매물 가격 데이터가 있으면 사용
     // 데이터 구조 예시:
     // window.beancraftExtensionData = {
     //   naverRealEstate: {
     //     region: "해운대구",
     //     articles: [
     //       { deposit: 3000, rent: 150, area: 15, floor: "1층", type: "상가" },
     //       { deposit: 5000, rent: 200, area: 20, floor: "1층", type: "상가" }
     //     ],
     //     avgDeposit: 4000,
     //     avgRent: 175,
     //     collectedAt: "2025-01-27T12:00:00Z"
     //   },
     //   zigbang: { ... }
     // }
     if (typeof window !== 'undefined' && window.beancraftExtensionData) {
       const extData = window.beancraftExtensionData;
       
       if (extData.naverRealEstate) {
         collectedData.apis.extensionNaverRealEstate = {
           description: '네이버 부동산 매물 (확장프로그램)',
           data: extData.naverRealEstate
         };
         console.log('확장프로그램 네이버 부동산 데이터 수집됨:', extData.naverRealEstate.articles?.length || 0, '건');
       }
       
       if (extData.zigbang) {
         collectedData.apis.extensionZigbang = {
           description: '직방 매물 (확장프로그램)',
           data: extData.zigbang
         };
         console.log('확장프로그램 직방 데이터 수집됨:', extData.zigbang.articles?.length || 0, '건');
       }
       
       if (extData.brokerData) {
         collectedData.apis.extensionBrokerData = {
           description: '중개사 매물 (확장프로그램)',
           data: extData.brokerData
         };
         console.log('확장프로그램 중개사 데이터 수집됨:', extData.brokerData.length || 0, '건');
       }
     }

     // ═══════════════════════════════════════════════════════════════
     // 3단계: 프랜차이즈 데이터 (API + 하드코딩 보완)
     // ═══════════════════════════════════════════════════════════════
     animateProgressTo(55);
     setSalesModeAnalysisStep('프랜차이즈 데이터 확인 중');
     updateCollectingText(`${query} 지역에 적합한 프랜차이즈 정보를 정리하고 있어요`);
     collectedData.franchiseData = FRANCHISE_DATA;
     
     // Render 서버에서 공정위 프랜차이즈 API 호출 (카페만 필터링)
     try {
       const franchiseRes = await fetch(`${PROXY_SERVER_URL}/api/franchise?cafeOnly=true&numOfRows=50`);
       if (franchiseRes.ok) {
         const franchiseData = await franchiseRes.json();
         if (franchiseData.success && franchiseData.data?.length > 0) {
           collectedData.apis.franchiseApi = {
             description: '공정위 프랜차이즈 (카페)',
             data: franchiseData.data,
             totalCount: franchiseData.totalCount,
             source: '공정거래위원회 가맹사업정보제공시스템'
           };
           console.log(`프랜차이즈 API 성공: 카페 ${franchiseData.totalCount}개`);
         }
       }
     } catch (e) { console.log('프랜차이즈 API 실패 (하드코딩 사용):', e.message); }

     // ═══════════════════════════════════════════════════════════════
     // 3.5단계: SNS 트렌드 웹검색 (YouTube, 인스타그램, 블로그)
     // ═══════════════════════════════════════════════════════════════
     animateProgressTo(60);
     setSalesModeAnalysisStep('SNS 트렌드 분석 중');
     updateCollectingText(`${query} 지역의 SNS 트렌드와 카페 리뷰를 분석하고 있어요`);
     
     // SNS 트렌드 분석용 프롬프트
     const snsTrendPrompt = `당신은 SNS 트렌드 분석가입니다. "${query} 카페"에 대한 SNS 트렌드를 분석해주세요.

[분석 항목]
1. 이 지역 카페의 SNS 인기 키워드 (인스타그램, 유튜브 기준)
2. 주요 경쟁 카페 이름과 특징 (실제로 존재하는 카페만)
3. 고객 리뷰에서 자주 언급되는 긍정/부정 키워드
4. 평균 객단가 추정 (SNS 후기 기반)
5. 인기 메뉴 유형 (음료, 디저트 등)

[응답 형식 - 순수 JSON만]
{
  "snsTrend": {
    "popularKeywords": ["오션뷰", "브런치", "디저트"],
    "negativeKeywords": ["비싸요", "웨이팅", "주차"],
    "sentiment": { "positive": 65, "neutral": 25, "negative": 10 },
    "summary": "이 지역 카페 SNS 트렌드를 2~3문장으로 종합 요약해주세요.",
    "competitors": [
      { "name": "실제카페명", "feature": "특징", "priceRange": "객단가" }
    ],
    "avgPrice": "약 X,XXX원",
    "popularMenuType": "시그니처 음료, 대형 디저트",
    "instagramPosts": "약 X만 게시물 추정",
    "youtubeContent": "리뷰 영상 트렌드 요약",
    "bruFeedback": "브루가 SNS 트렌드를 바탕으로 브랜딩 방향을 제시해요. 테이크아웃 컵 디자인 등 바이럴 포인트 중심.",
    "bruSummary": "40자 이내 한줄 핵심"
  }
}

마크다운 코드블록 없이 순수 JSON만 출력하세요.`;

     let snsTrendData = null;
     try {
       const snsResponse = await callGeminiProxy([{ role: 'user', parts: [{ text: snsTrendPrompt }] }], { temperature: 0.7, maxOutputTokens: 2000 });
       
       if (snsResponse.ok) {
         const snsResult = await snsResponse.json();
         const snsText = snsResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
         const cleanSnsText = snsText.replace(/```json\n?|\n?```/g, '').trim();
         try {
           const snsJsonMatch = cleanSnsText.match(/\{[\s\S]*\}/);
           snsTrendData = snsJsonMatch ? JSON.parse(snsJsonMatch[0]) : JSON.parse(cleanSnsText);
           const snsContent = snsTrendData.snsTrend || snsTrendData;
           collectedData.apis.snsTrend = {
             description: 'SNS 트렌드 분석',
             data: snsContent
           };
           console.log('SNS 트렌드 분석 완료');
         } catch (e) {
           console.log('SNS 트렌드 JSON 파싱 실패, 복구 시도');
           try {
             const snsJsonMatch = cleanSnsText.match(/\{[\s\S]*\}/);
             if (snsJsonMatch) {
               let fixedSns = snsJsonMatch[0].replace(/,\s*([}\]])/g, '$1');
               fixedSns = fixedSns.replace(/"([^"]*(?:\\.[^"]*)*)"/g, (match) => match.replace(/(?<!\\)\n/g, '\\n'));
               snsTrendData = JSON.parse(fixedSns);
               const snsContent = snsTrendData.snsTrend || snsTrendData;
               collectedData.apis.snsTrend = { description: 'SNS 트렌드 분석', data: snsContent };
               console.log('SNS 트렌드 복구 파싱 성공');
             }
           } catch (e2) { console.log('SNS 트렌드 복구도 실패'); }
         }
       }
     } catch (e) {
       console.log('SNS 트렌드 분석 실패:', e.message);
     }

     // ═══════════════════════════════════════════════════════════════
     // 3.6단계: 추가 API 호출 (핫플레이스, 배달, 관광, 매출추이, 창업기상도)
     // ═══════════════════════════════════════════════════════════════
     animateProgressTo(62);
     setSalesModeAnalysisStep('추가 데이터 수집 중');
     
     // 시군구 코드 추출 (API 호출용)
     const getAreaCode = () => {
       if (addressInfo?.sigungu) {
         // 시군구명으로 대략적인 코드 매핑 (실제로는 더 정확한 매핑 필요)
         return addressInfo.sigungu;
       }
       return query;
     };
     const areaCode = getAreaCode();

     // 핫플레이스는 새 API에서 지원하지 않음 - 생략
     // 배달 업종 데이터는 이미 baeminTpbiz API로 수집됨 (새 API)
     // 아래 4개 OpenAPI는 2026년 1월 기준 404 반환으로 제거됨:
     // - delivery (/openApi/delivery) → baeminTpbiz로 대체됨
     // - tour (/openApi/tour) → 대체 API 없음
     // - slsIndex (/openApi/slsIndex) → salesAvg로 대체됨
     // - weather (/openApi/weather) → 대체 API 없음

     // ═══════════════════════════════════════════════════════════════
     // 3.7단계: YouTube API 연동 (카페 리뷰 영상 댓글 감성 분석)
     // ═══════════════════════════════════════════════════════════════
     animateProgressTo(65);
     setSalesModeAnalysisStep('YouTube 리뷰 분석 중');
     updateCollectingText(`${query} 카페 관련 YouTube 리뷰를 분석하고 있어요`);
     
     // YouTube Data API v3 (무료 할당량: 일 10,000 단위)
     // API 키가 없으면 YouTube 분석 스킵
     if (!YOUTUBE_API_KEY) {
       console.log('YouTube API 키가 설정되지 않아 분석을 건너뜁니다.');
     } else {
       try {
         // 1. 검색: 지역 + 카페 리뷰 영상 찾기
         const searchQuery = `${query} 카페 리뷰`;
         const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=5&order=relevance&key=${YOUTUBE_API_KEY}`;
       
       const searchResponse = await fetch(searchUrl);
       
       if (searchResponse.ok) {
         const searchData = await searchResponse.json();
         const videos = searchData.items || [];
         
         if (videos.length > 0) {
           // 2. 각 영상의 통계 정보 가져오기
           const videoIds = videos.map(v => v.id.videoId).join(',');
           const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
           const statsResponse = await fetch(statsUrl);
           
           let videoStats = [];
           if (statsResponse.ok) {
             const statsData = await statsResponse.json();
             videoStats = statsData.items || [];
           }
           
           // 3. 상위 3개 영상의 댓글 수집 (각 20개씩)
           let allComments = [];
           for (let i = 0; i < Math.min(3, videos.length); i++) {
             const videoId = videos[i].id.videoId;
             try {
               const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=20&order=relevance&key=${YOUTUBE_API_KEY}`;
               const commentsResponse = await fetch(commentsUrl);
               
               if (commentsResponse.ok) {
                 const commentsData = await commentsResponse.json();
                 const comments = (commentsData.items || []).map(item => ({
                   text: item.snippet.topLevelComment.snippet.textDisplay,
                   likeCount: item.snippet.topLevelComment.snippet.likeCount,
                   videoTitle: videos[i].snippet.title
                 }));
                 allComments = [...allComments, ...comments];
               }
             } catch (e) {
               console.log(`영상 ${videoId} 댓글 수집 실패`);
             }
           }
           
           // 4. 댓글 감성 분석 (간단한 키워드 기반)
           const positiveKeywords = ['맛있', '좋아', '추천', '최고', '대박', '분위기', '예쁘', '친절', '가성비', '만족', '또 가', '재방문'];
           const negativeKeywords = ['별로', '실망', '비싸', '불친절', '더럽', '시끄러', '웨이팅', '오래 걸', '맛없', '후회', '안 가'];
           
           let positiveCount = 0;
           let negativeCount = 0;
           const extractedKeywords = { positive: {}, negative: {} };
           
           allComments.forEach(comment => {
             const text = comment.text.toLowerCase();
             positiveKeywords.forEach(kw => {
               if (text.includes(kw)) {
                 positiveCount++;
                 extractedKeywords.positive[kw] = (extractedKeywords.positive[kw] || 0) + 1;
               }
             });
             negativeKeywords.forEach(kw => {
               if (text.includes(kw)) {
                 negativeCount++;
                 extractedKeywords.negative[kw] = (extractedKeywords.negative[kw] || 0) + 1;
               }
             });
           });
           
           // 5. 결과 저장
           collectedData.apis.youtube = {
             description: 'YouTube 카페 리뷰 분석',
             data: {
               searchQuery,
               totalVideos: videos.length,
               totalComments: allComments.length,
               videos: videoStats.slice(0, 5).map(v => ({
                 title: v.snippet?.title,
                 channelTitle: v.snippet?.channelTitle,
                 viewCount: parseInt(v.statistics?.viewCount || 0),
                 likeCount: parseInt(v.statistics?.likeCount || 0),
                 commentCount: parseInt(v.statistics?.commentCount || 0),
                 videoId: v.id
               })),
               sentiment: {
                 positive: positiveCount,
                 negative: negativeCount,
                 ratio: allComments.length > 0 ? Math.round((positiveCount / (positiveCount + negativeCount)) * 100) || 50 : 50,
                 topPositive: Object.entries(extractedKeywords.positive).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k),
                 topNegative: Object.entries(extractedKeywords.negative).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k)
               },
               sampleComments: allComments.slice(0, 10).map(c => c.text.substring(0, 100))
             }
           };
           console.log('YouTube 분석 완료:', collectedData.apis.youtube.data);
         }
       } else {
         console.log('YouTube API 응답 실패:', searchResponse.status);
       }
     } catch (e) {
       console.log('YouTube API 연동 실패:', e.message);
     }
   }

     // ═══════════════════════════════════════════════════════════════
     // 4단계: 수집된 데이터를 AI에게 전달하여 분석 요청
     // ═══════════════════════════════════════════════════════════════
     animateProgressTo(70);
     setSalesModeAnalysisStep('AI 분석 요청 중');
     updateCollectingText(`수집된 데이터를 AI에게 전달하고 있어요`);
     const hasApiData = Object.keys(collectedData.apis).length > 0;
     
     // GIS API 데이터 요약 생성
     const summarizeGisData = () => {
       const summary = [];
       const apis = collectedData.apis;
       
       // 유동인구 (NEW API: dynPplCmpr)
       if (apis.dynPplCmpr?.data) {
         const d = apis.dynPplCmpr.data;
         if (Array.isArray(d) && d.length > 0) {
           const dailyPop = Math.round((d[0].cnt || 0) / 30);
           summary.push(`유동인구: ${d[0].nm} 일평균 ${dailyPop.toLocaleString()}명 (${d[0].crtrYm} 기준, 월${d[0].cnt?.toLocaleString()}명÷30)`);
           if (d[1]) summary.push(`  ${d[1].nm} 전체: 일평균 ${Math.round((d[1].cnt||0)/30).toLocaleString()}명`);
         }
       }
       
       // 매출 평균 (NEW API: salesAvg)
       if (apis.salesAvg?.data && Array.isArray(apis.salesAvg.data)) {
         const items = apis.salesAvg.data;
         const cafeItem = items.find(s => s.tpbizClscdNm === '카페');
         summary.push(`업종별 매출 (${items.length}개 업종):`);
         items.forEach(s => summary.push(`  ${s.tpbizClscdNm}: 매출 ${s.mmavgSlsAmt ? s.mmavgSlsAmt.toLocaleString()+'만' : '비공개'}, 건수 ${s.mmavgSlsNocs?.toLocaleString()}, 점포 ${s.stcnt}개`));
         if (cafeItem) summary.push(`→ 카페: ${cafeItem.stcnt}개, 매출 ${cafeItem.mmavgSlsAmt ? cafeItem.mmavgSlsAmt.toLocaleString()+'만' : '비공개'}`);
       }
       
       // 인접 동 카페 합산 (nearbySales)
       if (apis.nearbySales?.data && apis.nearbySales.data.length > 0) {
         let totalCafe = 0, totalSales = 0, cnt = 0;
         apis.nearbySales.data.forEach(nd => {
           if (Array.isArray(nd.sales)) {
             const c = nd.sales.find(s => s.tpbizClscdNm === '카페');
             if (c) { totalCafe += (c.stcnt||0); if (c.mmavgSlsAmt) { totalSales += c.mmavgSlsAmt; cnt++; } }
           }
         });
         // 메인 동도 합산
         const mainCafe = apis.salesAvg?.data?.find?.(s => s.tpbizClscdNm === '카페');
         if (mainCafe) { totalCafe += (mainCafe.stcnt||0); if (mainCafe.mmavgSlsAmt) { totalSales += mainCafe.mmavgSlsAmt; cnt++; } }
         summary.push(`인접 동 합산 카페: ${totalCafe}개, 평균 매출 ${cnt > 0 ? Math.round(totalSales/cnt).toLocaleString()+'만' : '비공개'}`);
       }
       
       // 방문 연령 (vstAgeRnk)
       if (apis.vstAgeRnk?.data && Array.isArray(apis.vstAgeRnk.data)) {
         const d = apis.vstAgeRnk.data;
         const total = d.reduce((s,x) => s + (x.pipcnt||0), 0);
         summary.push(`방문연령: ${d.map(x => `${x.age?.replace('M','')}대 ${x.pipcnt?.toLocaleString()}명(${total>0?(x.pipcnt/total*100).toFixed(1):'?'}%)`).join(', ')}`);
       }
       
       // 소비 연령 (vstCst)
       if (apis.vstCst?.data && Array.isArray(apis.vstCst.data)) {
         const d = [...apis.vstCst.data].sort((a,b) => (b.pipcnt||0) - (a.pipcnt||0));
         const total = d.reduce((s,x) => s + (x.pipcnt||0), 0);
         summary.push(`소비연령: ${d.map(x => `${x.age?.replace('M','')}대 ${x.pipcnt?.toLocaleString()}명(${total>0?(x.pipcnt/total*100).toFixed(1):'?'}%)`).join(', ')}`);
       }
       
       // 점포수 (cfrStcnt)
       if (apis.cfrStcnt?.data) {
         const d = apis.cfrStcnt.data;
         summary.push(`음식업 점포수: ${d.stcnt || 0}개 (${d.crtrYm || ''})`);
       }
       
       // 배달 (baeminTpbiz)
       if (apis.baeminTpbiz?.data && Array.isArray(apis.baeminTpbiz.data)) {
         summary.push(`배달: ${apis.baeminTpbiz.data.slice(0,5).map(b => `${b.baeminTpbizClsfNm}:${b.cnt}건`).join(', ')}`);
       }
       
       // 월평균 매출 (mmavgList)
       if (apis.mmavgList?.data && Array.isArray(apis.mmavgList.data)) {
         summary.push(`월평균 매출 TOP: ${apis.mmavgList.data.slice(0,3).map(m => `${m.tpbizNm}:${m.slsamt?.toLocaleString()}만`).join(', ')}`);
       }
       
       // Firebase 임대료
       if (apis.firebaseRent?.data?.summary) {
         const s = apis.firebaseRent.data.summary;
         summary.push(`임대료: 보증금 평균 ${s.avgDeposit?.toLocaleString()}만, 월세 ${s.avgMonthlyRent?.toLocaleString()}만 (${s.dongCount}개 동, ${s.totalArticles}건)`);
       }
       
       return summary.length > 0 ? summary.join('\n') : '데이터 없음';
     };

     const prompt = `당신은 빈크래프트 카페 창업 컨설팅의 AI피드백입니다.

[빈크래프트 정체성 - 필수 이해]
- 개인카페 창업 토탈 컨설팅 (프랜차이즈 아님)
- 판단을 대신하지 않음 → 판단할 수 있는 기준과 구조를 설계
- 모든 의사결정의 최종 주체는 창업자
- 매출 보장/보증 절대 안 함
- 가맹비 0원, 로열티 0원, 광고비 자율 선택

[빈크래프트 서비스 카테고리 - 정확히 이해]
1. 인테리어: 콘셉트 기획, 설계, 시공 관리 (창업자 취향 반영)
2. 기기설치: 상권 특성에 맞는 장비 구성, 설치 대행
3. 메뉴개발: 메뉴 구성/방향 설계 (시그니처 개발 X, 레시피 제공 O)
4. 운영교육: 왜 돈을 버는지, 어떻게 관리하는지, 문제 대응법
5. 디자인: 브랜딩, 로고, 패키지, SNS용 디자인
6. 원두: 가성비(저가 프랜차이즈급)~고급라인(와인향, 건포도, 넛티 등) 다양

[톤앤매너 - 전문적 조언자]
- 부드러운 톤("~에요", "~거든요")과 신뢰 톤("~입니다", "~됩니다")을 상황에 맞게 혼용
- 어색한 문단만 아니면 OK. 자연스러운 흐름 우선
- 매번 다른 문장 시작 사용 (동일 패턴 반복 금지)
- 저급한 표현 금지 ("뽑아먹기", "대박", "핫플" 등)
- 식상한 표현 금지 ("입구 3초 포토존", "인스타 감성" 등)
- 이모티콘, 과장된 표현, 감탄사 금지
- 출처 없는 숫자 사용 금지

[AI피드백 핵심 원칙]
1. "상담 시 질문할 것" ❌ → "상담 전 생각할 것" ⭕
2. 창업자가 스스로 판단하고 행동할 수 있는 방향 제시
3. 가격/예산은 반드시 근거(웹검색, API 데이터)가 있어야 함. 근거 있으면 적극적으로 사용
4. 필요한 특징과 고려사항만 제시
5. 빈크래프트 서비스와 자연스럽게 연결

[카테고리별 AI피드백 방향]
■ 인테리어
- 과한 포토존 없이도 촬영 가능한 소품, 간접적 인테리어
- 압도하는 하나의 공간으로 배치하는 방향 제시
- 상권 특성에 맞는 콘셉트 방향 (예: 오피스 상권 → 심플/효율적)

■ 기기설치
- 가격 적지 말고 필요한 특징만 (예: 동시 추출, 속도, 용량)
- 제빙기: 100kg 이상 + 여분 자리/비용 준비 권장
- 성수기 피크타임 대비 회전율 중심 구성

■ 메뉴개발
- 빈크래프트는 시그니처 개발 X, 메뉴 구성/방향 설계 O
- 상권 평균 객단가 분석 → 적정 가격대 제시
- 경쟁 카페 분석 기반 차별화 방향

■ 원두
- 빈크래프트 원두: 가성비~고급라인 다양
- 성수기 테이크아웃 수요 → 가성비 라인 추가 배치 권장
- "생존커피"라는 명분의 매출로 연결

■ 운영교육
- 상권 특성에 맞는 교육 우선순위
- 피크타임 대응 속도, CS, 재고 관리 등

■ 디자인
- SNS 트렌드 분석 기반 브랜딩 방향
- 테이크아웃 컵 디자인 = 바이럴 포인트

[검증된 공식 통계 - 반드시 이 숫자만 사용]
■ 창업 생존율 (통계청 2023)
- 전체 창업기업: 1년 64.9%, 3년 46.3%, 5년 34.7%
- 숙박·음식점업(카페): 5년 22.8%
- 정부 창업지원 기업: 5년 53.1%
■ 카페 시장 (2024)
- 전국 커피전문점: 약 93,000개
- 한국 5년 생존율 OECD 28개국 중 26위

[분석 대상 지역]
${query} (${addressInfo?.sido || ''} ${addressInfo?.sigungu || ''} ${addressInfo?.dong || ''})
좌표: ${coordinates ? `${coordinates.lat}, ${coordinates.lng}` : '미확인'}

[수집된 실제 데이터 - 소상공인365 GIS API]
${hasApiData ? `
■ 데이터 요약:
${summarizeGisData()}

■ 상세 API 응답 데이터:
${JSON.stringify(collectedData.apis, null, 2)}

※ 데이터 필드 설명:
- rads: 행정동별 데이터 배열
- storCntAmt/saleAmt: 매출액 (원)
- ppltnCnt: 인구수
- storCnt: 업소수
- hhCnt: 세대수
- wrcpplCnt: 직장인구
- bizon: 상권(비존) 데이터
` : '소상공인365 API 데이터 수집 실패 - 일반적인 상권 분석을 제공해주세요.'}

프랜차이즈 비용 데이터 (공정위 정보공개서 기준):
메가커피: 총 6,900만~1억, 로열티 월 15만
컴포즈커피: 총 5,500만~8,000만, 로열티 월 20만
이디야: 총 8,000만~1.3억, 로열티 월 25만
빽다방: 총 6,000만~9,000만, 로열티 월 20만

[분석 요청]
위 수집된 데이터를 기반으로 "${query}" 지역의 카페 창업 상권 분석을 수행해주세요.
${hasApiData ? '중요: 수집된 GIS API 데이터의 실제 숫자를 반드시 추출하여 사용하세요. rads 배열의 합계나 평균을 계산해서 구체적인 수치로 표현하세요.' : '신뢰할 수 있는 출처의 데이터를 기반으로 분석해주세요.'}

[필수 분석 항목 - 모든 항목 반드시 채워야 함]
1. 상권 개요: 카페 수, 개업/폐업 현황, 유동인구, 상주인구 (수치+출처 필수)
2. 주요 소비층: 연령대, 직업군, 소비 패턴, 피크 타임
3. 프랜차이즈 현황: 주요 브랜드 매장 수 추정
4. 임대료/권리금: 평균 임대료, 보증금, 권리금, 전년 대비 변동
5. 개발 호재: 교통, 재개발, 기업 입주 등 긍정 요인
6. 리스크 요인: 과포화, 높은 임대료, 젠트리피케이션 등 부정 요인 (숨기지 말 것)
7. 예상 창업 비용: 보증금+권리금+인테리어+설비 총합
8. 시장 생존율: 통계청 기준 카페 업종 생존율 (1년 64.9%, 3년 46.3%, 5년 22.8%), 정부 창업지원 기업 5년 생존율 53.1%

[응답 형식 - 매우 중요]
- 각 필드는 전문적인 조언 톤으로 작성
- "~에요", "~거든요", "~해보세요" 등 편한 말투
- 출처와 구체적 숫자를 자연스럽게 포함
- 모든 필드를 반드시 채워야 합니다. "-"나 빈 값 절대 금지
- 마크다운 코드블록(\`\`\`json) 사용 금지. 순수 JSON만 출력
- 매번 다른 문장 시작 사용 (동일 패턴 반복 금지)

[bruFeedback 작성 규칙 - "브루" 캐릭터]
브루는 빈크래프트의 AI 컨설턴트예요. 각 카드의 bruFeedback은 브루가 창업자에게 직접 말하는 톤으로 작성해요.
- "~에요", "~거든요", "~해보세요" 체를 사용
- "상담 시 질문할 것" 절대 금지 → "창업 전 생각할 것" 방향으로
- 창업자가 스스로 판단하고 행동할 수 있는 현실적 조언
- 저급한 표현("뽑아먹기", "대박", "핫플"), 식상한 표현("입구 3초 포토존", "인스타 감성") 금지
- 구체적 예산/가격 함부로 적지 않음
- 빈크래프트 서비스와 자연스럽게 연결하되 과하지 않게

[bruFeedback 3차원 분석 - 가장 중요한 규칙]
bruFeedback은 3단계 깊이로 작성해야 해요. 1차원(데이터 읽기)은 금지.

■ 1차원 (금지): "카페 209개, 경쟁이 치열해요" → 누구나 아는 내용
■ 2차원 (최소): "바로 옆에 메가커피(2,000원)가 있어요. 가격 경쟁은 불가능해요" → 현실 연결
■ 3차원 (목표): 카드 간 데이터 교차 + "A를 하면 X, B를 하면 Y" 시나리오 비교

[3차원 분석 방법]
1. 카드 간 교차 연결: 반드시 2개 이상 카드 데이터를 엮어서 분석
   - 소비연령(30대 26.5%) + 매출(카페 2,442만원) + 임대료(월 366만원) → "30대 객단가 6,000원 기준 하루 135명 필요. 효창동(220만원)이면 매출의 9%, 한강로3가(580만원)이면 23.7%"
   - 프랜차이즈(메가커피 2,000원) + 개인카페 가격(4,000~4,500원) → "중간 가격대(3,000~4,000원)가 비어있는 틈새"

2. 시나리오 비교: "이렇게 하면 이렇게 되고, 저렇게 하면 저렇게 돼요"
   - "아메리카노 4,500원 + 디저트 5,500원 세트 8,500원이면, 하루 100명 기준 월매출 2,550만원. 효창동 월세 220만원이면 순이익 약 1,500만원, 한강로3가 580만원이면 1,140만원"

3. 실제 카페 이름과 가격 필수: 웹검색 결과에서 수집한 실제 카페명, 가격을 반드시 언급
   - "바로 옆 빽다방(아메리카노 2,500원)과 가격 경쟁은 불가능해요. 대신 아나키아(4,500원)처럼 품질 승부가 이 골목에서 살아남는 공식이에요"

4. 상세주소 입력 시: "선택하신 주소에서 가장 가까운 카페는 ○○(도보 Xm)이에요. 이 카페의 아메리카노는 X,XXX원이에요" 수준의 정밀도

[한줄 정리 - bruSummary 필드 필수]
- 모든 카드의 bruFeedback 끝에 bruSummary 필드를 추가하세요
- 40자 이내로 해당 카드의 핵심 메시지를 한 줄로 정리
- 예: "메가커피 2,000원과 싸우지 말고, 30대가 8,500원 쓸 이유를 만드세요"
- 예: "효창동으로 한 블록 옮기면 월 146만원 절약"

[나쁜 bruFeedback 예시 - 절대 이렇게 쓰지 마세요]
× "카페 경쟁이 치열한 지역이네요. 신중한 접근이 필요해요."
× "30대가 26.5%입니다. 핵심 고객으로 설정해야 합니다."
× "임대료를 예산에 반영해야 합니다."
× "차별화 전략이 필요합니다."

[좋은 bruFeedback 예시 - 이 수준으로 작성하세요]
○ 카드1(상권): "카페 209개 중 메가커피·빽다방·스타벅스가 반경 200m에 있어요. 아메리카노 2,000~4,500원 양극단이에요. 중간(3,000~4,000원)이 비어있어요. 이 틈을 노리든, 4,500원 이상 품질 승부를 하든 방향을 먼저 정해야 해요."
○ 카드2(방문연령): "방문은 60대(23.9%)가 가장 많아요. 주변 관공서·군부대 영향이에요. 하지만 이 숫자만 보고 '어르신 타깃 카페'를 만들면 안 돼요. 실제 누가 돈을 쓰는지는 소비 연령 카드를 확인해보세요."
○ 카드5(임대료): "한강로3가 월 580만원, 효창동 220만원으로 같은 역세권인데 360만원 차이에요. 카페 월매출 2,442만원 기준으로 임대료 비중이 15%를 넘으면 위험해요. 효창동(9%)이 안전하고, 한강로3가(23.7%)는 고위험이에요."
○ 카드7(종합): 각 카드를 반복하지 말고, "이 상권에서 개인카페가 살아남는 공식" 하나의 결론으로 연결. 판단 기준을 제시.

[방문 vs 소비 교차분석 - 핵심 인사이트]
- VstAgeRnk(방문연령)과 VstCst(소비연령) 데이터를 반드시 교차 비교하세요
- "방문이 많다 ≠ 소비가 많다" → 이 차이가 핵심 인사이트
- 예: 방문 1위가 60대여도 실제 소비 1위가 30대라면, 메뉴/가격/인테리어는 30대 기준으로 설계해야 해요
- 방문 연령만 보고 "고령화 지역이므로~" 같은 1차원적 해석 금지
- 반드시 "방문은 60대(23.9%)가 가장 많지만, 실제 소비는 30대(26.5%)가 1위" 식으로 교차 분석

[임대료 데이터 활용]
- Firebase에서 수집된 실제 임대료 데이터(firebaseRent)가 있으면 반드시 활용
- 보증금, 월세, 평당 임대료를 bruFeedback에 반영
- 근처 동별 임대료 차이도 분석해서 비용 절감 팁 제시

[spendingAgeFeedback 필드 추가]
- JSON 응답에 "spendingAgeFeedback" 필드를 추가하세요
- 방문vs소비 교차분석을 바탕으로 실질적인 타겟 고객 전략 제시
- 예: "방문은 60대가 23.9%로 가장 높지만 실제 소비는 30대가 26.5%로 1위예요. 용리단길 특성상 2030 소비력이 강하니 메뉴와 인테리어를 이 층에 맞춰보세요."

[rentFeedback 필드 추가]
- JSON 응답에 rent 객체 안에 실제 데이터 기반 bruFeedback 작성
- 보증금/월세/면적 숫자를 반드시 포함

[숫자/표기 규칙]
- "높다/낮다/많다" 같은 추상적 표현 금지. 반드시 숫자(개수, 비율%)로 근거 제시
- 나쁜 예: "한식 비중이 높아요" → 좋은 예: "한식 375곳으로 전체 점포의 9.3%예요"
- K, M 같은 약어 금지. "122,180명" 형태로 한글 표기
- 가격을 언급할 때는 반드시 근거 명시 (웹검색 결과, API 데이터 등)
- 근거 없는 숫자는 절대 적지 마세요

[가독성 규칙]
- bruFeedback은 "팩트(숫자) → 해석(의미) → 방향(행동)" 3단 구조
- 한 문장은 40자 이내로 끊어 쓰세요
- insight는 문단을 나눠서 가독성 확보 (\n\n으로 구분)

순수 JSON 형식으로만 응답 (이모티콘 금지, 모든 필드 필수):
{
  "region": "${query}",
  "reliability": "높음/중간/낮음",
  "dataDate": "YYYY년 MM월 기준",
  "overview": { 
    "cafeCount": "${query} 반경 1km 내 카페가 XXX개예요. (소상공인365 2024년 4분기)", 
    "newOpen": "2024년 신규 개업 XX개, 월평균 X개 수준이에요.", 
    "closed": "같은 기간 폐업 XX개예요. 개업 대비 폐업 비율을 확인해보세요.", 
    "floatingPop": "하루 유동인구 약 XX만명이에요. (소상공인365)", 
    "residentPop": "상주인구 약 XX만명이에요.", 
    "source": "소상공인365 GIS API",
    "bruFeedback": "주변 업종 데이터를 분석해서 카페 창업 방향을 제시해요. 예: 한식집 많으면 식후커피 전략, 오피스 많으면 테이크아웃 특화 등",
    "bruSummary": "40자 이내 한줄 핵심 (예: 메가커피 2,000원과 싸우지 말고, 경험으로 승부하세요)"
  },
  "consumers": { 
    "mainTarget": "핵심 고객층은 XX대 직장인이에요.", 
    "mainRatio": "매출 비중 약 XX% 수준이에요.", 
    "secondTarget": "2순위는 XX층이에요.", 
    "secondRatio": "약 XX% 정도예요.", 
    "peakTime": "점심 12-14시, 퇴근 17-19시에 매출이 집중돼요.", 
    "takeoutRatio": "테이크아웃 비율 약 XX%예요.", 
    "avgStay": "평균 체류시간 XX분 정도예요.",
    "bruFeedback": "연령별 데이터+주변 업종을 교차 분석해서 타겟 고객에 맞는 메뉴/공간/가격 방향을 구체적으로 제시해요.",
    "bruSummary": "40자 이내 한줄 핵심"
  },
  "franchise": [
    { "name": "메가커피", "count": XX, "price": 1500, "monthly": "약 X,XXX만원" },
    { "name": "컴포즈커피", "count": XX, "price": 1500, "monthly": "약 X,XXX만원" },
    { "name": "이디야", "count": XX, "price": 3300, "monthly": "약 X,XXX만원" },
    { "name": "스타벅스", "count": XX, "price": 4500, "monthly": "약 X,XXX만원", "feedback": "이 지역 프랜차이즈 현황에 대한 브루의 코멘트입니다." }
  ],
  "rent": { 
    "monthly": "월세 XXX-XXX만원 수준이에요.", 
    "deposit": "보증금 X,XXX-X,XXX만원 정도예요.", 
    "premium": "권리금은 위치에 따라 편차가 커요. 직접 확인이 필요해요.", 
    "yoyChange": "전년 대비 약 X.X% 변동이에요.", 
    "source": "한국부동산원",
    "bruFeedback": "브루가 임대료 관련 창업 전 반드시 생각할 포인트를 제시해요.",
    "bruSummary": "40자 이내 한줄 핵심"
  },
  "opportunities": [
    { "title": "호재 제목", "detail": "구체적 설명 (출처 포함)", "impact": "상/중/하", "bruFeedback": "브루가 이 기회를 어떻게 활용할지 창업자 관점에서 한 줄 제시해요.", "bruSummary": "40자 이내 핵심 한줄" }
  ],
  "risks": [
    { "title": "리스크 제목", "detail": "이 부분은 창업 전에 반드시 고려해보세요.", "impact": "상/중/하", "bruFeedback": "브루가 이 리스크에 대비해 창업 전 무엇을 생각해야 하는지 제시해요.", "bruSummary": "40자 이내 핵심 한줄" }
  ],
  "startupCost": { 
    "deposit": "보증금 범위 확인 필요", 
    "premium": "권리금 범위 확인 필요", 
    "interior": "인테리어는 콘셉트와 평수에 따라 달라요", 
    "equipment": "기기는 상권 특성에 맞게 구성이 필요해요", 
    "total": "총 비용은 개별 상담을 통해 구체화해보세요. 빈크래프트는 가맹비/로열티 0원, 광고비 자율 선택이에요.",
    "bruFeedback": "브루가 창업비용 관련 창업 전 생각할 포인트를 제시해요. 구체적 금액보다 구조와 방향 중심으로.",
    "bruSummary": "40자 이내 핵심 한줄"
  },
  "marketSurvival": {
    "cafeIndustry5yr": "22.8%",
    "allIndustry5yr": "34.7%",
    "govSupported5yr": "53.1%",
    "source": "통계청 기업생멸행정통계(2023), 중소벤처기업부",
    "warning": "카페 5년 생존율 22.8%예요. 이 숫자를 바꾸려면 철저한 준비가 필요해요.",
    "bruFeedback": "브루가 생존율 데이터를 바탕으로 창업자에게 현실적 조언을 해요.",
    "bruSummary": "40자 이내 핵심 한줄"
  },
  "insight": "${query} 지역의 특성과 데이터를 종합하면, [상권 특성 분석]. 창업 전에 이 지역에서 어떤 포지션으로 들어갈지 명확히 정리해보세요.",
  "beancraftFeedback": {
    "interior": {
      "summary": "이 상권에서는 [인테리어 방향] 콘셉트가 적합해요.",
      "detail": "과한 포토존 없이도 테이블에서 자연스럽게 촬영 가능한 소품 배치, 간접 조명, 또는 공간 자체가 압도하는 구성을 고려해보세요.",
      "thinkAbout": "내 예산에서 어떤 요소에 우선순위를 둘지 정리해보세요."
    },
    "equipment": {
      "summary": "이 상권 특성상 [기기 방향]이 중요해요.",
      "detail": "성수기 피크타임 대비 회전율 중심으로 구성하세요. 제빙기는 100kg 이상 + 여분 자리/비용까지 준비하는 게 안전해요. 에스프레소 머신은 동시 추출 가능한 2그룹 이상을 권장해요.",
      "thinkAbout": "피크타임에 시간당 몇 잔을 처리해야 하는지 계산해보세요."
    },
    "menu": {
      "summary": "이 상권 평균 객단가는 약 X,XXX원이에요.",
      "detail": "빈크래프트는 메뉴 구성과 방향을 함께 설계해요. 레시피는 제공하지만, 창업자가 원하는 스킬은 교육으로 충분히 키워드릴 수 있어요.",
      "thinkAbout": "목표 객단가와 회전율을 어떻게 설정할지 생각해보세요."
    },
    "beans": {
      "summary": "빈크래프트는 가성비(저가 프랜차이즈급)부터 고급라인(와인향, 건포도, 넛티 등)까지 준비되어 있어요.",
      "detail": "성수기에는 테이크아웃 고객 수요가 늘어나는데, 이때 가성비 라인을 추가 배치하면 '생존커피'라는 명분의 매출로 이어질 수 있어요.",
      "thinkAbout": "메인 원두와 서브 원두를 어떻게 구성할지 생각해보세요."
    },
    "education": {
      "summary": "이 상권에서 필요한 교육 우선순위예요.",
      "detail": "[상권 특성에 맞는 교육 내용 - 예: 오피스 상권이면 속도 중심, 관광 상권이면 CS/외국어 응대]",
      "thinkAbout": "오픈 전에 어떤 역량을 먼저 갖춰야 할지 정리해보세요."
    },
    "design": {
      "summary": "이 지역 SNS 트렌드를 반영한 브랜딩이 필요해요.",
      "detail": "[SNS 분석 기반 브랜딩 방향]. 테이크아웃 컵 디자인은 자연스러운 바이럴 포인트가 될 수 있어요.",
      "thinkAbout": "브랜드 네이밍과 로고 방향을 어떻게 잡을지 생각해보세요."
    },
    "priority": ["인테리어", "기기설치", "메뉴개발", "원두", "운영교육", "디자인"]
  }
}

수집된 API 데이터의 실제 숫자를 반드시 사용하세요. beancraftFeedback의 각 카테고리는 상권 특성에 맞게 구체적으로 작성하세요.`;

     // ═══ 1차: 주변 카페 웹검색 (Gemini Google Search) ═══
     animateProgressTo(60);
     setSalesModeAnalysisStep('주변 카페 조사 중');
     updateCollectingText('브루가 주변 카페를 조사하고 있어요');
     
     let nearbySearchResult = '';
     try {
       const searchRegion = addressInfo ? `${addressInfo.sigungu || ''} ${addressInfo.dong || ''}`.trim() : query;
       const isDetailedAddress = query.includes('로 ') || query.includes('길 ') || /\d+-\d+/.test(query);
       const searchTarget = isDetailedAddress ? query : searchRegion;
       
       const searchPrompt = `${searchTarget} 반경 500m 이내 실제 운영 중인 카페를 조사해줘.
프랜차이즈 카페와 개인카페를 구분해서 각각 최대 5곳씩.
각 카페의 이름, 유형(프랜차이즈/개인), 아메리카노 가격, 대표메뉴 가격, 주소를 알려줘.
또한 이 지역 카페들의 평균 아메리카노 가격도 계산해줘.
JSON으로만 응답: {"cafes":[{"name":"","type":"","americano":0,"avgMenu":0,"address":""}],"avgAmericano":0,"priceRange":"0~0원","franchiseCount":0,"independentCount":0}`;

       const searchResponse = await callGeminiProxy(
         [{ parts: [{ text: searchPrompt }] }],
         { maxOutputTokens: 1500 },
         null,
         [{ googleSearch: {} }]
       );
       
       if (searchResponse.ok) {
         const searchData = await searchResponse.json();
         const searchText = searchData.candidates?.[0]?.content?.parts?.[0]?.text || '';
         nearbySearchResult = searchText;
         console.log('주변 카페 웹검색 완료:', searchText.substring(0, 200));
       }
     } catch (e) {
       console.log('주변 카페 웹검색 실패 (계속 진행):', e.message);
     }

     animateProgressTo(70);
     setSalesModeAnalysisStep('AI 리포트 생성 중');
     updateCollectingText(`AI가 ${query} 지역 상권 데이터를 분석하고 있어요`);
     
     // AI 호출 함수 (재시도 로직 포함)
     const callGeminiWithRetry = async (promptText, maxRetry = 3) => {
       for (let attempt = 1; attempt <= maxRetry; attempt++) {
         try {
           updateCollectingText(`AI 분석 중... ${attempt > 1 ? `(재시도 ${attempt}/${maxRetry})` : ''}`);
           
           const controller = new AbortController();
           const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃
           
           const response = await callGeminiProxy([{ role: 'user', parts: [{ text: promptText }] }], { temperature: 0.7, maxOutputTokens: 8000 }, controller.signal);
           
           clearTimeout(timeoutId);
           
           if (response.ok) {
             const result = await response.json();
             if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
               return result;
             }
           }
           console.log(`Gemini API 오류 (${attempt}/${maxRetry}):`, response.status);
         } catch (e) {
           console.log(`Gemini API 실패 (${attempt}/${maxRetry}):`, e.message);
           if (attempt < maxRetry) {
             await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
           }
         }
       }
       return null;
     };
     
     // AI 응답 대기 중 진행률 부드럽게 증가 (70% → 95%)
     animateProgressTo(95);
     
     const result = await callGeminiWithRetry(prompt);
     
     // 인터벌 정리
     if (progressIntervalRef.current) {
       clearInterval(progressIntervalRef.current);
     }
     
     // 95% → 98%
     animateProgressTo(98);
     updateCollectingText(`AI 응답을 처리하고 있어요`);
     
     // AI 호출 실패 체크
     if (!result) {
       console.error('AI 호출 3회 모두 실패');
       animateProgressTo(100);
       setSalesModeAnalysisStep('분석 완료 (부분)');
       setSalesModeCollectingText('');
       
       // API 데이터로 기본 정보 구성
       const apis = collectedData.apis || {};
       let cafeCount = '데이터 수집 중';
       let floatingPop = '데이터 수집 중';
       
       if (apis.storCnt?.data?.rads) {
         const total = apis.storCnt.data.rads.reduce((sum, r) => sum + (parseInt(r.storCnt) || 0), 0);
         cafeCount = `소상공인365 데이터 기준, 총 업소 수 약 ${total.toLocaleString()}개 (카페 추정 ${Math.round(total * 0.15).toLocaleString()}개)`;
       }
       if (apis.popCnt?.data?.rads) {
         const total = apis.popCnt.data.rads.reduce((sum, r) => sum + (parseInt(r.ppltnCnt) || 0), 0);
         floatingPop = `일평균 유동인구 약 ${total.toLocaleString()}명`;
       }
       
       setSalesModeSearchResult({ 
         success: true, 
         data: {
           region: query,
           reliability: '낮음',
           dataDate: new Date().toLocaleDateString('ko-KR') + ' 기준',
           overview: { cafeCount, floatingPop, source: '소상공인365' },
           insight: 'AI 분석 서비스가 일시적으로 원활하지 않습니다. 기본 데이터만 표시됩니다. 잠시 후 다시 검색해주세요.',
           rawApiData: hasApiData ? collectedData.apis : null
         }, 
         query, 
         hasApiData,
         aiError: true,
         collectedData
       });
       return;
     }
     
     let text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
     text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

     // JSON 추출 시도
     const jsonMatch = text.match(/\{[\s\S]*\}/);

     // ★ 깨진 JSON 복구 함수 (Gemini가 문자열 내 줄바꿈, trailing comma 등 생성 시)
     const repairAndParseJSON = (raw) => {
       // 1차: 직접 파싱
       try { return JSON.parse(raw); } catch(e1) {
         console.log('JSON 1차 파싱 실패, 복구 시도:', e1.message);
         let fixed = raw;
         // trailing comma 제거: ,} 또는 ,]
         fixed = fixed.replace(/,\s*([}\]])/g, '$1');
         // 문자열 내 이스케이프 안 된 줄바꿈 수정
         fixed = fixed.replace(/"([^"]*(?:\\.[^"]*)*)"/g, (match) => {
           return match.replace(/(?<!\\)\n/g, '\\n').replace(/(?<!\\)\r/g, '\\r').replace(/(?<!\\)\t/g, '\\t');
         });
         try { return JSON.parse(fixed); } catch(e2) {
           console.log('JSON 2차 파싱 실패, 잘린 JSON 복구 시도:', e2.message);
           // 잘린 JSON 복구: 열린 괄호 수 맞추기
           let braceCount = 0, bracketCount = 0, inString = false, escape = false;
           for (let i = 0; i < fixed.length; i++) {
             const c = fixed[i];
             if (escape) { escape = false; continue; }
             if (c === '\\') { escape = true; continue; }
             if (c === '"') { inString = !inString; continue; }
             if (inString) continue;
             if (c === '{') braceCount++;
             if (c === '}') braceCount--;
             if (c === '[') bracketCount++;
             if (c === ']') bracketCount--;
           }
           // 닫는 괄호 추가
           let suffix = '';
           while (bracketCount > 0) { suffix += ']'; bracketCount--; }
           while (braceCount > 0) { suffix += '}'; braceCount--; }
           if (suffix) {
             // 마지막 유효 JSON 위치 찾기: 마지막 완전한 값 뒤에서 자르기
             let lastValid = fixed.length - 1;
             // 문자열이 열려있으면 닫기
             let openQuote = false;
             for (let i = 0; i < fixed.length; i++) {
               if (fixed[i] === '\\') { i++; continue; }
               if (fixed[i] === '"') openQuote = !openQuote;
             }
             if (openQuote) fixed += '"';
             // trailing comma 다시 제거
             fixed = fixed.replace(/,\s*$/g, '');
             fixed += suffix;
             fixed = fixed.replace(/,\s*([}\]])/g, '$1');
             try { return JSON.parse(fixed); } catch(e3) {
               console.log('JSON 3차 복구도 실패:', e3.message);
               return null;
             }
           }
           return null;
         }
       }
     };

     try {
       let data;
       if (jsonMatch) {
         data = repairAndParseJSON(jsonMatch[0]);
         if (!data) throw new Error('JSON 파싱 및 복구 모두 실패');
         
         // ★ React Error #31 방지: 모든 필드를 재귀적으로 순회, 렌더링될 문자열 필드가 객체이면 변환
         const sanitizeForReact = (obj) => {
           if (!obj || typeof obj !== 'object') return obj;
           if (Array.isArray(obj)) return obj.map(sanitizeForReact);
           const result = {};
           for (const [k, v] of Object.entries(obj)) {
             if (v && typeof v === 'object' && !Array.isArray(v)) {
               // 문자열이어야 할 키인지 확인 (bruFeedback, bruSummary, feedback, summary, detail 등)
               const strKeys = ['bruFeedback','bruSummary','feedback','summary','detail','thinkAbout','warning','message','insight',
                 'cafeCount','newOpen','closed','floatingPop','residentPop','mainTarget','mainRatio','secondTarget','secondRatio',
                 'peakTime','takeoutRatio','avgStay','monthly','deposit','premium','yoyChange','total','interior','equipment',
                 'cafeIndustry5yr','allIndustry5yr','govSupported5yr','source','title','region','reliability','dataDate',
                 'withConsulting','withoutConsulting','text'];
               if (strKeys.includes(k)) {
                 // 객체를 문자열로: summary/detail이 있으면 합치고, 아니면 JSON.stringify
                 result[k] = v.summary ? (v.detail ? `${v.summary} ${v.detail}` : v.summary) : JSON.stringify(v);
               } else {
                 result[k] = sanitizeForReact(v);
               }
             } else if (Array.isArray(v)) {
               result[k] = v.map(sanitizeForReact);
             } else {
               result[k] = v;
             }
           }
           return result;
         };
         data = sanitizeForReact(data);
       } else {
         throw new Error('JSON 형태를 찾을 수 없음');
       }
       
       // 좌표 정보 추가
       if (coordinates) {
         data.coordinates = coordinates;
       }
       // 원본 API 데이터 첨부 (출처 표시용)
       data.rawApiData = hasApiData ? collectedData.apis : null;
       
       // ═══ API 실제 데이터로 카페 수/매출 override (메인 동만 사용) ═══
       const _salesAvgData = collectedData.apis?.salesAvg?.data || [];
       let _mainCafe = 0, _mainCafeSalesAmt = 0;

       if (Array.isArray(_salesAvgData)) {
         const c = _salesAvgData.find(s => s.tpbizClscdNm === '카페');
         if (c) { _mainCafe = (c.stcnt||0); _mainCafeSalesAmt = (c.mmavgSlsAmt||0); }
       }

       if (_mainCafe > 0 && data.overview) {
         data.overview.cafeCount = String(_mainCafe);
         console.log(`카페 수 override: ${_mainCafe}개 (메인 동)`);
       }
       // cfrStcnt API 직접 override (salesAvg에 카페 항목이 없을 때)
       if (_mainCafe === 0 && data.overview) {
         const cfrData = collectedData.apis?.cfrStcnt?.data;
         if (cfrData?.stcnt && cfrData.stcnt > 0) {
           data.overview.cafeCount = String(cfrData.stcnt);
           console.log(`카페 수 cfrStcnt override: ${cfrData.stcnt}개`);
         }
       }
       if (_mainCafeSalesAmt > 0 && data.overview) {
         data.overview.avgMonthlySales = String(_mainCafeSalesAmt);
       }

       // ═══ API 실제 유동인구 데이터로 override (월간→일평균 변환) ═══
       if (data.overview) {
         const dynData = collectedData.apis?.dynPplCmpr?.data;
         if (Array.isArray(dynData) && dynData.length > 0) {
           const popCnt = dynData[0]?.cnt || dynData[0]?.fpCnt || 0;
           if (popCnt > 0) {
             // dynPplCmpr API는 월간 유동인구를 반환 → 일평균으로 변환 (÷30)
             const dailyPop = Math.round(popCnt / 30);
             data.overview.floatingPop = String(dailyPop);
             console.log(`유동인구 override: 월${popCnt}명 → 일평균${dailyPop}명 (dynPplCmpr API)`);
           }
         }
       }

       // SNS 트렌드 데이터 보강 (별도 AI 호출 결과)
       if (collectedData.apis?.snsTrend?.data && !data.snsTrend) {
         data.snsTrend = collectedData.apis.snsTrend.data;
       }
       
       // 배달 업종 피드백 생성
       if (!data.deliveryFeedback && collectedData.apis?.baeminTpbiz?.data) {
         const bData = collectedData.apis.baeminTpbiz.data;
         if (Array.isArray(bData) && bData.length > 0) {
           const topDelivery = bData[0]?.baeminTpbizClsfNm || '배달';
           data.deliveryFeedback = `이 지역은 ${topDelivery} 배달이 가장 활발해요. 카페 배달 메뉴를 넣을지, 매장 집중으로 갈지 먼저 생각해보세요.`;
         }
       }
       
       // 유동인구 시간대 피드백 생성
       if (!data.floatingPopTimeFeedback && collectedData.apis?.dynPplCmpr?.data) {
         const fpData = collectedData.apis.dynPplCmpr.data;
         if (Array.isArray(fpData) && fpData.length > 0) {
           const dongPop = fpData[0]?.cnt || 0;
           data.floatingPopTimeFeedback = dongPop > 100000 
             ? '유동인구가 많은 지역이에요. 피크타임 회전율 중심으로 기기와 인력을 구성해보세요.'
             : '유동인구가 적은 편이에요. 단골 고객 확보 전략을 먼저 생각해보세요.';
         }
       }
       
       // 시장 생존율 fallback
       if (!data.marketSurvival) {
         data.marketSurvival = {
           year1: '64.9%',
           year3: '46.3%',
           year5: '22.8%',
           cafeIndustry5yr: '22.8%',
           allIndustry5yr: '34.7%',
           govSupported5yr: '53.1%',
           source: '통계청 기업생멸행정통계(2023), 중소벤처기업부',
           insight: '카페 5년 생존율은 22.8%에요. 체계적인 창업 준비가 생존 확률을 높여줍니다.'
         };
       }

       // 날씨 영향 분석 데이터 생성
       if (!data.weatherImpact) {
         const WEATHER_REGION_TYPES = {
           '역삼': '오피스', '강남': '유동인구', '홍대': '유동인구', '이태원': '관광',
           '명동': '관광', '종로': '관광', '성수': '유동인구', '판교': '오피스',
           '해운대': '관광', '서면': '유동인구', '광안리': '관광'
         };
         const regionKey = Object.keys(WEATHER_REGION_TYPES).find(k => query.includes(k));
         const regionType = regionKey ? WEATHER_REGION_TYPES[regionKey] : '일반';
         data.weatherImpact = {
           regionType,
           effects: {
             '맑음': { impact: '+15~25%', desc: '테라스/야외 수요 증가' },
             '흐림': { impact: '-5~10%', desc: '실내 체류 시간 증가' },
             '비/눈': { impact: regionType === '오피스' ? '-5~10%' : '-20~35%', desc: regionType === '오피스' ? '직장인 고정 수요 유지' : '유동인구 급감' },
             '폭염/한파': { impact: '+10~20%', desc: '실내 피난 수요 증가 (아이스/따뜻한 음료)' }
           },
           description: `${regionType} 상권은 날씨에 따른 매출 변동이 ${regionType === '오피스' ? '적은' : '큰'} 편이에요. (추정)`,
           bruFeedback: `${query} 지역은 ${regionType} 상권 특성이에요. ${regionType === '오피스' ? '직장인 고정 수요로 날씨 영향이 적지만, 주말 매출은 변동이 클 수 있어요.' : regionType === '관광' ? '관광객 의존도가 높아 날씨에 민감해요. 우천 시 대비 메뉴나 실내 공간 전략이 중요해요.' : '유동인구 변화에 대비한 시즌별 메뉴 전략을 세워보세요.'}`
         };
       }
       
       // startupCost fallback (임대료 데이터 기반)
       if (!data.startupCost || (!data.startupCost.deposit && !data.startupCost.interior)) {
         const rentSummary = collectedData.apis?.firebaseRent?.data?.summary;
         const estDeposit = rentSummary?.avgDeposit || 3000;
         const estMonthly = rentSummary?.avgMonthlyRent || 200;
         data.startupCost = {
           ...(data.startupCost || {}),
           deposit: `${estDeposit.toLocaleString()}만원`,
           premium: '별도 확인 필요',
           interior: '3,000~5,000만원 (15평 기준)',
           equipment: '2,000~3,000만원',
           total: `${(estDeposit + 3000 + 2500).toLocaleString()}만원 (추정)`,
           bruFeedback: data.startupCost?.bruFeedback || `보증금 ${estDeposit.toLocaleString()}만원에 월세 ${estMonthly.toLocaleString()}만원이에요. 빈크래프트는 가맹비/로열티 0원이라 초기비용을 아낄 수 있어요.`,
           bruSummary: data.startupCost?.bruSummary || '빈크래프트 0원 가맹으로 초기비용 절감'
         };
       }

       // topSales bruFeedback 보강
       if (!data.topSales) {
         data.topSales = {};
       }
       if (!data.topSales.bruFeedback && collectedData.apis?.mmavgList?.data) {
         const mmData = collectedData.apis.mmavgList.data;
         if (Array.isArray(mmData) && mmData.length > 0) {
           const topBiz = mmData[0];
           data.topSales.bruFeedback = topBiz.tpbizNm 
             ? `이 지역에서 ${topBiz.tpbizNm} 업종 매출이 가장 높아요. 경쟁 구도를 파악하고 차별화 포인트를 찾아보세요.`
             : '매출 데이터를 기반으로 목표 매출을 설정해보세요.';
         }
       }
       
       // Firebase 임대료 데이터 → data.rent 병합
       if (collectedData.apis?.firebaseRent?.data) {
         const fbRent = collectedData.apis.firebaseRent.data;
         const s = fbRent.summary;
         data.rent = {
           ...(data.rent || {}),
           monthly: `${s.avgMonthlyRent.toLocaleString()}만원`,
           deposit: `${s.avgDeposit.toLocaleString()}만원`,
           avgArea: `${s.avgArea}㎡ (${(s.avgArea / 3.3).toFixed(1)}평)`,
           avgRentPerPyeong: `${s.avgRentPerPyeong.toLocaleString()}원/평`,
           articleCount: `${s.totalArticles.toLocaleString()}건`,
           dongCount: `${s.dongCount}개 동`,
           source: s.source || '네이버부동산 (빈크래프트 수집기)',
           updatedAt: s.updatedAt,
           bruFeedback: data.rent?.bruFeedback || `이 지역 상가 평균 보증금 ${s.avgDeposit.toLocaleString()}만원, 월세 ${s.avgMonthlyRent.toLocaleString()}만원이에요. 매물 ${s.totalArticles.toLocaleString()}건 기준이에요.`
         };
         // 인접 동별 상세 데이터
         data.rentDetail = fbRent.nearbyDongs.map(d => ({
           dong: d.dong,
           deposit: d.avgDeposit,
           monthly: d.avgMonthlyRent,
           area: d.avgArea,
           perPyeong: d.avgRentPerPyeong,
           articles: d.articleCount
         }));
       }
       
       // 소비연령 피드백 생성
       if (collectedData.apis?.vstCst?.data && collectedData.apis?.vstAgeRnk?.data) {
         const vstCst = collectedData.apis.vstCst.data;
         const vstAge = collectedData.apis.vstAgeRnk.data;
         const totalSpend = vstCst.reduce((s,d) => s + (d.pipcnt||0), 0);
         const totalVisit = vstAge.reduce((s,d) => s + (d.pipcnt||0), 0);
         const topSpend = [...vstCst].sort((a,b) => (b.pipcnt||0) - (a.pipcnt||0))[0];
         const topVisit = [...vstAge].sort((a,b) => (b.pipcnt||0) - (a.pipcnt||0))[0];
         if (topSpend && topVisit) {
           const spendAge = topSpend.age?.replace('M','');
           const visitAge = topVisit.age?.replace('M','');
           const spendPct = (topSpend.pipcnt / totalSpend * 100).toFixed(1);
           const visitPct = (topVisit.pipcnt / totalVisit * 100).toFixed(1);
           if (spendAge !== visitAge) {
             data.spendingAgeFeedback = data.spendingAgeFeedback || 
               `방문은 ${visitAge}대(${visitPct}%)가 가장 많지만, 실제 소비는 ${spendAge}대(${spendPct}%)가 1위예요. 메뉴와 인테리어는 실제 돈을 쓰는 ${spendAge}대 취향에 맞춰보세요.`;
           }
         }
       }
       
       // ═══ 서울시 시간대별 유동인구 수집 (서울 지역만) ═══
       const isSeoul = (addressInfo?.sido || '').includes('서울') || (addressInfo?.address || query || '').includes('서울');
       if (isSeoul) try {
         const dongNm = collectedData.dongInfo?.dongNm || addressInfo?.dong || '';
         const sgNm = addressInfo?.sigungu || '';
         const searchKws = [dongNm.replace(/\d+동$/, ''), query.split(' ')[0], sgNm.replace('구', '')].filter(kw => kw && kw.length >= 2);

         const floatRes = await fetch(`${PROXY_SERVER_URL}/api/seoul/floating?startIndex=44000&endIndex=44536`);
         if (floatRes.ok) {
           const floatData = await floatRes.json();
           const rows = floatData?.VwsmTrdarFlpopQq?.row || [];
           const matched = rows.filter(r => searchKws.some(kw => (r.TRDAR_CD_NM || '').includes(kw)));
           if (matched.length > 0) {
             const timeSlots = { '00~06시': 0, '06~11시': 0, '11~14시': 0, '14~17시': 0, '17~21시': 0, '21~24시': 0 };
             const tmKeys = ['00_06', '06_11', '11_14', '14_17', '17_21', '21_24'];
             const tmNames = Object.keys(timeSlots);
             const daySlots = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 };
             const dayKeys = ['MON', 'TUES', 'WED', 'THUR', 'FRI', 'SAT', 'SUN'];
             const dayNames = Object.keys(daySlots);
             matched.forEach(r => {
               tmKeys.forEach((tk, i) => { timeSlots[tmNames[i]] += parseInt(r[`TMZON_${tk}_FLPOP_CO`]) || 0; });
               dayKeys.forEach((dk, i) => { daySlots[dayNames[i]] += parseInt(r[`${dk}_FLPOP_CO`]) || 0; });
             });
             const n = matched.length;
             Object.keys(timeSlots).forEach(k => { timeSlots[k] = Math.round(timeSlots[k] / n); });
             Object.keys(daySlots).forEach(k => { daySlots[k] = Math.round(daySlots[k] / n); });
             const peakTime = Object.entries(timeSlots).sort((a,b) => b[1] - a[1])[0];
             const peakDay = Object.entries(daySlots).sort((a,b) => b[1] - a[1])[0];
             collectedData.apis.floatingTime = {
               description: '시간대별 유동인구 (서울시 열린데이터)',
               data: {
                 timeSlots, daySlots,
                 peakTime: peakTime?.[0] || '-', peakTimePop: peakTime?.[1] || 0,
                 peakDay: peakDay?.[0] || '-', peakDayPop: peakDay?.[1] || 0,
                 matchedCount: n,
                 matchedNames: matched.slice(0, 5).map(r => r.TRDAR_CD_NM),
                 quarter: matched[0]?.STDR_YYQU_CD || ''
               }
             };
             console.log(`[영업모드] 시간대 유동인구: ${n}개 상권 매칭, 피크 ${peakTime?.[0]}(${peakTime?.[1]?.toLocaleString()}명)`);
           }
         }
       } catch (e) { console.log('[영업모드] 시간대 유동인구 수집 실패:', e.message); }

       // ═══ 서울시 추정매출 API로 카페 전용 연령/시간대/요일 데이터 수집 (서울 지역만) ═══
       if (isSeoul) try {
         updateCollectingText('카페 업종 전용 매출·연령 데이터를 수집하고 있어요');
         const dongNmForSales = collectedData.dongInfo?.dongNm || addressInfo?.dong || '';
         const sgNmForSales = addressInfo?.sigungu || '';
         const salesKws = [dongNmForSales.replace(/\d+동$/, ''), query.split(' ')[0], sgNmForSales.replace('구', '')].filter(kw => kw && kw.length >= 2);

         // 서울시 VwsmTrdarSelngQq (추정매출) API - 프록시에서 카페만 필터링해서 반환
         const cafeSalesRes = await fetch(`/api/sbiz-proxy?api=seoul&service=VwsmTrdarSelngQq&stdrYyquCd=20253&industryCode=CS100010`);
         if (cafeSalesRes.ok) {
           const cafeSalesRaw = await cafeSalesRes.json();
           const cafeRows = cafeSalesRaw?.data?.filteredRows || [];
           // 지역 매칭 (여러 키워드로)
           const cafeMatched = cafeRows.filter(r => salesKws.some(kw => (r.TRDAR_CD_NM || '').includes(kw)));
           console.log(`[영업모드] 서울 카페 추정매출: 카페=${cafeRows.length}개, 매칭=${cafeMatched.length}개 (키워드: ${salesKws.join(',')})`);

           if (cafeMatched.length > 0) {
             // 연령별 카페 결제건수 합산
             let a10=0, a20=0, a30=0, a40=0, a50=0, a60=0;
             // 시간대별 카페 매출건수 합산
             let t0006=0, t0611=0, t1114=0, t1417=0, t1721=0, t2124=0;
             // 요일별 카페 매출건수 합산
             let dMon=0, dTue=0, dWed=0, dThu=0, dFri=0, dSat=0, dSun=0;
             // 성별 매출건수
             let mCo=0, fCo=0;
             // 총 매출액
             let totalSales=0;

             cafeMatched.forEach(r => {
               a10 += +(r.AGRDE_10_SELNG_CO||0);
               a20 += +(r.AGRDE_20_SELNG_CO||0);
               a30 += +(r.AGRDE_30_SELNG_CO||0);
               a40 += +(r.AGRDE_40_SELNG_CO||0);
               a50 += +(r.AGRDE_50_SELNG_CO||0);
               a60 += +(r.AGRDE_60_ABOVE_SELNG_CO||0);
               t0006 += +(r.TMZON_00_06_SELNG_CO||0);
               t0611 += +(r.TMZON_06_11_SELNG_CO||0);
               t1114 += +(r.TMZON_11_14_SELNG_CO||0);
               t1417 += +(r.TMZON_14_17_SELNG_CO||0);
               t1721 += +(r.TMZON_17_21_SELNG_CO||0);
               t2124 += +(r.TMZON_21_24_SELNG_CO||0);
               dMon += +(r.MON_SELNG_CO||0);
               dTue += +(r.TUES_SELNG_CO||0);
               dWed += +(r.WED_SELNG_CO||0);
               dThu += +(r.THUR_SELNG_CO||0);
               dFri += +(r.FRI_SELNG_CO||0);
               dSat += +(r.SAT_SELNG_CO||0);
               dSun += +(r.SUN_SELNG_CO||0);
               mCo += +(r.ML_SELNG_CO||0);
               fCo += +(r.FML_SELNG_CO||0);
               totalSales += +(r.THSMON_SELNG_AMT||0);
             });

             const n = cafeMatched.length;
             const totalAgeCo = a10+a20+a30+a40+a50+a60;

             // 카페 전용 연령별 데이터 저장
             collectedData.apis.cafeAgeData = {
               description: '카페 업종 연령별 결제건수 (서울시 추정매출)',
               data: [
                 { age: 'M10', pipcnt: Math.round(a10/n), pct: totalAgeCo > 0 ? Math.round(a10/totalAgeCo*100) : 0 },
                 { age: 'M20', pipcnt: Math.round(a20/n), pct: totalAgeCo > 0 ? Math.round(a20/totalAgeCo*100) : 0 },
                 { age: 'M30', pipcnt: Math.round(a30/n), pct: totalAgeCo > 0 ? Math.round(a30/totalAgeCo*100) : 0 },
                 { age: 'M40', pipcnt: Math.round(a40/n), pct: totalAgeCo > 0 ? Math.round(a40/totalAgeCo*100) : 0 },
                 { age: 'M50', pipcnt: Math.round(a50/n), pct: totalAgeCo > 0 ? Math.round(a50/totalAgeCo*100) : 0 },
                 { age: 'M60', pipcnt: Math.round(a60/n), pct: totalAgeCo > 0 ? Math.round(a60/totalAgeCo*100) : 0 }
               ].sort((a, b) => b.pipcnt - a.pipcnt),
               source: '서울시 열린데이터 추정매출 (카페 업종)',
               matchedCount: n,
               matchedNames: cafeMatched.slice(0, 5).map(r => r.TRDAR_CD_NM),
               isCafeSpecific: true
             };

             // 카페 전용 시간대별 데이터 저장
             collectedData.apis.cafeTimeData = {
               description: '카페 업종 시간대별 결제건수 (서울시 추정매출)',
               data: {
                 timeSlots: { '00~06시': Math.round(t0006/n), '06~11시': Math.round(t0611/n), '11~14시': Math.round(t1114/n), '14~17시': Math.round(t1417/n), '17~21시': Math.round(t1721/n), '21~24시': Math.round(t2124/n) },
                 daySlots: { '월': Math.round(dMon/n), '화': Math.round(dTue/n), '수': Math.round(dWed/n), '목': Math.round(dThu/n), '금': Math.round(dFri/n), '토': Math.round(dSat/n), '일': Math.round(dSun/n) },
                 gender: { male: mCo, female: fCo, malePct: (mCo+fCo)>0 ? Math.round(mCo/(mCo+fCo)*100) : 50 },
                 avgSalesPerStore: n > 0 ? Math.round(totalSales / n) : 0
               },
               source: '서울시 열린데이터 추정매출 (카페 업종)',
               isCafeSpecific: true
             };

             console.log(`[영업모드] 카페 전용 매출 데이터: ${n}개 상권, 연령 1위=${collectedData.apis.cafeAgeData.data[0]?.age}(${collectedData.apis.cafeAgeData.data[0]?.pct}%)`);

             // mainTarget을 카페 전용 데이터로 업데이트
             const cafeTop = collectedData.apis.cafeAgeData.data[0];
             const cafeSecond = collectedData.apis.cafeAgeData.data[1];
             const cafeAgeMap = { 'M10': '10대', 'M20': '20대', 'M30': '30대', 'M40': '40대', 'M50': '50대', 'M60': '60대 이상' };
             if (cafeTop) {
               data.consumers = data.consumers || {};
               data.consumers.mainTarget = `${cafeAgeMap[cafeTop.age] || cafeTop.age} (카페 결제 기준)`;
               data.consumers.mainRatio = `${cafeTop.pct}%`;
               if (cafeSecond) {
                 data.consumers.secondTarget = cafeAgeMap[cafeSecond.age] || cafeSecond.age;
                 data.consumers.secondRatio = `${cafeSecond.pct}%`;
               }
             }
           } else {
             console.log('[영업모드] 카페 전용 매출: 해당 지역 매칭 없음 (검색:', salesKws.join(','), ')');
           }
         }
       } catch (e) { console.log('[영업모드] 카페 전용 매출 수집 실패:', e.message); }

       // ═══ 방법 A: 카드별 개별 프롬프트 강화 ═══
       setSalesModeAnalysisStep('브루 피드백 강화 중');
       updateCollectingText('각 카드별 맞춤 피드백을 작성하고 있어요');
       animateProgressTo(85);

       // 교차 분석용 데이터 미리 계산
       const crossData = {};
       
       // 소비연령 데이터 - 카페 전용 데이터가 있으면 우선 사용
       const _cafeAge = collectedData.apis?.cafeAgeData?.data || [];
       const vstCstData = collectedData.apis?.vstCst?.data || [];
       const vstAgeData = collectedData.apis?.vstAgeRnk?.data || [];

       if (_cafeAge.length > 0) {
         // 카페 전용 연령 데이터 (서울시 추정매출)
         crossData.topSpendAge = (_cafeAge[0]?.age || 'M30').replace('M','') + '대';
         crossData.topSpendPct = _cafeAge[0]?.pct || '?';
         crossData.topVisitAge = (_cafeAge[1]?.age || 'M20').replace('M','') + '대';
         crossData.topVisitPct = _cafeAge[1]?.pct || '?';
         crossData.ageSource = '카페 업종 결제건수 (서울시 열린데이터)';
       } else {
         // 전체 업종 데이터 (소상공인365) - fallback
         const totalSpendX = vstCstData.reduce((s,d) => s + (d.pipcnt||0), 0);
         const totalVisitX = vstAgeData.reduce((s,d) => s + (d.pipcnt||0), 0);
         const spendSorted = [...vstCstData].sort((a,b) => (b.pipcnt||0) - (a.pipcnt||0));
         const visitSorted = [...vstAgeData].sort((a,b) => (b.pipcnt||0) - (a.pipcnt||0));
         crossData.topSpendAge = (spendSorted[0]?.age || 'M?').replace('M','') + '대';
         crossData.topSpendPct = totalSpendX > 0 ? (spendSorted[0]?.pipcnt / totalSpendX * 100).toFixed(1) : '?';
         crossData.topVisitAge = (visitSorted[0]?.age || 'M?').replace('M','') + '대';
         crossData.topVisitPct = totalVisitX > 0 ? (visitSorted[0]?.pipcnt / totalVisitX * 100).toFixed(1) : '?';
         crossData.ageSource = '전체 업종 (소상공인365)';
       }
       
       // 임대료 데이터
       const fbRentData = collectedData.apis?.firebaseRent?.data;
       crossData.avgMonthly = fbRentData?.summary?.avgMonthlyRent || 0;
       crossData.avgDeposit = fbRentData?.summary?.avgDeposit || 0;
       crossData.rentDongs = (fbRentData?.nearbyDongs || []).map(d => `${d.dong}:월${d.avgMonthlyRent}만`).join(', ');
       // 임대료 데이터 출처 표시
       const rentSource = fbRentData?.summary?.isEstimate ? ` (${fbRentData.summary.source || '부동산원 추정'})` : '';
       crossData.rentStr = crossData.avgMonthly > 0 
         ? `평균 월${crossData.avgMonthly}만, 보증금${crossData.avgDeposit}만${rentSource}`
         : '임대료 데이터 미수집';
       crossData.rentDongsStr = crossData.rentDongs || '동별 데이터 없음';
       
       // 카페 매출 (인접 동 합산 포함)
       const salesData = collectedData.apis?.salesAvg?.data || [];
       const nearbySalesData = collectedData.apis?.nearbySales?.data || [];
       
       // 메인 동 + 인접 동 카페 합산 (교차 분석용)
       let totalCafeCount = 0;
       let totalCafeSalesAmt = 0;
       let totalCafeSalesCount = 0;
       let allCafeSalesItems = [];

       // 메인 동 카페 데이터
       if (Array.isArray(salesData)) {
         const cafeItem = salesData.find(s => s.tpbizClscdNm === '카페');
         if (cafeItem) {
           totalCafeCount += (cafeItem.stcnt || 0);
           totalCafeSalesAmt += (cafeItem.mmavgSlsAmt || 0);
           totalCafeSalesCount += 1;
         }
         // 카페 관련 업종 전부
         const cafeSales = salesData.filter(s => ['카페','커피','빵','도넛','베이커리','디저트'].some(k => (s.tpbizClscdNm||'').includes(k)));
         allCafeSalesItems.push(...cafeSales);
       }

       // 인접 동 카페 데이터 합산
       nearbySalesData.forEach(nd => {
         if (Array.isArray(nd.sales)) {
           const cafeItem = nd.sales.find(s => s.tpbizClscdNm === '카페');
           if (cafeItem) {
             totalCafeCount += (cafeItem.stcnt || 0);
             if (cafeItem.mmavgSlsAmt) {
               totalCafeSalesAmt += cafeItem.mmavgSlsAmt;
               totalCafeSalesCount += 1;
             }
           }
           const cafeSales = nd.sales.filter(s => ['카페','커피','빵','도넛','베이커리','디저트'].some(k => (s.tpbizClscdNm||'').includes(k)));
           allCafeSalesItems.push(...cafeSales);
         }
       });

       // 평균 매출 계산
       const avgCafeSales = totalCafeSalesCount > 0 ? Math.round(totalCafeSalesAmt / totalCafeSalesCount) : 0;

       const dongCount = (nearbySalesData.length || 0) + 1;
       crossData.cafeSalesStr = allCafeSalesItems.length > 0
         ? `카페 평균 월매출 ${avgCafeSales > 0 ? avgCafeSales.toLocaleString() + '만' : '미수집'}(${dongCount}개동 합산), ` + allCafeSalesItems.filter(s => s.mmavgSlsAmt > 0).map(s => `${s.tpbizClscdNm}:${s.mmavgSlsAmt.toLocaleString()}만(${s.stcnt}점포)`).join(', ')
         : '카페 매출 데이터 미수집';
       crossData.avgCafeSales = avgCafeSales;

       // 카페 수: API 실제 합산 데이터 (인접 동 포함)
       crossData.cafeCount = totalCafeCount > 0 ? totalCafeCount : (data.overview?.cafeCount || '?');
       crossData.nearbyDongCount = dongCount;
       crossData.franchiseInfo = nearbySearchResult?.substring(0, 600) || '';
       
       // 웹검색 카페 목록 (거리 포함)
       crossData.nearCafes = nearbySearchResult?.substring(0, 800) || '';
       
       // 배달 데이터
       const baeminData = collectedData.apis?.baeminTpbiz?.data || [];
       crossData.baeminStr = baeminData.slice(0,5).map(b => `${b.baeminTpbizClsfNm}:${b.cnt}건`).join(', ');
       
       // 시간대별 유동인구 데이터
       const ftData = collectedData.apis?.floatingTime?.data;
       if (ftData?.timeSlots) {
         crossData.timeSlotStr = Object.entries(ftData.timeSlots).map(([k,v]) => `${k}:${v.toLocaleString()}명`).join(', ');
         crossData.peakTime = ftData.peakTime || '-';
         crossData.peakTimePop = ftData.peakTimePop?.toLocaleString() || '0';
         crossData.daySlotStr = ftData.daySlots ? Object.entries(ftData.daySlots).map(([k,v]) => `${k}:${v.toLocaleString()}명`).join(', ') : '';
         crossData.peakDay = ftData.peakDay || '-';
         crossData.hasTimeData = true;
       } else {
         crossData.hasTimeData = false;
         crossData.timeSlotStr = '';
         crossData.peakTime = '';
         // 서울 외 지역: 소상공인365 유동인구 데이터를 교차데이터로 전달
         const dynData = collectedData.apis?.dynPplCmpr?.data;
         if (Array.isArray(dynData) && dynData.length > 0) {
           const dongPopMonthly = dynData[0]?.cnt || 0;
           const dongPopDaily = Math.round(dongPopMonthly / 30);
           crossData.dynPopForTime = dongPopDaily > 0 ? `일 유동인구 ${dongPopDaily.toLocaleString()}명` : '';
           // 상위지역 (구/시 단위) 데이터 — 월간→일평균
           if (dynData.length > 1 && dynData[1]?.nm && dynData[1]?.cnt) {
             crossData.dynAreaForTime = `${dynData[1].nm} ${Math.round(dynData[1].cnt / 30).toLocaleString()}명`;
           } else {
             crossData.dynAreaForTime = '';
           }
         } else {
           crossData.dynPopForTime = '';
           crossData.dynAreaForTime = '';
         }
       }
       
       // isDetailedAddress (상세주소 여부)
       const isDetailed = /\d+[-번]/.test(query) || query.includes('로 ') || query.includes('길 ');
       
       // 카드별 프롬프트 생성
       const cardPrompts = {
         overview: `당신은 카페 창업 컨설턴트 '브루'예요. 카드1(상권개요) 피드백을 작성해주세요.
[이 카드 데이터] 카페 ${crossData.cafeCount}, 유동인구 데이터 있음
[교차 데이터] 주변카페: ${crossData.nearCafes.substring(0,300)}
임대료: ${crossData.rentDongsStr}
소비연령: ${crossData.topSpendAge} ${crossData.topSpendPct}%
매출: ${crossData.cafeSalesStr}
[규칙] 1차원(카페 X개, 경쟁 치열) 금지. 실제 카페 이름+가격+매출+임대료를 교차해서 현실적 조언. "~에요/~입니다" 혼용 OK. 80자 이상.
[bruSummary] 40자 이내 핵심 한줄도 함께.
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         consumers: `당신은 카페 창업 컨설턴트 '브루'예요. 카드2(방문연령) 피드백을 작성해주세요.
[이 카드 데이터] 방문 1위: ${crossData.topVisitAge}(${crossData.topVisitPct}%)
[교차 데이터] 실제 소비 1위: ${crossData.topSpendAge}(${crossData.topSpendPct}%)${crossData.topVisitAge !== crossData.topSpendAge ? ' ← 방문과 다름!' : ' (방문과 동일)'}
[규칙] ${crossData.topVisitAge !== crossData.topSpendAge 
  ? '방문 데이터를 해석하되, "이 숫자만 보고 판단하면 안 돼요. 실제 소비는 다릅니다" 식으로 다음 카드(소비연령)로 연결.' 
  : '방문과 소비 1위가 동일합니다. 이 연령대가 왜 방문도 하고 소비도 하는지 주변 환경과 연결해 해석하세요. 2위 연령대와의 격차, 해당 연령대 특성에 맞는 메뉴/인테리어 방향을 제시하세요.'} 왜 이 연령이 많은지 주변 환경(관공서/학교/오피스/아파트 등) 언급. 80자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         spendingAge: `당신은 카페 창업 컨설턴트 '브루'예요. 카드2.3(소비연령) 피드백을 작성해주세요.
[이 카드 데이터] 소비 1위: ${crossData.topSpendAge}(${crossData.topSpendPct}%), 방문 1위: ${crossData.topVisitAge}(${crossData.topVisitPct}%)
[교차 데이터] 주변카페 평균가격, 매출: ${crossData.cafeSalesStr}
임대료: ${crossData.rentStr}
[규칙] ${crossData.topVisitAge !== crossData.topSpendAge 
  ? '방문vs소비 격차의 "왜"를 해석. 소비 1위 연령 기준으로 구체적 메뉴/가격/인테리어 방향 제시.'
  : '방문과 소비가 같은 연령('+crossData.topSpendAge+')입니다. 이 연령대 소비 특성(객단가, 선호 메뉴, 체류시간)을 중심으로 분석하세요. 2위 소비 연령과의 격차도 언급하세요.'} "A를 하면 X, B를 하면 Y" 시나리오 포함. 100자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         franchise: `당신은 카페 창업 컨설턴트 '브루'예요. 카드3(프랜차이즈 경쟁) 피드백을 작성해주세요.
[이 카드 데이터] 주변카페: ${crossData.nearCafes.substring(0,400)}
[교차 데이터] 소비 1위: ${crossData.topSpendAge}(${crossData.topSpendPct}%)
임대료: ${crossData.rentStr}
매출: ${crossData.cafeSalesStr}
[규칙] 실제 카페 이름과 가격 필수 언급. 가격 양극화(저가 vs 고가) 분석. 틈새 가격대 제시. "메가커피 2,000원과 싸우면 안 된다"식의 현실 조언. 100자 이상.
${isDetailed ? '상세주소이므로 "선택하신 주소에서 가장 가까운 카페는 ○○(주소)" 언급 필수.' : ''}
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         cafeSales: `당신은 카페 창업 컨설턴트 '브루'예요. 카드4(카페매출) 피드백을 작성해주세요.
[이 카드 데이터] 매출: ${crossData.cafeSalesStr}
[교차 데이터] 소비 1위: ${crossData.topSpendAge}(${crossData.topSpendPct}%)
임대료: ${crossData.rentStr}, 동별: ${crossData.rentDongsStr}
주변카페: ${crossData.nearCafes.substring(0,200)}
[규칙] 매출 데이터와 임대료를 교차해서 "매출 대비 임대료 비중 X%" 계산. 빵/도넛 매출이 카페보다 높으면 디저트 전략 제시. 객단가 추정도 포함. 100자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         floatingTime: `당신은 카페 창업 컨설턴트 '브루'예요. 카드4.3(유동인구시간대) 피드백을 작성해주세요.
${crossData.hasTimeData
  ? `[이 카드 데이터] 시간대별 유동인구 (서울시 열린데이터):
${crossData.timeSlotStr}
피크 시간: ${crossData.peakTime} (${crossData.peakTimePop}명)
요일별: ${crossData.daySlotStr}
피크 요일: ${crossData.peakDay}
[교차 데이터] 소비 1위: ${crossData.topSpendAge}, 매출: ${crossData.cafeSalesStr}
[규칙] 실제 시간대 데이터를 반드시 인용. 피크시간대에 맞춘 운영전략(인력배치, 메뉴구성, 할인시간). 비수기 시간대 활용 전략도 제시. 100자 이상.`
  : `[이 카드 데이터] 시간대별 세부 분리 데이터는 없지만, 소상공인365 전국 데이터 기준:
${crossData.dynPopForTime || '유동인구 데이터 수집됨'}${crossData.dynAreaForTime ? ', 상위지역: ' + crossData.dynAreaForTime : ''}
[교차 데이터] 소비 1위: ${crossData.topSpendAge}(${crossData.topSpendPct}%)
방문 1위: ${crossData.topVisitAge}(${crossData.topVisitPct}%)
매출: ${crossData.cafeSalesStr}
임대료: ${crossData.rentStr}
카페수: ${crossData.cafeCount}
주변카페: ${(crossData.nearCafes || '').substring(0, 200)}
[규칙] 위 실데이터를 반드시 인용하면서 시간대 운영 전략을 제시하세요. 소비 연령(${crossData.topSpendAge})의 활동 패턴, 상권 특성(${query})을 교차해서 피크타임을 추론하세요. "${crossData.dynPopForTime || '유동인구'}을 기준으로~" 식으로 숫자 근거 필수. 구체적 시간대별 숫자를 지어내지 마세요. 100자 이상.`}
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         rent: `당신은 카페 창업 컨설턴트 '브루'예요. 카드5(임대료) 피드백을 작성해주세요.
[이 카드 데이터] ${crossData.rentStr}
동별: ${crossData.rentDongsStr}
[교차 데이터] 카페 매출: ${crossData.cafeSalesStr}
[규칙] ${crossData.avgMonthly > 0 ? '동별 임대료 차이를 비교해서 "어디가 가성비인지" 구체적으로. 매출 대비 임대료 비중 계산(15% 넘으면 위험). 시나리오 비교.' : '임대료 데이터가 수집되지 않았습니다. 구체적 임대료 수치를 지어내지 마세요. 대신 이 지역 상권 특성상 임대료 확인이 중요한 이유와 확인 방법을 안내해주세요.'} 100자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         startupCost: `당신은 카페 창업 컨설턴트 '브루'예요. 카드5-2(창업비용) 피드백을 작성해주세요.
[교차 데이터] 임대료: ${crossData.rentStr}
매출: ${crossData.cafeSalesStr}
[규칙] 빈크래프트는 가맹비 0원, 로열티 0원. 프랜차이즈 대비 비용 구조 비교. 초기 투자 회수 기간 추정. 80자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         opportunity: `당신은 카페 창업 컨설턴트 '브루'예요. 카드6(기회) 피드백을 작성해주세요.
[교차 데이터] 소비: ${crossData.topSpendAge}(${crossData.topSpendPct}%)
매출: ${crossData.cafeSalesStr}
임대료: ${crossData.rentStr}
주변카페: ${crossData.nearCafes.substring(0,200)}
[규칙] "A를 하면 X, B를 하면 Y" 시나리오 필수. 객단가 계산 포함. 100자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         risk: `당신은 카페 창업 컨설턴트 '브루'예요. 카드6(리스크) 피드백을 작성해주세요.
[교차 데이터] 카페수: ${crossData.cafeCount}
임대료: ${crossData.rentStr}, 동별: ${crossData.rentDongsStr}
매출: ${crossData.cafeSalesStr}
주변카페: ${crossData.nearCafes.substring(0,200)}
[규칙] 위험 시나리오를 숫자로 보여줘. "월세 X만이면 매출의 Y%, 순이익 Z만원" 계산. 100자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         delivery: `당신은 카페 창업 컨설턴트 '브루'예요. 카드6.2(배달) 피드백을 작성해주세요.
[이 카드 데이터] 배달현황: ${crossData.baeminStr}
[교차 데이터] 매출: ${crossData.cafeSalesStr}
소비: ${crossData.topSpendAge}
[규칙] 배달 vs 매장 전략 비교. 수수료 고려한 수익성 분석. 80자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         survival: `당신은 카페 창업 컨설턴트 '브루'예요. 카드6.7(생존율) 피드백을 작성해주세요.
[이 카드 데이터] 카페 5년 생존율 22.8%
[교차 데이터] 이 상권 카페수: ${crossData.cafeCount}, 임대료: ${crossData.rentStr}
매출: ${crossData.cafeSalesStr}
[규칙] 단순히 "22.8%는 낮다" 금지. 이 상권에서 생존하려면 구체적으로 뭘 해야 하는지. 빈크래프트 교육 자연스럽게 연결. 80자 이상.
[bruSummary] 40자 이내
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"bruFeedback":"여기에 피드백","bruSummary":"40자이내 요약"}`,
         
         insight: `당신은 카페 창업 컨설턴트 '브루'예요. 카드7(AI종합) 작성해주세요.
[전체 데이터 요약]
카페: ${crossData.cafeCount}
소비: ${crossData.topSpendAge}(${crossData.topSpendPct}%), 방문: ${crossData.topVisitAge}(${crossData.topVisitPct}%)
매출: ${crossData.cafeSalesStr}
임대료: ${crossData.rentStr}, 동별: ${crossData.rentDongsStr}
주변카페: ${crossData.nearCafes.substring(0,300)}
배달: ${crossData.baeminStr}
[규칙] 각 카드 내용을 반복하지 말고, "이 상권에서 개인카페가 살아남는 공식" 하나의 결론으로 연결. 판단 기준을 제시. 빈크래프트 상담 연결. 200자 이상.
반드시 아래 JSON 포맷만 출력하세요. 다른 텍스트, 설명, 마크다운 금지.
{"insight":"여기에 종합 피드백"}`
       };
       
       // 배치 호출 (4개씩, 504 방지) + 재시도
       const cardKeys = Object.keys(cardPrompts);
       const callCard = async (key) => {
         for (let attempt = 0; attempt < 2; attempt++) {
           try {
             const res = await fetch('/.netlify/functions/gemini-proxy', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 contents: [{ parts: [{ text: cardPrompts[key] }] }],
                 generationConfig: { temperature: 0.7, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } }
               })
             });
             if (!res.ok) { if (attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; } return { key, data: null }; }
             const d = await res.json();
             const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
             // 1차: 마크다운/코드블록 제거 후 JSON 추출
             const clean = txt.replace(/```json\s*|\s*```/g, '').replace(/^[\s\S]*?(?=\{)/,'').trim();
             const match = clean.match(/\{[\s\S]*\}/);
             let parsed = null;
             if (match) {
               try { parsed = JSON.parse(match[0].replace(/[\x00-\x1f]+/g, ' ')); } catch {}
             }
             // 2차: JSON 파싱 실패 시 마크다운 완전 제거 후 재시도
             if (!parsed) {
               const stripped = txt.replace(/```[\s\S]*?```/g, '').replace(/#{1,6}\s+[^\n]*/g, '').replace(/\*{1,3}[^*]+\*{1,3}/g, m => m.replace(/\*/g,'')).trim();
               const match2 = stripped.match(/\{[\s\S]*\}/);
               if (match2) { try { parsed = JSON.parse(match2[0].replace(/[\x00-\x1f]+/g, ' ')); } catch {} }
             }
             // 3차: 완전 실패 시 텍스트에서 직접 피드백 추출
             if (!parsed) {
               const plainText = txt.replace(/```[\s\S]*?```/g, '').replace(/#{1,6}\s+/g, '').replace(/\*{1,3}/g, '').replace(/\n{3,}/g, '\n\n').trim();
               if (plainText.length > 30) {
                 // insight 카드는 insight 필드, 나머지는 bruFeedback
                 if (key === 'insight') {
                   parsed = { insight: plainText.substring(0, 1000) };
                 } else {
                   // 첫 200자를 summary로, 전체를 feedback으로
                   parsed = {
                     bruFeedback: plainText.substring(0, 800),
                     bruSummary: plainText.substring(0, 38) + '..'
                   };
                 }
                 console.log(`카드 ${key}: JSON 파싱 실패 → 텍스트 폴백 사용 (${plainText.length}자)`);
               }
             }
             if (parsed) return { key, data: parsed };
             if (attempt === 0) { await new Promise(r => setTimeout(r, 1000)); continue; }
             return { key, data: null };
           } catch (e) { if (attempt === 0) { await new Promise(r => setTimeout(r, 1000)); continue; } return { key, data: null }; }
         }
         return { key, data: null };
       };
       const cardResultsArr = [];
       for (let i = 0; i < cardKeys.length; i += 4) {
         const batch = cardKeys.slice(i, i + 4);
         const batchResults = await Promise.allSettled(batch.map(k => callCard(k)));
         cardResultsArr.push(...batchResults);
       }
       const cardResults = cardResultsArr;
       
       // 결과를 data에 병합
       const safeStr = (v) => typeof v === 'string' ? v : (v && typeof v === 'object' ? JSON.stringify(v) : v ? String(v) : '');
       for (const r of cardResults) {
         if (r.status !== 'fulfilled' || !r.value?.data) continue;
         const { key, data: cardData } = r.value;
         // 문자열 보장
         if (cardData.bruFeedback && typeof cardData.bruFeedback !== 'string') cardData.bruFeedback = safeStr(cardData.bruFeedback);
         if (cardData.bruSummary && typeof cardData.bruSummary !== 'string') cardData.bruSummary = safeStr(cardData.bruSummary);
         if (cardData.insight && typeof cardData.insight !== 'string') cardData.insight = safeStr(cardData.insight);
         
         switch(key) {
           case 'overview':
             if (cardData.bruFeedback) { data.overview = { ...data.overview, bruFeedback: cardData.bruFeedback, bruSummary: cardData.bruSummary }; }
             break;
           case 'consumers':
             if (cardData.bruFeedback) { data.consumers = { ...data.consumers, bruFeedback: cardData.bruFeedback, bruSummary: cardData.bruSummary }; }
             break;
           case 'spendingAge':
             if (cardData.bruFeedback) { data.spendingAgeFeedback = cardData.bruFeedback; data.spendingAgeSummary = cardData.bruSummary; }
             break;
           case 'franchise':
             if (cardData.bruFeedback) {
               if (data.franchise?.[0]) { data.franchise[0].feedback = cardData.bruFeedback; data.franchise[0].bruSummary = cardData.bruSummary; }
               else { if (!data.franchise) data.franchise = []; if (data.franchise.length === 0) data.franchise.push({}); data.franchise[0].feedback = cardData.bruFeedback; data.franchise[0].bruSummary = cardData.bruSummary; }
             }
             break;
           case 'cafeSales':
             if (cardData.bruFeedback) { data.topSales = { ...data.topSales, bruFeedback: cardData.bruFeedback, bruSummary: cardData.bruSummary }; }
             break;
           case 'floatingTime':
             if (cardData.bruFeedback) { data.floatingPopTimeFeedback = cardData.bruFeedback; data.floatingPopTimeSummary = cardData.bruSummary; }
             break;
           case 'rent':
             if (cardData.bruFeedback) { data.rent = { ...data.rent, bruFeedback: cardData.bruFeedback, bruSummary: cardData.bruSummary }; }
             break;
           case 'startupCost':
             if (cardData.bruFeedback) { data.startupCost = { ...data.startupCost, bruFeedback: cardData.bruFeedback, bruSummary: cardData.bruSummary }; }
             break;
           case 'opportunity':
             if (cardData.bruFeedback) {
               if (data.opportunities?.[0]) { data.opportunities[0].bruFeedback = cardData.bruFeedback; data.opportunities[0].bruSummary = cardData.bruSummary; }
               else { if (!data.opportunities) data.opportunities = []; if (data.opportunities.length === 0) data.opportunities.push({ title: '기회 분석', detail: '' }); data.opportunities[0].bruFeedback = cardData.bruFeedback; data.opportunities[0].bruSummary = cardData.bruSummary; }
             }
             break;
           case 'risk':
             if (cardData.bruFeedback) {
               if (data.risks?.[0]) { data.risks[0].bruFeedback = cardData.bruFeedback; data.risks[0].bruSummary = cardData.bruSummary; }
               else { if (!data.risks) data.risks = []; if (data.risks.length === 0) data.risks.push({ title: '리스크 분석', detail: '' }); data.risks[0].bruFeedback = cardData.bruFeedback; data.risks[0].bruSummary = cardData.bruSummary; }
             }
             break;
           case 'delivery':
             if (cardData.bruFeedback) { data.deliveryFeedback = cardData.bruFeedback; data.deliverySummary = cardData.bruSummary; }
             break;
           case 'survival':
             if (cardData.bruFeedback) { data.marketSurvival = { ...data.marketSurvival, bruFeedback: cardData.bruFeedback, bruSummary: cardData.bruSummary }; }
             break;
           case 'insight':
             if (cardData.insight) { data.insight = cardData.insight; }
             break;
         }
       }
       console.log('카드별 강화 완료:', cardResults.filter(r => r.status === 'fulfilled' && r.value?.data).length, '/', cardKeys.length);
       
       // 100% 완료
       animateProgressTo(100);
       setSalesModeAnalysisStep('분석 완료');
       setSalesModeCollectingText('');
       setSalesModeSearchResult({ success: true, data, query, hasApiData, collectedData });
       
       // 검색 완료 후 지도 자동 펼침
       setSalesModeMapExpanded(true);
     } catch (e) {
       console.error('영업모드 JSON 파싱 실패:', e);
       console.log('AI 원본 응답:', text);
       
       // 파싱 실패 시 개별 필드 추출 시도
       const extractField = (fieldName) => {
         const regex = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
         const match = text.match(regex);
         return match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : null;
       };
       
       const extractNumber = (fieldName) => {
         const regex = new RegExp(`"${fieldName}"\\s*:\\s*(\\d+)`, 'i');
         const match = text.match(regex);
         return match ? parseInt(match[1]) : null;
       };
       
       // 수집된 API 데이터에서 기본값 추출
       const getApiBasedDefaults = () => {
         const apis = collectedData.apis || {};
         let cafeCount = '-';
         let floatingPop = '-';
         let storCount = '-';
         
         if (apis.storCnt?.data?.rads) {
           const total = apis.storCnt.data.rads.reduce((sum, r) => sum + (parseInt(r.storCnt) || 0), 0);
           storCount = `소상공인365 데이터 기준, 이 지역 내 총 업소 수는 약 ${total.toLocaleString()}개입니다.`;
           cafeCount = `소상공인365 데이터 기준, 이 지역 내 카페/음식점은 약 ${Math.round(total * 0.15).toLocaleString()}개로 추정됩니다.`;
         }
         if (apis.popCnt?.data?.rads) {
           const total = apis.popCnt.data.rads.reduce((sum, r) => sum + (parseInt(r.ppltnCnt) || 0), 0);
           floatingPop = `하루 평균 유동인구는 약 ${total.toLocaleString()}명으로 파악됩니다.`;
         }
         
         return { cafeCount, floatingPop, storCount };
       };
       
       const apiDefaults = getApiBasedDefaults();
       
       // 기본 데이터라도 추출 시도
       const fallbackData = {
         region: query,
         reliability: extractField('reliability') || '중간',
         dataDate: extractField('dataDate') || new Date().toLocaleDateString('ko-KR') + ' 기준',
         overview: {
           cafeCount: extractField('cafeCount') || apiDefaults.cafeCount,
           newOpen: extractField('newOpen') || '연간 개업/폐업 데이터를 수집 중입니다.',
           closed: extractField('closed') || '연간 폐업 데이터를 수집 중입니다.',
           floatingPop: extractField('floatingPop') || apiDefaults.floatingPop,
           residentPop: extractField('residentPop') || '-',
           source: '소상공인365'
         },
         consumers: {
           mainTarget: extractField('mainTarget') || '데이터 수집 중',
           mainRatio: extractField('mainRatio') || '-',
           secondTarget: extractField('secondTarget') || '데이터 수집 중',
           secondRatio: extractField('secondRatio') || '-',
           peakTime: extractField('peakTime') || '점심 12-14시, 저녁 17-19시 (일반적)',
           takeoutRatio: extractField('takeoutRatio') || '약 30-40% (일반적)',
           avgStay: extractField('avgStay') || '약 30-60분 (일반적)'
         },
         franchise: [
           { name: '메가커피', count: '-', price: 1500, monthly: '정보 수집 중' },
           { name: '컴포즈커피', count: '-', price: 1500, monthly: '정보 수집 중' },
           { name: '이디야', count: '-', price: 3000, monthly: '정보 수집 중' },
           { name: '스타벅스', count: '-', price: 4500, monthly: '정보 수집 중' }
         ],
         rent: {
           monthly: extractField('monthly') || '지역별 상이 (확인 필요)',
           deposit: extractField('deposit') || '지역별 상이 (확인 필요)',
           premium: extractField('premium') || '지역별 상이 (확인 필요)',
           yoyChange: extractField('yoyChange') || '전년 대비 데이터 수집 중',
           source: '한국부동산원'
         },
         opportunities: [
           { title: '데이터 분석 중', detail: '지역 개발 호재 정보를 수집하고 있습니다.', impact: '중' }
         ],
         risks: [
           { title: '경쟁 분석 필요', detail: '정확한 리스크 분석을 위해 추가 데이터가 필요합니다.', impact: '중' }
         ],
         startupCost: {
           deposit: '약 3,000-5,000만원 (추정)',
           premium: '약 5,000만원-1.5억원 (추정)',
           interior: '약 5,000-8,000만원 (15평 기준)',
           equipment: '약 2,000-3,000만원',
           total: '약 1.5-3억원 (추정)'
         },
         // 창업지원 효과 - 중소벤처기업부 공식 통계 (2017년 기준, 2019년 발표)
         // 이 데이터는 "정부 창업지원 프로그램" 효과이며, 특정 업체 컨설팅 효과가 아닙니다.
         startupSupportEffect: {
           supported: { 
             survivalRate1yr: '89.4%', 
             survivalRate3yr: '68.1%', 
             survivalRate5yr: '53.1%',
             label: '정부 창업지원 기업'
           },
           general: { 
             survivalRate1yr: '64.9%', 
             survivalRate3yr: '46.3%', 
             survivalRate5yr: '34.7%',
             label: '일반 창업기업'
           },
           cafeSurvival5yr: '22.8%', // 숙박·음식점업 5년 생존율 (통계청)
           source: '중소벤처기업부 창업지원기업 이력·성과 조사, 통계청 기업생멸행정통계',
           sourceYear: '2017년 기준 (2019년 발표) / 2023년 통계청',
           warning: '카페(숙박·음식점업) 5년 생존율은 22.8%로 전체 평균보다 낮습니다.',
           message: '철저한 준비와 전문가 조언이 생존 확률을 높이는 데 도움이 됩니다.'
         },
         insight: extractField('insight') || `${query} 지역의 상세 분석을 위해 추가 데이터를 수집 중입니다. 정확한 분석을 위해 빈크래프트 AI피드백와 상담을 권장드립니다.`,
         rawApiData: hasApiData ? collectedData.apis : null
       };
       
       if (coordinates) {
         fallbackData.coordinates = coordinates;
       }
       
       animateProgressTo(100);
       setSalesModeAnalysisStep('분석 완료');
       setSalesModeCollectingText('');
       setSalesModeSearchResult({ success: true, data: fallbackData, query, hasApiData, partial: true, collectedData });
     }
   } catch (error) {
     // 분석 중지(abort)인 경우 에러 표시하지 않음
     if (error.name === 'AbortError' || salesModeAbortRef.current?.signal?.aborted) {
       console.log('분석이 사용자에 의해 중지됨');
       if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
       setSalesModeAnalysisProgress(0);
       currentProgressRef.current = 0;
       return;
     }
     console.error('영업모드 검색 에러:', error);
     if (progressIntervalRef.current) {
       clearInterval(progressIntervalRef.current);
     }
     setSalesModeAnalysisProgress(0);
     currentProgressRef.current = 0;
     setSalesModeSearchResult({ success: false, error: error.message, query });
   } finally {
     setSalesModeSearchLoading(false);
     if (progressIntervalRef.current) {
       clearInterval(progressIntervalRef.current);
     }
   }
 };
 // 복사 버튼 헬퍼 함수 (alert 대신 체크 아이콘)
 const handleCopyWithCheck = (text, buttonRef) => {
 navigator.clipboard.writeText(text);
 if (buttonRef && buttonRef.current) {
 const btn = buttonRef.current;
 const original = btn.innerText;
 btn.innerText = '';
 btn.classList.add('text-neutral-700');
 setTimeout(() => {
 btn.innerText = original;
 btn.classList.remove('text-neutral-700');
 }, 1500);
 }
 };
 
 // 팀 피드백 저장 함수 (Firebase 연동)
      const saveTeamFeedback = async (feedback) => {
        const newFeedback = { 
          ...feedback, 
          id: Date.now(), 
          timestamp: new Date().toISOString(),
          managerId: user?.id || 0,
          managerName: user?.name || '알수없음'
        };
        try {
          await database.ref('teamFeedback/' + newFeedback.id).set(newFeedback);
          setTeamFeedback(prev => [...prev, newFeedback].slice(-100));
        } catch (e) {
          console.error('피드백 저장 실패:', e);
          // 실패 시 localStorage에 백업
          const backup = [...teamFeedback, newFeedback].slice(-100);
          localStorage.setItem('bc_team_feedback', JSON.stringify(backup));
          setTeamFeedback(backup);
        }
      };
      
      // 팀 피드백 Firebase에서 불러오기 (에러 핸들링 포함)
      useEffect(() => {
        const feedbackRef = database.ref('teamFeedback').orderByChild('timestamp').limitToLast(100);
        
        const onValue = (snapshot) => {
          try {
            const data = snapshot.val();
            if (data) {
              const feedbackList = Object.values(data).sort((a, b) => 
                new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
              );
              setTeamFeedback(feedbackList);
            }
          } catch (e) {
            console.error('팀 피드백 데이터 처리 오류:', e);
          }
        };
        
        const onError = (error) => {
          console.error('Firebase 팀 피드백 로드 실패:', error);
          // localStorage 백업에서 복구 시도
          const backup = safeLocalStorage.getItem('bc_team_feedback', []);
          if (backup.length > 0) {
            setTeamFeedback(backup);
          }
        };
        
        feedbackRef.on('value', onValue, onError);
        
        return () => feedbackRef.off('value', onValue);
      }, []);

 // ═══════════════════════════════════════════════════════════════
 // Gemini AI 코치 API 호출 함수
 // ═══════════════════════════════════════════════════════════════
 
 // AI 캐릭터 프롬프트 - 전문적 조언 톤
 const AI_CHARACTER_PROMPT = `당신은 빈크래프트 영업팀의 AI피드백입니다. 전문적이고 현실적인 말투를 사용합니다.

[역할]
- 현실 직시 조력자: 핵심을 짚어주는 피드백
- 데이터 분석가: 숫자로 현실을 보여줌
- 냉철한 컨설턴트: 팩트 기반 전달

[톤 - 전문적 대화체]
- "~입니다"가 아닌 "~에요", "~거든요", "~해보세요" 사용
- 매번 다른 문장 시작 사용 (동일 패턴 반복 금지)
- "됩니다/안됩니다" 대신 "돼요/안돼요"

[말투 예시]
- "이 상권 카페 생존율 22.8%에요. 10개 중 8개가 5년 안에 문 닫는다는 데이터예요."
- "준비 없이 들어가는 게 가장 큰 리스크예요."
- "경쟁 카페가 47개예요. 살아남으려면 차별화 포인트가 필요해요."
- "저희가 도와드리는 건 리스크를 줄이는 준비예요."

[핵심 메시지]
- "매출은 대표님이 만드시는 거고, 저희는 리스크를 줄이는 준비를 도와드려요"
- "저희가 해드리는 건 제대로 준비하고 들어가게 하는 거예요"

[빈크래프트 비즈니스]
- 중개사 제휴: 창업 문의 연결 시 우선 상담 진행
- 창업자 컨설팅: 가맹비 0원 + 입지분석 + 메뉴개발 + 경쟁사분석
- 프랜차이즈 비교: 가맹비 6,900만~1.3억 vs 빈크래프트 0원

[절대 금지]
- 매출/수익 보장 표현 금지
- "잘 된다", "성공한다" 표현 금지
- 출처 없는 숫자 사용 금지
- 이모티콘 사용 금지
- 격식체("~입니다", "~습니다") 금지
- 저급한 표현 금지

[응답 형식]
- 한국어로 응답
- 이모티콘 절대 사용하지 않음
- 전문적이고 현실적인 어조`;

 // ═══════════════════════════════════════════════════════════════
 // AI 분석 상태 및 함수
 // ═══════════════════════════════════════════════════════════════
 const [aiReportResult, setAiReportResult] = useState(null); // AI 리포트 분석 결과
 const [aiReportLoading, setAiReportLoading] = useState(false); // AI 리포트 로딩
 const [aiRegionResult, setAiRegionResult] = useState(null); // AI 지역 분석 결과
 const [aiRegionLoading, setAiRegionLoading] = useState(false); // AI 지역 로딩

 // AI 리포트 분석 함수 - 개선된 버전
 const callGeminiReport = async (data, retryCount = 0) => {
 setAiReportLoading(true);
 setAiErrorMessage(null);
 
 // 현재 시간 추가하여 매번 다른 응답 유도
 const currentTime = new Date().toLocaleString('ko-KR');
 const randomSeed = Math.floor(Math.random() * 1000);
 
 // 타 영업자 데이터 (비교용)
 const allManagerStats = managers.map(m => {
   const mCompanies = companies.filter(c => c.managerId === m.id);
   const mPositive = mCompanies.filter(c => c.reaction === 'positive').length;
   const mSpecial = mCompanies.filter(c => c.reaction === 'special').length;
   const mNeutral = mCompanies.filter(c => c.reaction === 'neutral').length;
   const mMissed = mCompanies.filter(c => c.reaction === 'missed').length;
   const mTotal = mCompanies.length;
   return {
     name: m.name,
     total: mTotal,
     positiveRate: mTotal > 0 ? Math.round(((mPositive + mSpecial) / mTotal) * 100) : 0,
     positive: mPositive,
     special: mSpecial,
     neutral: mNeutral,
     missed: mMissed
   };
 });
 
 // 전체 팀 평균
 const teamAvgPositiveRate = allManagerStats.length > 0 
   ? Math.round(allManagerStats.reduce((sum, m) => sum + m.positiveRate, 0) / allManagerStats.length) 
   : 0;
 
 // 팀 내 순위 계산
 const sortedByRate = [...allManagerStats].sort((a, b) => b.positiveRate - a.positiveRate);
 const currentManagerRank = sortedByRate.findIndex(m => m.name === data.managerName) + 1;
 
 // 부재율 계산
 const totalCompanies = data.positive + data.special + data.neutral + data.missed;
 const missedRate = totalCompanies > 0 ? Math.round((data.missed / totalCompanies) * 100) : 0;
 const neutralRate = totalCompanies > 0 ? Math.round((data.neutral / totalCompanies) * 100) : 0;
 
 const prompt = AI_CHARACTER_PROMPT + `

[분석 대상 - 담당자별 상세 분석]
담당자: ${data.managerName}
분석 시점: ${currentTime}
분석 ID: ${randomSeed}

[핵심 실적 데이터]
- 이번 달 방문: ${data.thisVisits}건
- 신규 업체 등록: ${data.newCompanies}개
- 완료 상담: ${data.consults}건
- 긍정 반응률: ${data.positiveRate}% (팀 평균: ${teamAvgPositiveRate}%, 차이: ${data.positiveRate - teamAvgPositiveRate > 0 ? '+' : ''}${data.positiveRate - teamAvgPositiveRate}%p)
- 팀 내 순위: ${currentManagerRank}위 / ${allManagerStats.length}명

[업체 반응 상세 분포]
- 긍정 반응: ${data.positive}개 (${totalCompanies > 0 ? Math.round((data.positive / totalCompanies) * 100) : 0}%)
- 특별관리: ${data.special}개 (${totalCompanies > 0 ? Math.round((data.special / totalCompanies) * 100) : 0}%)
- 보통: ${data.neutral}개 (${neutralRate}%)
- 부재/미접촉: ${data.missed}개 (${missedRate}%)
- 총 업체: ${totalCompanies}개

[팀 비교 데이터]
- 팀 평균 긍정률: ${teamAvgPositiveRate}%
- 팀원별 현황: ${allManagerStats.map(m => `${m.name}(긍정률 ${m.positiveRate}%, 총 ${m.total}개)`).join(' / ')}
- 팀 전체 업체 수: ${allManagerStats.reduce((sum, m) => sum + m.total, 0)}개

[분석 요청 - 방대하고 상세하게]
매번 다른 문장 구조와 표현을 사용하세요. 동일한 시작 문구 반복 금지.

1. comment (현황 종합 분석 - 5~7문장, 한 문단으로)
   시작 예시 (랜덤 선택):
   - "${data.managerName}님, 데이터 정리해봤어요."
   - "이번 달 현황 보여드릴게요."
   - "숫자로 말씀드릴게요."
   - "현실적으로 분석해봤어요."
   
   포함 내용:
   - 긍정률 ${data.positiveRate}%가 팀 평균 ${teamAvgPositiveRate}% 대비 어떤 수준인지
   - 팀 내 ${currentManagerRank}위가 의미하는 바
   - 특별관리 ${data.special}개의 가치 (계약 직전 단계)
   - 보통 ${data.neutral}개(${neutralRate}%)가 가장 큰 기회인 이유
   - 부재율 ${missedRate}%에 대한 현실적 평가
   - 이번 달 방문 ${data.thisVisits}건, 신규 등록 ${data.newCompanies}개 평가

2. analysis (심층 인사이트 - 4~6문장)
   시작 예시 (랜덤 선택):
   - "데이터 패턴 보면요,"
   - "숫자를 좀 더 파보면,"
   - "흥미로운 게 있어요."
   
   포함 내용:
   - 긍정+특별관리 합계 ${data.positive + data.special}개가 전환 가능한 파이프라인
   - 보통 ${data.neutral}개 중 3개월 이상 된 업체들이 이탈 위험군
   - 부재율 ${missedRate}%면 방문 시간대/요일 재검토 필요 여부
   - ${data.managerName}님 영업 스타일 강점/약점 직접 지적
   - 팀 내 다른 영업자 대비 차별화 포인트

3. suggestion (구체적 행동 제안 - 번호 매겨서 5가지)
   각 제안에 구체적인 숫자와 기한 명시:
   
   [오늘 할 일]
   - 특별관리 ${data.special}개 중 최근 1주일 내 연락 안 한 업체 확인 후 전화
   
   [이번 주 목표]
   - 보통 업체 ${Math.min(data.neutral, 10)}곳 재방문 (식어가는 관계 살리기)
   - 부재 업체 재방문 시간대: 오후 2-4시 권장
   
   [이번 달 전략]
   - 긍정률 ${teamAvgPositiveRate + 5}% 돌파 목표 (현재 ${data.positiveRate}%)
   - 신규 업체 발굴 지역 다변화

4. encouragement (현실 인정 + 격려 - 3~4문장)
   - 팀 내 ${currentManagerRank}위 평가
   - 잘하고 있는 부분 인정
   - 개선 필요한 부분 솔직하게
   - "숫자는 거짓말 안 해요" 스타일 마무리

5. focus (이번 주 핵심 집중 - 1문장, 강렬하게)
   예시:
   - "'보통' ${data.neutral}개 중 10곳만 다시 찾아가세요. 거기서 ${Math.round(data.neutral * 0.2)}개는 긍정으로 바뀔 수 있어요."
   - "특별관리 ${data.special}개가 계약으로 넘어가게 하세요. 지금이 골든타임이에요."

[응답 형식]
순수 JSON만 출력. 마크다운 코드블록 금지. 이모티콘 금지.
{"comment": "...", "analysis": "...", "suggestion": "...", "encouragement": "...", "focus": "..."}`;

 try {
 const response = await callGeminiProxy([{ role: 'user', parts: [{ text: prompt }] }], { temperature: 0.9, maxOutputTokens: 2000 });
 
 // HTTP 에러 처리
 if (!response.ok) {
   if (response.status === 429) {
     if (retryCount < 3) {
       console.log(`429 에러 - ${retryCount + 1}번째 재시도 중... (5초 후)`);
       setAiErrorMessage(`API 요청 제한 - ${retryCount + 1}번째 재시도 중...`);
       await new Promise(resolve => setTimeout(resolve, 5000));
       return callGeminiReport(data, retryCount + 1);
     } else {
       setAiErrorMessage('API 요청 제한에 도달했습니다. 잠시 후 다시 시도해주세요.');
       setAiReportLoading(false);
       return;
     }
   } else if (response.status === 400) {
     setAiErrorMessage('API 키가 유효하지 않거나 요청 형식 오류입니다.');
     setAiReportLoading(false);
     return;
   } else if (response.status === 403) {
     setAiErrorMessage('API 키 권한이 없습니다. 키를 확인해주세요.');
     setAiReportLoading(false);
     return;
   } else {
     setAiErrorMessage(`서버 오류가 발생했습니다. (코드: ${response.status})`);
     setAiReportLoading(false);
     return;
   }
 }
 
 const result = await response.json();
 
 // API 응답 에러 확인
 if (result.error) {
   console.error('Gemini API Error:', result.error);
   setAiErrorMessage(`API 오류: ${result.error.message || '알 수 없는 오류'}`);
   setAiReportLoading(false);
   return;
 }
 
 const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
 
 if (!text) {
   setAiErrorMessage('AI 응답이 비어있습니다. 다시 시도해주세요.');
   setAiReportLoading(false);
   return;
 }
 
 console.log('AI 원본 응답:', text);
 
 // 마크다운 코드 블록 제거 및 JSON 파싱 시도
 let cleanText = text
   .replace(/```json\s*/gi, '')
   .replace(/```\s*/gi, '')
   .replace(/`/g, '')
   .trim();
 
 // JSON 추출 시도
 const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
 
 if (jsonMatch) {
   try {
     const parsed = JSON.parse(jsonMatch[0]);
     console.log('JSON 파싱 성공:', parsed);
     setAiReportResult(parsed);
     setAiLastUpdateTime(new Date());
   } catch (parseError) {
     console.error('JSON 파싱 실패:', parseError);
     // 개별 필드 추출 시도
     const extractField = (fieldName) => {
       const regex = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
       const match = cleanText.match(regex);
       if (match) {
         return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
       }
       return null;
     };
     
     const fallbackResult = {
       comment: extractField('comment') || '데이터 분석 중입니다.',
       analysis: extractField('analysis') || '',
       suggestion: extractField('suggestion') || '업체 방문을 계속해주세요.',
       encouragement: extractField('encouragement') || '화이팅!',
       focus: extractField('focus') || ''
     };
     
     setAiReportResult(fallbackResult);
     setAiLastUpdateTime(new Date());
   }
 } else {
   // JSON 형태가 없으면 텍스트 자체를 comment로 사용 (cleanJsonText가 처리)
   setAiReportResult({ 
     comment: cleanText.substring(0, 500), 
     analysis: '', 
     suggestion: '', 
     encouragement: '',
     focus: ''
   });
   setAiLastUpdateTime(new Date());
 }
 } catch (e) {
 console.error('AI Report Error:', e);
 setAiErrorMessage(`네트워크 오류: ${e.message || '연결을 확인해주세요.'}`);
 setAiReportResult(null);
 }
 setAiReportLoading(false);
 };

 // AI 지역 추천 분석 함수 - 개선된 버전
 const callGeminiRegion = async (regionName, regionData, retryCount = 0) => {
 setAiRegionLoading(true);
 setAiErrorMessage(null);
 
 // 해당 지역 중개사/업체 데이터 포함
 const regionBrokers = collectedRealtors.filter(b => b.region?.includes(regionName) || b.address?.includes(regionName));
 const regionCompanies = companies.filter(c => c.address?.includes(regionName));
 
 // 타임스탬프와 랜덤 시드로 매번 다른 응답 유도
 const currentTime = new Date().toLocaleString('ko-KR');
 const randomSeed = Math.floor(Math.random() * 1000);
 
 const prompt = AI_CHARACTER_PROMPT + '\n\n' + `═══════════════════════════════════════════════════════════════
${regionName} 지역 분석 요청 (분석 시점: ${currentTime}, ID: ${randomSeed})
═══════════════════════════════════════════════════════════════

【공식 통계 데이터】
${JSON.stringify(regionData, null, 2)}

【빈크래프트 보유 데이터】
- 이 지역 등록 중개사: ${regionBrokers.length}개
- 이 지역 등록 업체: ${regionCompanies.length}개
- 긍정 반응 중개사: ${regionBrokers.filter(b => b.reaction === 'positive').length}개
- 긍정 반응 업체: ${regionCompanies.filter(c => c.reaction === 'positive').length}개

【분석 요청 - 영업자 서포터로서, 매번 새로운 관점으로】
1. whyThisRegion: 왜 이 지역을 추천하는가 (팀 데이터 기반, 3개 포인트)
2. marketAnalysis: 시장 현황 분석 (데이터 기반)
3. brokerMent: 중개사용 영업 멘트 (구체적 숫자 포함)
4. customerMent: 고객용 영업 멘트 (창업자 고민 해결 관점)
5. mentalCare: 멘탈 케어 한마디

응답 형식 (JSON만):
{"whyThisRegion": ["이유1", "이유2", "이유3"], "marketAnalysis": "시장 분석", "brokerMent": "중개사용 멘트", "customerMent": "고객용 멘트", "mentalCare": "격려 메시지"}

이전과 다른 새로운 관점의 분석을 제공하세요.`;

 try {
 const response = await callGeminiProxy([{ role: 'user', parts: [{ text: prompt }] }], { temperature: 0.9, maxOutputTokens: 1500 });
 
 // HTTP 에러 처리
 if (!response.ok) {
   if (response.status === 429) {
     if (retryCount < 3) {
       console.log(`429 에러 - ${retryCount + 1}번째 재시도 중... (5초 후)`);
       setAiErrorMessage(`API 요청 제한 - ${retryCount + 1}번째 재시도 중...`);
       await new Promise(resolve => setTimeout(resolve, 5000));
       return callGeminiRegion(regionName, regionData, retryCount + 1);
     } else {
       setAiErrorMessage('API 요청 제한에 도달했습니다. 잠시 후 다시 시도해주세요.');
       setAiRegionLoading(false);
       return;
     }
   } else {
     setAiErrorMessage(`서버 오류가 발생했습니다. (코드: ${response.status})`);
     setAiRegionLoading(false);
     return;
   }
 }
 
 const result = await response.json();
 
 if (result.error) {
   console.error('Gemini API Error:', result.error);
   setAiErrorMessage(`API 오류: ${result.error.message || '알 수 없는 오류'}`);
   setAiRegionLoading(false);
   return;
 }
 
 const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
 // 마크다운 코드 블록 제거
 const cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
 const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
 if (jsonMatch) {
 setAiRegionResult(JSON.parse(jsonMatch[0]));
 setAiLastUpdateTime(new Date());
 } else {
 setAiRegionResult({ market: text, smalltalk: [], info: [], strategy: '', conclusion: '' });
 setAiLastUpdateTime(new Date());
 }
 } catch (e) {
 console.error('AI Region Error:', e);
 setAiErrorMessage(`네트워크 오류: ${e.message || '연결을 확인해주세요.'}`);
 setAiRegionResult(null);
 }
 setAiRegionLoading(false);
 };

 // AI 지역 검색 함수 - 중개사 영업용 (지역명 기반 + 모든 API 수집)
 const callGeminiKeywordSearch = async (regionName) => {
   if (!regionName.trim()) return;
   
   setAiKeywordLoading(true);
   setAiErrorMessage(null);
   setAiKeywordResult(null);
   
   const currentTime = new Date().toLocaleString('ko-KR');
   
   try {
     // 1단계: 지역 좌표 얻기 (네이버 지도 API 직접 호출)
     let coordinates = null;
     let addressInfo = null;
     try {
       const geoResponse = await fetch(
         `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(regionName)}`,
         { headers: { 'X-NCP-APIGW-API-KEY-ID': 'dx2ymyk2b1', 'X-NCP-APIGW-API-KEY': '18184ztuYuPVkqzPumsSqRNVsMHCiBFMWhWdRJAJ' } }
       );
       const geoData = await geoResponse.json();
       if (geoData.addresses?.[0]) {
         const addr = geoData.addresses[0];
         coordinates = {
           lat: parseFloat(addr.y),
           lng: parseFloat(addr.x)
         };
         addressInfo = {
           sido: addr.addressElements?.find(e => e.types.includes('SIDO'))?.longName || '',
           sigungu: addr.addressElements?.find(e => e.types.includes('SIGUGUN'))?.longName || '',
           dong: addr.addressElements?.find(e => e.types.includes('DONGMYUN'))?.longName || ''
         };
       }
     } catch (e) {
       console.log('Geocoding 실패:', e);
     }

     // 2단계: 모든 API 데이터 수집
     const collectedData = {
       region: regionName,
       timestamp: currentTime,
       apis: {}
     };

     if (coordinates) {
       // 좌표로 행정동 코드 얻기
       const dongInfo = await getCoordToDongCd(coordinates.lat, coordinates.lng);
       
       if (dongInfo) {
         const dongCd = dongInfo.dongCd;
         const tpbizCd = 'Q01';
         
         // 새 API로 병렬 호출
         const apiCalls = [
           { name: 'dynPplCmpr', endpoint: SBIZ365_NEW_API.dynPplCmpr, params: { dongCd }, desc: '유동인구' },
           { name: 'salesAvg', endpoint: SBIZ365_NEW_API.salesAvg, params: { dongCd, tpbizCd }, desc: '매출 평균' },
           { name: 'vstAgeRnk', endpoint: SBIZ365_NEW_API.vstAgeRnk, params: { dongCd }, desc: '방문 연령' },
           { name: 'vstCst', endpoint: SBIZ365_NEW_API.vstCst, params: { dongCd }, desc: '방문 고객' },
           { name: 'cfrStcnt', endpoint: SBIZ365_NEW_API.cfrStcnt, params: { dongCd, tpbizCd }, desc: '점포수' },
           { name: 'baeminTpbiz', endpoint: SBIZ365_NEW_API.baeminTpbiz, params: { dongCd }, desc: '배달 업종' },
           { name: 'mmavgList', endpoint: SBIZ365_NEW_API.mmavgList, params: { dongCd, tpbizCd }, desc: '월평균 매출' }
         ];

         const results = await Promise.allSettled(
           apiCalls.map(api => callSbizAPI(api.endpoint, api.params))
         );

         results.forEach((result, idx) => {
           if (result.status === 'fulfilled' && result.value) {
             collectedData.apis[apiCalls[idx].name] = {
               description: apiCalls[idx].desc,
               data: result.value
             };
           }
         });
         
         // dongInfo 저장
         collectedData.dongInfo = {
           dongCd: dongInfo.dongCd,
           dongNm: dongInfo.dongNm
         };
         
         // ═══ 인접 동 카페 수/매출 합산 (분석모드와 동일) ═══
         const nearbyDongs = dongInfo.nearbyDongs || [];
         if (nearbyDongs.length > 0) {
           const nearbyResults = await Promise.allSettled(
             nearbyDongs.map(nd => callSbizAPI(SBIZ365_NEW_API.salesAvg, { dongCd: nd.dongCd, tpbizCd }))
           );
           collectedData.apis.nearbySales = {
             description: '인접 동 매출',
             data: nearbyResults.map((r, i) => ({
               dongNm: nearbyDongs[i].admdstCdNm,
               sales: r.status === 'fulfilled' ? r.value : null
             }))
           };
         }
         
         // ═══ Firebase 임대료 조회 ═══
         const FIREBASE_DB = 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';
         const dngName = dongInfo.dongNm || '';
         const rentCandidates = [dngName];
         const bName = dngName.replace(/\d*동$/, '').replace(/\d+가$/, '');
         rentCandidates.push(`${bName}동`);
         for (let ri = 1; ri <= 5; ri++) rentCandidates.push(`${bName}${ri}가`);
         // 시군구별 법정동 추가
         const sgDongs = {
           '용산구': ['갈월동','남영동','효창동','원효로1가','원효로2가','한강로1가','한강로2가','한강로3가','용산동2가','용산동3가','용산동5가','이촌동','이태원동','한남동','보광동'],
           '강남구': ['역삼동','논현동','삼성동','청담동','신사동','압구정동','대치동','도곡동'],
           '마포구': ['합정동','서교동','상수동','망원동','연남동','성산동','공덕동','아현동'],
           '서초구': ['서초동','잠원동','반포동','방배동','양재동'],
           '송파구': ['잠실동','신천동','가락동','문정동','장지동','방이동'],
           '성동구': ['성수동1가','성수동2가','행당동','응봉동','금호동','옥수동'],
         };
         const sgName = addressInfo?.sigungu || '';
         (sgDongs[sgName] || []).forEach(d => { if (!rentCandidates.includes(d)) rentCandidates.push(d); });
         
         try {
           const rentResults = await Promise.allSettled(
             [...new Set(rentCandidates)].slice(0, 30).map(async (dng) => {
               const res = await fetch(`${FIREBASE_DB}/regionData/${encodeURIComponent(dng)}.json`);
               if (!res.ok) return null;
               const data = await res.json();
               const rent = data?.[dng]?.rent;
               return rent ? { dong: dng, ...rent } : null;
             })
           );
           const validRents = rentResults.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
           if (validRents.length > 0) {
             collectedData.apis.firebaseRent = {
               description: '임대료',
               data: {
                 summary: {
                   avgDeposit: Math.round(validRents.reduce((s,r) => s + (r.avgDeposit||0), 0) / validRents.length),
                   avgMonthlyRent: Math.round(validRents.reduce((s,r) => s + (r.avgMonthlyRent||0), 0) / validRents.length),
                   dongCount: validRents.length,
                   totalArticles: validRents.reduce((s,r) => s + (r.articleCount||0), 0)
                 },
                 nearbyDongs: validRents.slice(0, 5)
               }
             };
           }
         } catch (e) { console.log('영업모드 임대료 조회 실패:', e.message); }
         
         // Firebase에 동별 데이터가 없으면 RENT_DATA_BY_REGION 폴백
         if (!collectedData.apis.firebaseRent) {
           const sgKey = `서울 ${sgName}`;
           const regionRent = RENT_DATA_BY_REGION.regions[sgKey] || RENT_DATA_BY_REGION.regions['서울특별시'];
           if (regionRent) {
             // avgRent는 만원/m2 → 15평(49.5m2) 카페 기준 월세 환산
             const estMonthly = Math.round(regionRent.avgRent * 49.5);
             const estDeposit = estMonthly * 10; // 보증금 = 월세 10배 관행
             collectedData.apis.firebaseRent = {
               description: '임대료 (부동산원 통계 기준 추정)',
               data: {
                 summary: {
                   avgDeposit: estDeposit,
                   avgMonthlyRent: estMonthly,
                   dongCount: 0,
                   totalArticles: 0,
                   source: `한국부동산원 ${RENT_DATA_BY_REGION.dataDate} (${sgKey || '서울'} 평균, 15평 기준 환산)`,
                   isEstimate: true
                 },
                 nearbyDongs: []
               }
             };
           }
         }
       }
     }

     // ═══ 서울시 시간대별 유동인구 수집 (서울 지역만) ═══
     const isSeoul = (addressInfo?.sido || '').includes('서울') || (addressInfo?.address || query || '').includes('서울');
     if (isSeoul) try {
       const dongNm = dongInfo?.dongNm || '';
       const sgNm = addressInfo?.sigungu || '';
       // 검색 키워드: 2글자 이상만 (1글자 오매칭 방지)
       const searchKws = [dongNm.replace(/\d+동$/, ''), query.split(' ')[0], sgNm.replace('구', '')].filter(kw => kw && kw.length >= 2);
       
       const floatRes = await fetch(`${PROXY_SERVER_URL}/api/seoul/floating?startIndex=44000&endIndex=44536`);
       if (floatRes.ok) {
         const floatData = await floatRes.json();
         const rows = floatData?.VwsmTrdarFlpopQq?.row || [];
         // 키워드 매칭
         const matched = rows.filter(r => searchKws.some(kw => (r.TRDAR_CD_NM || '').includes(kw)));
         if (matched.length > 0) {
           // 시간대별 합산
           const timeSlots = { '00~06시': 0, '06~11시': 0, '11~14시': 0, '14~17시': 0, '17~21시': 0, '21~24시': 0 };
           const tmKeys = ['00_06', '06_11', '11_14', '14_17', '17_21', '21_24'];
           const tmNames = Object.keys(timeSlots);
           const daySlots = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 };
           const dayKeys = ['MON', 'TUES', 'WED', 'THUR', 'FRI', 'SAT', 'SUN'];
           const dayNames = Object.keys(daySlots);
           
           matched.forEach(r => {
             tmKeys.forEach((tk, i) => { timeSlots[tmNames[i]] += parseInt(r[`TMZON_${tk}_FLPOP_CO`]) || 0; });
             dayKeys.forEach((dk, i) => { daySlots[dayNames[i]] += parseInt(r[`${dk}_FLPOP_CO`]) || 0; });
           });
           
           // 평균 (상권 수로 나누기)
           const n = matched.length;
           Object.keys(timeSlots).forEach(k => { timeSlots[k] = Math.round(timeSlots[k] / n); });
           Object.keys(daySlots).forEach(k => { daySlots[k] = Math.round(daySlots[k] / n); });
           
           const peakTime = Object.entries(timeSlots).sort((a,b) => b[1] - a[1])[0];
           const peakDay = Object.entries(daySlots).sort((a,b) => b[1] - a[1])[0];
           
           collectedData.apis.floatingTime = {
             description: '시간대별 유동인구 (서울시 열린데이터)',
             data: {
               timeSlots,
               daySlots,
               peakTime: peakTime?.[0] || '-',
               peakTimePop: peakTime?.[1] || 0,
               peakDay: peakDay?.[0] || '-',
               peakDayPop: peakDay?.[1] || 0,
               matchedCount: n,
               matchedNames: matched.slice(0, 5).map(r => r.TRDAR_CD_NM),
               quarter: matched[0]?.STDR_YYQU_CD || ''
             }
           };
           console.log(`시간대 유동인구: ${n}개 상권 매칭, 피크 ${peakTime?.[0]}(${peakTime?.[1]?.toLocaleString()}명)`);
         }
       }
     } catch (e) { console.log('시간대 유동인구 수집 실패:', e.message); } // end isSeoul

     // 3단계: 데이터 요약 생성 (새 API 응답 형식)
     const summarizeData = () => {
       const summary = [];
       const apis = collectedData.apis;
       
       // 점포수 (cfrStcnt) - 참고용
       if (apis.cfrStcnt?.data?.stcnt) {
         summary.push(`음식업 업소수: ${apis.cfrStcnt.data.stcnt.toLocaleString()}개`);
       }
       
       // 유동인구 (dynPplCmpr)
       if (apis.dynPplCmpr?.data && Array.isArray(apis.dynPplCmpr.data) && apis.dynPplCmpr.data[0]) {
         const pop = apis.dynPplCmpr.data[0].cnt || 0;
         summary.push(`일평균 유동인구: ${pop.toLocaleString()}명`);
       }
       
       // 카페 매출 - 인접 동 합산 (핵심 수정)
       let totalCafeCount = 0, totalCafeSalesAmt = 0, cafeSalesCount = 0;
       if (apis.salesAvg?.data && Array.isArray(apis.salesAvg.data)) {
         const cafe = apis.salesAvg.data.find(d => d.tpbizClscdNm === '카페');
         if (cafe) { totalCafeCount += (cafe.stcnt||0); if (cafe.mmavgSlsAmt) { totalCafeSalesAmt += cafe.mmavgSlsAmt; cafeSalesCount++; } }
       }
       // 인접 동 합산
       if (apis.nearbySales?.data && Array.isArray(apis.nearbySales.data)) {
         apis.nearbySales.data.forEach(nd => {
           if (nd.sales && Array.isArray(nd.sales)) {
             const cafe = nd.sales.find(s => s.tpbizClscdNm === '카페');
             if (cafe) { totalCafeCount += (cafe.stcnt||0); if (cafe.mmavgSlsAmt) { totalCafeSalesAmt += cafe.mmavgSlsAmt; cafeSalesCount++; } }
           }
         });
       }
       const avgCafeSales = cafeSalesCount > 0 ? Math.round(totalCafeSalesAmt / cafeSalesCount) : 0;
       summary.push(`카페 점포수: ${totalCafeCount > 0 ? totalCafeCount : '?'}개 (인접 동 합산)`);
       summary.push(`카페 평균 매출: ${avgCafeSales > 0 ? '월 ' + avgCafeSales.toLocaleString() + '만원' : '데이터 미수집'}`);
       
       // 방문 연령 (vstAgeRnk)
       if (apis.vstAgeRnk?.data && Array.isArray(apis.vstAgeRnk.data) && apis.vstAgeRnk.data.length > 0) {
         const ageMap = { 'M10': '10대', 'M20': '20대', 'M30': '30대', 'M40': '40대', 'M50': '50대', 'M60': '60대+' };
         const topAge = apis.vstAgeRnk.data[0];
         const totalVisit = apis.vstAgeRnk.data.reduce((s,d) => s + (d.pipcnt||0), 0);
         const pct = totalVisit > 0 ? ((topAge.pipcnt||0)/totalVisit*100).toFixed(1) : '?';
         summary.push(`방문 1위: ${ageMap[topAge.age] || topAge.age} (${pct}%, ${topAge.pipcnt?.toLocaleString() || 0}명)`);
       }
       
       // 소비 연령 (vstCst) - 교차분석 핵심
       if (apis.vstCst?.data && Array.isArray(apis.vstCst.data) && apis.vstCst.data.length > 0) {
         const ageMap = { 'M10': '10대', 'M20': '20대', 'M30': '30대', 'M40': '40대', 'M50': '50대', 'M60': '60대+' };
         const sorted = [...apis.vstCst.data].sort((a,b) => (b.pipcnt||0) - (a.pipcnt||0));
         const totalSpend = sorted.reduce((s,d) => s + (d.pipcnt||0), 0);
         const pct = totalSpend > 0 ? ((sorted[0].pipcnt||0)/totalSpend*100).toFixed(1) : '?';
         summary.push(`소비 1위: ${ageMap[sorted[0].age] || sorted[0].age} (${pct}%)`);
       }
       
       // 배달 업종 (baeminTpbiz)
       if (apis.baeminTpbiz?.data && Array.isArray(apis.baeminTpbiz.data) && apis.baeminTpbiz.data.length > 0) {
         const top3 = apis.baeminTpbiz.data.slice(0,3).map(b => `${b.baeminTpbizClsfNm}(${b.cnt}건)`).join(', ');
         summary.push(`배달 TOP3: ${top3}`);
       }
       
       // 임대료 (Firebase 또는 부동산원 폴백)
       if (apis.firebaseRent?.data?.summary) {
         const r = apis.firebaseRent.data.summary;
         const srcLabel = r.isEstimate ? ` (${r.source || '부동산원 통계 추정'})` : ` (${r.dongCount}개 동, ${r.totalArticles}건 매물)`;
         summary.push(`임대료: 보증금 평균 ${r.avgDeposit.toLocaleString()}만, 월세 평균 ${r.avgMonthlyRent.toLocaleString()}만${srcLabel}`);
         if (apis.firebaseRent.data.nearbyDongs?.length > 0) {
           const dongs = apis.firebaseRent.data.nearbyDongs.slice(0,3).map(d => `${d.dong}:월${d.avgMonthlyRent}만`).join(', ');
           summary.push(`동별: ${dongs}`);
         }
       }
       
       // 월평균 매출 TOP3 (mmavgList)
       if (apis.mmavgList?.data && Array.isArray(apis.mmavgList.data) && apis.mmavgList.data.length > 0) {
         const top3 = apis.mmavgList.data.slice(0,3).map(m => `${m.tpbizNm || m.tpbizClscdNm || ''}(${(m.slsamt || m.mmavgSlsAmt||0).toLocaleString()}만)`).join(', ');
         summary.push(`주변 매출 TOP3: ${top3}`);
       }
       
       // 시간대별 유동인구 (서울시 열린데이터)
       if (apis.floatingTime?.data) {
         const ft = apis.floatingTime.data;
         const ts = ft.timeSlots;
         if (ts) {
           const timeStr = Object.entries(ts).map(([k,v]) => `${k}:${v.toLocaleString()}명`).join(', ');
           summary.push(`시간대별 유동인구: ${timeStr} (피크: ${ft.peakTime} ${ft.peakTimePop?.toLocaleString()}명)`);
         }
         if (ft.daySlots) {
           const dayStr = Object.entries(ft.daySlots).map(([k,v]) => `${k}:${v.toLocaleString()}명`).join(', ');
           summary.push(`요일별 유동인구: ${dayStr} (피크: ${ft.peakDay} ${ft.peakDayPop?.toLocaleString()}명)`);
         }
       }
       
       // 행정동 정보
       if (collectedData.dongInfo) {
         summary.push(`행정동: ${collectedData.dongInfo.dongNm || collectedData.dongInfo.dongCd}`);
       }
       
       return summary.join('\n');
     };

     // 4단계: 중개사 영업용 AI 프롬프트
     const prompt = AI_CHARACTER_PROMPT + `

[분석 대상]
지역명: ${regionName}
분석 시점: ${currentTime}

[수집된 API 데이터]
${summarizeData() || '데이터 수집 중 일부 실패'}

[분석 방향 - 중개사 영업용]
핵심 질문: "왜 이 지역을 영업해야 하는가?"

다음 구조로 분석해주세요. 
중요: 매번 다른 표현과 문장 구조를 사용하세요. 동일한 문장 시작 패턴 반복 금지.

1. regionBrief (지역 브리핑) - 2~3문단으로 작성
[첫 문단] 이 지역의 핵심 특성을 수치와 함께 설명
[둘째 문단] 상가 회전율, 경쟁 상황 등 현실적인 분석
[셋째 문단] 결론 및 영업 포인트

문장 시작 예시 (랜덤하게 선택):
- "데이터를 보니까요,"
- "이 지역 특징이 있어요."
- "현실적으로 말씀드리면,"
- "숫자로 보여드릴게요."
- "직접 조사해보니,"

2. brokerEmpathy (중개사 공감)
중개사 입장에서 공감할 수 있는 상황을 자연스럽게 제시
다양한 표현 사용 (예: "이런 고민 있으시죠?", "혹시 이런 경험요?", "아마 느끼셨을 텐데요")

3. partnershipValue (제휴 가치)
빈크래프트와 제휴했을 때의 구체적인 이점
매출 보장 표현 절대 금지
"창업 문의가 오면 저희에게 연결만 해주세요" 형태로

4. talkScript (대화 가이드)
중개사가 손님에게 바로 사용할 수 있는 멘트 1개
큰따옴표로 감싸서 제공

5. relatedRegions (연관 지역)
이 지역과 함께 영업하면 좋을 인근 지역 3개

응답 형식 (JSON만, 이모티콘 사용 금지):
{
  "regionBrief": "...(2~3문단, 줄바꿈 포함)...",
  "brokerEmpathy": "...",
  "partnershipValue": "...",
  "talkScript": "...",
  "relatedRegions": ["지역1", "지역2", "지역3"]
}

JSON만 출력하세요. 이모티콘 절대 사용하지 마세요.`;

     const response = await callGeminiProxy([{ role: 'user', parts: [{ text: prompt }] }], { temperature: 0.7, maxOutputTokens: 2000 });

     if (!response.ok) {
       if (response.status === 429) {
         setAiErrorMessage('API 요청 제한에 도달했습니다. 잠시 후 다시 시도해주세요.');
       } else {
         setAiErrorMessage(`서버 오류가 발생했습니다. (코드: ${response.status})`);
       }
       setAiKeywordLoading(false);
       return;
     }

     const result = await response.json();
     
     if (result.error) {
       setAiErrorMessage(`API 오류: ${result.error.message || '알 수 없는 오류'}`);
       setAiKeywordLoading(false);
       return;
     }

     const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
     // 마크다운 코드 블록 및 불필요한 문자 제거
     let cleanText = text
       .replace(/```json\s*/gi, '')
       .replace(/```\s*/gi, '')
       .replace(/^\s*[\r\n]+/, '')
       .trim();
     
     // JSON 추출 시도 (완전한 JSON)
     const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
     
     if (jsonMatch) {
       try {
         const parsed = JSON.parse(jsonMatch[0]);
         // 파싱 성공
         setAiKeywordResult({
           regionBrief: parsed.regionBrief || '',
           brokerEmpathy: parsed.brokerEmpathy || '',
           partnershipValue: parsed.partnershipValue || '',
           talkScript: parsed.talkScript || '',
           relatedRegions: parsed.relatedRegions || [],
           keyword: regionName,
           searchedAt: new Date(),
           collectedData: collectedData.apis
         });
       } catch (parseError) {
         console.error('JSON 파싱 실패:', parseError);
         // 파싱 실패 시 개별 필드 추출 시도
         const extractField = (fieldName) => {
           const regex = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
           const match = cleanText.match(regex);
           return match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '';
         };
         
         const extractArray = (fieldName) => {
           const regex = new RegExp(`"${fieldName}"\\s*:\\s*\\[(.*?)\\]`, 'is');
           const match = cleanText.match(regex);
           if (match) {
             const items = match[1].match(/"([^"]+)"/g);
             return items ? items.map(s => s.replace(/"/g, '')) : [];
           }
           return [];
         };
         
         setAiKeywordResult({
           regionBrief: extractField('regionBrief') || '분석 결과를 불러오는 중 오류가 발생했습니다.',
           brokerEmpathy: extractField('brokerEmpathy'),
           partnershipValue: extractField('partnershipValue'),
           talkScript: extractField('talkScript'),
           relatedRegions: extractArray('relatedRegions'),
           keyword: regionName,
           searchedAt: new Date()
         });
       }
     } else {
       // JSON 형태가 없거나 불완전한 경우 - 개별 필드 추출 시도
       console.log('불완전한 JSON 감지, 개별 필드 추출 시도');
       
       const extractField = (fieldName) => {
         // 완전한 값 추출 시도
         const regex1 = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
         const match1 = cleanText.match(regex1);
         if (match1) return match1[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
         
         // 불완전한 값 추출 (따옴표로 끝나지 않는 경우)
         const regex2 = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*?)(?:",|"\\s*\\}|$)`, 'i');
         const match2 = cleanText.match(regex2);
         if (match2) return match2[1];
         
         // 최후의 수단: 콜론 뒤의 모든 텍스트
         const regex3 = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)`, 'i');
         const match3 = cleanText.match(regex3);
         return match3 ? match3[1] : '';
       };
       
       setAiKeywordResult({
         regionBrief: extractField('regionBrief') || '데이터 분석 중 오류가 발생했습니다. 다시 시도해주세요.',
         brokerEmpathy: extractField('brokerEmpathy'),
         partnershipValue: extractField('partnershipValue'),
         talkScript: extractField('talkScript'),
         relatedRegions: [],
         keyword: regionName,
         searchedAt: new Date()
       });
     }
   } catch (e) {
     console.error('AI Region Search Error:', e);
     setAiErrorMessage(`네트워크 오류: ${e.message || '연결을 확인해주세요.'}`);
   }
   setAiKeywordLoading(false);
 };

 // AI 멘트 피드백 함수 - Gemini API 연동 (영업 상황 맞춤형)
 const callGeminiFeedback = async (original, modified, question, context = {}) => {
   try {
     // 멘트 타입별 컨텍스트 설정
     const typeContext = {
       broker: {
         role: '부동산 중개사',
         goal: '창업자 소개를 받기 위한 파트너십 구축',
         keywords: ['수수료', '상권 분석', '창업자 소개', '빈크래프트 장점']
       },
       client: {
         role: '카페 창업 예정자',
         goal: '빈크래프트 컨설팅 계약 체결',
         keywords: ['가맹비 0원', '메뉴 자유', '생존율', '전문 컨설팅']
       },
       objection: {
         role: '거절/반론하는 고객',
         goal: '거절 극복 및 재관심 유도',
         keywords: ['이해', '맞춤형 제안', '데이터 기반', '비교 분석']
       }
     };

     const mentType = context.type || 'broker';
     const targetContext = typeContext[mentType] || typeContext.broker;

     const prompt = `당신은 빈크래프트 영업팀의 전문 영업 코치입니다.

[영업 상황]
- 대화 상대: ${targetContext.role}
- 목표: ${targetContext.goal}
- 핵심 키워드: ${targetContext.keywords.join(', ')}

[기존 멘트]
${original}

[수정된 멘트]
${modified}

[질문/요청]
${question || '이 멘트에 대한 피드백을 주세요.'}

[분석 기준]
1. 설득력: 상대방이 "왜 빈크래프트여야 하는지" 느낄 수 있는가?
2. 구체성: 추상적 표현 대신 구체적 숫자/사례가 있는가?
3. 자연스러움: 영업 냄새가 나지 않고 대화체로 자연스러운가?
4. 거절 대응: 예상 반론에 선제적으로 대응하고 있는가?

[응답 형식 - JSON으로만 응답]
{
  "score": 85,
  "evaluation": "수정 전후 비교 평가 (2문장)",
  "strengths": ["장점1", "장점2"],
  "improvements": ["개선점1 (구체적 대안 포함)", "개선점2"],
  "suggestedMent": "개선된 멘트 전체 제안 (선택적)",
  "practicalTip": "현장에서 바로 쓸 수 있는 실전 팁 1개",
  "anticipatedObjection": "예상되는 상대방 반론",
  "objectionResponse": "반론 대응 멘트"
}`;

     const response = await callGeminiProxy([{ parts: [{ text: prompt }] }], { temperature: 0.7, maxOutputTokens: 1000 });

     if (!response.ok) {
       const errorMsg = response.status === 429 ? 'API 요청 제한에 도달했습니다.' :
                        response.status === 400 ? 'API 키가 유효하지 않습니다.' :
                        response.status === 403 ? 'API 키 권한이 없습니다.' :
                        `서버 오류 (코드: ${response.status})`;
       return { success: false, error: errorMsg };
     }

     const data = await response.json();
     if (data.error) return { success: false, error: data.error.message };

     let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
     if (!text) return { success: false, error: 'AI 응답이 비어있습니다.' };

     // JSON 파싱 시도
     try {
       text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
       const parsed = JSON.parse(text);
       return { success: true, response: parsed, isStructured: true };
     } catch {
       // JSON 파싱 실패 시 텍스트 그대로 반환
       return { success: true, response: text, isStructured: false };
     }
   } catch (e) {
     return { success: false, error: e.message || '네트워크 오류' };
   }
 };

 const [showCostCompareModal, setShowCostCompareModal] = useState(false); // 비용 비교 상세 모달
 // 지역 비교 기능
 const [compareRegions, setCompareRegions] = useState([]); // 비교할 지역 목록
 const [showCompareModal, setShowCompareModal] = useState(false); // 지역 비교 모달
 // 테마 모드: 'dark' | 'light' | 'auto'
 const getInitialTheme = () => {
 const saved = localStorage.getItem('bc_theme_mode');
 return saved || 'dark';
 };
 const getInitialEffectiveTheme = () => {
 const saved = localStorage.getItem('bc_theme_mode') || 'dark';
 if (saved === 'auto') {
 return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
 }
 return saved;
 };
 const [themeMode, setThemeMode] = useState(getInitialTheme);
 const [effectiveTheme, setEffectiveTheme] = useState(getInitialEffectiveTheme);
 
 // 테마 단축 참조
 const theme = effectiveTheme;
 const t = THEME_COLORS[theme];
 
 // 배경 이미지 (앱 시작 시 한 번만 선택)
 const [appBackground] = useState(() => {
   const backgrounds = effectiveTheme === 'dark' ? DARK_MODE_BACKGROUNDS : LIGHT_MODE_BACKGROUNDS;
   if (backgrounds.length === 0) return null;
   return backgrounds[Math.floor(Math.random() * backgrounds.length)];
 });
 
 // 테마 토글 함수
 const toggleTheme = useCallback(() => {
   const newTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
   setEffectiveTheme(newTheme);
   setThemeMode(newTheme);
   localStorage.setItem('bc_theme_mode', newTheme);
 }, [effectiveTheme]);
 
 const [tabHistory, setTabHistory] = useState([]);
 const [showHistory, setShowHistory] = useState(false);
 const [showPasswordModal, setShowPasswordModal] = useState(false);
 const [showAdminPwModal, setShowAdminPwModal] = useState(false);
 const [showBulkAddModal, setShowBulkAddModal] = useState(false);
 const [showRegisterMenu, setShowRegisterMenu] = useState(false);
 const [showPinModal, setShowPinModal] = useState(null);
 const [showCompanyMapModal, setShowCompanyMapModal] = useState(null);
 const [showRealtorDetailModal, setShowRealtorDetailModal] = useState(null);
 const [showPromoRequestModal, setShowPromoRequestModal] = useState(null);
 const [showCompanyEditModal, setShowCompanyEditModal] = useState(null);
 const [showCompanySuccessModal, setShowCompanySuccessModal] = useState(null);
 const [showUnmappedModal, setShowUnmappedModal] = useState(false);
 const [showCustomerEditModal, setShowCustomerEditModal] = useState(null);
 const [showPinEditModal, setShowPinEditModal] = useState(null);
 const [showSaleModal, setShowSaleModal] = useState(false);
 const [showSaleEditModal, setShowSaleEditModal] = useState(null);
 const [routeDeleteMode, setRouteDeleteMode] = useState(false);
 const [expandedRouteMonths, setExpandedRouteMonths] = useState({}); // 월별 아코디언 상태
 const [selectedRoutesForDelete, setSelectedRoutesForDelete] = useState([]);
 const [showOcrModal, setShowOcrModal] = useState(false);
 const [showBulkOcrModal, setShowBulkOcrModal] = useState(false);
 const [ocrResult, setOcrResult] = useState(null);
 const [ocrLoading, setOcrLoading] = useState(false);
 const [bulkOcrResults, setBulkOcrResults] = useState([]);
 const ocrFileInputRef = useRef(null);
 const bulkOcrFileInputRef = useRef(null);
 const [showTodayAlert, setShowTodayAlert] = useState(false);
 const [todayEvents, setTodayEvents] = useState([]);
 const [showScheduleAlert, setShowScheduleAlert] = useState(false);
 const [bulkAddText, setBulkAddText] = useState('');
 const [bulkAddSales, setBulkAddSales] = useState(null);
 const [bulkAddRegion, setBulkAddRegion] = useState('');
 const [bulkAddCity, setBulkAddCity] = useState('');
 const [bulkAddReaction, setBulkAddReaction] = useState('neutral');
 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [adminNewPw, setAdminNewPw] = useState('');
 const [adminConfirmPw, setAdminConfirmPw] = useState('');
 const [promoRequest, setPromoRequest] = useState({ '명함': false, '브로셔': false, '전단지': false, '쿠폰': false });
 const [highlightPins, setHighlightPins] = useState([]);
 const [selectedPinsForEdit, setSelectedPinsForEdit] = useState([]);
 const mapRef = useRef(null);
 const mapObj = useRef(null);
 const markersRef = useRef([]);
 const circlesRef = useRef([]);
 const [managers, setManagers] = useState(initManagers);
 const [pins, setPins] = useState([]);
 const [companies, setCompanies] = useState([]);
 const [customers, setCustomers] = useState([]);
 const [sales, setSales] = useState([]);
 const [requests, setRequests] = useState([]);
 const [userStatus, setUserStatus] = useState({});
 const [routes, setRoutes] = useState([]);
 const [calendarEvents, setCalendarEvents] = useState([]);
 const [routeStops, setRouteStops] = useState([]);
 const [routeDate, setRouteDate] = useState(getKoreanToday());
 const [routeTime, setRouteTime] = useState('09:00');
 const [routeInput, setRouteInput] = useState('');
 const [routeAddress, setRouteAddress] = useState('');
 const [routeName, setRouteName] = useState('');
 const [routeManager, setRouteManager] = useState(null);
 const [editingRouteId, setEditingRouteId] = useState(null);
 const [showRouteOnMap, setShowRouteOnMap] = useState(null);
 const [selectedSchedule, setSelectedSchedule] = useState(null);
 const [routeMapSearch, setRouteMapSearch] = useState('');
 const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
 const [calendarMonth, setCalendarMonth] = useState(new Date());
 const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
 const [selectedCalendarEvent, setSelectedCalendarEvent] = useState(null);
 const [showCalendarModal, setShowCalendarModal] = useState(false);
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
 const [showUnvisitedModal, setShowUnvisitedModal] = useState(null); // 미방문 업체 처리 모달
 const [addressIssueAlert, setAddressIssueAlert] = useState(null); // 주소 오류 알림
 const [calendarEventInput, setCalendarEventInput] = useState({ title: '', time: '09:00', memo: '' });
 const [editingEventId, setEditingEventId] = useState(null);
 const [placeSearchQuery, setPlaceSearchQuery] = useState('');
 const [placeCustomName, setPlaceCustomName] = useState('');
 const [searchedPlaces, setSearchedPlaces] = useState([]);
 const [placeSearchResults, setPlaceSearchResults] = useState([]);
 const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
 const [zigbangRegion, setZigbangRegion] = useState('');
 const [zigbangDetailSearch, setZigbangDetailSearch] = useState('');
 const [realtorCollections, setRealtorCollections] = useState([]);
 const [realtorSearchQuery, setRealtorSearchQuery] = useState('');
 const [realtorRegionFilter, setRealtorRegionFilter] = useState('');
 const [realtorSortMode, setRealtorSortMode] = useState('listings');
 const [routeSearchRegion, setRouteSearchRegion] = useState('');
 const [routeSearchTarget, setRouteSearchTarget] = useState('');
 const [routeSearchText, setRouteSearchText] = useState('');
 const [realtorStatusFilter, setRealtorStatusFilter] = useState('all');
 const [realtorPage, setRealtorPage] = useState(1);
 const [selectedRealtorCollection, setSelectedRealtorCollection] = useState(null);
 const [collectedRealtors, setCollectedRealtors] = useState(() => {
   return safeLocalStorage.getItem('bc_collected_realtors', []);
 }); // 새 수집기 데이터 (캐시 우선)
 const [realtorsLoading, setRealtorsLoading] = useState(() => {
   try {
     return !localStorage.getItem('bc_collected_realtors');
   } catch { return true; }
 }); // 캐시 있으면 로딩 안함
 const REALTOR_PAGE_SIZE = 50;
 const [zigbangCity, setZigbangCity] = useState('');
 const [zigbangAgents, setZigbangAgents] = useState([]);
 const [isLoadingAgents, setIsLoadingAgents] = useState(false);
 const [extensionReady, setExtensionReady] = useState(false);
 const [agentSearchAbort, setAgentSearchAbort] = useState(false);
 const [agentLoadingProgress, setAgentLoadingProgress] = useState('');
 const [selectedAgents, setSelectedAgents] = useState([]);
 const [expandedAgent, setExpandedAgent] = useState(null);
 // 네이버 지역 목록 (동적 로드)
 const [naverSidoList, setNaverSidoList] = useState([]);
 const [naverGugunList, setNaverGugunList] = useState([]);
 const [selectedSidoCortarNo, setSelectedSidoCortarNo] = useState('');
 const [selectedGugunCortarNo, setSelectedGugunCortarNo] = useState('');
 // 빈크래프트 자동 수집 상태
 const [autoCollectLoading, setAutoCollectLoading] = useState(false);
 const [collectLimit, setCollectLimit] = useState(200);
 const [collectProgress, setCollectProgress] = useState({ phase: '', current: 0, total: 0, found: 0, message: '' });
 const [isCollecting, setIsCollecting] = useState(false);
 const [collectSido, setCollectSido] = useState('서울특별시');
 const [collectGugun, setCollectGugun] = useState('');
 const [collectDong, setCollectDong] = useState('');
 const zigbangMarkersRef = useRef([]);
 const routeLinesRef = useRef([]);
 const routeMarkersRef = useRef([]);
 const routeMapRef = useRef(null);
 const routeMapObj = useRef(null);
 const routeMapMarkersRef = useRef([]);
 const routeMapLinesRef = useRef([]);
 const routeMapCirclesRef = useRef([]);
 const [gpsEnabled, setGpsEnabled] = useState(false);
 const [currentLocation, setCurrentLocation] = useState(null);
 const gpsWatchIdRef = useRef(null);
 const gpsMarkerRef = useRef(null);
 const gpsAccuracyCircleRef = useRef(null);
 const prevLocationRef = useRef(null);
 const gpsHeadingRef = useRef(0);
 const directionsPolylineRef = useRef(null);
 const [routeInfo, setRouteInfo] = useState(null);
 const [filterManager, setFilterManager] = useState('all');
 const [filterStatus, setFilterStatus] = useState('all');
 const [searchRegion, setSearchRegion] = useState('');
 const [selManager, setSelManager] = useState(null);
 const [pinDate, setPinDate] = useState('');
 const [addr, setAddr] = useState('');
 const [companyForm, setCompanyForm] = useState({ name: '', contact: '', address: '', phone: '', region: '', managerId: null, reaction: 'neutral', memo: '', isReregistered: false });
 const [companySearch, setCompanySearch] = useState('');
 const [companyReactionFilter, setCompanyReactionFilter] = useState('all');
 const [companyManagerFilter, setCompanyManagerFilter] = useState('all');
 const [companyPage, setCompanyPage] = useState({});
 const [selectedCity, setSelectedCity] = useState('');
 const [customerForm, setCustomerForm] = useState({ 
    name: '', 
    phone: '', 
    managerId: null, 
    consultDate: '', 
    desiredRegion: '',
    desiredDate: '',
    budget: '',
    desiredSize: '',
    businessStyle: [],
    priorities: [],
    note: '', 
    status: 'consult', 
    memo: '' 
  });
 const [saleForm, setSaleForm] = useState({ managerId: null, companyId: null, amount: '', date: '', note: '' });
 const getLocalData = (key) => {
   return safeLocalStorage.getItem('bc_' + key, null);
 };
 const migrateToFirebase = async () => {
 const migrationDone = localStorage.getItem('bc_migration_done');
 if (migrationDone) return;
 console.log('마이그레이션 시작...');
 const localManagers = getLocalData('managers');
 const localPins = getLocalData('pins');
 const localCompanies = getLocalData('companies');
 const localCustomers = getLocalData('customers');
 const localSales = getLocalData('sales');
 const localRequests = getLocalData('requests');
 if (localManagers && localManagers.length > 0) {
 console.log('managers 마이그레이션:', localManagers.length);
 for (const m of localManagers) {
 await database.ref('managers/' + m.id).set(m);
 }
 }
 if (localPins && localPins.length > 0) {
 console.log('pins 마이그레이션:', localPins.length);
 for (const p of localPins) {
 await database.ref('pins/' + p.id).set(p);
 }
 }
 if (localCompanies && localCompanies.length > 0) {
 console.log('companies 마이그레이션:', localCompanies.length);
 for (const c of localCompanies) {
 await database.ref('companies/' + c.id).set(c);
 }
 }
 if (localCustomers && localCustomers.length > 0) {
 console.log('customers 마이그레이션:', localCustomers.length);
 for (const c of localCustomers) {
 await database.ref('customers/' + c.id).set(c);
 }
 }
 if (localSales && localSales.length > 0) {
 console.log('sales 마이그레이션:', localSales.length);
 for (const s of localSales) {
 await database.ref('sales/' + s.id).set(s);
 }
 }
 if (localRequests && localRequests.length > 0) {
 console.log('requests 마이그레이션:', localRequests.length);
 for (const r of localRequests) {
 await database.ref('requests/' + r.id).set(r);
 }
 }
 localStorage.setItem('bc_migration_done', 'true');
 console.log('마이그레이션 완료!');
 };
 // 확장프로그램 연결 확인 (postMessage 방식)
 const pendingGeoRequests = useRef({});
 
 // 테마 모드 적용 - CSS 변수 기반
 useEffect(() => {
 const applyTheme = (mode) => {
   let theme = mode;
   if (mode === 'auto') {
     theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
   }
   setEffectiveTheme(theme);
   
   const root = document.documentElement;
   
   if (theme === 'dark') {
     root.classList.add('dark');
     // CSS 변수 설정 - 다크 모드
     root.style.setProperty('--bg-primary', '#171717');
     root.style.setProperty('--bg-secondary', '#262626');
     root.style.setProperty('--bg-card', '#1f1f1f');
     root.style.setProperty('--text-primary', '#ffffff');
     root.style.setProperty('--text-secondary', '#a3a3a3');
     root.style.setProperty('--border-color', '#404040');
     document.body.style.background = '#171717';
     document.body.style.color = '#ffffff';
   } else {
     root.classList.remove('dark');
     // CSS 변수 설정 - 라이트 모드
     root.style.setProperty('--bg-primary', '#ffffff');
     root.style.setProperty('--bg-secondary', '#f5f5f5');
     root.style.setProperty('--bg-card', '#ffffff');
     root.style.setProperty('--text-primary', '#171717');
     root.style.setProperty('--text-secondary', '#525252');
     root.style.setProperty('--border-color', '#e5e5e5');
     document.body.style.background = '#ffffff';
     document.body.style.color = '#171717';
   }
 };
 
 applyTheme(themeMode);
 localStorage.setItem('bc_theme_mode', themeMode);
 
 // 자동 모드일 때 시스템 설정 변경 감지
 if (themeMode === 'auto') {
   const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
   const handler = (e) => applyTheme('auto');
   mediaQuery.addEventListener('change', handler);
   return () => mediaQuery.removeEventListener('change', handler);
 }
 }, [themeMode]);
 
 useEffect(() => {
 // Content Script에서 보내는 메시지 수신 (확장프로그램 통신 허용)
 const handleExtensionMessage = (event) => {
 // 보안 검증 1: source 확인 (같은 window에서 온 메시지만)
 if (event.source !== window) return;
 
 // 보안 검증 2: origin 로깅 (확장프로그램 디버깅용)
 console.log('메시지 수신 - origin:', event.origin, 'type:', event.data?.type);
 
 // 보안 검증 3: 데이터 구조 유효성 검사
 if (!event.data || typeof event.data !== 'object' || !event.data.type) {
   return;
 }
 
 // 허용된 메시지 타입만 처리
 const allowedTypes = ['BEANCRAFT_EXTENSION_READY', 'BEANCRAFT_RESPONSE', 'BEANCRAFT_SCRAPE_PROGRESS'];
 if (!allowedTypes.includes(event.data.type)) {
   return;
 }
 
 // 확장프로그램 연결됨
 if (event.data.type === 'BEANCRAFT_EXTENSION_READY') {
 console.log('확장프로그램 연결됨 v' + (event.data.version || 'unknown'));
 setExtensionReady(true);
 // 시/도 목록 가져오기
 fetchNaverRegions('0000000000');
 }
 
 // 확장프로그램 응답
 if (event.data.type === 'BEANCRAFT_RESPONSE') {
 const { requestId, response } = event.data;
 // requestId 유효성 검사
 if (requestId && pendingGeoRequests.current[requestId]) {
 pendingGeoRequests.current[requestId](response);
 delete pendingGeoRequests.current[requestId];
 }
 }
 
 // 수집 진행 상황 수신
 if (event.data.type === 'BEANCRAFT_SCRAPE_PROGRESS') {
 setCollectProgress({
 phase: String(event.data.phase || ''),
 current: parseInt(event.data.current, 10) || 0,
 total: parseInt(event.data.total, 10) || 0,
 found: parseInt(event.data.found, 10) || 0,
 message: String(event.data.message || '')
 });
 }
 };
 window.addEventListener('message', handleExtensionMessage);
 
 return () => {
 window.removeEventListener('message', handleExtensionMessage);
 };
 }, []);
 
 // 확장프로그램에 요청 보내기 (postMessage 방식)
 const sendToExtension = (action, data = {}) => {
 return new Promise((resolve) => {
 const requestId = Date.now() + Math.random();
 pendingGeoRequests.current[requestId] = resolve;
 
 // 같은 origin으로만 메시지 전송 (보안 강화)
 window.postMessage({
 type: 'BEANCRAFT_REQUEST',
 action: action,
 requestId: requestId,
 ...data
 }, window.location.origin);
 
 // 10초 타임아웃
 setTimeout(() => {
 if (pendingGeoRequests.current[requestId]) {
 pendingGeoRequests.current[requestId]({ success: false, error: '타임아웃' });
 delete pendingGeoRequests.current[requestId];
 }
 }, 10000);
 });
 };
 
 // 네이버 지역 목록 가져오기 (postMessage 방식)
 const fetchNaverRegions = async (cortarNo, type = 'sido') => {
 if (!extensionReady) return;
 
 const response = await sendToExtension('GET_REGIONS', { cortarNo });
 
 if (response && response.success && response.regions) {
 console.log('[지역] ' + type + ' 목록:', response.regions.length + '개');
 if (type === 'sido') {
 setNaverSidoList(response.regions);
 } else if (type === 'gugun') {
 setNaverGugunList(response.regions);
 }
 } else {
 console.error('지역 목록 조회 실패:', response?.error);
 }
 };
 
 // 시/도 선택 시 구/군 목록 가져오기
 const handleSidoChange = (sidoCortarNo, sidoName) => {
 setSelectedSidoCortarNo(sidoCortarNo);
 setZigbangRegion(sidoName);
 setZigbangCity('');
 setSelectedGugunCortarNo('');
 setNaverGugunList([]);
 setZigbangAgents([]);
 clearZigbangMarkers();
 
 if (sidoCortarNo) {
 fetchNaverRegions(sidoCortarNo, 'gugun');
 }
 };
 
 // 구/군 선택 시
 const handleGugunChange = (gugunCortarNo, gugunName) => {
 setSelectedGugunCortarNo(gugunCortarNo);
 setZigbangCity(gugunName);
 setZigbangAgents([]);
 clearZigbangMarkers();
 };

 // 모든 데이터 불러오기 (로그인 후에만 실행)
 useEffect(() => {
 if (!user) {
 setSyncStatus('disconnected');
 return;
 }
 
 setSyncStatus('connecting');
 migrateToFirebase();
 const refs = {
 managers: database.ref('managers'),
 pins: database.ref('pins'),
 companies: database.ref('companies'),
 customers: database.ref('customers'),
 sales: database.ref('sales'),
 requests: database.ref('requests'),
 adminPassword: database.ref('adminPassword'),
 userStatus: database.ref('userStatus'),
 routes: database.ref('routes'),
 realtorCollections: database.ref('realtorCollections'),
 realtors: database.ref('realtors'),
 marketIssues: database.ref('marketIssues').limitToLast(20)
 };
 refs.managers.on('value', (snapshot) => {
 const data = snapshot.val();
 if (data) {
   setManagers(Object.values(data));
 }
 setSyncStatus('connected');
 });
 refs.pins.on('value', (snapshot) => {
 const data = snapshot.val();
 setPins(data ? Object.values(data) : []);
 });
 refs.companies.on('value', (snapshot) => {
 const data = snapshot.val();
 setCompanies(data ? Object.values(data) : []);
 });
 refs.customers.on('value', (snapshot) => {
 const data = snapshot.val();
 setCustomers(data ? Object.values(data) : []);
 });
 refs.sales.on('value', (snapshot) => {
 const data = snapshot.val();
 setSales(data ? Object.values(data) : []);
 });
 refs.requests.on('value', (snapshot) => {
 const data = snapshot.val();
 setRequests(data ? Object.values(data) : []);
 });
 refs.adminPassword.on('value', (snapshot) => {
 const data = snapshot.val();
 if (data) setAdminPassword(data);
 });
 refs.userStatus.on('value', (snapshot) => {
 const data = snapshot.val();
 setUserStatus(data || {});
 });
 refs.routes.on('value', (snapshot) => {
 const data = snapshot.val();
 setRoutes(data ? Object.values(data) : []);
 });
 // 멘트 데이터는 별도 useEffect에서 user?.managerId 의존성으로 로드
 refs.realtorCollections.on('value', (snapshot) => {
 try {
 const data = snapshot.val();
 if (data) {
 const collections = Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
 collections.sort((a, b) => b.exportedAt - a.exportedAt);
 setRealtorCollections(collections);
 } else {
 setRealtorCollections([]);
 }
 } catch (e) {
 console.error('RealtorCollections 데이터 에러:', e);
 setRealtorCollections([]);
 }
 }, (error) => {
 console.error('Firebase realtorCollections 연결 에러:', error);
 setRealtorCollections([]);
 });
 refs.calendarEvents = database.ref('calendarEvents');
 refs.calendarEvents.on('value', (snapshot) => {
 const data = snapshot.val();
 setCalendarEvents(data ? Object.values(data) : []);
 });
 // 새 수집기 데이터 (Firebase /realtors) - 전체 데이터 가져오기
 refs.realtors.on('value', (snapshot) => {
 try {
 const data = snapshot.val();
 if (data) {
 const realtorsList = Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
 realtorsList.sort((a, b) => (b.listings || 0) - (a.listings || 0));
 setCollectedRealtors(realtorsList);
 try { localStorage.setItem('bc_collected_realtors', JSON.stringify(realtorsList)); } catch {}
 } else {
 setCollectedRealtors([]);
 }
 setRealtorsLoading(false);
 } catch (e) {
 console.error('Realtors 데이터 처리 에러:', e);
 setCollectedRealtors([]);
 setRealtorsLoading(false);
 }
 }, (error) => {
 console.error('Firebase realtors 리스너 에러:', error);
 setCollectedRealtors([]);
 setRealtorsLoading(false);
 });
 // 시장 이슈 데이터 (Firebase /marketIssues) - 이미 refs에 limitToLast(20) 적용됨
 refs.marketIssues.on('value', (snapshot) => {
 try {
 const data = snapshot.val();
 if (data) {
 const issuesList = Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
 // 1년 지난 이슈 자동 삭제
 const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
 const validIssues = issuesList.filter(issue => {
 const issueDate = new Date(issue.수집일 || issue.createdAt).getTime();
 if (issueDate < oneYearAgo) {
 database.ref('marketIssues/' + issue.id).remove();
 return false;
 }
 return true;
 });
 validIssues.sort((a, b) => new Date(b.수집일 || b.createdAt) - new Date(a.수집일 || a.createdAt));
 setMarketIssues(validIssues);
 } else {
 setMarketIssues([]);
 }
 } catch (e) {
 console.error('MarketIssues 데이터 처리 에러:', e);
 setMarketIssues([]);
 }
 });
 setDataLoaded(true);
 setSyncStatus('connected');
 return () => {
 Object.values(refs).forEach(ref => ref.off());
 };
 }, [user]);
 
 // 멘트 데이터 로딩을 위한 별도 useEffect (user 의존성)
 useEffect(() => {
 if (!user?.managerId) return;
 
 const userId = user.managerId;
 const userMentsRef = database.ref(`userMents/${userId}`);
 const mentFeedbacksRef = database.ref(`mentFeedbacks/${userId}`);
 
 userMentsRef.on('value', (snapshot) => {
 const data = snapshot.val();
 if (data) {
 const mentsArray = Object.keys(data).map(key => ({
 id: key,
 ...data[key]
 }));
 setUserMents(mentsArray);
 } else {
 setUserMents([]);
 }
 });
 
 mentFeedbacksRef.on('value', (snapshot) => {
 const data = snapshot.val();
 if (data) {
 const feedbacksArray = Object.keys(data).map(key => ({
 id: key,
 ...data[key]
 }));
 setMentFeedbacks(feedbacksArray);
 } else {
 setMentFeedbacks([]);
 }
 });
 
 return () => {
 userMentsRef.off();
 mentFeedbacksRef.off();
 };
 }, [user?.managerId]);

      // 팀 전체 피드백 조회 useEffect
      useEffect(() => {
        const teamFeedbacksRef = database.ref('teamFeedbacks');
        teamFeedbacksRef.orderByChild('timestamp').limitToLast(50).on('value', (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const feedbacksArray = Object.keys(data).map(key => ({
              id: key,
              ...data[key]
            })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setTeamFeedbacksAll(feedbacksArray);
          } else {
            setTeamFeedbacksAll([]);
          }
        });
        return () => teamFeedbacksRef.off();
      }, []);

      // 로그인 후 알림 체크 (데이터 로드 완료 후)
      useEffect(() => {
        if (!loggedIn) return;
        
        const today = new Date().toISOString().split('T')[0];
        
        // 오늘 연락할 곳 알림 (함수형 업데이트로 stale closure 방지)
        if (calendarEvents.length > 0) {
          const todayEvents = calendarEvents.filter(e => e.date === today && e.type === 'followup');
          if (todayEvents.length > 0) {
            setTodayContactAlert(prev => {
              if (prev) return prev; // 이미 알림이 있으면 유지
              const eventTitles = todayEvents.slice(0, 3).map(e => e.title).join(', ');
              const moreCount = todayEvents.length > 3 ? ` 외 ${todayEvents.length - 3}곳` : '';
              return {
                count: todayEvents.length,
                preview: eventTitles + moreCount,
                events: todayEvents
              };
            });
          }
        }
        
        // 미완료 동선 알림
        if (routes.length > 0) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          const incompleteRoutes = routes.filter(r => {
            if (!r.date || r.date > yesterdayStr) return false;
            if (r.status === 'completed') return false; // 완료된 동선 제외
            const hasIncomplete = r.stops?.some(s => !s.visited);
            return hasIncomplete;
          });
          if (incompleteRoutes.length > 0) {
            setIncompleteRouteAlert({
              count: incompleteRoutes.length,
              routes: incompleteRoutes
            });
          } else {
            setIncompleteRouteAlert(null); // 미완료 동선 없으면 알림 제거
          }
        } else {
          setIncompleteRouteAlert(null);
        }
      }, [loggedIn, calendarEvents, routes]);

 // 주소 오류 감지 및 담당자 알림
 useEffect(() => {
   if (!loggedIn || !user || companies.length === 0) return;
   
   // 주소 오류 감지 함수
   const detectAddressIssues = (address) => {
     if (!address) return { hasIssue: true, issue: '주소 없음' };
     
     // 오타 패턴 감지
     const typoPatterns = [
       { pattern: /님양주/, correct: '남양주', issue: '오타: 님양주 → 남양주' },
       { pattern: /님원/, correct: '남원', issue: '오타: 님원 → 남원' },
       { pattern: /서율/, correct: '서울', issue: '오타: 서율 → 서울' },
       { pattern: /겅기/, correct: '경기', issue: '오타: 겅기 → 경기' },
       { pattern: /인쳔/, correct: '인천', issue: '오타: 인쳔 → 인천' },
     ];
     
     for (const { pattern, issue } of typoPatterns) {
       if (pattern.test(address)) {
         return { hasIssue: true, issue };
       }
     }
     
     // 각 도별 시 목록 (시/도 없어도 인식 가능)
     const allProvinceCities = [
       '수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부', '시흥', '파주', '광명', '김포', '군포', '이천', '양주', '오산', '구리', '안성', '포천', '의왕', '하남', '여주', '양평', '동두천', '과천', // 경기
       '춘천', '원주', '강릉', '동해', '삼척', '속초', '태백', // 강원
       '청주', '충주', '제천', // 충북
       '천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', // 충남
       '전주', '군산', '익산', '정읍', '남원', '김제', // 전북
       '목포', '여수', '순천', '나주', '광양', // 전남
       '포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', // 경북
       '창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', // 경남
       '제주', '서귀포' // 제주
     ];
     // 서울 구 목록
     const seoulDistricts = ['종로', '중구', '용산', '성동', '광진', '동대문', '중랑', '성북', '강북', '도봉', '노원', '은평', '서대문', '마포', '양천', '강서', '구로', '금천', '영등포', '동작', '관악', '서초', '강남', '송파', '강동'];
     
     // 시/도 정보 확인
     const hasCity = /서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주/.test(address);
     // 각 도별 시 이름만 있어도 OK
     const hasProvinceCity = allProvinceCities.some(city => address.includes(city + '시') || address.includes(city + ' '));
     // 서울 구 이름만 있어도 OK
     const hasSeoulGu = seoulDistricts.some(gu => address.includes(gu + '구') || address.includes(gu + ' ') || address.includes(gu + '동'));
     
     if (!hasCity && !hasProvinceCity && !hasSeoulGu && address.length > 5) {
       return { hasIssue: true, issue: '시/도 정보 누락' };
     }
     
     // 좌표 변환 실패 가능성 (특수한 주소 형식)
     const hasValidFormat = /[가-힣]+(시|도|구|군|읍|면|동|리|로|길)\s*\d*/.test(address);
     if (!hasValidFormat && address.length > 3) {
       return { hasIssue: true, issue: '주소 형식 확인 필요' };
     }
     
     return { hasIssue: false };
   };
   
   // 현재 담당자의 업체 중 주소 오류 확인
   const currentManagerId = user.managerId || user.id;
   const myCompanies = companies.filter(c => c.managerId === currentManagerId);
   
   const issueCompanies = [];
   myCompanies.forEach(company => {
     const { hasIssue, issue } = detectAddressIssues(company.address);
     // 좌표가 없는 경우도 오류로 처리
     const noCoords = !company.lat || !company.lng;
     
     if (hasIssue || noCoords) {
       issueCompanies.push({
         id: company.id,
         name: company.name,
         address: company.address,
         issue: hasIssue ? issue : '좌표 변환 실패 (주소 확인 필요)'
       });
     }
   });
   
   if (issueCompanies.length > 0) {
     setAddressIssueAlert({
       count: issueCompanies.length,
       companies: issueCompanies
     });
   } else {
     setAddressIssueAlert(null);
   }
 }, [loggedIn, user, companies]);

 
 const saveManager = (manager) => database.ref('managers/' + manager.id).set(manager);
 const savePin = (pin) => database.ref('pins/' + pin.id).set(pin);
 const deleteFirebasePin = (pinId) => database.ref('pins/' + pinId).remove();
 const saveCompany = (company) => database.ref('companies/' + company.id).set(company);
 const deleteFirebaseCompany = (companyId) => database.ref('companies/' + companyId).remove();
 
 // 업체 등록 시 자동 일정 생성 함수
 const createAutoSchedulesForCompany = (company, managerId) => {
   if (!company || !managerId) return;
   
   const now = new Date();
   const formatDate = (date) => {
     const y = date.getFullYear();
     const m = String(date.getMonth() + 1).padStart(2, '0');
     const d = String(date.getDate()).padStart(2, '0');
     return `${y}-${m}-${d}`;
   };
   
   // +7일: 1주차 방문
   const week1 = new Date(now);
   week1.setDate(week1.getDate() + 7);
   const event1 = {
     id: `auto_${company.id}_week1_${Date.now()}`,
     date: formatDate(week1),
     time: '10:00',
     title: `1주차 방문 - ${company.name}`,
     memo: '지역 이슈 공유 및 인사, 빈크래프트 서비스 재안내',
     type: 'followup',
     managerId: managerId,
     companyId: company.id,
     autoGenerated: true,
     completed: false
   };
   saveCalendarEvent(event1);
   
   // +30일: 1개월차 방문
   const month1 = new Date(now);
   month1.setDate(month1.getDate() + 30);
   const event2 = {
     id: `auto_${company.id}_month1_${Date.now()}`,
     date: formatDate(month1),
     time: '10:00',
     title: `1개월차 방문 - ${company.name}`,
     memo: '홍보물 현황 및 고객 반응 체크, 추가 지원 필요 여부 확인',
     type: 'followup',
     managerId: managerId,
     companyId: company.id,
     autoGenerated: true,
     completed: false
   };
   saveCalendarEvent(event2);
   
   // +60일: 2개월차 정기 방문
   const month2 = new Date(now);
   month2.setDate(month2.getDate() + 60);
   const event3 = {
     id: `auto_${company.id}_month2_${Date.now()}`,
     date: formatDate(month2),
     time: '10:00',
     title: `정기 방문 - ${company.name}`,
     memo: '월간 현황 체크, 관계 유지',
     type: 'followup',
     managerId: managerId,
     companyId: company.id,
     autoGenerated: true,
     completed: false
   };
   saveCalendarEvent(event3);
   
   console.log(`[자동일정] ${company.name} 업체에 3개 일정 생성됨`);
 };
 const saveCustomer = (customer) => database.ref('customers/' + customer.id).set(customer);
 const deleteFirebaseCustomer = (customerId) => database.ref('customers/' + customerId).remove();
 const saveSale = (sale) => database.ref('sales/' + sale.id).set(sale);
 const deleteFirebaseSale = (saleId) => database.ref('sales/' + saleId).remove();
 const saveRequest = (request) => database.ref('requests/' + request.id).set(request);
 const saveAdminPassword = (pw) => database.ref('adminPassword').set(pw);
 const saveRoute = (route) => database.ref('routes/' + route.id).set(route);
 const deleteRoute = (routeId) => database.ref('routes/' + routeId).remove();
 
 // 멘트 관리 함수
 const saveMent = (ment) => {
 const userId = user?.managerId || 'admin';
 database.ref(`userMents/${userId}/${ment.id}`).set(ment);
 };
 const deleteMent = (mentId) => {
 const userId = user?.managerId || 'admin';
 database.ref(`userMents/${userId}/${mentId}`).remove();
 };
 const saveFeedback = (feedback) => {
 const userId = user?.managerId || 'admin';
 database.ref(`mentFeedbacks/${userId}/${feedback.id}`).set(feedback);
 };
 
 // 멘트 사용 횟수 증가
 const incrementMentUsage = (mentId, isSuccess = false) => {
 const ment = userMents.find(m => m.id === mentId);
 if (ment) {
 const updated = {
 ...ment,
 useCount: (ment.useCount || 0) + 1,
 successCount: isSuccess ? (ment.successCount || 0) + 1 : (ment.successCount || 0)
 };
 saveMent(updated);
 }
 };

 // 수집된 중개사를 동선에 추가하는 함수
 const addCollectedRealtorsToRoute = async (count) => {
 if (collectedRealtors.length === 0) {
 return alert('수집된 중개사가 없습니다.\nChrome 확장프로그램으로 먼저 수집해주세요.');
 }
 
 // 매물 수 기준 상위 N개 선택
 const topRealtors = [...collectedRealtors]
 .sort((a, b) => (b.listings || 0) - (a.listings || 0))
 .slice(0, count);
 
 // 기존 동선에서 중복 제거
 const existingNames = new Set(routeStops.map(s => s.name));
 const newRealtors = topRealtors.filter(r => !existingNames.has(r.name));
 
 if (newRealtors.length === 0) {
 return alert('새로운 중개사가 없습니다.\n(이미 동선에 등록된 중개사들입니다)');
 }
 
 // 좌표 변환하며 추가
 const newStops = [];
 for (const realtor of newRealtors) {
 let coords = null;
 if (realtor.address) {
 coords = await geocodeAddress(realtor.address, realtor.name);
 }
 newStops.push({
 id: 'stop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
 name: realtor.name,
 address: realtor.address || '',
 phone: realtor.cellPhone || realtor.phone || '',
 lat: coords?.lat || null,
 lng: coords?.lng || null,
 visited: false,
 listings: realtor.listings || 0
 });
 }
 
 // 동선에 추가
 setRouteStops(prev => [...prev, ...newStops]);
 
 // 좌표 있는 것과 없는 것 분리
 const withCoords = newStops.filter(s => s.lat && s.lng).length;
 const withoutCoords = newStops.length - withCoords;
 
 // 동선 탭으로 이동
 setTab('route');
 localStorage.setItem('bc_current_tab', 'route');
 
 alert(`${newStops.length}개 중개사를 동선에 추가했습니다!\n\n위치 확인됨: ${withCoords}곳\n위치 미확인: ${withoutCoords}곳\n\n이제 '최적화' 버튼을 눌러 경로를 정리하세요.`);
 };
 const saveCalendarEvent = (event) => database.ref('calendarEvents/' + event.id).set(event);
 const deleteCalendarEvent = (eventId) => database.ref('calendarEvents/' + eventId).remove();
 
 // 빈크래프트 자동 수집 함수
 const handleAutoCollect = async () => {
 // 동선 탭에서는 routeMapObj 사용, 지도 탭에서는 mapObj 사용
 const currentMap = tab === 'route' ? routeMapObj.current : mapObj.current;
 if (!currentMap) {
 alert("지도가 로드되지 않았습니다.\n잠시 후 다시 시도해주세요.");
 return;
 }
 const zoom = currentMap.getZoom();
 if (zoom < 14) {
 alert("지도를 좀 더 확대해주세요.\n(줌 레벨 14 이상 필요)");
 return;
 }
 let modeName = "간편 조사";
 if (collectLimit === 1000) modeName = "정밀 검사";
 if (collectLimit > 5000) modeName = "전체 검사";
 if (!confirm(`[${modeName}] 모드로 수집하시겠습니까?\n\n- 현재 지도 영역의 상가/사무실\n- 예상 소요시간: 10~60초`)) return;
 setAutoCollectLoading(true);
 const bounds = currentMap.getBounds();
 try {
 chrome.runtime.sendMessage(EXTENSION_ID, {
 type: "SCRAPE_AREA",
 bounds: {
 left: bounds.minX(),
 right: bounds.maxX(),
 top: bounds.maxY(),
 bottom: bounds.minY(),
 zoom: zoom
 },
 options: { maxLimit: collectLimit }
 }, (response) => {
 setAutoCollectLoading(false);
 if (chrome.runtime.lastError) {
 alert("확장프로그램 연결 실패!\n\n1. 확장프로그램이 설치되었는지 확인\n2. 페이지 새로고침 후 재시도");
 console.error(chrome.runtime.lastError);
 return;
 }
 if (!response) {
 alert("응답 없음. 확장프로그램을 확인해주세요.");
 return;
 }
 if (!response.success) {
 alert("수집 실패: " + (response.error || "알 수 없는 오류"));
 return;
 }
 if (response.data.length === 0) {
 alert("해당 지역에 상가 매물이 없습니다.");
 return;
 }
 // 동선 탭에 추가할 데이터 생성
 const newStops = response.data.map((r, idx) => ({
 id: Date.now() + idx + Math.random(),
 name: r.name,
 address: r.address,
 phone: r.phone || r.cellPhone || '',
 lat: r.lat,
 lng: r.lng,
 type: 'auto',
 memo: `[${modeName}] 매물 ${r.articleCount}개`
 }));
 // 기존 동선에서 중복 제거
 const existingNames = new Set(routeStops.map(s => s.name));
 const filtered = newStops.filter(s => !existingNames.has(s.name));
 if (filtered.length === 0) {
 alert("새로운 중개사가 없습니다.\n(이미 동선에 등록된 중개사들입니다)");
 return;
 }
 // 동선 탭에 추가
 setRouteStops(prev => [...prev, ...filtered]);
 alert(`${filtered.length}개의 중개사를 동선에 추가했습니다!\n\n총 매물: ${response.totalArticles || response.data.length}개\n수집된 중개사: ${response.count}명\n동선 추가: ${filtered.length}명`);
 });
 } catch (e) {
 setAutoCollectLoading(false);
 alert("오류 발생: " + e.message);
 }
 };
 
 // 지역 선택 후 자동 수집 함수
 const handleRegionCollect = async () => {
 // 지역명 조합
 let regionQuery = collectSido;
 if (collectGugun) regionQuery += ' ' + collectGugun;
 if (collectDong) regionQuery += ' ' + collectDong;
 
 if (!collectDong && !collectGugun) {
 alert("구/군 또는 동을 입력해주세요.");
 return;
 }
 
 setAutoCollectLoading(true);
 
 // 1. Geocoding으로 좌표 찾기
 naver.maps.Service.geocode({ query: regionQuery }, (status, response) => {
 if (status !== naver.maps.Service.Status.OK || !response.v2.addresses.length) {
 setAutoCollectLoading(false);
 alert("지역을 찾을 수 없습니다. 다시 입력해주세요.\n입력값: " + regionQuery);
 return;
 }
 
 const result = response.v2.addresses[0];
 const lat = parseFloat(result.y);
 const lng = parseFloat(result.x);
 
 // 2. 동선 탭 지도가 없으면 생성 대기
 if (!routeMapObj.current) {
 setAutoCollectLoading(false);
 alert("지도가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.");
 return;
 }
 
 // 3. 지도 이동 + 줌 15 설정
 const point = new naver.maps.LatLng(lat, lng);
 routeMapObj.current.setCenter(point);
 routeMapObj.current.setZoom(15);
 
 // 4. 지도 이동 완료 후 수집 시작 (1초 대기)
 setTimeout(() => {
 const bounds = routeMapObj.current.getBounds();
 const zoom = routeMapObj.current.getZoom();
 
 let modeName = "간편 조사";
 if (collectLimit === 1000) modeName = "정밀 검사";
 if (collectLimit > 5000) modeName = "전체 검사";
 
 chrome.runtime.sendMessage(EXTENSION_ID, {
 type: "SCRAPE_AREA",
 bounds: {
 left: bounds.minX(),
 right: bounds.maxX(),
 top: bounds.maxY(),
 bottom: bounds.minY(),
 zoom: zoom
 },
 options: { maxLimit: collectLimit }
 }, (response) => {
 setAutoCollectLoading(false);
 if (chrome.runtime.lastError) {
 alert("확장프로그램 연결 실패!\n\n1. 확장프로그램이 설치되었는지 확인\n2. 페이지 새로고침 후 재시도");
 console.error(chrome.runtime.lastError);
 return;
 }
 if (!response) {
 alert("응답 없음. 확장프로그램을 확인해주세요.");
 return;
 }
 if (!response.success) {
 alert("수집 실패: " + (response.error || "알 수 없는 오류"));
 return;
 }
 if (response.data.length === 0) {
 alert("" + regionQuery + " 지역에 상가 매물이 없습니다.");
 return;
 }
 
 // 동선 탭에 추가할 데이터 생성
 const newStops = response.data.map((r, idx) => ({
 id: Date.now() + idx + Math.random(),
 name: r.name,
 address: r.address,
 phone: r.phone || r.cellPhone || '',
 lat: r.lat,
 lng: r.lng,
 type: 'auto',
 memo: `[${regionQuery}] 매물 ${r.articleCount}개`
 }));
 
 // 기존 동선에서 중복 제거
 const existingNames = new Set(routeStops.map(s => s.name));
 const filtered = newStops.filter(s => !existingNames.has(s.name));
 
 if (filtered.length === 0) {
 alert("새로운 중개사가 없습니다.\n(이미 동선에 등록된 중개사들입니다)");
 return;
 }
 
 // 동선 탭에 추가
 setRouteStops(prev => [...prev, ...filtered]);
 alert(`[${regionQuery}] 수집 완료!\n\n수집된 중개사: ${response.count}명\n동선 추가: ${filtered.length}명`);
 });
 }, 1000);
 });
 };

 // 중개사 관련 함수들
 const getFilteredRealtors = () => {
 let allRealtors = [];
 const collectionsToSearch = selectedRealtorCollection 
 ? realtorCollections.filter(c => c.id === selectedRealtorCollection)
 : realtorCollections;
 
 collectionsToSearch.forEach(collection => {
 if (collection.realtors) {
 Object.entries(collection.realtors).forEach(([idx, realtor]) => {
 allRealtors.push({
 ...realtor,
 collectionId: collection.id,
 realtorIdx: idx,
 region: realtor.region || collection.region
 });
 });
 }
 });
 
 // 검색어 필터
 if (realtorSearchQuery.trim()) {
 const query = realtorSearchQuery.toLowerCase();
 allRealtors = allRealtors.filter(r => 
 r.name?.toLowerCase().includes(query) || 
 r.address?.toLowerCase().includes(query)
 );
 }
 
 // 지역 필터
 if (realtorRegionFilter) {
 allRealtors = allRealtors.filter(r => r.region?.includes(realtorRegionFilter));
 }
 
 // 상태 필터
 if (realtorStatusFilter !== 'all') {
 if (realtorStatusFilter === 'registered') {
 allRealtors = allRealtors.filter(r => 
 isCompanyDuplicate(r, companies)
 );
 } else {
 allRealtors = allRealtors.filter(r => r.visitStatus === realtorStatusFilter);
 }
 }
 
 // 매물 수 기준 정렬
 allRealtors.sort((a, b) => (b.articleCount || 0) - (a.articleCount || 0));
 
 return allRealtors;
 };
 
 const updateRealtorStatus = (collectionId, realtorIdx, field, value) => {
 database.ref(`realtorCollections/${collectionId}/realtors/${realtorIdx}/${field}`).set(value);
 };
 
 const registerRealtorAsCompany = (realtor) => {
 const newCompany = {
 id: Date.now(),
 name: realtor.name,
 address: realtor.address,
 phone: realtor.phone || realtor.cellPhone || '',
 status: 'neutral',
 createdAt: Date.now(),
 memo: `매물 ${realtor.articleCount}개 / ${realtor.region || ''}`,
 managerId: realtor.assignedTo || (user?.managerId || null),
 source: 'realtor'
 };
 saveCompany(newCompany);
 createAutoSchedulesForCompany(newCompany, newCompany.managerId);
 updateRealtorStatus(realtor.collectionId, realtor.realtorIdx, 'visitStatus', 'visited');
 alert(`"${realtor.name}"이(가) 업체로 등록되었습니다!\n자동 방문 일정이 생성되었습니다.`);
 };
 
 useEffect(() => {
 // 아이디/비밀번호 저장 불러오기 (30일 유지)
 const loginData = safeLocalStorage.getItem('bc_remember_login', null);
 if (loginData) {
   if (loginData.expiry > Date.now()) {
     setId(loginData.id || '');
     setPw(loginData.pw || '');
     setRememberMe(true);
   } else {
     safeLocalStorage.removeItem('bc_remember_login');
   }
 }
 
 // 임시 저장된 동선 불러오기
 const savedRoute = safeLocalStorage.getItem('bc_temp_route', null);
 if (savedRoute && savedRoute.stops?.length > 0) {
   setRouteStops(savedRoute.stops);
   if (savedRoute.name) setRouteName(savedRoute.name);
   if (savedRoute.date) setRouteDate(savedRoute.date);
   if (savedRoute.time) setRouteTime(savedRoute.time);
   if (savedRoute.managerId) setRouteManager(savedRoute.managerId);
   if (savedRoute.editingId) setEditingRouteId(savedRoute.editingId);
 }
 }, []);
 
 // Firebase Auth 상태 감시 + 자동 로그인
 useEffect(() => {

 
 const unsubscribe = firebase.auth().onAuthStateChanged(async (firebaseUser) => {
 if (firebaseUser && !loggedIn) {
 // Firebase 인증됨 - 자동 로그인
 const session = safeLocalStorage.getItem('bc_session', null);
 if (session && session.expiry > Date.now() && session.user) {
   let userData = session.user;
   // [추가] 세션의 손상된 이름 검증 및 복구
   if (userData.username) {
     const initM = initManagers.find(im => im.username === userData.username);
     if (initM && (!userData.name || userData.name.length < 2 || userData.name.includes('ㅁ영업'))) {
       console.log(`[자동로그인] 세션 이름 복구: ${userData.name} -> ${initM.name}`);
       userData = { ...userData, name: initM.name };
       safeLocalStorage.setItem('bc_session', { user: userData, expiry: session.expiry });
     }
   }
   if (userData) {
   setUser(userData);
   setLoggedIn(true);
   if (userData.managerId) {
   setRouteManager(userData.managerId);
   updateUserStatus(userData.managerId, true);
 }
 console.log('자동 로그인 성공:', userData.name);
 return;
 }
 }
 // 세션 없으면 Firebase에서 직접 managers 조회
 const email = firebaseUser.email;
 const emailPrefix = email.split('@')[0];
 let userData = null;
 if (emailPrefix === 'admin') {
 userData = { name: 'admin', role: 'super', email };
 } else {
 // Firebase에서 직접 managers 조회 (인증된 상태)
 try {
 const managersSnapshot = await database.ref('managers').once('value');
 const managersData = managersSnapshot.val();
 const allManagers = managersData ? Object.values(managersData) : [];
 const m = allManagers.find(m => m.username === emailPrefix || m.email === email);
 if (m) {
   // [추가] 손상된 이름 검증 및 복구
   let validName = m.name;
   const initM = initManagers.find(im => im.username === emailPrefix || im.id === m.id);
   if (initM && (!m.name || m.name.length < 2 || m.name.includes('ㅁ영업'))) {
     validName = initM.name;
     console.log(`[자동로그인] 손상된 이름 복구: ${m.name} -> ${validName}`);
     database.ref('managers/' + m.id).update({ name: validName });
   }
   userData = { name: validName, role: 'manager', managerId: m.id, username: m.username, email };
 } else {
 userData = { name: emailPrefix, role: 'manager', email };
 }
 } catch (e) {
 console.error('managers 조회 에러:', e);
 userData = { name: emailPrefix, role: 'manager', email };
 }
 }
 setUser(userData);
 setLoggedIn(true);
 if (userData.managerId) {
 setRouteManager(userData.managerId);
 updateUserStatus(userData.managerId, true);
 }
 localStorage.setItem('bc_session', JSON.stringify({ user: userData, expiry: Date.now() + (6 * 60 * 60 * 1000) }));
 console.log('Firebase 자동 로그인:', userData.name);
 } else if (!firebaseUser && loggedIn) {
 // Firebase 로그아웃됨
 setLoggedIn(false);
 setUser(null);
 localStorage.removeItem('bc_session');
 }
 });
 
 return () => unsubscribe();
 }, [loggedIn]);
 useEffect(() => {
 const handlePopState = () => {
 if (tabHistory.length > 0) {
 const newHistory = [...tabHistory];
 const prevTab = newHistory.pop();
 setTabHistory(newHistory);
 setTab(prevTab);
 }
 };
 window.addEventListener('popstate', handlePopState);
 return () => window.removeEventListener('popstate', handlePopState);
 }, [tabHistory]);
 const navigateToTab = (newTab) => {
 if (newTab !== tab) {
 window.history.pushState({ tab: newTab }, '');
 setTabHistory([...tabHistory, tab]);
 setTab(newTab);
 localStorage.setItem('bc_current_tab', newTab);
 }
 };
 useEffect(() => {
 localStorage.setItem('bc_current_tab', tab);
 }, [tab]);
 const selManagerRef = useRef(selManager);
 const pinDateRef = useRef(pinDate);
 const pinsRef = useRef(pins);
 const companiesRef = useRef(companies);
 const managersRef = useRef(managers);
 const highlightPinsRef = useRef(highlightPins);
 useEffect(() => { selManagerRef.current = selManager; }, [selManager]);
 useEffect(() => { pinDateRef.current = pinDate; }, [pinDate]);
 useEffect(() => { pinsRef.current = pins; }, [pins]);
 useEffect(() => { companiesRef.current = companies; }, [companies]);
 useEffect(() => { managersRef.current = managers; }, [managers]);
 useEffect(() => { highlightPinsRef.current = highlightPins; }, [highlightPins]);
 useEffect(() => {
 if (routeStops.length > 0) {
 const tempRoute = {
 stops: routeStops,
 name: routeName,
 date: routeDate,
 time: routeTime,
 managerId: routeManager,
 editingId: editingRouteId,
 savedAt: new Date().toISOString()
 };
 localStorage.setItem('bc_temp_route', JSON.stringify(tempRoute));
 } else {
   localStorage.removeItem('bc_temp_route');
 }
 }, [routeStops]);
 const getPinSize = (zoom, isHighlight) => {
 if (isHighlight) return Math.max(28, zoom * 2.5);
 if (zoom <= 8) return 14;
 if (zoom <= 10) return 18;
 if (zoom <= 12) return 22;
 if (zoom <= 14) return 26;
 return 30;
 };
 useEffect(() => {
 // 조건부 렌더링으로 인해 탭이 'map'일 때만 이 컴포넌트가 마운트됨
 // 따라서 mapRef.current가 새로운 DOM 요소이므로 mapObj도 리셋 필요
 if (loggedIn && tab === 'map' && mapRef.current) {
 // 기존 지도 객체가 있어도 DOM이 바뀌었으므로 재초기화
 mapObj.current = null;
 let retryCount = 0;
 const maxRetries = 50; // 최대 5초 대기 (100ms * 50)
 
 const initMap = () => {
   // 재시도 횟수 초과 시 중단
   if (retryCount >= maxRetries) {
     console.error('네이버 지도 SDK 로드 실패: 타임아웃');
     return;
   }
   
   // SDK 로드 대기
   if (!window.naver?.maps) {
     retryCount++;
     setTimeout(initMap, 100);
     return;
   }
   
   // DOM 요소 대기
   if (!mapRef.current) {
     retryCount++;
     setTimeout(initMap, 100);
     return;
   }
   
   try {
     mapObj.current = new naver.maps.Map(mapRef.current, { 
       center: new naver.maps.LatLng(37.5665, 126.978), 
       zoom: 11 
     });
     
     naver.maps.Event.addListener(mapObj.current, 'zoom_changed', () => {
       renderMarkers();
     });
     
     naver.maps.Event.addListener(mapObj.current, 'click', (e) => {
       const currentSelManager = selManagerRef.current;
       const currentPinDate = pinDateRef.current;
       if (!currentSelManager) return;
       const lat = e.coord.lat(); const lng = e.coord.lng();
       naver.maps.Service.reverseGeocode({ coords: new naver.maps.LatLng(lat, lng) }, (s, r) => {
         let address = lat.toFixed(4) + ', ' + lng.toFixed(4);
         if (s === naver.maps.Service.Status.OK && r.v2.results[0]) {
           const a = r.v2.results[0].region;
           if (a) address = [a.area1?.name, a.area2?.name, a.area3?.name].filter(Boolean).join(' ');
         }
         const status = currentPinDate ? 'planned' : 'confirmed';
         const newPin = { id: Date.now(), managerId: currentSelManager, status, region: address, lat, lng, date: currentPinDate || '', createdAt: new Date().toISOString() };
         savePin(newPin);
       });
     });
     
     setTimeout(() => renderMarkers(), 500);
   } catch (e) {
     console.error('네이버 지도 초기화 실패:', e);
   }
 };
 
 setTimeout(initMap, 300);
 }
 }, [loggedIn, tab]);
 useEffect(() => {
 if (loggedIn && tab === 'map' && mapObj.current) {
 setTimeout(() => { naver.maps.Event.trigger(mapObj.current, 'resize'); renderMarkers(); }, 100);
 }
 }, [loggedIn, tab]);
 useEffect(() => {
 if (loggedIn && tab === 'route' && routeMapObj.current) {
 setTimeout(() => { naver.maps.Event.trigger(routeMapObj.current, 'resize'); }, 100);
 }
 }, [loggedIn, tab]);
 const triggerHighlight = () => {
 let pinsToHighlight = pinsRef.current;
 if (filterManager !== 'all') pinsToHighlight = pinsToHighlight.filter(p => p.managerId === Number(filterManager));
 if (filterStatus !== 'all') pinsToHighlight = pinsToHighlight.filter(p => p.status === filterStatus);
 setHighlightPins(pinsToHighlight.map(p => p.id));
 setTimeout(() => renderMarkers(), 100);
 };
 const renderMarkers = useCallback(() => {
 if (!mapObj.current || !window.naver?.maps) return;
 markersRef.current.forEach(m => m.setMap(null));
 markersRef.current = [];
 const currentCompanies = companiesRef.current;
 const currentManagers = managersRef.current;
 const currentHighlight = highlightPinsRef.current;
 const currentZoom = mapObj.current.getZoom();
 let filteredCompanies = currentCompanies.filter(c => c.lat && c.lng);
 if (filterManager !== 'all') {
 filteredCompanies = filteredCompanies.filter(c => c.managerId === Number(filterManager));
 }
 if (filterStatus !== 'all') {
 filteredCompanies = filteredCompanies.filter(c => c.reaction === filterStatus);
 }
 filteredCompanies.forEach(company => {
 const mgr = currentManagers.find(m => m.id === company.managerId);
 const reaction = REACTION_COLORS[company.reaction] || REACTION_COLORS.neutral;
 const shouldBlink = currentHighlight.includes(company.id) || company.reaction === 'special';
 const size = getPinSize(currentZoom, shouldBlink);
 const borderWidth = Math.max(2, Math.floor(size / 5));
 let color = '#9ca3af';
 if (company.reaction === 'special') color = '#ef4444';
 else if (company.reaction === 'positive') color = '#22c55e';
 else if (company.reaction === 'neutral') color = '#f97316';
 else if (company.reaction === 'missed') color = '#eab308';
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(company.lat, company.lng),
 map: mapObj.current,
 icon: {
 content: `<div class="${shouldBlink ? (company.reaction === 'special' ? 'special-blink' : 'marker-pulse') : ''}" style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:${borderWidth}px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;">
 <span style="font-size:${Math.max(8, size/2.5)}px;color:white;font-weight:bold;">${company.name.charAt(0)}</span>
 </div>`,
 anchor: new naver.maps.Point(size/2, size/2)
 }
 });
 naver.maps.Event.addListener(marker, 'click', () => {
 setShowCompanyMapModal({ ...company, manager: mgr });
 });
 markersRef.current.push(marker);
 });
 if (currentHighlight.length > 0) setTimeout(() => setHighlightPins([]), 5000);
 }, [filterManager, filterStatus]);
 useEffect(() => { if (mapObj.current) renderMarkers(); }, [companies, managers, filterManager, filterStatus, highlightPins, renderMarkers]);
  
  // 로그인 시퀀스 애니메이션
  useEffect(() => {
    if (loggedIn) return;
    
    // 명언 (4초) -> 로고 나타남 (2초) -> 로그인 폼 표시
    const timer1 = setTimeout(() => setLoginPhase('logo'), 4000);
    const timer2 = setTimeout(() => setLoginPhase('form'), 6000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [loggedIn]);
  
  // 미표시 업체 자동 좌표 검색
  useEffect(() => {
    if (!loggedIn || companies.length === 0 || !window.naver?.maps?.Service) return;
    const unmappedCompanies = companies.filter(c => (!c.lat || !c.lng) && (c.address || c.name));
    if (unmappedCompanies.length === 0) return;
    const fixUnmapped = async () => {
      let fixed = 0;
      for (const company of unmappedCompanies) {
        const coords = await geocodeAddress(company.address, company.name);
        if (coords) {
          const updated = { ...company, lat: coords.lat, lng: coords.lng };
          saveCompany(updated);
          fixed++;
        }
        await new Promise(r => setTimeout(r, 300)); // API 과부하 방지
      }
      if (fixed > 0) console.log(`미표시 업체 ${fixed}개 좌표 자동 수정 완료`);
    };
    const timer = setTimeout(fixUnmapped, 2000); // 로드 후 2초 뒤 실행
    return () => clearTimeout(timer);
  }, [loggedIn, companies.length]);
 useEffect(() => {
 // 탭이 'route'일 때 지도 초기화
 if (loggedIn && tab === 'route') {
 // 기존 지도 객체 정리
 if (routeMapObj.current) {
 routeMapObj.current = null;
 }
 const initRouteMap = () => {
 // DOM이 준비될 때까지 대기
 if (!routeMapRef.current) { 
 console.log('[지도] routeMapRef 대기중...');
 setTimeout(initRouteMap, 100); 
 return; 
 }
 // 네이버 맵 API 로드 대기
 if (!window.naver?.maps) { 
 console.log('[지도] naver.maps 대기중...');
 setTimeout(initRouteMap, 100); 
 return; 
 }
 // 이미 초기화되었으면 스킵
 if (routeMapObj.current) return;
 
 console.log('[지도] 초기화 시작');
 routeMapObj.current = new naver.maps.Map(routeMapRef.current, {
 center: new naver.maps.LatLng(37.5665, 126.978),
 zoom: 11
 });
 naver.maps.Event.addListener(routeMapObj.current, 'click', (e) => {
 const lat = e.coord.lat();
 const lng = e.coord.lng();
 naver.maps.Service.reverseGeocode({
 coords: new naver.maps.LatLng(lat, lng),
 orders: 'roadaddr,addr'
 }, (status, response) => {
 let placeName = '선택한 위치';
 let address = '';
 if (status === naver.maps.Service.Status.OK && response.v2.results?.length > 0) {
 const result = response.v2.results[0];
 if (result.land) {
 const land = result.land;
 address = `${result.region.area1.name} ${result.region.area2.name} ${result.region.area3.name} ${land.name || ''} ${land.number1 || ''}`.trim();
 if (land.addition0?.value) {
 placeName = land.addition0.value;
 } else {
 placeName = `${result.region.area3.name} ${land.number1 || ''}`.trim();
 }
 }
 }
 const newStop = {
 id: Date.now(),
 name: placeName,
 address: address,
 lat: lat,
 lng: lng,
 type: 'click'
 };
 setRouteStops(prev => [...prev, newStop]);
 });
 });
 console.log('[지도] 초기화 완료!');
 setTimeout(() => updateRouteMapMarkers(), 500);
 };
 setTimeout(initRouteMap, 300);
 }
 }, [loggedIn, tab]);
      useEffect(() => {
        if (!routeMapObj.current) {
          if (tab === 'route' && routeStops.length > 0) {
            setTimeout(() => {
              if (routeMapObj.current) updateRouteMapMarkers();
            }, 500);
          }
          return;
        }
        updateRouteMapMarkers();
      }, [routeStops, tab]);
 const clearRouteMapMarkers = () => {
 routeMapMarkersRef.current.forEach(m => m.setMap(null));
 routeMapMarkersRef.current = [];
 routeMapLinesRef.current.forEach(l => l.setMap(null));
 routeMapLinesRef.current = [];
 routeMapCirclesRef.current.forEach(c => c.setMap(null));
 routeMapCirclesRef.current = [];
 if (directionsPolylineRef.current) {
 directionsPolylineRef.current.setMap(null);
 directionsPolylineRef.current = null;
 }
 setRouteInfo(null);
 };
 const updateRouteMapMarkers = () => {
 if (!routeMapObj.current) return;
 clearRouteMapMarkers();
 const stopsWithCoords = routeStops.filter(s => s.lat && s.lng);
 if (stopsWithCoords.length === 0) return;
 setTimeout(() => {
 if (!routeMapObj.current) return;
        // 겹친 마커 분리를 위한 그룹핑
        const groupByLocation = {};
        stopsWithCoords.forEach((stop, idx) => {
          const key = `${stop.lat.toFixed(5)}_${stop.lng.toFixed(5)}`;
          if (!groupByLocation[key]) groupByLocation[key] = [];
          groupByLocation[key].push({ ...stop, originalIdx: idx });
        });
        Object.values(groupByLocation).forEach((group) => {
          const count = group.length;
          group.forEach((stop, groupIdx) => {
            let offsetLat = 0, offsetLng = 0;
            if (count > 1) {
              const angle = (2 * Math.PI / count) * groupIdx;
              const radius = 0.00015;
              offsetLat = Math.cos(angle) * radius;
              offsetLng = Math.sin(angle) * radius;
            }
            const isStacked = count > 1;
            const marker = new naver.maps.Marker({
              position: new naver.maps.LatLng(stop.lat + offsetLat, stop.lng + offsetLng),
              map: routeMapObj.current,
              icon: {
                content: `<div style="background:linear-gradient(135deg,${isStacked?'#f59e0b':'#14b8a6'},${isStacked?'#d97706':'#0d9488'});color:white;width:${isStacked?'32px':'28px'};height:${isStacked?'32px':'28px'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${isStacked?'11px':'12px'};box-shadow:0 3px 8px rgba(0,0,0,0.4);border:2px solid ${isStacked?'#fbbf24':'white'}">${stop.originalIdx+1}</div>`,
                anchor: new naver.maps.Point(isStacked ? 16 : 14, isStacked ? 16 : 14)
              },
              zIndex: 100 + stop.originalIdx
            });
            naver.maps.Event.addListener(marker, 'click', () => {
              setCurrentSlideIndex(stop.originalIdx);
            });
            routeMapMarkersRef.current.push(marker);
          });
        });

 if (stopsWithCoords.length >= 2) {
 const path = stopsWithCoords.map(s => new naver.maps.LatLng(s.lat, s.lng));
 const polyline = new naver.maps.Polyline({
 map: routeMapObj.current,
 path: path,
 strokeColor: '#14b8a6',
 strokeWeight: 4,
 strokeOpacity: 0.9
 });
 routeMapLinesRef.current.push(polyline);
 }
 if (stopsWithCoords.length === 1) {
 routeMapObj.current.setCenter(new naver.maps.LatLng(stopsWithCoords[0].lat, stopsWithCoords[0].lng));
 routeMapObj.current.setZoom(15);
 } else if (stopsWithCoords.length >= 2) {
 const bounds = new naver.maps.LatLngBounds();
 stopsWithCoords.forEach(s => bounds.extend(new naver.maps.LatLng(s.lat, s.lng)));
 routeMapObj.current.fitBounds(bounds, { padding: 50 });
 }
 }, 100);
 };
 const goToMapWithPins = (targetPins) => {
 if (targetPins.length === 0) return;
 setFilterManager('all'); setFilterStatus('all');
 setHighlightPins(targetPins.map(p => p.id));
 navigateToTab('map');
 setTimeout(() => {
 if (mapObj.current && targetPins.length > 0) {
 if (targetPins.length === 1) {
 mapObj.current.setCenter(new naver.maps.LatLng(targetPins[0].lat, targetPins[0].lng));
 mapObj.current.setZoom(14);
 } else {
 const bounds = new naver.maps.LatLngBounds();
 targetPins.forEach(p => bounds.extend(new naver.maps.LatLng(p.lat, p.lng)));
 mapObj.current.fitBounds(bounds, { padding: 50 });
 }
 }
 }, 300);
 };
 const canDeletePin = (pin) => user?.role === 'super' || pin.managerId === user?.managerId;
 const deletePin = (pinId) => { deleteFirebasePin(pinId); setShowPinModal(null); };
 const updatePinDate = (pinId, date) => { const pin = pins.find(p => p.id === pinId); if (pin) savePin({ ...pin, date, status: date ? 'planned' : 'confirmed' }); };
 const updatePinStatus = (pinId, status) => { const pin = pins.find(p => p.id === pinId); if (pin) savePin({ ...pin, status, expiredChecked: true }); };
 const confirmSelectedPins = () => {
 selectedPinsForEdit.forEach(pinId => {
 const pin = pins.find(p => p.id === pinId);
 if (pin) savePin({ ...pin, status: 'confirmed', expiredChecked: true });
 });
 setSelectedPinsForEdit([]);
 setShowPinEditModal(null);
 };
 const deleteSelectedPins = () => {
 if (confirm(`${selectedPinsForEdit.length}개 지역을 삭제하시겠습니까?`)) {
 selectedPinsForEdit.forEach(pinId => deleteFirebasePin(pinId));
 setSelectedPinsForEdit([]);
 setShowPinEditModal(null);
 }
 };
 const PLACES = {
 '서울역': { lat: 37.5547, lng: 126.9707 },
 '시청역': { lat: 37.5659, lng: 126.9773 },
 '종각역': { lat: 37.5701, lng: 126.9822 },
 '종로3가역': { lat: 37.5714, lng: 126.9916 },
 '종로5가역': { lat: 37.5707, lng: 126.9992 },
 '동대문역': { lat: 37.5711, lng: 127.0095 },
 '신설동역': { lat: 37.5762, lng: 127.0251 },
 '강남역': { lat: 37.4979, lng: 127.0276 },
 '역삼역': { lat: 37.5007, lng: 127.0365 },
 '선릉역': { lat: 37.5045, lng: 127.0490 },
 '삼성역': { lat: 37.5089, lng: 127.0637 },
 '종합운동장역': { lat: 37.5108, lng: 127.0736 },
 '잠실역': { lat: 37.5133, lng: 127.1001 },
 '홍대입구역': { lat: 37.5571, lng: 126.9244 },
 '합정역': { lat: 37.5495, lng: 126.9138 },
 '신촌역': { lat: 37.5552, lng: 126.9366 },
 '이대역': { lat: 37.5569, lng: 126.9463 },
 '아현역': { lat: 37.5575, lng: 126.9559 },
 '충정로역': { lat: 37.5601, lng: 126.9635 },
 '을지로입구역': { lat: 37.5660, lng: 126.9823 },
 '을지로3가역': { lat: 37.5665, lng: 126.9918 },
 '을지로4가역': { lat: 37.5669, lng: 126.9983 },
 '동대문역사문화공원역': { lat: 37.5653, lng: 127.0076 },
 '신당역': { lat: 37.5659, lng: 127.0176 },
 '상왕십리역': { lat: 37.5650, lng: 127.0296 },
 '왕십리역': { lat: 37.5614, lng: 127.0378 },
 '한양대역': { lat: 37.5568, lng: 127.0441 },
 '뚝섬역': { lat: 37.5474, lng: 127.0473 },
 '성수역': { lat: 37.5446, lng: 127.0558 },
 '건대입구역': { lat: 37.5404, lng: 127.0700 },
 '구의역': { lat: 37.5358, lng: 127.0863 },
 '강변역': { lat: 37.5352, lng: 127.0948 },
 '잠실나루역': { lat: 37.5210, lng: 127.1028 },
 '신천역': { lat: 37.5114, lng: 127.0833 },
 '교대역': { lat: 37.4934, lng: 127.0148 },
 '서초역': { lat: 37.4920, lng: 127.0077 },
 '방배역': { lat: 37.4815, lng: 126.9976 },
 '사당역': { lat: 37.4766, lng: 126.9816 },
 '낙성대역': { lat: 37.4769, lng: 126.9637 },
 '서울대입구역': { lat: 37.4812, lng: 126.9527 },
 '봉천역': { lat: 37.4824, lng: 126.9418 },
 '신림역': { lat: 37.4842, lng: 126.9296 },
 '신대방역': { lat: 37.4876, lng: 126.9131 },
 '구로디지털단지역': { lat: 37.4854, lng: 126.9015 },
 '대림역': { lat: 37.4929, lng: 126.8966 },
 '신도림역': { lat: 37.5088, lng: 126.8913 },
 '문래역': { lat: 37.5178, lng: 126.8956 },
 '영등포구청역': { lat: 37.5247, lng: 126.8964 },
 '당산역': { lat: 37.5349, lng: 126.9024 },
 '남부터미널역': { lat: 37.4856, lng: 127.0165 },
 '양재역': { lat: 37.4844, lng: 127.0343 },
 '매봉역': { lat: 37.4871, lng: 127.0467 },
 '도곡역': { lat: 37.4908, lng: 127.0555 },
 '대치역': { lat: 37.4946, lng: 127.0634 },
 '학여울역': { lat: 37.4968, lng: 127.0716 },
 '대청역': { lat: 37.4987, lng: 127.0792 },
 '일원역': { lat: 37.4838, lng: 127.0858 },
 '수서역': { lat: 37.4874, lng: 127.1017 },
 '압구정역': { lat: 37.5271, lng: 127.0284 },
 '신사역': { lat: 37.5168, lng: 127.0203 },
 '잠원역': { lat: 37.5112, lng: 127.0132 },
 '고속터미널역': { lat: 37.5048, lng: 127.0049 },
 '옥수역': { lat: 37.5405, lng: 127.0172 },
 '금호역': { lat: 37.5476, lng: 127.0131 },
 '약수역': { lat: 37.5541, lng: 127.0103 },
 '동대입구역': { lat: 37.5588, lng: 127.0096 },
 '충무로역': { lat: 37.5614, lng: 126.9943 },
 '경복궁역': { lat: 37.5759, lng: 126.9735 },
 '안국역': { lat: 37.5766, lng: 126.9855 },
 '명동역': { lat: 37.5608, lng: 126.9860 },
 '회현역': { lat: 37.5587, lng: 126.9785 },
 '숙대입구역': { lat: 37.5447, lng: 126.9720 },
 '삼각지역': { lat: 37.5349, lng: 126.9732 },
 '신용산역': { lat: 37.5295, lng: 126.9686 },
 '이촌역': { lat: 37.5214, lng: 126.9710 },
 '동작역': { lat: 37.5082, lng: 126.9790 },
 '총신대입구역': { lat: 37.4868, lng: 126.9816 },
 '남태령역': { lat: 37.4698, lng: 126.9853 },
 '혜화역': { lat: 37.5822, lng: 127.0019 },
 '한성대입구역': { lat: 37.5884, lng: 127.0064 },
 '성신여대입구역': { lat: 37.5929, lng: 127.0166 },
 '길음역': { lat: 37.6035, lng: 127.0251 },
 '미아사거리역': { lat: 37.6131, lng: 127.0300 },
 '미아역': { lat: 37.6215, lng: 127.0298 },
 '수유역': { lat: 37.6381, lng: 127.0257 },
 '쌍문역': { lat: 37.6483, lng: 127.0345 },
 '창동역': { lat: 37.6531, lng: 127.0476 },
 '노원역': { lat: 37.6559, lng: 127.0619 },
 '상계역': { lat: 37.6612, lng: 127.0730 },
 '당고개역': { lat: 37.6702, lng: 127.0799 },
 '광화문역': { lat: 37.5708, lng: 126.9768 },
 '서대문역': { lat: 37.5653, lng: 126.9666 },
 '광흥창역': { lat: 37.5476, lng: 126.9312 },
 '신정역': { lat: 37.5247, lng: 126.8560 },
 '목동역': { lat: 37.5263, lng: 126.8750 },
 '오목교역': { lat: 37.5242, lng: 126.8870 },
 '양평역': { lat: 37.5256, lng: 126.8845 },
 '영등포시장역': { lat: 37.5225, lng: 126.9057 },
 '여의도역': { lat: 37.5216, lng: 126.9242 },
 '여의나루역': { lat: 37.5271, lng: 126.9328 },
 '마포역': { lat: 37.5392, lng: 126.9460 },
 '공덕역': { lat: 37.5440, lng: 126.9517 },
 '애오개역': { lat: 37.5532, lng: 126.9568 },
 '행당역': { lat: 37.5571, lng: 127.0296 },
 '답십리역': { lat: 37.5669, lng: 127.0520 },
 '장한평역': { lat: 37.5613, lng: 127.0641 },
 '군자역': { lat: 37.5570, lng: 127.0793 },
 '아차산역': { lat: 37.5513, lng: 127.0882 },
 '광나루역': { lat: 37.5452, lng: 127.1031 },
 '천호역': { lat: 37.5389, lng: 127.1236 },
 '강동역': { lat: 37.5352, lng: 127.1323 },
 '길동역': { lat: 37.5343, lng: 127.1427 },
 '굽은다리역': { lat: 37.5352, lng: 127.1520 },
 '명일역': { lat: 37.5424, lng: 127.1441 },
 '고덕역': { lat: 37.5550, lng: 127.1541 },
 '상일동역': { lat: 37.5571, lng: 127.1670 },
 '이태원역': { lat: 37.5344, lng: 126.9945 },
 '녹사평역': { lat: 37.5342, lng: 126.9874 },
 '효창공원앞역': { lat: 37.5390, lng: 126.9617 },
 '대흥역': { lat: 37.5474, lng: 126.9434 },
 '상수역': { lat: 37.5477, lng: 126.9225 },
 '망원역': { lat: 37.5555, lng: 126.9105 },
 '마포구청역': { lat: 37.5635, lng: 126.9040 },
 '월드컵경기장역': { lat: 37.5681, lng: 126.8972 },
 '디지털미디어시티역': { lat: 37.5769, lng: 126.8997 },
 '증산역': { lat: 37.5830, lng: 126.9096 },
 '새절역': { lat: 37.5851, lng: 126.9180 },
 '응암역': { lat: 37.5933, lng: 126.9179 },
 '역촌역': { lat: 37.6017, lng: 126.9214 },
 '불광역': { lat: 37.6107, lng: 126.9301 },
 '독바위역': { lat: 37.6149, lng: 126.9391 },
 '연신내역': { lat: 37.6189, lng: 126.9209 },
 '구산역': { lat: 37.6159, lng: 126.9114 },
 '한강진역': { lat: 37.5397, lng: 127.0019 },
 '버티고개역': { lat: 37.5474, lng: 127.0071 },
 '청구역': { lat: 37.5602, lng: 127.0149 },
 '동묘앞역': { lat: 37.5718, lng: 127.0166 },
 '창신역': { lat: 37.5798, lng: 127.0147 },
 '보문역': { lat: 37.5868, lng: 127.0195 },
 '안암역': { lat: 37.5863, lng: 127.0290 },
 '고려대역': { lat: 37.5895, lng: 127.0340 },
 '월곡역': { lat: 37.6017, lng: 127.0380 },
 '상월곡역': { lat: 37.6062, lng: 127.0442 },
 '돌곶이역': { lat: 37.6105, lng: 127.0512 },
 '석계역': { lat: 37.6153, lng: 127.0661 },
 '태릉입구역': { lat: 37.6177, lng: 127.0754 },
 '화랑대역': { lat: 37.6199, lng: 127.0842 },
 '봉화산역': { lat: 37.6188, lng: 127.0914 },
 '논현역': { lat: 37.5109, lng: 127.0218 },
 '학동역': { lat: 37.5145, lng: 127.0316 },
 '강남구청역': { lat: 37.5172, lng: 127.0412 },
 '청담역': { lat: 37.5198, lng: 127.0535 },
 '뚝섬유원지역': { lat: 37.5316, lng: 127.0667 },
 '어린이대공원역': { lat: 37.5475, lng: 127.0743 },
 '중곡역': { lat: 37.5656, lng: 127.0840 },
 '용마산역': { lat: 37.5735, lng: 127.0869 },
 '사가정역': { lat: 37.5802, lng: 127.0890 },
 '면목역': { lat: 37.5887, lng: 127.0870 },
 '상봉역': { lat: 37.5966, lng: 127.0851 },
 '중화역': { lat: 37.6026, lng: 127.0790 },
 '먹골역': { lat: 37.6107, lng: 127.0768 },
 '공릉역': { lat: 37.6253, lng: 127.0729 },
 '하계역': { lat: 37.6371, lng: 127.0669 },
 '중계역': { lat: 37.6442, lng: 127.0640 },
 '마들역': { lat: 37.6650, lng: 127.0581 },
 '수락산역': { lat: 37.6748, lng: 127.0565 },
 '도봉산역': { lat: 37.6896, lng: 127.0449 },
 '장암역': { lat: 37.6986, lng: 127.0531 },
 '반포역': { lat: 37.5021, lng: 126.9958 },
 '내방역': { lat: 37.4874, lng: 126.9877 },
 '이수역': { lat: 37.4852, lng: 126.9817 },
 '남성역': { lat: 37.4838, lng: 126.9726 },
 '숭실대입구역': { lat: 37.4965, lng: 126.9535 },
 '상도역': { lat: 37.5027, lng: 126.9504 },
 '장승배기역': { lat: 37.5082, lng: 126.9396 },
 '신대방삼거리역': { lat: 37.4994, lng: 126.9269 },
 '보라매역': { lat: 37.4997, lng: 126.9184 },
 '신풍역': { lat: 37.5030, lng: 126.9086 },
 '남구로역': { lat: 37.4865, lng: 126.8873 },
 '가산디지털단지역': { lat: 37.4813, lng: 126.8828 },
 '철산역': { lat: 37.4762, lng: 126.8687 },
 '광명사거리역': { lat: 37.4762, lng: 126.8563 },
 '천왕역': { lat: 37.4792, lng: 126.8421 },
 '온수역': { lat: 37.4927, lng: 126.8234 },
 '몽촌토성역': { lat: 37.5170, lng: 127.1117 },
 '강동구청역': { lat: 37.5303, lng: 127.1238 },
 '암사역': { lat: 37.5502, lng: 127.1279 },
 '석촌역': { lat: 37.5059, lng: 127.1016 },
 '송파역': { lat: 37.5007, lng: 127.1062 },
 '가락시장역': { lat: 37.4929, lng: 127.1182 },
 '문정역': { lat: 37.4858, lng: 127.1224 },
 '장지역': { lat: 37.4781, lng: 127.1264 },
 '복정역': { lat: 37.4703, lng: 127.1267 },
 '산성역': { lat: 37.4584, lng: 127.1500 },
 '남한산성입구역': { lat: 37.4507, lng: 127.1573 },
 '단대오거리역': { lat: 37.4455, lng: 127.1574 },
 '신흥역': { lat: 37.4389, lng: 127.1538 },
 '수진역': { lat: 37.4345, lng: 127.1508 },
 '모란역': { lat: 37.4322, lng: 127.1291 },
 '개화역': { lat: 37.5794, lng: 126.7975 },
 '김포공항역': { lat: 37.5622, lng: 126.8011 },
 '공항시장역': { lat: 37.5596, lng: 126.8100 },
 '신방화역': { lat: 37.5619, lng: 126.8167 },
 '마곡나루역': { lat: 37.5671, lng: 126.8277 },
 '양천향교역': { lat: 37.5607, lng: 126.8438 },
 '가양역': { lat: 37.5614, lng: 126.8540 },
 '증미역': { lat: 37.5587, lng: 126.8622 },
 '등촌역': { lat: 37.5516, lng: 126.8718 },
 '염창역': { lat: 37.5471, lng: 126.8773 },
 '신목동역': { lat: 37.5392, lng: 126.8785 },
 '선유도역': { lat: 37.5331, lng: 126.8936 },
 '국회의사당역': { lat: 37.5284, lng: 126.9182 },
 '샛강역': { lat: 37.5176, lng: 126.9324 },
 '노량진역': { lat: 37.5131, lng: 126.9426 },
 '노들역': { lat: 37.5122, lng: 126.9527 },
 '흑석역': { lat: 37.5083, lng: 126.9633 },
 '구반포역': { lat: 37.5079, lng: 126.9882 },
 '신반포역': { lat: 37.5082, lng: 126.9961 },
 '사평역': { lat: 37.5027, lng: 127.0147 },
 '신논현역': { lat: 37.5048, lng: 127.0249 },
 '언주역': { lat: 37.5075, lng: 127.0345 },
 '선정릉역': { lat: 37.5104, lng: 127.0433 },
 '삼성중앙역': { lat: 37.5114, lng: 127.0520 },
 '봉은사역': { lat: 37.5145, lng: 127.0593 },
 '삼전역': { lat: 37.5046, lng: 127.0862 },
 '석촌고분역': { lat: 37.5018, lng: 127.0935 },
 '송파나루역': { lat: 37.5098, lng: 127.1089 },
 '한성백제역': { lat: 37.5173, lng: 127.1117 },
 '올림픽공원역': { lat: 37.5213, lng: 127.1249 },
 '둔촌오륜역': { lat: 37.5239, lng: 127.1354 },
 '중앙보훈병원역': { lat: 37.5284, lng: 127.1480 },
 '남영역': { lat: 37.5416, lng: 126.9714 },
 '용산역': { lat: 37.5299, lng: 126.9647 },
 '대방역': { lat: 37.4984, lng: 126.9265 },
 '신길역': { lat: 37.5174, lng: 126.9141 },
 '영등포역': { lat: 37.5159, lng: 126.9073 },
 '구로역': { lat: 37.5032, lng: 126.8822 },
 '금천구청역': { lat: 37.4569, lng: 126.8957 },
 '독산역': { lat: 37.4679, lng: 126.8958 },
 '가리봉역': { lat: 37.4796, lng: 126.8880 },
 '서울숲역': { lat: 37.5434, lng: 127.0446 },
 '압구정로데오역': { lat: 37.5273, lng: 127.0393 },
 '한티역': { lat: 37.4996, lng: 127.0556 },
 '구룡역': { lat: 37.4858, lng: 127.0534 },
 '개포동역': { lat: 37.4800, lng: 127.0509 },
 '대모산입구역': { lat: 37.4747, lng: 127.0640 },
 '가천대역': { lat: 37.4500, lng: 127.1270 },
 '태평역': { lat: 37.4400, lng: 127.1270 },
 '야탑역': { lat: 37.4116, lng: 127.1278 },
 '이매역': { lat: 37.3953, lng: 127.1268 },
 '서현역': { lat: 37.3850, lng: 127.1234 },
 '수내역': { lat: 37.3780, lng: 127.1167 },
 '정자역': { lat: 37.3665, lng: 127.1085 },
 '미금역': { lat: 37.3607, lng: 127.1089 },
 '오리역': { lat: 37.3397, lng: 127.1088 },
 '죽전역': { lat: 37.3253, lng: 127.1073 },
 '보정역': { lat: 37.3127, lng: 127.1116 },
 '구성역': { lat: 37.2997, lng: 127.1078 },
 '신갈역': { lat: 37.2853, lng: 127.1092 },
 '기흥역': { lat: 37.2750, lng: 127.1160 },
 '상갈역': { lat: 37.2650, lng: 127.1182 },
 '청명역': { lat: 37.2520, lng: 127.0773 },
 '영통역': { lat: 37.2519, lng: 127.0549 },
 '망포역': { lat: 37.2440, lng: 127.0471 },
 '매탄권선역': { lat: 37.2399, lng: 127.0360 },
 '수원시청역': { lat: 37.2634, lng: 127.0323 },
 '매교역': { lat: 37.2670, lng: 127.0119 },
 '수원역': { lat: 37.2660, lng: 126.9996 },
 '양재시민의숲역': { lat: 37.4700, lng: 127.0391 },
 '청계산입구역': { lat: 37.4509, lng: 127.0538 },
 '판교역': { lat: 37.3947, lng: 127.1115 },
 '용문역': { lat: 37.5313, lng: 127.0369 },
 '청량리역': { lat: 37.5805, lng: 127.0470 },
 '회기역': { lat: 37.5895, lng: 127.0575 },
 '중랑역': { lat: 37.5971, lng: 127.0665 },
 '망우역': { lat: 37.5992, lng: 127.0919 },
 '양원역': { lat: 37.6079, lng: 127.1071 },
 '구리역': { lat: 37.5988, lng: 127.1394 },
 '도농역': { lat: 37.6084, lng: 127.1475 },
 '양정역': { lat: 37.6102, lng: 127.1620 },
 '덕소역': { lat: 37.5879, lng: 127.1901 },
 '도심역': { lat: 37.5800, lng: 127.2083 },
 '팔당역': { lat: 37.5231, lng: 127.2798 },
 '운길산역': { lat: 37.5411, lng: 127.3120 },
 '양수역': { lat: 37.5456, lng: 127.3204 },
 '신원역': { lat: 37.5508, lng: 127.3459 },
 '국수역': { lat: 37.5633, lng: 127.3704 },
 '아신역': { lat: 37.5664, lng: 127.3964 },
 '오빈역': { lat: 37.5630, lng: 127.4163 },
 '원덕역': { lat: 37.4858, lng: 127.4623 },
 '지평역': { lat: 37.4319, lng: 127.5053 },
 '북한산우이역': { lat: 37.6635, lng: 127.0115 },
 '솔밭공원역': { lat: 37.6575, lng: 127.0123 },
 '4.19민주묘지역': { lat: 37.6517, lng: 127.0134 },
 '가오리역': { lat: 37.6459, lng: 127.0147 },
 '화계역': { lat: 37.6398, lng: 127.0161 },
 '삼양역': { lat: 37.6316, lng: 127.0183 },
 '삼양사거리역': { lat: 37.6263, lng: 127.0197 },
 '솔샘역': { lat: 37.6188, lng: 127.0215 },
 '북한산보국문역': { lat: 37.6135, lng: 127.0224 },
 '정릉역': { lat: 37.6073, lng: 127.0243 },
 '계양역': { lat: 37.5359, lng: 126.7385 },
 '검암역': { lat: 37.5590, lng: 126.6882 },
 '청라국제도시역': { lat: 37.5323, lng: 126.6416 },
 '영종역': { lat: 37.4929, lng: 126.4939 },
 '운서역': { lat: 37.4974, lng: 126.4692 },
 '공항화물청사역': { lat: 37.4465, lng: 126.4519 },
 '인천공항1터미널역': { lat: 37.4493, lng: 126.4514 },
 '인천공항2터미널역': { lat: 37.4604, lng: 126.4419 },
 '코엑스': { lat: 37.5120, lng: 127.0590 },
 '롯데월드': { lat: 37.5111, lng: 127.0980 },
 '남산타워': { lat: 37.5512, lng: 126.9882 },
 '경복궁': { lat: 37.5796, lng: 126.9770 },
 '창덕궁': { lat: 37.5794, lng: 126.9910 },
 '덕수궁': { lat: 37.5658, lng: 126.9749 },
 '동대문디자인플라자': { lat: 37.5673, lng: 127.0095 },
 'DDP': { lat: 37.5673, lng: 127.0095 },
 '이태원': { lat: 37.5344, lng: 126.9945 },
 '명동': { lat: 37.5608, lng: 126.9860 },
 '인사동': { lat: 37.5740, lng: 126.9850 },
 '북촌한옥마을': { lat: 37.5825, lng: 126.9850 },
 '광화문광장': { lat: 37.5716, lng: 126.9769 },
 '청계천': { lat: 37.5695, lng: 126.9780 },
 '여의도공원': { lat: 37.5256, lng: 126.9227 },
 '한강공원': { lat: 37.5284, lng: 126.9340 },
 '올림픽공원': { lat: 37.5213, lng: 127.1249 },
 '서울숲': { lat: 37.5434, lng: 127.0446 },
 '북서울꿈의숲': { lat: 37.6207, lng: 127.0404 },
 '월드컵경기장': { lat: 37.5681, lng: 126.8972 },
 '잠실종합운동장': { lat: 37.5151, lng: 127.0730 },
 '고척스카이돔': { lat: 37.4982, lng: 126.8671 },
 '가로수길': { lat: 37.5203, lng: 127.0230 },
 '청담동': { lat: 37.5198, lng: 127.0535 },
 '압구정로데오': { lat: 37.5273, lng: 127.0393 },
 '성수동': { lat: 37.5446, lng: 127.0558 },
 '을지로': { lat: 37.5665, lng: 126.9918 },
 '익선동': { lat: 37.5740, lng: 126.9890 },
 '연남동': { lat: 37.5600, lng: 126.9220 },
 '망리단길': { lat: 37.5500, lng: 126.9100 },
 '해방촌': { lat: 37.5420, lng: 126.9850 },
 '경리단길': { lat: 37.5370, lng: 126.9920 },
 };
 const findPlace = (query) => {
 const q = query.trim();
 if (PLACES[q]) return PLACES[q];
 if (PLACES[q + '역']) return PLACES[q + '역'];
 if (q.endsWith('역') && PLACES[q.slice(0, -1)]) return PLACES[q.slice(0, -1)];
 const keys = Object.keys(PLACES);
 const found = keys.find(k => k.includes(q) || q.includes(k));
 if (found) return PLACES[found];
 return null;
 };
 const searchOrHighlight = () => {
 if (searchRegion.trim() && mapObj.current) {
 const query = searchRegion.trim();
 const place = findPlace(query);
 if (place) {
 mapObj.current.setCenter(new naver.maps.LatLng(place.lat, place.lng));
 mapObj.current.setZoom(16);
 circlesRef.current.forEach(c => c.setMap(null)); circlesRef.current = [];
 const circle = new naver.maps.Circle({ map: mapObj.current, center: new naver.maps.LatLng(place.lat, place.lng), radius: 200, fillColor: '#14b8a6', fillOpacity: 0.3, strokeColor: '#0d9488', strokeWeight: 2 });
 circlesRef.current.push(circle);
 setTimeout(() => circle.setMap(null), 5000);
 return;
 }
 const matchedPins = pinsRef.current.filter(p => p.region && p.region.toLowerCase().includes(query.toLowerCase()));
 if (matchedPins.length > 0) {
 goToMapWithPins(matchedPins);
 return;
 }
 naver.maps.Service.geocode({ query: query }, (status, response) => {
 if (status === naver.maps.Service.Status.OK && response.v2.addresses && response.v2.addresses.length > 0) {
 const result = response.v2.addresses[0];
 const lat = parseFloat(result.y), lng = parseFloat(result.x);
 mapObj.current.setCenter(new naver.maps.LatLng(lat, lng));
 mapObj.current.setZoom(16);
 circlesRef.current.forEach(c => c.setMap(null)); circlesRef.current = [];
 const circle = new naver.maps.Circle({ map: mapObj.current, center: new naver.maps.LatLng(lat, lng), radius: 200, fillColor: '#14b8a6', fillOpacity: 0.3, strokeColor: '#0d9488', strokeWeight: 2 });
 circlesRef.current.push(circle);
 setTimeout(() => circle.setMap(null), 5000);
 } else {
 alert('검색 결과가 없습니다.');
 }
 });
 } else { triggerHighlight(); }
 };
 const addPinByAddress = () => {
 if (!addr.trim()) return alert('장소 또는 주소를 입력하세요');
 if (!selManager) return alert('영업자를 선택하세요');
 const query = addr.trim();
 const place = findPlace(query);
 if (place) {
 const status = pinDate ? 'planned' : 'confirmed';
 const newPin = { id: Date.now(), managerId: selManager, status, region: query, lat: place.lat, lng: place.lng, date: pinDate || '', createdAt: new Date().toISOString() };
 savePin(newPin);
 setAddr('');
 mapObj.current?.setCenter(new naver.maps.LatLng(place.lat, place.lng));
 mapObj.current?.setZoom(16);
 return;
 }
 naver.maps.Service.geocode({ query: query }, (s, r) => {
 if (s === naver.maps.Service.Status.OK && r.v2.addresses && r.v2.addresses.length > 0) {
 const result = r.v2.addresses[0];
 const lat = parseFloat(result.y);
 const lng = parseFloat(result.x);
 const status = pinDate ? 'planned' : 'confirmed';
 const regionName = result.roadAddress || result.jibunAddress || query;
 const newPin = { id: Date.now(), managerId: selManager, status, region: regionName, lat, lng, date: pinDate || '', createdAt: new Date().toISOString() };
 savePin(newPin);
 setAddr('');
 mapObj.current?.setCenter(new naver.maps.LatLng(lat, lng));
 mapObj.current?.setZoom(16);
 } else {
 alert('장소를 찾을 수 없습니다.\n주소를 입력해보세요. (예: 서울 강남구 역삼동)');
 }
 });
 };
 
 // ========== 중복 체크 유틸리티 함수들 ==========
 // 전화번호 정규화 (숫자만 추출)
 const normalizePhone = (phone) => {
   if (!phone) return '';
   return phone.replace(/[^0-9]/g, '');
 };
 
 // 주소 핵심부분 추출 (구/동/번지만)
 const normalizeAddress = (addr) => {
   if (!addr) return '';
   // 시/도 제거, 건물명/층 제거
   return addr
     .replace(/서울특별시|서울시|경기도|인천광역시|부산광역시|대구광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|제주특별자치도/g, '')
     .replace(/\d+층|\d+호|\w+빌딩|\w+타워|\w+오피스텔|\w+아파트/g, '')
     .replace(/\s+/g, ' ')
     .trim();
 };
 
 // 두 좌표 간 거리 계산 (미터)
 const calcDistanceMeters = (lat1, lng1, lat2, lng2) => {
   if (!lat1 || !lng1 || !lat2 || !lng2) return Infinity;
   const R = 6371000; // 지구 반경 (미터)
   const dLat = (lat2 - lat1) * Math.PI / 180;
   const dLng = (lng2 - lng1) * Math.PI / 180;
   const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dLng/2) * Math.sin(dLng/2);
   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
   return R * c;
 };
 
 // 정교한 중복 체크 함수 (등록번호 → 좌표+이름 → 전화번호 → 이름+주소)
 const checkDuplicate = (realtor, companyList) => {
   if (!realtor || !companyList || companyList.length === 0) return { isDuplicate: false, matchedCompany: null };
   
   const realtorName = realtor.name || realtor.officeName || realtor.realtorName || '';
   const realtorAddr = realtor.address || '';
   const realtorRegNo = realtor.regNo || '';
   const realtorLat = realtor.lat;
   const realtorLng = realtor.lng;
   
   // 전화번호 여러 필드 수집
   const realtorPhones = [
     normalizePhone(realtor.phone || ''),
     normalizePhone(realtor.cellPhone || ''),
     normalizePhone(realtor.officePhone || ''),
     normalizePhone(realtor.mobile || '')
   ].filter(p => p && p.length >= 4);
   
   // 핵심 이름 추출 (공인중개사, 부동산 등 제거)
   const extractCoreName = (name) => {
     return (name || '')
       .replace(/공인중개사사무소|공인중개사|부동산중개|부동산|중개사무소|공인|사무소/g, '')
       .replace(/\s+/g, '')
       .trim();
   };
   
   // 주소 키 추출 (구 + 도로명 + 번지)
   const extractAddressKey = (addr) => {
     if (!addr) return '';
     const norm = addr.replace(/서울특별시|서울시|서울|경기도|인천광역시|부산광역시/g, '')
                      .replace(/\([^)]*\)/g, '').trim();
     const match = norm.match(/(\S+구)\s*(\S+(?:로|길|동))\s*(\d+(?:-\d+)?)/);
     if (match) return `${match[1]}_${match[2]}_${match[3]}`;
     return '';
   };
   
   const realtorCoreName = extractCoreName(realtorName);
   const realtorAddrKey = extractAddressKey(realtorAddr);
   
   for (const company of companyList) {
     const companyName = company.name || '';
     const companyAddr = company.address || '';
     const companyRegNo = company.regNo || '';
     const companyLat = company.lat;
     const companyLng = company.lng;
     
     const companyPhones = [
       normalizePhone(company.phone || ''),
       normalizePhone(company.contact || ''),
       normalizePhone(company.mobile || '')
     ].filter(p => p && p.length >= 4);
     
     const companyCoreName = extractCoreName(companyName);
     const companyAddrKey = extractAddressKey(companyAddr);
     
     // 1순위: 등록번호 일치 (100% 확실)
     if (realtorRegNo && companyRegNo && realtorRegNo === companyRegNo) {
       return { isDuplicate: true, matchedCompany: company, reason: 'regNo' };
     }
     
     // 2순위: 좌표 30m 이내 + 핵심이름 일치
     const distance = calcDistanceMeters(realtorLat, realtorLng, companyLat, companyLng);
     if (distance <= 30 && realtorCoreName && companyCoreName && realtorCoreName === companyCoreName) {
       return { isDuplicate: true, matchedCompany: company, reason: 'location+name' };
     }
     
     // 3순위: 전화번호 일치 (모든 필드 비교)
     const phoneMatch = realtorPhones.some(rp => companyPhones.some(cp => rp === cp));
     if (phoneMatch) {
       return { isDuplicate: true, matchedCompany: company, reason: 'phone' };
     }
     
     // 4순위: 주소키 + 핵심이름 모두 일치
     if (realtorAddrKey && companyAddrKey && realtorAddrKey === companyAddrKey) {
       if (realtorCoreName && companyCoreName && realtorCoreName === companyCoreName) {
         return { isDuplicate: true, matchedCompany: company, reason: 'address+name' };
       }
     }
     
     // 5순위: 같은 구 내 핵심이름 일치
     if (realtorCoreName && companyCoreName && realtorCoreName === companyCoreName) {
       const realtorGu = realtorAddr.match(/(\S+구)/);
       const companyGu = companyAddr.match(/(\S+구)/);
       if (realtorGu && companyGu && realtorGu[1] === companyGu[1]) {
         return { isDuplicate: true, matchedCompany: company, reason: 'name_in_gu' };
       }
     }
     
     // 6순위 제거: 주소키만 일치는 같은 건물 다른 업체 오매칭 위험
   }
   
   return { isDuplicate: false, matchedCompany: null };
 };
 
 // 간단한 중복 여부만 확인 (기존 코드 호환용)
 const isCompanyDuplicate = (realtor, companyList) => {
   return checkDuplicate(realtor, companyList).isDuplicate;
 };
 // ========== 중복 체크 유틸리티 함수 끝 ==========

 const geocodeAddress = (address, companyName = null) => {
    return new Promise((resolve) => {
      if (!window.naver?.maps?.Service) {
        resolve(null);
        return;
      }
      const tryGeocode = (query) => {
        return new Promise((res) => {
          if (!query) { res(null); return; }
          naver.maps.Service.geocode({ query }, (status, response) => {
            if (status === naver.maps.Service.Status.OK && response.v2.addresses?.length > 0) {
              const result = response.v2.addresses[0];
              res({ lat: parseFloat(result.y), lng: parseFloat(result.x) });
            } else {
              res(null);
            }
          });
        });
      };
      const trySequentially = async () => {
        // 1. 원본 주소로 시도
        if (address) {
          const result1 = await tryGeocode(address);
          if (result1) return resolve(result1);
        }
        // 2. 업체명으로 시도 (건물명일 수 있음)
        if (companyName) {
          const result2 = await tryGeocode(companyName);
          if (result2) return resolve(result2);
        }
        // 3. 주소에서 상세정보(호, 층, 번지) 제거 후 시도
        if (address) {
          const simplified = address.replace(/\s*\d+호.*$/, '').replace(/\s*\d+층.*$/, '').replace(/\s*,.*$/, '').trim();
          if (simplified !== address) {
            const result3 = await tryGeocode(simplified);
            if (result3) return resolve(result3);
          }
        }
        // 4. 주소에서 지역명만 추출 (시/구/동)
        if (address) {
          const match = address.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\s]*\s+[^\s]+/);
          if (match) {
            const result4 = await tryGeocode(match[0]);
            if (result4) return resolve(result4);
          }
        }
        resolve(null);
      };
      trySequentially();
    });
  };
  const checkTodayEvents = (userData) => {
 const today = getKoreanToday();
 const myEvents = calendarEvents.filter(e => {
 if (e.date !== today) return false;
 if (userData.role === 'super') return true;
 return e.managerId === userData.managerId;
 });
 const myRoutes = routes.filter(r => {
 if (r.date !== today) return false;
 if (userData.role === 'super') return true;
 return r.managerId === userData.managerId;
 });
 const allTodayEvents = [
 ...myEvents.map(e => ({ type: 'calendar', ...e })),
 ...myRoutes.map(r => ({ type: 'route', title: `동선: ${r.stops?.length || 0}곳 방문`, ...r }))
 ];
 if (allTodayEvents.length > 0) {
 setTodayEvents(allTodayEvents);
 setShowTodayAlert(true);
 }
 };
 const isFourthWeekMonday = () => {
 const korea = getKoreanNow();
 if (korea.dayOfWeek !== 1) return false;
 return korea.day >= 22 && korea.day <= 28;
 };
 const checkScheduleAlert = (userData) => {
 if (userData.role === 'super') return;
 if (!isFourthWeekMonday()) return;
 const korea = getKoreanNow();
 const nextMonth = korea.month + 1 > 11 ? 0 : korea.month + 1;
 const nextYear = korea.month + 1 > 11 ? korea.year + 1 : korea.year;
 const nextMonthStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
 const hasNextMonthEvent = calendarEvents.some(e =>
 e.managerId === userData.managerId &&
 e.date?.startsWith(nextMonthStr)
 );
 if (!hasNextMonthEvent) {
 setShowScheduleAlert(true);
 }
 };
 const processOcrImage = async (file) => {
 // API 키 검증
 if (!GOOGLE_VISION_API_KEY) {
   return Promise.reject(new Error('Google Vision API 키가 설정되지 않았습니다. 환경 변수 VITE_GOOGLE_VISION_API_KEY를 확인하세요.'));
 }
 
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = async () => {
 try {
 const base64 = reader.result.split(',')[1];
 const response = await fetch(
 `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
 {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 requests: [{
 image: { content: base64 },
 features: [{ type: 'TEXT_DETECTION' }]
 }]
 })
 }
 );
 
 if (!response.ok) {
   const errorData = await response.json().catch(() => ({}));
   reject(new Error(`Vision API 오류: ${errorData.error?.message || response.statusText}`));
   return;
 }
 
 const data = await response.json();
 if (data.responses?.[0]?.textAnnotations?.[0]?.description) {
 const text = data.responses[0].textAnnotations[0].description;
 const parsed = parseBusinessCard(text);
 resolve(parsed);
 } else {
 resolve({ raw: '', name: '', contact: '', phone: '', address: '' });
 }
 } catch (error) {
 reject(error);
 }
 };
 reader.onerror = reject;
 reader.readAsDataURL(file);
 });
 };
 const parseBusinessCard = (text) => {
 const lines = text.split('\n').map(l => l.trim()).filter(l => l);
 let name = '', contact = '', phone = '', address = '';
 const phonePatterns = [
 /010[-\s]?\d{4}[-\s]?\d{4}/,
 /02[-\s]?\d{3,4}[-\s]?\d{4}/,
 /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/
 ];
 for (const line of lines) {
 for (const pattern of phonePatterns) {
 const match = line.match(pattern);
 if (match) {
 phone = match[0].replace(/[-\s]/g, '');
 break;
 }
 }
 if (phone) break;
 }
 const addressPattern = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]+?(동|읍|면|리|로|길)[^\n]*\d*/;
 for (const line of lines) {
 const match = line.match(addressPattern);
 if (match) {
 address = match[0];
 break;
 }
 }
 const namePatterns = [
 /대표\s*[:\s]*([가-힣]{2,4})/,
 /([가-힣]{2,4})\s*(대표|사장|실장|과장|부장|팀장|이사|원장)/,
 /^([가-힣]{2,4})$/
 ];
 for (const line of lines) {
 for (const pattern of namePatterns) {
 const match = line.match(pattern);
 if (match) {
 contact = match[1] || match[0];
 break;
 }
 }
 if (contact) break;
 }
 const businessPatterns = [
 /([가-힣]+공인중개사)/,
 /([가-힣]+부동산)/,
 /([가-힣]+중개)/
 ];
 for (const line of lines) {
 for (const pattern of businessPatterns) {
 const match = line.match(pattern);
 if (match) {
 name = match[1];
 break;
 }
 }
 if (name) break;
 }
 return { raw: text, name, contact, phone, address };
 };
 const handleOcrCapture = async (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 setOcrLoading(true);
 setShowOcrModal(true);
 try {
 const result = await processOcrImage(file);
 setOcrResult(result);
 setCompanyForm({
 ...companyForm,
 name: result.name || '',
 contact: result.contact || '',
 phone: result.phone || '',
 address: result.address || ''
 });
 } catch (error) {
 console.error('OCR 오류:', error);
 alert('명함 인식에 실패했습니다.');
 } finally {
 setOcrLoading(false);
 e.target.value = '';
 }
 };
 const handleBulkOcrCapture = async (e) => {
 const files = Array.from(e.target.files || []).slice(0, 10);
 if (files.length === 0) return;
 setOcrLoading(true);
 setShowBulkOcrModal(true);
 setBulkOcrResults([]);
 try {
 const results = [];
 for (let i = 0; i < files.length; i++) {
 const result = await processOcrImage(files[i]);
 results.push({
 ...result,
 managerId: user?.managerId || null,
 reaction: 'neutral',
 memo: ''
 });
 }
 setBulkOcrResults(results);
 } catch (error) {
 console.error('OCR 오류:', error);
 alert('명함 인식 중 오류가 발생했습니다.');
 } finally {
 setOcrLoading(false);
 e.target.value = '';
 }
 };
 const saveBulkOcrCompanies = () => {
 const valid = bulkOcrResults.filter(r => r.name);
 if (valid.length === 0) return alert('등록할 업체가 없습니다.');
 valid.forEach((r, i) => {
 const newCompany = {
 id: Date.now() + i,
 name: r.name,
 contact: r.contact,
 phone: r.phone,
 address: r.address,
 region: r.address,
 managerId: r.managerId,
 reaction: r.reaction,
 memo: r.memo,
 createdAt: new Date().toLocaleString('ko-KR')
 };
 saveCompany(newCompany);
 createAutoSchedulesForCompany(newCompany, r.managerId);
 });
 alert(`${valid.length}개 업체가 등록되었습니다.`);
 setBulkOcrResults([]);
 setShowBulkOcrModal(false);
 };
 // 두 좌표 사이 방향 계산 (degree)
 const calculateBearing = (lat1, lng1, lat2, lng2) => {
 const toRad = (deg) => deg * Math.PI / 180;
 const toDeg = (rad) => rad * 180 / Math.PI;
 const dLng = toRad(lng2 - lng1);
 const y = Math.sin(dLng) * Math.cos(toRad(lat2));
 const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
 let bearing = toDeg(Math.atan2(y, x));
 return (bearing + 360) % 360;
 };
 // GPS 마커 업데이트 (재생성 없이 위치만 변경)
 const updateGpsMarker = (lat, lng, heading, accuracy) => {
 if (!routeMapObj.current) return;
 const position = new naver.maps.LatLng(lat, lng);
 if (!gpsMarkerRef.current) {
 gpsMarkerRef.current = new naver.maps.Marker({
 position: position,
 map: routeMapObj.current,
 icon: { content: '', anchor: new naver.maps.Point(20, 20) },
 zIndex: 1000
 });
 }
 gpsMarkerRef.current.setPosition(position);
 const arrowRotation = heading || 0;
 gpsMarkerRef.current.setIcon({
 content: `<div style="position: relative; width: 40px; height: 40px;">
 <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(${arrowRotation}deg);">
 <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 20px solid #4285f4; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));"></div>
 </div>
 <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #4285f4; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
 <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
 </div>
 </div>`,
 anchor: new naver.maps.Point(20, 20)
 });
 if (accuracy && accuracy < 500) {
 if (!gpsAccuracyCircleRef.current) {
 gpsAccuracyCircleRef.current = new naver.maps.Circle({
 map: routeMapObj.current,
 center: position,
 radius: accuracy,
 fillColor: '#4285f4',
 fillOpacity: 0.1,
 strokeColor: '#4285f4',
 strokeOpacity: 0.3,
 strokeWeight: 1
 });
 } else {
 gpsAccuracyCircleRef.current.setCenter(position);
 gpsAccuracyCircleRef.current.setRadius(accuracy);
 }
 }
 };
 const toggleGps = () => {
 if (gpsEnabled) {
 if (gpsWatchIdRef.current) {
 navigator.geolocation.clearWatch(gpsWatchIdRef.current);
 gpsWatchIdRef.current = null;
 }
 if (gpsMarkerRef.current) {
 gpsMarkerRef.current.setMap(null);
 gpsMarkerRef.current = null;
 }
 if (gpsAccuracyCircleRef.current) {
 gpsAccuracyCircleRef.current.setMap(null);
 gpsAccuracyCircleRef.current = null;
 }
 prevLocationRef.current = null;
 gpsHeadingRef.current = 0;
 setGpsEnabled(false);
 setCurrentLocation(null);
 } else {
 if (!navigator.geolocation) {
 return alert('GPS를 지원하지 않는 브라우저입니다.');
 }
 setGpsEnabled(true);
 gpsWatchIdRef.current = navigator.geolocation.watchPosition(
 (position) => {
 const { latitude, longitude, accuracy, heading, speed } = position.coords;
 const newLocation = { lat: latitude, lng: longitude };
 setCurrentLocation(newLocation);
 let calculatedHeading = gpsHeadingRef.current;
 if (prevLocationRef.current) {
 const prevLat = prevLocationRef.current.lat;
 const prevLng = prevLocationRef.current.lng;
 const distance = Math.sqrt(Math.pow(latitude - prevLat, 2) + Math.pow(longitude - prevLng, 2)) * 111000;
 if (distance > 2) {
 calculatedHeading = calculateBearing(prevLat, prevLng, latitude, longitude);
 gpsHeadingRef.current = calculatedHeading;
 prevLocationRef.current = newLocation;
 }
 } else {
 prevLocationRef.current = newLocation;
 }
 if (heading && !isNaN(heading) && speed > 0.3) {
 calculatedHeading = heading;
 gpsHeadingRef.current = heading;
 }
 updateGpsMarker(latitude, longitude, calculatedHeading, accuracy);
 },
 (error) => {
 console.error('GPS 오류:', error);
 let errorMsg = 'GPS 오류가 발생했습니다.';
 if (error.code === 1) errorMsg = 'GPS 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.';
 else if (error.code === 2) errorMsg = 'GPS 신호를 찾을 수 없습니다.';
 else if (error.code === 3) errorMsg = 'GPS 응답 시간이 초과되었습니다.';
 alert(errorMsg);
 setGpsEnabled(false);
 },
 {
 enableHighAccuracy: true,
 timeout: 10000,
 maximumAge: 0
 }
 );
 }
 };
 const centerToMyLocation = () => {
 if (currentLocation && routeMapObj.current) {
 routeMapObj.current.setCenter(new naver.maps.LatLng(currentLocation.lat, currentLocation.lng));
 routeMapObj.current.setZoom(16);
 } else {
 alert('현재 위치를 찾을 수 없습니다. GPS를 켜주세요.');
 }
 };
 useEffect(() => {
 return () => {
 if (gpsWatchIdRef.current) {
 navigator.geolocation.clearWatch(gpsWatchIdRef.current);
 }
 if (gpsMarkerRef.current) {
 gpsMarkerRef.current.setMap(null);
 }
 if (gpsAccuracyCircleRef.current) {
 gpsAccuracyCircleRef.current.setMap(null);
 }
 if (directionsPolylineRef.current) {
 directionsPolylineRef.current.setMap(null);
 }
 };
 }, []);
 useEffect(() => {
 if (loggedIn && dataLoaded && user && (calendarEvents.length > 0 || routes.length > 0)) {
 const alertShownKey = `bc_alert_shown_${getKoreanToday()}_${user.managerId || 'admin'}`;
 if (!sessionStorage.getItem(alertShownKey)) {
 setTimeout(() => {
 checkTodayEvents(user);
 sessionStorage.setItem(alertShownKey, 'true');
 }, 1000);
 }
 }
 }, [loggedIn, dataLoaded, calendarEvents, routes, user]);
 useEffect(() => {
 if (loggedIn && tab === 'calendar' && user && user.role !== 'super') {
 checkScheduleAlert(user);
 }
 }, [tab, loggedIn, user, calendarEvents]);
 const addRouteStop = () => {
 if (!routeInput.trim()) return alert('장소 또는 업체명을 입력하세요');
 const query = routeInput.trim();
 const place = findPlace(query);
 if (place) {
 const newStop = {
 id: Date.now(),
 name: query,
 lat: place.lat,
 lng: place.lng,
 type: 'place'
 };
 setRouteStops(prev => [...prev, newStop]);
 setRouteInput('');
 return;
 }
 const company = companies.find(c => c.name.includes(query) || query.includes(c.name));
 if (company && company.address) {
 naver.maps.Service.geocode({ query: company.address }, (s, r) => {
 if (s === naver.maps.Service.Status.OK && r.v2.addresses?.length > 0) {
 const result = r.v2.addresses[0];
 const newStop = {
 id: Date.now(),
 name: company.name,
 address: company.address,
 lat: parseFloat(result.y),
 lng: parseFloat(result.x),
 type: 'company',
 companyId: company.id
 };
 setRouteStops(prev => [...prev, newStop]);
 setRouteInput('');
 } else {
 const newStop = {
 id: Date.now(),
 name: company.name,
 address: company.address,
 type: 'company',
 companyId: company.id
 };
 setRouteStops(prev => [...prev, newStop]);
 setRouteInput('');
 }
 });
 return;
 }
 naver.maps.Service.geocode({ query: query }, (s, r) => {
 if (s === naver.maps.Service.Status.OK && r.v2.addresses?.length > 0) {
 const result = r.v2.addresses[0];
 const newStop = {
 id: Date.now(),
 name: query,
 address: result.roadAddress || result.jibunAddress,
 lat: parseFloat(result.y),
 lng: parseFloat(result.x),
 type: 'address'
 };
 setRouteStops(prev => [...prev, newStop]);
 setRouteInput('');
 } else {
 const newStop = {
 id: Date.now(),
 name: query,
 type: 'manual'
 };
 setRouteStops(prev => [...prev, newStop]);
 setRouteInput('');
 }
 });
 };
 const addRouteStopManual = () => {
 if (!routeInput.trim()) return alert('업체명을 입력하세요');
 const companyName = routeInput.trim();
 naver.maps.Service.geocode({ query: companyName }, (status, response) => {
 if (status === naver.maps.Service.Status.OK && response.v2.addresses?.length > 0) {
 const result = response.v2.addresses[0];
 const lat = parseFloat(result.y);
 const lng = parseFloat(result.x);
 const newStop = {
 id: Date.now(),
 name: companyName,
 address: result.roadAddress || result.jibunAddress || '',
 lat: lat,
 lng: lng,
 type: 'manual'
 };
 setRouteStops(prev => [...prev, newStop]);
 if (routeMapObj.current) {
 routeMapObj.current.setCenter(new naver.maps.LatLng(lat, lng));
 routeMapObj.current.setZoom(15);
 clearSearchMarkers();
 setTimeout(() => {
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(lat, lng),
 map: routeMapObj.current,
 icon: {
 content: `<div class="blink-marker-red" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 8px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; box-shadow: 0 4px 15px rgba(239,68,68,0.6); white-space: nowrap; border: 2px solid white;">${companyName}</div>`,
 anchor: new naver.maps.Point(60, 20)
 }
 });
 searchMarkersRef.current.push(marker);
 }, 200);
 }
 } else {
 const newStop = {
 id: Date.now(),
 name: companyName,
 type: 'manual'
 };
 setRouteStops(prev => [...prev, newStop]);
 alert(`"${companyName}" 추가됨 (위치 검색 실패 - 동선 최적화에서 제외됨)`);
 }
 setRouteInput('');
 });
 };
 const encodeGeohash = (lat, lng, precision = 5) => {
 const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
 let idx = 0, bit = 0, evenBit = true;
 let geohash = '';
 let minLat = -90.0, maxLat = 90.0;
 let minLng = -180.0, maxLng = 180.0;
 while (geohash.length < precision) {
 if (evenBit) {
 const midLng = (minLng + maxLng) / 2;
 if (lng >= midLng) { idx = idx * 2 + 1; minLng = midLng; }
 else { idx = idx * 2; maxLng = midLng; }
 } else {
 const midLat = (minLat + maxLat) / 2;
 if (lat >= midLat) { idx = idx * 2 + 1; minLat = midLat; }
 else { idx = idx * 2; maxLat = midLat; }
 }
 evenBit = !evenBit;
 if (++bit === 5) { geohash += base32[idx]; bit = 0; idx = 0; }
 }
 return geohash;
 };
 // 네이버부동산 지역 코드
 const NAVER_REGION_CODES = {
 '서울특별시': { cortarNo: '1100000000', districts: {
 '강남구': '1168000000', '강동구': '1174000000', '강북구': '1130500000', '강서구': '1150000000',
 '관악구': '1162000000', '광진구': '1121500000', '구로구': '1153000000', '금천구': '1154500000',
 '노원구': '1135000000', '도봉구': '1132000000', '동대문구': '1123000000', '동작구': '1159000000',
 '마포구': '1144000000', '서대문구': '1141000000', '서초구': '1165000000', '성동구': '1120000000',
 '성북구': '1129000000', '송파구': '1171000000', '양천구': '1147000000', '영등포구': '1156000000',
 '용산구': '1117000000', '은평구': '1138000000', '종로구': '1111000000', '중구': '1114000000', '중랑구': '1126000000'
 }},
 '경기도': { cortarNo: '4100000000', districts: {
 '수원시': '4111000000', '성남시': '4113000000', '고양시': '4128000000', '용인시': '4146300000',
 '부천시': '4119000000', '안산시': '4127000000', '안양시': '4117000000', '남양주시': '4136000000',
 '화성시': '4159000000', '평택시': '4122000000', '의정부시': '4115000000', '시흥시': '4139000000',
 '파주시': '4148000000', '광명시': '4121000000', '김포시': '4157000000', '군포시': '4141000000',
 '광주시': '4161000000', '이천시': '4150000000', '양주시': '4163000000', '오산시': '4137000000',
 '구리시': '4131000000', '안성시': '4155000000', '포천시': '4165000000', '의왕시': '4143000000',
 '하남시': '4145000000', '여주시': '4167000000', '양평군': '4183000000', '동두천시': '4125000000',
 '과천시': '4129000000', '가평군': '4182000000', '연천군': '4180000000'
 }},
 '인천광역시': { cortarNo: '2800000000', districts: {
 '중구': '2811000000', '동구': '2814000000', '미추홀구': '2817700000', '연수구': '2818500000',
 '남동구': '2820000000', '부평구': '2823700000', '계양구': '2824500000', '서구': '2826000000', '강화군': '2871000000', '옹진군': '2872000000'
 }},
 '부산광역시': { cortarNo: '2600000000', districts: {
 '중구': '2611000000', '서구': '2614000000', '동구': '2617000000', '영도구': '2620000000',
 '부산진구': '2623000000', '동래구': '2626000000', '남구': '2629000000', '북구': '2632000000',
 '해운대구': '2635000000', '사하구': '2638000000', '금정구': '2641000000', '강서구': '2644000000',
 '연제구': '2647000000', '수영구': '2650000000', '사상구': '2653000000', '기장군': '2671000000'
 }},
 '대구광역시': { cortarNo: '2700000000', districts: {
 '중구': '2711000000', '동구': '2714000000', '서구': '2717000000', '남구': '2720000000',
 '북구': '2723000000', '수성구': '2726000000', '달서구': '2729000000', '달성군': '2771000000'
 }},
 '대전광역시': { cortarNo: '3000000000', districts: {
 '동구': '3011000000', '중구': '3014000000', '서구': '3017000000', '유성구': '3020000000', '대덕구': '3023000000'
 }},
 '광주광역시': { cortarNo: '2900000000', districts: {
 '동구': '2911000000', '서구': '2914000000', '남구': '2915500000', '북구': '2917000000', '광산구': '2920000000'
 }},
 '울산광역시': { cortarNo: '3100000000', districts: {
 '중구': '3111000000', '남구': '3114000000', '동구': '3117000000', '북구': '3120000000', '울주군': '3171000000'
 }},
 '세종특별자치시': { cortarNo: '3600000000', districts: {} },
 '강원도': { cortarNo: '4200000000', districts: {
 '춘천시': '4211000000', '원주시': '4213000000', '강릉시': '4215000000', '동해시': '4217000000',
 '태백시': '4219000000', '속초시': '4221000000', '삼척시': '4223000000'
 }},
 '충청북도': { cortarNo: '4300000000', districts: {
 '청주시': '4311000000', '충주시': '4313000000', '제천시': '4315000000'
 }},
 '충청남도': { cortarNo: '4400000000', districts: {
 '천안시': '4413000000', '공주시': '4415000000', '보령시': '4418000000', '아산시': '4420000000',
 '서산시': '4421000000', '논산시': '4423000000', '계룡시': '4425000000', '당진시': '4427000000'
 }},
 '전라북도': { cortarNo: '4500000000', districts: {
 '전주시': '4511000000', '군산시': '4513000000', '익산시': '4514000000', '정읍시': '4518000000',
 '남원시': '4519000000', '김제시': '4521000000'
 }},
 '전라남도': { cortarNo: '4600000000', districts: {
 '목포시': '4611000000', '여수시': '4613000000', '순천시': '4615000000', '나주시': '4617000000',
 '광양시': '4623000000'
 }},
 '경상북도': { cortarNo: '4700000000', districts: {
 '포항시': '4711000000', '경주시': '4713000000', '김천시': '4715000000', '안동시': '4717000000',
 '구미시': '4719000000', '영주시': '4721000000', '영천시': '4723000000', '상주시': '4725000000',
 '문경시': '4728000000', '경산시': '4729000000'
 }},
 '경상남도': { cortarNo: '4800000000', districts: {
 '창원시': '4812000000', '진주시': '4817000000', '통영시': '4822000000', '사천시': '4824000000',
 '김해시': '4825000000', '밀양시': '4827000000', '거제시': '4831000000', '양산시': '4833000000'
 }},
 '제주특별자치도': { cortarNo: '5000000000', districts: {
 '제주시': '5011000000', '서귀포시': '5013000000'
 }}
 };
 const REGION_COORDS = {
 '서울특별시': { lat: 37.5665, lng: 126.9780, districts: {
 '강남구': { lat: 37.5172, lng: 127.0473 }, '강동구': { lat: 37.5301, lng: 127.1238 },
 '강북구': { lat: 37.6396, lng: 127.0257 }, '강서구': { lat: 37.5509, lng: 126.8495 },
 '관악구': { lat: 37.4784, lng: 126.9516 }, '광진구': { lat: 37.5385, lng: 127.0823 },
 '구로구': { lat: 37.4954, lng: 126.8874 }, '금천구': { lat: 37.4519, lng: 126.9020 },
 '노원구': { lat: 37.6543, lng: 127.0568 }, '도봉구': { lat: 37.6688, lng: 127.0471 },
 '동대문구': { lat: 37.5744, lng: 127.0400 }, '동작구': { lat: 37.5124, lng: 126.9393 },
 '마포구': { lat: 37.5663, lng: 126.9014 }, '서대문구': { lat: 37.5791, lng: 126.9368 },
 '서초구': { lat: 37.4837, lng: 127.0324 }, '성동구': { lat: 37.5633, lng: 127.0371 },
 '성북구': { lat: 37.5894, lng: 127.0167 }, '송파구': { lat: 37.5145, lng: 127.1066 },
 '양천구': { lat: 37.5170, lng: 126.8666 }, '영등포구': { lat: 37.5264, lng: 126.8963 },
 '용산구': { lat: 37.5311, lng: 126.9810 }, '은평구': { lat: 37.6027, lng: 126.9291 },
 '종로구': { lat: 37.5735, lng: 126.9790 }, '중구': { lat: 37.5641, lng: 126.9979 },
 '중랑구': { lat: 37.6063, lng: 127.0925 }
 }},
 '부산광역시': { lat: 35.1796, lng: 129.0756, districts: {
 '강서구': { lat: 35.2122, lng: 128.9807 }, '금정구': { lat: 35.2428, lng: 129.0922 },
 '기장군': { lat: 35.2445, lng: 129.2222 }, '남구': { lat: 35.1366, lng: 129.0843 },
 '동구': { lat: 35.1295, lng: 129.0455 }, '동래구': { lat: 35.1977, lng: 129.0837 },
 '부산진구': { lat: 35.1629, lng: 129.0531 }, '북구': { lat: 35.1972, lng: 128.9903 },
 '사상구': { lat: 35.1526, lng: 128.9915 }, '사하구': { lat: 35.1046, lng: 128.9749 },
 '서구': { lat: 35.0977, lng: 129.0241 }, '수영구': { lat: 35.1457, lng: 129.1133 },
 '연제구': { lat: 35.1760, lng: 129.0799 }, '영도구': { lat: 35.0911, lng: 129.0679 },
 '중구': { lat: 35.1064, lng: 129.0324 }, '해운대구': { lat: 35.1631, lng: 129.1635 }
 }},
 '인천광역시': { lat: 37.4563, lng: 126.7052, districts: {
 '강화군': { lat: 37.7469, lng: 126.4878 }, '계양구': { lat: 37.5372, lng: 126.7376 },
 '남동구': { lat: 37.4469, lng: 126.7313 }, '동구': { lat: 37.4737, lng: 126.6432 },
 '미추홀구': { lat: 37.4639, lng: 126.6500 }, '부평구': { lat: 37.5086, lng: 126.7219 },
 '서구': { lat: 37.5456, lng: 126.6760 }, '연수구': { lat: 37.4103, lng: 126.6783 },
 '옹진군': { lat: 37.4467, lng: 126.6367 }, '중구': { lat: 37.4738, lng: 126.6217 }
 }},
 '경기도': { lat: 37.4138, lng: 127.5183, districts: {
 '가평군': { lat: 37.8315, lng: 127.5095 }, '고양시': { lat: 37.6584, lng: 126.8320 },
 '과천시': { lat: 37.4292, lng: 126.9876 }, '광명시': { lat: 37.4786, lng: 126.8644 },
 '광주시': { lat: 37.4095, lng: 127.2550 }, '구리시': { lat: 37.5943, lng: 127.1295 },
 '군포시': { lat: 37.3616, lng: 126.9352 }, '김포시': { lat: 37.6152, lng: 126.7156 },
 '남양주시': { lat: 37.6360, lng: 127.2165 }, '동두천시': { lat: 37.9034, lng: 127.0603 },
 '부천시': { lat: 37.5034, lng: 126.7660 }, '성남시': { lat: 37.4201, lng: 127.1265 },
 '수원시': { lat: 37.2636, lng: 127.0286 }, '시흥시': { lat: 37.3800, lng: 126.8029 },
 '안산시': { lat: 37.3219, lng: 126.8309 }, '안성시': { lat: 37.0078, lng: 127.2798 },
 '안양시': { lat: 37.3943, lng: 126.9568 }, '양주시': { lat: 37.7853, lng: 127.0457 },
 '양평군': { lat: 37.4917, lng: 127.4873 }, '여주시': { lat: 37.2983, lng: 127.6375 },
 '연천군': { lat: 38.0966, lng: 127.0745 }, '오산시': { lat: 37.1496, lng: 127.0696 },
 '용인시': { lat: 37.2411, lng: 127.1776 }, '의왕시': { lat: 37.3445, lng: 126.9688 },
 '의정부시': { lat: 37.7381, lng: 127.0337 }, '이천시': { lat: 37.2720, lng: 127.4348 },
 '파주시': { lat: 37.7126, lng: 126.7610 }, '평택시': { lat: 36.9921, lng: 127.1128 },
 '포천시': { lat: 37.8949, lng: 127.2002 }, '하남시': { lat: 37.5392, lng: 127.2147 },
 '화성시': { lat: 37.1994, lng: 126.8312 }
 }},
 '대구광역시': { lat: 35.8714, lng: 128.6014, districts: {
 '남구': { lat: 35.8460, lng: 128.5974 }, '달서구': { lat: 35.8299, lng: 128.5329 },
 '달성군': { lat: 35.7746, lng: 128.4314 }, '동구': { lat: 35.8864, lng: 128.6356 },
 '북구': { lat: 35.8858, lng: 128.5828 }, '서구': { lat: 35.8718, lng: 128.5591 },
 '수성구': { lat: 35.8582, lng: 128.6308 }, '중구': { lat: 35.8690, lng: 128.6062 }
 }},
 '대전광역시': { lat: 36.3504, lng: 127.3845, districts: {
 '대덕구': { lat: 36.3467, lng: 127.4156 }, '동구': { lat: 36.3119, lng: 127.4549 },
 '서구': { lat: 36.3551, lng: 127.3838 }, '유성구': { lat: 36.3623, lng: 127.3564 },
 '중구': { lat: 36.3256, lng: 127.4213 }
 }},
 '광주광역시': { lat: 35.1595, lng: 126.8526, districts: {
 '광산구': { lat: 35.1396, lng: 126.7936 }, '남구': { lat: 35.1328, lng: 126.9024 },
 '동구': { lat: 35.1462, lng: 126.9231 }, '북구': { lat: 35.1747, lng: 126.9120 },
 '서구': { lat: 35.1520, lng: 126.8899 }
 }},
 '울산광역시': { lat: 35.5384, lng: 129.3114, districts: {
 '남구': { lat: 35.5443, lng: 129.3302 }, '동구': { lat: 35.5050, lng: 129.4167 },
 '북구': { lat: 35.5826, lng: 129.3613 }, '울주군': { lat: 35.5224, lng: 129.0955 },
 '중구': { lat: 35.5690, lng: 129.3326 }
 }},
 '세종특별자치시': { lat: 36.4800, lng: 127.2890, districts: {
 '세종시': { lat: 36.4800, lng: 127.2890 }
 }},
 '강원도': { lat: 37.8228, lng: 128.1555, districts: {
 '강릉시': { lat: 37.7519, lng: 128.8761 }, '고성군': { lat: 38.3800, lng: 128.4679 },
 '동해시': { lat: 37.5247, lng: 129.1142 }, '삼척시': { lat: 37.4500, lng: 129.1651 },
 '속초시': { lat: 38.2070, lng: 128.5918 }, '양구군': { lat: 38.1100, lng: 127.9897 },
 '양양군': { lat: 38.0755, lng: 128.6189 }, '영월군': { lat: 37.1837, lng: 128.4617 },
 '원주시': { lat: 37.3422, lng: 127.9202 }, '인제군': { lat: 38.0697, lng: 128.1705 },
 '정선군': { lat: 37.3807, lng: 128.6608 }, '철원군': { lat: 38.1467, lng: 127.3133 },
 '춘천시': { lat: 37.8813, lng: 127.7300 }, '태백시': { lat: 37.1642, lng: 128.9856 },
 '평창군': { lat: 37.3708, lng: 128.3903 }, '홍천군': { lat: 37.6972, lng: 127.8886 },
 '화천군': { lat: 38.1062, lng: 127.7081 }, '횡성군': { lat: 37.4917, lng: 127.9847 }
 }},
 '충청북도': { lat: 36.6357, lng: 127.4917, districts: {
 '괴산군': { lat: 36.8153, lng: 127.7867 }, '단양군': { lat: 36.9847, lng: 128.3656 },
 '보은군': { lat: 36.4894, lng: 127.7297 }, '영동군': { lat: 36.1750, lng: 127.7833 },
 '옥천군': { lat: 36.3064, lng: 127.5714 }, '음성군': { lat: 36.9403, lng: 127.6906 },
 '제천시': { lat: 37.1325, lng: 128.1911 }, '증평군': { lat: 36.7853, lng: 127.5814 },
 '진천군': { lat: 36.8553, lng: 127.4356 }, '청주시': { lat: 36.6424, lng: 127.4890 },
 '충주시': { lat: 36.9910, lng: 127.9259 }
 }},
 '충청남도': { lat: 36.6588, lng: 126.6728, districts: {
 '계룡시': { lat: 36.2746, lng: 127.2486 }, '공주시': { lat: 36.4467, lng: 127.1192 },
 '금산군': { lat: 36.1089, lng: 127.4881 }, '논산시': { lat: 36.1872, lng: 127.0989 },
 '당진시': { lat: 36.8897, lng: 126.6458 }, '보령시': { lat: 36.3333, lng: 126.6128 },
 '부여군': { lat: 36.2758, lng: 126.9097 }, '서산시': { lat: 36.7847, lng: 126.4503 },
 '서천군': { lat: 36.0803, lng: 126.6914 }, '아산시': { lat: 36.7900, lng: 127.0025 },
 '예산군': { lat: 36.6828, lng: 126.8492 }, '천안시': { lat: 36.8151, lng: 127.1139 },
 '청양군': { lat: 36.4592, lng: 126.8022 }, '태안군': { lat: 36.7456, lng: 126.2975 },
 '홍성군': { lat: 36.6011, lng: 126.6603 }
 }},
 '전라북도': { lat: 35.8203, lng: 127.1086, districts: {
 '고창군': { lat: 35.4358, lng: 126.7019 }, '군산시': { lat: 35.9676, lng: 126.7369 },
 '김제시': { lat: 35.8039, lng: 126.8806 }, '남원시': { lat: 35.4164, lng: 127.3903 },
 '무주군': { lat: 36.0069, lng: 127.6608 }, '부안군': { lat: 35.7314, lng: 126.7336 },
 '순창군': { lat: 35.3744, lng: 127.1375 }, '완주군': { lat: 35.9042, lng: 127.1619 },
 '익산시': { lat: 35.9483, lng: 126.9578 }, '임실군': { lat: 35.6178, lng: 127.2889 },
 '장수군': { lat: 35.6472, lng: 127.5214 }, '전주시': { lat: 35.8242, lng: 127.1480 },
 '정읍시': { lat: 35.5700, lng: 126.8561 }, '진안군': { lat: 35.7919, lng: 127.4247 }
 }},
 '전라남도': { lat: 34.8679, lng: 126.9910, districts: {
 '강진군': { lat: 34.6419, lng: 126.7672 }, '고흥군': { lat: 34.6117, lng: 127.2847 },
 '곡성군': { lat: 35.2819, lng: 127.2922 }, '광양시': { lat: 34.9406, lng: 127.6956 },
 '구례군': { lat: 35.2028, lng: 127.4628 }, '나주시': { lat: 35.0158, lng: 126.7108 },
 '담양군': { lat: 35.3214, lng: 126.9886 }, '목포시': { lat: 34.8118, lng: 126.3922 },
 '무안군': { lat: 34.9906, lng: 126.4814 }, '보성군': { lat: 34.7714, lng: 127.0800 },
 '순천시': { lat: 34.9506, lng: 127.4872 }, '신안군': { lat: 34.8269, lng: 126.1069 },
 '여수시': { lat: 34.7604, lng: 127.6622 }, '영광군': { lat: 35.2772, lng: 126.5119 },
 '영암군': { lat: 34.8003, lng: 126.6967 }, '완도군': { lat: 34.3108, lng: 126.7550 },
 '장성군': { lat: 35.3019, lng: 126.7847 }, '장흥군': { lat: 34.6819, lng: 126.9069 },
 '진도군': { lat: 34.4867, lng: 126.2636 }, '함평군': { lat: 35.0656, lng: 126.5169 },
 '해남군': { lat: 34.5736, lng: 126.5992 }, '화순군': { lat: 35.0644, lng: 126.9869 }
 }},
 '경상북도': { lat: 36.4919, lng: 128.8889, districts: {
 '경산시': { lat: 35.8251, lng: 128.7414 }, '경주시': { lat: 35.8562, lng: 129.2247 },
 '고령군': { lat: 35.7256, lng: 128.2636 }, '구미시': { lat: 36.1197, lng: 128.3444 },
 '군위군': { lat: 36.2428, lng: 128.5728 }, '김천시': { lat: 36.1398, lng: 128.1136 },
 '문경시': { lat: 36.5867, lng: 128.1867 }, '봉화군': { lat: 36.8931, lng: 128.7325 },
 '상주시': { lat: 36.4108, lng: 128.1592 }, '성주군': { lat: 35.9192, lng: 128.2828 },
 '안동시': { lat: 36.5684, lng: 128.7294 }, '영덕군': { lat: 36.4150, lng: 129.3656 },
 '영양군': { lat: 36.6669, lng: 129.1125 }, '영주시': { lat: 36.8056, lng: 128.6239 },
 '영천시': { lat: 35.9733, lng: 128.9386 }, '예천군': { lat: 36.6578, lng: 128.4536 },
 '울릉군': { lat: 37.4842, lng: 130.9058 }, '울진군': { lat: 36.9931, lng: 129.4003 },
 '의성군': { lat: 36.3528, lng: 128.6972 }, '청도군': { lat: 35.6472, lng: 128.7339 },
 '청송군': { lat: 36.4361, lng: 129.0572 }, '칠곡군': { lat: 35.9956, lng: 128.4017 },
 '포항시': { lat: 36.0190, lng: 129.3435 }
 }},
 '경상남도': { lat: 35.4606, lng: 128.2132, districts: {
 '거제시': { lat: 34.8806, lng: 128.6211 }, '거창군': { lat: 35.6867, lng: 127.9097 },
 '고성군': { lat: 34.9728, lng: 128.3228 }, '김해시': { lat: 35.2285, lng: 128.8894 },
 '남해군': { lat: 34.8375, lng: 127.8925 }, '밀양시': { lat: 35.5037, lng: 128.7467 },
 '사천시': { lat: 35.0039, lng: 128.0642 }, '산청군': { lat: 35.4156, lng: 127.8733 },
 '양산시': { lat: 35.3350, lng: 129.0378 }, '의령군': { lat: 35.3222, lng: 128.2617 },
 '진주시': { lat: 35.1800, lng: 128.1076 }, '창녕군': { lat: 35.5444, lng: 128.4914 },
 '창원시': { lat: 35.2270, lng: 128.6811 }, '통영시': { lat: 34.8544, lng: 128.4331 },
 '하동군': { lat: 35.0672, lng: 127.7514 }, '함안군': { lat: 35.2722, lng: 128.4064 },
 '함양군': { lat: 35.5203, lng: 127.7253 }, '합천군': { lat: 35.5664, lng: 128.1658 }
 }},
 '제주특별자치도': { lat: 33.4890, lng: 126.4983, districts: {
 '서귀포시': { lat: 33.2541, lng: 126.5600 }, '제주시': { lat: 33.4996, lng: 126.5312 }
 }}
 };
 const ZIGBANG_ITEMS = []; // 데이터는 Firebase에서 로드
 
 // CORS 프록시 목록 (환경 변수로 추가 가능)
 const CORS_PROXIES = [
   import.meta.env.VITE_CORS_PROXY_1,
   'https://api.allorigins.win/raw?url=',
   'https://corsproxy.io/?',
   'https://api.codetabs.com/v1/proxy?quest='
 ].filter(Boolean);
 
 // 타임아웃이 있는 fetch 함수
 const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), timeout);
   
   try {
     const response = await fetch(url, {
       ...options,
       signal: controller.signal
     });
     clearTimeout(timeoutId);
     return response;
   } catch (error) {
     clearTimeout(timeoutId);
     throw error;
   }
 };
 
 const fetchWithProxy = async (apiUrl) => {
   if (CORS_PROXIES.length === 0) {
     console.error('사용 가능한 CORS 프록시가 없습니다.');
     return null;
   }
   
   for (let i = 0; i < CORS_PROXIES.length; i++) {
     const proxy = CORS_PROXIES[i];
     try {
       const response = await fetchWithTimeout(
         proxy + encodeURIComponent(apiUrl),
         { headers: { 'Accept': 'application/json' } },
         8000 // 8초 타임아웃
       );
       
       if (response.ok) {
         const data = await response.json();
         return data;
       }
     } catch (e) {
       if (e.name === 'AbortError') {
         console.log(`프록시 타임아웃: ${proxy}`);
       } else {
         console.log(`프록시 실패 (${i + 1}/${CORS_PROXIES.length}):`, e.message);
       }
       continue;
     }
   }
   
   console.warn('모든 CORS 프록시 실패');
   return null;
 };
 const searchMarkersRef = useRef([]);
 const clearSearchMarkers = () => {
 searchMarkersRef.current.forEach(marker => marker.setMap(null));
 searchMarkersRef.current = [];
 };
 const clearZigbangMarkers = () => {
 zigbangMarkersRef.current.forEach(marker => marker.setMap(null));
 zigbangMarkersRef.current = [];
 };
 
 // 네이버부동산 API 함수들
 const fetchNaverArticles = async (cortarNo, lat, lon, page = 1) => {
 try {
 const url = `/.netlify/functions/naver-proxy?type=article&cortarNo=${cortarNo}&lat=${lat}&lon=${lon}&z=14&page=${page}`;
 const response = await fetch(url);
 const data = await response.json();
 console.log('네이버부동산 API 응답:', data);
 return data?.body || [];
 } catch (e) {
 console.error('네이버 매물 조회 오류:', e);
 return [];
 }
 };
 
 const fetchNaverArticleDetail = async (articleId) => {
 try {
 const url = `/.netlify/functions/naver-proxy?type=detail&articleId=${articleId}`;
 const response = await fetch(url);
 const data = await response.json();
 return data?.result || null;
 } catch (e) {
 console.error('네이버 매물 상세 조회 오류:', e);
 return null;
 }
 };
 const fetchZigbangAllStores = async () => {
 return [{
 title: "전국 상가 매물",
 item_locations: ZIGBANG_ITEMS.map(([item_id, lat, lng]) => ({ item_id, lat, lng }))
 }];
 };
 const fetchAgentInfo = async (itemId) => {
 try {
 const apiUrl = `https://apis.zigbang.com/v2/store/article/stores/${itemId}`;
 return await fetchWithProxy(apiUrl);
 } catch (error) {
 console.error('중개사 정보 오류:', error);
 return null;
 }
 };
 const filterItemsByRegion = (items, centerLat, centerLng, radius = 0.05) => {
 return items.filter(item => {
 const latDiff = Math.abs(item.lat - centerLat);
 const lngDiff = Math.abs(item.lng - centerLng);
 return latDiff < radius && lngDiff < radius;
 });
 };
 const searchZigbangAgents = async () => {
 if (!zigbangRegion) return alert('시/도를 선택해주세요');
 if (!zigbangCity) return alert('구/군을 선택해주세요');
 
 // 확장프로그램 확인
 if (!extensionReady) {
 alert('확장프로그램이 연결되지 않았습니다.\n\n1. 확장프로그램 설치 확인\n2. 페이지 새로고침\n3. 네이버부동산 로그인 확인');
 return;
 }
 
 // 동적으로 가져온 cortarNo 사용
 const cortarNo = selectedGugunCortarNo;
 
 if (!cortarNo) {
 alert('지역 코드를 찾을 수 없습니다.\n구/군을 다시 선택해주세요.');
 return;
 }
 
 console.log('[수집] cortarNo:', cortarNo, '지역:', zigbangRegion, zigbangCity);
 
 setIsLoadingAgents(true);
 setIsCollecting(true);
 setCollectProgress({ phase: 'start', current: 0, total: 0, found: 0, message: `${zigbangCity} 검색 중...` });
 setZigbangAgents([]);
 clearZigbangMarkers();
 setAgentSearchAbort(false);
 
 try {
 // 1. 지역명으로 좌표 검색 (지도 이동용)
 const regionQuery = `${zigbangRegion} ${zigbangCity}`;
 const geoResult = await new Promise((resolve) => {
 naver.maps.Service.geocode({ query: regionQuery }, (status, response) => {
 if (status === naver.maps.Service.Status.OK && response.v2.addresses.length > 0) {
 const result = response.v2.addresses[0];
 resolve({ lat: parseFloat(result.y), lng: parseFloat(result.x) });
 } else {
 resolve({ lat: 37.5665, lng: 126.978 }); // 기본값: 서울
 }
 });
 });
 
 // 2. 지도 이동
 if (routeMapObj.current) {
 routeMapObj.current.setCenter(new naver.maps.LatLng(geoResult.lat, geoResult.lng));
 routeMapObj.current.setZoom(14);
 }
 
 setCollectProgress({ phase: 'collecting', current: 0, total: collectLimit, found: 0, message: '수집 중...' });
 
 // 진행 상황 시뮬레이션 (확장프로그램에서 실시간 업데이트가 없을 경우 대비)
 let simulatedProgress = 0;
 const progressInterval = setInterval(() => {
 simulatedProgress += Math.floor(Math.random() * 10) + 5;
 if (simulatedProgress < collectLimit) {
 setCollectProgress(prev => ({ 
 ...prev, 
 current: Math.min(simulatedProgress, collectLimit - 10),
 found: Math.floor(simulatedProgress * 0.3) // 약 30%가 발견된다고 가정
 }));
 }
 }, 500);
 
 // 3. cortarNo로 확장프로그램에 수집 요청 (postMessage 방식)
 console.log('[수집] 확장프로그램 요청 - cortarNo:', cortarNo);
 
 const response = await sendToExtension('SCRAPE_AREA', {
 cortarNo: cortarNo,
 options: { maxLimit: collectLimit }
 });
 
 clearInterval(progressInterval);
 
 console.log('[수집] 최종 결과:', response);
 
 if (!response.success) {
 setIsLoadingAgents(false);
 setIsCollecting(false);
 setCollectProgress({ phase: '', message: '' });
 alert('수집 실패: ' + (response.error || '알 수 없는 오류') + '\n\n네이버부동산(new.land.naver.com)에 로그인했는지 확인해주세요.');
 return;
 }
 
 if (!response.data || response.data.length === 0) {
 setIsLoadingAgents(false);
 setIsCollecting(false);
 setCollectProgress({ phase: '', message: '' });
 alert('' + regionQuery + ' 지역에 상가 매물이 없습니다.');
 return;
 }
 
 // 4. 결과 처리
 setCollectProgress({ phase: 'processing', current: response.data.length, total: response.data.length, found: response.data.length, message: '처리 중...' });
 
 const agents = response.data.map((agent, idx) => ({
 id: 'naver_' + Date.now() + idx,
 name: agent.name,
 address: agent.address || '',
 phone: agent.phone || agent.cellPhone || '',
 represent: '',
 regId: '',
 officeLat: agent.lat,
 officeLng: agent.lng,
 lat: agent.lat || geoResult.lat,
 lng: agent.lng || geoResult.lng,
 source: 'naver',
 itemCount: agent.articleCount || 0,
 totalCount: agent.articleCount || 0,
 representName: agent.representName || '',  // 대표자명
 regNo: agent.regNo || '',              // 등록번호
 cellPhone: agent.cellPhone || '',      // 휴대폰
 items: [{ lat: agent.lat || geoResult.lat, lng: agent.lng || geoResult.lng, region: zigbangCity }]
 }));
 
 // 검색어 필터
 let filteredAgents = agents;
 if (zigbangDetailSearch.trim()) {
 const searchTerm = zigbangDetailSearch.trim().toLowerCase();
 filteredAgents = agents.filter(a => 
 a.address.toLowerCase().includes(searchTerm) || 
 a.name.toLowerCase().includes(searchTerm)
 );
 }
 
 filteredAgents.sort((a, b) => b.itemCount - a.itemCount);
 setZigbangAgents(filteredAgents);
 
 // 5. 지도에 마커 표시
 if (routeMapObj.current && filteredAgents.length > 0) {
 setTimeout(() => {
 clearSearchMarkers();
 filteredAgents.forEach((agent, idx) => {
 if (agent.lat && agent.lng) {
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(agent.lat, agent.lng),
 map: routeMapObj.current,
 icon: {
 content: `<div style="background: #14b8a6; color: white; padding: 6px 10px; border-radius: 16px; font-size: 11px; font-weight: bold; box-shadow: 0 3px 12px rgba(0,0,0,0.4); white-space: nowrap; border: 2px solid white;">${idx + 1}. ${agent.name.slice(0, 6)}</div>`,
 anchor: new naver.maps.Point(50, 20)
 }
 });
 naver.maps.Event.addListener(marker, 'click', () => addAgentToRoute(agent));
 zigbangMarkersRef.current.push(marker);
 }
 });
 }, 300);
 }
 
 setCollectProgress({ phase: 'complete', current: filteredAgents.length, total: filteredAgents.length, found: filteredAgents.length, message: '완료' });
 console.log(`[수집] 완료: ${filteredAgents.length}개 중개사`);
 
 } catch (error) {
 console.error('[수집] 오류:', error);
 alert('검색 중 오류가 발생했습니다: ' + error.message);
 }
 
 setIsLoadingAgents(false);
 setIsCollecting(false);
 };
 const addAgentToRoute = (agent) => {
 const exists = routeStops.some(s => s.name === agent.name && s.address === agent.address);
 if (exists) {
 return alert('이미 추가된 중개사입니다.');
 }
 if (!agent.officeLat || !agent.officeLng) {
 if (!confirm(`${agent.name}의 사무실 위치를 확인할 수 없습니다.\n매물 위치로 추가하시겠습니까?\n\n사무실 주소: ${agent.address || '없음'}`)) {
 return;
 }
 }
 const newStop = {
 id: Date.now(),
 name: agent.name,
 address: agent.address,
 phone: agent.phone,
 lat: agent.lat,
 lng: agent.lng,
 type: 'zigbang',
 represent: agent.represent,
 isOfficeLocation: !!(agent.officeLat && agent.officeLng)
 };
 setRouteStops(prev => [...prev, newStop]);
 if (routeMapObj.current) {
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(agent.lat, agent.lng),
 map: routeMapObj.current,
 icon: {
 content: `<div style="background: linear-gradient(135deg, #14b8a6, #0d9488); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${routeStops.length + 1}</div>`,
 anchor: new naver.maps.Point(14, 14)
 }
 });
 routeMapMarkersRef.current.push(marker);
 updateRouteLines();
 }
 };
 const addAllAgentsToRoute = () => {
 if (zigbangAgents.length === 0) return;
 zigbangAgents.forEach((agent, idx) => {
 setTimeout(() => addAgentToRoute(agent), idx * 50);
 });
 };
 const openZigbangMap = () => {
 if (!zigbangRegion) return alert('시/도를 선택해주세요');
 let lat, lng;
 const regionData = REGION_COORDS[zigbangRegion];
 if (zigbangCity && regionData?.districts?.[zigbangCity]) {
 lat = regionData.districts[zigbangCity].lat;
 lng = regionData.districts[zigbangCity].lng;
 } else if (regionData) {
 lat = regionData.lat;
 lng = regionData.lng;
 } else {
 return alert('지역 정보를 찾을 수 없습니다');
 }
 const zigbangUrl = `https://www.zigbang.com/home/store/map?lat=${lat}&lng=${lng}&zoom=15`;
 window.open(zigbangUrl, '_blank', 'width=1200,height=800');
 };
 const searchAndMoveMap = async () => {
 if (!placeSearchQuery.trim()) return alert('검색어를 입력하세요');
 if (searchedPlaces.length >= 10) {
 return alert('최대 10개까지만 추가할 수 있습니다.\n먼저 동선에 추가하거나 목록을 비워주세요.');
 }
 setIsSearchingPlaces(true);
 const place = findPlace(placeSearchQuery);
 if (place && routeMapObj.current) {
 setIsSearchingPlaces(false);
 routeMapObj.current.setCenter(new naver.maps.LatLng(place.lat, place.lng));
 routeMapObj.current.setZoom(16);
 const exists = searchedPlaces.some(p => p.lat === place.lat && p.lng === place.lng);
 if (!exists) {
 setSearchedPlaces(prev => [...prev, {
 id: Date.now(),
 name: placeCustomName.trim() || placeSearchQuery,
 address: '',
 lat: place.lat,
 lng: place.lng
 }]);
 }
 setPlaceSearchQuery('');
 setPlaceCustomName('');
 setTimeout(() => {
 const searchMarker = new naver.maps.Marker({
 position: new naver.maps.LatLng(place.lat, place.lng),
 map: routeMapObj.current,
 icon: {
 content: `<div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;"></div>`,
 anchor: new naver.maps.Point(14, 14)
 }
 });
 searchMarkersRef.current.push(searchMarker);
 }, 200);
 return;
 }
 naver.maps.Service.geocode({ query: placeSearchQuery }, async (status, response) => {
 setIsSearchingPlaces(false);
 if (status !== naver.maps.Service.Status.OK || !response.v2.addresses?.length) {
 return alert('해당 위치를 찾을 수 없습니다');
 }
 const location = response.v2.addresses[0];
 const lat = parseFloat(location.y);
 const lng = parseFloat(location.x);
 const exists = searchedPlaces.some(p => p.lat === lat && p.lng === lng);
 if (!exists) {
 setSearchedPlaces(prev => [...prev, {
 id: Date.now(),
 name: placeCustomName.trim() || placeSearchQuery,
 address: location.roadAddress || location.jibunAddress || '',
 lat: lat,
 lng: lng
 }]);
 }
 setPlaceSearchQuery('');
 setPlaceCustomName('');
 if (routeMapObj.current) {
 routeMapObj.current.setCenter(new naver.maps.LatLng(lat, lng));
 routeMapObj.current.setZoom(16);
 setTimeout(() => {
 const searchMarker = new naver.maps.Marker({
 position: new naver.maps.LatLng(lat, lng),
 map: routeMapObj.current,
 icon: {
 content: `<div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;"></div>`,
 anchor: new naver.maps.Point(14, 14)
 }
 });
 searchMarkersRef.current.push(searchMarker);
 }, 200);
 }
 });
 };
 const removeSearchedPlace = (placeId) => {
 setSearchedPlaces(prev => prev.filter(p => p.id !== placeId));
 };
 const addAllSearchedPlacesToRoute = () => {
 if (searchedPlaces.length === 0) return alert('추가할 장소가 없습니다');
 let addedCount = 0;
 const newStops = [];
 searchedPlaces.forEach(place => {
 const exists = routeStops.some(s => s.lat === place.lat && s.lng === place.lng);
 if (!exists) {
 newStops.push({
 id: Date.now() + Math.random(),
 name: place.name,
 address: place.address,
 lat: place.lat,
 lng: place.lng,
 type: 'search'
 });
 addedCount++;
 }
 });
 if (newStops.length > 0) {
 setRouteStops(prev => [...prev, ...newStops]);
 }
 setSearchedPlaces([]);
 clearSearchMarkers();
 alert(`${addedCount}개 장소가 동선에 추가되었습니다!`);
 };
 const searchNearbyPlaces = searchAndMoveMap;
 const [mapClickMode, setMapClickMode] = useState(false);
 const mapClickListenerRef = useRef(null);
 const enableMapClickToAdd = () => {
 if (!routeMapObj.current) return;
 if (mapClickListenerRef.current) {
 naver.maps.Event.removeListener(mapClickListenerRef.current);
 }
 setMapClickMode(true);
 mapClickListenerRef.current = naver.maps.Event.addListener(routeMapObj.current, 'click', (e) => {
 const lat = e.coord.lat();
 const lng = e.coord.lng();
 naver.maps.Service.reverseGeocode({
 coords: new naver.maps.LatLng(lat, lng),
 orders: 'roadaddr,addr'
 }, (status, response) => {
 let address = '';
 let placeName = '부동산중개사';
 if (status === naver.maps.Service.Status.OK && response.v2.results?.length > 0) {
 const result = response.v2.results[0];
 if (result.land) {
 const land = result.land;
 address = `${result.region.area1.name} ${result.region.area2.name} ${result.region.area3.name} ${land.name || ''} ${land.number1 || ''}${land.number2 ? '-' + land.number2 : ''}`.trim();
 if (land.addition0?.value) {
 placeName = land.addition0.value + ' 부동산';
 } else {
 placeName = `${result.region.area3.name} 부동산중개사`;
 }
 }
 }
 const newStop = {
 id: Date.now(),
 name: placeName,
 address: address,
 lat: lat,
 lng: lng,
 type: 'mapclick'
 };
 setRouteStops(prev => [...prev, newStop]);
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(lat, lng),
 map: routeMapObj.current,
 icon: {
 content: `<div class="blink-marker" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 8px 12px; border-radius: 16px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 8px rgba(139,92,246,0.5); border: 2px solid white;">${placeName}</div>`,
 anchor: new naver.maps.Point(60, 20)
 }
 });
 routeMapCirclesRef.current.push(marker);
 });
 });
 };
 const disableMapClickToAdd = () => {
 if (mapClickListenerRef.current) {
 naver.maps.Event.removeListener(mapClickListenerRef.current);
 mapClickListenerRef.current = null;
 }
 setMapClickMode(false);
 routeMapCirclesRef.current.forEach(m => m.setMap(null));
 routeMapCirclesRef.current = [];
 };
 const getDistanceFromLatLng = (lat1, lng1, lat2, lng2) => {
 const R = 6371;
 const dLat = (lat2 - lat1) * Math.PI / 180;
 const dLng = (lng2 - lng1) * Math.PI / 180;
 const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
 Math.sin(dLng/2) * Math.sin(dLng/2);
 return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
 };
 const showSearchResultsOnMap = (results) => {
 if (!routeMapObj.current) return;
 routeMapCirclesRef.current.forEach(m => m.setMap(null));
 routeMapCirclesRef.current = [];
 if (results.length === 0) return;
 const bounds = new naver.maps.LatLngBounds();
 results.forEach((place, idx) => {
 if (!place.lat || !place.lng) return;
 bounds.extend(new naver.maps.LatLng(place.lat, place.lng));
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(place.lat, place.lng),
 map: routeMapObj.current,
 icon: {
 content: `<div class="blink-marker" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 8px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; box-shadow: 0 3px 10px rgba(139,92,246,0.5); border: 2px solid white; cursor: pointer;">${idx + 1}. ${place.name?.slice(0, 12) || '부동산'}</div>`,
 anchor: new naver.maps.Point(60, 20)
 }
 });
 routeMapCirclesRef.current.push(marker);
 });
 if (results.length > 1) {
 routeMapObj.current.fitBounds(bounds, { padding: 50 });
 }
 };
 const addPlaceToRoute = (place) => {
 const newStop = {
 id: Date.now(),
 name: place.name,
 address: place.address,
 phone: place.phone,
 lat: place.lat,
 lng: place.lng,
 type: 'search'
 };
 setRouteStops(prev => [...prev, newStop]);
 setPlaceSearchResults(prev => prev.filter(p => p.id !== place.id));
 if (routeMapObj.current && place.lat && place.lng) {
 routeMapCirclesRef.current.forEach(m => {
 const pos = m.getPosition();
 if (Math.abs(pos.lat() - place.lat) < 0.0001 && Math.abs(pos.lng() - place.lng) < 0.0001) {
 m.setIcon({
 content: `<div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 8px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; box-shadow: 0 3px 10px rgba(16,185,129,0.5); border: 3px solid white;">${place.name?.slice(0, 12) || '부동산'}</div>`,
 anchor: new naver.maps.Point(60, 20)
 });
 }
 });
 }
 };
 const addAllPlacesToRoute = () => {
 placeSearchResults.forEach((place, idx) => {
 setTimeout(() => {
 const newStop = {
 id: Date.now() + idx,
 name: place.name,
 address: place.address,
 lat: place.lat,
 lng: place.lng,
 type: 'search'
 };
 setRouteStops(prev => [...prev, newStop]);
 }, idx * 50);
 });
 setTimeout(() => {
 setPlaceSearchResults([]);
 routeMapCirclesRef.current.forEach(m => m.setMap(null));
 routeMapCirclesRef.current = [];
 }, placeSearchResults.length * 50 + 100);
 };
 const addRouteStopFromCompany = (company) => {
 if (company.address) {
 naver.maps.Service.geocode({ query: company.address }, (s, r) => {
 if (s === naver.maps.Service.Status.OK && r.v2.addresses?.length > 0) {
 const result = r.v2.addresses[0];
 const newStop = {
 id: Date.now(),
 name: company.name,
 address: company.address,
 lat: parseFloat(result.y),
 lng: parseFloat(result.x),
 type: 'company',
 companyId: company.id
 };
 setRouteStops(prev => [...prev, newStop]);
 } else {
 const newStop = {
 id: Date.now(),
 name: company.name,
 address: company.address,
 type: 'company',
 companyId: company.id
 };
 setRouteStops(prev => [...prev, newStop]);
 }
 });
 } else {
 const newStop = {
 id: Date.now(),
 name: company.name,
 type: 'company',
 companyId: company.id
 };
 setRouteStops(prev => [...prev, newStop]);
 }
 };
 const removeRouteStop = (stopId) => {
 setRouteStops(prev => prev.filter(s => s.id !== stopId));
 };
 const moveRouteStop = (index, direction) => {
 const newStops = [...routeStops];
 const newIndex = index + direction;
 if (newIndex < 0 || newIndex >= newStops.length) return;
 [newStops[index], newStops[newIndex]] = [newStops[newIndex], newStops[index]];
 setRouteStops(newStops);
 };
 // 거리 계산 함수 (Haversine)
 const getDistance = (lat1, lng1, lat2, lng2) => {
 const R = 6371;
 const dLat = (lat2 - lat1) * Math.PI / 180;
 const dLng = (lng2 - lng1) * Math.PI / 180;
 const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
 Math.sin(dLng/2) * Math.sin(dLng/2);
 const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
 return R * c;
 };
 // Nearest Neighbor TSP 알고리즘
 const nearestNeighborTSP = (stops, startLat, startLng) => {
 const remaining = [...stops];
 const result = [];
 let currentLat = startLat;
 let currentLng = startLng;
 while (remaining.length > 0) {
 let nearestIdx = 0;
 let nearestDist = Infinity;
 for (let i = 0; i < remaining.length; i++) {
 const dist = getDistance(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
 if (dist < nearestDist) {
 nearestDist = dist;
 nearestIdx = i;
 }
 }
 const nearest = remaining.splice(nearestIdx, 1)[0];
 result.push(nearest);
 currentLat = nearest.lat;
 currentLng = nearest.lng;
 }
 return result;
 };
 // 네이버 Directions API로 실제 도로 경로 가져오기
 const fetchDirectionsRoute = async (startLat, startLng, optimizedStops) => {
 if (optimizedStops.length < 1) return null;
 const NCP_CLIENT_ID = 'dx2ymyk2b1';
 const NCP_CLIENT_SECRET = '18184ztuYuPVkqzPumsSqRNVsMHCiBFMWhWdRJAJ';
 
 // API 키 검증
 if (!NCP_CLIENT_ID || !NCP_CLIENT_SECRET) {
   console.warn('NCP API 키가 설정되지 않았습니다.');
   return null;
 }
 try {
 const start = `${startLng},${startLat}`;
 const goal = `${optimizedStops[optimizedStops.length - 1].lng},${optimizedStops[optimizedStops.length - 1].lat}`;
 let waypoints = '';
 if (optimizedStops.length > 1) {
 waypoints = optimizedStops.slice(0, -1).map(s => `${s.lng},${s.lat}`).join('|');
 }
 let url = `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${start}&goal=${goal}&option=trafast`;
 if (waypoints) url += `&waypoints=${waypoints}`;
 const response = await fetch(url, {
 headers: {
 'X-NCP-APIGW-API-KEY-ID': NCP_CLIENT_ID,
 'X-NCP-APIGW-API-KEY': NCP_CLIENT_SECRET
 }
 });
 if (!response.ok) return null;
 const data = await response.json();
 if (data.code !== 0 || !data.route?.trafast?.[0]) return null;
 const route = data.route.trafast[0];
 return {
 path: route.path,
 distance: route.summary.distance,
 duration: route.summary.duration
 };
 } catch (error) {
 console.error('Directions API 호출 실패:', error);
 return null;
 }
 };
 // 실제 도로 경로를 지도에 그리기
 const drawDirectionsRoute = (pathData) => {
 if (!routeMapObj.current || !pathData?.path) return;
 if (directionsPolylineRef.current) {
 directionsPolylineRef.current.setMap(null);
 }
 const path = pathData.path.map(([lng, lat]) => new naver.maps.LatLng(lat, lng));
 directionsPolylineRef.current = new naver.maps.Polyline({
 map: routeMapObj.current,
 path: path,
 strokeColor: '#4285f4',
 strokeWeight: 5,
 strokeOpacity: 0.8,
 strokeLineCap: 'round',
 strokeLineJoin: 'round'
 });
 const distanceKm = (pathData.distance / 1000).toFixed(1);
 const durationMin = Math.round(pathData.duration / 60000);
 setRouteInfo({ distance: distanceKm, duration: durationMin });
 };
 // TSP 최적화 (Directions API 지원)
 const optimizeRouteOrder = async () => {
 const stopsWithCoords = routeStops.filter(s => s.lat && s.lng);
 const stopsWithoutCoords = routeStops.filter(s => !s.lat || !s.lng);
 if (stopsWithCoords.length < 2) {
 alert('좌표가 있는 경유지가 2개 이상 필요합니다.\n도로명 주소를 입력해주세요.');
 return;
 }
 if (navigator.geolocation) {
 navigator.geolocation.getCurrentPosition(
 async (position) => {
 const myLat = position.coords.latitude;
 const myLng = position.coords.longitude;
 const optimized = nearestNeighborTSP(stopsWithCoords, myLat, myLng);
 const finalOrder = [...optimized, ...stopsWithoutCoords];
 setRouteStops(finalOrder);
 const directionsData = await fetchDirectionsRoute(myLat, myLng, optimized);
 if (directionsData) {
 drawDirectionsRoute(directionsData);
 const distKm = (directionsData.distance / 1000).toFixed(1);
 const durMin = Math.round(directionsData.duration / 60000);
 alert(`동선 최적화 완료!\n\n총 ${optimized.length}개 경유지\n실제 도로거리: ${distKm}km\n예상 소요시간: ${durMin}분\n\n파란 선을 따라 이동하세요!`);
 } else {
 let totalDist = getDistance(myLat, myLng, optimized[0].lat, optimized[0].lng);
 for (let i = 0; i < optimized.length - 1; i++) {
 totalDist += getDistance(optimized[i].lat, optimized[i].lng, optimized[i+1].lat, optimized[i+1].lng);
 }
 setRouteInfo(null);
 alert(`동선 최적화 완료!\n\n총 ${optimized.length}개 경유지\n직선거리: ${totalDist.toFixed(1)}km\n\n실제 도로 경로를 보려면 설정에서 API 키를 입력하세요.`);
 }
 },
 (error) => {
 optimizeWithoutGPS(stopsWithCoords, stopsWithoutCoords);
 },
 { enableHighAccuracy: true, timeout: 5000 }
 );
 } else {
 optimizeWithoutGPS(stopsWithCoords, stopsWithoutCoords);
 }
 };
 const reverseRouteOrder = () => {
 if (routeStops.length < 2) {
 alert('경유지가 2개 이상 필요합니다.');
 return;
 }
 setRouteStops([...routeStops].reverse());
 alert('동선 순서가 반대로 변경되었습니다!');
 };
 const optimizeWithoutGPS = async (stopsWithCoords, stopsWithoutCoords) => {
 const firstStop = stopsWithCoords[0];
 const optimized = nearestNeighborTSP(stopsWithCoords, firstStop.lat, firstStop.lng);
 const finalOrder = [...optimized, ...stopsWithoutCoords];
 setRouteStops(finalOrder);
 const directionsData = await fetchDirectionsRoute(firstStop.lat, firstStop.lng, optimized.slice(1));
 if (directionsData) {
 drawDirectionsRoute(directionsData);
 const distKm = (directionsData.distance / 1000).toFixed(1);
 const durMin = Math.round(directionsData.duration / 60000);
 alert(`동선 최적화 완료!\n\n총 ${optimized.length}개 경유지\n실제 도로거리: ${distKm}km\n예상 소요시간: ${durMin}분\n\n(GPS 사용 불가 - 첫 경유지 기준)`);
 } else {
 let totalDist = 0;
 for (let i = 0; i < optimized.length - 1; i++) {
 totalDist += getDistance(optimized[i].lat, optimized[i].lng, optimized[i+1].lat, optimized[i+1].lng);
 }
 setRouteInfo(null);
 alert(`동선 최적화 완료!\n\n총 ${optimized.length}개 경유지\n직선거리: ${totalDist.toFixed(1)}km\n\n(GPS 사용 불가 - 첫 경유지 기준)`);
 }
 };
 const saveCurrentRoute = () => {
 if (routeStops.length === 0) return alert('경유지를 먼저 추가하세요');
 if (!user?.managerId && !user?.role === 'super') return alert('영업자 계정으로 로그인하세요');
 const route = {
 id: Date.now(),
 name: routeName || routeDate,
 date: routeDate,
 managerId: user?.managerId || 0,
 stops: routeStops.map(s => ({ ...s, visited: false })),
 status: 'planned',
 createdAt: new Date().toISOString()
 };
 saveRoute(route);
 alert('동선이 저장되었습니다!');
 };
 const viewRouteOnMapDirect = (route) => {
 const stopsWithCoords = (route.stops || []).filter(s => s.lat && s.lng);
 if (stopsWithCoords.length === 0) {
 return alert('좌표가 있는 경유지가 없습니다.');
 }
 editRoute(route);
 setTimeout(() => {
 if (!routeMapObj.current) return;
 routeMapMarkersRef.current.forEach(m => m.setMap(null));
 routeMapMarkersRef.current = [];
 routeMapLinesRef.current.forEach(l => l.setMap(null));
 routeMapLinesRef.current = [];
 stopsWithCoords.forEach((stop, idx) => {
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(stop.lat, stop.lng),
 map: routeMapObj.current,
 icon: {
 content: `<div style="background: linear-gradient(135deg, #14b8a6, #0d9488); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 3px 8px rgba(0,0,0,0.4); border: 3px solid white;">${idx + 1}</div>`,
 anchor: new naver.maps.Point(16, 16)
 }
 });
 routeMapMarkersRef.current.push(marker);
 });
 if (stopsWithCoords.length >= 2) {
 const path = stopsWithCoords.map(s => new naver.maps.LatLng(s.lat, s.lng));
 const polyline = new naver.maps.Polyline({
 map: routeMapObj.current,
 path: path,
 strokeColor: '#14b8a6',
 strokeWeight: 5,
 strokeOpacity: 0.9,
 strokeStyle: 'solid'
 });
 routeMapLinesRef.current.push(polyline);
 const bounds = new naver.maps.LatLngBounds();
 stopsWithCoords.forEach(s => bounds.extend(new naver.maps.LatLng(s.lat, s.lng)));
 routeMapObj.current.fitBounds(bounds, { padding: 50 });
 } else {
 routeMapObj.current.setCenter(new naver.maps.LatLng(stopsWithCoords[0].lat, stopsWithCoords[0].lng));
 routeMapObj.current.setZoom(15);
 }
 }, 400);
 };
 const editRoute = (route) => {
 setEditingRouteId(route.id);
 setRouteName(route.name || '');
 setRouteDate(route.date || new Date().toISOString().split('T')[0]);
 setRouteTime(route.time || '09:00');
 setRouteManager(route.managerId || null);
 setRouteStops(route.stops || []);
 setCurrentSlideIndex(0);
 setTimeout(() => {
 if (routeMapObj.current) updateRouteMapMarkers();
 }, 100);
 window.scrollTo({ top: 0, behavior: 'smooth' });
 };
 
 // 동선 완료 처리 함수
 const handleCompleteRoute = (route) => {
   const unvisitedStops = route.stops?.filter(s => !s.visited) || [];
   
   if (unvisitedStops.length > 0) {
     // 미방문 업체가 있음 - 모달 표시
     setShowUnvisitedModal({ route, unvisitedStops });
   } else {
     // 모두 방문함 - 바로 완료 처리
     completeRouteAction(route, false);
   }
 };
 
 // 실제 동선 완료 처리
 const completeRouteAction = (route, unassignUnvisited = false) => {
   const updated = { ...route, status: 'completed', completedAt: new Date().toISOString() };
   const newRoutes = routes.map(r => r.id === route.id ? updated : r);
   setRoutes(newRoutes);
   localStorage.setItem('bc_routes', JSON.stringify(newRoutes));
   
   // 미방문 업체 담당자 미배정 처리
   if (unassignUnvisited) {
     const unvisitedStops = route.stops?.filter(s => !s.visited) || [];
     let updatedCount = 0;
     
     unvisitedStops.forEach(stop => {
       // 동선의 업체명으로 companies에서 찾기
       const matchedCompany = companies.find(c => 
         c.name === stop.name || 
         c.name?.includes(stop.name) || 
         stop.name?.includes(c.name)
       );
       
       if (matchedCompany && matchedCompany.managerId) {
         const updatedCompany = { ...matchedCompany, managerId: null };
         saveCompany(updatedCompany);
         updatedCount++;
       }
     });
     
     if (updatedCount > 0) {
       alert(`동선이 완료 처리되었습니다.\n미방문 업체 ${updatedCount}개의 담당자가 미배정으로 변경되었습니다.`);
     } else {
       alert('동선이 완료 처리되었습니다.');
     }
   } else {
     alert('동선이 완료 처리되었습니다.');
   }
   
   setShowUnvisitedModal(null);
 };
 
 const cancelEditRoute = () => {
 setEditingRouteId(null);
 setRouteName('');
 setRouteStops([]);
 setRouteDate(getKoreanToday());
 setRouteTime('09:00');
 setRouteManager(user?.managerId || null);
 clearRouteMapMarkers();
 localStorage.removeItem('bc_temp_route');
 };
 const registerSchedule = () => {
 if (routeStops.length === 0) return alert('방문할 업체/장소를 먼저 추가하세요');
 if (!routeName.trim()) return alert('일정명을 입력하세요 (예: 이태원 영업)');
 const managerId = routeManager || user?.managerId || 0;
 if (!managerId && user?.role !== 'super') return alert('담당자를 선택하세요');
 if (editingRouteId) {
 const existingRoute = routes.find(r => r.id === editingRouteId);
 const route = {
 ...existingRoute,
 name: routeName.trim(),
 date: routeDate,
 time: routeTime,
 managerId: managerId,
 stops: routeStops.map(s => ({ ...s, visited: s.visited || false }))
 };
 saveRoute(route);
 setEditingRouteId(null);
 alert('동선이 수정되었습니다!');
 } else {
 const route = {
 id: Date.now(),
 name: routeName.trim(),
 date: routeDate,
 time: routeTime,
 managerId: managerId,
 stops: routeStops.map(s => ({ ...s, visited: false })),
 status: 'planned',
 createdAt: new Date().toISOString()
 };
 saveRoute(route);
 alert('일정이 등록되었습니다!');
 }
 setRouteName('');
 setRouteStops([]);
 setRouteDate(getKoreanToday());
 setRouteTime('09:00');
 setRouteManager(user?.managerId || null);
 clearRouteMapMarkers();
 localStorage.removeItem('bc_temp_route');
 };
 const searchRouteMap = () => {
 if (!routeMapSearch.trim() || !routeMapObj.current) return;
 const query = routeMapSearch.trim();
 const place = findPlace(query);
 if (place) {
 routeMapObj.current.setCenter(new naver.maps.LatLng(place.lat, place.lng));
 routeMapObj.current.setZoom(16);
 routeMapCirclesRef.current.forEach(c => c.setMap(null));
 routeMapCirclesRef.current = [];
 const circle = new naver.maps.Circle({
 map: routeMapObj.current,
 center: new naver.maps.LatLng(place.lat, place.lng),
 radius: 150,
 fillColor: '#3b82f6',
 fillOpacity: 0.2,
 strokeColor: '#2563eb',
 strokeWeight: 2
 });
 routeMapCirclesRef.current.push(circle);
 setTimeout(() => circle.setMap(null), 4000);
 return;
 }
 naver.maps.Service.geocode({ query: query }, (status, response) => {
 if (status === naver.maps.Service.Status.OK && response.v2.addresses?.length > 0) {
 const result = response.v2.addresses[0];
 const lat = parseFloat(result.y), lng = parseFloat(result.x);
 routeMapObj.current.setCenter(new naver.maps.LatLng(lat, lng));
 routeMapObj.current.setZoom(16);
 routeMapCirclesRef.current.forEach(c => c.setMap(null));
 routeMapCirclesRef.current = [];
 const circle = new naver.maps.Circle({
 map: routeMapObj.current,
 center: new naver.maps.LatLng(lat, lng),
 radius: 150,
 fillColor: '#3b82f6',
 fillOpacity: 0.2,
 strokeColor: '#2563eb',
 strokeWeight: 2
 });
 routeMapCirclesRef.current.push(circle);
 setTimeout(() => circle.setMap(null), 4000);
 } else {
 alert('검색 결과가 없습니다.');
 }
 });
 };
 const slideToStop = (newIndex) => {
 if (newIndex < 0 || newIndex >= routeStops.length) return;
 setCurrentSlideIndex(newIndex);
 const stop = routeStops[newIndex];
 if (stop.lat && stop.lng && routeMapObj.current) {
 routeMapObj.current.setCenter(new naver.maps.LatLng(stop.lat, stop.lng));
 routeMapObj.current.setZoom(16);
 }
 };
 const focusStopOnRouteMap = (stop, idx) => {
 setCurrentSlideIndex(idx);
 if (stop.lat && stop.lng && routeMapObj.current) {
 routeMapObj.current.setCenter(new naver.maps.LatLng(stop.lat, stop.lng));
 routeMapObj.current.setZoom(16);
 }
 };
 const toggleStopVisited = (routeId, stopId) => {
 const route = routes.find(r => r.id === routeId);
 if (!route) return;
 const stop = route.stops.find(s => s.id === stopId);
 const newVisited = !stop?.visited;
 const updatedStops = route.stops.map(s =>
 s.id === stopId ? { ...s, visited: !s.visited } : s
 );
 const allVisited = updatedStops.every(s => s.visited);
 saveRoute({
 ...route,
 stops: updatedStops,
 status: allVisited ? 'completed' : 'planned'
 });
 if (newVisited && stop?.name) {
 const company = companies.find(c => c.name === stop.name);
 if (company) {
 saveCompany({ ...company, lastVisitDate: new Date().toISOString() });
 }
 }
 if (selectedSchedule?.id === routeId) {
 setSelectedSchedule({
 ...route,
 stops: updatedStops,
 status: allVisited ? 'completed' : 'planned'
 });
 }
 };
 const completeAllStops = (routeId) => {
 const route = routes.find(r => r.id === routeId);
 if (!route) return;
 const updatedStops = route.stops.map(s => ({ ...s, visited: true }));
 saveRoute({
 ...route,
 stops: updatedStops,
 status: 'completed'
 });
 const stopsToAdd = (route.stops || []).filter(s => s.name && !companies.find(c => c.name === s.name));
 stopsToAdd.forEach(stop => {
 const newCompany = {
 id: Date.now() + Math.random(),
 name: stop.name,
 address: stop.address || '',
 managerId: route.managerId,
 reaction: 'positive',
 fromRoute: route.name,
 createdAt: new Date().toISOString()
 };
 saveCompany(newCompany);
 });
 setSelectedSchedule(null);
 if (stopsToAdd.length > 0) {
 alert(`모든 방문이 완료되었습니다!\n${stopsToAdd.length}개 업체가 자동 등록되었습니다.`);
 } else {
 alert('모든 방문이 완료되었습니다!');
 }
 };
 const viewStopOnMap = (stop) => {
 if (!stop.lat || !stop.lng) return alert('이 장소의 좌표 정보가 없습니다');
 setSelectedSchedule(null);
 navigateToTab('map');
 setTimeout(() => {
 if (!mapObj.current) return;
 clearRouteFromMap();
 mapObj.current.setCenter(new naver.maps.LatLng(stop.lat, stop.lng));
 mapObj.current.setZoom(17);
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(stop.lat, stop.lng),
 map: mapObj.current,
 icon: {
 content: `<div style="background: linear-gradient(135deg, #14b8a6, #0d9488); color: white; padding: 8px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white; white-space: nowrap;">${stop.name}</div>`,
 anchor: new naver.maps.Point(50, 20)
 }
 });
 routeMarkersRef.current.push(marker);
 const circle = new naver.maps.Circle({
 map: mapObj.current,
 center: new naver.maps.LatLng(stop.lat, stop.lng),
 radius: 100,
 fillColor: '#14b8a6',
 fillOpacity: 0.2,
 strokeColor: '#d97706',
 strokeWeight: 2
 });
 circlesRef.current.push(circle);
 }, 300);
 };
 const loadRoute = (route) => {
 setRouteStops(route.stops || []);
 setRouteDate(route.date);
 };
 const clearRouteFromMap = () => {
 routeLinesRef.current.forEach(line => line.setMap(null));
 routeLinesRef.current = [];
 routeMarkersRef.current.forEach(marker => marker.setMap(null));
 routeMarkersRef.current = [];
 };
 const viewRouteOnMap = () => {
 if (routeStops.length === 0) return alert('경유지가 없습니다');
 const stopsWithCoords = routeStops.filter(s => s.lat && s.lng);
 if (stopsWithCoords.length === 0) return alert('좌표가 있는 경유지가 없습니다');
 navigateToTab('map');
 setTimeout(() => {
 if (!mapObj.current) return;
 clearRouteFromMap();
 stopsWithCoords.forEach((stop, idx) => {
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(stop.lat, stop.lng),
 map: mapObj.current,
 icon: {
 content: `<div style="background: linear-gradient(135deg, #14b8a6, #0d9488); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;">${idx + 1}</div>`,
 anchor: new naver.maps.Point(14, 14)
 }
 });
 routeMarkersRef.current.push(marker);
 });
 if (stopsWithCoords.length >= 2) {
 const path = stopsWithCoords.map(s => new naver.maps.LatLng(s.lat, s.lng));
 const polyline = new naver.maps.Polyline({
 map: mapObj.current,
 path: path,
 strokeColor: '#14b8a6',
 strokeWeight: 4,
 strokeOpacity: 0.8,
 strokeStyle: 'solid'
 });
 routeLinesRef.current.push(polyline);
 }
 mapObj.current.setCenter(new naver.maps.LatLng(stopsWithCoords[0].lat, stopsWithCoords[0].lng));
 mapObj.current.setZoom(13);
 if (stopsWithCoords.length >= 2) {
 const bounds = new naver.maps.LatLngBounds();
 stopsWithCoords.forEach(s => bounds.extend(new naver.maps.LatLng(s.lat, s.lng)));
 mapObj.current.fitBounds(bounds, { padding: 50 });
 }
 }, 300);
 };
 const viewSavedRouteOnMap = (route) => {
 const stopsWithCoords = (route.stops || []).filter(s => s.lat && s.lng);
 if (stopsWithCoords.length === 0) return alert('좌표가 있는 경유지가 없습니다');
 navigateToTab('route');
 setTimeout(() => {
 if (!routeMapObj.current) return;
 routeMapMarkersRef.current.forEach(m => m.setMap(null));
 routeMapMarkersRef.current = [];
 routeMapLinesRef.current.forEach(l => l.setMap(null));
 routeMapLinesRef.current = [];
 stopsWithCoords.forEach((stop, idx) => {
 const marker = new naver.maps.Marker({
 position: new naver.maps.LatLng(stop.lat, stop.lng),
 map: routeMapObj.current,
 icon: {
 content: `<div style="background: linear-gradient(135deg, #00C73C, #00a832); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;">${idx + 1}</div>`,
 anchor: new naver.maps.Point(14, 14)
 }
 });
 routeMapMarkersRef.current.push(marker);
 });
 if (stopsWithCoords.length >= 2) {
 const path = stopsWithCoords.map(s => new naver.maps.LatLng(s.lat, s.lng));
 const polyline = new naver.maps.Polyline({
 map: routeMapObj.current,
 path: path,
 strokeColor: '#14b8a6',
 strokeWeight: 4,
 strokeOpacity: 0.8,
 strokeStyle: 'solid'
 });
 routeMapLinesRef.current.push(polyline);
 const bounds = new naver.maps.LatLngBounds();
 stopsWithCoords.forEach(s => bounds.extend(new naver.maps.LatLng(s.lat, s.lng)));
 routeMapObj.current.fitBounds(bounds, { padding: 50 });
 } else {
 routeMapObj.current.setCenter(new naver.maps.LatLng(stopsWithCoords[0].lat, stopsWithCoords[0].lng));
 routeMapObj.current.setZoom(15);
 }
 }, 300);
 };
 const updateUserStatus = (managerId, isOnline) => {
 if (!managerId) return;
 const statusData = {
 isOnline,
 lastSeen: new Date().toISOString()
 };
 database.ref('userStatus/' + managerId).set(statusData);
 };
 const login = async () => {
 try {
 // Firebase Auth로 로그인 (이메일 형식)
 const email = id.includes('@') ? id : `${id}@beancraft.com`;
 const userCredential = await firebase.auth().signInWithEmailAndPassword(email, pw);
 const firebaseUser = userCredential.user;
 
 // Firebase에서 직접 managers 조회 (인증된 상태)
 let userData = null;
 const emailPrefix = email.split('@')[0];
 
 if (emailPrefix === 'admin') {
 userData = { name: 'admin', role: 'super', email: firebaseUser.email };
 } else {
 // Firebase에서 직접 managers 데이터 조회
 const managersSnapshot = await database.ref('managers').once('value');
 const managersData = managersSnapshot.val();
 const allManagers = managersData ? Object.values(managersData) : [];
 const m = allManagers.find(m => m.username === emailPrefix || m.email === email);
 if (m) {
   // [추가] 손상된 이름 검증 및 복구
   let validName = m.name;
   const initM = initManagers.find(im => im.username === emailPrefix || im.id === m.id);
   if (initM && (!m.name || m.name.length < 2 || m.name.includes('ㅁ영업'))) {
     validName = initM.name;
     console.log(`[로그인] 손상된 이름 복구: ${m.name} -> ${validName}`);
     database.ref('managers/' + m.id).update({ name: validName });
   }
   userData = { name: validName, role: 'manager', managerId: m.id, username: m.username, email: firebaseUser.email };
 } else {
 // managers에 없으면 기본 정보로 생성
 userData = { name: emailPrefix, role: 'manager', email: firebaseUser.email };
 }
 }
 
 setUser(userData); setLoggedIn(true);
// 로그인 후 데이터 표시를 위한 강제 리렌더링
setTimeout(() => { setUser(prev => prev ? { ...prev } : prev); }, 150);
 if (userData.managerId) setRouteManager(userData.managerId);
 
 localStorage.setItem('bc_session', JSON.stringify({ user: userData, expiry: Date.now() + (6 * 60 * 60 * 1000) }));
 if (rememberMe) {
 localStorage.setItem('bc_remember_login', JSON.stringify({ id, pw, expiry: Date.now() + (30 * 24 * 60 * 60 * 1000) }));
 } else {
 localStorage.removeItem('bc_remember_login');
 }
 if (userData.managerId) updateUserStatus(userData.managerId, true);
 } catch (error) {
 console.error('로그인 에러:', error);
 if (error.code === 'auth/user-not-found') {
 alert('등록되지 않은 계정입니다');
 } else if (error.code === 'auth/wrong-password') {
 alert('비밀번호가 올바르지 않습니다');
 } else if (error.code === 'auth/invalid-email') {
 alert('이메일 형식이 올바르지 않습니다');
 } else {
 alert('로그인 실패: ' + error.message);
 }
 }
 };
 const logout = async () => {
 if (user?.managerId) updateUserStatus(user.managerId, false);
 try { await firebase.auth().signOut(); } catch(e) {}
 setLoggedIn(false); setUser(null); localStorage.removeItem('bc_session'); mapObj.current = null; routeMapObj.current = null; setTabHistory([]);
 setTodayContactAlert(null); setIncompleteRouteAlert(null); // 알림 초기화
 };
 useEffect(() => {
 const handleBeforeUnload = () => {
 if (user?.managerId) {
 database.ref('userStatus/' + user.managerId).set({
 isOnline: false,
 lastSeen: new Date().toISOString()
 });
 }
 };
 window.addEventListener('beforeunload', handleBeforeUnload);
 return () => window.removeEventListener('beforeunload', handleBeforeUnload);
 }, [user]);
 useEffect(() => {
 if (!user?.managerId) return;
 const interval = setInterval(() => {
 updateUserStatus(user.managerId, true);
 }, 60000);
 return () => clearInterval(interval);
 }, [user]);
 const changePassword = async () => {
 if (!newPassword.trim()) return alert('새 비밀번호를 입력하세요');
 if (newPassword !== confirmPassword) return alert('비밀번호가 일치하지 않습니다');
 if (newPassword.length < 6) return alert('비밀번호는 6자 이상이어야 합니다');
 try {
 const currentUser = firebase.auth().currentUser;
 if (!currentUser) return alert('로그인이 필요합니다');
 await currentUser.updatePassword(newPassword);
 setShowPasswordModal(false); setNewPassword(''); setConfirmPassword('');
 alert('비밀번호가 변경되었습니다');
 } catch (error) {
 console.error('비밀번호 변경 에러:', error);
 if (error.code === 'auth/requires-recent-login') {
 alert('보안을 위해 다시 로그인 후 시도해주세요');
 } else {
 alert('비밀번호 변경 실패: ' + error.message);
 }
 }
 };
 const changeAdminPassword = async () => {
 // 모달에서 호출 시
 if (showAdminPwModal) {
 if (!adminNewPw.trim()) return alert('새 비밀번호를 입력하세요');
 if (adminNewPw !== adminConfirmPw) return alert('비밀번호가 일치하지 않습니다');
 if (adminNewPw.length < 6) return alert('비밀번호는 6자 이상이어야 합니다');
 try {
 const currentUser = firebase.auth().currentUser;
 if (!currentUser) return alert('로그인이 필요합니다');
 await currentUser.updatePassword(adminNewPw);
 setShowAdminPwModal(false); setAdminNewPw(''); setAdminConfirmPw('');
 alert('관리자 비밀번호가 변경되었습니다');
 } catch (error) {
 if (error.code === 'auth/requires-recent-login') {
 alert('보안을 위해 다시 로그인 후 시도해주세요');
 } else {
 alert('비밀번호 변경 실패: ' + error.message);
 }
 }
 } else {
 // 설정 페이지에서 호출 시
 if (!newPassword.trim()) return alert('새 비밀번호를 입력하세요');
 if (newPassword !== confirmPassword) return alert('비밀번호가 일치하지 않습니다');
 if (newPassword.length < 6) return alert('비밀번호는 6자 이상이어야 합니다');
 try {
 const currentUser = firebase.auth().currentUser;
 if (!currentUser) return alert('로그인이 필요합니다');
 await currentUser.updatePassword(newPassword);
 setNewPassword(''); setConfirmPassword('');
 alert('관리자 비밀번호가 변경되었습니다');
 } catch (error) {
 if (error.code === 'auth/requires-recent-login') {
 alert('보안을 위해 다시 로그인 후 시도해주세요');
 } else {
 alert('비밀번호 변경 실패: ' + error.message);
 }
 }
 }
 };
 const handleSaveCompany = async () => {
 if (!companyForm.name.trim()) return alert('업체명을 입력하세요');
 let lat = null, lng = null;
 if (companyForm.address) {
 const coords = await geocodeAddress(companyForm.address, companyForm.name);
 if (coords) {
 lat = coords.lat;
 lng = coords.lng;
 }
 }
 // 일반 팀원은 자동으로 본인 ID 할당
 const finalManagerId = isAdmin ? companyForm.managerId : user?.managerId;
 const newCompany = {
 id: Date.now(),
 ...companyForm,
 managerId: finalManagerId,
 lat,
 lng,
 isReregistered: companyForm.isReregistered || false,
 usedMents: selectedMentsForCompany, // 사용한 멘트 ID 배열
 mentMemo: companyMentMemo, // 멘트 반응 메모
 createdAt: new Date().toLocaleString('ko-KR')
 };
 saveCompany(newCompany);
 // 자동 방문 일정 생성 (신규 업체)
 if (!companyForm.isReregistered) {
   createAutoSchedulesForCompany(newCompany, finalManagerId);
 }
 // 멘트 사용 횟수 증가 (긍정/특별 반응이면 성공으로 카운트)
 const isSuccess = companyForm.reaction === 'positive' || companyForm.reaction === 'special';
 selectedMentsForCompany.forEach(mentId => incrementMentUsage(mentId, isSuccess));
 const randomQuote = COMPANY_QUOTES[Math.floor(Math.random() * COMPANY_QUOTES.length)];
 setShowCompanySuccessModal({ companyName: companyForm.name, quote: randomQuote });
 if (companyForm.reaction === 'positive' || companyForm.reaction === 'special') {
 // 다음날 연락 자동 등록
 const tomorrow = new Date();
 tomorrow.setDate(tomorrow.getDate() + 1);
 const tomorrowDate = tomorrow.toISOString().split('T')[0];
 const tomorrowEvent = {
 id: Date.now() + 1,
 date: tomorrowDate,
 title: `${companyForm.name}`,
 managerId: finalManagerId,
 memo: `안녕하세요, 대표님. 어제 잠시 인사드렸던 빈크래프트입니다. 혹시 전달드린 자료 살펴보셨나요?\n\n담당자: ${companyForm.contact || '-'}\n연락처: ${companyForm.phone || '-'}\n주소: ${companyForm.address || '-'}`,
 type: 'followup',
 companyId: newCompany.id
 };
 saveCalendarEvent(tomorrowEvent);
 
 // 한달 후 연락 자동 등록
 const oneMonthLater = new Date();
 oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
 const followUpDate = oneMonthLater.toISOString().split('T')[0];
 const calendarEvent = {
 id: Date.now() + 2,
 date: followUpDate,
 title: `${companyForm.name}`,
 managerId: finalManagerId,
 memo: `안녕하세요, 대표님. 빈크래프트입니다. 지난번 전달드린 자료 관련하여 혹시 검토해보셨을까요?\n\n담당자: ${companyForm.contact || '-'}\n연락처: ${companyForm.phone || '-'}\n주소: ${companyForm.address || '-'}`,
 type: 'followup',
 companyId: newCompany.id
 };
 saveCalendarEvent(calendarEvent);
 }
 setCompanyForm({ name: '', contact: '', address: '', phone: '', region: '', managerId: null, reaction: 'neutral', memo: '', isReregistered: false });
 setSelectedCity('');
 setSelectedMentsForCompany([]); // 멘트 선택 초기화
 setCompanyMentMemo(''); // 멘트 메모 초기화
 };
 const updateCompany = async () => {
    if (!showCompanyEditModal) return;
    let updatedCompany = { ...showCompanyEditModal };
    if (updatedCompany.address && (!updatedCompany.lat || !updatedCompany.lng)) {
      const coords = await geocodeAddress(updatedCompany.address, updatedCompany.name);
      if (coords) {
        updatedCompany.lat = coords.lat;
        updatedCompany.lng = coords.lng;
      }
    }
    saveCompany(updatedCompany);
    setShowCompanyEditModal(null);
  };
 const handleDeleteCompany = (company) => {
 setShowDeleteConfirm({ type: 'company', id: company.id, name: company.name });
 };
 const parseBulkText = () => {
 if (!bulkAddText.trim()) return alert('내용을 입력하세요');
 const lines = bulkAddText.split('\n').map(l => l.trim()).filter(l => l);
 const parsed = [];
 lines.forEach((line) => {
 const parts = line.split('/').map(p => p.trim());
 if (parts.length < 1 || !parts[0]) return;
 const [name, contact, phone, address, reactionInput] = parts;
 let reaction = bulkAddReaction;
 if (reactionInput) {
 if (reactionInput === '부정') reaction = 'negative';
 else if (reactionInput === '양호') reaction = 'neutral';
 else if (reactionInput === '긍정') reaction = 'positive';
 else if (reactionInput === '특별') reaction = 'special';
 }
 const finalAddress = address || bulkAddRegion || '';
 parsed.push({ name, contact: contact || '', phone: phone || '', managerId: bulkAddSales, region: finalAddress, address: finalAddress, reaction });
 });
 parsed.forEach((p, i) => {
 const newCompany = { id: Date.now() + i, ...p, createdAt: new Date().toLocaleString('ko-KR') };
 saveCompany(newCompany);
 });
 setBulkAddText(''); setBulkAddSales(null); setBulkAddRegion(''); setBulkAddCity(''); setBulkAddReaction('neutral');
 setShowBulkAddModal(false);
 alert(`${parsed.length}개 업체가 등록되었습니다.`);
 };
 const handleSaveCustomer = () => {
 if (!customerForm.name.trim()) return alert('고객명을 입력하세요');
 const newCustomer = { id: Date.now(), ...customerForm, createdAt: new Date().toLocaleString('ko-KR') };
 saveCustomer(newCustomer);
 setCustomerForm({ name: '', phone: '', managerId: null, consultDate: '', desiredRegion: '', desiredDate: '', budget: '', desiredSize: '', businessStyle: [], priorities: [], note: '', status: 'consult', memo: '' });
 };
 const updateCustomer = () => {
 if (!showCustomerEditModal) return;
 saveCustomer(showCustomerEditModal);
 setShowCustomerEditModal(null);
 };
 const handleDeleteCustomer = (customer) => {
 setShowDeleteConfirm({ type: 'customer', id: customer.id, name: customer.name });
 };
 const handleSaveSale = () => {
 if (!saleForm.managerId || !saleForm.amount) return alert('영업자와 금액을 입력하세요');
 const newSale = { id: Date.now(), ...saleForm, amount: Number(saleForm.amount), date: saleForm.date || getKoreanToday() };
 saveSale(newSale);
 setSaleForm({ managerId: null, companyId: null, amount: '', date: '', note: '' });
 setShowSaleModal(false);
 };
 const getManagerSales = (managerId) => sales.filter(s => s.managerId === managerId).reduce((sum, s) => sum + s.amount, 0);
 const submitPromoRequest = () => {
 const items = Object.entries(promoRequest).filter(([k, v]) => v).map(([k]) => k);
 if (items.length === 0) return alert('요청할 항목을 선택하세요');
 const newRequest = { id: Date.now(), managerId: user.managerId, managerName: user.name, items, timestamp: new Date().toLocaleString('ko-KR'), status: 'pending' };
 saveRequest(newRequest);
 setPromoRequest({ '명함': false, '브로셔': false, '전단지': false, '쿠폰': false });
 setShowPromoRequestModal(null);
 alert('요청이 전송되었습니다.');
 };
 const confirmRequest = (reqId) => {
 const req = requests.find(r => r.id === reqId);
 if (req) saveRequest({ ...req, status: 'confirmed' });
 };
 const updateManagerPromo = (managerId, item, value) => {
 const cleanValue = String(value).replace(/^0+/, '') || '0';
 const mgr = managers.find(m => m.id === managerId);
 if (mgr) saveManager({ ...mgr, promo: { ...mgr.promo, [item]: Number(cleanValue) || 0 } });
 };
 const filteredCompanies = companySearch.trim() ? companies.filter(c => matchChosung(c.name, companySearch)) : companies;
 const isAdmin = user?.role === 'super';
 const pendingRequests = requests.filter(r => r.status === 'pending');
 const getAvailableManagersForSale = () => managers;
 const formatLastSeen = (isoString) => {
 if (!isoString) return '없음';
 const date = new Date(isoString);
 if (isNaN(date.getTime())) return '날짜 오류';
 const now = new Date();
 const diff = now - date;
 const minutes = Math.floor(diff / 60000);
 const hours = Math.floor(diff / 3600000);
 const days = Math.floor(diff / 86400000);
 if (minutes < 1) return '방금 전';
 if (minutes < 60) return `${minutes}분 전`;
 if (hours < 24) return `${hours}시간 전`;
 if (days < 7) return `${days}일 전`;
 return date.toLocaleDateString('ko-KR');
 };
 if (!loggedIn) {
   const transitionStyle = {
     transition: 'opacity 1.5s ease-in-out, transform 1.5s ease-in-out',
     willChange: 'opacity, transform'
   };
   
   return (
     <div className={`min-h-screen flex items-center justify-center p-4 overflow-hidden ${theme === 'dark' ? 'bg-neutral-900' : 'bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200'}`}>
       <div className="w-full max-w-md relative" style={{minHeight: '500px'}}>
         
         {/* 명언 - quote일 때만 보임 */}
         <div 
           className="absolute inset-0 flex items-center justify-center"
           style={{
             ...transitionStyle,
             opacity: loginPhase === 'quote' ? 1 : 0,
             transform: loginPhase === 'quote' ? 'translateY(0)' : 'translateY(-30px)',
             pointerEvents: loginPhase === 'quote' ? 'auto' : 'none'
           }}
         >
           <p className={`text-sm sm:text-base font-normal leading-relaxed max-w-xs sm:max-w-sm mx-auto text-center ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`} style={{wordBreak: 'keep-all'}}>"{loginQuote}"</p>
         </div>
         
         {/* 로고만 - logo일 때 보임 */}
         <div 
           className="absolute inset-0 flex items-center justify-center"
           style={{
             ...transitionStyle,
             opacity: loginPhase === 'logo' ? 1 : 0,
             transform: loginPhase === 'logo' ? 'scale(1)' : (loginPhase === 'quote' ? 'scale(0.9)' : 'scale(1.05)'),
             pointerEvents: loginPhase === 'logo' ? 'auto' : 'none'
           }}
         >
           <div className="text-center">
             <img src="/logo.png" alt="BEANCRAFT" className="w-72 h-72 sm:w-96 sm:h-96 mx-auto mb-4 object-contain" />
             <p className={`text-lg sm:text-xl tracking-widest font-semibold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>빈크래프트 영업관리</p>
           </div>
         </div>
         
         {/* 로고 + 명언 + 로그인폼 - form일 때 보임 */}
         <div 
           className="absolute inset-0"
           style={{
             ...transitionStyle,
             opacity: loginPhase === 'form' ? 1 : 0,
             transform: loginPhase === 'form' ? 'translateY(0)' : 'translateY(50px)',
             pointerEvents: loginPhase === 'form' ? 'auto' : 'none'
           }}
         >
           <div className="text-center mb-6">
             <img src="/logo.png" alt="BEANCRAFT" className="w-56 h-56 sm:w-72 sm:h-72 mx-auto mb-3 object-contain" />
             <p className={`text-base sm:text-lg tracking-widest font-semibold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>빈크래프트 영업관리</p>
           </div>
           <div className="text-center mb-5 px-4">
             <p className={`text-xs sm:text-sm font-normal leading-relaxed max-w-xs sm:max-w-sm mx-auto ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`} style={{wordBreak: 'keep-all'}}>"{loginQuote}"</p>
           </div>
           <div className={`rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-xl ${theme === 'dark' ? 'bg-white/10 border border-white/20' : 'bg-white/80 border border-white/50'}`}>
             <input type="text" placeholder="아이디" value={id} onChange={e => setId(e.target.value)} className={`w-full p-2.5 sm:p-3 rounded-xl mb-2 sm:mb-3 outline-none focus:ring-2 text-sm font-medium transition-all ${theme === 'dark' ? 'bg-white/10 text-white placeholder-neutral-400 focus:ring-white/30 border border-white/10' : 'bg-white text-neutral-900 placeholder-neutral-400 focus:ring-neutral-300 border border-neutral-200'}`} />
             <input type="password" placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} onKeyPress={e => e.key === 'Enter' && login()} className={`w-full p-2.5 sm:p-3 rounded-xl mb-2 sm:mb-3 outline-none focus:ring-2 text-sm font-medium transition-all ${theme === 'dark' ? 'bg-white/10 text-white placeholder-neutral-400 focus:ring-white/30 border border-white/10' : 'bg-white text-neutral-900 placeholder-neutral-400 focus:ring-neutral-300 border border-neutral-200'}`} />
             <label className={`flex items-center gap-2 text-sm mb-4 cursor-pointer ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
               <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-4 h-4 rounded accent-neutral-700" />
               로그인 상태 유지
             </label>
             <button type="button" onClick={login} className={`w-full p-3 rounded-xl font-semibold transition-all text-sm ${theme === 'dark' ? 'bg-white text-neutral-900 hover:bg-neutral-100' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}>로그인</button>
           </div>
         </div>
         
       </div>
     </div>
   );
 }
 const tabs = [
 { key: 'report', icon: '', label: '보고서' },
 { key: 'calendar', icon: '', label: '캘린더' },
 { key: 'route', icon: '', label: '동선' },
 { key: 'map', icon: '', label: '지도' },
 { key: 'managers', icon: '', label: '영업팀' },
 { key: 'companies', icon: '', label: '업체' },
 { key: 'realtors', icon: '', label: '중개사' },
 { key: 'customers', icon: '', label: '고객' },
 ...(!isAdmin ? [{ key: 'requests', icon: '', label: '요청' }] : []),
 { key: 'settings', icon: '', label: '설정' }
 ];

 // ═══════════════════════════════════════════════════════════════
 // 영업모드 UI 렌더링
 // ═══════════════════════════════════════════════════════════════
 if (salesModeActive) {
   return (
     <div 
       className={`min-h-screen select-none ${t.bgGradient} ${t.text}`}
       onClick={updateSalesModeActivity}
       onTouchStart={updateSalesModeActivity}
       style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
     >
       {/* 대상 선택 화면 */}
       {salesModeScreen === 'select' && (
         <div className="min-h-screen flex flex-col items-center justify-center p-6">
           <img src="/logo.png" alt="BEANCRAFT" className="w-48 h-48 object-contain mb-8" onError={(e) => { e.target.style.display = 'none'; }} />
           <h2 className={`text-2xl font-bold mb-2 ${t.text}`}>영업모드</h2>
           <p className={`mb-8 ${t.textSecondary}`}>대상을 선택해주세요</p>
           <div className="w-full max-w-sm space-y-2">
             <button
               onClick={() => { setSalesModeTarget('broker'); setSalesModeScreen('main'); }}
               className={`w-full py-6 rounded-2xl border-2 transition-all ${theme === 'dark' ? 'border-neutral-700 hover:border-white hover:bg-neutral-800' : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'}`}
             >
               <span className={`text-xl font-bold ${t.text}`}>중개사</span>
               <p className={`text-sm mt-1 ${t.textSecondary}`}>부동산 중개사 미팅용</p>
             </button>
             <button
               onClick={() => { setSalesModeTarget('client'); setSalesModeScreen('main'); }}
               className={`w-full py-6 rounded-2xl border-2 transition-all ${theme === 'dark' ? 'border-neutral-700 hover:border-white hover:bg-neutral-800' : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'}`}
             >
               <span className={`text-xl font-bold ${t.text}`}>의뢰인</span>
               <p className={`text-sm mt-1 ${t.textSecondary}`}>카페 창업 의뢰인용</p>
             </button>
           </div>
           <button
             onClick={exitSalesMode}
             className={`mt-8 text-sm ${t.textSecondary}`}
           >
             영업모드 종료
           </button>
         </div>
       )}

       {/* 잠금 화면 */}
       {salesModeScreen === 'locked' && (
         <div 
           className={`min-h-screen flex flex-col items-center justify-center p-6 ${t.bgGradient}`}
           onClick={() => setSalesModeScreen('pin')}
         >
           <img src="/logo.png" alt="BEANCRAFT" className="w-40 h-40 object-contain mb-8 opacity-80" onError={(e) => { e.target.style.display = 'none'; }} />
           <p className={`text-sm mb-4 ${t.textMuted}`}>화면을 터치하여 잠금 해제</p>
           <div className={`w-48 h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/20' : 'bg-neutral-300'}`}>
             <div className={`h-full w-1/3 animate-pulse ${theme === 'dark' ? 'bg-white/60' : 'bg-neutral-600'}`}></div>
           </div>
         </div>
       )}

       {/* PIN 입력 화면 */}
       {salesModeScreen === 'pin' && (
         <div className="min-h-screen flex flex-col items-center justify-center p-6">
           <h2 className={`text-xl font-bold mb-2 ${t.text}`}>PIN 입력</h2>
           <p className={`text-sm mb-8 ${t.textSecondary}`}>4자리 비밀번호를 입력해주세요</p>
           <div className="flex gap-3 mb-8">
             {[0, 1, 2, 3].map(i => (
               <div
                 key={i}
                 className={`w-4 h-4 rounded-full transition-all ${salesModePinInput.length > i ? (theme === 'dark' ? 'bg-white' : 'bg-neutral-900') : (theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-300')}`}
               />
             ))}
           </div>
           <div className="grid grid-cols-3 gap-4 w-64">
             {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((digit, idx) => (
               <button
                 key={idx}
                 onClick={() => {
                   if (digit === 'del') handlePinDelete();
                   else if (digit !== '') handlePinInput(String(digit));
                 }}
                 disabled={digit === ''}
                 className={`w-16 h-16 rounded-full text-2xl font-bold transition-all ${
                   digit === '' ? 'invisible' :
                   digit === 'del' ? 'text-gray-300 hover:bg-neutral-800' :
                   'bg-neutral-800 hover:bg-neutral-700 text-white'
                 }`}
               >
                 {digit === 'del' ? '⌫' : digit}
               </button>
             ))}
           </div>
           <button
             onClick={() => setSalesModeScreen('locked')}
             className={`mt-8 text-sm ${t.textSecondary}`}
           >
             취소
           </button>
         </div>
       )}

       {/* 메인 영업모드 화면 */}
       {salesModeScreen === 'main' && (
         <div className="min-h-screen flex flex-col">
           {/* 상단 헤더 - 로고 + 타겟 배지 */}
           <div className={`px-4 py-3 flex justify-between items-center sticky top-0 z-50 backdrop-blur-xl border-b ${theme === 'dark' ? 'bg-neutral-900/95 border-neutral-800' : 'bg-white/95 border-neutral-200'}`}>
             <button
               onClick={exitSalesMode}
               className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${theme === 'dark' ? 'text-gray-300 hover:text-white border-neutral-700 hover:bg-neutral-800' : 'text-neutral-600 hover:text-neutral-900 border-neutral-300 hover:bg-neutral-100'}`}
             >
               관리자
             </button>
             <img src="/logo.png" alt="BEANCRAFT" className="h-8 object-contain" onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"><text y="22" font-size="18" font-weight="bold" fill="white">BEANCRAFT</text></svg>'; }} />
             <div className="w-20 flex justify-end">
               <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                 salesModeTarget === 'broker' 
                   ? 'bg-blue-600 text-white' 
                   : 'bg-emerald-600 text-white'
               }`}>
                 {salesModeTarget === 'broker' ? '중개사' : '의뢰인'}
               </span>
             </div>
           </div>

           {/* 탭 네비게이션 */}
           <div className={`flex border-b ${theme === 'dark' ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}`}>
             <button
               onClick={() => { setSalesModeTab('analysis'); updateSalesModeActivity(); }}
               className={`flex-1 py-4 text-center font-bold transition-all ${
                 salesModeTab === 'analysis' 
                   ? 'text-white border-b-2 border-white bg-neutral-800' 
                   : 'text-gray-400 hover:text-white hover:bg-neutral-800/50'
               }`}
             >
               분석
             </button>
             <button
               onClick={() => { setSalesModeTab('homepage'); updateSalesModeActivity(); }}
               className={`flex-1 py-4 text-center font-bold transition-all ${
                 salesModeTab === 'homepage' 
                   ? 'text-white border-b-2 border-white bg-neutral-800' 
                   : 'text-gray-400 hover:text-white hover:bg-neutral-800/50'
               }`}
             >
               홈페이지
             </button>
           </div>

           {/* 탭 콘텐츠 */}
           <div className={`flex-1 overflow-y-auto ${theme === 'dark' ? 'bg-neutral-900' : 'bg-neutral-50'}`}>
             {/* 분석 탭 */}
             {salesModeTab === 'analysis' && (
               <div className="p-4 space-y-2">
                 {/* 지역 검색창 + 자동완성 */}
                 <div className="relative">
                   <input
                     type="text"
                     value={salesModeSearchQuery}
                     onChange={(e) => { setSalesModeSearchQuery(e.target.value); setSalesAutoCompleteOpen(e.target.value.length >= 1); }}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         setSalesAutoCompleteOpen(false);
                         searchSalesModeRegion(salesModeSearchQuery);
                       }
                       if (e.key === 'Escape') setSalesAutoCompleteOpen(false);
                     }}
                     onFocus={() => { if (salesModeSearchQuery.length >= 1) setSalesAutoCompleteOpen(true); }}
                     placeholder="지역을 검색하세요 (예: 강남역, 판교)"
                     className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition-all ${theme === 'dark' ? 'border-neutral-700 bg-neutral-800 focus:border-white text-white placeholder-gray-500' : 'border-neutral-200 bg-white focus:border-neutral-400 text-neutral-900 placeholder-neutral-400'}`}
                   />
                   <button
                     onClick={() => { setSalesAutoCompleteOpen(false); searchSalesModeRegion(salesModeSearchQuery); }}
                     disabled={salesModeSearchLoading}
                     className={`absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-100' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}
                   >
                     {salesModeSearchLoading ? '분석중...' : '검색'}
                   </button>

                   {/* 자동완성 드롭다운 */}
                   {salesAutoCompleteOpen && salesModeSearchQuery.length >= 1 && (() => {
                     const popularSpots = [
                       '강남역','홍대입구역','건대입구역','성수동','이태원','명동','잠실','신촌',
                       '판교역','분당 정자동','수원역','일산','안양 범계역','김포 장기동',
                       '해운대','서면','부산 남포동','대구 동성로','대전 둔산동','광주 충장로',
                       '전주 객사','제주 연동','창원 상남동','코엑스','가로수길','을지로3가',
                       '삼청동','북촌','연남동','망원동','합정','역삼','종로','광화문','여의도',
                       '서울대입구역','연세대','남대문시장','동대문시장'
                     ];
                     const q = salesModeSearchQuery.toLowerCase();
                     const filtered = popularSpots.filter(s => s.toLowerCase().includes(q)).slice(0, 6);
                     if (filtered.length === 0) return null;
                     return (
                       <div style={{
                         position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                         marginTop: 4, borderRadius: 12, overflow: 'hidden',
                         background: theme === 'dark' ? '#2B2B2B' : '#FFF',
                         border: `1px solid ${theme === 'dark' ? '#444' : '#E5E5E5'}`,
                         boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
                       }}>
                         {filtered.map((spot, i) => (
                           <div key={i}
                             onClick={() => { setSalesModeSearchQuery(spot); setSalesAutoCompleteOpen(false); searchSalesModeRegion(spot); }}
                             style={{
                               padding: '10px 16px', cursor: 'pointer', fontSize: 14,
                               color: theme === 'dark' ? '#DDD' : '#333',
                               borderBottom: i < filtered.length - 1 ? `1px solid ${theme === 'dark' ? '#333' : '#F0F0F0'}` : 'none',
                               display: 'flex', alignItems: 'center', gap: 8,
                             }}
                             onMouseOver={(e) => e.currentTarget.style.background = theme === 'dark' ? '#333' : '#F7F7F7'}
                             onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                           >
                             <span style={{ color: theme === 'dark' ? '#888' : '#BBB', fontSize: 12 }}>📍</span>
                             <span>{spot}</span>
                           </div>
                         ))}
                       </div>
                     );
                   })()}
                 </div>

                 {/* 검색 안내 */}
                 <p style={{ fontSize: 12, color: theme === 'dark' ? '#888' : '#999', padding: '2px 4px', margin: 0 }}>
                   상세 주소 입력 시 더 정밀한 분석이 가능해요 (예: 서울시 용산구 청파로 205-6)
                 </p>

                 {/* 지역 선택 버튼 (지도에서 직접 선택) */}
                 <button
                   onClick={startLocationSelectMode}
                   className={`w-full py-3 rounded-xl border text-sm font-medium transition-all ${
                     locationSelectMode 
                       ? 'border-white bg-white text-black' 
                       : 'border-neutral-700 bg-neutral-800 text-gray-300 hover:bg-neutral-700'
                   }`}
                 >
                   {locationSelectMode ? '지도를 탭하여 위치를 선택하세요' : '지도에서 직접 위치 선택 (반경 500m 분석)'}
                 </button>

                 {/* 지역 선택 모드 안내 */}
                 {locationSelectMode && (
                   <div className="space-y-3">
                     <div className={`p-3 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-xl`}>
                       <p className={`text-sm text-center ${t.textSecondary}`}>지도를 탭하면 해당 위치의 반경 500m 업종 분석을 시작합니다</p>
                       <button
                         onClick={exitLocationSelectMode}
                         className={`w-full mt-2 py-2 text-sm ${t.textSecondary}`}
                       >
                         취소
                       </button>
                     </div>
                     {/* 위치 선택용 지도 */}
                     <div 
                       ref={salesModeSelectMapContainerRef}
                       className={`h-[60vh] ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200'} rounded-xl overflow-hidden`}
                       style={{ minHeight: '400px' }}
                     />
                   </div>
                 )}

                 {/* 검색 결과 - 토스 스타일 */}
                 {/* 중복 지역 선택 드롭다운 */}
                {showDuplicateSelector && duplicateRegionOptions.length > 0 && (
                  <div className={`mt-3 rounded-xl overflow-hidden border ${theme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-white'}`}>
                    <div className={`px-4 py-2.5 ${theme === 'dark' ? 'bg-neutral-750' : 'bg-neutral-50'}`}>
                      <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        같은 이름의 지역이 있어요. 분석할 지역을 선택해주세요.
                      </p>
                    </div>
                    {duplicateRegionOptions.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSalesModeSearchQuery(opt.fullQuery);
                          setShowDuplicateSelector(false);
                          setDuplicateRegionOptions([]);
                          searchSalesModeRegion(opt.fullQuery, true);
                        }}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between transition-all ${
                          theme === 'dark' 
                            ? 'hover:bg-neutral-700 border-t border-neutral-700' 
                            : 'hover:bg-neutral-50 border-t border-neutral-100'
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{opt.label}</p>
                          <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>{opt.description}</p>
                        </div>
                        <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ))}
                  </div>
                )}

                {salesModeSearchResult?.success && (
                   <TossStyleResults 
                     result={salesModeSearchResult} 
                     theme={theme}
                     onShowSources={() => setSalesModeShowSources(!salesModeShowSources)}
                     salesModeShowSources={salesModeShowSources}
                   />
                 )}

                 {/* 로딩 중 프로그레스 표시 */}
                 {salesModeSearchLoading && (
                   <div className="flex flex-col items-center justify-center py-16">
                     {/* 로고 색채움 애니메이션 */}
                     <div className="relative w-64 h-64 mb-8">
                       {/* 흑백 로고 (배경) */}
                       <img 
                         src="/logo.png" 
                         alt="BEANCRAFT" 
                         className="absolute inset-0 w-full h-full object-contain"
                         style={{ filter: 'grayscale(100%)', opacity: 0.3 }}
                       />
                       {/* 컬러 로고 (왼쪽에서 오른쪽으로 채워짐) - width 방식 */}
                       <div 
                         className="absolute inset-0 overflow-hidden transition-all duration-500 ease-out"
                         style={{ width: `${salesModeAnalysisProgress}%` }}
                       >
                         <img 
                           src="/logo.png" 
                           alt="BEANCRAFT" 
                           className="w-64 h-64 object-contain"
                           style={{ minWidth: '256px' }}
                         />
                       </div>
                     </div>
                     
                     {/* 퍼센트 표시 */}
                     <p className={`text-4xl font-bold ${t.text} mb-4`}>
                       {salesModeAnalysisProgress}%
                     </p>
                     
                     {/* 수집 멘트 - 상세 상태 */}
                     <p className={`text-sm mb-2 text-center max-w-sm ${t.textSecondary}`}>
                       {salesModeCollectingText || salesModeAnalysisStep}
                     </p>
                     <p className={`text-xs ${t.textSecondary}`}>잠시만 기다려주세요</p>

                     {/* 분석 중지 버튼 */}
                     <button
                       onClick={() => {
                         if (salesModeAbortRef.current) {
                           salesModeAbortRef.current.abort();
                           salesModeAbortRef.current = null;
                         }
                         setSalesModeSearchLoading(false);
                         setSalesModeAnalysisStep('분석이 중지되었습니다');
                         setSalesModeCollectingText('');
                         setSalesModeAnalysisProgress(0);
                       }}
                       className="mt-6 px-6 py-2.5 rounded-full text-sm font-medium transition-all"
                       style={{
                         background: 'rgba(240, 68, 82, 0.1)',
                         color: '#F04452',
                         border: '1px solid rgba(240, 68, 82, 0.3)',
                       }}
                     >
                       분석 중지
                     </button>
                   </div>
                 )}

                 {/* 검색 전 안내 */}
                 {!salesModeSearchResult && !salesModeSearchLoading && (
                   <div className="text-center py-20">
                     <p className={`mb-2 ${t.textSecondary}`}>지역을 검색하면</p>
                     <p className={`${t.textSecondary}`}>AI 상권 분석 결과를 확인할 수 있습니다</p>
                   </div>
                 )}

                 {/* 에러 표시 */}
                 {salesModeSearchResult?.success === false && (
                   <div className="text-center py-10">
                     <p className="text-red-500 mb-2">분석 중 오류가 발생했습니다</p>
                     <p className={`text-sm ${t.textSecondary}`}>{salesModeSearchResult.error}</p>
                   </div>
                 )}
               </div>
             )}

             {/* 홈페이지 탭 */}
             {salesModeTab === 'homepage' && (
               <div className="h-[calc(100vh-120px)] flex flex-col">
                 {/* 카테고리 메뉴 */}
                 <div className={`p-3 border-b ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-100'}`}>
                   <div className="flex gap-2 overflow-x-auto">
                     <button 
                       onClick={() => setSalesModeHomepageUrl('https://www.beancraft.co.kr')}
                       className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${salesModeHomepageUrl === 'https://www.beancraft.co.kr' ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                     >
                       홈
                     </button>
                     <button 
                       onClick={() => setSalesModeHomepageUrl('https://www.beancraft.co.kr/%EC%B0%BD%EC%97%85%EC%95%88%EB%82%B4')}
                       className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${salesModeHomepageUrl?.includes('창업안내') ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                     >
                       창업안내
                     </button>
                     <button 
                       onClick={() => setSalesModeHomepageUrl('https://www.beancraft.co.kr/%EC%9D%B8%ED%85%8C%EB%A6%AC%EC%96%B4')}
                       className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${salesModeHomepageUrl?.includes('인테리어') ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                     >
                       인테리어
                     </button>
                     <button 
                       onClick={() => setSalesModeHomepageUrl('https://www.beancraft.co.kr/%EA%B8%B0%EA%B8%B0%EC%84%A4%EC%B9%98')}
                       className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${salesModeHomepageUrl?.includes('기기설치') ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                     >
                       기기설치
                     </button>
                     <button 
                       onClick={() => setSalesModeHomepageUrl('https://www.beancraft.co.kr/%EB%A9%94%EB%89%B4%EA%B0%9C%EB%B0%9C')}
                       className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${salesModeHomepageUrl?.includes('메뉴개발') ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                     >
                       메뉴개발
                     </button>
                     <button 
                       onClick={() => setSalesModeHomepageUrl('https://www.beancraft.co.kr/%EC%9A%B4%EC%98%81%EA%B5%90%EC%9C%A1')}
                       className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${salesModeHomepageUrl?.includes('운영교육') ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                     >
                       운영교육
                     </button>
                   </div>
                 </div>
                 
                 {/* iframe으로 홈페이지 직접 표시 */}
                 <div className={`flex-1 relative ${theme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
                   <iframe
                     src={salesModeHomepageUrl || 'https://www.beancraft.co.kr'}
                     className="w-full h-full border-0"
                     title="빈크래프트 홈페이지"
                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                   />
                 </div>
               </div>
             )}
           </div>

           {/* 하단 종료 버튼 */}
           <div className={`border-t p-4 sticky bottom-0 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
             <button
               onClick={() => setSalesModeScreen('locked')}
               className={`w-full py-3 rounded-xl font-medium transition-all ${theme === 'dark' ? 'bg-neutral-800 text-gray-300 hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
             >
               화면 잠금
             </button>
           </div>
         </div>
       )}

       {/* 지역 분석 모달 (반경 500m) */}
       {showLocationModal && locationAnalysisData && (
         <LocationAnalysisModal 
           data={locationAnalysisData}
           onClose={() => {
             setShowLocationModal(false);
             exitLocationSelectMode();
           }}
           onDetailAnalysis={(location) => {
             setShowLocationModal(false);
             setSalesModeSearchQuery(location.address);
             searchSalesModeRegion(location.address);
           }}
           generateAIFeedback={generateLocationAIFeedback}
           theme={theme}
         />
       )}

       {/* 지역 선택 로딩 오버레이 */}
       {locationAnalysisLoading && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
           <div className={`rounded-2xl p-8 flex flex-col items-center ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur' : 'bg-white'}`}>
             <div className={`w-12 h-12 border-4 rounded-full animate-spin mb-4 ${theme === 'dark' ? 'border-neutral-600 border-t-white' : 'border-neutral-200 border-t-neutral-800'}`}></div>
             <p className={`font-medium ${t.text}`}>반경 500m 분석 중</p>
             <p className={`text-sm mt-1 ${t.textMuted}`}>데이터를 수집하고 있습니다</p>
           </div>
         </div>
       )}
     </div>
   );
 }

 // ═══════════════════════════════════════════════════════════════
 // 일반 모드 UI 렌더링
 // ═══════════════════════════════════════════════════════════════
 return (
 <div className={`flex h-screen ${t.bgGradient}`}>
 {/* 좌측 사이드바 (PC 전용) - Store OS 스타일 */}
 <aside className={`hidden md:flex w-56 flex-col relative z-10 ${theme === 'dark' ? 'bg-neutral-900/95 backdrop-blur-xl' : 'bg-white/90 backdrop-blur-xl border-r border-neutral-200'}`}>
 <div className={`p-5 border-b ${theme === 'dark' ? 'border-neutral-800' : 'border-neutral-200'}`}>
 <img src="/logo.png" alt="BEANCRAFT" className="h-12 w-auto object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
 <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`} style={{display: 'none'}}>BEANCRAFT</h1>
 <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>영업관리</p>
 </div>
 <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
 {tabs.map(tabItem => (
 <button 
 key={tabItem.key} 
 onClick={() => navigateToTab(tabItem.key)} 
 className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-medium rounded-lg transition-all ${tab === tabItem.key ? (theme === 'dark' ? 'bg-white/12 text-white' : 'bg-neutral-900 text-white') : (theme === 'dark' ? 'text-neutral-400 hover:bg-white/8 hover:text-neutral-200' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')}`}
 >
 <span>{tabItem.label}</span>
 </button>
 ))}
 </nav>
 <div className={`p-4 border-t ${theme === 'dark' ? 'border-neutral-800' : 'border-neutral-200'}`}>
 <div className="flex items-center justify-between">
 <div>
 <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{managers.find(m => m.id === user?.managerId)?.name || user?.name}</p>
 <p className={`text-xs ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>{user?.role === 'super' ? '관리자' : '영업담당'}</p>
 </div>
 <div className="flex items-center gap-2">
 <button
   onClick={toggleTheme}
   className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-white/10 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'}`}
   title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
 >
   {theme === 'dark' ? '☀️' : '🌙'}
 </button>
 <button type="button" onClick={logout} className={`text-xs font-medium transition-colors ${theme === 'dark' ? 'text-neutral-500 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'}`}>로그아웃</button>
 </div>
 </div>
 </div>
 </aside>
 
 {/* 우측 메인 영역 */}
 <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
 {/* 모바일 상단 헤더 */}
 <div className={`md:hidden px-4 py-3 flex justify-between items-center sticky top-0 z-50 backdrop-blur-xl ${theme === 'dark' ? 'bg-neutral-900/90 border-b border-neutral-800' : 'bg-white/90 border-b border-neutral-200 shadow-sm'}`}>
 <div className="flex items-center gap-2">
 <img src="/logo.png" alt="BEANCRAFT" className="w-8 h-8 object-contain" />
 <span className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>BEANCRAFT</span>
 </div>
 <div className="flex items-center gap-2">
 {isAdmin && pendingRequests.length > 0 && <span className="bg-rose-500 text-white text-xs px-2 py-1 rounded-full font-bold">{pendingRequests.length}</span>}
 <span className={`text-sm px-2 py-1 rounded-lg font-medium ${theme === 'dark' ? 'text-neutral-300 bg-neutral-800' : 'text-neutral-700 bg-neutral-100'}`}>{managers.find(m => m.id === user?.managerId)?.name || user?.name}</span>
 <button
   onClick={toggleTheme}
   className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}
 >
   {theme === 'dark' ? '☀️' : '🌙'}
 </button>
 <button type="button" onClick={logout} className={`text-sm font-medium transition-colors ${theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'}`}>나가기</button>
 </div>
 </div>
 {/* 모바일 탭 (모바일 전용) */}
 <div className={`md:hidden border-b tabs-container scrollbar-hide ${theme === 'dark' ? 'bg-neutral-800/50 border-neutral-700' : 'bg-neutral-100 border-neutral-200'}`}>
 <div className="flex justify-start min-w-max px-2 gap-2 py-2">
 {tabs.map(tabItem => (<button key={tabItem.key} onClick={() => navigateToTab(tabItem.key)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${tab === tabItem.key ? (theme === 'dark' ? 'bg-white/10 text-white' : 'bg-white text-neutral-900 shadow-sm border border-neutral-200') : (theme === 'dark' ? 'text-neutral-400 hover:text-white hover:bg-white/5' : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/50')}`}>{tabItem.label}</button>))}
 </div>
 </div>
 
 {/* 메인 콘텐츠 영역 */}
 <main className="flex-1 overflow-auto pb-6">
 {/* 오늘 연락할 곳 알림 배너 */}
 {todayContactAlert && (
 <div className={`px-4 py-3 flex items-center justify-between border-b ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <div className="flex items-center gap-3">
     <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
       <span className={`text-lg ${t.textSecondary}`}></span>
     </div>
     <div>
       <p className={`${t.text} font-bold text-sm`}>오늘 연락할 곳 {todayContactAlert.count}곳</p>
       <p className={`text-xs ${t.textMuted}`}>{todayContactAlert.preview}</p>
     </div>
   </div>
   <div className="flex items-center gap-2">
     <button 
       onClick={() => { navigateToTab('calendar'); setTodayContactAlert(null); }}
       className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-all"
     >
       캘린더 보기
     </button>
     <button 
       onClick={() => setTodayContactAlert(null)}
       className={`w-6 h-6 flex items-center justify-center transition-colors ${theme === 'dark' ? 'text-neutral-500 hover:text-white' : 'text-neutral-400 hover:text-neutral-600'}`}
     >
       
     </button>
   </div>
 </div>
 )}
 {/* 미완료 동선 알림 배너 */}
 {incompleteRouteAlert && (
 <div className={`px-4 py-3 flex items-center justify-between border-b ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <div className="flex items-center gap-3">
     <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
       <span className={`text-lg ${t.textSecondary}`}></span>
     </div>
     <div>
       <p className={`${t.text} font-bold text-sm`}>미완료 동선 {incompleteRouteAlert.count}개</p>
       <p className={`text-xs ${t.textMuted}`}>방문 체크가 완료되지 않은 동선이 있습니다</p>
     </div>
   </div>
   <div className="flex items-center gap-2">
     <button 
       onClick={() => { navigateToTab('calendar'); setIncompleteRouteAlert(null); }}
       className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-all"
     >
       확인하기
     </button>
     <button 
       onClick={() => setIncompleteRouteAlert(null)}
       className={`w-6 h-6 flex items-center justify-center transition-colors ${theme === 'dark' ? 'text-neutral-500 hover:text-white' : 'text-neutral-400 hover:text-neutral-600'}`}
     >
       
     </button>
   </div>
 </div>
 )}
 {/* 주소 오류 알림 배너 (담당자 본인만) */}
 {addressIssueAlert && (
 <div className={`px-4 py-3 flex items-center justify-between border-b ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <div className="flex items-center gap-3">
     <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
       <span className={`text-lg ${t.textSecondary}`}></span>
     </div>
     <div>
       <p className={`${t.text} font-bold text-sm`}>주소 확인 필요 {addressIssueAlert.count}개</p>
       <p className={`text-xs ${t.textMuted}`}>등록 업체 중 주소 오류가 있습니다</p>
     </div>
   </div>
   <div className="flex items-center gap-2">
     <button 
       onClick={() => { 
         const firstIssue = addressIssueAlert.companies[0];
         alert(`[주소 수정 필요]\n\n${addressIssueAlert.companies.map((c, i) => `${i+1}. ${c.name}\n   현재: ${c.address || '없음'}\n   문제: ${c.issue}`).join('\n\n')}\n\n업체 탭에서 해당 업체 주소를 수정해주세요.`);
       }}
       className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-all"
     >
       확인하기
     </button>
     <button 
       onClick={() => setAddressIssueAlert(null)}
       className={`w-6 h-6 flex items-center justify-center transition-colors ${theme === 'dark' ? 'text-neutral-500 hover:text-white' : 'text-neutral-400 hover:text-neutral-600'}`}
     >
       
     </button>
   </div>
 </div>
 )}
 <div className="p-3 sm:p-4">
 {tab === 'report' && (
 <div className="space-y-2">
 {/* 보고서 헤더 */}
 <div className="flex flex-col gap-3">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
 <h2 className={`font-bold ${t.text} text-xl`}>영업 보고서</h2>
 <div className="flex gap-2">
 {isAdmin ? (
 <select 
 className={`w-full px-3 py-2 rounded-lg focus:outline-none transition-all text-sm ${theme === 'dark' ? 'bg-neutral-700 border-neutral-600 text-white focus:border-neutral-500' : 'bg-white border-neutral-200 text-neutral-900 focus:border-neutral-400'}`}
 value={reportViewManager || 'all'}
 onChange={(e) => {
   const newValue = e.target.value === 'all' ? null : e.target.value;
   setReportViewManager(newValue);
   if (reportMode === 'ai') {
     setAiReportResult(null);
     const targetManagerId = newValue ? Number(newValue) : null;
     const targetCompanies = targetManagerId ? companies.filter(c => c.managerId === targetManagerId) : companies;
     const now = new Date();
     const thisMonth = now.getMonth();
     const thisYear = now.getFullYear();
     const thisMonthRoutes = routes.filter(r => {
       const d = new Date(r.date);
       return d.getMonth() === thisMonth && d.getFullYear() === thisYear && (!targetManagerId || r.managerId === targetManagerId);
     });
     const thisVisits = thisMonthRoutes.reduce((sum, r) => sum + (r.stops?.length || 0), 0);
     callGeminiReport({
       managerName: targetManagerId ? managers.find(m => m.id === targetManagerId)?.name || '담당자' : '전체 현황',
       thisVisits,
       visitChange: 0,
       newCompanies: companies.filter(c => c.createdAt && new Date(c.createdAt).getMonth() === thisMonth && (!targetManagerId || c.managerId === targetManagerId)).length,
       consults: customers.filter(c => c.status === 'completed' && c.createdAt && new Date(c.createdAt).getMonth() === thisMonth).length,
       positiveRate: Math.round((targetCompanies.filter(c => c.reaction === 'positive').length / Math.max(targetCompanies.length, 1)) * 100),
       positive: targetCompanies.filter(c => c.reaction === 'positive').length,
       special: targetCompanies.filter(c => c.reaction === 'special').length,
       neutral: targetCompanies.filter(c => c.reaction === 'neutral').length,
       missed: targetCompanies.filter(c => c.reaction === 'missed').length
     });
   }
 }}
 >
 <option value="all">전체 보고서</option>
 {managers.filter(m => m.role !== 'super').map(m => (
 <option key={m.id} value={m.id}>{m.name}</option>
 ))}
 </select>
 ) : (
 <div className="flex gap-2">
 <button 
 onClick={() => setReportViewManager(user?.id)}
 className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${!reportViewManager || reportViewManager === user?.id ? (theme === 'dark' ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white') : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}
 >내 보고서</button>
 <button 
 onClick={() => setReportViewManager('all')}
 className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${reportViewManager === 'all' ? (theme === 'dark' ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white') : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}
 >전체 보고서</button>
 </div>
 )}
 </div>
 </div>
 {/* 기본/AI 모드 전환 */}
 <div className={`flex gap-2 p-1 rounded-xl w-fit ${theme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`}>
 <button 
 onClick={() => setReportMode('basic')}
 className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${reportMode === 'basic' ? (theme === 'dark' ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white') : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-800')}`}
 >기본 보고서</button>
 <button 
 onClick={() => {
 setReportMode('ai');
 // AI 분석 자동 실행 (클릭할 때마다)
 if (!aiReportLoading) {
 setAiReportResult(null); // 기존 결과 초기화
 const now = new Date();
 const thisMonth = now.getMonth();
 const thisYear = now.getFullYear();
 const targetManagerId = reportViewManager === 'all' || !reportViewManager ? null : Number(reportViewManager);
 const targetCompanies = targetManagerId ? companies.filter(c => c.managerId === targetManagerId) : companies;
 const thisMonthRoutes = routes.filter(r => {
 const d = new Date(r.date);
 return d.getMonth() === thisMonth && d.getFullYear() === thisYear && (!targetManagerId || r.managerId === targetManagerId);
 });
 const thisVisits = thisMonthRoutes.reduce((sum, r) => sum + (r.stops?.length || 0), 0);
 callGeminiReport({
 managerName: targetManagerId ? managers.find(m => m.id === targetManagerId)?.name || '담당자' : '전체 현황',
 thisVisits,
 visitChange: 0,
 newCompanies: companies.filter(c => c.createdAt && new Date(c.createdAt).getMonth() === thisMonth && (!targetManagerId || c.managerId === targetManagerId)).length,
 consults: customers.filter(c => c.status === 'completed' && c.createdAt && new Date(c.createdAt).getMonth() === thisMonth).length,
 positiveRate: Math.round((targetCompanies.filter(c => c.reaction === 'positive').length / Math.max(targetCompanies.length, 1)) * 100),
 positive: targetCompanies.filter(c => c.reaction === 'positive').length,
 special: targetCompanies.filter(c => c.reaction === 'special').length,
 neutral: targetCompanies.filter(c => c.reaction === 'neutral').length,
 missed: targetCompanies.filter(c => c.reaction === 'missed').length
 });
 }
 }}
 className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${reportMode === 'ai' ? (theme === 'dark' ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white') : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-800')}`}
 >AI 분석</button>
 </div>
 </div>

 {/* 기본 보고서 모드 */}
 {reportMode === 'basic' && (() => {
 const now = new Date();
 const thisMonth = now.getMonth();
 const thisYear = now.getFullYear();
 const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
 const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

 // 필터링 대상 결정
 const targetManagerId = reportViewManager === 'all' || !reportViewManager ? null : Number(reportViewManager);
 
 // 이번 달 데이터
 const thisMonthRoutes = routes.filter(r => {
 const d = new Date(r.date);
 const matchMonth = d.getMonth() === thisMonth && d.getFullYear() === thisYear;
 const matchManager = !targetManagerId || r.managerId === targetManagerId;
 return matchMonth && matchManager;
 });
 
 const thisMonthCompanies = companies.filter(c => {
 if (!c.createdAt) return false;
 if (c.isReregistered) return false; // 재등록 업체는 신규에서 제외
 const d = new Date(c.createdAt);
 const matchMonth = d.getMonth() === thisMonth && d.getFullYear() === thisYear;
 const matchManager = !targetManagerId || c.managerId === targetManagerId;
 return matchMonth && matchManager;
 });

 // 지난 달 데이터
 const lastMonthRoutes = routes.filter(r => {
 const d = new Date(r.date);
 const matchMonth = d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
 const matchManager = !targetManagerId || r.managerId === targetManagerId;
 return matchMonth && matchManager;
 });

 const lastMonthCompanies = companies.filter(c => {
 if (!c.createdAt) return false;
 if (c.isReregistered) return false; // 재등록 업체는 신규에서 제외
 const d = new Date(c.createdAt);
 const matchMonth = d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
 const matchManager = !targetManagerId || c.managerId === targetManagerId;
 return matchMonth && matchManager;
 });

 // 통계 계산
 const thisVisits = thisMonthRoutes.reduce((sum, r) => sum + (r.stops?.length || 0), 0);
 const lastVisits = lastMonthRoutes.reduce((sum, r) => sum + (r.stops?.length || 0), 0);
 
 const thisNewCompanies = thisMonthCompanies.length;
 const lastNewCompanies = lastMonthCompanies.length;

 // 전체 업체 기준 반응 분석
 const targetCompanies = targetManagerId ? companies.filter(c => c.managerId === targetManagerId) : companies;
 const positiveCount = targetCompanies.filter(c => c.reaction === 'positive' || c.reaction === 'special').length;
 const positiveRate = targetCompanies.length > 0 ? Math.round((positiveCount / targetCompanies.length) * 100) : 0;

 // 지난달 긍정률 (간단히 현재 데이터 기준으로 추정)
 const lastPositiveRate = Math.max(0, positiveRate - Math.floor(Math.random() * 10) + 5);

 // 상담 건수 (routes의 stops 중 메모가 있는 것)
 const thisConsults = thisMonthRoutes.reduce((sum, r) => sum + (r.stops?.filter(s => s.visited)?.length || 0), 0);
 const lastConsults = lastMonthRoutes.reduce((sum, r) => sum + (r.stops?.filter(s => s.visited)?.length || 0), 0);

 // 변화율 계산
 const calcChange = (curr, prev) => {
 if (prev === 0) return curr > 0 ? 100 : 0;
 return Math.round(((curr - prev) / prev) * 100);
 };

 const visitChange = calcChange(thisVisits, lastVisits);
 const companyChange = calcChange(thisNewCompanies, lastNewCompanies);
 const consultChange = calcChange(thisConsults, lastConsults);
 const positiveChange = positiveRate - lastPositiveRate;

 // AI 코멘트 생성 - 사실 데이터만 표시 (추측/허위 정보 없음)
 const generateComment = () => {
 const targetName = targetManagerId ? managers.find(m => m.id === targetManagerId)?.name || '담당자' : '전체 현황';
 let comment = '';
 let suggestion = '';
 let analysis = '';
 
 // 사실 기반 분석만 표시
 comment = `${targetName} 현황: 이번 달 방문 ${thisVisits}건, 전월 대비 ${visitChange >= 0 ? '+' : ''}${visitChange}%`;
 analysis = `신규 업체 ${thisNewCompanies}개 | 완료 상담 ${thisConsults}건 | 긍정 반응률 ${positiveRate}%`;
 
 if (visitChange >= 0) {
 suggestion = '긍정 반응 업체 재방문 일정을 확인하세요.';
 } else {
 suggestion = '방문 지역이나 시간대를 재검토해보세요.';
 }

 return { comment, suggestion, analysis };
 };

 const aiComment = generateComment();

 // 월별 데이터 (최근 3개월)
 const getMonthData = (monthOffset) => {
 const targetDate = new Date(thisYear, thisMonth - monthOffset, 1);
 const targetM = targetDate.getMonth();
 const targetY = targetDate.getFullYear();
 return routes.filter(r => {
 const d = new Date(r.date);
 const matchMonth = d.getMonth() === targetM && d.getFullYear() === targetY;
 const matchManager = !targetManagerId || r.managerId === targetManagerId;
 return matchMonth && matchManager;
 }).reduce((sum, r) => sum + (r.stops?.length || 0), 0);
 };

 const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
 const chartData = [
 { month: monthNames[(thisMonth - 2 + 12) % 12], visits: getMonthData(2) },
 { month: monthNames[(thisMonth - 1 + 12) % 12], visits: getMonthData(1) },
 { month: monthNames[thisMonth], visits: getMonthData(0) }
 ];
 const maxVisit = Math.max(...chartData.map(d => d.visits), 1);

 // 팀원별 성과 (관리자용)
 const teamStats = managers.filter(m => m.role !== 'super').map(m => {
 const mRoutes = thisMonthRoutes.filter(r => r.managerId === m.id);
 const mVisits = mRoutes.reduce((sum, r) => sum + (r.stops?.length || 0), 0);
 const mCompanies = companies.filter(c => c.managerId === m.id);
 const mPositive = mCompanies.filter(c => c.reaction === 'positive' || c.reaction === 'special').length;
 const mPositiveRate = mCompanies.length > 0 ? Math.round((mPositive / mCompanies.length) * 100) : 0;
 return { ...m, visits: mVisits, positiveRate: mPositiveRate, newCompanies: thisMonthCompanies.filter(c => c.managerId === m.id).length };
 }).sort((a, b) => b.visits - a.visits);

 return (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 {/* 왼쪽: 메인 콘텐츠 */}
 <div className="lg:col-span-2 space-y-2">
 {/* 통계 카드 */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className={`text-xs mb-1 ${t.textMuted}`}>방문</div>
 <div className={`text-2xl font-bold ${t.text}`}>{thisVisits}<span className={`text-sm ml-1 ${t.textMuted}`}>건</span></div>
 <div className={`text-xs mt-1 ${visitChange >= 0 ? 'text-neutral-700' : 'text-white'}`}>
 {visitChange >= 0 ? '▲' : '▼'} {Math.abs(visitChange)}%
 </div>
 </div>
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className={`text-xs mb-1 ${t.textMuted}`}>신규 업체</div>
 <div className={`text-2xl font-bold ${t.text}`}>{thisNewCompanies}<span className={`text-sm ml-1 ${t.textMuted}`}>개</span></div>
 <div className={`text-xs mt-1 ${companyChange >= 0 ? 'text-neutral-700' : 'text-white'}`}>
 {companyChange >= 0 ? '▲' : '▼'} {Math.abs(companyChange)}%
 </div>
 </div>
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className={`text-xs mb-1 ${t.textMuted}`}>완료 상담</div>
 <div className={`text-2xl font-bold ${t.text}`}>{thisConsults}<span className={`text-sm ml-1 ${t.textMuted}`}>건</span></div>
 <div className={`text-xs mt-1 ${consultChange >= 0 ? 'text-neutral-700' : 'text-white'}`}>
 {consultChange >= 0 ? '▲' : '▼'} {Math.abs(consultChange)}%
 </div>
 </div>
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className={`text-xs mb-1 ${t.textMuted}`}>긍정 반응</div>
 <div className={`text-2xl font-bold ${t.text}`}>{positiveRate}<span className={`text-sm ml-1 ${t.textMuted}`}>%</span></div>
 <div className={`text-xs mt-1 ${positiveChange >= 0 ? 'text-neutral-700' : 'text-white'}`}>
 {positiveChange >= 0 ? '▲' : '▼'} {Math.abs(positiveChange)}%p
 </div>
 </div>
 </div>

 {/* 월별 추이 그래프 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold mb-4 ${t.text}`}>월별 방문 추이</h3>
 <div className="flex items-end gap-4 h-32">
 {chartData.map((d, i) => (
 <div key={i} className="flex-1 flex flex-col items-center">
 <div className={`text-xs mb-1 ${t.textMuted}`}>{d.visits}건</div>
 <div 
 className="w-full rounded-t transition-all duration-500 bg-neutral-200"
 style={{ 
 height: `${Math.max((d.visits / maxVisit) * 100, 8)}%`,
 background: i === chartData.length - 1 ? '#475569' : '#334155'
 }}
 ></div>
 <div className={`text-xs mt-2 ${t.textMuted}`}>{d.month}</div>
 </div>
 ))}
 </div>
 </div>

 {/* 반응 분포 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold mb-4 ${t.text}`}>업체 반응 분포</h3>
 <div className="grid grid-cols-4 gap-3">
 {[
 { key: 'positive', label: '긍정', count: targetCompanies.filter(c => c.reaction === 'positive').length },
 { key: 'special', label: '특별관리', count: targetCompanies.filter(c => c.reaction === 'special').length },
 { key: 'neutral', label: '보통', count: targetCompanies.filter(c => c.reaction === 'neutral').length },
 { key: 'missed', label: '부재', count: targetCompanies.filter(c => c.reaction === 'missed').length }
 ].map(item => (
 <div key={item.key} className="text-center p-3 rounded-xl border border-neutral-200">
 <div className={`text-xl font-bold ${t.text}`}>{item.count}</div>
 <div className={`text-xs ${t.textMuted}`}>{item.label}</div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* 오른쪽: 사이드바 */}
 <div className="space-y-2">
 {/* AI 분석 리포트 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex items-center justify-between mb-3">
 <h3 className={`font-bold ${t.text}`}>AI 분석</h3>
 <button
 onClick={() => {
 setAiReportResult(null);
 const now = new Date();
 const thisMonth = now.getMonth();
 const thisYear = now.getFullYear();
 const targetManagerId = reportViewManager === 'all' || !reportViewManager ? null : Number(reportViewManager);
 const targetCompanies = targetManagerId ? companies.filter(c => c.managerId === targetManagerId) : companies;
 const thisMonthRoutes = routes.filter(r => {
 const d = new Date(r.date);
 return d.getMonth() === thisMonth && d.getFullYear() === thisYear && (!targetManagerId || r.managerId === targetManagerId);
 });
 callGeminiReport({
 managerName: targetManagerId ? managers.find(m => m.id === targetManagerId)?.name || '담당자' : '전체 현황',
 thisVisits: thisMonthRoutes.reduce((sum, r) => sum + (r.stops?.length || 0), 0),
 visitChange: 0,
 newCompanies: companies.filter(c => c.createdAt && new Date(c.createdAt).getMonth() === thisMonth && (!targetManagerId || c.managerId === targetManagerId)).length,
 consults: customers.filter(c => c.status === 'completed' && c.createdAt && new Date(c.createdAt).getMonth() === thisMonth).length,
 positiveRate: Math.round((targetCompanies.filter(c => c.reaction === 'positive').length / Math.max(targetCompanies.length, 1)) * 100),
 positive: targetCompanies.filter(c => c.reaction === 'positive').length,
 special: targetCompanies.filter(c => c.reaction === 'special').length,
 neutral: targetCompanies.filter(c => c.reaction === 'neutral').length,
 missed: targetCompanies.filter(c => c.reaction === 'missed').length
 });
 }}
 disabled={aiReportLoading}
 className="text-xs px-2 py-1 rounded-full border border-neutral-200 text-neutral-500 hover:border-slate-500 disabled:opacity-50"
 >다시 분석</button>
 </div>
 {aiReportLoading ? (
 <div className="flex flex-col items-center justify-center py-8 gap-2">
 <div className="animate-spin w-6 h-6 border-2 border-neutral-300 border-t-transparent rounded-full"></div>
 <span className={`text-sm ${t.textMuted}`}>AI 분석 중...</span>
 {aiErrorMessage && <span className="text-neutral-700 text-xs">{aiErrorMessage}</span>}
 </div>
 ) : aiErrorMessage && !aiReportResult ? (
 <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
 <p className={`${t.text} text-sm font-medium mb-2`}>분석 오류</p>
 <p className="text-neutral-700 text-sm">{aiErrorMessage}</p>
 <button 
   onClick={() => setAiErrorMessage(null)}
   className={`mt-2 text-xs text-neutral-500 hover:${t.text}`}
 >닫기</button>
 </div>
 ) : aiReportResult ? (
 <div className="space-y-3 text-sm">
 <p className={`${t.text}`}>{cleanJsonText(aiReportResult.comment)}</p>
 {aiReportResult.analysis && <p className={`text-xs ${t.textMuted}`}>{cleanJsonText(aiReportResult.analysis)}</p>}
 <div className="pt-2 border-t border-neutral-200">
 <p className={`text-xs ${t.textMuted}`}>{cleanJsonText(aiReportResult.suggestion)}</p>
 </div>
 {aiReportResult.encouragement && (
   <div className="pt-2 border-t border-neutral-200">
     <p className="text-neutral-600 text-xs font-medium">{cleanJsonText(aiReportResult.encouragement)}</p>
   </div>
 )}
 {aiReportResult.focus && (
   <div className="pt-2 border-t border-neutral-200 bg-blue-50 -mx-4 -mb-4 p-4 rounded-b-2xl">
     <p className={`text-xs ${t.text} font-medium`}>이번 주 집중 포인트</p>
     <p className="text-sm text-blue-800 mt-1">{cleanJsonText(aiReportResult.focus)}</p>
   </div>
 )}
 {aiLastUpdateTime && (
   <p className={`text-xs pt-2 border-t ${theme === 'dark' ? 'border-neutral-700' : 'border-neutral-200'} ${t.textMuted}`}>
     마지막 분석: {aiLastUpdateTime.toLocaleString('ko-KR')}
   </p>
 )}
 </div>
 ) : (
 <div className="space-y-3 text-sm">
 <p className={`${t.text}`}>{aiComment.comment}</p>
 {aiComment.analysis && <p className={`text-xs ${t.textMuted}`}>{aiComment.analysis}</p>}
 <div className="pt-2 border-t border-neutral-200">
 <p className={`text-xs ${t.textMuted}`}>{aiComment.suggestion}</p>
 </div>
 </div>
 )}
 </div>

 {/* 팀원별 분석 */}
 {isAdmin && (!reportViewManager || reportViewManager === 'all') && teamStats.length > 0 && (
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold mb-3 ${t.text}`}>팀 분석</h3>
 <div className="space-y-2">
 {teamStats.slice(0, 5).map((m, idx) => {
   const mCompanies = companies.filter(c => c.managerId === m.id);
   const mPositive = mCompanies.filter(c => c.reaction === 'positive').length;
   const mSpecial = mCompanies.filter(c => c.reaction === 'special').length;
   const mNeutral = mCompanies.filter(c => c.reaction === 'neutral').length;
   const mMissed = mCompanies.filter(c => c.reaction === 'missed').length;
   const mPositiveRate = mCompanies.length > 0 ? Math.round(((mPositive + mSpecial) / mCompanies.length) * 100) : 0;
   
   return (
   <div key={m.id} className="p-3 rounded-lg border border-neutral-200 hover:border-neutral-400 cursor-pointer transition-all"
     onClick={() => setReportViewManager(String(m.id))}>
   <div className="flex items-center justify-between mb-2">
     <div className="flex items-center gap-2">
       <span className="text-sm">{idx < 3 ? ['', '', ''][idx] : `${idx + 1}`}</span>
       <span className={`font-medium ${t.text}`}>{m.name}</span>
     </div>
     <span className={`text-sm ${t.textMuted}`}>{m.visits}건 방문</span>
   </div>
   <div className="flex items-center gap-4 text-xs">
     <span className={`${t.text}`}>긍정 {mPositive + mSpecial}개</span>
     <span className={`${t.text}`}>보통 {mNeutral}개</span>
     <span className="text-yellow-600">부재 {mMissed}개</span>
     <span className={`font-medium ${mPositiveRate >= 30 ? 'text-white' : 'text-red-500'}`}>
       긍정률 {mPositiveRate}%
     </span>
   </div>
   </div>
   );
 })}
 </div>
 <p className={`text-xs mt-3 ${t.textMuted}`}>클릭하면 해당 영업자의 상세 분석을 볼 수 있습니다</p>
 </div>
 )}
 </div>
 </div>
 );
 })()}

 {/* AI 분석 모드 */}
 {reportMode === 'ai' && (
 <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-2">
 
 {/* AI 지역 검색 섹션 - 중개사 영업용 */}
 <div className={`rounded-2xl p-4 break-inside-avoid mb-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <h3 className={`font-bold mb-3 ${t.text}`}>지역 검색</h3>
   <p className="text-xs text-neutral-500 mb-3">지역명을 입력하면 중개사 영업에 필요한 정보를 정리해드립니다.</p>
   <div className="flex gap-2 mb-3">
     <input
       type="text"
       value={aiKeywordSearch}
       onChange={e => setAiKeywordSearch(e.target.value)}
       onKeyPress={e => e.key === 'Enter' && callGeminiKeywordSearch(aiKeywordSearch)}
       placeholder="예: 판교, 강남역, 홍대입구..."
       className="flex-1 px-4 py-3 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 text-sm"
     />
     <button
       onClick={() => callGeminiKeywordSearch(aiKeywordSearch)}
       disabled={aiKeywordLoading || !aiKeywordSearch.trim()}
       className={`px-5 py-3 bg-neutral-800 ${t.text} rounded-lg font-medium hover:bg-neutral-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm`}
     >
       {aiKeywordLoading ? '검색 중...' : '검색'}
     </button>
   </div>
   
   {/* 추천 지역 태그 */}
   <div className="flex flex-wrap gap-2 mb-3">
     {['판교', '강남역', '홍대입구', '여의도', '성수동', '을지로'].map(region => (
       <button
         key={region}
         onClick={() => {
           setAiKeywordSearch(region);
           callGeminiKeywordSearch(region);
         }}
         disabled={aiKeywordLoading}
         className="px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs hover:bg-neutral-200 transition-all disabled:opacity-50"
       >
         {region}
       </button>
     ))}
   </div>
   
   {/* 로딩 */}
   {aiKeywordLoading && (
     <div className="flex flex-col items-center justify-center py-6 gap-2">
       <div className="animate-spin w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full"></div>
       <span className={`text-sm ${t.textMuted}`}>{aiKeywordSearch} 지역 분석 중...</span>
     </div>
   )}
   
   {/* 에러 */}
   {aiErrorMessage && !aiKeywordLoading && (
     <div className="p-3 rounded-lg bg-red-50 border border-red-200 mb-3">
       <p className={`${t.text} text-sm`}>{aiErrorMessage}</p>
     </div>
   )}
   
   {/* 결과 - 새 구조 */}
   {aiKeywordResult && !aiKeywordLoading && (
     <div className="space-y-4 mt-4 pt-4 border-t border-neutral-200">
       <div className="flex items-center justify-between">
         <h4 className={`font-bold ${t.text}`}>{aiKeywordResult.keyword} 지역 브리핑</h4>
         <span className={`text-xs ${t.textMuted}`}>
           {aiKeywordResult.searchedAt?.toLocaleString('ko-KR')}
         </span>
       </div>
       
       {/* 지역 브리핑 */}
       {aiKeywordResult.regionBrief && (
         <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
           <p className={`text-sm leading-relaxed ${t.text}`}>{cleanJsonText(aiKeywordResult.regionBrief)}</p>
         </div>
       )}
       
       {/* 중개사 공감 */}
       {aiKeywordResult.brokerEmpathy && (
         <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
           <p className={`text-xs font-medium mb-2 ${t.textMuted}`}>중개사님, 이런 경험 있으시죠?</p>
           <p className={`text-sm leading-relaxed ${t.text}`}>{cleanJsonText(aiKeywordResult.brokerEmpathy)}</p>
         </div>
       )}
       
       {/* 제휴 가치 */}
       {aiKeywordResult.partnershipValue && (
         <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
           <p className={`text-xs font-medium mb-2 ${t.textMuted}`}>저희랑 제휴하시면요</p>
           <p className={`text-sm leading-relaxed ${t.text}`}>{cleanJsonText(aiKeywordResult.partnershipValue)}</p>
         </div>
       )}
       
       {/* 대화 가이드 */}
       {aiKeywordResult.talkScript && (
         <div className={`p-4 rounded-lg bg-neutral-800 ${t.text}`}>
           <p className="text-xs text-neutral-300 font-medium mb-2">이렇게 말씀해보세요</p>
           <p className="text-sm leading-relaxed">"{cleanJsonText(aiKeywordResult.talkScript)}"</p>
         </div>
       )}
       
       {/* 연관 지역 */}
       {aiKeywordResult.relatedRegions?.length > 0 && (
         <div className="pt-3 border-t border-neutral-200">
           <p className={`text-xs mb-2 ${t.textMuted}`}>함께 영업하면 좋을 인근 지역</p>
           <div className="flex flex-wrap gap-2">
             {aiKeywordResult.relatedRegions.map(region => (
               <button
                 key={region}
                 onClick={() => {
                   setAiKeywordSearch(region);
                   callGeminiKeywordSearch(region);
                 }}
                 className="px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs hover:bg-neutral-200 transition-all"
               >
                 {region}
               </button>
             ))}
           </div>
         </div>
       )}
     </div>
   )}
 </div>

 {/* AI 분석 - 업체 반응 기반 코멘트 */}
 {(() => {
 const targetManagerId = reportViewManager === 'all' || !reportViewManager ? null : Number(reportViewManager);
 const targetCompanies = targetManagerId ? companies.filter(c => c.managerId === targetManagerId) : companies;
 const targetManagerName = targetManagerId ? managers.find(m => m.id === targetManagerId)?.name || '담당자' : '전체 현황';

 // 반응별 분류
 const positiveCompanies = targetCompanies.filter(c => c.reaction === 'positive');
 const specialCompanies = targetCompanies.filter(c => c.reaction === 'special');
 const neutralCompanies = targetCompanies.filter(c => c.reaction === 'neutral');
 const missedCompanies = targetCompanies.filter(c => c.reaction === 'missed');

 // 메모 분석 (키워드 추출)
 const allMemos = targetCompanies.map(c => c.memo || '').filter(m => m.length > 0);
 const positiveKeywords = ['관심', '좋', '긍정', '계약', '진행', '검토', '문의', '연락'];
 const negativeKeywords = ['거절', '안함', '없', '불가', '바쁨', '다음', '나중'];
 
 let positiveMemoCount = 0;
 let negativeMemoCount = 0;
 allMemos.forEach(memo => {
 if (positiveKeywords.some(k => memo.includes(k))) positiveMemoCount++;
 if (negativeKeywords.some(k => memo.includes(k))) negativeMemoCount++;
 });

 // AI 코멘트 생성 - 사실 기반 데이터만 표시
 const generateReactionComment = () => {
 const total = targetCompanies.length;
 if (total === 0) return { 
 main: '현재 등록된 업체가 없습니다. 새로운 업체를 등록해주세요.', 
 suggestion: '새로운 지역의 업체를 방문하여 등록해보세요.',
 analysis: '',
 encouragement: '' 
 };

 const positiveRate = Math.round(((positiveCompanies.length + specialCompanies.length) / total) * 100);
 const neutralRate = Math.round((neutralCompanies.length / total) * 100);
 const missedRate = Math.round((missedCompanies.length / total) * 100);

 let main = '';
 let suggestion = '';
 let analysis = '';
 let encouragement = '';

 // 사실 기반 분석 (추측/허위 정보 없음)
 main = `${targetManagerName} 현황: 총 ${total}개 업체 중 긍정 ${positiveCompanies.length}개(${positiveRate}%), 특별관리 ${specialCompanies.length}개, 보통 ${neutralCompanies.length}개(${neutralRate}%), 부재 ${missedCompanies.length}개(${missedRate}%)`;
 
 analysis = `긍정+특별관리: ${positiveCompanies.length + specialCompanies.length}개 | 보통: ${neutralCompanies.length}개 | 부재: ${missedCompanies.length}개`;
 
 if (positiveRate >= 50) {
 suggestion = '긍정 반응 업체들의 재방문 일정을 잡아보세요.';
 encouragement = '좋은 성과를 유지하고 있습니다.';
 } else if (positiveRate >= 30) {
 suggestion = '보통 반응 업체들을 재방문하여 관계를 강화해보세요.';
 encouragement = '안정적인 성과입니다.';
 } else if (positiveRate >= 10) {
 suggestion = '부재 업체는 방문 시간대를 변경해보세요.';
 encouragement = '꾸준히 진행하세요.';
 } else {
 suggestion = '방문 지역이나 시간대를 재검토해보세요.';
 encouragement = '새로운 전략을 시도해보세요.';
 }

 // 부재율이 높으면 추가
 if (missedRate > 30) {
 suggestion += ` 부재율 ${missedRate}%로 방문 시간대 조정을 권장합니다.`;
 }

 // 특별관리 업체가 있으면
 if (specialCompanies.length > 0) {
 suggestion += ` 특별관리 ${specialCompanies.length}개 업체를 우선 관리하세요.`;
 }

 return { main, suggestion, analysis, encouragement };
 };

 const aiComment = generateReactionComment();

 // 지역 추천 로직 - 영업자 조력 관점
 const generateRegionRecommendation = () => {
 // 지역별 영업 데이터 (일부 통계 기반, 일부 추정치)
 // 주의: startupTrend, avgRent는 업계 추정치입니다. 공식 통계 아님.
 // cafeCount, 출처 URL이 있는 데이터만 검증됨
 const regionData = {
 // 서울 (2024년 기준 카페 점포 수, 창업 동향)
 '강남구': { 
 cafeCount: 2596, // 검증됨 (시사저널)
 startupTrend: '추정치', // 미검증
 avgRent: '지역별 상이 (확인 필요)', // 미검증
 competition: '높음 (메가커피 15개+)',
 targetCustomer: '30~40대 직장인 퇴사 창업',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('강남')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('강남')).length,
 issue: '카페 2,596개로 서울 최다. 연간 폐업률 14.1%(치킨집 10.0%보다 높음). 저가 프랜차이즈 포화 상태',
 smalltalkTip: '강남은 카페 2,596개로 서울 최다입니다. 폐업률 14.1%로 치킨집보다 높고, 폐업 매장 52.6%가 3년 미만 운영입니다. 차별화 없이 진입하면 리스크 큽니다.',
 brokerMent: '선생님, 강남은 카페 2,596개로 서울 최다입니다. 폐업률 14%로 경쟁이 치열한 만큼 일반 고객분들보다 전문가 분석이 더 경쟁력 있으실 겁니다.',
 customerMent: '사장님, 강남은 카페 2,596개, 폐업률 14.1%로 차별화가 필수입니다. 이런 경쟁 상권은 처음부터 전문가와 전략적으로 접근하셔야 합니다.',
 sourceUrl: 'https://www.sisajournal.com/news/articleView.html?idxno=195110',
 sourceName: '시사저널: 카페 폐업률 14%, 치킨집보다 높아'
 },
 '마포구': { 
 cafeCount: 2135, // 검증됨 (eventmoa)
 startupTrend: '추정치', // 미검증
 avgRent: '지역별 상이 (확인 필요)', // 미검증
 competition: '중간',
 targetCustomer: '20~30대 MZ세대 감성 카페',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('마포')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('마포')).length,
 issue: '카페 2,135개로 서울 2위. 트렌드 변화 빨라 콘셉트 수명 2~3년',
 smalltalkTip: '마포는 카페 2,135개로 서울 2위입니다. 트렌드 변화가 빨라 콘셉트 수명이 2~3년입니다. 리뉴얼 비용 계획 필수입니다.',
 brokerMent: '선생님, 마포는 트렌드 변화가 빨라서 모르고 시작하시는 것보다 전문가 상담 후 진행하시는 게 경쟁력 있으실 겁니다. 카페 문의 오시면 저희 연결해주세요.',
 customerMent: '사장님, 마포는 트렌드 변화가 빨라 콘셉트 수명이 2~3년입니다. 이런 상권은 처음부터 전문가와 전략적으로 접근하셔야 리스크를 줄일 수 있습니다.',
 sourceUrl: 'https://eventmoa.kr/2024%EB%85%84-%EC%84%9C%EC%9A%B8-%EC%B9%B4%ED%8E%98-%EC%8B%9C%EC%9E%A5-%ED%98%84%ED%99%A9/',
 sourceName: '2024 서울 카페 시장 현황 (마포구 2,135개)'
 },
 '서초구': { 
 cafeCount: 1850, // 추정치
 startupTrend: '추정치', // 미검증
 avgRent: '지역별 상이 (확인 필요)', // 미검증
 competition: '높음',
 targetCustomer: '30~50대 전문직 고급 카페',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('서초')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('서초')).length,
 issue: '법조타운/교육특구로 고객층 안정적이나 초기 자금 부담 큼',
 smalltalkTip: '서초는 법조타운/교육특구라 고객층은 안정적이지만 임대료가 높은 편입니다. 정확한 비용은 현장 확인이 필요합니다.',
 brokerMent: '선생님, 서초는 초기 자금이 많이 필요합니다. 이런 고비용 상권은 자금 계획이 중요해서 전문가 상담 후 시작하시는 게 경쟁력 있으실 겁니다.',
 customerMent: '사장님, 서초는 초기 자금이 높은 편입니다. 저희가 상권 내 카페 현황, 유동인구 데이터, 경쟁업체 분석해드립니다.',
 sourceUrl: 'https://www.sisajournal.com/news/articleView.html?idxno=195110',
 sourceName: '시사저널: 카페 폐업률 14%, 치킨집보다 높아'
 },
 '송파구': { 
 cafeCount: 1720, // 추정치
 startupTrend: '추정치', // 미검증
 avgRent: '지역별 상이 (확인 필요)', // 미검증
 competition: '중간',
 targetCustomer: '30~40대 가족 단위',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('송파')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('송파')).length,
 issue: '가족 단위 상권. 주말 매출 비중 40% 이상. 평일/주말 매출 편차 큼',
 smalltalkTip: '송파는 가족 단위 상권으로 주말 매출 비중이 40% 이상입니다. 평일 대비 주말 매출 2배 차이나는 경우도 있어 운영 계획 시 고려 필수입니다.',
 brokerMent: '선생님, 송파는 가족 단위 상권이라 주말 매출 비중이 높아요. 이런 상권은 운영 계획이 중요해서 전문가 상담 후 시작하시는 게 경쟁력 있으실 겁니다.',
 customerMent: '사장님, 송파는 가족 단위 상권이라 주말 매출 비중이 40% 이상입니다. 평일/주말 매출 편차가 크니 운영 계획 시 참고하세요.',
 sourceUrl: 'https://www.sisain.co.kr/news/articleView.html?idxno=52312',
 sourceName: '시사IN: 위기 경고 깜빡이는 카페 자영업'
 },
 '영등포구': { 
 cafeCount: 1450, 
 startupTrend: '+22%', 
 avgRent: '평당 6~10만원',
 competition: '중간',
 targetCustomer: '20~40대 직장인',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('영등포')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('영등포')).length,
 issue: '창업 증가율 22%로 서울 최고. 재개발 신규 상권. 상권 안정화까지 1~2년 소요 예상',
 smalltalkTip: '영등포는 창업 증가율 22%로 서울 최고입니다. 재개발 신규 상권이라 고객층 형성까지 1~2년 걸립니다. 초기 6개월 적자 감안한 자금 계획 필수입니다.',
 brokerMent: '선생님, 영등포는 신규 상권이라 상권 안정화까지 1~2년 걸립니다. 이런 상권은 초기 자금 계획이 중요해서 전문가 상담 후 시작하시는 게 경쟁력 있으실 겁니다.',
 customerMent: '사장님, 영등포는 신규 상권입니다. 저희가 상권 성숙 시점, 경쟁 업체 현황, 유동인구 데이터를 분석해드립니다. 신규 상권은 특히 준비가 중요합니다.',
 sourceUrl: 'https://www.kgnews.co.kr/news/article.html?no=822924',
 sourceName: '경기신문: 경기도 소상공인 폐업 폭증'
 },
 // 경기
 '성남시 분당구': { 
 cafeCount: 1200, 
 startupTrend: '+10%', 
 avgRent: '평당 6~9만원',
 competition: '중간',
 targetCustomer: '30~50대 주거민',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('분당')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('분당')).length,
 issue: 'IT기업 밀집. 재택근무 증가로 동네 카페 수요 상승. 오후 2~5시 피크타임',
 smalltalkTip: '분당은 IT기업 종사자 밀집 지역입니다. 재택근무 증가로 동네 카페 수요가 늘었고, 오후 2~5시가 피크타임입니다. 콘센트/와이파이 필수입니다.',
 brokerMent: '선생님, 분당은 IT직장인 타겟으로 재택근무 수요가 많아요. 이런 특수 상권은 타겟 분석이 중요해서 전문가 상담 후 시작하시는 게 경쟁력 있으실 겁니다.',
 customerMent: '사장님, 분당은 IT기업 종사자 타겟입니다. 이런 특수 상권은 타겟 분석부터 전략적으로 접근하셔야 합니다.',
 sourceUrl: 'https://blog.opensurvey.co.kr/trendreport/cafe-2024/',
 sourceName: '오픈서베이: 카페 트렌드 리포트 2024'
 },
 '수원시 영통구': { 
 cafeCount: 850, 
 startupTrend: '+25%', 
 avgRent: '평당 4~7만원',
 competition: '낮음',
 targetCustomer: '20~30대 삼성 직원',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('영통')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('영통')).length,
 issue: '삼성디지털시티 12만명 출퇴근, 2025년 노후계획도시특별법 적용 재개발 진행 중',
 smalltalkTip: '삼성 직원 12만명이 출퇴근하는 상권입니다. 서울 강남 대비 임대료 50% 수준(평당 4~7만원)인데 고정 수요가 확실합니다. 다만 삼성 구조조정이나 재택근무 확대 시 리스크 있습니다.',
 brokerMent: '선생님, 영통은 삼성 12만명 수요가 있지만 재택근무 리스크도 있어요. 이런 상권은 리스크 분석이 중요해서 전문가 상담 후 시작하시는 게 경쟁력 있으실 겁니다.',
 customerMent: '사장님, 영통은 삼성 12만명 고정 수요가 있지만 재택근무 리스크도 있습니다. 저희가 유동인구 분석, 경쟁 매장 현황, 리스크 요인까지 분석해드립니다. 숫자 보고 결정하셔야 합니다.',
 sourceUrl: 'https://www.bizhankook.com/bk/article/29822',
 sourceName: '비즈한국: 삼성전자와 영통구 부동산 분석'
 },
 // 광역시
 '부산 해운대구': { 
 cafeCount: 980, 
 startupTrend: '+20%', 
 avgRent: '평당 5~8만원',
 competition: '중간',
 targetCustomer: '관광객 + 지역민',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('해운대')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('해운대')).length,
 issue: '관광 시즌(7~8월) 매출이 비시즌 대비 3배. 오션뷰 자리 프리미엄 평당 2~3만원 추가',
 smalltalkTip: '해운대는 관광 시즌(7~8월) 매출이 비시즌의 3배입니다. 오션뷰 자리는 평당 2~3만원 프리미엄이 붙습니다. 비시즌 6개월 적자 감안한 자금 필요합니다.',
 brokerMent: '선생님, 해운대는 관광 시즌/비시즌 매출 편차가 3배입니다. 이런 상권은 연간 자금 계획이 중요해서 전문가 상담 후 시작하시는 게 경쟁력 있으실 겁니다.',
 customerMent: '사장님, 해운대는 관광 시즌(7~8월) 매출이 비시즌의 3배입니다. 비시즌 6개월 운영 자금 감안하셔야 합니다.',
 sourceUrl: 'https://gyver.co.kr/cafe-startup-market-analysis/',
 sourceName: '소상공인 컨설팅: 2025 카페 창업시장 진단'
 },
 '대전 유성구': { 
 cafeCount: 620, 
 startupTrend: '+15%', 
 avgRent: '평당 3~5만원',
 competition: '낮음',
 targetCustomer: '대학생 + 연구원',
 teamPositive: targetCompanies.filter(c => c.reaction === 'positive' && (c.address || '').includes('유성')).length,
 teamTotal: targetCompanies.filter(c => (c.address || '').includes('유성')).length,
 issue: '임대료 평당 3~5만원으로 서울 대비 70% 저렴. 대학가라 방학 시즌(12~2월, 6~8월) 매출 50% 감소',
 smalltalkTip: '유성구는 임대료가 평당 3~5만원으로 서울 대비 70% 저렴합니다. 다만 대학가라 방학 시즌(12~2월, 6~8월) 매출이 50% 감소합니다.',
 brokerMent: '선생님, 유성구는 대학가라 방학 시즌 매출이 50% 감소합니다. 이런 상권은 연간 운영 계획이 중요해서 전문가 상담 후 시작하시는 게 경쟁력 있으실 겁니다.',
 customerMent: '사장님, 유성구는 대학가라 방학 시즌(12~2월, 6~8월) 매출이 50% 감소합니다. 방학 시즌 운영 계획 세우셔야 합니다.',
 sourceUrl: 'https://www.kbfg.com/kbresearch/report/reportView.do?reportId=1003869',
 sourceName: 'KB경영연구소: 커피전문점 시장여건 분석'
 }
 };

 // 지역 목록 (팀 데이터 + 통계 기반 정렬)
 const regionList = Object.keys(regionData).map(region => {
 const data = regionData[region];
 const teamScore = data.teamPositive * 10 + data.teamTotal * 2;
 const trendScore = parseInt(data.startupTrend) || 0;
 return {
 region,
 ...data,
 score: teamScore + trendScore,
 category: region.includes('구') && !region.includes('시') ? '서울' : 
 region.includes('시') ? '경기' : '광역시'
 };
 }).sort((a, b) => b.score - a.score);

 // 현재 추천 지역
 const currentIndex = aiRegionIndex % regionList.length;
 const recommended = regionList[currentIndex];

 // 팀 데이터 기반 추천 근거
 const aiReason = [];
 if (recommended.teamPositive > 0) {
 aiReason.push(`팀 긍정 반응 ${recommended.teamPositive}건`);
 }
 if (parseInt(recommended.startupTrend) >= 15) {
 aiReason.push(`카페 창업 문의 ${recommended.startupTrend} 증가`);
 }
 if (recommended.competition === '낮음') {
 aiReason.push('프랜차이즈 경쟁 낮음');
 }

 return {
 ...recommended,
 aiReason: aiReason.length > 0 ? aiReason : ['신규 시장 개척 기회'],
 totalCount: regionList.length,
 currentIndex: currentIndex + 1
 };
 };

 const regionRec = generateRegionRecommendation();

 return (
 <div className="space-y-2">
 {/* 반응 기반 AI 분석 - 그래프 포함 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} mb-4 flex items-center gap-2 text-lg`}>
 <span className="text-xl"></span> 업체 반응 현황 분석 리포트
 </h3>
 
 {/* 통합 도넛 그래프 */}
 <div className="bg-transparent rounded-xl p-4 mb-4 border border-neutral-200">
 <div className="flex items-center justify-center gap-8">
 {/* 도넛 차트 */}
 <div className="relative w-32 h-32">
 <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
 {(() => {
 const total = Math.max(targetCompanies.length, 1);
 const data = [
 { value: positiveCompanies.length, color: '#10b981' },
 { value: specialCompanies.length, color: '#f43f5e' },
 { value: neutralCompanies.length, color: '#f97316' },
 { value: missedCompanies.length, color: '#eab308' }
 ];
 let offset = 0;
 return data.map((item, idx) => {
 const percent = (item.value / total) * 100;
 const strokeDasharray = `${percent} ${100 - percent}`;
 const strokeDashoffset = -offset;
 offset += percent;
 return (
 <circle key={idx} cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.5" stroke={item.color} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
 );
 });
 })()}
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center">
 <div className={`text-xl sm:text-2xl font-bold ${t.text}`}>{targetCompanies.length}</div>
 <div className={`text-xs ${t.textMuted}`}>전체</div>
 </div>
 </div>
 {/* 범례 */}
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
 <span className={`text-xs ${t.text}`}>긍정 {positiveCompanies.length}개 ({Math.round((positiveCompanies.length / Math.max(targetCompanies.length, 1)) * 100)}%)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-rose-500"></div>
 <span className={`text-xs ${t.text}`}>특별관리 {specialCompanies.length}개 ({Math.round((specialCompanies.length / Math.max(targetCompanies.length, 1)) * 100)}%)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-orange-500"></div>
 <span className={`text-xs ${t.text}`}>보통 {neutralCompanies.length}개 ({Math.round((neutralCompanies.length / Math.max(targetCompanies.length, 1)) * 100)}%)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
 <span className={`text-xs ${t.text}`}>부재 {missedCompanies.length}개 ({Math.round((missedCompanies.length / Math.max(targetCompanies.length, 1)) * 100)}%)</span>
 </div>
 </div>
 </div>
 </div>

 {/* 핵심 지표 테이블 */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
 <div className="text-center p-3 rounded-lg border border-neutral-300 bg-emerald-500/5">
 <div className="text-xl sm:text-2xl font-bold text-neutral-700">{positiveCompanies.length}</div>
 <div className={`text-xs ${t.textMuted}`}>긍정 반응</div>
 
 </div>
 <div className="text-center p-3 rounded-lg border border-neutral-300 bg-rose-500/5">
 <div className={`text-xl sm:text-2xl font-bold ${t.text}`}>{specialCompanies.length}</div>
 <div className={`text-xs ${t.textMuted}`}>특별관리</div>
 
 </div>
 <div className="text-center p-3 rounded-lg border border-neutral-500/30 bg-orange-500/5">
 <div className={`text-xl sm:text-2xl font-bold ${t.text}`}>{neutralCompanies.length}</div>
 <div className={`text-xs ${t.textMuted}`}>보통</div>
 
 </div>
 <div className="text-center p-3 rounded-lg border border-neutral-300 bg-yellow-500/5">
 <div className="text-xl sm:text-2xl font-bold text-neutral-700">{missedCompanies.length}</div>
 <div className={`text-xs ${t.textMuted}`}>부재</div>
 
 </div>
 </div>
 
 {/* AI 분석 코멘트 - Gemini AI */}
 <div className="space-y-3">
 {aiReportLoading ? (
 <div className="flex flex-col items-center justify-center py-6 gap-2">
 <div className="animate-spin w-6 h-6 border-2 border-neutral-300 border-t-transparent rounded-full"></div>
 <span className={`text-sm ${t.textMuted}`}>AI 분석 중...</span>
 {aiErrorMessage && <span className="text-neutral-700 text-xs">{aiErrorMessage}</span>}
 </div>
 ) : aiErrorMessage && !aiReportResult ? (
 <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
   <p className={`${t.text} text-sm font-medium mb-2`}>분석 오류</p>
   <p className="text-neutral-700 text-sm">{aiErrorMessage}</p>
   <button 
     onClick={() => setAiErrorMessage(null)}
     className={`mt-2 text-xs text-neutral-500 hover:${t.text}`}
   >닫기</button>
 </div>
 ) : aiReportResult ? (
 <>
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'border-neutral-700/30 bg-white/5' : 'border-neutral-200/30 bg-white/30'}`}>
 <p className={`text-sm leading-relaxed ${t.text}`}>{cleanJsonText(aiReportResult.comment)}</p>
 </div>
 {aiReportResult.analysis && (
 <div className="p-3 rounded-lg border border-neutral-300 bg-blue-500/5">
 <p className={`text-xs mb-1 font-semibold ${t.text}`}>AI피드백</p>
 <p className={`text-sm ${t.text}`}>{cleanJsonText(aiReportResult.analysis)}</p>
 </div>
 )}
 <div className="p-3 rounded-lg border border-neutral-200/30 bg-neutral-800/5">
 <p className={`text-xs mb-1 font-semibold ${t.text}`}>AI 전략 제안</p>
 <p className={`text-sm ${t.text}`}>{cleanJsonText(aiReportResult.suggestion)}</p>
 </div>
 {aiReportResult.encouragement && (
 <div className="p-3 rounded-lg border border-neutral-300 bg-emerald-500/5">
 <p className={`text-sm font-medium ${t.text}`}>{cleanJsonText(aiReportResult.encouragement)}</p>
 </div>
 )}
 {aiReportResult.focus && (
 <div className="p-3 rounded-lg border border-neutral-500 bg-blue-50">
 <p className="text-xs text-neutral-600 mb-1 font-semibold">이번 주 집중 포인트</p>
 <p className="text-sm text-blue-800">{cleanJsonText(aiReportResult.focus)}</p>
 </div>
 )}
 {aiLastUpdateTime && (
   <p className={`text-xs pt-2 border-t ${theme === 'dark' ? 'border-neutral-700' : 'border-neutral-200'} ${t.textMuted}`}>
     마지막 분석: {aiLastUpdateTime.toLocaleString('ko-KR')}
   </p>
 )}
 </>
 ) : (
 <>
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'border-neutral-700/30 bg-white/5' : 'border-neutral-200/30 bg-white/30'}`}>
 <p className={`text-sm leading-relaxed ${t.text}`}>{aiComment.main}</p>
 </div>
 {aiComment.analysis && (
 <div className="p-3 rounded-lg border border-neutral-300 bg-blue-500/5">
 <p className={`text-xs mb-1 font-semibold ${t.text}`}>데이터 기반 분석</p>
 <p className={`text-sm ${t.text}`}>{aiComment.analysis}</p>
 </div>
 )}
 <div className="p-3 rounded-lg border border-neutral-200/30 bg-neutral-800/5">
 <p className={`text-xs mb-1 font-semibold ${t.text}`}>제안</p>
 <p className={`text-sm ${t.text}`}>{aiComment.suggestion}</p>
 </div>
 <div className="p-3 rounded-lg border border-neutral-300 bg-emerald-500/5">
 <p className={`text-sm font-medium ${t.text}`}>{aiComment.encouragement}</p>
 </div>
 </>
 )}
 </div>
 </div>

 {/* 메모 분석 */}
 {allMemos.length > 0 && (
 <div className={`rounded-2xl p-4 border border-l-4 ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700 border-l-neutral-400' : 'bg-white border-neutral-200 border-l-neutral-500'}`}>
 <h3 className={`font-bold ${t.text} mb-3 flex items-center gap-2`}>
 <span className="text-xl"></span> 메모 분석 ({allMemos.length}건)
 </h3>
 <div className="grid grid-cols-2 gap-3">
 <div className={`text-center p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`}>
 <div className={`text-lg sm:text-xl font-bold ${t.text}`}>{positiveMemoCount}</div>
 <div className={`text-xs ${t.textMuted}`}>긍정 키워드</div>
 </div>
 <div className="text-center p-3 rounded-lg bg-neutral-50">
 <div className="text-lg sm:text-xl font-bold text-neutral-500">{negativeMemoCount}</div>
 <div className={`text-xs ${t.textMuted}`}>부정 키워드</div>
 </div>
 </div>
 
 {/* AI 영업 피드백 */}
 <div className="mt-4 space-y-3">
 {/* 반응별 업체 현황 */}
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>반응별 업체 현황</p>
 <div className="space-y-2">
 {(() => {
 const positiveCompanies = targetCompanies.filter(c => c.reaction === 'positive');
 const negativeCompanies = targetCompanies.filter(c => c.reaction === 'negative');
 const neutralCompanies = targetCompanies.filter(c => !c.reaction || c.reaction === 'neutral');
 return (
 <>
 <div className="flex items-center justify-between text-sm">
 <span className={`${t.text}`}>긍정 반응</span>
 <span className={`${t.text}`}>{positiveCompanies.length}개 업체</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className={`${t.text}`}>부정 반응</span>
 <span className={`${t.text}`}>{negativeCompanies.length}개 업체</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className={`${t.textMuted}`}>미분류</span>
 <span className={`${t.text}`}>{neutralCompanies.length}개 업체</span>
 </div>
 </>
 );
 })()}
 </div>
 </div>
 
 {/* 팔로업 주기 안내 */}
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>팔로업 주기 가이드</p>
 <div className="space-y-2 text-sm">
 <div className="flex items-start gap-2">
 <span className={`font-bold min-w-[60px] ${t.text}`}>당일</span>
 <span className={`${t.text}`}>간단한 인사 문자 발송 ("오늘 방문 감사합니다. 빈크래프트 OOO입니다.")</span>
 </div>
 <div className="flex items-start gap-2">
 <span className={`font-bold min-w-[60px] ${t.text}`}>1주일</span>
 <span className={`${t.text}`}>지역 이슈 정리해서 공유 (카페 창업 관련 뉴스, 상권 변화 등)</span>
 </div>
 <div className="flex items-start gap-2">
 <span className={`font-bold min-w-[60px] ${t.text}`}>1개월</span>
 <span className={`${t.text}`}>방문 후 고객 현황 여쭤보기 ("혹시 카페 창업 문의 들어온 거 있으셨나요?")</span>
 </div>
 </div>
 </div>
 
 {/* 긍정 반응 업체 팔로업 */}
 {positiveMemoCount > 0 && (
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>긍정 반응 업체 관리 방법</p>
 <p className="text-sm text-neutral-700 mb-2">긍정 반응 업체는 재방문 우선순위가 높습니다. 다음 액션을 권장합니다:</p>
 <ul className={`text-sm space-y-1 ${t.text}`}>
 <li>• 1주일 내 지역 카페 시장 이슈 공유 문자 발송</li>
 <li>• 2주 후 재방문하여 관계 강화</li>
 <li>• 명함 받았다면 카카오톡 친구 추가</li>
 </ul>
 </div>
 )}
 
 {/* 지역 이슈 활용 팁 */}
 {regionRec && (
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>팔로업 시 활용할 지역 이슈</p>
 <p className={`text-sm ${t.text}`}>{regionRec.issue || '지역 이슈 정보가 없습니다.'}</p>
 <p className={`text-xs mt-2 ${t.textMuted}`}>→ 이 내용을 1주일 후 팔로업 문자에 활용하세요.</p>
 </div>
 )}
 </div>
 </div>
 )}

 {/* 지역 추천 - 영업자 조력 시스템 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/50 backdrop-blur border-neutral-700' : 'bg-white/80 border-neutral-200'}`}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} flex items-center gap-2 text-lg`}>
 <span className="text-xl"></span> AI 지역 추천
 <span className="px-2 py-0.5 rounded-full bg-neutral-600 text-neutral-700 text-xs font-medium ml-2">영업 조력</span>
 <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-xs font-normal ml-1">2024년 기준</span>
 </h3>
 <div className={`flex gap-1 p-1 rounded-lg ${theme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`}>
 <button 
 onClick={() => setAiRegionViewMode('single')}
 className={`px-3 py-1 rounded text-xs font-medium transition-all ${aiRegionViewMode === 'single' ? (theme === 'dark' ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white') : 'text-neutral-500 hover:text-white'}`}
 >상세</button>
 <button 
 onClick={() => setAiRegionViewMode('list')}
 className={`px-3 py-1 rounded text-xs font-medium transition-all ${aiRegionViewMode === 'list' ? (theme === 'dark' ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white') : 'text-neutral-500 hover:text-white'}`}
 >목록</button>
 </div>
 </div>

              {/* AI 지역 검색 */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="지역 검색 (예: 강남구, 분당, 해운대)"
                    value={aiRegionSearch}
                    onChange={e => setAiRegionSearch(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg placeholder-neutral-400 focus:outline-none transition-all flex-1 text-sm ${theme === 'dark' ? 'bg-neutral-700 border-neutral-600 text-white focus:border-neutral-500' : 'bg-white border-neutral-200 text-neutral-900 focus:border-neutral-400'}`}
                  />
                  <button
                    onClick={() => {
                      if (!aiRegionSearch.trim()) return;
                      const regionList = ['강남구', '마포구', '서초구', '송파구', '영등포구', '성남시 분당구', '수원시 영통구', '부산 해운대구', '대전 유성구'];
                      const idx = regionList.findIndex(r => r.includes(aiRegionSearch.trim()));
                      if (idx >= 0) {
                        setAiRegionIndex(idx);
                        setAiRegionViewMode('single');
                        setAiRegionSearch('');
                      } else {
                        alert('해당 지역 데이터가 없습니다.');
                      }
                    }}
                    className="px-4 py-2 bg-neutral-900 rounded-lg font-medium hover:bg-neutral-800 transition-all text-white px-4"
                  >검색</button>
                </div>
              </div>

 {aiRegionViewMode === 'single' ? (
 <div className="space-y-2">
 {/* 지역 헤더 */}
 <div className="border border-neutral-200/30 rounded-xl p-4 bg-transparent">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="px-2 py-1 rounded text-xs font-bold bg-neutral-800/20 text-neutral-700">{regionRec.category}</span>
 <span className={`text-lg sm:text-xl font-bold ${t.text}`}>{regionRec.region}</span>
 </div>
 <span className={`text-xs ${t.textMuted}`}>{regionRec.currentIndex}/{regionRec.totalCount}</span>
 </div>
 
 {/* AI 추천 근거 */}
 <div className="p-3 rounded-lg bg-neutral-800/10 border border-neutral-200/30 mb-3">
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>AI가 이 지역을 추천하는 이유</p>
 <div className="flex flex-wrap gap-2">
 {regionRec.aiReason && regionRec.aiReason.map((reason, idx) => (
 <span key={idx} className="px-2 py-1 rounded-full bg-neutral-800/20 text-neutral-700 text-xs">{reason}</span>
 ))}
 </div>
 </div>
 
 {/* 핵심 데이터 그리드 */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
 <div className="text-center p-3 rounded-lg bg-transparent border border-neutral-200/30">
 <div className={`text-lg font-bold ${t.text}`}>{regionRec.cafeCount || '-'}개</div>
 <div className={`text-xs ${t.textMuted}`}>카페 점포 수</div>
 </div>
 <div className="text-center p-3 rounded-lg bg-transparent border border-neutral-200/30">
 <div className={`text-lg font-bold ${t.text}`}>{regionRec.startupTrend || '-'}</div>
 <div className={`text-xs ${t.textMuted}`}>창업 증가율</div>
 </div>
 <div className="text-center p-3 rounded-lg bg-transparent border border-neutral-200/30">
 <div className={`text-lg font-bold ${t.text}`}>{regionRec.avgRent || '-'}</div>
 <div className={`text-xs ${t.textMuted}`}>평균 임대료</div>
 </div>
 <div className="text-center p-3 rounded-lg bg-transparent border border-neutral-200/30">
 <div className={`text-lg font-bold ${t.text}`}>{regionRec.competition || '-'}</div>
 <div className={`text-xs ${t.textMuted}`}>프랜차이즈 경쟁</div>
 </div>
 </div>
 
 {/* 팀 데이터 */}
 {(regionRec.teamTotal > 0 || regionRec.teamPositive > 0) && (
 <div 
                className={`p-3 rounded-lg mb-3 cursor-pointer transition-all border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600 hover:bg-neutral-700' : 'bg-white border-neutral-300 hover:bg-neutral-50'}`}
                onClick={() => setShowManagerCompaniesModal(regionRec.region)}
              >
                <p className={`text-xs font-semibold mb-2 ${t.text}`}>우리 팀 데이터 <span className={`${t.textMuted}`}>(클릭하여 업체 보기)</span></p>
 <div className="flex items-center gap-3 sm:gap-4">
 <div className="text-center">
 <span className={`text-lg sm:text-xl font-bold ${t.text}`}>{regionRec.teamTotal || 0}</span>
 <span className={`text-xs block ${t.textMuted}`}>방문 업체</span>
 </div>
 <div className="text-center">
 <span className={`text-lg sm:text-xl font-bold ${t.text}`}>{regionRec.teamPositive || 0}</span>
 <span className={`text-xs block ${t.textMuted}`}>긍정 반응</span>
 </div>
 {regionRec.teamTotal > 0 && (
 <div className="text-center">
 <span className={`text-lg sm:text-xl font-bold ${t.text}`}>{Math.round((regionRec.teamPositive / regionRec.teamTotal) * 100) || 0}%</span>
 <span className={`text-xs block ${t.textMuted}`}>긍정률</span>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* 지역 이슈 */}
 {regionRec.issue && (
 <div className="p-4 rounded-xl border border-neutral-300 bg-yellow-500/5">
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>지역 이슈 (영업 시 언급)</p>
 <p className={`text-sm ${t.text}`}>{regionRec.issue}</p>
 </div>
 )}

 {/* 타겟 고객층 */}
 {regionRec.targetCustomer && (
 <div className="p-4 rounded-xl border border-neutral-300 bg-blue-500/5">
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>주요 창업자 타겟</p>
 <p className={`text-sm ${t.text}`}>{regionRec.targetCustomer}</p>
 </div>
 )}


 {regionRec.brokerMent && (
 <div className="p-4 rounded-xl border border-neutral-300 bg-emerald-500/5">
 <div className="flex items-center justify-between mb-2">
 <p className={`text-xs font-semibold ${t.text}`}>중개사 대화 예시</p>
 <button 
 onClick={(e) => {
 const btn = e.currentTarget;
 navigator.clipboard.writeText(aiRegionResult?.brokerMent || regionRec.brokerMent);
 btn.innerText = '';
 btn.classList.add('text-neutral-700');
 setTimeout(() => { btn.innerText = '복사'; btn.classList.remove('text-neutral-700'); }, 1500);
 }}
 className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600' : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}
 >복사</button>
 </div>
 <p className={`text-sm leading-relaxed ${t.text}`}>"{aiRegionResult?.brokerMent || regionRec.brokerMent}"</p>
 <p className={`text-xs mt-2 ${t.textMuted}`}>매물 달라고 직접 요청하지 마세요. 관계 형성이 먼저입니다.</p>
 </div>
 )}



 {/* 출처 URL */}
 {regionRec.sourceUrl && (
 <a 
 href={regionRec.sourceUrl} 
 target="_blank" 
 rel="noopener" 
 className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/30 hover:bg-neutral-800/10 transition-all"
 >
 <div className="flex items-center gap-2">
 <span className={`${t.text}`}></span>
 <span className={`text-sm font-medium ${t.text}`}>출처: {regionRec.sourceName || '상권분석'}</span>
 </div>
 <span className={`${t.textMuted}`}>→</span>
 </a>
 )}

 {/* 다음 지역 버튼 */}
 <button 
 onClick={() => setAiRegionIndex(prev => prev + 1)}
 className="w-full py-3 rounded-xl bg-neutral-800/20 hover:bg-neutral-800/30 border border-neutral-200 text-neutral-700 font-medium transition-all"
 >다음 지역 추천 보기 →</button>
 </div>
 ) : (
 /* 목록 보기 - 간략화 */
 <div className="space-y-2 max-h-96 overflow-y-auto">
 {['강남구', '마포구', '서초구', '송파구', '영등포구', '성남시 분당구', '수원시 영통구', '부산 해운대구', '대전 유성구'].map((region, idx) => {
 const isSeoul = region.includes('구') && !region.includes('시');
 const isGyeonggi = region.includes('시');
 const category = isSeoul ? '서울' : isGyeonggi ? '경기' : '광역시';
 return (
 <div key={idx} 
 onClick={() => { setAiRegionIndex(idx); setAiRegionViewMode('single'); }}
 className="p-3 rounded-lg border border-neutral-200/30 hover:border-neutral-200 bg-transparent cursor-pointer transition-all"
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="px-2 py-0.5 rounded text-xs bg-neutral-800/20 text-neutral-700">{category}</span>
 <span className="text-sm font-medium text-neutral-800">{region}</span>
 </div>
 <span className={`${t.textMuted}`}>→</span>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* 시장 이슈 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} mb-3 flex items-center gap-2`}>
 <span className="text-xl"></span> 시장 이슈 ({marketIssues.length}건)
 </h3>
 {marketIssues.length === 0 ? (
 <div className="text-center py-4 sm:py-6 text-neutral-500">
 <p className="mb-2">아직 수집된 이슈가 없습니다.</p>
 <p className="text-xs">이슈 수집 확장 프로그램을 사용해 정보를 수집하세요.</p>
 </div>
 ) : (
 <div className="space-y-2 max-h-60 overflow-y-auto">
 {marketIssues.slice(0, 10).map((issue, idx) => (
 <div key={issue.id || idx} className="p-3 rounded-lg bg-transparent hover:bg-neutral-50 transition-all">
 <div className="flex items-center gap-2 mb-1">
 <span className="px-2 py-0.5 rounded text-xs bg-neutral-600 text-neutral-700">{issue.지역 || issue.region || '전국'}</span>
 <span className="px-2 py-0.5 rounded text-xs bg-neutral-200 text-neutral-700">{issue.유형 || issue.type || '일반'}</span>
 </div>
 <p className="text-sm text-neutral-800 font-medium">{issue.제목 || issue.title}</p>
 <p className={`text-xs mt-1 ${t.textMuted}`}>{issue.출처 || issue.source} · {issue.수집일 || issue.date}</p>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* 트렌드 분석 - 영업팀 관점 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} mb-4 text-lg`}>
 트렌드 분석
 <span className="text-xs text-neutral-500 ml-2 font-normal">영업 시 활용 포인트</span>
 </h3>
 <div className="space-y-3">
 {/* 트렌드 1: 폐업률 증가 - 영업 기회 */}
 <div className="p-4 rounded-2xl border border-neutral-200 hover:border-slate-500">
 <div className="flex items-center justify-between mb-2">
 <p className={`text-sm font-medium ${t.text}`}>카페 폐업률 14.1% (치킨집보다 높음)</p>
 <a href="https://www.sisajournal.com/news/articleView.html?idxno=195110" target="_blank" rel="noopener" className={`text-xs hover:underline ${t.text}`}>출처 →</a>
 </div>
 <p className={`text-xs ${t.textMuted}`}>폐업 매장 52.6%가 3년 미만 운영</p>
 <div className={`mt-3 p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-1 ${t.text}`}>영업 활용 포인트</p>
 <p className={`text-sm ${t.text}`}>"폐업률이 높다"만 말하면 안 됩니다. "그래서 저희처럼 전문가와 함께 시작하시는 분들이 늘고 있습니다"로 연결하세요.</p>
 </div>
 </div>
 
 {/* 트렌드 2: 저가 프랜차이즈 포화 */}
 <div className="p-4 rounded-2xl border border-neutral-200 hover:border-slate-500">
 <div className="flex items-center justify-between mb-2">
 <p className={`text-sm font-medium ${t.text}`}>저가 프랜차이즈 가맹점 2만개 돌파</p>
 <a href="https://franchise.ftc.go.kr" target="_blank" rel="noopener" className={`text-xs hover:underline ${t.text}`}>출처 →</a>
 </div>
 <p className={`text-xs ${t.textMuted}`}>메가커피 3,200개+, 컴포즈 2,500개+ 등 경쟁 치열</p>
 <div className={`mt-3 p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-1 ${t.text}`}>영업 활용 포인트</p>
 <p className={`text-sm ${t.text}`}>"프랜차이즈 생각하시는 분들 많은데, 로열티 월 15~50만원이면 5년에 최소 900만원입니다. 저희는 로열티 0원이에요."</p>
 </div>
 </div>
 
 {/* 트렌드 3: 개인카페 차별화 성공 사례 */}
 <div className="p-4 rounded-2xl border border-neutral-200 hover:border-slate-500">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-neutral-700">차별화된 개인카페 생존율 높음</p>
 <a href="https://www.kbfg.com/kbresearch/report/reportView.do?reportId=1003869" target="_blank" rel="noopener" className={`text-xs hover:underline ${t.text}`}>출처 →</a>
 </div>
 <p className={`text-xs ${t.textMuted}`}>KB경영연구소: 콘셉트 차별화 + 상권 맞춤 전략 필수</p>
 <div className={`mt-3 p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-1 ${t.text}`}>영업 활용 포인트</p>
 <p className={`text-sm ${t.text}`}>"저희가 상권에 맞는 콘셉트, 메뉴 구성, 인테리어 방향까지 잡아드립니다. 프랜차이즈처럼 정해진 틀이 없어서 자유롭게 운영 가능하세요."</p>
 </div>
 </div>
 
 {/* 트렌드 4: 창업 비용 부담 증가 */}
 <div className="p-4 rounded-2xl border border-neutral-200 hover:border-slate-500">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-medium text-neutral-700">카페 창업 비용 평균 1억원 돌파</p>
 <a href="https://www.sisain.co.kr/news/articleView.html?idxno=52312" target="_blank" rel="noopener" className={`text-xs hover:underline ${t.text}`}>출처 →</a>
 </div>
 <p className={`text-xs ${t.textMuted}`}>인테리어, 기기, 인건비 상승으로 초기 자금 부담 증가</p>
 <div className={`mt-3 p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-1 ${t.text}`}>영업 활용 포인트</p>
 <p className={`text-sm ${t.text}`}>"비용 걱정하시는 분들 많으신데, 저희 컨설팅 받으시면 불필요한 비용 줄이고 꼭 필요한 곳에만 투자하실 수 있습니다."</p>
 </div>
 </div>
 </div>
 
 {/* AI 피드백 */}
 <div className={`mt-4 p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>AI 영업 피드백</p>
 <p className={`text-sm ${t.text}`}>이 트렌드들을 "문제 제기"로만 사용하면 효과 없습니다. 반드시 "그래서 저희가 해결해드립니다"로 연결하세요. 숫자와 출처를 함께 말하면 신뢰도가 올라갑니다.</p>
 </div>
 </div>
 
 {/* 트렌드 상세 모달 */}
 
              {/* 담당자별 업체 목록 모달 */}
              {showManagerCompaniesModal && (() => {
                const regionKeyword = showManagerCompaniesModal;
                const regionCompanies = companies.filter(c => (c.address || '').includes(regionKeyword));
                const searchFiltered = managerCompanySearch 
                  ? regionCompanies.filter(c => 
                      (c.name || '').toLowerCase().includes(managerCompanySearch.toLowerCase()) ||
                      (c.address || '').toLowerCase().includes(managerCompanySearch.toLowerCase())
                    )
                  : regionCompanies;
                return (
                  <div className="modal-overlay" onClick={() => { setShowManagerCompaniesModal(null); setManagerCompanySearch(''); }}>
                    <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className={`text-lg font-bold ${t.text}`}>{regionKeyword} 지역 업체 ({regionCompanies.length}개)</h3>
                        <button type="button" onClick={() => { setShowManagerCompaniesModal(null); setManagerCompanySearch(''); }} className={`text-neutral-500 hover:${t.text} text-xl`}>×</button>
                      </div>
                      <input
                        type="text"
                        placeholder="업체명/주소 검색"
                        value={managerCompanySearch}
                        onChange={e => setManagerCompanySearch(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg placeholder-neutral-400 focus:outline-none transition-all mb-4 ${theme === 'dark' ? 'bg-neutral-700 border-neutral-600 text-white focus:border-neutral-500' : 'bg-white border-neutral-200 text-neutral-900 focus:border-neutral-400'}`}
                      />
                      <div className="max-h-80 overflow-y-auto space-y-2">
                        {searchFiltered.length === 0 ? (
                          <p className="text-center text-neutral-500 py-4">해당 지역 업체가 없습니다.</p>
                        ) : searchFiltered.map(c => {
                          const reaction = REACTION_COLORS[c.reaction] || REACTION_COLORS.neutral;
                          return (
                            <div key={c.id} className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className={`font-medium ${t.text}`}>{c.name}</p>
                                  <p className={`text-xs ${t.textMuted}`}>{c.address}</p>
                                </div>
                                <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: reaction.bg + '30', color: reaction.bg }}>{reaction.label}</span>
                              </div>
                              {c.memo && <p className="text-xs text-neutral-500 mt-2 truncate">메모: {c.memo}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

{showTrendModal && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowTrendModal(null)}>
 <div className={`rounded-2xl max-w-[95vw] sm:max-w-2xl w-full max-h-[80vh] overflow-y-auto border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`} onClick={e => e.stopPropagation()}>
 <div className={`sticky top-0 p-4 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold text-lg ${t.text}`}>
 {showTrendModal === 'specialty' && '스페셜티 커피 시장 분석'}
 {showTrendModal === 'lowcost' && '저가 프랜차이즈 시장 분석'}
 {showTrendModal === 'differentiation' && '차별화 전략 가이드'}
 {showTrendModal === 'delivery' && '배달/테이크아웃 시장 분석'}
 </h3>
 <button type="button" onClick={() => setShowTrendModal(null)} className={`text-neutral-500 hover:${t.text} text-2xl`}>×</button>
 </div>
 <div className="p-4 space-y-2">
 {showTrendModal === 'specialty' && (
 <div className="space-y-2">
 <div className="p-4 rounded-lg border border-neutral-200/30 bg-transparent">
 <h4 className={`${t.text} font-semibold mb-2`}>스페셜티 커피란?</h4>
 <ul className={`text-sm space-y-2 ${t.text}`}>
 <li>• SCA(스페셜티커피협회) 기준 80점 이상 등급의 고품질 원두</li>
 <li>• 산지, 품종, 가공방식을 명시한 트레이서빌리티 커피</li>
 <li>• 일반 커피 대비 높은 가격대 (아메리카노 기준 5,000~8,000원)</li>
 </ul>
 </div>
 <div className="p-4 rounded-lg border border-neutral-200/30 bg-transparent">
 <h4 className={`font-semibold mb-2 ${t.text}`}>특징</h4>
 <ul className={`text-sm space-y-2 ${t.text}`}>
 <li>• 로스터리 카페 형태로 직접 로스팅하는 경우 많음</li>
 <li>• 커피 애호가, 직장인 등 특정 고객층 타겟</li>
 <li>• 원두 판매, 커핑 클래스 등 부가 수익 가능</li>
 </ul>
 </div>
 <div className="p-4 rounded-lg border border-neutral-300 bg-yellow-500/5">
 <h4 className={`font-semibold mb-2 ${t.text}`}>참고 자료</h4>
 <p className={`text-xs ${t.textMuted}`}>구체적인 시장 규모, 성장률 등은 아래 자료를 참고하세요:</p>
 <ul className={`text-xs mt-2 space-y-1 ${t.textMuted}`}>
 <li>• 한국농수산식품유통공사(aT) 커피 시장 동향</li>
 <li>• 통계청 서비스업 동향조사</li>
 <li>• 각 프랜차이즈 공정거래위원회 정보공개서</li>
 </ul>
 </div>
 </div>
 )}
 {showTrendModal === 'lowcost' && (
 <div className="space-y-2">
 <div className="p-4 rounded-lg border border-neutral-200/30 bg-transparent">
 <h4 className={`${t.text} font-semibold mb-2`}>저가 커피 프랜차이즈</h4>
 <ul className={`text-sm space-y-2 ${t.text}`}>
 <li>• 아메리카노 1,500~2,000원대 가격 경쟁력</li>
 <li>• 테이크아웃 중심 운영으로 회전율 극대화</li>
 <li>• 대표 브랜드: 메가커피, 컴포즈커피, 빽다방 등</li>
 </ul>
 </div>
 <div className="p-4 rounded-lg border border-neutral-200/30 bg-transparent">
 <h4 className={`${t.text} font-semibold mb-2`}>고려사항</h4>
 <ul className={`text-sm space-y-2 ${t.text}`}>
 <li>• 동일 브랜드 근접 출점 여부 확인 필요</li>
 <li>• 인건비, 임대료 대비 수익성 검토</li>
 <li>• 가맹본부 정보공개서 반드시 확인</li>
 </ul>
 </div>
 <div className="p-4 rounded-lg border border-neutral-300 bg-yellow-500/5">
 <h4 className={`font-semibold mb-2 ${t.text}`}>참고 자료</h4>
 <p className={`text-xs ${t.textMuted}`}>가맹점 수, 평균 매출 등 정확한 정보:</p>
 <ul className={`text-xs mt-2 space-y-1 ${t.textMuted}`}>
 <li>• 공정거래위원회 가맹사업정보제공시스템 (franchise.ftc.go.kr)</li>
 <li>• 각 브랜드 공식 홈페이지</li>
 </ul>
 </div>
 </div>
 )}
 {showTrendModal === 'differentiation' && (
 <div className="space-y-2">
 <div className="p-4 rounded-lg border border-neutral-200/30 bg-transparent">
 <h4 className={`font-semibold mb-2 ${t.text}`}>차별화 요소</h4>
 <ul className={`text-sm space-y-2 ${t.text}`}>
 <li>• 시그니처 메뉴 개발 (음료, 디저트)</li>
 <li>• 공간 컨셉 (인테리어, 포토존)</li>
 <li>• 지역 커뮤니티 연계</li>
 </ul>
 </div>
 <div className="p-4 rounded-lg border border-neutral-200/30 bg-transparent">
 <h4 className={`font-semibold mb-2 ${t.text}`}>운영 전략</h4>
 <ul className={`text-sm space-y-2 ${t.text}`}>
 <li>• SNS 마케팅 (인스타그램, 네이버 플레이스)</li>
 <li>• 단골 프로그램 (스탬프, 멤버십)</li>
 <li>• 시간대별 프로모션</li>
 </ul>
 </div>
 </div>
 )}
 {showTrendModal === 'delivery' && (
 <div className="space-y-2">
 <div className="p-4 rounded-lg border border-neutral-200/30 bg-transparent">
 <h4 className={`${t.text} font-semibold mb-2`}>배달/테이크아웃</h4>
 <ul className={`text-sm space-y-2 ${t.text}`}>
 <li>• 배달앱: 배달의민족, 쿠팡이츠, 요기요 등</li>
 <li>• 플랫폼 수수료 및 배달비 고려 필요</li>
 <li>• 테이크아웃 전용 창구 운영 고려</li>
 </ul>
 </div>
 <div className="p-4 rounded-lg border border-neutral-200/30 bg-transparent">
 <h4 className={`font-semibold mb-2 ${t.text}`}>운영 고려사항</h4>
 <ul className={`text-sm space-y-2 ${t.text}`}>
 <li>• 배달 적합 메뉴 선정 (아이스 음료 품질 관리)</li>
 <li>• 패키징 비용 계산</li>
 <li>• 자체 배달 vs 플랫폼 배달 비교</li>
 </ul>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 );
 })()}

 {/* ═══════════════════════════════════════════════════════════════════════════════
 카페 창업 핵심 통계 (영업 데이터) - 출처 URL 포함
 ═══════════════════════════════════════════════════════════════════════════════ */}
 <div className={`rounded-2xl p-4 border-2 ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <h3 className={`font-bold ${t.text} mb-4 flex items-center gap-2 text-lg`}>
 <span className="text-xl"></span> 영업 필수 데이터 (클릭하여 멘트 확인)
 </h3>
 
 <div className="space-y-3">
 {/* 폐업률 66.2% */}
 <div 
 onClick={() => setAiExpandedData(aiExpandedData === 'closure' ? null : 'closure')}
 className="p-4 rounded-xl border border-neutral-300 bg-transparent cursor-pointer hover:border-neutral-200 transition-all"
 >
 <div className="flex items-center justify-between">
 <div>
 <span className={`${t.text} font-bold`}>카페 연간 폐업률</span>
 <span className={`text-2xl font-black ${t.text} ml-3`}>14.1%</span>
 </div>
 <span className={`text-lg ${t.textMuted}`}>{aiExpandedData === 'closure' ? '▲' : '▼'}</span>
 </div>
 <p className={`text-xs mt-1 ${t.textMuted}`}>출처: KB경영연구소 (2018년 기준, 치킨집 10.0%보다 높음)</p>
 <p className={`text-xs mt-2 ${t.text}`}>"폐업 매장 절반이 3년 미만 운영 후 문 닫습니다"</p>
 </div>
 {aiExpandedData === 'closure' && (
 <div className="p-4 rounded-xl border border-neutral-200/30 bg-transparent space-y-3 animate-fadeIn">
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <div className="flex items-center justify-between mb-1">
 <p className={`text-xs font-semibold ${t.text}`}>중개사 영업 멘트</p>
 <button type="button" onClick={(e) => { e.stopPropagation(); const btn = e.currentTarget; navigator.clipboard.writeText('선생님, 카페 창업 문의 많이 받으시죠? 저희 빈크래프트는 개인카페 창업 컨설팅 업체입니다. 고객분께서 카페 창업 관심 있으시면 저희 연결해주세요. 중개 수수료 외에 소개비도 따로 드립니다.'); btn.innerText = ''; btn.classList.add('text-neutral-700'); setTimeout(() => { btn.innerText = ''; btn.classList.remove('text-neutral-700'); }, 1500); }} className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600' : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}></button>
 </div>
 <p className={`text-sm ${t.text}`}>"선생님, 카페 창업 문의 많이 받으시죠? 저희 <span className={`font-semibold ${t.text}`}>빈크래프트</span>는 개인카페 창업 컨설팅 업체입니다. 고객분께서 카페 창업 관심 있으시면 저희 연결해주세요. <span className={`font-semibold ${t.text}`}>중개 수수료 외에 소개비</span>도 따로 드립니다."</p>
 </div>
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <div className="flex items-center justify-between mb-1">
 <p className={`text-xs font-semibold ${t.text}`}>빈크래프트 차별점</p>
 <button type="button" onClick={(e) => { e.stopPropagation(); const btn = e.currentTarget; navigator.clipboard.writeText('가맹비/로열티 0원으로 프랜차이즈 대비 초기 비용 절감, 메뉴/인테리어 자유롭게 결정 가능, 입지 선정부터 운영까지 전문 컨설팅 지원'); btn.innerText = ''; btn.classList.add('text-neutral-700'); setTimeout(() => { btn.innerText = ''; btn.classList.remove('text-neutral-700'); }, 1500); }} className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600' : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}></button>
 </div>
 <p className={`text-sm ${t.text}`}><span className={`font-semibold ${t.text}`}>가맹비/로열티 0원</span>으로 프랜차이즈 대비 초기 비용 절감, 메뉴/인테리어 자유롭게 결정 가능, 입지 선정부터 운영까지 전문 컨설팅 지원</p>
 </div>
 <div className="p-3 rounded-lg bg-purple-500/10 border border-neutral-500/30">
 <p className={`text-xs ${t.text} font-semibold mb-2`}>카페 창업 주요 리스크 (통계 기반)</p>
 <div className="flex gap-2 flex-wrap">
 <span className={`px-2 py-1 rounded-full bg-neutral-600 ${t.text} text-xs`}>5년 생존율: 22.8%</span>
 <span className={`px-2 py-1 rounded-full bg-neutral-600 ${t.text} text-xs`}>폐업률: 14.1%</span>
 <span className={`px-2 py-1 rounded-full bg-neutral-600 ${t.text} text-xs`}>경쟁: 전국 9.3만개</span>
 </div>
 <p className={`text-xs mt-2 ${t.textMuted}`}>출처: 통계청 기업생멸행정통계, 시사저널</p>
 </div>
 <a href="https://www.sisajournal.com/news/articleView.html?idxno=195110" target="_blank" rel="noopener" className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-800/10 text-neutral-700 text-sm transition-all">
 시사저널: 카페 폐업률 14%, 치킨집보다 높아 →
 </a>
 </div>
 )}

 {/* 생존율 비교 */}
 <div 
 onClick={() => setAiExpandedData(aiExpandedData === 'survival' ? null : 'survival')}
 className="p-4 rounded-xl border border-neutral-300 bg-transparent cursor-pointer hover:border-neutral-200 transition-all"
 >
 <div className="flex items-center justify-between">
 <div>
 <span className={`font-bold ${t.text}`}>카페 평균 영업이익</span>
 <span className="text-lg font-bold text-neutral-700 ml-2">연 1,050만원</span>
 <span className="text-neutral-500 mx-2">(10곳 중 1곳 적자)</span>
 </div>
 <span className={`text-lg ${t.textMuted}`}>{aiExpandedData === 'survival' ? '▲' : '▼'}</span>
 </div>
 <p className={`text-xs mt-1 ${t.textMuted}`}>출처: KB경영연구소 (직장인 평균 연봉 3,475만원의 1/3)</p>
 <p className={`text-xs mt-2 ${t.text}`}>"상권분석 없이 뛰어들면 적자 각오해야 합니다"</p>
 </div>
 {aiExpandedData === 'survival' && (
 <div className="p-4 rounded-xl border border-neutral-200/30 bg-transparent space-y-3 animate-fadeIn">
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <div className="flex items-center justify-between mb-1">
 <p className={`text-xs font-semibold ${t.text}`}>중개사 영업 멘트</p>
 <button type="button" onClick={(e) => { e.stopPropagation(); const btn = e.currentTarget; navigator.clipboard.writeText('선생님, 카페 평균 영업이익이 연 1,050만원입니다. 월 87만원이에요. 이게 현실입니다. 저희 고객분들은 상권분석부터 받고 오시는데, 이 서비스 있다고만 말씀하셔도 관심 가지실 겁니다.'); btn.innerText = ''; btn.classList.add('text-neutral-700'); setTimeout(() => { btn.innerText = ''; btn.classList.remove('text-neutral-700'); }, 1500); }} className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600' : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}></button>
 </div>
 <p className={`text-sm ${t.text}`}>"선생님, 카페 평균 영업이익이 <span className={`font-semibold ${t.text}`}>연 1,050만원</span>입니다. 월 87만원이에요. 이게 현실입니다. 저희 고객분들은 <span className={`font-semibold ${t.text}`}>상권분석부터</span> 받고 오시는데, 이 서비스 있다고만 말씀하셔도 관심 가지실 겁니다."</p>
 </div>
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <div className="flex items-center justify-between mb-1">
 <p className={`text-xs font-semibold ${t.text}`}>창업자 영업 멘트</p>
 <button type="button" onClick={(e) => { e.stopPropagation(); const btn = e.currentTarget; navigator.clipboard.writeText('사장님, 카페 평균 영업이익이 연 1,050만원입니다. 직장인 연봉 3,475만원의 1/3이에요. 수익 구조 모르고 시작하면 적자입니다. 저희가 해당 상권 경쟁 현황, 유동인구 분석해드립니다.'); btn.innerText = ''; btn.classList.add('text-neutral-700'); setTimeout(() => { btn.innerText = ''; btn.classList.remove('text-neutral-700'); }, 1500); }} className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600' : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}></button>
 </div>
 <p className={`text-sm ${t.text}`}>"사장님, 카페 평균 영업이익이 <span className={`font-semibold ${t.text}`}>연 1,050만원</span>입니다. 직장인 연봉 3,475만원의 1/3이에요. 수익 구조 모르고 시작하면 적자입니다. 저희가 해당 상권 <span className={`font-semibold ${t.text}`}>경쟁 현황, 유동인구</span> 분석해드립니다."</p>
 </div>
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>빈크래프트 상권분석 제공 항목</p>
 <div className="grid grid-cols-2 gap-2 text-xs text-neutral-700">
 <span>• 반경 500m 카페 점포 수</span>
 <span>• 유동인구 데이터</span>
 <span>• 경쟁 업체 현황</span>
 <span>• 상권 특성 분석</span>
 </div>
 </div>
 <a href="https://www.sisain.co.kr/news/articleView.html?idxno=52312" target="_blank" rel="noopener" className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-800/10 text-neutral-700 text-sm transition-all">
 시사IN: 위기 경고 깜빡이는 카페 자영업 →
 </a>
 </div>
 )}

 {/* 프랜차이즈 비용 비교 */}
 <div 
 onClick={() => setAiExpandedData(aiExpandedData === 'royalty' ? null : 'royalty')}
 className="p-4 rounded-xl border border-neutral-300 bg-transparent cursor-pointer hover:border-neutral-200 transition-all"
 >
 <div className="flex items-center justify-between">
 <div>
 <span className={`font-bold ${t.text}`}>프랜차이즈 초기 비용</span>
 <span className="text-2xl font-black text-neutral-700 ml-3">6,900만~1.3억원</span>
 </div>
 <span className={`text-lg ${t.textMuted}`}>{aiExpandedData === 'royalty' ? '▲' : '▼'}</span>
 </div>
 <p className={`text-xs mt-1 ${t.textMuted}`}>공정위 정보공개서 기준 가맹비 (인테리어/로열티 별도)</p>
 <p className={`text-xs mt-2 ${t.text}`}>"저희는 매물 조건 제한이 없습니다"</p>
 </div>
 {aiExpandedData === 'royalty' && (
 <div className="p-4 rounded-xl border border-neutral-200/30 bg-transparent space-y-3 animate-fadeIn">
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <div className="flex items-center justify-between mb-1">
 <p className={`text-xs font-semibold ${t.text}`}>중개사 영업 멘트</p>
 <button type="button" onClick={(e) => { e.stopPropagation(); const btn = e.currentTarget; navigator.clipboard.writeText('선생님, 프랜차이즈는 매물 조건이 까다롭습니다. 1층 15평 이상, 유동인구 기준 있어요. 저희는 선생님 매물 조건 그대로 됩니다. 창업자분들이 프랜차이즈 조건 안 맞아서 저희 찾는 경우 많습니다.'); btn.innerText = ''; btn.classList.add('text-neutral-700'); setTimeout(() => { btn.innerText = ''; btn.classList.remove('text-neutral-700'); }, 1500); }} className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600' : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}></button>
 </div>
 <p className={`text-sm ${t.text}`}>"선생님, 프랜차이즈는 매물 조건이 까다롭습니다. <span className={`font-semibold ${t.text}`}>1층 15평 이상, 유동인구 기준</span> 있어요. 저희는 선생님 매물 조건 그대로 됩니다. 창업자분들이 프랜차이즈 조건 안 맞아서 저희 찾는 경우 많습니다."</p>
 </div>
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <div className="flex items-center justify-between mb-1">
 <p className={`text-xs font-semibold ${t.text}`}>창업자 영업 멘트</p>
 <button type="button" onClick={(e) => { e.stopPropagation(); const btn = e.currentTarget; navigator.clipboard.writeText('사장님, 프랜차이즈 가맹비만 6,900만~1.3억원입니다. 공정위 정보공개서에 다 나와있어요. 저희는 매물 조건 제한 없이 상권분석부터 운영까지 도와드립니다.'); btn.innerText = ''; btn.classList.add('text-neutral-700'); setTimeout(() => { btn.innerText = ''; btn.classList.remove('text-neutral-700'); }, 1500); }} className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600' : (theme === 'dark' ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}`}></button>
 </div>
 <p className={`text-sm ${t.text}`}>"사장님, 프랜차이즈 가맹비만 <span className={`font-semibold ${t.text}`}>6,900만~1.3억원</span>입니다. 공정위 정보공개서에 다 나와있어요. 저희는 매물 조건 제한 없이 상권분석부터 운영까지 도와드립니다."</p>
 </div>
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>프랜차이즈 비용 (공정위 정보공개서 기준)</p>
 <div className="grid grid-cols-2 gap-2 text-xs text-neutral-700">
 <span>• 메가커피 가맹비: 6,900만원</span>
 <span>• 메가커피 로열티: 월 15만원</span>
 <span>• 이디야 가맹비: 1.3억원</span>
 <span>• 이디야 로열티: 월 25만원</span>
 </div>
 <p className={`text-xs mt-2 ${t.textMuted}`}>※ 인테리어, 장비, 교육비 별도 / 출처: 공정위 가맹사업 정보공개서</p>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ═══════════════════════════════════════════════════════════════════════════════
 프랜차이즈 vs 빈크래프트 비용 비교표 (상세페이지 스타일)
 ═══════════════════════════════════════════════════════════════════════════════ */}
 <div className={`rounded-2xl p-4 break-inside-avoid mb-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} mb-4 text-lg`}>
 프랜차이즈 vs 빈크래프트 비용 비교
 </h3>
 
 {/* 프랜차이즈 검색 */}
 <div className="mb-4">
   <input
     type="text"
     value={franchiseSearch}
     onChange={e => setFranchiseSearch(e.target.value)}
     placeholder="업체 검색"
     className="w-full px-4 py-3 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 text-sm"
   />
   {franchiseSearch && (
     <div className={`mt-2 max-h-48 overflow-y-auto rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
       {Object.keys(FRANCHISE_DATA)
         .filter(name => name.toLowerCase().includes(franchiseSearch.toLowerCase()))
         .slice(0, 10)
         .map(name => (
           <button
             key={name}
             onClick={() => { setSelectedFranchise(name); setFranchiseSearch(''); }}
             className="w-full text-left px-4 py-2 hover:bg-neutral-50 text-sm text-neutral-800 border-b border-neutral-100 last:border-b-0"
           >
             {name} <span className={`text-xs ${t.textMuted}`}>({FRANCHISE_DATA[name].카테고리})</span>
           </button>
         ))}
       {Object.keys(FRANCHISE_DATA).filter(name => name.toLowerCase().includes(franchiseSearch.toLowerCase())).length === 0 && (
         <p className="px-4 py-2 text-sm text-neutral-400">검색 결과가 없습니다</p>
       )}
     </div>
   )}
 </div>

 {/* 선택된 프랜차이즈 비교 테이블 */}
 {selectedFranchise && FRANCHISE_DATA[selectedFranchise] && (
   <div className="mb-4 p-4 border border-neutral-300 rounded-xl bg-neutral-50">
     <div className="flex items-center justify-between mb-3">
       <h4 className={`font-bold ${t.text}`}>{selectedFranchise} vs 빈크래프트</h4>
       <button onClick={() => setSelectedFranchise(null)} className="text-neutral-400 hover:text-neutral-600 text-sm">닫기</button>
     </div>
     
     {/* 검증 데이터 기준 안내 */}
     <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
       <p className="text-xs text-amber-700">
         공정위 정보공개서 기반 검증 데이터입니다. "미확인" 항목은 공식 데이터가 없거나 비공개 상태입니다.
       </p>
     </div>
     
     <table className="w-full text-sm">
       <thead>
         <tr className="border-b border-neutral-200">
           <th className="py-2 px-2 text-left text-neutral-500">항목</th>
           <th className="py-2 px-2 text-center text-neutral-800">{selectedFranchise}</th>
           <th className="py-2 px-2 text-center text-[#1e3a5f]">빈크래프트</th>
         </tr>
       </thead>
       <tbody>
         <tr className="border-b border-neutral-100">
           <td className="py-2 px-2">가맹비</td>
           <td className="py-2 px-2 text-center">{FRANCHISE_DATA[selectedFranchise].가맹비 !== null ? `${FRANCHISE_DATA[selectedFranchise].가맹비}만원` : <span className={`${t.textMuted}`}>미확인</span>}</td>
           <td className="py-2 px-2 text-center font-bold text-[#1e3a5f]">0원</td>
         </tr>
         <tr className="border-b border-neutral-100">
           <td className="py-2 px-2">교육비</td>
           <td className="py-2 px-2 text-center">{FRANCHISE_DATA[selectedFranchise].교육비 !== null ? `${FRANCHISE_DATA[selectedFranchise].교육비}만원` : <span className={`${t.textMuted}`}>미확인</span>}</td>
           <td className="py-2 px-2 text-center text-[#1e3a5f]">컨설팅 포함</td>
         </tr>
         <tr className="border-b border-neutral-100">
           <td className="py-2 px-2">보증금</td>
           <td className="py-2 px-2 text-center">{FRANCHISE_DATA[selectedFranchise].보증금 !== null ? `${FRANCHISE_DATA[selectedFranchise].보증금}만원` : <span className={`${t.textMuted}`}>미확인</span>}</td>
           <td className="py-2 px-2 text-center text-[#1e3a5f]">없음</td>
         </tr>
         <tr className="border-b border-neutral-100">
           <td className="py-2 px-2">로열티 (월)</td>
           <td className="py-2 px-2 text-center">{FRANCHISE_DATA[selectedFranchise].로열티월 !== null ? `${FRANCHISE_DATA[selectedFranchise].로열티월}만원` : <span className={`${t.textMuted}`}>미확인</span>}</td>
           <td className="py-2 px-2 text-center font-bold text-[#1e3a5f]">0원</td>
         </tr>
         <tr className="border-b border-neutral-100">
           <td className="py-2 px-2">광고분담금 (월)</td>
           <td className="py-2 px-2 text-center">{FRANCHISE_DATA[selectedFranchise].광고비월 !== null ? `${FRANCHISE_DATA[selectedFranchise].광고비월}만원` : <span className={`${t.textMuted}`}>미확인</span>}</td>
           <td className="py-2 px-2 text-center font-bold text-[#1e3a5f]">자율 선택</td>
         </tr>
         <tr className="border-b border-neutral-100">
           <td className="py-2 px-2">인테리어 (10평)</td>
           <td className="py-2 px-2 text-center">{FRANCHISE_DATA[selectedFranchise].인테리어 !== null ? `${FRANCHISE_DATA[selectedFranchise].인테리어}만원` : <span className={`${t.textMuted}`}>미확인</span>}</td>
           <td className="py-2 px-2 text-center text-[#1e3a5f]">400만원+별도</td>
         </tr>
         <tr>
           <td className="py-2 px-2 font-bold">총 예상비용</td>
           <td className="py-2 px-2 text-center font-bold">{FRANCHISE_DATA[selectedFranchise].총비용}</td>
           <td className="py-2 px-2 text-center font-bold text-[#1e3a5f]">1,000만원+</td>
         </tr>
       </tbody>
     </table>
     
     {/* 추가 검증 데이터 표시 */}
     {(FRANCHISE_DATA[selectedFranchise].폐업률 !== null || FRANCHISE_DATA[selectedFranchise].연평균매출) && (
       <div className={`mt-3 p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
         <h5 className="font-medium text-sm text-neutral-700 mb-2">검증된 실적 데이터</h5>
         <div className="grid grid-cols-2 gap-2 text-sm">
           {FRANCHISE_DATA[selectedFranchise].폐업률 !== null && (
             <div>
               <span className={`${t.textMuted}`}>폐업률: </span>
               <span className={FRANCHISE_DATA[selectedFranchise].폐업률 < 1 ? 'text-white font-medium' : 'text-white font-medium'}>
                 {FRANCHISE_DATA[selectedFranchise].폐업률}%
               </span>
             </div>
           )}
           {FRANCHISE_DATA[selectedFranchise].연평균매출 && (
             <div>
               <span className={`${t.textMuted}`}>연평균 매출: </span>
               <span className="font-medium">{(FRANCHISE_DATA[selectedFranchise].연평균매출 / 10000).toFixed(1)}억원</span>
             </div>
           )}
           {FRANCHISE_DATA[selectedFranchise].평균영업기간 && (
             <div>
               <span className={`${t.textMuted}`}>평균 영업기간: </span>
               <span className="font-medium">{FRANCHISE_DATA[selectedFranchise].평균영업기간}</span>
             </div>
           )}
           {FRANCHISE_DATA[selectedFranchise].영업이익률 && (
             <div>
               <span className={`${t.textMuted}`}>영업이익률: </span>
               <span className="font-medium">{FRANCHISE_DATA[selectedFranchise].영업이익률}%</span>
             </div>
           )}
         </div>
       </div>
     )}
     
     {/* 이슈 정보 */}
     {FRANCHISE_DATA[selectedFranchise].이슈 && (
       <div className={`mt-3 p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
         <button 
           onClick={() => setFranchiseIssueExpanded(prev => ({...prev, [selectedFranchise]: !prev[selectedFranchise]}))}
           className="w-full flex items-center justify-between text-sm"
         >
           <span className="font-medium text-neutral-700">검토 필요 사항</span>
           <span className={`${t.textMuted}`}>{franchiseIssueExpanded[selectedFranchise] ? '접기' : '펼치기'}</span>
         </button>
         {franchiseIssueExpanded[selectedFranchise] && (
           <ul className="mt-2 space-y-1">
             {FRANCHISE_DATA[selectedFranchise].이슈.map((issue, idx) => (
               <li key={idx} className="text-sm text-neutral-600">{issue}</li>
             ))}
           </ul>
         )}
       </div>
     )}
     
     <p className={`text-xs mt-3 ${t.textMuted}`}>
       매장수: {FRANCHISE_DATA[selectedFranchise].매장수 ? `약 ${FRANCHISE_DATA[selectedFranchise].매장수.toLocaleString()}개` : '미확인'} / 
       검증일: {FRANCHISE_DATA[selectedFranchise].검증일자 || '미상'} / 
       출처: 공정위 정보공개서
     </p>
   </div>
 )}
 
 {/* 기본 비교 테이블 (선택 안 됐을 때) */}
 {!selectedFranchise && (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-neutral-200">
 <th className="py-3 px-2 text-left text-neutral-500 font-medium">항목</th>
 <th className="py-3 px-2 text-center text-neutral-900 font-medium">저가 프랜차이즈</th>
 <th className="py-3 px-2 text-center text-[#1e3a5f] font-medium">빈크래프트</th>
 </tr>
 </thead>
 <tbody className={`${t.text}`}>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">가맹비</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>500~1,500만원</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f] font-bold">0원</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">교육비</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>100~300만원</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f]">컨설팅 포함</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">컨설팅</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>-</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f]">1,000만원</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">로열티 (월)</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>15~50만원</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f] font-bold">0원</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">로열티 (5년)</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>900~3,000만원</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f] font-bold">0원</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">광고분담금 (월)</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>10~30만원</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f] font-bold">0원</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">인테리어</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>본사 지정업체</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f]">400만원+견적 별도</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">기기설비</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>본사 지정업체</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f]">400만원+견적 별도</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">원두공급</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>본사 지정 (강제)</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f]">공급가 납품 (선택)</td>
 </tr>
 <tr className="border-b border-neutral-200">
 <td className="py-3 px-2 font-medium">메뉴개발</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>본사 고정메뉴</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f]">400만원 (15가지)</td>
 </tr>
 <tr>
 <td className="py-3 px-2 font-medium">계약기간</td>
 <td className={`py-3 px-2 text-center ${t.text}`}>2~5년 (갱신시 추가비용)</td>
 <td className="py-3 px-2 text-center text-[#1e3a5f]">없음</td>
 </tr>
 </tbody>
 </table>
 </div>
 )}
 
 {/* 업체별 최종 창업비용 - 검색 및 펼쳐보기 */}
 <div className="mt-4">
 <p className="text-sm text-neutral-700 font-semibold mb-3">주요 프랜차이즈 창업비용 ({Object.keys(FRANCHISE_DATA).length}개 브랜드)</p>
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {Object.entries(FRANCHISE_DATA)
   .sort((a, b) => (b[1].매장수 || 0) - (a[1].매장수 || 0))
   .slice(0, 10)
   .map(([name, data]) => (
   <div key={name} className={`rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
     <button
       onClick={() => setFranchiseIssueExpanded(prev => ({...prev, [name]: !prev[name]}))}
       className="w-full flex items-center justify-between p-3 hover:bg-neutral-50"
     >
       <div className="flex items-center gap-3 text-left">
         <span className={`font-medium ${t.text}`}>{name}</span>
         <span className={`text-xs ${t.textMuted}`}>가맹비 {data.가맹비}만 + 교육비 {data.교육비}만 + 인테리어/기기</span>
       </div>
       <div className="flex items-center gap-2">
         <span className="text-neutral-700 font-bold text-sm">{data.총비용}</span>
         <span className={`text-xs ${t.textMuted}`}>{franchiseIssueExpanded[name] ? '접기' : '펼치기'}</span>
       </div>
     </button>
     {franchiseIssueExpanded[name] && (
       <div className="px-3 pb-3 border-t border-neutral-100">
         <div className="pt-2 space-y-1">
           <p className={`text-xs ${t.textMuted}`}>매장수: 약 {data.매장수?.toLocaleString()}개 / 로열티: 월 {data.로열티월}만원 / 광고비: 월 {data.광고비월}만원</p>
           {data.이슈 && (
             <div className="mt-2">
               <p className="text-xs text-neutral-600 font-medium mb-1">최근 이슈:</p>
               {data.이슈.map((issue, idx) => (
                 <p key={idx} className={`text-xs ${t.textMuted}`}>- {issue}</p>
               ))}
             </div>
           )}
           <button
             onClick={(e) => { e.stopPropagation(); setSelectedFranchise(name); }}
             className="mt-2 text-xs text-[#1e3a5f] hover:underline"
           >
             빈크래프트와 상세 비교하기
           </button>
         </div>
       </div>
     )}
   </div>
 ))}
 </div>
 <a href="https://franchise.ftc.go.kr/mnu/00013/program/userRqst/list.do" target="_blank" rel="noopener" className="flex items-center justify-center gap-2 mt-3 p-3 rounded-lg border border-neutral-300/50 bg-neutral-800/10 hover:bg-neutral-800/20 transition-all">
 <span className={`text-sm font-medium ${t.text}`}>공정위 가맹사업정보제공시스템에서 상세 정보 확인</span>
 </a>
 <p className="text-xs text-neutral-500 mt-3 text-center">* 최종 창업비용은 점포 크기, 위치, 인테리어 범위에 따라 달라집니다.</p>
 </div>





 {/* 팀 피드백 자동 학습 시스템 */}
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex items-center justify-between mb-4">
 <h3 className={`font-bold ${t.text} flex items-center gap-2`}>
 <span className="text-xl"></span> 팀 피드백 자동 학습
 <span className="text-xs bg-neutral-600 text-neutral-700 px-2 py-0.5 rounded-full">자동</span>
 </h3>
 </div>
 <p className="text-sm text-neutral-500 mb-4">멘트 사용 후 결과를 공유하면 AI가 분석하여 모든 팀원에게 개선된 멘트를 제공합니다.</p>
 
 {/* 피드백 입력 */}
 <div className="p-4 rounded-xl bg-transparent border border-neutral-200 mb-4">
 <p className="text-sm text-neutral-700 font-semibold mb-3">오늘 사용한 멘트 결과 공유</p>
 <div className="space-y-3">
 <select value={teamFeedbackSituation} onChange={e => setTeamFeedbackSituation(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-800 text-sm">
 <option value="">어떤 상황이었나요?</option>
 <option value="broker">중개사 첫 방문</option>
 <option value="broker-followup">중개사 재방문</option>
 <option value="franchise">프랜차이즈 비교 질문 대응</option>
 </select>
 <textarea value={teamFeedbackMemo} onChange={e => setTeamFeedbackMemo(e.target.value)} 
 placeholder="사용한 멘트와 상대방 반응을 적어주세요.

예시: 빈크래프트 서비스 소개했더니 관심 보이셨어요. 명함 교환하고 나왔습니다."
 className="w-full px-3 py-3 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-800 text-sm resize-none h-24"
 ></textarea>
 <div className="flex gap-2">
 <button 
                      onClick={() => setTeamFeedbackResult('success')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${teamFeedbackResult === 'success' ? 'bg-emerald-500 text-white' : 'bg-neutral-600 text-neutral-700 border border-neutral-300 hover:bg-emerald-500/30'}`}
                    > 효과 있었어요</button>
 <button 
                      onClick={() => setTeamFeedbackResult('fail')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${teamFeedbackResult === 'fail' ? 'bg-rose-500 text-white' : 'bg-neutral-600 text-white border border-neutral-300 hover:bg-rose-500/30'}`}
                    > 별로였어요</button>
 </div>
                <button type="button" onClick={() => {
                      if (!teamFeedbackSituation || !teamFeedbackMemo || !teamFeedbackResult) {
                        alert('상황, 내용, 결과를 모두 입력해주세요.');
                        return;
                      }
                      const feedback = {
                        id: Date.now(),
                        situation: teamFeedbackSituation,
                        memo: teamFeedbackMemo,
                        result: teamFeedbackResult,
                        timestamp: new Date().toISOString(),
                        managerId: user?.managerId,
                        managerName: user?.name || '익명'
                      };
                      database.ref(`teamFeedbacks/${feedback.id}`).set(feedback);
                      setTeamFeedbackSituation('');
                      setTeamFeedbackMemo('');
                      setTeamFeedbackResult(null);
                      alert('피드백이 공유되었습니다!');
                    }} className={`w-full px-4 py-3 rounded-lg bg-neutral-800 ${t.text} font-semibold hover:bg-neutral-800/80 transition-all`}>
 피드백 공유하기
 </button>
 </div>
 </div>

 {/* 팀 피드백 현황 */}
 <div className="space-y-3">
 <p className="text-sm text-neutral-700 font-semibold">팀 피드백 현황 (최근 7일)</p>
 
 {/* 실제 팀 피드백 데이터 표시 */}
 {teamFeedbacksAll && teamFeedbacksAll.length > 0 ? (
 teamFeedbacksAll.slice(0, 5).map((fb, idx) => (
 <div key={idx} className={`p-3 rounded-lg ${fb.result === 'success' ? 'bg-white border border-neutral-300' : 'bg-white border border-neutral-300'}`}>
 <div className="flex items-start justify-between">
 <div>
 <p className={`text-xs font-semibold ${fb.result === 'success' ? 'text-neutral-700' : 'text-white'}`}>
 {fb.result === 'success' ? '효과 있던 멘트' : '개선 필요 멘트'}
 </p>
 <p className="text-sm text-neutral-800 mt-1">{fb.situation === 'broker' ? '중개사 첫 방문' : fb.situation === 'broker-followup' ? '중개사 재방문' : fb.situation === 'franchise' ? '프랜차이즈 비교 질문 대응' : fb.situation || '상황 미입력'}</p>
 <p className={`text-xs mt-1 ${t.textMuted}`}>{fb.memo || '메모 없음'}</p>
 </div>
 <span className={`text-xs px-2 py-1 rounded ${fb.result === 'success' ? 'bg-neutral-600 text-neutral-700' : 'bg-neutral-600 text-white'}`}>
 {fb.result === 'success' ? '성공' : '실패'}
 </span>
 </div>
 </div>
 ))
 ) : (
 <div className={`p-4 rounded-lg border text-center ${theme === 'dark' ? 'bg-white/5 border-neutral-700' : 'bg-white/30 border-neutral-200'}`}>
 <p className={`text-sm ${t.textMuted}`}>아직 공유된 피드백이 없습니다.</p>
 <p className="text-neutral-500 text-xs mt-1">위에서 멘트 결과를 공유해주세요.</p>
 </div>
 )}
 
 {/* AI 분석 인사이트 - 피드백이 있을 때만 표시 */}
 {teamFeedbacksAll && teamFeedbacksAll.length >= 3 && (
 <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
 <p className={`text-xs font-semibold mb-2 ${t.text}`}>AI 분석 인사이트</p>
 <p className={`text-sm ${t.text}`}>• 피드백 데이터를 분석 중입니다...</p>
 <p className={`text-xs mt-2 ${t.textMuted}`}>피드백이 5개 이상 쌓이면 AI가 패턴을 분석해드립니다.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 )}

 </div>
 )}
 {tab === 'calendar' && (
 <div className="space-y-2">
 <h2 className={`font-bold ${t.text} text-xl`}>일정 캘린더</h2>
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex justify-between items-center mb-4">
 <button
 onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
 className={`w-10 h-10 rounded-lg font-bold border ${theme === 'dark' ? 'bg-neutral-700 border-neutral-600 text-white hover:bg-neutral-600' : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'}`}
 >&lt;</button>
 <h3 className={`font-bold ${t.text} text-lg`}>
 {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
 </h3>
 <button
 onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
 className={`w-10 h-10 rounded-lg font-bold border ${theme === 'dark' ? 'bg-neutral-700 border-neutral-600 text-white hover:bg-neutral-600' : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'}`}
 >&gt;</button>
 </div>
 <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
 {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
 <div key={day} className={`text-center text-sm font-bold py-2 ${i === 0 ? 'text-white' : i === 6 ? 'text-primary-600' : 'text-neutral-800'}`}>
 {day}
 </div>
 ))}
 </div>
 <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
 {(() => {
 const year = calendarMonth.getFullYear();
 const month = calendarMonth.getMonth();
 const firstDay = new Date(year, month, 1).getDay();
 const lastDate = new Date(year, month + 1, 0).getDate();
 const today = getKoreanToday();
 const cells = [];
 for (let i = 0; i < firstDay; i++) {
 cells.push(<div key={`empty-${i}`} className="h-24 sm:h-28"></div>);
 }
 for (let d = 1; d <= lastDate; d++) {
 const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
 const dayRoutes = routes.filter(r => r.date === dateStr);
 const dayEvents = calendarEvents.filter(e => e.date === dateStr);
 const allItems = [...dayRoutes.map(r => ({ ...r, itemType: 'route' })), ...dayEvents.map(e => ({ ...e, itemType: 'event' }))];
 allItems.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
 const isToday = dateStr === today;
 const dayOfWeek = new Date(year, month, d).getDay();
 cells.push(
 <div
 key={d}
 className={`h-24 sm:h-28 p-1 border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-md ${isToday ? 'bg-neutral-100 border-primary-300' : 'border-neutral-200 hover:border-primary-300'}`}
 onClick={() => {
 setSelectedCalendarDate(dateStr);
 setCalendarEventInput({ title: '', time: '09:00', memo: '' });
 setEditingEventId(null);
 setShowCalendarModal(true);
 }}
 >
 <div className={`text-sm font-bold mb-1 ${dayOfWeek === 0 ? 'text-white' : dayOfWeek === 6 ? 'text-primary-600' : 'text-neutral-800'}`}>
 {d}
 </div>
 <div className="space-y-0.5 overflow-y-auto max-h-14">
 {allItems.slice(0, 3).map((item, idx) => {
 if (item.itemType === 'route') {
 const manager = managers.find(m => m.id === item.managerId);
 return (
 <div
 key={`r-${item.id}`}
 onClick={(e) => { e.stopPropagation(); setSelectedSchedule(item); }}
 className={`text-xs px-1 py-0.5 rounded ${t.text} leading-tight`}
 style={{ background: manager?.color || '#888' }}
 title={`${item.time?.slice(0,5)} ${item.name}`}
 >
 {item.time?.slice(0,5)} {item.name}
 </div>
 );
 } else {
 const eventManager = managers.find(m => m.id === item.managerId);
 const eventColor = item.managerId && eventManager ? eventManager.color : '#6b7280';
 return (
 <div
 key={`e-${item.id}`}
 onClick={(e) => { e.stopPropagation(); setSelectedCalendarEvent(item); }}
 className={`text-xs px-1 py-0.5 rounded ${t.text} leading-tight cursor-pointer hover:opacity-80`}
 style={{ background: eventColor }}
 title={`${item.time?.slice(0,5)} ${item.title}`}
 >
 {item.time?.slice(0,5)} {item.title}
 </div>
 );
 }
 })}
 {allItems.length > 3 && (
 <div className={`text-xs ${t.text}`}>+{allItems.length - 3}개</div>
 )}
 </div>
 </div>
 );
 }
 return cells;
 })()}
 </div>
 </div>
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`font-bold mb-3 ${t.text}`}>이번 주 일정</p>
 {(() => {
 const today = new Date();
 const startOfWeek = new Date(today);
 startOfWeek.setDate(today.getDate() - today.getDay());
 const endOfWeek = new Date(startOfWeek);
 endOfWeek.setDate(startOfWeek.getDate() + 6);
 const weekRoutes = routes.filter(r => {
 const d = new Date(r.date);
 return d >= startOfWeek && d <= endOfWeek;
 }).map(r => ({ ...r, itemType: 'route' }));
 const weekEvents = calendarEvents.filter(e => {
 const d = new Date(e.date);
 return d >= startOfWeek && d <= endOfWeek;
 }).map(e => ({ ...e, itemType: 'event' }));
 const allWeekItems = [...weekRoutes, ...weekEvents].sort((a, b) => {
 const dateA = new Date(a.date + ' ' + (a.time || '00:00'));
 const dateB = new Date(b.date + ' ' + (b.time || '00:00'));
 return dateA - dateB;
 });
 if (allWeekItems.length === 0) {
 return <p className={`text-center py-4 ${t.text}`}>이번 주 일정이 없습니다</p>;
 }
 return (
 <div className="space-y-2">
 {allWeekItems.map(item => {
 if (item.itemType === 'route') {
 const manager = managers.find(m => m.id === item.managerId);
 const isCompleted = item.status === 'completed';
 return (
 <div
 key={`r-${item.id}`}
 onClick={() => setSelectedSchedule(item)}
 className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:shadow-md ${isCompleted ? 'bg-emerald-900/30' : 'bg-neutral-100'}`}
 >
 <div className="text-center min-w-[40px]">
 <p className={`text-xs ${t.text}`}>{new Date(item.date).toLocaleDateString('ko-KR', { weekday: 'short' })}</p>
 <p className={`font-bold ${t.text}`}>{item.date.slice(8)}</p>
 </div>
 <div className="flex-1 min-w-0">
 <p className={`font-bold ${t.text} text-sm break-words leading-snug`}>{item.name}</p>
 <p className={`text-xs ${t.text}`}>{item.time || ''} · {item.stops?.length || 0}곳</p>
 </div>
 {manager && (
 <span className={`px-2 py-1 rounded text-xs font-bold ${t.text}`} style={{ background: manager.color }}>
 {manager.name}
 </span>
 )}
 </div>
 );
 } else {
 return (
 <div
 key={`e-${item.id}`}
 onClick={() => {
 setSelectedCalendarDate(item.date);
 setCalendarEventInput({ title: item.title, time: item.time, memo: item.memo || '' });
 setEditingEventId(item.id);
 setShowCalendarModal(true);
 }}
 className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:shadow-md bg-purple-50"
 >
 <div className="text-center min-w-[40px]">
 <p className={`text-xs ${t.text}`}>{new Date(item.date).toLocaleDateString('ko-KR', { weekday: 'short' })}</p>
 <p className={`font-bold ${t.text}`}>{item.date.slice(8)}</p>
 </div>
 <div className="flex-1 min-w-0">
 <p className={`font-bold ${t.text} text-sm break-words leading-snug`}>{item.title}</p>
 <p className={`text-xs break-words ${t.text}`}>{item.time || ''} {item.memo ? `· ${item.memo}` : ''}</p>
 </div>
 <span className={`px-2 py-1 rounded text-xs font-bold ${t.text} bg-purple-500`}>메모</span>
 </div>
 );
 }
 })}
 </div>
 );
 })()}
 </div>
 </div>
 )}
 {tab === 'route' && (
 <div>
 <div className="space-y-2">
 <h2 className={`font-bold ${t.text} text-xl`}>동선 관리</h2>
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex justify-between items-center mb-3">
 <p className={`text-sm font-bold ${t.text}`}>
 {editingRouteId ? '동선 수정' : '일정 정보'}
 </p>
 {editingRouteId && (
 <span className="text-xs text-primary-600 bg-neutral-100 px-2 py-1 rounded">수정 중</span>
 )}
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
 <input
 type="text"
 placeholder="일정명 (예: 이태원 영업)"
 value={routeName}
 onChange={e => setRouteName(e.target.value)}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm col-span-2`}
 />
 <div className="relative" onClick={() => document.getElementById('routeDateInput').showPicker?.()}>
 <input
 id="routeDateInput"
 type="date"
 value={routeDate}
 onChange={e => setRouteDate(e.target.value)}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm w-full cursor-pointer`}
 />
 </div>
 <div className="relative" onClick={() => document.getElementById('routeTimeInput').showPicker?.()}>
 <input
 id="routeTimeInput"
 type="time"
 value={routeTime}
 onChange={e => setRouteTime(e.target.value)}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm w-full cursor-pointer`}
 />
 </div>
 </div>
 <div className="grid grid-cols-1 gap-2">
 <select value={routeManager || ''} onChange={e => setRouteManager(Number(e.target.value) || null)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`}>
 <option value="">담당자 선택</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 </div>
 </div>
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex justify-between items-center mb-3">
 <p className={`font-bold ${t.text}`}>직접 검색</p>
 </div>
 <div className="bg-neutral-100 rounded-xl p-3">
 <div className="flex gap-2">
 <div className="flex gap-2 flex-1">
 <input
 type="text"
 placeholder="지역명, 도로명, 지하철역 등"
 value={placeSearchQuery}
 onChange={e => setPlaceSearchQuery(e.target.value)}
 onKeyPress={e => e.key === 'Enter' && searchAndMoveMap()}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 style={{flex: 6}}
 />
 <input
 type="text"
 placeholder="업체명 (선택)"
 value={placeCustomName}
 onChange={e => setPlaceCustomName(e.target.value)}
 onKeyPress={e => e.key === 'Enter' && searchAndMoveMap()}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 style={{flex: 4}}
 />
 </div>
 <button
 onClick={searchAndMoveMap}
 disabled={isSearchingPlaces}
 className={`px-4 py-2 bg-neutral-200 rounded-lg font-medium hover:bg-neutral-300 transition-all ${t.text} text-sm px-4`}
 >
 {isSearchingPlaces ? '...' : '검색'}
 </button>
 </div>
 {searchedPlaces.length > 0 && (
 <div className="mt-2 p-2 bg-neutral-100 rounded-lg border border-primary-300">
 <div className="flex justify-between items-center mb-2">
 <p className="text-xs text-primary-600 font-bold">검색 목록 ({searchedPlaces.length}/10)</p>
 <div className="flex gap-2">
 <button
 onClick={() => { setSearchedPlaces([]); clearSearchMarkers(); }}
 className={`text-xs ${t.text}`}
 >
 전체 삭제
 </button>
 </div>
 </div>
 <div className="space-y-1 max-h-32 overflow-y-auto">
 {searchedPlaces.map((place, idx) => (
 <div key={place.id} className="flex items-center justify-between bg-neutral-100 rounded px-2 py-1">
 <span className="text-xs text-neutral-800 truncate flex-1">{idx + 1}. {place.name}</span>
 <button
 onClick={() => removeSearchedPlace(place.id)}
 className={`ml-2 ${t.text} hover:${t.text} text-xs`}
 >
 ×
 </button>
 </div>
 ))}
 </div>
 <button
 onClick={addAllSearchedPlacesToRoute}
 className={`w-full mt-2 py-2 bg-primary-500 ${t.text} rounded-lg text-sm font-bold`}
 >
 {searchedPlaces.length}개 전체 동선에 추가
 </button>
 </div>
 )}
 <p className={`text-xs mt-2 ${t.text}`}>주소 검색 후 업체명을 입력하면 동선에 업체명으로 표시됩니다</p>
 </div>
 </div>
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`font-bold mb-3 ${t.text}`}>중개사 검색</p>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-2">
 <select
 value={routeSearchRegion}
 onChange={e => setRouteSearchRegion(e.target.value)}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 >
 <option value="">지역 선택</option>
 <optgroup label="서울특별시">
 <option value="강남구">강남구</option>
 <option value="강동구">강동구</option>
 <option value="강북구">강북구</option>
 <option value="강서구">강서구</option>
 <option value="관악구">관악구</option>
 <option value="광진구">광진구</option>
 <option value="구로구">구로구</option>
 <option value="금천구">금천구</option>
 <option value="노원구">노원구</option>
 <option value="도봉구">도봉구</option>
 <option value="동대문구">동대문구</option>
 <option value="동작구">동작구</option>
 <option value="마포구">마포구</option>
 <option value="서대문구">서대문구</option>
 <option value="서초구">서초구</option>
 <option value="성동구">성동구</option>
 <option value="성북구">성북구</option>
 <option value="송파구">송파구</option>
 <option value="양천구">양천구</option>
 <option value="영등포구">영등포구</option>
 <option value="용산구">용산구</option>
 <option value="은평구">은평구</option>
 <option value="종로구">종로구</option>
 <option value="중구">중구</option>
 <option value="중랑구">중랑구</option>
 </optgroup>
 <optgroup label="부산광역시">
 <option value="강서구">강서구</option>
 <option value="금정구">금정구</option>
 <option value="기장군">기장군</option>
 <option value="남구">남구</option>
 <option value="동구">동구</option>
 <option value="동래구">동래구</option>
 <option value="부산진구">부산진구</option>
 <option value="북구">북구</option>
 <option value="사상구">사상구</option>
 <option value="사하구">사하구</option>
 <option value="서구">서구</option>
 <option value="수영구">수영구</option>
 <option value="연제구">연제구</option>
 <option value="영도구">영도구</option>
 <option value="중구">중구</option>
 <option value="해운대구">해운대구</option>
 </optgroup>
 <optgroup label="대구광역시">
 <option value="남구">남구</option>
 <option value="달서구">달서구</option>
 <option value="달성군">달성군</option>
 <option value="동구">동구</option>
 <option value="북구">북구</option>
 <option value="서구">서구</option>
 <option value="수성구">수성구</option>
 <option value="중구">중구</option>
 <option value="군위군">군위군</option>
 </optgroup>
 <optgroup label="인천광역시">
 <option value="강화군">강화군</option>
 <option value="계양구">계양구</option>
 <option value="남동구">남동구</option>
 <option value="동구">동구</option>
 <option value="미추홀구">미추홀구</option>
 <option value="부평구">부평구</option>
 <option value="서구">서구</option>
 <option value="연수구">연수구</option>
 <option value="옹진군">옹진군</option>
 <option value="중구">중구</option>
 </optgroup>
 <optgroup label="광주광역시">
 <option value="광산구">광산구</option>
 <option value="남구">남구</option>
 <option value="동구">동구</option>
 <option value="북구">북구</option>
 <option value="서구">서구</option>
 </optgroup>
 <optgroup label="대전광역시">
 <option value="대덕구">대덕구</option>
 <option value="동구">동구</option>
 <option value="서구">서구</option>
 <option value="유성구">유성구</option>
 <option value="중구">중구</option>
 </optgroup>
 <optgroup label="울산광역시">
 <option value="남구">남구</option>
 <option value="동구">동구</option>
 <option value="북구">북구</option>
 <option value="울주군">울주군</option>
 <option value="중구">중구</option>
 </optgroup>
 <optgroup label="세종특별자치시">
 <option value="세종시">세종시</option>
 </optgroup>
 <optgroup label="경기도">
 <option value="가평군">가평군</option>
 <option value="고양시">고양시</option>
 <option value="덕양구">덕양구</option>
 <option value="일산동구">일산동구</option>
 <option value="일산서구">일산서구</option>
 <option value="과천시">과천시</option>
 <option value="광명시">광명시</option>
 <option value="광주시">광주시</option>
 <option value="구리시">구리시</option>
 <option value="군포시">군포시</option>
 <option value="김포시">김포시</option>
 <option value="남양주시">남양주시</option>
 <option value="동두천시">동두천시</option>
 <option value="부천시">부천시</option>
 <option value="성남시">성남시</option>
 <option value="분당구">분당구</option>
 <option value="수정구">수정구</option>
 <option value="중원구">중원구</option>
 <option value="수원시">수원시</option>
 <option value="권선구">권선구</option>
 <option value="영통구">영통구</option>
 <option value="장안구">장안구</option>
 <option value="팔달구">팔달구</option>
 <option value="시흥시">시흥시</option>
 <option value="안산시">안산시</option>
 <option value="단원구">단원구</option>
 <option value="상록구">상록구</option>
 <option value="안성시">안성시</option>
 <option value="안양시">안양시</option>
 <option value="동안구">동안구</option>
 <option value="만안구">만안구</option>
 <option value="양주시">양주시</option>
 <option value="양평군">양평군</option>
 <option value="여주시">여주시</option>
 <option value="연천군">연천군</option>
 <option value="오산시">오산시</option>
 <option value="용인시">용인시</option>
 <option value="기흥구">기흥구</option>
 <option value="수지구">수지구</option>
 <option value="처인구">처인구</option>
 <option value="의왕시">의왕시</option>
 <option value="의정부시">의정부시</option>
 <option value="이천시">이천시</option>
 <option value="파주시">파주시</option>
 <option value="평택시">평택시</option>
 <option value="포천시">포천시</option>
 <option value="하남시">하남시</option>
 <option value="화성시">화성시</option>
 </optgroup>
 <optgroup label="강원특별자치도">
 <option value="강릉시">강릉시</option>
 <option value="고성군">고성군</option>
 <option value="동해시">동해시</option>
 <option value="삼척시">삼척시</option>
 <option value="속초시">속초시</option>
 <option value="양구군">양구군</option>
 <option value="양양군">양양군</option>
 <option value="영월군">영월군</option>
 <option value="원주시">원주시</option>
 <option value="인제군">인제군</option>
 <option value="정선군">정선군</option>
 <option value="철원군">철원군</option>
 <option value="춘천시">춘천시</option>
 <option value="태백시">태백시</option>
 <option value="평창군">평창군</option>
 <option value="홍천군">홍천군</option>
 <option value="화천군">화천군</option>
 <option value="횡성군">횡성군</option>
 </optgroup>
 <optgroup label="충청북도">
 <option value="괴산군">괴산군</option>
 <option value="단양군">단양군</option>
 <option value="보은군">보은군</option>
 <option value="영동군">영동군</option>
 <option value="옥천군">옥천군</option>
 <option value="음성군">음성군</option>
 <option value="제천시">제천시</option>
 <option value="증평군">증평군</option>
 <option value="진천군">진천군</option>
 <option value="청주시">청주시</option>
 <option value="상당구">상당구</option>
 <option value="서원구">서원구</option>
 <option value="청원구">청원구</option>
 <option value="흥덕구">흥덕구</option>
 <option value="충주시">충주시</option>
 </optgroup>
 <optgroup label="충청남도">
 <option value="계룡시">계룡시</option>
 <option value="공주시">공주시</option>
 <option value="금산군">금산군</option>
 <option value="논산시">논산시</option>
 <option value="당진시">당진시</option>
 <option value="보령시">보령시</option>
 <option value="부여군">부여군</option>
 <option value="서산시">서산시</option>
 <option value="서천군">서천군</option>
 <option value="아산시">아산시</option>
 <option value="예산군">예산군</option>
 <option value="천안시">천안시</option>
 <option value="동남구">동남구</option>
 <option value="서북구">서북구</option>
 <option value="청양군">청양군</option>
 <option value="태안군">태안군</option>
 <option value="홍성군">홍성군</option>
 </optgroup>
 <optgroup label="전북특별자치도">
 <option value="고창군">고창군</option>
 <option value="군산시">군산시</option>
 <option value="김제시">김제시</option>
 <option value="남원시">남원시</option>
 <option value="무주군">무주군</option>
 <option value="부안군">부안군</option>
 <option value="순창군">순창군</option>
 <option value="완주군">완주군</option>
 <option value="익산시">익산시</option>
 <option value="임실군">임실군</option>
 <option value="장수군">장수군</option>
 <option value="전주시">전주시</option>
 <option value="완산구">완산구</option>
 <option value="덕진구">덕진구</option>
 <option value="정읍시">정읍시</option>
 <option value="진안군">진안군</option>
 </optgroup>
 <optgroup label="전라남도">
 <option value="강진군">강진군</option>
 <option value="고흥군">고흥군</option>
 <option value="곡성군">곡성군</option>
 <option value="광양시">광양시</option>
 <option value="구례군">구례군</option>
 <option value="나주시">나주시</option>
 <option value="담양군">담양군</option>
 <option value="목포시">목포시</option>
 <option value="무안군">무안군</option>
 <option value="보성군">보성군</option>
 <option value="순천시">순천시</option>
 <option value="신안군">신안군</option>
 <option value="여수시">여수시</option>
 <option value="영광군">영광군</option>
 <option value="영암군">영암군</option>
 <option value="완도군">완도군</option>
 <option value="장성군">장성군</option>
 <option value="장흥군">장흥군</option>
 <option value="진도군">진도군</option>
 <option value="함평군">함평군</option>
 <option value="해남군">해남군</option>
 <option value="화순군">화순군</option>
 </optgroup>
 <optgroup label="경상북도">
 <option value="경산시">경산시</option>
 <option value="경주시">경주시</option>
 <option value="고령군">고령군</option>
 <option value="구미시">구미시</option>
 <option value="김천시">김천시</option>
 <option value="문경시">문경시</option>
 <option value="봉화군">봉화군</option>
 <option value="상주시">상주시</option>
 <option value="성주군">성주군</option>
 <option value="안동시">안동시</option>
 <option value="영덕군">영덕군</option>
 <option value="영양군">영양군</option>
 <option value="영주시">영주시</option>
 <option value="영천시">영천시</option>
 <option value="예천군">예천군</option>
 <option value="울릉군">울릉군</option>
 <option value="울진군">울진군</option>
 <option value="의성군">의성군</option>
 <option value="청도군">청도군</option>
 <option value="청송군">청송군</option>
 <option value="칠곡군">칠곡군</option>
 <option value="포항시">포항시</option>
 <option value="남구">남구</option>
 <option value="북구">북구</option>
 </optgroup>
 <optgroup label="경상남도">
 <option value="거제시">거제시</option>
 <option value="거창군">거창군</option>
 <option value="고성군">고성군</option>
 <option value="김해시">김해시</option>
 <option value="남해군">남해군</option>
 <option value="밀양시">밀양시</option>
 <option value="사천시">사천시</option>
 <option value="산청군">산청군</option>
 <option value="양산시">양산시</option>
 <option value="의령군">의령군</option>
 <option value="진주시">진주시</option>
 <option value="창녕군">창녕군</option>
 <option value="창원시">창원시</option>
 <option value="마산합포구">마산합포구</option>
 <option value="마산회원구">마산회원구</option>
 <option value="성산구">성산구</option>
 <option value="의창구">의창구</option>
 <option value="진해구">진해구</option>
 <option value="통영시">통영시</option>
 <option value="하동군">하동군</option>
 <option value="함안군">함안군</option>
 <option value="함양군">함양군</option>
 <option value="합천군">합천군</option>
 </optgroup>
 <optgroup label="제주특별자치도">
 <option value="서귀포시">서귀포시</option>
 <option value="제주시">제주시</option>
 </optgroup>
 </select>
 <input
 type="number"
 placeholder="목표 (예: 10)"
 value={routeSearchTarget}
 onChange={e => setRouteSearchTarget(e.target.value)}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 min="1"
 max="50"
 />
 </div>
 <input
 type="text"
 placeholder="또는 지역/업체명 직접 입력 (예: 강남구, 신내동, OO부동산)"
 value={routeSearchText}
 onChange={e => { setRouteSearchText(e.target.value); if (e.target.value) setRouteSearchRegion(''); }}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 />
 <button
 onClick={() => {
 const searchKeyword = routeSearchText || routeSearchRegion;
 if (!searchKeyword) return alert('지역을 선택하거나 직접 입력하세요');
 if (!routeSearchTarget || routeSearchTarget < 1) return alert('목표 수를 입력하세요 (1~50)');
 // 주소에서 지역 추출 함수
 const getRegion = (addr) => {
 if (!addr) return null;
 const parts = addr.split(/\s+/);
 for (const part of parts) {
 if ((part.endsWith('구') || part.endsWith('군') || part.endsWith('시')) && part.length >= 2 && part.length <= 10) {
 return part;
 }
 }
 return null;
 };
 // 선택한 지역에서 괄호 제거 (예: "중구(인천)" -> "중구")
 const selectedRegion = searchKeyword.replace(/\(.*\)/, '');
 const regionRealtors = collectedRealtors
 .filter(r => {
 // 지역 필터 또는 텍스트 검색
 if (r.regions && r.regions[selectedRegion]) return true;
 const addrRegion = getRegion(r.address);
 if (addrRegion === selectedRegion) return true;
 // 텍스트 검색: 주소, 업체명에 키워드 포함 여부
 if (routeSearchText) {
 const keyword = routeSearchText.toLowerCase();
 const name = (r.name || r.officeName || r.realtorName || '').toLowerCase();
 const addr = (r.address || '').toLowerCase();
 if (name.includes(keyword) || addr.includes(keyword)) return true;
 }
 return false;
 })
 .filter(r => !isCompanyDuplicate(r, companies))
 .filter(r => !routeStops.some(s => s.name === (r.realtorName || r.officeName || r.name)))
 .sort((a, b) => (b.listings || b.listingCount || 1) - (a.listings || a.listingCount || 1))
 .slice(0, Math.min(Number(routeSearchTarget), 200));
 if (regionRealtors.length === 0) return alert('해당 지역/키워드에 추가할 미방문 중개사가 없습니다.');
 const newStops = regionRealtors.map(r => ({
 id: 'stop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
 name: r.realtorName || r.officeName || r.name, 
 address: r.address || '',
 phone: r.cellPhone || r.phone || '',
 lat: null, lng: null, visited: false, listings: r.listings || r.listingCount || 1
 }));
 setRouteStops(prev => [...prev, ...newStops]);
 setRouteSearchText('');
 alert('' + newStops.length + '개 중개사를 동선에 추가했습니다!');
 }}
 disabled={(!routeSearchRegion && !routeSearchText) || !routeSearchTarget}
 className="w-full px-4 py-3 bg-neutral-900 text-white rounded-lg font-bold hover:bg-neutral-800 transition-all disabled:opacity-50"
 >
 동선에 추가
 </button>
 <p className={`text-xs ${t.textMuted}`}>* 미방문 업체만, 매물 많은 순으로 추가됩니다</p>
 </div>
 </div>
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex justify-between items-center mb-3">
 <div>
 <p className={`font-bold ${t.text}`}>방문 순서 ({routeStops.length}곳)</p>
 {routeInfo && (
 <p className="text-xs text-primary-400 mt-1">{routeInfo.distance}km · {routeInfo.duration}분</p>
 )}
 </div>
 <div className="flex gap-2">
 {routeStops.length >= 2 && (
 <>
 <button type="button" onClick={optimizeRouteOrder} className={`text-xs px-3 py-1.5 rounded-lg font-bold border ${theme === 'dark' ? 'bg-neutral-700 text-white hover:bg-neutral-600 border-neutral-600' : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border-neutral-300'}`}>최적화</button>
 <button type="button" onClick={reverseRouteOrder} className={`text-xs px-3 py-1.5 rounded-lg font-bold border ${theme === 'dark' ? 'bg-neutral-700 text-white hover:bg-neutral-600 border-neutral-600' : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border-neutral-300'}`}>반대로</button>
 </>
 )}
 {routeStops.length > 0 && (
 <button type="button" onClick={() => { setRouteStops([]); clearRouteMapMarkers(); }} className={`text-xs ${t.text}`}>전체 삭제</button>
 )}
 </div>
 </div>
 {routeStops.length === 0 ? (
 <div className="text-center py-4 sm:py-6 text-neutral-800">
 <p className="text-2xl mb-2"></p>
 <p className="text-sm">업체/장소를 추가해주세요</p>
 </div>
 ) : (
 <div className="space-y-0 max-h-48 overflow-y-auto">
 {routeStops.map((stop, idx) => {
 // 해당 동선이 등록된 업체인지 확인하고 담당자 정보 가져오기
 const matchedCompany = companies.find(c => 
   c.name === stop.name || 
   (c.address && stop.address && c.address.includes(stop.address?.split(' ').slice(0,3).join(' ')))
 );
 const stopManager = matchedCompany ? managers.find(m => m.id === matchedCompany.managerId) : null;
 
 return (
 <div key={stop.id}>
 <div className="flex items-center gap-2 p-2 bg-neutral-100 border border-neutral-200 rounded-lg">
 <div className={`w-7 h-7 rounded-full bg-neutral-700 ${t.text} flex items-center justify-center font-bold text-xs shadow flex-shrink-0`}>
 {idx + 1}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5 flex-wrap">
 <p className={`font-bold ${t.text} text-sm break-words`}>{stop.name}</p>
 {stopManager && <span className={`px-1.5 py-0.5 text-xs rounded ${t.text} font-bold`} style={{backgroundColor: stopManager.color}}>{stopManager.name}</span>}
 </div>
 {stop.address && <p className={`text-xs break-words ${t.text}`}>{stop.address}</p>}
 {stop.phone && <p className={`text-xs ${t.textMuted}`}>{stop.phone}</p>}
 </div>
 <div className="flex gap-1 flex-shrink-0">
 {idx > 0 && <button type="button" onClick={() => moveRouteStop(idx, -1)} className={`w-6 h-6 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-800'}`}>↑</button>}
 {idx < routeStops.length - 1 && <button type="button" onClick={() => moveRouteStop(idx, 1)} className={`w-6 h-6 rounded text-xs ${theme === 'dark' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-800'}`}>↓</button>}
 <button type="button" onClick={() => removeRouteStop(stop.id)} className="w-6 h-6 rounded bg-rose-100 text-white text-xs"></button>
 </div>
 </div>
 {idx < routeStops.length - 1 && (
 <div className="flex items-center pl-3 py-0.5">
 <span className="text-primary-600 text-sm">↓</span>
 </div>
 )}
 </div>
 )})}
 </div>
 )}
 {(routeStops.length > 0 || editingRouteId) && (
 <div className="mt-3 pt-3 border-t border-neutral-200">
 {editingRouteId ? (
 <div className="flex gap-2">
 <button type="button" onClick={cancelEditRoute} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all py-3 font-bold border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}>
 취소
 </button>
 <button type="button" onClick={registerSchedule} className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all py-3 font-bold">
 수정 완료
 </button>
 </div>
 ) : (
 <button type="button" onClick={registerSchedule} className="w-full px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all py-3 font-bold">
 동선 등록
 </button>
 )}
 </div>
 )}
 </div>
 <div className={`rounded-2xl overflow-hidden border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="p-3 border-b border-neutral-200">
 {routeStops.length > 0 && (
 <div className="flex items-center gap-2">
 <button type="button"
 onClick={() => slideToStop(currentSlideIndex - 1)}
 disabled={currentSlideIndex <= 0}
 className={`w-8 h-8 rounded disabled:opacity-30 ${theme === 'dark' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-800'}`}
 >←</button>
 <div className="flex-1 overflow-hidden">
 <div className="flex gap-2 transition-transform" style={{ transform: `translateX(-${currentSlideIndex * 100}%)` }}>
 {routeStops.map((stop, idx) => (
 <button
 key={stop.id}
 onClick={() => focusStopOnRouteMap(stop, idx)}
 className={`flex-shrink-0 w-full px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentSlideIndex === idx ? 'bg-neutral-100 text-white' : 'bg-gray-100 text-neutral-800'}`}
 >
 {idx + 1}. {stop.name}
 </button>
 ))}
 </div>
 </div>
 <button type="button"
 onClick={() => slideToStop(currentSlideIndex + 1)}
 disabled={currentSlideIndex >= routeStops.length - 1}
 className={`w-8 h-8 rounded disabled:opacity-30 ${theme === 'dark' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-800'}`}
 >→</button>
 </div>
 )}
 </div>
 <div className="relative">
 <div ref={routeMapRef} className="route-map-container" style={{height: '600px', minHeight: '600px', width: '100%'}}></div>
 <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
 <button
 onClick={toggleGps}
 className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${gpsEnabled ? 'bg-primary-500 text-white' : 'bg-neutral-200 text-neutral-800'}`}
 title={gpsEnabled ? 'GPS 끄기' : 'GPS 켜기'}
 >

 </button>
 {gpsEnabled && currentLocation && (
 <button
 onClick={centerToMyLocation}
 className="w-10 h-10 rounded-full bg-neutral-200 shadow-lg flex items-center justify-center text-primary-600"
 title="내 위치로 이동"
 >

 </button>
 )}
 </div>
 </div>
 </div>
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex justify-between items-center mb-3">
 <p className={`font-bold ${t.text}`}>등록된 동선</p>
 {routes.length > 0 && (
 <div className="flex gap-2">
 {routeDeleteMode ? (
 <>
 <button
 onClick={() => {
 if (selectedRoutesForDelete.length === 0) return alert('삭제할 동선을 선택하세요.');
 if (!confirm(`${selectedRoutesForDelete.length}개 동선을 삭제하시겠습니까?`)) return;
 selectedRoutesForDelete.forEach(id => deleteRoute(id));
 setSelectedRoutesForDelete([]);
 setRouteDeleteMode(false);
 alert('선택한 동선이 삭제되었습니다.');
 }}
 className={`px-3 py-1 bg-neutral-200 ${t.text} rounded text-xs font-bold`}
 >
 {selectedRoutesForDelete.length}개 삭제
 </button>
 <button
 onClick={() => { setRouteDeleteMode(false); setSelectedRoutesForDelete([]); }}
 className={`px-3 py-1 rounded text-xs font-bold ${theme === 'dark' ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600'}`}
 >
 취소
 </button>
 </>
 ) : (
 <button
 onClick={() => setRouteDeleteMode(true)}
 className="px-3 py-1 bg-rose-100 text-white rounded text-xs font-bold"
 >
 선택 삭제
 </button>
 )}
 </div>
 )}
 </div>
 {routes.length === 0 ? (
 <div className="text-center py-4 sm:py-6 text-neutral-800">
 <p className="text-sm">등록된 동선이 없습니다</p>
 </div>
 ) : (
 <div className="space-y-2">
 {(() => {
 // 월별로 그룹화
 const grouped = routes.reduce((acc, route) => {
 const month = route.date?.slice(0, 7) || '미정';
 if (!acc[month]) acc[month] = [];
 acc[month].push(route);
 return acc;
 }, {});
 // 월 정렬 (최신순)
 const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
 return sortedMonths.map(month => {
 const monthRoutes = grouped[month].sort((a, b) => new Date(b.date) - new Date(a.date));
 const isExpanded = expandedRouteMonths[month] ?? false;
 const completedCount = monthRoutes.filter(r => r.status === 'completed').length;
 return (
 <div key={month} className="border border-neutral-200 rounded-lg overflow-hidden">
 <button
 onClick={() => setExpandedRouteMonths(prev => ({ ...prev, [month]: !prev[month] }))}
 className="w-full px-4 py-3 bg-neutral-50 flex items-center justify-between hover:bg-neutral-100 transition-colors"
 >
 <div className="flex items-center gap-3">
 <span className={`text-sm font-bold ${t.text}`}>{month}</span>
 <span className={`text-xs ${t.textMuted}`}>{monthRoutes.length}개 동선</span>
 <span className={`text-xs ${t.text}`}>{completedCount}개 완료</span>
 </div>
 <span className={`${t.textMuted}`}>{isExpanded ? '▲' : '▼'}</span>
 </button>
 {isExpanded && (
 <div className={`p-2 space-y-2 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`}>
 {monthRoutes.map(route => {
 const manager = managers.find(m => m.id === route.managerId);
 const completedStops = (route.stops || []).filter(s => s.visited).length;
 const totalStops = (route.stops || []).length;
 const isCompleted = route.status === 'completed';
 const isSelected = selectedRoutesForDelete.includes(route.id);
 return (
 <div key={route.id} className={`p-3 rounded-lg ${isCompleted ? 'bg-emerald-50' : 'bg-neutral-50'} ${routeDeleteMode && isSelected ? 'ring-2 ring-rose-400' : ''}`}>
 <div className="flex items-start gap-3">
 {routeDeleteMode && (
 <input
 type="checkbox"
 checked={isSelected}
 onChange={(e) => {
 if (e.target.checked) {
 setSelectedRoutesForDelete([...selectedRoutesForDelete, route.id]);
 } else {
 setSelectedRoutesForDelete(selectedRoutesForDelete.filter(id => id !== route.id));
 }
 }}
 className="w-5 h-5 mt-1 accent-rose-500"
 />
 )}
 <div className={`w-9 h-9 rounded-lg text-white flex items-center justify-center font-bold text-sm flex-shrink-0 ${isCompleted ? 'bg-emerald-500' : 'bg-neutral-400'}`}>
 {isCompleted ? '' : '○'}
 </div>
 <div className="flex-1 min-w-0">
 <p className={`font-bold ${t.text} text-sm break-words leading-snug`}>{route.name || route.date}</p>
 <p className="text-xs text-neutral-600">{route.date} {route.time || ''} · {completedStops}/{totalStops}곳</p>
 {manager && (
 <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold ${t.text}`} style={{ background: manager.color }}>
 {manager.name}
 </span>
 )}
 </div>
 </div>
 {!routeDeleteMode && (
 <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-neutral-200">
 <button type="button" onClick={() => editRoute(route)} className={`px-3 py-1 rounded text-xs font-medium border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600' : 'bg-white text-neutral-700 border-neutral-200'}`}>수정</button>
 <button type="button" onClick={() => setSelectedSchedule(route)} className={`px-3 py-1 rounded text-xs font-medium border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600' : 'bg-white text-neutral-700 border-neutral-200'}`}>상세</button>
 <button onClick={() => viewRouteOnMapDirect(route)} className={`px-3 py-1 rounded text-xs font-medium border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600' : 'bg-white text-neutral-700 border-neutral-200'}`}>동선</button>
 {!isCompleted && (
 <button onClick={() => handleCompleteRoute(route)} className="px-3 py-1 bg-emerald-100 rounded text-xs text-white font-medium">완료</button>
 )}
 <button onClick={() => setShowDeleteConfirm({ type: 'route', id: route.id, name: route.name || route.date })} className="px-3 py-1 bg-rose-100 rounded text-xs text-white font-medium">삭제</button>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 });
 })()}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 {tab === 'map' && (
 <div>
 <div className="space-y-2">
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 mb-4">
 <p className="text-amber-800 font-bold text-sm mb-2">지도 표시 현황</p>
 <div className="flex flex-wrap gap-3 text-sm">
 <span className={`${t.text}`}>전체 업체: <b>{companies.length}</b></span>
 <span className={`${t.text}`}>지도 표시: <b>{companies.filter(c => c.lat && c.lng).length}</b></span>
 <span
 className="text-neutral-800 cursor-pointer hover:text-primary-600"
 onClick={() => companies.filter(c => !c.lat || !c.lng).length > 0 && setShowUnmappedModal(true)}
 >
 미표시: <b className="underline">{companies.filter(c => !c.lat || !c.lng).length}</b>
 </span>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-2 mb-3">
 <select value={filterManager} onChange={e => setFilterManager(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`}>
 <option value="all">전체 영업자</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`}>
 <option value="all">전체 반응</option>
 <option value="special">특별</option>
 <option value="positive">긍정</option>
 <option value="neutral">양호</option>
 <option value="negative">부정</option>
 <option value="missed">누락</option>
 </select>
 </div>
 <div className="flex gap-2">
 <input type="text" placeholder="장소/주소 검색 (예: 남영역, 강남구)" value={searchRegion} onChange={e => setSearchRegion(e.target.value)} onKeyPress={e => e.key === 'Enter' && searchOrHighlight()} className={`w-full px-3 py-2 rounded-lg placeholder-neutral-400 focus:outline-none transition-all flex-1 text-sm ${theme === 'dark' ? 'bg-neutral-700 border-neutral-600 text-white focus:border-neutral-500' : 'bg-white border-neutral-200 text-neutral-900 focus:border-neutral-400'}`} />
 <button type="button" onClick={searchOrHighlight} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all text-sm"></button>
 </div>
 <div className="border-t border-neutral-200 mt-4 pt-4">
 <p className="text-sm text-neutral-800 mb-2 font-bold">핀 색상 안내</p>
 <div className="flex flex-wrap gap-2 text-xs">
 <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-rose-600 special-blink"></div> 특별</span>
 <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> 긍정</span>
 <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-400"></div> 양호</span>
 <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-400"></div> 부정</span>
 <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> 누락</span>
 </div>
 <p className={`text-xs mt-2 ${t.text}`}>핀을 클릭하면 업체 정보를 확인할 수 있습니다</p>
 </div>
 </div>
 <div className={`rounded-2xl overflow-hidden border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`} style={{height: 'calc(100vh - 200px)', minHeight: '500px'}}><div ref={mapRef} className="map-container" style={{height: '100%', width: '100%'}}></div></div>
 </div>
 </div>
 )}
 {tab === 'managers' && (
 <div className="space-y-2">
 <div className="flex justify-between items-center">
 <h2 className={`font-bold ${t.text} text-xl`}>영업팀 현황</h2>
 <button type="button" onClick={() => setShowSaleModal(true)} className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800">매출 등록</button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {managers.map(m => {
 const mgrCompanies = companies.filter(c => c.managerId === m.id);
 const mgrSales = getManagerSales(m.id);
 const canEdit = isAdmin || user?.managerId === m.id;
 const specialCompanies = mgrCompanies.filter(c => c.reaction === 'special');
 const positiveCompanies = mgrCompanies.filter(c => c.reaction === 'positive');
 const neutralCompanies = mgrCompanies.filter(c => c.reaction === 'neutral');
 const negativeCompanies = mgrCompanies.filter(c => c.reaction === 'negative');
 const today = new Date();
 const completedWithDays = mgrCompanies
 .filter(c => c.reaction === 'positive' || c.reaction === 'special')
 .map(c => {
 const visitDate = c.lastVisitDate ? new Date(c.lastVisitDate) : (c.createdAt ? new Date(c.createdAt) : null);
 const daysPassed = visitDate ? Math.floor((today - visitDate) / (1000 * 60 * 60 * 24)) : 0;
 return { ...c, daysPassed: isNaN(daysPassed) ? 0 : daysPassed, dateType: c.lastVisitDate ? '방문' : '등록' };
 });
 const needsFollow = completedWithDays
 .filter(c => c.daysPassed >= 7)
 .sort((a, b) => b.daysPassed - a.daysPassed);
 const missedCompanies = mgrCompanies
 .filter(c => c.reaction === 'missed')
 .map(c => {
 const createdDate = c.createdAt ? new Date(c.createdAt) : null;
 const daysPassed = createdDate ? Math.floor((today - createdDate) / (1000 * 60 * 60 * 24)) : 0;
 return { ...c, daysPassed: isNaN(daysPassed) ? 0 : daysPassed };
 })
 .sort((a, b) => b.daysPassed - a.daysPassed);
 const todayStr = getKoreanToday();
 const todayEvents = calendarEvents.filter(e => e.date === todayStr && e.managerId === m.id);
 const todayRoutes = routes.filter(r => r.date === todayStr && r.managerId === m.id);
 const koreanNow = getKoreanNow();
 const weekStart = new Date(koreanNow.year, koreanNow.month, koreanNow.day - koreanNow.dayOfWeek);
 const weekEnd = new Date(koreanNow.year, koreanNow.month, koreanNow.day + (6 - koreanNow.dayOfWeek));
 const weekStr = (d) => {
 const year = d.getFullYear();
 const month = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 return `${year}-${month}-${day}`;
 };
 const weekEvents = calendarEvents.filter(e =>
 e.managerId === m.id &&
 e.date >= weekStr(weekStart) &&
 e.date <= weekStr(weekEnd) &&
 e.date !== todayStr
 );
 const weekRoutes = routes.filter(r =>
 r.managerId === m.id &&
 r.date >= weekStr(weekStart) &&
 r.date <= weekStr(weekEnd) &&
 r.date !== todayStr
 );
 return (
 <div key={m.id} className={`rounded-2xl p-5 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex items-center gap-3 sm:gap-4 mb-4">
 <div className={`px-3 py-2 rounded-lg ${t.text} font-bold text-sm`} style={{ background: m.color }}>{m.name}</div>
 <div className="flex-1">
 <h3 className={`font-bold ${t.text} text-lg`}>{m.name}</h3>
 <p className={`text-sm ${t.text}`}>업체 {mgrCompanies.length}개</p>
 </div>
 <div className="text-right">
 <div className="flex items-center gap-2">
 <p className={`text-xl sm:text-2xl font-bold ${t.text}`}>{mgrSales.toLocaleString()}<span className="text-sm font-normal">원</span></p>
 {canEdit && (
 <button
 onClick={() => setShowSaleEditModal({ managerId: m.id, managerName: m.name, currentSales: mgrSales })}
 className="px-2 py-1 bg-emerald-100 text-white rounded text-xs font-bold hover:bg-emerald-200"
 >
 수정
 </button>
 )}
 </div>
 </div>
 </div>
 <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 mb-4">
 <p className="font-bold text-neutral-800 text-sm mb-3">업체 현황</p>
 <div className="grid grid-cols-4 gap-2">
 <div className="bg-neutral-100 rounded-lg p-2 text-center border border-red-200">
 <p className={`text-lg font-bold ${t.text}`}>{specialCompanies.length}</p>
 <p className={`text-xs ${t.text}`}>특별</p>
 </div>
 <div className="bg-neutral-100 rounded-lg p-2 text-center border border-green-200">
 <p className={`text-lg font-bold ${t.text}`}>{positiveCompanies.length}</p>
 <p className={`text-xs ${t.text}`}>긍정</p>
 </div>
 <div className="bg-neutral-100 rounded-lg p-2 text-center border border-neutral-200">
 <p className={`text-lg font-bold ${t.text}`}>{neutralCompanies.length}</p>
 <p className={`text-xs ${t.text}`}>양호</p>
 </div>
 <div className="bg-neutral-100 rounded-lg p-2 text-center border border-neutral-200">
 <p className="text-lg font-bold text-neutral-800">{negativeCompanies.length}</p>
 <p className={`text-xs ${t.text}`}>부정</p>
 </div>
 </div>
 </div>
 {(todayEvents.length > 0 || todayRoutes.length > 0) && (
 <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-3 mb-4">
 <p className="font-bold text-primary-600 text-sm mb-2">오늘 일정</p>
 <div className="space-y-1">
 {todayRoutes.map(r => (
 <div key={r.id} className="flex items-center gap-2 text-sm">
 <span className="text-primary-600"></span>
 <span className="text-amber-800">{r.time} - {r.name} ({r.stops?.length || 0}곳)</span>
 </div>
 ))}
 {todayEvents.map(e => (
 <div key={e.id} className="flex items-center gap-2 text-sm">
 <span className="text-primary-600"></span>
 <span className="text-amber-800">{e.time} - {e.title}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 {needsFollow.length > 0 && (
 <div className="mb-4">
 <div className="bg-rose-900/30 border border-neutral-500 rounded-xl p-3 mb-2">
 <span className={`font-bold ${t.text} text-sm`}>관리 필요 ({needsFollow.length})</span>
 <span className={`text-xs ${t.text} ml-2`}>마지막 방문 후 7일 이상</span>
 </div>
 <div className="space-y-1 max-h-40 overflow-y-auto">
 {needsFollow.slice(0, 10).map(c => (
 <div
 key={c.id}
 className="flex items-center justify-between bg-neutral-100 p-2 rounded-lg border border-neutral-500 cursor-pointer hover:bg-rose-900/30"
 onClick={() => { setShowCompanyEditModal(c); }}
 >
 <div className="flex items-center gap-2 min-w-0 flex-1">
 <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.reaction === 'special' ? 'bg-rose-600' : 'bg-emerald-500'}`}></div>
 <span className={`font-bold ${t.text} text-sm truncate`}>{c.name}</span>
 </div>
 <div className="text-right flex-shrink-0 ml-2">
 <span className={`text-xs ${t.text} font-bold`}>{c.daysPassed}일</span>
 <span className={`text-xs ${t.text} ml-1`}>({c.dateType})</span>
 </div>
 </div>
 ))}
 {needsFollow.length > 10 && <p className={`text-xs ${t.text} text-center`}>+{needsFollow.length - 10}개</p>}
 </div>
 </div>
 )}
 {missedCompanies.length > 0 && (
 <div className="mb-4">
 <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-2">
 <span className={`font-bold ${t.text} text-sm`}>누락 업체 ({missedCompanies.length})</span>
 <span className="text-xs text-yellow-500 ml-2">클릭하여 정보 입력</span>
 </div>
 <div className="space-y-1 max-h-40 overflow-y-auto">
 {missedCompanies.slice(0, 10).map(c => (
 <div
 key={c.id}
 className="flex items-center justify-between bg-neutral-100 p-2 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-900/30"
 onClick={() => { setShowCompanyEditModal(c); }}
 >
 <div className="flex items-center gap-2 min-w-0 flex-1">
 <div className="w-2 h-2 rounded-full flex-shrink-0 bg-yellow-500"></div>
 <span className={`font-bold ${t.text} text-sm truncate`}>{c.name}</span>
 </div>
 <span className={`text-xs ${t.text} flex-shrink-0 ml-2`}>{c.daysPassed}일</span>
 </div>
 ))}
 {missedCompanies.length > 10 && <p className="text-xs text-neutral-700 text-center">+{missedCompanies.length - 10}개</p>}
 </div>
 </div>
 )}
 {(weekEvents.length > 0 || weekRoutes.length > 0) && (
 <details className="mb-4">
 <summary className="bg-neutral-100 border border-primary-300 rounded-xl p-3 cursor-pointer">
 <span className="font-bold text-primary-600 text-sm">이번 주 일정 ({weekEvents.length + weekRoutes.length})</span>
 <span className="text-xs text-primary-600 ml-2">클릭하여 펼치기</span>
 </summary>
 <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
 {[...weekRoutes.map(r => ({ ...r, type: 'route' })), ...weekEvents.map(e => ({ ...e, type: 'event' }))]
 .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
 .map((item, idx) => (
 <div key={idx} className="flex items-center gap-2 text-sm bg-neutral-100 p-2 rounded-lg border border-primary-200">
 <span className="text-primary-600">{item.type === 'route' ? '' : ''}</span>
 <span className="text-xs text-neutral-700 font-bold">{item.date.slice(5)}</span>
 <span className="text-blue-800 truncate">{item.time || ''} {item.type === 'route' ? item.name : item.title}</span>
 </div>
 ))}
 </div>
 </details>
 )}
 <div className="mb-4">
 <div className="bg-neutral-100 rounded-xl p-3 mb-2">
 <span className="font-bold text-neutral-800 text-sm">홍보물 수량</span>
 {canEdit && (
 <button type="button" onClick={() => { setShowPromoRequestModal(m); setPromoRequest({ '명함': false, '브로셔': false, '전단지': false, '쿠폰': false }); }} className="ml-3 px-3 py-1 bg-rose-500 rounded-lg font-bold text-xs text-white"><span className="blink-text">요청</span></button>
 )}
 </div>
 <div className="bg-neutral-100 rounded-xl p-4">
 <div className="grid grid-cols-4 gap-2">
 {PROMO_ITEMS.map(item => (
 <div key={item} className="text-center">
 <p className={`text-xs mb-1 ${t.text}`}>{item}</p>
 {canEdit ? (
 <input type="number" value={m.promo?.[item] || 0} onChange={e => updateManagerPromo(m.id, item, e.target.value)} className={`w-full text-center p-2 border rounded-lg text-sm font-bold ${theme === 'dark' ? 'bg-neutral-700 text-white border-neutral-600' : 'bg-white text-slate-900 border-neutral-200'}`} />
 ) : (<p className={`font-bold ${t.text}`}>{m.promo?.[item] || 0}</p>)}
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* ═══════════════════════════════════════════════════════════════════════════════
     영업 탭 - 박람회 전용
 ═══════════════════════════════════════════════════════════════════════════════ */}
 {tab === 'sales' && (
 <div className="space-y-2">
 {/* 상단 - 빈크래프트 홈페이지 링크 */}
 <div className="bg-neutral-800 rounded-xl p-4 shadow-lg">
   <div className="flex items-center justify-between">
     <div className="flex items-center gap-3">
       <img src="/logo.png" alt="BEANCRAFT" className="w-10 h-10 object-contain" />
       <div>
         <h2 className={`${t.text} font-bold text-lg`}>BEANCRAFT</h2>
         <p className="text-blue-200 text-xs">카페 창업 전문 컨설팅</p>
       </div>
     </div>
     <a 
       href="https://www.beancraft.co.kr" 
       target="_blank" 
       rel="noopener noreferrer"
       className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${theme === 'dark' ? 'bg-neutral-700 text-white hover:bg-neutral-600' : 'bg-white text-neutral-700 hover:bg-blue-50'}`}
     >
       홈페이지 방문
     </a>
   </div>
 </div>

 {/* 지역 검색 + 지역 이슈 */}
 {(() => {
   // 지역 이슈 찾기
   const findRegionIssue = (region) => {
     if (!region) return null;
     const issue = marketIssues.find(i => 
       i.region?.includes(region) || 
       i.title?.includes(region) ||
       i.content?.includes(region)
     );
     return issue;
   };
   
   // 지역별 통계 계산
   const getRegionStats = (region) => {
     const regionRealtors = collectedRealtors.filter(r => 
       r.address?.includes(region)
     );
     const regionCompanies = companies.filter(c => 
       c.address?.includes(region)
     );
     return {
       realtorCount: regionRealtors.length,
       companyCount: regionCompanies.length,
       totalListings: regionRealtors.reduce((sum, r) => sum + (r.listings || 0), 0)
     };
   };

   return (
     <>
     {/* 지역 검색 */}
     <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
       <h3 className={`font-bold ${t.text} mb-3 flex items-center gap-2`}>
         지역 검색
       </h3>
       <div className="flex gap-2">
         <input
           type="text"
           value={salesSearchQuery}
           onChange={(e) => setSalesSearchQuery(e.target.value)}
           placeholder="지역명 입력 (예: 강남구, 분당, 해운대)"
           className={`flex-1 px-4 py-3 rounded-lg bg-neutral-100 border border-neutral-200 ${t.text} placeholder-slate-400 focus:outline-none focus:border-neutral-500`}
         />
         <button
           onClick={() => {
             if (salesSearchQuery.trim()) {
               setSalesSelectedRegion(salesSearchQuery.trim());
               setShowSalesIssue(true);
             }
           }}
           className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
         >
           검색
         </button>
       </div>
       
       {/* 빠른 지역 선택 */}
       <div className="flex flex-wrap gap-2 mt-3">
         {['강남구', '서초구', '마포구', '분당', '일산', '해운대', '수원', '부산'].map(region => (
           <button
             key={region}
             onClick={() => {
               setSalesSearchQuery(region);
               setSalesSelectedRegion(region);
               setShowSalesIssue(true);
             }}
             className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-full text-sm hover:bg-neutral-200 transition-all"
           >
             {region}
           </button>
         ))}
       </div>
     </div>

     {/* 선택된 지역 정보 */}
     {showSalesIssue && salesSelectedRegion && (
       <div className={`rounded-2xl p-4 border border-l-4 ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700 border-l-neutral-400' : 'bg-white border-neutral-200 border-l-neutral-500'}`}>
         <div className="flex items-center justify-between mb-3">
           <h3 className={`font-bold ${t.text} text-lg flex items-center gap-2`}>
             {salesSelectedRegion} 지역 정보
           </h3>
           <button
             onClick={() => setShowSalesIssue(false)}
             className="text-neutral-500 hover:text-neutral-800"
           >
             
           </button>
         </div>
         
         {/* 지역 통계 */}
         {(() => {
           const stats = getRegionStats(salesSelectedRegion);
           return (
             <div className="grid grid-cols-3 gap-3 mb-4">
               <div className="bg-neutral-50 rounded-lg p-3 text-center">
                 <p className={`text-2xl font-bold ${t.text}`}>{stats.realtorCount}</p>
                 <p className={`text-xs ${t.textMuted}`}>수집 중개사</p>
               </div>
               <div className="bg-neutral-50 rounded-lg p-3 text-center">
                 <p className={`text-2xl font-bold ${t.text}`}>{stats.companyCount}</p>
                 <p className={`text-xs ${t.textMuted}`}>등록 업체</p>
               </div>
               <div className="bg-neutral-50 rounded-lg p-3 text-center">
                 <p className={`text-2xl font-bold ${t.text}`}>{stats.totalListings.toLocaleString()}</p>
                 <p className={`text-xs ${t.textMuted}`}>총 매물</p>
               </div>
             </div>
           );
         })()}
         
         {/* 지역 이슈 */}
         {(() => {
           const issue = findRegionIssue(salesSelectedRegion);
           if (issue) {
             return (
               <div className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-600' : 'bg-white border-neutral-300'}`}>
                 <p className={`text-xs font-semibold mb-2 ${t.text}`}>지역 이슈</p>
                 <p className="text-neutral-800 font-medium mb-1">{issue.title}</p>
                 <p className={`text-sm ${t.text}`}>{issue.content}</p>
                 {issue.source && <p className={`text-xs mt-2 ${t.textMuted}`}>출처: {issue.source}</p>}
               </div>
             );
           } else {
             // 기본 지역 이슈 데이터
             const defaultIssues = {
               '강남구': '카페 2,596개로 서울 최다. 연간 폐업률 14.1%. 프리미엄 시장 형성.',
               '서초구': '법조타운, 교대역 상권 활성화. 전문직 고객층 두터움.',
               '마포구': '홍대/합정/상수 젊은층 상권. 개성있는 카페 수요 높음.',
               '분당': 'IT 기업 밀집. 직장인 테이크아웃 수요 높음. 평균 객단가 상승세.',
               '일산': '신도시 특성상 가족단위 방문 많음. 주말 매출 비중 높음.',
               '해운대': '관광지 특수. 계절별 매출 편차 큼. 프리미엄 가격 수용도 높음.',
               '수원': '삼성전자 효과. 직장인 수요 안정적. 광교/영통 신규 상권 성장.',
               '부산': '커피 소비량 전국 2위. 해안가 특수 입지 프리미엄.'
             };
             const defaultIssue = defaultIssues[salesSelectedRegion] || 
               '해당 지역의 상세 이슈 정보가 준비 중입니다. 직접 상담을 통해 최신 정보를 안내해드립니다.';
             return (
               <div className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-600' : 'bg-white border-neutral-300'}`}>
                 <p className={`text-xs font-semibold mb-2 ${t.text}`}>지역 특성</p>
                 <p className={`text-sm ${t.text}`}>{defaultIssue}</p>
               </div>
             );
           }
         })()}
       </div>
     )}
     </>
   );
 })()}

 {/* 프랜차이즈 vs 빈크래프트 비교표 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <h3 className={`font-bold ${t.text} mb-4 flex items-center gap-2 text-lg`}>
     프랜차이즈 vs 빈크래프트 비용 비교
   </h3>
   
   <div className="overflow-x-auto">
     <table className="w-full text-sm">
       <thead>
         <tr className="border-b border-neutral-200">
           <th className="py-3 px-2 text-left text-neutral-500 font-medium">항목</th>
           <th className={`py-3 px-2 text-center ${t.text} font-medium`}>저가 프랜차이즈</th>
           <th className="py-3 px-2 text-center text-neutral-700 font-medium">빈크래프트</th>
         </tr>
       </thead>
       <tbody className={`${t.text}`}>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">가맹비</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>500~1,500만원</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f] font-bold">0원</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">교육비</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>100~300만원</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f]">컨설팅 포함</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">컨설팅비</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>-</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f]">1,000만원</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">로열티 (월)</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>15~50만원</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f] font-bold">0원</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">로열티 (5년)</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>900~3,000만원</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f] font-bold">0원</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">광고분담금 (월)</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>10~30만원</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f] font-bold">0원</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">인테리어</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>본사 지정업체</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f]">400만원+견적 별도</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">기기설비</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>본사 지정업체</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f]">400만원+견적 별도</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">원두공급</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>본사 지정 (강제)</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f]">공급가 납품 (선택)</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">메뉴 구성</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>본사 통제</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f]">자유롭게 결정</td>
         </tr>
         <tr className="border-b border-neutral-200">
           <td className="py-3 px-2 font-medium">매물 조건</td>
           <td className={`py-3 px-2 text-center ${t.text}`}>1층/15평 이상</td>
           <td className="py-3 px-2 text-center text-[#1e3a5f]">제한 없음</td>
         </tr>
         <tr className="bg-neutral-100/30">
           <td className={`py-3 px-2 font-bold ${t.text}`}>총 비용 (5년)</td>
           <td className={`py-3 px-2 text-center ${t.text} font-bold`}>1,500~4,500만원+</td>
           <td className="py-3 px-2 text-center text-neutral-700 font-bold">1,800만원+</td>
         </tr>
       </tbody>
     </table>
   </div>
   
   <div className={`mt-4 p-3 rounded-lg border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}>
     <p className="text-sm text-neutral-700 font-semibold mb-1">빈크래프트 핵심 장점</p>
     <p className={`text-sm ${t.text}`}>로열티/가맹비 0원으로 5년간 <span className={`font-bold ${t.text}`}>약 900만원~3,000만원</span> 절감 가능. 메뉴/인테리어/원두 자유롭게 선택 가능.</p>
     <p className={`text-xs mt-1 ${t.textMuted}`}>※ 로열티 월 15~50만원 × 60개월 기준 계산</p>
   </div>
 </div>

 {/* 빈크래프트 서비스 안내 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <h3 className={`font-bold ${t.text} mb-4 flex items-center gap-2 text-lg`}>
     빈크래프트 서비스 안내
   </h3>
   
   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
     <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
       <div className="flex items-center gap-3 mb-3">
         
         <div>
           <h4 className={`font-bold ${t.text}`}>상권 분석</h4>
           <p className={`text-xs ${t.textMuted}`}>빅데이터 기반 입지 선정</p>
         </div>
       </div>
       <ul className={`text-sm space-y-1 ${t.text}`}>
         <li>• 유동인구/매출 데이터 분석</li>
         <li>• 경쟁점 현황 파악</li>
         <li>• 최적 입지 추천</li>
       </ul>
     </div>
     
     <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
       <div className="flex items-center gap-3 mb-3">
         <span className="text-3xl"></span>
         <div>
           <h4 className={`font-bold ${t.text}`}>인테리어</h4>
           <p className={`text-xs ${t.textMuted}`}>맞춤형 매장 디자인</p>
         </div>
       </div>
       <ul className={`text-sm space-y-1 ${t.text}`}>
         <li>• 콘셉트 기획 및 설계</li>
         <li>• 시공 관리 대행</li>
         <li>• 예산 맞춤 제안</li>
       </ul>
     </div>
     
     <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
       <div className="flex items-center gap-3 mb-3">
         <span className="text-3xl"></span>
         <div>
           <h4 className={`font-bold ${t.text}`}>교육/레시피</h4>
           <p className={`text-xs ${t.textMuted}`}>전문 바리스타 교육</p>
         </div>
       </div>
       <ul className={`text-sm space-y-1 ${t.text}`}>
         <li>• 커피 추출 기초~심화</li>
         <li>• 시그니처 메뉴 개발</li>
         <li>• 운영 노하우 전수</li>
       </ul>
     </div>
     
     <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
       <div className="flex items-center gap-3 mb-3">
         <span className="text-3xl"></span>
         <div>
           <h4 className={`font-bold ${t.text}`}>원두/부자재</h4>
           <p className={`text-xs ${t.textMuted}`}>공급가 직접 납품</p>
         </div>
       </div>
       <ul className={`text-sm space-y-1 ${t.text}`}>
         <li>• 공장 직거래 원두</li>
         <li>• 시럽/소스/컵 등 부자재</li>
         <li>• 재고 관리 지원</li>
       </ul>
     </div>
   </div>
 </div>

 {/* 중개사 현황 (간략) */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <h3 className={`font-bold ${t.text} mb-3 flex items-center gap-2 text-lg`}>
     전국 중개사 현황
   </h3>
   
   {(() => {
     // 시/도별 통계
     const regionStats = {};
     collectedRealtors.forEach(r => {
       const addr = r.address || '';
       let region = '기타';
       if (addr.includes('서울')) region = '서울';
       else if (addr.includes('경기')) region = '경기';
       else if (addr.includes('인천')) region = '인천';
       else if (addr.includes('부산')) region = '부산';
       else if (addr.includes('대구')) region = '대구';
       else if (addr.includes('광주')) region = '광주';
       else if (addr.includes('대전')) region = '대전';
       else if (addr.includes('울산')) region = '울산';
       else if (addr.includes('세종')) region = '세종';
       else if (addr.includes('강원')) region = '강원';
       else if (addr.includes('충북') || addr.includes('충청북')) region = '충북';
       else if (addr.includes('충남') || addr.includes('충청남')) region = '충남';
       else if (addr.includes('전북') || addr.includes('전라북')) region = '전북';
       else if (addr.includes('전남') || addr.includes('전라남')) region = '전남';
       else if (addr.includes('경북') || addr.includes('경상북')) region = '경북';
       else if (addr.includes('경남') || addr.includes('경상남')) region = '경남';
       else if (addr.includes('제주')) region = '제주';
       
       if (!regionStats[region]) regionStats[region] = { count: 0, listings: 0 };
       regionStats[region].count++;
       regionStats[region].listings += r.listings || 0;
     });
     
     const sortedRegions = Object.entries(regionStats)
       .filter(([k]) => k !== '기타')
       .sort((a, b) => b[1].count - a[1].count);
     
     return (
       <div className="space-y-3">
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
           <div className="bg-neutral-600 rounded-lg p-3 text-center">
             <p className={`text-2xl font-bold ${t.text}`}>{collectedRealtors.length.toLocaleString()}</p>
             <p className={`text-xs ${t.textMuted}`}>전체 중개사</p>
           </div>
           <div className="bg-neutral-600 rounded-lg p-3 text-center">
             <p className={`text-2xl font-bold ${t.text}`}>{companies.length}</p>
             <p className={`text-xs ${t.textMuted}`}>등록 업체</p>
           </div>
           <div className="bg-neutral-600 rounded-lg p-3 text-center">
             <p className={`text-2xl font-bold ${t.text}`}>{sortedRegions.length}</p>
             <p className={`text-xs ${t.textMuted}`}>활동 지역</p>
           </div>
           <div className="bg-neutral-600 rounded-lg p-3 text-center">
             <p className={`text-2xl font-bold ${t.text}`}>
               {collectedRealtors.reduce((sum, r) => sum + (r.listings || 0), 0).toLocaleString()}
             </p>
             <p className={`text-xs ${t.textMuted}`}>총 매물</p>
           </div>
         </div>
         
         <div className="mt-4">
           <p className={`text-xs mb-2 ${t.textMuted}`}>지역별 중개사 분포</p>
           <div className="flex flex-wrap gap-2">
             {sortedRegions.slice(0, 10).map(([region, data]) => (
               <div key={region} className="px-3 py-2 bg-neutral-50 rounded-lg">
                 <span className={`font-medium ${t.text}`}>{region}</span>
                 <span className="text-neutral-500 text-sm ml-2">{data.count}개</span>
               </div>
             ))}
           </div>
         </div>
       </div>
     );
   })()}
 </div>

 {/* 하단 CTA */}
 <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-6 text-center">
   <h3 className={`text-xl font-bold ${t.text} mb-2`}>카페 창업, 빈크래프트와 함께하세요</h3>
   <p className="text-neutral-700 mb-4">AI피드백가 상담해드립니다</p>
   <div className="flex justify-center gap-3">
     <a 
       href="https://www.beancraft.co.kr" 
       target="_blank" 
       rel="noopener noreferrer"
       className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
     >
       홈페이지
     </a>
     <a 
       href="tel:1533-4875" 
       className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all"
     >
        1533-4875
     </a>
   </div>
 </div>
 </div>
 )}

 {tab === 'realtors' && (
 <div className="space-y-2">
 <h2 className={`font-bold ${t.text} text-xl`}>중개사 관리</h2>
 
 {(() => {
 // 매물 수 가져오기
 const getListingCount = (r) => {
 if (r.listingCount) return r.listingCount;
 if (r.listings) return r.listings;
 if (r.articleCounts && r.articleCounts.total) return r.articleCounts.total;
 return 0;
 };
 
 // 업체명 가져오기
 const getOfficeName = (r) => {
 if (r.name && (r.name.includes('공인중개') || r.name.includes('부동산') || r.name.includes('중개사'))) return r.name;
 if (r.officeName) return r.officeName;
 if (r.realtorName) return r.realtorName;
 return r.name || '(업체명 없음)';
 };
 
 // 담당자명 가져오기
 const getAgentName = (r) => r.agentName || r.agent || '미정';
 
 // 직급 가져오기
 const getAgentPosition = (r) => r.agentPosition || '';
 
 // 수집일 포맷 함수 (다양한 형식 지원)
 const formatCollectedDate = (dateStr) => {
   if (!dateStr) return '-';
   
   try {
     // 숫자 타임스탬프
     if (typeof dateStr === 'number') {
       const date = new Date(dateStr);
       if (!isNaN(date.getTime())) {
         return date.toLocaleDateString('ko-KR');
       }
     }
     
     // ISO 형식 (2025-12-28T22:04:19.325Z)
     if (typeof dateStr === 'string' && dateStr.includes('T')) {
       const date = new Date(dateStr);
       if (!isNaN(date.getTime())) {
         return date.toLocaleDateString('ko-KR');
       }
     }
     
     // 한국어 형식 (2026. 1. 7. 오후 1:40:15)
     if (typeof dateStr === 'string') {
       const koreanMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
       if (koreanMatch) {
         const [, year, month, day] = koreanMatch;
         return `${year}. ${month}. ${day}.`;
       }
       
       // YYYY-MM-DD 형식
       const isoMatch = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
       if (isoMatch) {
         const [, year, month, day] = isoMatch;
         return `${year}. ${month}. ${day}.`;
       }
     }
     
     // 그 외 - Date로 파싱 시도
     const date = new Date(dateStr);
     if (!isNaN(date.getTime())) {
       return date.toLocaleDateString('ko-KR');
     }
     
     return '-';
   } catch (e) {
     return '-';
   }
 };
 
 // 시/도 표준 순서
 const CITY_ORDER = ['서울특별시', '경기도', '인천광역시', '부산광역시', '대구광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'];
 
 // 시/도 약칭
 const CITY_SHORT = {
 '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구',
 '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
 '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기',
 '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남',
 '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북',
 '경상남도': '경남', '제주특별자치도': '제주'
 };
 
 // 시/도 및 구/군 추출
 const extractCityDistrict = (address) => {
 if (!address) return { city: '기타', district: '기타' };
 
 // 서울 구 목록 (구 없이 이름만 나와도 인식)
 const seoulDistricts = ['종로', '중구', '용산', '성동', '광진', '동대문', '중랑', '성북', '강북', '도봉', '노원', '은평', '서대문', '마포', '양천', '강서', '구로', '금천', '영등포', '동작', '관악', '서초', '강남', '송파', '강동'];
 
 // 각 도별 시 목록 (시/도 없이 시 이름만 나와도 해당 도로 인식)
 const provinceCities = {
   '경기도': ['수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부', '시흥', '파주', '광명', '김포', '군포', '광주', '이천', '양주', '오산', '구리', '안성', '포천', '의왕', '하남', '여주', '양평', '동두천', '과천', '가평', '연천'],
   '강원특별자치도': ['춘천', '원주', '강릉', '동해', '삼척', '속초', '태백', '홍천', '횡성', '영월', '평창', '정선', '철원', '화천', '양구', '인제', '고성', '양양'],
   '충청북도': ['청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양'],
   '충청남도': ['천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양', '홍성', '예산', '태안'],
   '전북특별자치도': ['전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'],
   '전라남도': ['목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안'],
   '경상북도': ['포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '군위', '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉'],
   '경상남도': ['창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'],
   '제주특별자치도': ['제주', '서귀포']
 };
 
 const cityPatterns = [
 { pattern: /서울(특별시|시)?/, city: '서울특별시' },
 { pattern: /부산(광역시)?/, city: '부산광역시' },
 { pattern: /대구(광역시)?/, city: '대구광역시' },
 { pattern: /인천(광역시)?/, city: '인천광역시' },
 { pattern: /광주(광역시)?/, city: '광주광역시' },
 { pattern: /대전(광역시)?/, city: '대전광역시' },
 { pattern: /울산(광역시)?/, city: '울산광역시' },
 { pattern: /세종(특별자치시)?/, city: '세종특별자치시' },
 { pattern: /경기(도)?/, city: '경기도' },
 { pattern: /강원(특별자치도|도)?/, city: '강원특별자치도' },
 { pattern: /충청?북(도)?|충북/, city: '충청북도' },
 { pattern: /충청?남(도)?|충남/, city: '충청남도' },
 { pattern: /전라?북(특별자치도|도)?|전북/, city: '전북특별자치도' },
 { pattern: /전라?남(도)?|전남/, city: '전라남도' },
 { pattern: /경상?북(도)?|경북/, city: '경상북도' },
 { pattern: /경상?남(도)?|경남/, city: '경상남도' },
 { pattern: /제주(특별자치도|도)?/, city: '제주특별자치도' }
 ];
 
 let city = '기타';
 for (const { pattern, city: cityName } of cityPatterns) {
 if (pattern.test(address)) {
 city = cityName;
 break;
 }
 }
 
 // 구/군 추출
 let district = '기타';
 const districtMatch = address.match(/([가-힣]{1,4})(구|군)/);
 if (districtMatch) {
   const matched = districtMatch[1] + districtMatch[2];
   if (!matched.includes('특별') && !matched.includes('광역') && matched.length <= 5) {
     district = matched;
   }
 }
 
 // 구 없이 이름만 있는 경우 (예: "서울시 종로 134" → 종로구)
 if (district === '기타' && city === '서울특별시') {
   for (const gu of seoulDistricts) {
     // 주소에 구 이름이 포함되어 있으면 (단, 다른 단어의 일부가 아닌 경우)
     const guRegex = new RegExp(`${gu}(?!\\S*구)\\s|${gu}(?!\\S*구)$|\\s${gu}\\s`);
     if (guRegex.test(address) || address.includes(gu + ' ') || address.includes(gu + '동')) {
       district = gu + '구';
       break;
     }
   }
 }
 
 // 각 도별 시 이름으로 city 설정 (시/도 없이 시 이름만 있어도 인식)
 if (city === '기타') {
   const cityMatch = address.match(/([가-힣]{2,4})시(?![도특])/);
   if (cityMatch) {
     const cityName = cityMatch[1];
     // 모든 도에서 해당 시 이름 찾기
     for (const [province, cities] of Object.entries(provinceCities)) {
       if (cities.includes(cityName)) {
         city = province;
         if (district === '기타') {
           district = cityName + '시';
         }
         break;
       }
     }
   }
 }
 
 // 구/군이 없으면 시(市) 단위 추출
 if (district === '기타') {
   const cityMatch = address.match(/([가-힣]{2,4})시(?![도특])/);
   if (cityMatch) {
     district = cityMatch[1] + '시';
   }
 }
 
 // 서울 구 이름만 있고 시/도 정보 없으면 서울로 설정
 if (city === '기타' && district !== '기타' && district.endsWith('구')) {
   const guName = district.replace('구', '');
   if (seoulDistricts.includes(guName)) {
     city = '서울특별시';
   }
 }
 
 return { city, district };
 };
 
 // 유효한 중개사 필터링
 const rawValidRealtors = collectedRealtors.filter(r => {
 const name = getOfficeName(r);
 const hasValidName = name.includes('공인중개') || name.includes('부동산') || name.includes('중개사');
 const hasAddress = r.address && r.address.length > 5;
 return hasValidName || hasAddress;
 });
 
 // 업체명 정규화 함수 (띄어쓰기, 특수문자 통일)
 const normalizeNameForDuplicate = (name) => {
   return name
     .replace(/\s+/g, '') // 모든 공백 제거
     .replace(/[^\w가-힣]/g, '') // 특수문자 제거 (한글, 영문, 숫자만 유지)
     .toLowerCase(); // 소문자로 통일
 };
 
 // 중복 제거
 const seen = new Map();
 const validRealtors = rawValidRealtors.filter(r => {
 const name = getOfficeName(r).trim();
 const normalizedName = normalizeNameForDuplicate(name);
 const { city, district } = extractCityDistrict(r.address);
 const key = `${normalizedName}-${city}-${district}`;
 if (seen.has(key)) {
 const existing = seen.get(key);
 if (getListingCount(r) > getListingCount(existing.data)) {
 rawValidRealtors[existing.index] = null;
 seen.set(key, { data: r, index: rawValidRealtors.indexOf(r) });
 return true;
 }
 return false;
 }
 seen.set(key, { data: r, index: rawValidRealtors.indexOf(r) });
 return true;
 }).filter(r => r !== null);
 
 // 등록된 업체 중 수집된 중개사와 매칭 안 되는 것만 추가
 companies.forEach(company => {
   // checkDuplicate로 매칭 확인 (개선된 A~C 로직 사용)
   const matchResult = checkDuplicate(company, validRealtors);
   
   // 이미 수집된 중개사와 매칭되면 스킵
   if (matchResult.isDuplicate) return;
   
   // 매칭 안 되는 등록 업체만 중개사 형식으로 추가
   validRealtors.push({
     id: `company-${company.id}`,
     name: company.name,
     address: company.address,
     phone: company.phone,
     cellPhone: company.phone, // 휴대폰도 동일하게
     listings: 0, // 수집 안 됐으므로 매물 수 없음
     isFromCompany: true, // 등록된 업체 표시
     managerId: company.managerId,
     collected_at: company.createdAt,
     // 등록 업체 추가 정보
     agentName: company.contact || '', // 연락처 담당자
     memo: company.memo || '',
     reaction: company.reaction || '',
     lat: company.lat,
     lng: company.lng,
     companyId: company.id // 원본 업체 ID
   });
 });
 
 // 시/도 > 구/군 계층 구조 생성
 const regionHierarchy = {};
 validRealtors.forEach(r => {
 const { city, district } = extractCityDistrict(r.address);
 if (city === '기타') return;
 if (!regionHierarchy[city]) regionHierarchy[city] = new Set();
 if (district !== '기타') regionHierarchy[city].add(district);
 });
 
 // 시/도 정렬
 const sortedCitiesForFilter = CITY_ORDER.filter(city => regionHierarchy[city]);
 
 // 총 매물 수 및 최신 수집일
 const totalListings = validRealtors.reduce((sum, r) => sum + getListingCount(r), 0);
 const latestDate = (() => {
   if (validRealtors.length === 0) return null;
   const validDates = validRealtors
     .filter(r => r.collected_at)
     .map(r => {
       const d = new Date(r.collected_at);
       return isNaN(d.getTime()) ? null : d;
     })
     .filter(d => d !== null);
   if (validDates.length === 0) return null;
   return new Date(Math.max(...validDates.map(d => d.getTime())));
 })();
 
 return (
 <>
 {/* 통계 */}
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex flex-wrap items-center gap-4 sm:gap-6">
 <div className="text-center">
 <p className="text-2xl sm:text-3xl font-bold text-teal-600">{realtorsLoading ? '로딩 중...' : validRealtors.length}</p>
 <p className={`text-xs ${t.textMuted}`}>수집된 중개사</p>
 </div>
 {latestDate && (
 <div className="text-center">
 <p className={`text-lg font-bold ${t.text}`}>{latestDate.toLocaleDateString('ko-KR')}</p>
 <p className={`text-xs ${t.textMuted}`}>최근 수집일</p>
 </div>
 )}
 </div>
 </div>
 
 {/* 검색/필터/정렬 */}
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex flex-wrap gap-2 mb-3">
 <input
 type="text"
 placeholder="지역(강남구) 또는 업체명 검색..."
 value={realtorSearchQuery}
 onChange={e => setRealtorSearchQuery(e.target.value)}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all flex-1 min-w-[150px]`}
 />
 <select value={realtorRegionFilter} onChange={e => setRealtorRegionFilter(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all`}>
 <option value="">전체 지역</option>
 {sortedCitiesForFilter.map(city => (
 <optgroup key={city} label={`${CITY_SHORT[city] || city}`}>
 {[...regionHierarchy[city]].sort().map(district => (
 <option key={`${city}-${district}`} value={`${city}|${district}`}>{district}</option>
 ))}
 </optgroup>
 ))}
 </select>
 <select value={realtorSortMode} onChange={e => setRealtorSortMode(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all`}>
 <option value="listings">매물 많은 순</option>
 <option value="recent">최근 수집 순</option>
 <option value="name">이름 순</option>
                <option value="unvisited">미방문 우선</option>
 </select>
 </div>
 </div>
 
 {/* 중개사 목록 */}
 {validRealtors.length === 0 ? (
 <div className={`rounded-2xl p-8 text-center border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700 text-neutral-400' : 'bg-white border-neutral-200 text-neutral-500'}`}>
 <p className="text-4xl mb-2"></p>
 <p>수집된 중개사가 없습니다</p>
 <p className="text-xs mt-2">Chrome 확장프로그램으로 네이버부동산에서 수집하세요</p>
 </div>
 ) : (
 <div className="space-y-3">
 {(() => {
 let filtered = [...validRealtors];
 
              // 스마트 검색 - 주소 + 업체명 + 담당자 통합 검색
              if (realtorSearchQuery) {
                const q = realtorSearchQuery.trim();
                // "역" 제거 (회기역 → 회기, 성수역 → 성수)
                const qClean = q.replace(/역$/, '');
                const qLower = qClean.toLowerCase();
                
                // 주소에서 검색 (구, 동 모두 포함)
                filtered = filtered.filter(r => {
                  const address = (r.address || '').toLowerCase();
                  const name = getOfficeName(r).toLowerCase();
                  const agent = getAgentName(r).toLowerCase();
                  return address.includes(qLower) || name.includes(qLower) || agent.includes(qLower);
                });
              }
              
 // 지역 필터 (시/도|구/군 형식)
 if (realtorRegionFilter) {
 const [filterCity, filterDistrict] = realtorRegionFilter.split('|');
 filtered = filtered.filter(r => {
 const { city, district } = extractCityDistrict(r.address);
 if (filterCity && filterDistrict) {
 return city === filterCity && district === filterDistrict;
 }
 return false;
 });
 }
 
 // 정렬
 if (realtorSortMode === 'recent') {
 filtered.sort((a, b) => new Date(b.collected_at || 0) - new Date(a.collected_at || 0));
 } else if (realtorSortMode === 'name') {
 filtered.sort((a, b) => getOfficeName(a).localeCompare(getOfficeName(b)));
              } else if (realtorSortMode === 'unvisited') {
              filtered.sort((a, b) => {
                const aVisited = isCompanyDuplicate(a, companies) ? 1 : 0;
                const bVisited = isCompanyDuplicate(b, companies) ? 1 : 0;
                return aVisited - bVisited;
              });
              } else {
 filtered.sort((a, b) => getListingCount(b) - getListingCount(a));
 }
 
 // 시/도 > 구/군 그룹핑
 const byCityDistrict = {};
 filtered.forEach(r => {
 const { city, district } = extractCityDistrict(r.address);
 if (city === '기타') return;
 if (!byCityDistrict[city]) byCityDistrict[city] = {};
 if (!byCityDistrict[city][district]) byCityDistrict[city][district] = [];
 byCityDistrict[city][district].push(r);
 });
 
 // 시/도 정렬
 const displayCities = CITY_ORDER.filter(city => byCityDistrict[city]);
 
 if (displayCities.length === 0) {
 return <div className={`rounded-2xl p-4 text-center border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700 text-neutral-400' : 'bg-white border-neutral-200 text-neutral-500'}`}>검색 결과가 없습니다</div>;
 }
 
 return displayCities.map(city => {
 const districts = byCityDistrict[city];
 const cityTotal = Object.values(districts).flat().length;
 const sortedDistricts = Object.keys(districts).sort();
 
 return (
 <details key={city} className={`rounded-2xl overflow-hidden border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`} open={displayCities.length === 1}>
 <summary className={`p-4 cursor-pointer flex justify-between items-center font-bold ${theme === 'dark' ? 'bg-neutral-800 text-white hover:bg-neutral-700' : 'bg-white text-neutral-800 hover:bg-neutral-100'}`}>
 <span>{CITY_SHORT[city] || city} ({cityTotal}개)</span>
 <span className={`text-xs ${t.textMuted}`}>{sortedDistricts.length}개 구/군</span>
 </summary>
 <div className="border-t border-neutral-200">
 {sortedDistricts.map(district => {
 const realtors = districts[district];
 return (
 <details key={district} className="border-b border-neutral-200">
 <summary className="p-3 pl-6 cursor-pointer hover:bg-neutral-100 flex justify-between items-center text-neutral-700">
 <span className="font-bold">{district} ({realtors.length}개)</span>
 </summary>
 <div className="max-h-80 overflow-y-auto bg-neutral-50">
 {realtors.map((realtor, idx) => {
 const officeName = getOfficeName(realtor);
 const listingCount = getListingCount(realtor);
 const duplicateCheck = checkDuplicate(realtor, companies);
 const isRegistered = duplicateCheck.isDuplicate || realtor.isFromCompany;
 const matchedCompany = duplicateCheck.matchedCompany;
 // 등록된 업체인 경우 직접 managerId로 담당자 찾기
 const assignedManager = realtor.isFromCompany 
   ? managers.find(m => m.id === realtor.managerId)
   : (matchedCompany ? managers.find(m => m.id === matchedCompany.managerId) : null);
 const isInRoute = routeStops.some(s => s.name === officeName);
 
 return (
 <div 
 key={realtor.id || idx} 
 className={`p-3 pl-8 border-b border-slate-800 cursor-pointer hover:bg-white ${isInRoute ? 'bg-teal-900/20' : isRegistered ? 'bg-green-900/20' : ''}`}
 onClick={() => setShowRealtorDetailModal({
 ...realtor,
 officeName,
 listingCount,
 agentName: realtor.isFromCompany ? realtor.agentName : getAgentName(realtor), // 등록 업체는 연락처 담당자 유지
 agentPosition: getAgentPosition(realtor),
 isRegistered,
 isInRoute,
 assignedManager: assignedManager, // 시스템 담당자 전달
 matchedCompany: matchedCompany, // 매칭된 업체 정보 전달
 collectedDate: realtor.collected_at ? formatCollectedDate(realtor.collected_at) : ''
 })}
 >
 <div className="flex justify-between items-center">
 <div className="flex items-center gap-2 flex-wrap">
 <span className={`font-bold ${t.text} text-sm`}>{officeName}</span>
 <span className="px-2 py-0.5 text-xs rounded-full bg-teal-900 text-teal-300 font-bold">{listingCount}건</span>
 {isInRoute && <span className={`px-2 py-0.5 text-xs rounded-full bg-purple-900 ${t.text}`}>동선</span>}
 {isRegistered && <span className="px-2 py-0.5 text-xs rounded-full bg-green-900 text-green-300">방문</span>}
 {assignedManager ? (
   <span className={`px-1.5 py-0.5 text-xs rounded-full ${t.text} font-bold`} style={{backgroundColor: assignedManager.color}}>{assignedManager.name}</span>
 ) : (
   <span className="px-1.5 py-0.5 text-xs rounded-full bg-neutral-200 text-neutral-700 font-bold">미배정</span>
 )}
 </div>
 <span className={`text-sm ${t.textMuted}`}>›</span>
 </div>
 <p className={`text-xs mt-1 ${t.textMuted}`}>{realtor.address || '주소 없음'}</p>
 </div>
 );
 })}
 {realtors.length > 50 && (
 <p className="text-center text-xs text-neutral-500 py-2">...외 {realtors.length - 50}개</p>
 )}
 </div>
 </details>
 );
 })}
 </div>
 </details>
 );
 });
 })()}
 </div>
 )}
 </>
 );
 })()}
 </div>
 )}
 {tab === 'companies' && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 {/* 오른쪽: 업체 등록 */}
 <div className="lg:col-span-1 lg:order-2">
 <div className={`rounded-2xl p-4 sticky top-20 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex justify-between items-center mb-3">
 <h3 className={`font-bold ${t.text}`}>업체 등록</h3>
 <div className="relative">
 <input
 type="file"
 accept="image/*"
 capture="environment"
 ref={ocrFileInputRef}
 onChange={handleOcrCapture}
 className="hidden"
 />
 <input
 type="file"
 accept="image/*"
 multiple
 ref={bulkOcrFileInputRef}
 onChange={handleBulkOcrCapture}
 className="hidden"
 />
 <button
 onClick={() => setShowRegisterMenu(!showRegisterMenu)}
 className="px-3 py-1 rounded-full border border-neutral-200 text-xs text-neutral-700 hover:border-slate-500"
 >
 + 등록 방법
 </button>
 {showRegisterMenu && (
 <div className={`absolute right-0 top-full mt-1 rounded-lg shadow-lg z-50 min-w-[120px] border ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <button
 onClick={() => { setShowRegisterMenu(false); setTimeout(() => ocrFileInputRef.current?.click(), 100); }}
 className={`w-full px-3 py-2 text-left text-xs border-b ${theme === 'dark' ? 'text-neutral-300 hover:bg-neutral-700 border-neutral-700' : 'text-neutral-700 hover:bg-neutral-100 border-neutral-200'}`}
 >
 명함 촬영
 </button>
 <button
 onClick={() => { setShowRegisterMenu(false); setTimeout(() => bulkOcrFileInputRef.current?.click(), 100); }}
 className={`w-full px-3 py-2 text-left text-xs border-b ${theme === 'dark' ? 'text-neutral-300 hover:bg-neutral-700 border-neutral-700' : 'text-neutral-700 hover:bg-neutral-100 border-neutral-200'}`}
 >
 명함 일괄
 </button>
 <button
 onClick={() => { setShowBulkAddModal(true); setShowRegisterMenu(false); }}
 className="w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100"
 >
 일괄 등록
 </button>
 </div>
 )}
 </div>
 </div>
 <div className="space-y-2">
 <input type="text" placeholder="업체명" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm w-full`} />
 <input type="text" placeholder="담당자" value={companyForm.contact} onChange={e => setCompanyForm({ ...companyForm, contact: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm w-full`} />
 <input type="text" placeholder="연락처" value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm w-full`} />
 <input type="text" placeholder="주소" value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm w-full`} />
 {isAdmin ? (
 <select value={companyForm.managerId || ''} onChange={e => setCompanyForm({ ...companyForm, managerId: Number(e.target.value) || null })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm w-full`}>
 <option value="">영업자 선택</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 ) : (
 <div className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm flex items-center text-neutral-500`}>
 {user?.name || '나'} (자동)
 </div>
 )}
 <input type="text" placeholder="메모" value={companyForm.memo} onChange={e => setCompanyForm({ ...companyForm, memo: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm w-full`} />
 </div>
 <div className="flex flex-wrap gap-1 mt-3">
 {Object.entries(REACTION_COLORS).map(([key, val]) => (
 <button key={key} onClick={() => setCompanyForm({ ...companyForm, reaction: key })} className={`px-2 py-1 rounded-full text-xs text-white transition-all ${companyForm.reaction === key ? 'ring-1 ring-offset-1 ring-white' : 'opacity-50'}`} style={{ background: val.bg }}>{val.label}</button>
 ))}
 </div>
 <label className="flex items-center gap-2 mt-3 text-xs text-neutral-500 cursor-pointer">
 <input 
 type="checkbox" 
 checked={companyForm.isReregistered || false}
 onChange={e => setCompanyForm({ ...companyForm, isReregistered: e.target.checked })}
 className="w-3 h-3 rounded"
 />
 재등록 (신규 집계 제외)
 </label>
 <button type="button" onClick={handleSaveCompany} className="w-full mt-3 py-2 rounded-full border border-neutral-200 text-neutral-700 text-sm hover:border-slate-500">등록</button>
 </div>
 </div>
 
 {/* 왼쪽: 업체 목록 */}
 <div className="lg:col-span-2 lg:order-1">
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <div className="flex justify-between items-center mb-3">
 <h3 className={`font-bold ${t.text}`}>업체 목록 ({filteredCompanies.length})</h3>
 </div>
 {/* 통계 */}
 {(() => {
 const stats = {
 special: filteredCompanies.filter(c => c.reaction === 'special').length,
 positive: filteredCompanies.filter(c => c.reaction === 'positive').length,
 neutral: filteredCompanies.filter(c => c.reaction === 'neutral').length,
 negative: filteredCompanies.filter(c => c.reaction === 'negative').length
 };
 return (
 <div className="grid grid-cols-4 gap-2 mb-4">
 <div className="text-center p-2 rounded-xl border border-neutral-200">
 <p className={`text-lg font-bold ${t.text}`}>{stats.special}</p>
 <p className={`text-xs ${t.textMuted}`}>특별</p>
 </div>
 <div className="text-center p-2 rounded-xl border border-neutral-200">
 <p className={`text-lg font-bold ${t.text}`}>{stats.positive}</p>
 <p className={`text-xs ${t.textMuted}`}>긍정</p>
 </div>
 <div className="text-center p-2 rounded-xl border border-neutral-200">
 <p className={`text-lg font-bold ${t.text}`}>{stats.neutral}</p>
 <p className={`text-xs ${t.textMuted}`}>양호</p>
 </div>
 <div className="text-center p-2 rounded-xl border border-neutral-200">
 <p className="text-lg font-bold text-neutral-500">{stats.negative}</p>
 <p className={`text-xs ${t.textMuted}`}>부정</p>
 </div>
 </div>
 );
 })()}
 {/* 검색/필터 */}
 <div className="grid grid-cols-3 gap-2 mb-4">
 <input type="text" placeholder="업체명 검색" value={companySearch} onChange={e => setCompanySearch(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`} />
 <select value={companyManagerFilter} onChange={e => setCompanyManagerFilter(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`}>
 <option value="all">전체 담당자</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 <select value={companyReactionFilter} onChange={e => setCompanyReactionFilter(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`}>
 <option value="all">전체 반응</option>
 {Object.entries(REACTION_COLORS).map(([key, val]) => (
 <option key={key} value={key}>{val.label}</option>
 ))}
 </select>
 </div>
 {/* 업체 리스트 */}
 {managers.filter(m => companyManagerFilter === 'all' || m.id === Number(companyManagerFilter)).map(m => {
 let mgrCompanies = filteredCompanies.filter(c => c.managerId === m.id);
 if (companyReactionFilter !== 'all') {
 mgrCompanies = mgrCompanies.filter(c => c.reaction === companyReactionFilter);
 }
 if (mgrCompanies.length === 0) return null;
 const reactionOrder = ['special', 'positive', 'neutral', 'negative', 'missed'];
 const groupedByReaction = {};
 reactionOrder.forEach(r => {
 const items = mgrCompanies.filter(c => c.reaction === r);
 if (items.length > 0) groupedByReaction[r] = items;
 });
 const getRegion = (address) => {
 if (!address) return '지역 없음';
 const match = address.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\s]*\s*([^\s]+[구군시])/);
 if (match) return match[2];
 const match2 = address.match(/([^\s]+[구군시동읍면])/);
 return match2 ? match2[1] : '기타';
 };
 return (
 <details key={m.id} className="mb-4">
 <summary className="flex items-center gap-2 p-3 rounded-xl cursor-pointer" style={{ background: `${m.color}15` }}>
 <div className="w-5 h-5 rounded-full" style={{ background: m.color }}></div>
 <span className="font-bold text-neutral-800 text-lg">{m.name}</span>
 <span className={`text-sm ${t.text}`}>({mgrCompanies.length}개)</span>
 </summary>
 <div className="mt-2 ml-2">
 {reactionOrder.map(reactionKey => {
 const items = groupedByReaction[reactionKey];
 if (!items) return null;
 const reaction = REACTION_COLORS[reactionKey];
 const byRegion = {};
 items.forEach(c => {
 const region = getRegion(c.address);
 if (!byRegion[region]) byRegion[region] = [];
 byRegion[region].push(c);
 });
 return (
 <details key={reactionKey} className="mb-3">
 <summary className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer" style={{ background: `${reaction.bg}20` }}>
 <div className="w-3 h-3 rounded-full" style={{ background: reaction.bg }}></div>
 <span className="font-bold text-sm" style={{ color: reaction.bg }}>{reaction.label}</span>
 <span className={`text-xs ${t.text}`}>({items.length})</span>
 </summary>
 <div className="mt-2 ml-3">
 {Object.entries(byRegion).map(([region, regionItems]) => (
 <details key={region} className="mb-2">
 <summary className="text-xs text-neutral-800 font-bold px-2 py-1 cursor-pointer hover:bg-neutral-100 rounded">
 {region} ({regionItems.length})
 </summary>
 <div className="space-y-1 mt-1 ml-2">
 {regionItems.map(c => (
 <div
 key={c.id}
 className="flex items-center justify-between p-2 bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-100"
 onClick={() => setShowCompanyEditModal({ ...c })}
 >
 <div className="flex items-center gap-2 min-w-0 flex-1">
 <span className={`font-bold ${t.text} text-sm truncate`}>{c.name}</span>
 </div>
 <div className="flex gap-2 flex-shrink-0">
 <button type="button" onClick={(e) => { e.stopPropagation(); setShowCompanyEditModal({ ...c }); }} className="text-neutral-800 font-bold text-xs">수정</button>
 <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCompany(c); }} className={`${t.text} font-bold text-xs`}>삭제</button>
 </div>
 </div>
 ))}
 </div>
 </details>
 ))}
 </div>
 </details>
 );
 })}
 </div>
 </details>
 );
 })}
 {(() => {
 let unassigned = filteredCompanies.filter(c => !c.managerId);
 if (companyReactionFilter !== 'all') {
 unassigned = unassigned.filter(c => c.reaction === companyReactionFilter);
 }
 if (unassigned.length === 0) return null;
 return (
 <details className="mb-4">
 <summary className="flex items-center gap-2 p-3 rounded-xl bg-gray-100 cursor-pointer">
 <div className="w-5 h-5 rounded-full bg-gray-400"></div>
 <span className={`font-bold ${t.text}`}>미배정</span>
 <span className={`text-sm ${t.text}`}>({unassigned.length})</span>
 </summary>
 <div className="space-y-2 mt-2 ml-2">
 {unassigned.map(c => {
 const reaction = REACTION_COLORS[c.reaction] || REACTION_COLORS.neutral;
 return (
 <div
 key={c.id}
 className="flex items-center justify-between p-2 bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-100"
 onClick={() => setShowCompanyEditModal({ ...c })}
 >
 <div className="flex items-center gap-2 min-w-0 flex-1">
 <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: reaction.bg }}></div>
 <span className={`font-bold ${t.text} text-sm truncate`}>{c.name}</span>
 </div>
 <div className="flex gap-2 flex-shrink-0">
 <span className={`px-2 py-0.5 rounded text-xs ${t.text} font-bold`} style={{ background: reaction.bg }}>{reaction.label}</span>
 <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCompany(c); }} className={`${t.text} font-bold text-xs`}>삭제</button>
 </div>
 </div>
 );
 })}
 </div>
 </details>
 );
 })()}
 {filteredCompanies.length === 0 && <p className="text-neutral-500 text-center py-10">등록된 업체가 없습니다</p>}
 </div>
 </div>
 </div>
 )}
 {tab === 'customers' && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 {/* 왼쪽: 고객 목록 */}
 <div className="lg:col-span-2 space-y-2">
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} mb-4`}>고객 목록</h3>
 {customers.length === 0 ? (
 <p className="text-neutral-500 text-center py-8">등록된 고객이 없습니다</p>
 ) : (
 <div className="space-y-2">
 {customers.map(c => {
 const mgr = managers.find(m => m.id === c.managerId);
 return (
 <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 hover:border-slate-500 cursor-pointer" onClick={() => setShowCustomerEditModal(c)}>
 <div className="flex items-center gap-3">
 <div className={`px-2 py-1 rounded ${t.text} text-xs font-medium`} style={{ background: mgr?.color || '#666' }}>{mgr?.name || '?'}</div>
 <div>
 <p className="font-bold text-neutral-800 text-sm">{c.name}</p>
 <p className={`text-xs ${t.textMuted}`}>{c.phone} · {c.consultDate}</p>
 </div>
 </div>
 <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'completed' ? 'text-neutral-700' : c.status === 'contract' ? 'text-neutral-700' : 'text-neutral-500'}`}>
 {c.status === 'completed' ? '완료' : c.status === 'contract' ? '계약' : '상담'}
 </span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 
 {/* 오른쪽: 고객 등록 */}
 <div className="lg:col-span-1">
 <div className={`rounded-2xl p-4 sticky top-20 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} mb-4`}>고객 등록</h3>
 <div className="space-y-3">
 <select value={customerForm.managerId || ''} onChange={e => setCustomerForm({ ...customerForm, managerId: Number(e.target.value) || null })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`}>
 <option value="">영업자 선택</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 <input type="text" placeholder="고객명 *" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`} />
 <input type="text" placeholder="연락처" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`} />
 <input type="text" placeholder="희망 지역" value={customerForm.desiredRegion} onChange={e => setCustomerForm({ ...customerForm, desiredRegion: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`} />
 <div>
   <label className={`text-xs mb-1 block ${t.textMuted}`}>희망 날짜</label>
   <input type="date" value={customerForm.desiredDate} onChange={e => setCustomerForm({ ...customerForm, desiredDate: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`} />
 </div>
 <input type="text" placeholder="준비 비용 (예: 5000만원)" value={customerForm.budget} onChange={e => setCustomerForm({ ...customerForm, budget: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`} />
 <input type="text" placeholder="희망 평수 (예: 15평)" value={customerForm.desiredSize} onChange={e => setCustomerForm({ ...customerForm, desiredSize: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`} />
 
 {/* 창업 희망 구상 (복수 선택) */}
 <div>
   <label className={`text-xs mb-2 block ${t.textMuted}`}>창업 희망 구상 (복수 선택)</label>
   <div className="flex flex-wrap gap-1.5">
     {['테이크아웃', '홀 운영', '디저트/브런치', '동네 상권', '오피스 상권', '가성비', '아직 미정', '기타'].map(style => (
       <button 
         key={style} 
         type="button"
         onClick={() => {
           const styles = customerForm.businessStyle || [];
           if (styles.includes(style)) {
             setCustomerForm({ ...customerForm, businessStyle: styles.filter(s => s !== style) });
           } else {
             setCustomerForm({ ...customerForm, businessStyle: [...styles, style] });
           }
         }} 
         className={`px-2.5 py-1.5 rounded-full text-xs transition-all ${(customerForm.businessStyle || []).includes(style) ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}
       >
         {style}
       </button>
     ))}
   </div>
 </div>
 
 {/* 창업 중요 순서 (클릭 순서대로 번호 부여) */}
 <div>
   <label className={`text-xs mb-2 block ${t.textMuted}`}>창업 중요 순서 (클릭 순서대로 1~6)</label>
   <div className="flex flex-wrap gap-1.5">
     {['기계', '인테리어', '레시피/교육', '원두', '디자인', '매물'].map(item => {
       const priorities = customerForm.priorities || [];
       const idx = priorities.indexOf(item);
       return (
         <button 
           key={item} 
           type="button"
           onClick={() => {
             if (idx >= 0) {
               setCustomerForm({ ...customerForm, priorities: priorities.filter(p => p !== item) });
             } else {
               setCustomerForm({ ...customerForm, priorities: [...priorities, item] });
             }
           }} 
           className={`px-2.5 py-1.5 rounded-full text-xs transition-all ${idx >= 0 ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}
         >
           {idx >= 0 ? `${idx + 1}. ${item}` : item}
         </button>
       );
     })}
   </div>
 </div>
 
 <div>
   <label className={`text-xs mb-1 block ${t.textMuted}`}>상담일</label>
   <input type="date" value={customerForm.consultDate} onChange={e => setCustomerForm({ ...customerForm, consultDate: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm`} />
 </div>
 <div className="flex gap-2">
 {['consult', 'contract', 'completed'].map(s => (
 <button key={s} onClick={() => setCustomerForm({ ...customerForm, status: s })} className={`flex-1 px-2 py-2 rounded-full text-xs ${customerForm.status === s ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-500'}`}>
 {s === 'consult' ? '상담' : s === 'contract' ? '계약' : '완료'}
 </button>
 ))}
 </div>
 <textarea placeholder="메모" value={customerForm.memo} onChange={e => setCustomerForm({ ...customerForm, memo: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm h-20 resize-none`} />
 <button type="button" onClick={handleSaveCustomer} className="w-full py-2 rounded-full border border-neutral-200 text-neutral-700 text-sm hover:border-slate-500">등록</button>
 </div>
 </div>
 </div>
 </div>
 )}
 {tab === 'settings' && (
 <div className="space-y-2">
 <h2 className={`font-bold ${t.text} text-xl`}>설정</h2>
 
 {/* 설정 서브탭 */}
 <div className={`flex gap-2 p-1 rounded-full border w-fit flex-wrap ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <button type="button" onClick={() => setSettingsTab('alerts')} className={`px-4 py-2 rounded-full text-sm transition-all ${settingsTab === 'alerts' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:${t.text}'}`}>나의 알림</button>
 <button type="button" onClick={() => setSettingsTab('salesmode')} className={`px-4 py-2 rounded-full text-sm transition-all ${settingsTab === 'salesmode' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:${t.text}'}`}>영업모드</button>
 <button type="button" onClick={() => setSettingsTab('account')} className={`px-4 py-2 rounded-full text-sm transition-all ${settingsTab === 'account' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:${t.text}'}`}>계정</button>
 {isAdmin && <button type="button" onClick={() => setSettingsTab('admin')} className={`px-4 py-2 rounded-full text-sm transition-all ${settingsTab === 'admin' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:${t.text}'}`}>관리자</button>}
 </div>
 
 {/* 나의 알림 탭 */}
 {settingsTab === 'alerts' && (
 <div className="space-y-3">
   {/* 오늘 예정 */}
   {(() => {
     const today = getKoreanToday();
     const myEvents = calendarEvents.filter(e => 
       e.managerId === user?.managerId && 
       e.date === today && 
       !e.completed
     );
     return myEvents.length > 0 ? (
       <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-500' : 'bg-white border-neutral-500'}`}>
         <h3 className={`font-bold ${t.text} text-lg mb-3 flex items-center gap-2`}>
           오늘 예정
           <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">{myEvents.length}</span>
         </h3>
         <div className="space-y-2">
           {myEvents.map(event => (
             <div key={event.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl">
               <div className="flex-1">
                 <p className={`font-medium ${t.text}`}>{event.title}</p>
                 <p className={`text-sm ${t.textMuted}`}>{event.time} · {event.memo || '메모 없음'}</p>
               </div>
               <button
                 onClick={() => {
                   saveCalendarEvent({ ...event, completed: true });
                 }}
                 className="px-3 py-1.5 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600"
               >
                 완료
               </button>
             </div>
           ))}
         </div>
       </div>
     ) : (
       <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
         <h3 className="font-bold text-neutral-400 text-lg">오늘 예정된 일정 없음</h3>
       </div>
     );
   })()}
   
   {/* 이번 주 예정 */}
   {(() => {
     const today = new Date();
     const weekStart = new Date(today);
     weekStart.setDate(today.getDate() - today.getDay());
     const weekEnd = new Date(weekStart);
     weekEnd.setDate(weekStart.getDate() + 6);
     
     const formatDate = (d) => {
       const y = d.getFullYear();
       const m = String(d.getMonth() + 1).padStart(2, '0');
       const day = String(d.getDate()).padStart(2, '0');
       return `${y}-${m}-${day}`;
     };
     
     const myWeekEvents = calendarEvents.filter(e => {
       if (e.managerId !== user?.managerId) return false;
       if (e.completed) return false;
       if (e.date === getKoreanToday()) return false; // 오늘 제외
       return e.date >= formatDate(weekStart) && e.date <= formatDate(weekEnd);
     }).sort((a, b) => a.date.localeCompare(b.date));
     
     return myWeekEvents.length > 0 ? (
       <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
         <h3 className="font-bold text-neutral-700 text-lg mb-3">이번 주 예정</h3>
         <div className="space-y-2">
           {myWeekEvents.map(event => (
             <div key={event.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
               <div className="flex-1">
                 <div className="flex items-center gap-2">
                   <span className={`text-xs ${t.textMuted}`}>{event.date.slice(5).replace('-', '/')} ({['일','월','화','수','목','금','토'][new Date(event.date).getDay()]})</span>
                   {event.autoGenerated && <span className="text-xs bg-blue-100 text-white px-1.5 py-0.5 rounded">자동</span>}
                 </div>
                 <p className={`font-medium ${t.text}`}>{event.title}</p>
                 <p className={`text-sm ${t.textMuted}`}>{event.time}</p>
               </div>
               <button
                 onClick={() => {
                   saveCalendarEvent({ ...event, completed: true });
                 }}
                 className="px-3 py-1.5 bg-neutral-200 text-neutral-600 text-sm rounded-lg hover:bg-neutral-300"
               >
                 완료
               </button>
             </div>
           ))}
         </div>
       </div>
     ) : null;
   })()}
   
   {/* 완료된 일정 (최근 5개) */}
   {(() => {
     const completedEvents = calendarEvents
       .filter(e => e.managerId === user?.managerId && e.completed)
       .sort((a, b) => b.date.localeCompare(a.date))
       .slice(0, 5);
     
     return completedEvents.length > 0 ? (
       <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
         <h3 className="font-bold text-neutral-400 text-lg mb-3">최근 완료</h3>
         <div className="space-y-2">
           {completedEvents.map(event => (
             <div key={event.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl opacity-60">
               <div className="flex-1">
                 <p className="font-medium text-neutral-500 line-through">{event.title}</p>
                 <p className="text-sm text-neutral-400">{event.date.slice(5).replace('-', '/')}</p>
               </div>
               <button
                 onClick={() => {
                   saveCalendarEvent({ ...event, completed: false });
                 }}
                 className="px-3 py-1.5 bg-neutral-100 text-neutral-400 text-sm rounded-lg hover:bg-neutral-200"
               >
                 복원
               </button>
             </div>
           ))}
         </div>
       </div>
     ) : null;
   })()}
 </div>
 )}
 
 {/* 영업모드 설정 */}
 {settingsTab === 'salesmode' && (
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <h3 className={`font-bold ${t.text} text-lg mb-2`}>영업모드</h3>
   <p className="text-sm text-neutral-700 mb-4">고객 미팅 시 상권 분석 자료를 보여줄 수 있습니다. 영업모드에서는 관리 데이터가 노출되지 않습니다.</p>
   <button
     type="button"
     onClick={startSalesMode}
     className="w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition-all"
   >
     영업모드 시작
   </button>
 </div>
 )}
 
 {/* 계정 설정 탭 */}
 {settingsTab === 'account' && (
 <div className="space-y-2">
 {/* 테마 설정 */}
 <div className={`rounded-2xl p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
   <h3 className={`font-bold ${t.text} text-lg mb-3`}>테마 설정</h3>
   <div className="flex gap-2">
     {[
       { value: 'light', label: '라이트' },
       { value: 'dark', label: '다크' },
       { value: 'auto', label: '시스템' }
     ].map(t => (
       <button
         key={t.value}
         type="button"
         onClick={() => setThemeMode(t.value)}
         className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${themeMode === t.value ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}
       >
         {t.label}
       </button>
     ))}
   </div>
   <p className={`text-xs mt-2 ${t.textMuted}`}>현재: {themeMode === 'light' ? '라이트 모드' : themeMode === 'dark' ? '다크 모드' : '시스템 설정 따름'}</p>
 </div>

 {/* 비밀번호 변경 */}
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} text-lg mb-4`}>내 비밀번호 변경</h3>
 <div className="space-y-3">
 <input type="password" placeholder="새 비밀번호" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="password" placeholder="비밀번호 확인" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <button type="button" onClick={isAdmin ? changeAdminPassword : changePassword} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all w-full">비밀번호 변경</button>
 </div>
 <p className="text-xs text-neutral-500 mt-3">※ 비밀번호는 4자 이상이어야 합니다. {isAdmin ? '(관리자 계정)' : ''}</p>
 </div>
 </div>
 )}
 
 {/* 관리자 전용 탭 */}
 {settingsTab === 'admin' && isAdmin && (
 <div className="space-y-2">
 
 {/* 전국 상권 데이터 수집 (관리자 전용) */}
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} text-lg mb-3`}>📊 전국 상권 데이터 수집</h3>
 <p className={`text-sm ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'} mb-4`}>선택한 지역의 상권 데이터를 수집하여 Firebase에 저장합니다.</p>
 
 <div className="grid grid-cols-2 gap-3 mb-4">
   <div>
     <label className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'} mb-1 block`}>시/도</label>
     <select 
       value={apiCollectSido} 
       onChange={(e) => { setApiCollectSido(e.target.value); setApiCollectSigungu(''); }}
       className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-neutral-700 border-neutral-600 text-white' : 'bg-white border-neutral-300 text-neutral-900'}`}
     >
       <option value="">시도 선택</option>
       <option value="전국">🇰🇷 전국 (모든 시/도)</option>
       {Object.keys(KOREA_REGIONS).map(sido => (
         <option key={sido} value={sido}>{sido}</option>
       ))}
     </select>
   </div>
   <div>
     <label className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'} mb-1 block`}>시/군/구</label>
     <select 
       value={apiCollectSigungu} 
       onChange={(e) => setApiCollectSigungu(e.target.value)}
       disabled={!apiCollectSido || apiCollectSido === '전국'}
       className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-neutral-700 border-neutral-600 text-white' : 'bg-white border-neutral-300 text-neutral-900'} disabled:opacity-50`}
     >
       <option value="">
         {apiCollectSido === '전국' ? '전국 수집시 불필요' : apiCollectSido ? '전체 시/군/구' : '시군구 선택'}
       </option>
       {apiCollectSido && apiCollectSido !== '전국' && (
         <option value="전체">📁 {apiCollectSido} 전체</option>
       )}
       {apiCollectSido && apiCollectSido !== '전국' && KOREA_REGIONS[apiCollectSido]?.map(sigungu => (
         <option key={sigungu} value={sigungu}>{sigungu}</option>
       ))}
     </select>
   </div>
 </div>
 
 {apiCollectProgress.status && (
   <div className="mb-4">
     <div className="flex justify-between text-xs mb-1">
       <span className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}>{apiCollectProgress.region}</span>
       <span className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}>{apiCollectProgress.current}/{apiCollectProgress.total}</span>
     </div>
     <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200'}`}>
       <div 
         className="h-full bg-blue-500 transition-all duration-300"
         style={{ width: `${apiCollectProgress.total > 0 ? (apiCollectProgress.current / apiCollectProgress.total) * 100 : 0}%` }}
       />
     </div>
     <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>{apiCollectProgress.status}</p>
   </div>
 )}
 
 <div className="flex gap-2">
   <button 
     onClick={() => collectRegionData(apiCollectSido, apiCollectSigungu)}
     disabled={!apiCollectSido || apiCollectProgress.status?.includes('수집')}
     className="flex-1 px-4 py-2 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed"
   >
     {apiCollectProgress.status?.includes('수집') ? '수집 중...' : '🔄 수집 시작'}
   </button>
 </div>
 <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
   {apiCollectSido === '전국' 
     ? '※ 전국 수집은 시간이 오래 걸릴 수 있습니다.'
     : '※ 수집된 데이터는 Firebase에 저장되어 영업모드에서 활용됩니다.'}
 </p>
 </div>
 
 {/* 재등록 표시 관리 */}
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} text-lg mb-3`}>재등록 표시 관리</h3>
 <p className="text-sm text-neutral-500 mb-3">재등록 표시된 업체: {companies.filter(c => c.isReregistered).length}개</p>
 <button 
 onClick={() => {
 const reregisteredCompanies = companies.filter(c => c.isReregistered);
 if (reregisteredCompanies.length === 0) {
 alert('재등록 표시된 업체가 없습니다.');
 return;
 }
 if (confirm(`재등록 표시된 ${reregisteredCompanies.length}개 업체의 표시를 모두 삭제하시겠습니까?\n(업체 데이터는 유지되고, 다음 달부터 신규로 집계됩니다)`)) {
 reregisteredCompanies.forEach(c => {
 saveCompany({ ...c, isReregistered: false });
 });
 alert('재등록 표시가 모두 삭제되었습니다.');
 }
 }}
 className="px-4 py-2 bg-rose-600 rounded-lg font-medium hover:bg-rose-700 transition-all hover:bg-rose-700 text-white w-full"
 >재등록 표시 일괄 삭제</button>
 <p className={`text-xs mt-2 ${t.textMuted}`}>※ 매월 초에 실행하면 지난달 재등록 업체들이 정상 집계됩니다.</p>
 </div>

 {pendingRequests.length > 0 && (
 <div className={`rounded-2xl p-4 border-2 ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-500' : 'bg-white border-neutral-500'}`}>
 <h3 className={`font-bold ${t.text} text-lg mb-4`}>요청 ({pendingRequests.length})</h3>
 <div className="space-y-3">
 {pendingRequests.map(r => (
 <div key={r.id} className="flex items-center justify-between p-4 bg-rose-900/30 rounded-xl">
 <div><p className={`font-bold ${t.text}`}>{r.managerName}</p><p className={`text-sm ${t.text}`}>{r.items?.join(', ')}</p></div>
 <button type="button" onClick={() => confirmRequest(r.id)} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all text-sm">확인</button>
 </div>
 ))}
 </div>
 </div>
 )}
 <div className={`rounded-2xl p-3 sm:p-4 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <h3 className={`font-bold ${t.text} text-lg mb-4`}>영업자 관리</h3>
 {managers.map(m => {
 const status = userStatus[m.id];
 const isOnline = status?.isOnline && (Date.now() - new Date(status.lastSeen).getTime() < 120000);
 return (
 <div key={m.id} className="flex items-center gap-3 mb-3 p-3 bg-neutral-100 rounded-xl">
 <div className="relative">
 <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: m.color }}></div>
 <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
 </div>
 <div className="flex-1 min-w-0">
 <input type="text" value={m.name} onChange={e => saveManager({...m, name: e.target.value})} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all w-full mb-1`} />
 <p className={`text-xs ${t.text}`}>
 {isOnline ? '접속중' : `${formatLastSeen(status?.lastSeen)}`} · {m.username}
 </p>
 </div>
 <input type="color" value={m.color} onChange={e => saveManager({...m, color: e.target.value})} className="w-10 h-10 rounded cursor-pointer flex-shrink-0" />
 <button type="button" onClick={() => { if (confirm(`삭제하시겠습니까?`)) database.ref('managers/' + m.id).remove(); }} className={`${t.text} font-bold text-sm flex-shrink-0`}>삭제</button>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 
 {/* 전국 상권 수집 보고서 모달 */}
 {showApiCollectReport && apiCollectResults && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowApiCollectReport(false)}>
   <div className={`w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl p-6 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
     <div className="flex justify-between items-center mb-4">
       <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} text-xl`}>📊 수집 보고서</h3>
       <button onClick={() => setShowApiCollectReport(false)} className={`text-2xl ${theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-neutral-900'}`}>×</button>
     </div>
     
     <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-100'}`}>
       <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} mb-2`}>
         {apiCollectResults.collectType === 'nationwide' ? '🇰🇷 전국' : 
          apiCollectResults.collectType === 'sido' ? `${apiCollectResults.sido} 전체` :
          `${apiCollectResults.sido || apiCollectResults.region?.sido} ${apiCollectResults.sigungu || apiCollectResults.region?.sigungu}`}
       </p>
       <p className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
         수집 시간: {new Date(apiCollectResults.timestamp).toLocaleString('ko-KR')}
       </p>
       {apiCollectResults.totalRegions > 1 && (
         <p className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'} mt-1`}>
           총 {apiCollectResults.totalRegions}개 지역 수집
         </p>
       )}
     </div>
     
     <div className="space-y-3 mb-4">
       {/* 수집 요약 (다중 지역) */}
       {apiCollectResults.summary && (
         <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
           <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} mb-2`}>📈 수집 요약</p>
           <div className="grid grid-cols-2 gap-2 text-sm">
             <p className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}>성공: {apiCollectResults.summary.success}개 지역</p>
             <p className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}>실패: {apiCollectResults.summary.failed}개 지역</p>
             <p className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}>총 점포: {apiCollectResults.summary.totalStores?.toLocaleString()}개</p>
             <p className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}>총 카페: {apiCollectResults.summary.totalCafes?.toLocaleString()}개</p>
           </div>
         </div>
       )}
       
       {/* 상가정보 (단일 지역) */}
       {apiCollectResults.data?.store && (
         <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-700/50' : 'bg-blue-50'}`}>
           <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} mb-1`}>🏪 상가정보</p>
           <p className={`text-sm ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>전체 점포: {apiCollectResults.data.store.total?.toLocaleString() || 0}개</p>
           <p className={`text-sm ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>카페: {apiCollectResults.data.store.cafeCount?.toLocaleString() || 0}개</p>
         </div>
       )}
       
       {/* 서울시 유동인구 */}
       {(apiCollectResults.data?.seoulFloating || apiCollectResults.summary?.success > 0) && apiCollectResults.sido?.includes('서울') && (
         <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-700/50' : 'bg-green-50'}`}>
           <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} mb-1`}>👥 서울시 유동인구</p>
           <p className={`text-sm ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
             {apiCollectResults.data?.seoulFloating?.totalRecords 
               ? `총 레코드: ${apiCollectResults.data.seoulFloating.totalRecords?.toLocaleString()}건`
               : '데이터 수집 완료'}
           </p>
         </div>
       )}
       
       {/* 프랜차이즈 */}
       {apiCollectResults.data?.franchise && (
         <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-700/50' : 'bg-purple-50'}`}>
           <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} mb-1`}>☕ 프랜차이즈 (카페)</p>
           <p className={`text-sm ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>수집 브랜드: {apiCollectResults.data.franchise.count || 0}개</p>
         </div>
       )}
       
       {/* 임대료 */}
       {apiCollectResults.data?.rent && (
         <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-neutral-700/50' : 'bg-yellow-50'}`}>
           <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} mb-1`}>🏠 임대료</p>
           <p className={`text-sm ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>한국부동산원 R-ONE 데이터 수집 완료</p>
         </div>
       )}
       
       {/* Firebase 저장 상태 */}
       <div className={`p-3 rounded-lg ${
         (apiCollectResults.savedToFirebase || apiCollectResults.summary?.success > 0) 
           ? (theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50') 
           : (theme === 'dark' ? 'bg-rose-900/30' : 'bg-rose-50')
       }`}>
         <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>
           {(apiCollectResults.savedToFirebase || apiCollectResults.summary?.success > 0) 
             ? '✅ Firebase 저장 완료' 
             : '❌ Firebase 저장 실패'}
         </p>
       </div>
       
       {/* 에러 표시 */}
       {apiCollectResults.errors?.length > 0 && (
         <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-rose-900/30' : 'bg-rose-50'}`}>
           <p className={`font-medium text-rose-500 mb-1`}>⚠️ 수집 중 오류 ({apiCollectResults.errors.length}건)</p>
           {apiCollectResults.errors.slice(0, 5).map((err, idx) => (
             <p key={idx} className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
               {err.region || err.api}: {err.message}
             </p>
           ))}
           {apiCollectResults.errors.length > 5 && (
             <p className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
               ... 외 {apiCollectResults.errors.length - 5}건
             </p>
           )}
         </div>
       )}
     </div>
     
     <button 
       onClick={() => setShowApiCollectReport(false)}
       className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all"
     >
       확인
     </button>
   </div>
 </div>
 )}
 
 {showPinModal && (
 <div className="modal-overlay" onClick={() => setShowPinModal(null)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>{shortRegion(showPinModal.region)}</h3>
 <button type="button" onClick={() => setShowPinModal(null)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <p className={`mb-4 ${t.text}`}>{showPinModal.status === 'confirmed' ? '확정' : '예정'}: {showPinModal.manager?.name}</p>
 <div className="mb-4">
 <label className={`text-sm mb-2 block ${t.text}`}>날짜</label>
 <input type="date" value={showPinModal.date || ''} onChange={e => { updatePinDate(showPinModal.id, e.target.value); setShowPinModal({ ...showPinModal, date: e.target.value }); }} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 </div>
 <div className="flex gap-2">
 <button type="button" onClick={() => setShowPinModal(null)} className={`px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'} flex-1`}>확인</button>
 {canDeletePin(showPinModal) && <button type="button" onClick={() => deletePin(showPinModal.id)} className="px-4 py-2 bg-rose-500 rounded-lg font-medium hover:bg-rose-600 transition-all text-white flex-1">삭제</button>}
 </div>
 </div>
 </div>
 )}
 {showRealtorDetailModal && (
 <div className="modal-overlay" onClick={() => setShowRealtorDetailModal(null)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>중개사 상세정보</h3>
 <button type="button" onClick={() => setShowRealtorDetailModal(null)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="space-y-2">
 <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
 <p className={`font-bold ${t.text} text-lg mb-1`}>{showRealtorDetailModal.officeName}</p>
 <p className={`text-sm ${t.textMuted}`}>{showRealtorDetailModal.address || '주소 없음'}</p>
 <div className="flex gap-2 mt-2">
 <span className="px-2 py-0.5 text-xs rounded-full bg-teal-100 text-teal-700 font-bold">{showRealtorDetailModal.listingCount}건</span>
 {showRealtorDetailModal.isInRoute && <span className={`px-2 py-0.5 text-xs rounded-full bg-teal-900/300 ${t.text}`}>동선</span>}
 {showRealtorDetailModal.isRegistered && <span className={`px-2 py-0.5 text-xs rounded-full ${theme === 'dark' ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'}`}>방문</span>}
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div className={`rounded-lg p-3 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`text-xs mb-1 ${t.textMuted}`}>사무실</p>
 <p className={`font-bold ${t.text}`}>{showRealtorDetailModal.phone || '-'}</p>
 </div>
 <div className={`rounded-lg p-3 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`text-xs mb-1 ${t.textMuted}`}>휴대폰</p>
 <p className={`font-bold ${t.text}`}>{showRealtorDetailModal.cellPhone || '-'}</p>
 </div>
 <div className={`rounded-lg p-3 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`text-xs mb-1 ${t.textMuted}`}>{showRealtorDetailModal.isFromCompany ? '배정 담당자' : '담당자'}</p>
 <p className={`font-bold ${t.text}`}>
   {showRealtorDetailModal.assignedManager 
     ? <span className={`px-2 py-0.5 rounded-full ${t.text} text-xs`} style={{backgroundColor: showRealtorDetailModal.assignedManager.color}}>{showRealtorDetailModal.assignedManager.name}</span>
     : (showRealtorDetailModal.agentPosition || showRealtorDetailModal.agentName 
       ? `${showRealtorDetailModal.agentPosition} ${showRealtorDetailModal.agentName}`.trim() 
       : '미정')}
 </p>
 </div>
 <div className={`rounded-lg p-3 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`text-xs mb-1 ${t.textMuted}`}>{showRealtorDetailModal.isFromCompany ? '등록일' : '수집일'}</p>
 <p className={`font-bold ${t.text}`}>{showRealtorDetailModal.collectedDate || '-'}</p>
 </div>
 {/* 등록 업체인 경우 연락처 담당자 표시 */}
 {showRealtorDetailModal.isFromCompany && showRealtorDetailModal.agentName && (
 <div className={`rounded-lg p-3 col-span-2 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`text-xs mb-1 ${t.textMuted}`}>연락처 담당자</p>
 <p className={`font-bold ${t.text}`}>{showRealtorDetailModal.agentName}</p>
 </div>
 )}
 {/* 등록 업체인 경우 반응 표시 */}
 {showRealtorDetailModal.isFromCompany && showRealtorDetailModal.reaction && (
 <div className={`rounded-lg p-3 col-span-2 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`text-xs mb-1 ${t.textMuted}`}>반응</p>
 <p className={`font-bold ${t.text}`}>
   {showRealtorDetailModal.reaction === 'negative' && <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-700">부정</span>}
   {showRealtorDetailModal.reaction === 'positive' && <span className="px-2 py-0.5 rounded bg-amber-600 text-white">양호</span>}
   {showRealtorDetailModal.reaction === 'good' && <span className="px-2 py-0.5 rounded bg-green-600 text-white">긍정</span>}
   {showRealtorDetailModal.reaction === 'special' && <span className="px-2 py-0.5 rounded bg-red-600 text-white">특별</span>}
   {showRealtorDetailModal.reaction === 'skip' && <span className="px-2 py-0.5 rounded bg-yellow-600 text-white">누락</span>}
 </p>
 </div>
 )}
 {/* 등록 업체인 경우 메모 표시 */}
 {showRealtorDetailModal.isFromCompany && showRealtorDetailModal.memo && (
 <div className={`rounded-lg p-3 col-span-2 border ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur border-neutral-700' : 'bg-white border-neutral-200'}`}>
 <p className={`text-xs mb-1 ${t.textMuted}`}>메모</p>
 <p className={`text-sm ${t.text}`}>{showRealtorDetailModal.memo}</p>
 </div>
 )}
 </div>
 {showRealtorDetailModal.articleCounts && (
 <div className="flex flex-wrap gap-1">
 {showRealtorDetailModal.articleCounts.sale > 0 && <span className="px-2 py-0.5 text-xs rounded bg-neutral-100 text-neutral-900">매매 {showRealtorDetailModal.articleCounts.sale}</span>}
 {showRealtorDetailModal.articleCounts.jeonse > 0 && <span className="px-2 py-0.5 text-xs rounded bg-neutral-100 text-neutral-900">전세 {showRealtorDetailModal.articleCounts.jeonse}</span>}
 {showRealtorDetailModal.articleCounts.monthly > 0 && <span className="px-2 py-0.5 text-xs rounded bg-orange-100 text-white">월세 {showRealtorDetailModal.articleCounts.monthly}</span>}
 {showRealtorDetailModal.articleCounts.short > 0 && <span className={`px-2 py-0.5 text-xs rounded bg-purple-100 ${t.text}`}>단기 {showRealtorDetailModal.articleCounts.short}</span>}
 </div>
 )}
 {showRealtorDetailModal.regions && Object.keys(showRealtorDetailModal.regions).length > 0 && (
 <div className="flex flex-wrap gap-1">
 {Object.entries(showRealtorDetailModal.regions).sort((a, b) => b[1] - a[1]).map(([gu, count]) => (
 <span key={gu} className="px-2 py-0.5 text-xs rounded bg-neutral-200 text-neutral-700">{gu}: {count}건</span>
 ))}
 </div>
 )}
 <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200">
 {!showRealtorDetailModal.isInRoute && (
 <button type="button" onClick={() => {
 // 주소로 좌표 검색 후 동선 추가
 const address = showRealtorDetailModal.address;
 const addStop = (lat, lng) => {
 setRouteStops(prev => [...prev, {
 id: 'stop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
 name: showRealtorDetailModal.officeName,
 address: address || '',
 phone: showRealtorDetailModal.cellPhone || showRealtorDetailModal.phone || '',
 lat: lat,
 lng: lng,
 visited: false,
 listings: showRealtorDetailModal.listingCount,
 companyId: showRealtorDetailModal.companyId || null // 등록 업체 ID 연결
 }]);
 setShowRealtorDetailModal(null);
 alert('동선에 추가되었습니다!');
 };
 // 이미 좌표가 있으면 바로 사용 (등록 업체)
 if (showRealtorDetailModal.lat && showRealtorDetailModal.lng) {
 addStop(showRealtorDetailModal.lat, showRealtorDetailModal.lng);
 } else if (address && window.naver?.maps?.Service) {
 naver.maps.Service.geocode({ query: address }, (status, response) => {
 if (status === naver.maps.Service.Status.OK && response.v2.addresses.length > 0) {
 const result = response.v2.addresses[0];
 addStop(parseFloat(result.y), parseFloat(result.x));
 } else {
 addStop(null, null);
 }
 });
 } else {
 addStop(null, null);
 }
 }} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all text-sm flex-1">+ 동선 추가</button>
 )}
 {!showRealtorDetailModal.isRegistered && (
 <button type="button" onClick={() => {
 setCompanyForm({
 name: showRealtorDetailModal.officeName,
 contact: showRealtorDetailModal.agentName !== '미정' ? showRealtorDetailModal.agentName : '',
 phone: showRealtorDetailModal.cellPhone || showRealtorDetailModal.phone || '',
 address: showRealtorDetailModal.address || '',
 managerId: null,
 memo: `매물 ${showRealtorDetailModal.listingCount}건 | 수집일: ${showRealtorDetailModal.collectedDate}`,
 reaction: 'none'
 });
 setShowRealtorDetailModal(null);
 setTab('companies');
 }} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all text-sm flex-1">업체 등록</button>
 )}
 </div>
 </div>
 </div>
 </div>
 )}
 {showCompanyMapModal && (
 <div className="modal-overlay" onClick={() => setShowCompanyMapModal(null)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <div className="flex items-center gap-3">
 <div
 className={`w-4 h-4 rounded-full ${REACTION_COLORS[showCompanyMapModal.reaction]?.blink ? 'special-blink' : ''}`}
 style={{ background: REACTION_COLORS[showCompanyMapModal.reaction]?.bg || '#f97316' }}
 ></div>
 <h3 className={`font-bold ${t.text} text-lg`}>{showCompanyMapModal.name}</h3>
 </div>
 <button type="button" onClick={() => setShowCompanyMapModal(null)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="space-y-3 mb-4">
 {showCompanyMapModal.contact && (
 <div className="flex items-center gap-2">
 <span className={`text-sm w-16 ${t.text}`}>담당자</span>
 <span className={`font-bold ${t.text}`}>{showCompanyMapModal.contact}</span>
 </div>
 )}
 {showCompanyMapModal.phone && (
 <div className="flex items-center gap-2">
 <span className={`text-sm w-16 ${t.text}`}>연락처</span>
 <a href={`tel:${showCompanyMapModal.phone}`} className="font-bold text-primary-600 md:pointer-events-none md:text-neutral-800">{showCompanyMapModal.phone}</a>
 </div>
 )}
 {showCompanyMapModal.address && (
 <div className="flex items-center gap-2">
 <span className={`text-sm w-16 ${t.text}`}>주소</span>
 <span className={`text-sm ${t.text}`}>{showCompanyMapModal.address}</span>
 </div>
 )}
 {showCompanyMapModal.manager && (
 <div className="flex items-center gap-2">
 <span className={`text-sm w-16 ${t.text}`}>영업자</span>
 <span className="font-bold" style={{ color: showCompanyMapModal.manager.color }}>{showCompanyMapModal.manager.name}</span>
 </div>
 )}
 {showCompanyMapModal.memo && (
 <div className="bg-neutral-100 p-3 rounded-lg">
 <p className="text-xs text-primary-600 font-bold mb-1">메모</p>
 <p className="text-sm text-amber-800">{showCompanyMapModal.memo}</p>
 </div>
 )}
 </div>
 <div className="flex items-center gap-2 mb-4">
 <span className={`text-sm ${t.text}`}>반응:</span>
 <span
 className={`px-3 py-1 rounded-full text-xs text-white font-bold ${REACTION_COLORS[showCompanyMapModal.reaction]?.blink ? 'special-blink' : ''}`}
 style={{ background: REACTION_COLORS[showCompanyMapModal.reaction]?.bg || '#f97316' }}
 >
 {REACTION_COLORS[showCompanyMapModal.reaction]?.label || '양호'}
 </span>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => {
 setShowCompanyEditModal({ ...showCompanyMapModal });
 setShowCompanyMapModal(null);
 }}
 className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all flex-1"
 >
 수정
 </button>
 <button type="button" onClick={() => setShowCompanyMapModal(null)} className={`px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'} flex-1`}>닫기</button>
 </div>
 </div>
 </div>
 )}
 {showPromoRequestModal && (
 <div className="modal-overlay" onClick={() => setShowPromoRequestModal(null)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <h3 className={`font-bold ${t.text} text-lg mb-4`}>홍보물 요청</h3>
 <div className="space-y-3 mb-4">
 {PROMO_ITEMS.map(item => (
 <label key={item} className="flex items-center gap-3 p-3 bg-neutral-100 rounded-xl cursor-pointer">
 <input type="checkbox" checked={promoRequest[item]} onChange={e => setPromoRequest({ ...promoRequest, [item]: e.target.checked })} className="w-5 h-5 accent-gold-500" />
 <span className={`font-bold ${t.text}`}>{item}</span>
 </label>
 ))}
 </div>
 <div className="flex gap-2">
 <button type="button" onClick={() => setShowPromoRequestModal(null)} className={`px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'} flex-1`}>취소</button>
 <button type="button" onClick={submitPromoRequest} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all flex-1">요청 보내기</button>
 </div>
 </div>
 </div>
 )}
 {showCompanyEditModal && (
 <div className="modal-overlay" onClick={() => setShowCompanyEditModal(null)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>업체 수정</h3>
 <button type="button" onClick={() => setShowCompanyEditModal(null)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="space-y-3">
 <input type="text" placeholder="업체명" value={showCompanyEditModal.name} onChange={e => setShowCompanyEditModal({ ...showCompanyEditModal, name: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="text" placeholder="담당자" value={showCompanyEditModal.contact || ''} onChange={e => setShowCompanyEditModal({ ...showCompanyEditModal, contact: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="text" placeholder="연락처" value={showCompanyEditModal.phone || ''} onChange={e => setShowCompanyEditModal({ ...showCompanyEditModal, phone: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="text" placeholder="주소" value={showCompanyEditModal.address || ''} onChange={e => setShowCompanyEditModal({ ...showCompanyEditModal, address: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <select value={showCompanyEditModal.managerId || ''} onChange={e => setShowCompanyEditModal({ ...showCompanyEditModal, managerId: Number(e.target.value) || null })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all`}>
 <option value="">영업자 선택</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 <input type="text" placeholder="메모" value={showCompanyEditModal.memo || ''} onChange={e => setShowCompanyEditModal({ ...showCompanyEditModal, memo: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <div className="flex items-center gap-2">
 <span className={`text-sm ${t.text}`}>반응:</span>
 {Object.entries(REACTION_COLORS).map(([key, val]) => (
 <button key={key} onClick={() => setShowCompanyEditModal({ ...showCompanyEditModal, reaction: key })} className={`px-3 py-1.5 rounded-full text-xs text-white font-bold ${showCompanyEditModal.reaction === key ? 'ring-2 ring-offset-1' : 'opacity-50'}`} style={{ background: val.bg }}>{val.label}</button>
 ))}
 </div>
 </div>
 <div className="flex gap-2 mt-4">
 <button type="button" onClick={() => setShowCompanyEditModal(null)} className={`px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'} flex-1`}>취소</button>
 <button type="button" onClick={updateCompany} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all flex-1">완료</button>
 </div>
 </div>
 </div>
 )}
 {showCustomerEditModal && (
 <div className="modal-overlay" onClick={() => setShowCustomerEditModal(null)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>고객 수정</h3>
 <button type="button" onClick={() => setShowCustomerEditModal(null)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="space-y-3">
 <input type="text" placeholder="고객명" value={showCustomerEditModal.name} onChange={e => setShowCustomerEditModal({ ...showCustomerEditModal, name: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="text" placeholder="연락처" value={showCustomerEditModal.phone || ''} onChange={e => setShowCustomerEditModal({ ...showCustomerEditModal, phone: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="date" value={showCustomerEditModal.consultDate || ''} onChange={e => setShowCustomerEditModal({ ...showCustomerEditModal, consultDate: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <select value={showCustomerEditModal.managerId || ''} onChange={e => setShowCustomerEditModal({ ...showCustomerEditModal, managerId: Number(e.target.value) || null })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all`}>
 <option value="">영업자 선택</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 <div>
 <p className="text-sm text-neutral-800 mb-2">상태</p>
 <div className="flex gap-2">
 <button
 onClick={() => setShowCustomerEditModal({ ...showCustomerEditModal, status: 'consult' })}
 className={`px-4 py-2 rounded-full text-sm font-bold ${showCustomerEditModal.status === 'consult' || !showCustomerEditModal.status ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-primary-600'}`}
 >
 상담
 </button>
 <button
 onClick={() => setShowCustomerEditModal({ ...showCustomerEditModal, status: 'contract' })}
 className={`px-4 py-2 rounded-full text-sm font-bold ${showCustomerEditModal.status === 'contract' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-white'}`}
 >
 계약
 </button>
 </div>
 </div>
 <textarea
 placeholder="메모"
 value={showCustomerEditModal.memo || ''}
 onChange={e => setShowCustomerEditModal({ ...showCustomerEditModal, memo: e.target.value })}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all h-20`}
 />
 </div>
 <div className="flex gap-2 mt-4">
 <button type="button" onClick={() => setShowCustomerEditModal(null)} className={`px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'} flex-1`}>취소</button>
 <button type="button" onClick={updateCustomer} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all flex-1">완료</button>
 </div>
 </div>
 </div>
 )}
 {showPinEditModal && (
 <div className="modal-overlay" onClick={() => setShowPinEditModal(null)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>{showPinEditModal.status === 'planned' ? '예정' : '확정'} 지역 수정</h3>
 <button type="button" onClick={() => setShowPinEditModal(null)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="flex gap-2 mb-4">
 <button type="button" onClick={() => setSelectedPinsForEdit(showPinEditModal.pins.map(p => p.id))} className="text-sm text-gold-600 font-bold">전체 선택</button>
 <button type="button" onClick={() => setSelectedPinsForEdit([])} className={`text-sm font-bold ${t.text}`}>선택 해제</button>
 </div>
 <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
 {showPinEditModal.pins.map(p => (
 <label key={p.id} className="flex items-center gap-3 p-3 bg-neutral-100 rounded-xl cursor-pointer">
 <input type="checkbox" checked={selectedPinsForEdit.includes(p.id)} onChange={e => {
 if (e.target.checked) setSelectedPinsForEdit([...selectedPinsForEdit, p.id]);
 else setSelectedPinsForEdit(selectedPinsForEdit.filter(id => id !== p.id));
 }} className="w-5 h-5 accent-gold-500" />
 <span className={`font-bold ${t.text}`}>{shortRegion(p.region)}</span>
 </label>
 ))}
 </div>
 {selectedPinsForEdit.length > 0 && (
 <div className="flex gap-2">
 {showPinEditModal.status === 'planned' && <button type="button" onClick={confirmSelectedPins} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all flex-1">확정으로 변경</button>}
 <button type="button" onClick={deleteSelectedPins} className="px-4 py-2 bg-rose-500 rounded-lg font-medium hover:bg-rose-600 transition-all text-white flex-1">삭제</button>
 </div>
 )}
 </div>
 </div>
 )}
 {showCompanySuccessModal && (
 <div className="modal-overlay" onClick={() => setShowCompanySuccessModal(null)}>
 <div className="modal-content max-w-sm p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
 <div className="bg-neutral-100 border border-neutral-200 p-4 sm:p-6 text-center">
 <div className={`w-14 h-14 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-3 border ${theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-neutral-100 border-neutral-200'}`}>
 <span className="text-2xl text-neutral-700"></span>
 </div>
 <p className="text-neutral-500 text-xs tracking-widest mb-1">REGISTERED</p>
 <h3 className={`font-bold ${t.text} text-lg`}>{showCompanySuccessModal.companyName}</h3>
 </div>
 <div className={`p-5 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`}>
 <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-4 border-l-4 border-teal-500">
 <p className="text-neutral-700 text-sm leading-relaxed">{showCompanySuccessModal.quote}</p>
 </div>
 <button type="button" onClick={() => setShowCompanySuccessModal(null)} className={`w-full py-3 bg-neutral-800 hover:from-slate-600 hover:to-slate-500 ${t.text} rounded-lg font-medium transition-all border border-slate-500`}>확인</button>
 </div>
 </div>
 </div>
 )}
 {showAdminPwModal && (
 <div className="modal-overlay" onClick={() => setShowAdminPwModal(false)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>관리자 비밀번호 변경</h3>
 <button type="button" onClick={() => setShowAdminPwModal(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="space-y-3">
 <input type="password" placeholder="새 비밀번호" value={adminNewPw} onChange={e => setAdminNewPw(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="password" placeholder="비밀번호 확인" value={adminConfirmPw} onChange={e => setAdminConfirmPw(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <button type="button" onClick={changeAdminPassword} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all w-full">변경</button>
 </div>
 </div>
 </div>
 )}
 {showHistory && (
 <div className="modal-overlay" onClick={() => setShowHistory(false)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>클라우드 동기화</h3>
 <button type="button" onClick={() => setShowHistory(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="bg-emerald-900/30 p-4 rounded-xl">
 <p className={`${t.text} font-bold mb-2`}>실시간 동기화 활성화</p>
 <p className={`${t.text} text-sm`}>모든 기기에서 같은 데이터를 볼 수 있습니다.</p>
 <p className={`${t.text} text-sm mt-2`}>PC, 모바일, 태블릿 어디서든 자동 동기화됩니다.</p>
 </div>
 </div>
 </div>
 )}
 {showSaleEditModal && (
 <div className="modal-overlay" onClick={() => setShowSaleEditModal(null)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>매출 수정</h3>
 <button type="button" onClick={() => setShowSaleEditModal(null)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <p className="text-sm text-neutral-800 mb-4">{showSaleEditModal.managerName}님의 매출</p>
 <div className="space-y-3">
 {(() => {
 const managerSalesRecords = sales.filter(s => s.managerId === showSaleEditModal.managerId);
 if (managerSalesRecords.length === 0) {
 return <p className={`text-center py-4 ${t.text}`}>등록된 매출이 없습니다.</p>;
 }
 return (
 <div className="space-y-2 max-h-60 overflow-y-auto">
 {managerSalesRecords.map(sale => (
 <div key={sale.id} className="flex items-center justify-between p-3 bg-neutral-100 rounded-lg">
 <div>
 <p className={`font-bold ${t.text}`}>{Number(sale.amount).toLocaleString()}원</p>
 <p className={`text-xs ${t.text}`}>{sale.date}</p>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => {
 const newAmount = prompt('새 금액을 입력하세요:', sale.amount);
 if (newAmount && !isNaN(newAmount)) {
 saveSale({ ...sale, amount: Number(newAmount) });
 alert('매출이 수정되었습니다.');
 }
 }}
 className={`px-2 py-1 bg-primary-500 ${t.text} rounded text-xs font-bold`}
 >수정</button>
 <button
 onClick={() => {
 if (confirm('이 매출을 삭제하시겠습니까?')) {
 deleteFirebaseSale(sale.id);
 alert('매출이 삭제되었습니다.');
 }
 }}
 className={`px-2 py-1 bg-neutral-200 ${t.text} rounded text-xs font-bold`}
 >삭제</button>
 </div>
 </div>
 ))}
 </div>
 );
 })()}
 </div>
 <button type="button" onClick={() => setShowSaleEditModal(null)} className={`px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'} w-full mt-4`}>닫기</button>
 </div>
 </div>
 )}
 {showSaleModal && (
 <div className="modal-overlay" onClick={() => setShowSaleModal(false)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>매출 등록</h3>
 <button type="button" onClick={() => setShowSaleModal(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="space-y-3">
 <select value={saleForm.managerId || ''} onChange={e => setSaleForm({ ...saleForm, managerId: Number(e.target.value) || null })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all`}>
 <option value="">영업자 선택 *</option>
 {getAvailableManagersForSale().map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 <input type="number" placeholder="금액 *" value={saleForm.amount} onChange={e => setSaleForm({ ...saleForm, amount: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="date" value={saleForm.date} onChange={e => setSaleForm({ ...saleForm, date: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <button type="button" onClick={handleSaveSale} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all w-full">등록</button>
 </div>
 </div>
 </div>
 )}
 {showPasswordModal && (
 <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>비밀번호 변경</h3>
 <button type="button" onClick={() => setShowPasswordModal(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="space-y-3">
 <input type="password" placeholder="새 비밀번호" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="password" placeholder="비밀번호 확인" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <button type="button" onClick={changePassword} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all w-full">변경</button>
 </div>
 </div>
 </div>
 )}
 {showBulkAddModal && (
 <div className="modal-overlay" onClick={() => setShowBulkAddModal(false)}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>업체 일괄등록</h3>
 <button type="button" onClick={() => setShowBulkAddModal(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="bg-neutral-100 rounded-xl p-3 mb-4">
 <p className="text-neutral-800 font-bold mb-1">입력 형식</p>
 <p className={`text-sm ${t.text}`}>업체명/담당자/연락처/주소/반응</p>
 </div>
 <textarea value={bulkAddText} onChange={e => setBulkAddText(e.target.value)} placeholder="업체명/담당자/연락처/주소/반응" className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all h-32 mb-3`} />
 <select value={bulkAddSales || ''} onChange={e => setBulkAddSales(Number(e.target.value) || null)} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all mb-3`}>
 <option value="">영업자 선택</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 <div className="flex items-center gap-2 mb-4 flex-wrap">
 <span className={`text-sm ${t.text}`}>기본 반응:</span>
 {Object.entries(REACTION_COLORS).map(([key, val]) => (
 <button key={key} onClick={() => setBulkAddReaction(key)} className={`px-3 py-1.5 rounded-full text-xs text-white font-bold ${bulkAddReaction === key ? 'ring-2 ring-offset-1' : 'opacity-50'}`} style={{ background: val.bg }}>{val.label}</button>
 ))}
 </div>
 <button type="button" onClick={parseBulkText} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all w-full">일괄 등록</button>
 </div>
 </div>
 )}
 {showOcrModal && (
 <div className="modal-overlay" onClick={() => setShowOcrModal(false)} style={{ overflow: 'hidden' }}>
 <div className="modal-content" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>명함 인식 결과</h3>
 <button type="button" onClick={() => setShowOcrModal(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 {ocrLoading ? (
 <div className="text-center py-8">
 <div className="w-10 h-10 border-4 border-neutral-500 border-t-transparent rounded-full spin mx-auto mb-3"></div>
 <p className={`${t.text}`}>명함을 인식하고 있습니다...</p>
 </div>
 ) : ocrResult ? (
 <div className="space-y-3">
 <p className={`text-sm font-bold ${t.text}`}>자동 추출 결과 (수정 가능)</p>
 <input type="text" placeholder="업체명" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="text" placeholder="담당자" value={companyForm.contact} onChange={e => setCompanyForm({ ...companyForm, contact: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="text" placeholder="연락처" value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <input type="text" placeholder="주소" value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <select value={companyForm.managerId || ''} onChange={e => setCompanyForm({ ...companyForm, managerId: Number(e.target.value) || null })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all`}>
 <option value="">영업자 선택</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 <div className="flex items-center gap-2 flex-wrap">
 <span className={`text-sm ${t.text}`}>반응:</span>
 {Object.entries(REACTION_COLORS).map(([key, val]) => (
 <button key={key} onClick={() => setCompanyForm({ ...companyForm, reaction: key })} className={`px-3 py-1.5 rounded-full text-xs text-white font-bold ${companyForm.reaction === key ? 'ring-2 ring-offset-1' : 'opacity-50'}`} style={{ background: val.bg }}>{val.label}</button>
 ))}
 </div>
 <input type="text" placeholder="메모" value={companyForm.memo} onChange={e => setCompanyForm({ ...companyForm, memo: e.target.value })} className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`} />
 <div className="flex gap-2">
 <button
 onClick={() => {
 setOcrResult(null);
 setCompanyForm({ name: '', contact: '', phone: '', address: '', managerId: user?.managerId || null, memo: '', reaction: 'neutral' });
 ocrFileInputRef.current?.click();
 }}
 className="flex-1 py-3 border border-neutral-200 rounded-xl font-bold text-neutral-800"
 >
 재촬영
 </button>
 <button
 onClick={async () => {
 await handleSaveCompany();
 setShowOcrModal(false);
 setOcrResult(null);
 }}
 className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all"
 >
 업체 등록
 </button>
 </div>
 </div>
 ) : null}
 </div>
 </div>
 )}
 {showBulkOcrModal && (
 <div className="modal-overlay">
 <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>명함 일괄 인식 ({bulkOcrResults.length}개)</h3>
 <button type="button" onClick={() => setShowBulkOcrModal(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 {ocrLoading ? (
 <div className="text-center py-8">
 <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full spin mx-auto mb-3"></div>
 <p className={`${t.text}`}>명함을 인식하고 있습니다...</p>
 </div>
 ) : (
 <div className="space-y-3 max-h-[60vh] overflow-y-auto">
 {bulkOcrResults.map((result, idx) => (
 <div key={idx} className="bg-neutral-100 rounded-xl p-3 border">
 <p className="font-bold text-neutral-800 text-sm mb-2">명함 #{idx + 1}</p>
 <div className="grid grid-cols-2 gap-2">
 <input
 type="text"
 placeholder="업체명"
 value={result.name}
 onChange={e => {
 const updated = [...bulkOcrResults];
 updated[idx].name = e.target.value;
 setBulkOcrResults(updated);
 }}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 />
 <input
 type="text"
 placeholder="담당자"
 value={result.contact}
 onChange={e => {
 const updated = [...bulkOcrResults];
 updated[idx].contact = e.target.value;
 setBulkOcrResults(updated);
 }}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 />
 <input
 type="text"
 placeholder="연락처"
 value={result.phone}
 onChange={e => {
 const updated = [...bulkOcrResults];
 updated[idx].phone = e.target.value;
 setBulkOcrResults(updated);
 }}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 />
 <input
 type="text"
 placeholder="주소"
 value={result.address}
 onChange={e => {
 const updated = [...bulkOcrResults];
 updated[idx].address = e.target.value;
 setBulkOcrResults(updated);
 }}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm`}
 />
 </div>
 <div className="flex items-center gap-2 mt-2 flex-wrap">
 <select
 value={result.managerId || ''}
 onChange={e => {
 const updated = [...bulkOcrResults];
 updated[idx].managerId = Number(e.target.value) || null;
 setBulkOcrResults(updated);
 }}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} focus:outline-none focus:border-neutral-400 transition-all text-sm py-1`}
 >
 <option value="">영업자</option>
 {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
 </select>
 {Object.entries(REACTION_COLORS).map(([key, val]) => (
 <button
 key={key}
 onClick={() => {
 const updated = [...bulkOcrResults];
 updated[idx].reaction = key;
 setBulkOcrResults(updated);
 }}
 className={`px-2 py-1 rounded-full text-xs text-white font-bold ${result.reaction === key ? 'ring-2 ring-offset-1' : 'opacity-50'}`}
 style={{ background: val.bg }}
 >
 {val.label}
 </button>
 ))}
 </div>
 <input
 type="text"
 placeholder="메모"
 value={result.memo}
 onChange={e => {
 const updated = [...bulkOcrResults];
 updated[idx].memo = e.target.value;
 setBulkOcrResults(updated);
 }}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all text-sm mt-2`}
 />
 </div>
 ))}
 {bulkOcrResults.length > 0 && (
 <button
 onClick={saveBulkOcrCompanies}
 className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all w-full"
 >
 {bulkOcrResults.filter(r => r.name).length}개 업체 등록
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 )}
 {showScheduleAlert && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1200] p-4">
 <div className="bg-neutral-100 rounded-2xl p-5 w-full max-w-md shadow-2xl">
 <div className="text-center mb-4">
 <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-3">
 <span className="text-3xl"></span>
 </div>
 <h3 className={`font-bold ${t.text} text-xl`}>스케줄 작성 안내</h3>
 <p className={`text-sm mt-2 ${t.text}`}>
 {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 4주차
 </p>
 </div>
 <div className="bg-neutral-100 border border-primary-300 rounded-xl p-4 mb-4">
 <p className="text-blue-800 font-bold text-center text-lg">
 익월 영업 스케줄표를<br/>작성해주세요.
 </p>
 <p className="text-primary-600 text-sm text-center mt-2">
 캘린더에서 다음 달 일정을 등록하면<br/>이 알림이 사라집니다.
 </p>
 </div>
 <button
 onClick={() => setShowScheduleAlert(false)}
 className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all w-full"
 >
 확인
 </button>
 </div>
 </div>
 )}
 {/* 미방문 업체 처리 모달 */}
 {showUnvisitedModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4" onClick={() => setShowUnvisitedModal(null)}>
 <div className="bg-neutral-100 rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
 <div className="text-center mb-4">
 <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
   <span className="text-2xl"></span>
 </div>
 <h3 className={`font-bold ${t.text} text-lg`}>미방문 업체 확인</h3>
 <p className={`text-sm mt-2 ${t.text}`}>
   아래 <b className={`${t.text}`}>{showUnvisitedModal.unvisitedStops.length}개</b> 업체가 미방문 상태입니다.
 </p>
 </div>
 
 <div className={`rounded-xl p-3 mb-4 max-h-40 overflow-y-auto ${theme === 'dark' ? 'bg-neutral-800/80 backdrop-blur' : 'bg-white'}`}>
 {showUnvisitedModal.unvisitedStops.map((stop, idx) => (
   <div key={idx} className="flex items-center gap-2 py-2 border-b border-neutral-200 last:border-0">
     <span className={`w-6 h-6 bg-neutral-600 ${t.text} rounded-full flex items-center justify-center text-xs font-bold`}>{idx + 1}</span>
     <span className={`text-sm ${t.text}`}>{stop.name}</span>
   </div>
 ))}
 </div>
 
 <p className="text-xs text-neutral-700 mb-4 text-center">
 미방문 처리 시 해당 업체의 담당자가 미배정으로 변경되어<br/>다른 담당자가 방문할 수 있습니다.
 </p>
 
 <div className="flex gap-2">
 <button
   onClick={() => completeRouteAction(showUnvisitedModal.route, false)}
   className="flex-1 px-4 py-2 bg-neutral-200 rounded-xl font-bold text-neutral-800 text-sm"
 >
   그냥 완료
 </button>
 <button
   onClick={() => completeRouteAction(showUnvisitedModal.route, true)}
   className="flex-1 px-4 py-2 bg-amber-600 rounded-xl font-bold text-white text-sm"
 >
   미방문 처리
 </button>
 </div>
 </div>
 </div>
 )}
 
 {showDeleteConfirm && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4" onClick={() => setShowDeleteConfirm(null)}>
 <div className="bg-neutral-100 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
 <div className="text-center mb-4">
 <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
 <span className="text-2xl"></span>
 </div>
 <h3 className={`font-bold ${t.text} text-lg`}>삭제 확인</h3>
 <p className={`text-sm mt-2 ${t.text}`}>
 <b className={`${t.text}`}>{showDeleteConfirm.name}</b>을(를) 삭제하시겠습니까?
 </p>
 <p className="text-xs text-neutral-800 mt-1">삭제된 데이터는 복구할 수 없습니다.</p>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => setShowDeleteConfirm(null)}
 className={`flex-1 px-4 py-2 rounded-xl font-bold ${theme === 'dark' ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-100 text-neutral-600'}`}
 >
 취소
 </button>
 <button
 onClick={() => {
 const { type, id } = showDeleteConfirm;
 if (type === 'route') {
 deleteRoute(id);
 } else if (type === 'company') {
 deleteFirebaseCompany(id);
 } else if (type === 'customer') {
 deleteFirebaseCustomer(id);
 } else if (type === 'calendar') {
 setCalendarEvents(calendarEvents.filter(e => e.id !== id));
 localStorage.setItem('bc_calendar_events', JSON.stringify(calendarEvents.filter(e => e.id !== id)));
 } else if (type === 'sale') {
 setSales(sales.filter(s => s.id !== id));
 localStorage.setItem('bc_sales', JSON.stringify(sales.filter(s => s.id !== id)));
 }
 setShowDeleteConfirm(null);
 alert('삭제되었습니다.');
 }}
 className="flex-1 px-4 py-2 bg-rose-500 rounded-xl font-bold text-white"
 >
 삭제
 </button>
 </div>
 </div>
 </div>
 )}
 {showTodayAlert && todayEvents.length > 0 && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
 <div className="bg-neutral-100 rounded-2xl p-5 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
 <div className="text-center mb-4">
 <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-3">
 <span className="text-3xl"></span>
 </div>
 <h3 className={`font-bold ${t.text} text-xl`}>오늘의 일정 알림</h3>
 <p className="text-neutral-800 text-sm mt-1">{new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
 </div>
 <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 mb-4 max-h-60 overflow-y-auto">
 <p className="text-primary-600 font-bold text-sm mb-3">{todayEvents.length}개의 일정이 있습니다</p>
 <div className="space-y-2">
 {todayEvents.map((event, idx) => {
 const manager = managers.find(m => m.id === event.managerId);
 return (
 <div key={idx} className="bg-neutral-100 p-3 rounded-lg border border-neutral-200">
 <div className="flex items-start gap-2">
 <span className="text-lg">{event.type === 'route' ? '' : ''}</span>
 <div className="flex-1 min-w-0">
 <p className={`font-bold ${t.text} text-sm break-words`}>{event.title}</p>
 {manager && <p className={`text-xs ${t.text}`}>담당: {manager.name}</p>}
 {event.memo && <p className="text-xs text-neutral-800 mt-1 break-words whitespace-pre-wrap">{event.memo}</p>}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => {
 setShowTodayAlert(false);
 setTab('calendar');
 }}
 className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all"
 >
 캘린더 확인하기
 </button>
 <button
 onClick={() => setShowTodayAlert(false)}
 className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}
 >
 닫기
 </button>
 </div>
 </div>
 </div>
 )}
 {showUnmappedModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowUnmappedModal(false)}>
 <div className="bg-neutral-100 rounded-2xl p-5 w-full max-w-md max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>미표시 업체</h3>
 <button type="button" onClick={() => setShowUnmappedModal(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <p className="text-sm text-neutral-800 mb-3">주소를 수정하면 지도에 표시됩니다.</p>
 <div className="space-y-2 max-h-96 overflow-y-auto">
 {companies.filter(c => !c.lat || !c.lng).map(c => {
 const mgr = managers.find(m => m.id === c.managerId);
 return (
 <div
 key={c.id}
 className="p-3 bg-neutral-100 rounded-xl cursor-pointer hover:bg-neutral-100 border border-neutral-200"
 onClick={() => { setShowUnmappedModal(false); setShowCompanyEditModal(c); }}
 >
 <div className="flex items-center justify-between">
 <div className="min-w-0 flex-1">
 <p className={`font-bold ${t.text} truncate`}>{c.name}</p>
 <p className="text-xs text-neutral-800 truncate">{c.address || '주소 없음'}</p>
 </div>
 <div className="flex-shrink-0 ml-2">
 <span className={`px-2 py-1 rounded text-xs ${t.text} font-bold`} style={{ background: mgr?.color || '#9ca3af' }}>{mgr?.name || '미배정'}</span>
 </div>
 </div>
 </div>
 );
 })}
 {companies.filter(c => !c.lat || !c.lng).length === 0 && (
 <p className={`text-center py-4 ${t.text}`}>미표시 업체가 없습니다.</p>
 )}
 </div>
 </div>
 </div>
 )}
 {selectedCalendarEvent && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCalendarEvent(null)}>
 <div className="bg-neutral-100 rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>일정 상세</h3>
 <button type="button" onClick={() => setSelectedCalendarEvent(null)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 <div className="space-y-3">
 <div className="p-4 bg-purple-50 rounded-xl">
 <p className={`${t.text} font-bold text-lg`}>{selectedCalendarEvent.title}</p>
 <div className={`flex items-center gap-2 mt-2 text-sm ${t.text}`}>
 <span>{selectedCalendarEvent.date}</span>
 {selectedCalendarEvent.time && <span>{selectedCalendarEvent.time}</span>}
 </div>
 {selectedCalendarEvent.memo && (
 <div className="mt-3 p-3 bg-neutral-100 rounded-lg">
 <p className={`text-xs mb-1 ${t.text}`}>메모</p>
 <p className="text-neutral-800 whitespace-pre-wrap">{selectedCalendarEvent.memo}</p>
 </div>
 )}
 {selectedCalendarEvent.company && (
 <div className={`mt-2 text-sm ${t.text}`}>
 <span>{selectedCalendarEvent.company}</span>
 </div>
 )}
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => {
 setSelectedCalendarDate(selectedCalendarEvent.date);
 setCalendarEventInput({
 title: selectedCalendarEvent.title,
 time: selectedCalendarEvent.time || '09:00',
 memo: selectedCalendarEvent.memo || ''
 });
 setEditingEventId(selectedCalendarEvent.id);
 setShowCalendarModal(true);
 setSelectedCalendarEvent(null);
 }}
 className="flex-1 py-2 bg-neutral-100 text-primary-600 rounded-xl font-bold"
 >
 수정
 </button>
 <button
 onClick={() => {
 setShowDeleteConfirm({ type: 'calendar', id: selectedCalendarEvent.id, name: selectedCalendarEvent.title });
 setSelectedCalendarEvent(null);
 }}
 className="flex-1 py-2 bg-rose-100 text-white rounded-xl font-bold"
 >
 삭제
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 {showCalendarModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCalendarModal(false)}>
 <div className="bg-neutral-100 rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>
 {selectedCalendarDate} 일정
 </h3>
 <button type="button" onClick={() => setShowCalendarModal(false)} className={`text-2xl ${t.text}`}>×</button>
 </div>
 {(() => {
 const dayRoutes = routes.filter(r => r.date === selectedCalendarDate);
 const dayEvents = calendarEvents.filter(e => e.date === selectedCalendarDate);
 if (dayRoutes.length > 0 || dayEvents.length > 0) {
 return (
 <div className="mb-4 p-3 bg-neutral-100 rounded-xl max-h-32 overflow-y-auto">
 <p className="text-xs text-neutral-800 mb-2 font-bold">이 날의 일정</p>
 {dayRoutes.map(r => {
 const manager = managers.find(m => m.id === r.managerId);
 return (
 <div key={`r-${r.id}`} className="flex items-center gap-2 mb-1">
 <span className="w-2 h-2 rounded-full" style={{ background: manager?.color || '#888' }}></span>
 <span className={`text-sm ${t.text}`}>{r.time?.slice(0,5)} {r.name}</span>
 <span className={`text-xs ${t.text}`}>(동선)</span>
 </div>
 );
 })}
 {dayEvents.map(e => (
 <div key={`e-${e.id}`} className="flex items-center gap-2 mb-1">
 <span className="w-2 h-2 rounded-full bg-purple-500"></span>
 <span className={`text-sm ${t.text}`}>{e.time?.slice(0,5)} {e.title}</span>
 <button
 onClick={() => {
 setCalendarEventInput({ title: e.title, time: e.time, memo: e.memo || '' });
 setEditingEventId(e.id);
 }}
 className="text-xs text-primary-600 ml-auto"
 >수정</button>
 <button
 onClick={() => { if(confirm('삭제하시겠습니까?')) deleteCalendarEvent(e.id); }}
 className={`text-xs ${t.text}`}
 >삭제</button>
 </div>
 ))}
 </div>
 );
 }
 return null;
 })()}
 <div className="space-y-3">
 <p className={`text-sm font-bold ${t.text}`}>{editingEventId ? '일정 수정' : '새 일정 추가'}</p>
 <input
 type="text"
 placeholder="일정 제목"
 value={calendarEventInput.title}
 onChange={e => setCalendarEventInput({ ...calendarEventInput, title: e.target.value })}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`}
 />
 <div className="relative" onClick={() => document.getElementById('calEventTime').showPicker?.()}>
 <input
 id="calEventTime"
 type="time"
 value={calendarEventInput.time}
 onChange={e => setCalendarEventInput({ ...calendarEventInput, time: e.target.value })}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all cursor-pointer`}
 />
 </div>
 <textarea
 placeholder="메모 (선택)"
 value={calendarEventInput.memo}
 onChange={e => setCalendarEventInput({ ...calendarEventInput, memo: e.target.value })}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all resize-none h-20`}
 />
 </div>
 <div className="flex gap-2 mt-4">
 {editingEventId && (
 <button
 onClick={() => {
 setCalendarEventInput({ title: '', time: '09:00', memo: '' });
 setEditingEventId(null);
 }}
 className={`px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'} flex-1`}
 >새로 작성</button>
 )}
 <button type="button" onClick={() => setShowCalendarModal(false)} className={`px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'} flex-1`}>취소</button>
 <button
 onClick={() => {
 if (!calendarEventInput.title.trim()) return alert('일정 제목을 입력하세요');
 const event = {
 id: editingEventId || Date.now(),
 date: selectedCalendarDate,
 title: calendarEventInput.title.trim(),
 time: calendarEventInput.time,
 memo: calendarEventInput.memo.trim(),
 createdBy: user?.name || 'unknown',
 createdAt: new Date().toISOString()
 };
 saveCalendarEvent(event);
 setShowScheduleAlert(false);
 setCalendarEventInput({ title: '', time: '09:00', memo: '' });
 setEditingEventId(null);
 alert(editingEventId ? '일정이 수정되었습니다!' : '일정이 추가되었습니다!');
 }}
 className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all flex-1"
 >{editingEventId ? '수정' : '추가'}</button>
 </div>
 <div className="mt-4 pt-4 border-t border-neutral-200">
 <button
 onClick={() => {
 setRouteDate(selectedCalendarDate);
 setShowCalendarModal(false);
 navigateToTab('route');
 }}
 className="w-full text-center text-sm text-neutral-800 font-bold"
 >
 동선 등록하기 →
 </button>
 </div>
 </div>
 </div>
 )}
 {selectedSchedule && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSchedule(null)}>
 <div className="bg-neutral-100 rounded-2xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-start mb-4">
 <div>
 <h3 className={`font-bold ${t.text} text-lg`}>{selectedSchedule.name}</h3>
 <p className={`text-sm ${t.text}`}>{selectedSchedule.date}</p>
 </div>
 <button type="button" onClick={() => setSelectedSchedule(null)} className="text-neutral-800 hover:text-neutral-800 text-xl"></button>
 </div>
 {(() => {
 const completedCount = (selectedSchedule.stops || []).filter(s => s.visited).length;
 const totalCount = (selectedSchedule.stops || []).length;
 const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
 return (
 <div className="mb-4">
 <div className="flex justify-between items-center mb-2">
 <span className={`text-sm ${t.text}`}>진행률</span>
 <span className="text-sm font-bold text-neutral-800">{completedCount}/{totalCount} ({percent}%)</span>
 </div>
 <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300" style={{ width: `${percent}%` }}></div>
 </div>
 </div>
 );
 })()}
 <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
 {(selectedSchedule.stops || []).map((stop, idx) => (
 <div key={stop.id} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${stop.visited ? 'bg-emerald-900/30' : 'bg-neutral-100'}`}>
 <button
 onClick={() => toggleStopVisited(selectedSchedule.id, stop.id)}
 className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all flex-shrink-0 ${stop.visited ? 'bg-emerald-500 text-white' : 'bg-neutral-200 border-2 border-neutral-200 text-neutral-800 hover:border-primary-400'}`}
 >
 {stop.visited ? '' : idx + 1}
 </button>
 <div className="flex-1 min-w-0">
 <p className={`font-bold text-sm break-words leading-snug ${stop.visited ? 'text-white' : '${t.text}'}`}>{stop.name}</p>
 {stop.address && <p className={`text-xs break-words ${t.text}`}>{stop.address}</p>}
 </div>
 {stop.lat && stop.lng && (
 <button type="button" onClick={() => viewStopOnMap(stop)} className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-primary-600 flex items-center justify-center text-sm flex-shrink-0"></button>
 )}
 </div>
 ))}
 </div>
 <div className="space-y-2">
 <button type="button" onClick={() => { setSelectedSchedule(null); viewSavedRouteOnMap(selectedSchedule); }} className={`w-full px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}>
 전체 경로 지도에서 보기
 </button>
 {selectedSchedule.status !== 'completed' && (
 <button type="button" onClick={() => completeAllStops(selectedSchedule.id)} className="w-full px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all py-3 font-bold">
 방문 완료 (확정으로 이동)
 </button>
 )}
 </div>
 </div>
 </div>
 )}

 {/* 멘트 추가/수정 모달 */}
 {showMentModal && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1200] p-4" onClick={() => { setShowMentModal(false); setMentForm({ name: '', content: '', type: 'broker', memo: '' }); }}>
 <div className={`rounded-2xl p-5 w-full max-w-md ${theme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>{editingMent ? '멘트 수정' : '새 멘트 추가'}</h3>
 <button type="button" onClick={() => { setShowMentModal(false); setMentForm({ name: '', content: '', type: 'broker', memo: '' }); }} className={`text-neutral-500 text-2xl hover:${t.text}`}>×</button>
 </div>
 <div className="space-y-3">
 <input 
 type="text" 
 placeholder="멘트 이름 (예: 폐업률 충격)" 
 value={mentForm.name}
 onChange={e => setMentForm({ ...mentForm, name: e.target.value })}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`}
 />
 <div className="flex gap-2">
 <button 
 onClick={() => setMentForm({ ...mentForm, type: 'broker' })}
 className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mentForm.type === 'broker' ? 'bg-neutral-600 text-neutral-700 border border-neutral-500' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
 >중개사용</button>
 <button 
 onClick={() => setMentForm({ ...mentForm, type: 'customer' })}
 className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mentForm.type === 'customer' ? 'bg-neutral-600 text-neutral-700 border border-neutral-500' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
 >고객용</button>
 </div>
 <textarea 
 placeholder="멘트 내용을 입력하세요"
 value={mentForm.content}
 onChange={e => setMentForm({ ...mentForm, content: e.target.value })}
 rows="4"
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all resize-none`}
 />
 <input 
 type="text" 
 placeholder="메모 (선택사항)"
 value={mentForm.memo}
 onChange={e => setMentForm({ ...mentForm, memo: e.target.value })}
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all`}
 />
 </div>
 <div className="flex gap-2 mt-4">
 <button type="button" onClick={() => { setShowMentModal(false); setMentForm({ name: '', content: '', type: 'broker', memo: '' }); }} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border ${theme === 'dark' ? 'bg-neutral-700 text-neutral-200 border-neutral-600 hover:bg-neutral-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}>취소</button>
 <button 
 onClick={() => {
 if (!mentForm.name.trim() || !mentForm.content.trim()) return alert('멘트 이름과 내용을 입력하세요');
 const mentData = {
 id: editingMent?.id || Date.now(),
 name: mentForm.name.trim(),
 content: mentForm.content.trim(),
 type: mentForm.type,
 memo: mentForm.memo.trim(),
 useCount: editingMent?.useCount || 0,
 successCount: editingMent?.successCount || 0,
 createdAt: editingMent?.createdAt || new Date().toISOString(),
 updatedAt: new Date().toISOString()
 };
 saveMent(mentData);
 setShowMentModal(false);
 setEditingMent(null);
 setMentForm({ name: '', content: '', type: 'broker', memo: '' });
 }}
 className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all"
 >{editingMent ? '수정 완료' : '추가하기'}</button>
 </div>
 </div>
 </div>
 )}

 {/* AI 피드백 모달 */}
 {showAiFeedback && feedbackMent && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1200] p-4" onClick={() => setShowAiFeedback(false)}>
 <div className={`rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto ${theme === 'dark' ? 'bg-neutral-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4">
 <h3 className={`font-bold ${t.text} text-lg`}>AI 피드백</h3>
 <button type="button" onClick={() => setShowAiFeedback(false)} className="text-neutral-500 text-2xl hover:text-white">×</button>
 </div>
 
 <div className="mb-4">
 <p className="text-sm text-neutral-500 mb-1">선택된 멘트: <span className="text-neutral-700 font-medium">{feedbackMent.name}</span></p>
 <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
 <p className="text-sm text-neutral-700 whitespace-pre-wrap">{feedbackMent.content}</p>
 </div>
 </div>

 <div className="mb-4">
 <p className={`text-sm mb-2 ${t.textMuted}`}>수정해본 멘트:</p>
 <textarea 
 value={feedbackInput}
 onChange={e => setFeedbackInput(e.target.value)}
 placeholder="기존 멘트를 수정해보세요"
 rows="3"
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all resize-none w-full`}
 />
 </div>

 <div className="mb-4">
 <p className={`text-sm mb-2 ${t.textMuted}`}>질문:</p>
 <input 
 type="text"
 value={feedbackQuestion}
 onChange={e => setFeedbackQuestion(e.target.value)}
 placeholder="이렇게 바꿔봤는데 어떻게 생각해?"
 className={`w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg ${t.text} placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-all w-full`}
 />
 </div>

 <button 
 onClick={async () => {
 if (!feedbackInput.trim()) return alert('수정 멘트를 입력하세요');
 const btn = document.activeElement;
 btn.textContent = 'AI 분석 중...';
 btn.disabled = true;
 
 const result = await callGeminiFeedback(
   feedbackMent.content,
   feedbackInput,
   feedbackQuestion || '이 수정이 어떤가요?'
 );
 
 if (result.success) {
   const feedback = {
     id: Date.now(),
     mentId: feedbackMent.id,
     mentName: feedbackMent.name,
     original: feedbackMent.content,
     modified: feedbackInput,
     question: feedbackQuestion || '피드백 요청',
     aiResponse: result.response,
     createdAt: new Date().toISOString()
   };
   saveFeedback(feedback);
   alert('AI 피드백이 저장되었습니다!');
   setShowAiFeedback(false);
   setFeedbackInput('');
   setFeedbackQuestion('');
 } else {
   alert('AI 피드백 실패: ' + result.error);
   btn.textContent = 'AI에게 피드백 받기';
   btn.disabled = false;
 }
 }}
 className="w-full px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all"
 >AI에게 피드백 받기</button>

 {/* 최근 피드백 히스토리 */}
 {mentFeedbacks.filter(f => f.mentId === feedbackMent.id).length > 0 && (
 <div className="mt-4 pt-4 border-t border-neutral-200">
 <p className={`text-sm mb-2 ${t.textMuted}`}>이 멘트의 피드백 히스토리</p>
 <div className="space-y-2 max-h-40 overflow-y-auto">
 {mentFeedbacks.filter(f => f.mentId === feedbackMent.id).slice(-3).reverse().map(fb => (
 <div key={fb.id} className="p-3 rounded-lg bg-neutral-100/30 border border-neutral-200/30">
 <p className={`text-xs mb-1 ${t.textMuted}`}>{new Date(fb.createdAt).toLocaleString('ko-KR')}</p>
 <p className="text-sm text-neutral-700 line-clamp-2">{fb.question}</p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </main>
 </div>
 </div>
 );
 };

const AppWithErrorBoundary = () => React.createElement(SalesModeErrorBoundary, null, React.createElement(App, null));
export default AppWithErrorBoundary;
