// ─── Design Constants for Client Mode ───

// Colors
export const COLORS = {
  black: '#0A0A0A',
  white: '#FFFFFF',
  navy: '#1B2A4A',
  navyHover: '#2C4270',
  navyTranslucent: 'rgba(27,42,74,0.6)',
  mint: '#AAF0D1',
  whiteTranslucent: 'rgba(255,255,255,0.15)',
  whiteBorder: 'rgba(255,255,255,0.3)',
  cardBg: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.1)',
  textPrimary: '#FFFFFF',
  textSecondary: '#E0E0E0',
  textMuted: '#999999',
  divider: 'rgba(255,255,255,0.1)',
  // Graph colors
  graphAccent: '#1B2A4A',
  graphMuted: '#6B7280',
  graphBgBar: 'rgba(255,255,255,0.1)',
  // AI feedback box
  aiFeedbackBg: 'rgba(255,255,255,0.05)',
};

// Animation durations (ms)
export const TIMING = {
  entryLineDelay: 800,
  entryLineExpand: 1200,
  bgFadeIn: 2000,
  menuAppear: 600,
  layoutTransition: 800,
  cardStagger: 150,
  kenBurnsSpeed: 30, // seconds
  hoverLift: 200,
};

// Blur values
export const BLUR = {
  bgBlur: 8, // px
  loadingBlur: 20,
  cardBackdrop: 12,
};

// Layout
export const LAYOUT = {
  mapPanelWidth: '100%',
  mapPanelWidthResult: '30%',
  mapPanelWidthMobile: '100%',
  cardMaxWidth: 720,
  sidebarWidth: 320,
};

// App phases
export const PHASE = {
  ENTRY: 'entry',
  SEARCH: 'search',
  LOADING: 'loading',
  RESULT: 'result',
  HOMEPAGE: 'homepage',
};
