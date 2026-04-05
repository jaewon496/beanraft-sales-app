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

export default function ClientMode() {
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
    setSearchRadius(radius);
    setPhase(PHASE.LOADING);
    startLoading(address);
  }, [startLoading]);

  const handleLoadingComplete = useCallback(() => {
    setSearchCache((prev) => ({
      ...prev,
      [searchAddress]: { address: searchAddress, radius: searchRadius, timestamp: Date.now() },
    }));
    setPhase(PHASE.RESULT);
  }, [searchAddress, searchRadius]);

  const handleGoHomepage = useCallback(() => {
    setIsHomepageOpen(true);
    setPhase(PHASE.HOMEPAGE);
  }, []);

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
  const showLoadingOverlay = phase === PHASE.LOADING;
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
              initialHomepageOpen={phase === PHASE.HOMEPAGE}
              onHomepageClosed={handleReturnToResults}
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
          />
        )}
      </AnimatePresence>

      {/* Floating progress for homepage */}
      {phase === PHASE.HOMEPAGE && (
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
