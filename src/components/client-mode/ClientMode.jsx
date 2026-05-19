import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PHASE, COLORS } from './constants';
import EntryScreen from './EntryScreen';
import UnifiedLayout from './UnifiedLayout';
import LoadingScreen from './LoadingScreen';
import FloatingProgress from './FloatingProgress';

// ─── Loading Simulation Config ───
const TICK_MIN = 400;
const TICK_MAX = 800;
const INCREMENT_MIN = 5;
const INCREMENT_MAX = 15;

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Phase wrapper for AnimatePresence keying ───
const PhaseWrapper = ({ children, phaseKey }) => (
  <motion.div
    key={phaseKey}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
    style={{ position: 'absolute', inset: 0 }}
  >
    {children}
  </motion.div>
);

export default function ClientMode({
  onSearchRegion,
  onCancelSearch,
  searchResult,
  searchLoading,
  analysisProgress = 0,
  analysisStep = '',
  renderResults = null,
}) {
  const [phase, setPhase] = useState(PHASE.ENTRY);
  const [searchAddress, setSearchAddress] = useState('');
  const [searchRadius, setSearchRadius] = useState(500);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [searchCache, setSearchCache] = useState({});
  const [isHomepageOpen, setIsHomepageOpen] = useState(false);

  const loadingIntervalRef = useRef(null);
  const progressRef = useRef(0);

  // ─── Loading Simulation ───
  const stopLoading = useCallback(() => {
    if (loadingIntervalRef.current) {
      clearTimeout(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  }, []);

  const tickLoading = useCallback(() => {
    const delay = randomBetween(TICK_MIN, TICK_MAX);
    loadingIntervalRef.current = setTimeout(() => {
      const increment = randomBetween(INCREMENT_MIN, INCREMENT_MAX);
      const next = Math.min(progressRef.current + increment, 100);
      progressRef.current = next;
      setLoadingProgress(next);

      if (next < 100) {
        tickLoading();
      } else {
        loadingIntervalRef.current = null;
      }
    }, delay);
  }, []);

  const startLoading = useCallback((address) => {
    stopLoading();

    if (searchCache[address]) {
      progressRef.current = 100;
      setLoadingProgress(100);
      return;
    }

    progressRef.current = 0;
    setLoadingProgress(0);
    tickLoading();
  }, [searchCache, stopLoading, tickLoading]);

  useEffect(() => {
    return () => stopLoading();
  }, [stopLoading]);

  // ─── Phase Handlers ───
  const handleNavigate = useCallback((target) => {
    if (target === 'search') {
      setPhase(PHASE.SEARCH);
    }
  }, []);

  const handleSearch = useCallback((address, radius) => {
    setSearchAddress(address);
    if (radius != null) setSearchRadius(radius);
    setPhase(PHASE.LOADING);
    // 새 검색 시작 시 진행률 초기화 (재검색 시 부드러운 카운트가 0부터 다시 시작되도록)
    progressRef.current = 0;
    setLoadingProgress(0);
    // If real search function is provided, use it; otherwise fall back to simulated loading
    if (onSearchRegion) {
      // onSearchRegion 내부에서 기존 AbortController가 있으면 abort + 새 분석 시작
      onSearchRegion(address);
    } else {
      startLoading(address);
    }
  }, [startLoading, onSearchRegion]);

  // ─── DEV 전용: 검색 자동화용 글로벌 트리거 ───
  // window.__bcDoSearch('강남역 1번 출구') 형태로 외부에서 새 분석 시작 가능
  // 프로덕션 빌드에서는 노출되지 않음 (import.meta.env.DEV 가드)
  // [bugfix] 이전 구현은 의존성이 매 렌더마다 변경되어 cleanup→재할당이 반복됨.
  // 부모(App.jsx)가 inline 함수로 onCancelSearch를 주기 때문에 매 렌더마다 새 reference.
  // 이로 인해 useEffect cleanup이 매 렌더마다 window.__bcDoSearch 를 delete + 재할당.
  // ref로 최신 핸들러를 잡아두고 effect는 한 번만 실행 → 안정.
  const bcSearchHandlersRef = useRef({ handleSearch, onCancelSearch, stopLoading });
  useEffect(() => {
    bcSearchHandlersRef.current = { handleSearch, onCancelSearch, stopLoading };
  }, [handleSearch, onCancelSearch, stopLoading]);
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.__bcDoSearch = (address, radius) => {
      if (typeof address !== 'string' || !address.trim()) {
        console.warn('[__bcDoSearch] address(문자열) 필수');
        return false;
      }
      const h = bcSearchHandlersRef.current;
      // 진행 중 분석이 있으면 abort
      if (typeof h.onCancelSearch === 'function') {
        try { h.onCancelSearch(); } catch {}
      }
      h.stopLoading?.();
      // 홈페이지 패널 닫기 (있으면)
      setIsHomepageOpen(false);
      // 항상 새 검색으로 처음부터 진입
      h.handleSearch?.(address.trim(), radius);
      return true;
    };

    return () => {
      try { delete window.__bcDoSearch; } catch { window.__bcDoSearch = undefined; }
    };
  }, []);

  // Sync real analysis progress to loading progress
  useEffect(() => {
    if (onSearchRegion && phase === PHASE.LOADING) {
      // When search result arrives, jump to 100% to trigger LoadingScreen closing animation
      const effectiveProgress = searchResult?.success ? 100 : analysisProgress;
      progressRef.current = effectiveProgress;
      setLoadingProgress(effectiveProgress);
    }
  }, [analysisProgress, searchResult, onSearchRegion, phase]);

  const handleLoadingComplete = useCallback(() => {
    setSearchCache((prev) => ({
      ...prev,
      [searchAddress]: { address: searchAddress, radius: searchRadius, timestamp: Date.now() },
    }));
    // 홈페이지가 열려있으면 HOMEPAGE phase로, 아니면 RESULT로
    setPhase(isHomepageOpen ? PHASE.HOMEPAGE : PHASE.RESULT);
  }, [searchAddress, searchRadius, isHomepageOpen]);

  // 로딩 중 재검색 — 진행 중인 분석 중단 + 검색 시작 화면으로 복귀
  const handleCancelLoading = useCallback(() => {
    // 시뮬레이션 타이머 중단
    stopLoading();
    progressRef.current = 0;
    setLoadingProgress(0);
    // 실제 분석 abort (부모가 제공한 경우)
    if (typeof onCancelSearch === 'function') {
      onCancelSearch();
    }
    // 검색 시작 화면으로 복귀
    setPhase(PHASE.SEARCH);
  }, [stopLoading, onCancelSearch]);

  const handleGoHomepage = useCallback(() => {
    setIsHomepageOpen(true);
    // 로딩 중이면 phase를 LOADING으로 유지 (로딩 진행 계속)
    if (phase !== PHASE.LOADING) {
      setPhase(PHASE.HOMEPAGE);
    }
  }, [phase]);

  const handleReturnToResults = useCallback(() => {
    setIsHomepageOpen(false);
    if (progressRef.current >= 100) {
      setSearchCache((prev) => ({
        ...prev,
        [searchAddress]: { address: searchAddress, radius: searchRadius, timestamp: Date.now() },
      }));
      setPhase(PHASE.RESULT);
    } else {
      setPhase(PHASE.LOADING);
    }
  }, [searchAddress, searchRadius]);

  const handleGoHome = useCallback(() => {
    setPhase(PHASE.ENTRY);
    setIsHomepageOpen(false);
  }, []);

  // ─── Derived state ───
  const showUnifiedLayout = phase === PHASE.SEARCH || phase === PHASE.LOADING || phase === PHASE.RESULT || phase === PHASE.HOMEPAGE;
  const showLoadingOverlay = phase === PHASE.LOADING && !isHomepageOpen;
  const resultsReady = phase === PHASE.RESULT || phase === PHASE.HOMEPAGE;

  // ─── Render ───
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: COLORS.black }}>
      <AnimatePresence mode="wait">
        {phase === PHASE.ENTRY && (
          <PhaseWrapper phaseKey="entry">
            <EntryScreen onNavigate={handleNavigate} />
          </PhaseWrapper>
        )}

        {showUnifiedLayout && (
          <PhaseWrapper phaseKey="unified">
            <UnifiedLayout
              resultsReady={resultsReady}
              onSearch={handleSearch}
              onGoHome={handleGoHome}
              searchAddress={searchAddress}
              collectedData={searchResult?.collectedData || null}
              aiData={searchResult?.data || null}
              initialHomepageOpen={phase === PHASE.HOMEPAGE || isHomepageOpen}
              onHomepageClosed={handleReturnToResults}
              renderResults={renderResults}
            />
          </PhaseWrapper>
        )}

        {/* HOMEPAGE phase now handled by UnifiedLayout's sliding panel */}
      </AnimatePresence>

      {/* Loading overlay - on top of UnifiedLayout */}
      <AnimatePresence>
        {showLoadingOverlay && (
          <LoadingScreen
            progress={loadingProgress}
            onComplete={handleLoadingComplete}
            onGoHomepage={handleGoHomepage}
            onSearch={(addr) => handleSearch(addr, searchRadius)}
            onCancel={handleCancelLoading}
          />
        )}
      </AnimatePresence>

      {/* Floating progress for homepage (including during loading) */}
      {(phase === PHASE.HOMEPAGE || (phase === PHASE.LOADING && isHomepageOpen)) && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10001 }}>
          <div style={{ pointerEvents: 'auto' }}>
            <FloatingProgress
              progress={loadingProgress}
              onReturnToResults={handleReturnToResults}
            />
          </div>
        </div>
      )}
    </div>
  );
}
