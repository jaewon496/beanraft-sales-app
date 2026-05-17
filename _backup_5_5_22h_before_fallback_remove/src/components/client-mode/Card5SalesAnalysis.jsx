import React from 'react';

/**
 * Card 5 - 매출 분석 (Stitch v5 디자인 100% 이식, 인라인 style 강제 버전)
 * 입력 자료: stitch_card5_v5/code.html
 * 데이터 키: card.bodyData (dataMapper.js)
 *
 * v5 인라인 강제 버전 변경점:
 *  - 글로벌 * 셀렉터(Pretendard) 덮어쓰기 차단을 위해 모든 핵심 텍스트에 fontFamily/fontSize/color/fontWeight 인라인 지정
 *  - 색상 토큰을 hex 값으로 직접 박음 (text-error/text-secondary 등 클래스 의존 제거)
 *  - 막대 너비/도넛 dasharray를 인라인 style로 보장
 *  - Tailwind class는 레이아웃(flex/grid/spacing)에만 사용
 */

/* ── 디자인 토큰 (스티치 v5 + DESIGN.md 기준) ── */
const TOK = {
  // 색상
  bg:                 '#0E1117',
  cardBg:             '#1A1F2C',
  borderSubtle:       '#2D3748',
  surfaceContainer:   '#1d2027',
  surfaceContainerLow:'#191b23',
  surfaceContainerHigh:'#272a31',
  surfaceContainerLowest:'#0b0e15',
  surfaceVariant:     '#32353c',
  primary:            '#3B82F6',
  primary40:          'rgba(59, 130, 246, 0.4)',
  primary30:          'rgba(59, 130, 246, 0.3)',
  primary20:          'rgba(59, 130, 246, 0.2)',
  primary10:          'rgba(59, 130, 246, 0.1)',
  primary60Solid:     '#5C9CF8',
  secondary:          '#10B981',  // 스티치 v5 success green
  secondary10:        'rgba(16, 185, 129, 0.1)',
  error:              '#EF4444',  // DESIGN.md error red
  error10:            'rgba(239, 68, 68, 0.1)',
  white:              '#FFFFFF',
  onSurface:          '#E1E2EC',
  onSurfaceVariant:   '#C2C6D6',

  // 폰트
  fontH1:    "'Manrope', 'Inter', 'Noto Sans KR', sans-serif",
  fontBody:  "'Inter', 'Noto Sans KR', sans-serif",
  fontTab:   "'Inter', 'Noto Sans KR', sans-serif",
};

const fmtNum = (n) => {
  if (n == null || isNaN(n)) return '';
  return Math.round(Number(n)).toLocaleString();
};

const safeStr = (v) => {
  if (v == null) return '';
  return String(v).trim();
};

const extractNumericFromAmt = (str) => {
  if (!str) return 0;
  const s = String(str).replace(/[^\d]/g, '');
  return parseInt(s, 10) || 0;
};

const extractPercent = (str) => {
  if (!str) return null;
  const m = String(str).match(/(-?\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
};

const extractTrendPct = (str) => {
  if (!str) return null;
  const m = String(str).match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
};

const parseTopFiveDongs = (str) => {
  if (!str || typeof str !== 'string') return [];
  return str
    .split(/,\s/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(seg => {
      const m = seg.match(/^([^\(]+?)\s*(?:\(([^)]+)\))?\s*([\d,]+)\s*만원/);
      if (!m) return null;
      const name = (m[1] || '').trim();
      const gu = (m[2] || '').trim();
      const amt = parseInt((m[3] || '').replace(/,/g, ''), 10) || 0;
      if (!name || amt <= 0) return null;
      return { name, gu, amt };
    })
    .filter(Boolean)
    .slice(0, 5);
};

const buildTrendPath = (values) => {
  if (!Array.isArray(values) || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 600;
  const H = 200;
  const padTop = 20;
  const padBottom = 20;
  const innerH = H - padTop - padBottom;
  const stepX = W / (values.length - 1);
  const points = values.map((v, i) => {
    const x = +(i * stepX).toFixed(2);
    const y = +(padTop + (1 - (v - min) / range) * innerH).toFixed(2);
    return { x, y };
  });
  const lineD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const fillD = `${lineD} L${W},${H} L0,${H} Z`;
  const last = points[points.length - 1];
  return { lineD, fillD, last, max, min };
};

const pickXLabels = (labels) => {
  if (!Array.isArray(labels) || labels.length === 0) return [];
  if (labels.length <= 4) return labels;
  const idxs = [
    0,
    Math.round(labels.length / 3),
    Math.round((2 * labels.length) / 3),
    labels.length - 1,
  ];
  return idxs.map(i => labels[i]);
};

/* ── 자주 쓰는 텍스트 스타일 ── */
const T = {
  labelCaps: {
    fontFamily: TOK.fontBody,
    fontSize: '12px',
    lineHeight: '16px',
    letterSpacing: '0.05em',
    fontWeight: 600,
    color: TOK.onSurfaceVariant,
  },
  bodyLg: {
    fontFamily: TOK.fontBody,
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 400,
    color: TOK.onSurface,
  },
  bodySm: {
    fontFamily: TOK.fontBody,
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 400,
    color: TOK.onSurface,
  },
  dataTab: {
    fontFamily: TOK.fontTab,
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  h2: {
    fontFamily: TOK.fontH1,
    fontSize: '24px',
    lineHeight: '32px',
    letterSpacing: '-0.01em',
    fontWeight: 600,
  },
  h1: {
    fontFamily: TOK.fontH1,
    fontSize: '32px',
    lineHeight: '40px',
    letterSpacing: '-0.02em',
    fontWeight: 700,
    color: TOK.white,
  },
};

const Card5SalesAnalysis = ({ card }) => {
  const [openWarningIdx, setOpenWarningIdx] = React.useState(null);
  if (!card) return null;
  const body = card.bodyData || {};
  const chart = card.chartData || {};

  // ── 헤더 빅넘버 ──
  const bigNumber = chart.bigNumber || body.monthly || 0;
  const bigNumberStr = bigNumber > 0 ? fmtNum(bigNumber) : null;

  // 작년 대비 칩
  const prevYearRate = body.prevYearRate;
  const showPrevYearChip = prevYearRate != null && prevYearRate !== 0 && !isNaN(prevYearRate);
  const prevYearPositive = prevYearRate > 0;
  const prevYearChipText = showPrevYearChip
    ? `${prevYearPositive ? '+' : ''}${prevYearRate}% 작년 대비`
    : null;

  // 순위 칩
  const rankChip = safeStr(body.cafeSalesRank);

  // AI 요약 (긴 버전 bruFeedback=aiSummary 우선, 없으면 bruSummary 짧은 요약)
  const aiSummaryRaw = safeStr(card.aiSummary) || safeStr(card.bruSummary);

  // ── 섹션 1: 지역별 비교 ──
  const monthlyVal = Number(body.monthly) || 0;
  const dongAvgVal = Number(body.dongAvg) || 0;
  const guAvgVal = Number(body.guAvg) || 0;
  const siAvgVal = Number(body.siAvg) || 0;
  const showSection1 = monthlyVal > 0 || guAvgVal > 0 || siAvgVal > 0;
  const section1Base = Math.max(monthlyVal, dongAvgVal, guAvgVal, siAvgVal) || 1;
  const guPct = guAvgVal > 0 ? Math.min(100, Math.round((guAvgVal / section1Base) * 100)) : 0;
  const siPct = siAvgVal > 0 ? Math.min(100, Math.round((siAvgVal / section1Base) * 100)) : 0;
  const dongAvgPct = dongAvgVal > 0 && monthlyVal > 0
    ? Math.min(95, Math.max(5, Math.round((dongAvgVal / section1Base) * 100)))
    : null;

  // ── 섹션 2: 매출 추이 ──
  const prevMonRate = body.prevMonRate;
  const showPrevMon = prevMonRate != null && !isNaN(prevMonRate) && prevMonRate !== 0;
  const showPrevYearMini = prevYearRate != null && !isNaN(prevYearRate) && prevYearRate !== 0;
  const marketTrendPct = extractTrendPct(body.bizmapMarketTrend);
  const showMarketTrend = marketTrendPct != null && marketTrendPct !== 0;
  const miniCards = [
    showPrevMon ? {
      label: '전월 대비',
      value: `${prevMonRate > 0 ? '+' : ''}${prevMonRate}%`,
      color: prevMonRate >= 0 ? TOK.secondary : TOK.error,
    } : null,
    showPrevYearMini ? {
      label: '전년 대비',
      value: `${prevYearRate > 0 ? '+' : ''}${prevYearRate}%`,
      color: prevYearRate >= 0 ? TOK.secondary : TOK.error,
    } : null,
    showMarketTrend ? {
      label: '시장 규모',
      value: `${marketTrendPct > 0 ? '+' : ''}${marketTrendPct}%`,
      color: marketTrendPct >= 0 ? TOK.secondary : TOK.error,
    } : null,
  ].filter(Boolean);

  const prevYearGuAmt = Number(body.prevYearGuAmt) || 0;
  const prevMonGuAmt = Number(body.prevMonGuAmt) || 0;
  const compareRows = [
    prevYearGuAmt > 0 ? { label: '작년 강남구 매출', value: fmtNum(prevYearGuAmt) } : null,
    prevMonGuAmt > 0 ? { label: '전월 강남구 매출', value: fmtNum(prevMonGuAmt) } : null,
  ].filter(Boolean);

  const trend = body.annualSalesTrend && Array.isArray(body.annualSalesTrend.values)
    ? body.annualSalesTrend
    : null;
  const trendValues = trend ? trend.values.filter(v => isFinite(v) && v >= 0) : [];
  const trendLabels = trend ? trend.labels || [] : [];
  const pathData = trendValues.length >= 2 ? buildTrendPath(trendValues) : null;
  const xLabels = pickXLabels(trendLabels);
  const lastValue = trendValues.length > 0 ? trendValues[trendValues.length - 1] : null;
  const showSection2 = miniCards.length > 0 || compareRows.length > 0 || pathData != null;

  // ── 섹션 3-1: 매출 분위 분포 ──
  const topAmt = extractNumericFromAmt(body.bizmapTopSales);
  const avgAmt = extractNumericFromAmt(body.bizmapAvgSales);
  const btmAmt = extractNumericFromAmt(body.bizmapBottomSales);
  const distRows = [
    body.bizmapTopSales ? { label: '상위 20%', value: body.bizmapTopSales, ratio: 1, fill: TOK.primary } : null,
    body.bizmapAvgSales ? { label: '평균', value: body.bizmapAvgSales, ratio: topAmt > 0 ? avgAmt / topAmt : 0.5, fill: 'rgba(59,130,246,0.6)' } : null,
    body.bizmapBottomSales ? { label: '하위 20%', value: body.bizmapBottomSales, ratio: topAmt > 0 ? btmAmt / topAmt : 0.1, fill: 'rgba(59,130,246,0.3)' } : null,
  ].filter(Boolean);
  const showDist = distRows.length > 0;

  // ── 섹션 3-2: 결제 분석 ──
  const usageCnt = safeStr(body.bizmapAvgUsageCnt);
  const unitPrice = safeStr(body.bizmapAvgUnitPrice);
  const showPayment = usageCnt || unitPrice;

  // ── 섹션 3-3: 입지 통계 ──
  const cafePctNum = extractPercent(body.cafePctInTop5);
  const marketSize = safeStr(body.bizmapMarketSize);
  const guStores = Number(body.gusignguStores) || 0;
  const siStores = Number(body.sigaongStores) || 0;
  const locationRows = [
    cafePctNum != null ? { label: '카페 비중', value: `${cafePctNum}%` } : null,
    marketSize ? { label: '시장 규모', value: marketSize } : null,
    guStores > 0 ? { label: '강남구 매장수', value: `${fmtNum(guStores)}개` } : null,
    siStores > 0 ? { label: '서울 매장수', value: `${fmtNum(siStores)}개` } : null,
  ].filter(Boolean);
  const showLocation = locationRows.length > 0;
  const donutPct = cafePctNum != null ? Math.min(100, Math.max(0, cafePctNum)) : 0;

  const section3Cols = [showDist, showPayment, showLocation].filter(Boolean).length;
  const showSection3 = section3Cols > 0;

  // ── 섹션 4: TOP 5 동 ──
  const topDongsList = Array.isArray(body.topFiveDongsList) ? body.topFiveDongsList.filter(d => d && d.name && d.amt > 0).slice(0, 5) : [];
  const topDongs = topDongsList.length > 0
    ? topDongsList.map(d => ({ name: d.name, gu: '', amt: d.amt, stores: d.stores || 0, warning: d.warning || null }))
    : parseTopFiveDongs(body.topFiveDongs);
  const showTopDongs = topDongs.length > 0;
  const topMaxAmt = topDongs.length > 0 ? Math.max(...topDongs.map(d => d.amt)) : 0;

  // ── 신규 섹션 A: 동 매출 격차 (양극화) ──
  const dongMaxSales = Number(body.dongMaxSales) || 0;
  const dongMinSales = Number(body.dongMinSales) || 0;
  const showDongRange = dongMaxSales > 0;
  const dongRangeBase = Math.max(dongMaxSales, monthlyVal, dongMinSales) || 1;

  // ── 신규 섹션 B: 매출 건수 + 변화율 ──
  const dongSaleCnt = Number(body.dongSaleCnt) || 0;
  const prevYearCntRate = body.prevYearCntRate;
  const prevMonCntRate = body.prevMonCntRate;
  const showSaleCnt = dongSaleCnt > 0;

  // ── 신규 섹션 C: 매장수 변화 추이 ──
  const adminStoreTrend = body.adminStoreTrend && Array.isArray(body.adminStoreTrend.values) ? body.adminStoreTrend : null;
  const bizmapStore6M = body.bizmapStoreCount6M && Array.isArray(body.bizmapStoreCount6M.values) ? body.bizmapStoreCount6M : null;
  const storeTrend = bizmapStore6M || adminStoreTrend;
  const showStoreTrend = storeTrend && storeTrend.values.length >= 2;
  const storeTrendMax = showStoreTrend ? Math.max.apply(null, storeTrend.values) : 0;
  const storeTrendMin = showStoreTrend ? Math.min.apply(null, storeTrend.values) : 0;
  const storeTrendRange = (storeTrendMax - storeTrendMin) || 1;

  // ── 신규 섹션 D: 시간대별 매출/건수 비중 ──
  const bizmapHourly = body.bizmapHourlySales && Array.isArray(body.bizmapHourlySales.labels) ? body.bizmapHourlySales : null;
  const showHourly = bizmapHourly && bizmapHourly.labels.length > 0;
  const hourlyMaxVal = showHourly
    ? Math.max(
        bizmapHourly.cntValues.length > 0 ? Math.max.apply(null, bizmapHourly.cntValues) : 0,
        bizmapHourly.amtValues.length > 0 ? Math.max.apply(null, bizmapHourly.amtValues) : 0
      ) || 1
    : 1;

  // ── 신규 섹션 E: 요일별 매출 비중 ──
  const bizmapWeekday = body.bizmapWeekdaySales && Array.isArray(body.bizmapWeekdaySales.labels) ? body.bizmapWeekdaySales : null;
  const showWeekday = bizmapWeekday && bizmapWeekday.labels.length > 0;
  const weekdayMaxVal = showWeekday && bizmapWeekday.values.length > 0 ? Math.max.apply(null, bizmapWeekday.values) || 1 : 1;

  const showBothBento = showSection1 && showSection2;
  const dateLabel = safeStr(card.date);

  return (
    <div
      style={{
        background: TOK.cardBg,
        border: `1px solid ${TOK.borderSubtle}`,
        borderRadius: '1rem',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        color: TOK.onSurface,
        fontFamily: TOK.fontBody,
        width: '100%',
      }}
    >
      {/* ─────────────── HEADER SECTION ─────────────── */}
      <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
        <div className="flex flex-col md:flex-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
          {/* 왼쪽: 빅넘버 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: TOK.primary20,
                  color: TOK.primary,
                  ...T.labelCaps,
                  padding: '2px 8px',
                  borderRadius: '0.25rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                05 매출 분석
              </span>
              {dateLabel && (
                <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>{dateLabel}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px', marginTop: '4px' }}>
              {bigNumberStr && (
                <h2 style={{ ...T.h1, color: TOK.white, margin: 0 }}>
                  {bigNumberStr}
                  <span style={{ ...T.h2, color: TOK.white, marginLeft: '4px' }}>만원</span>
                </h2>
              )}
              <p style={{ ...T.bodyLg, color: TOK.onSurfaceVariant, fontWeight: 500, margin: 0 }}>월평균 매출 (카페)</p>
            </div>
          </div>

          {/* 오른쪽: 칩 2개 */}
          {(showPrevYearChip || rankChip) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {showPrevYearChip && (
                  <span
                    style={{
                      background: prevYearPositive ? TOK.secondary10 : TOK.error10,
                      color: prevYearPositive ? TOK.secondary : TOK.error,
                      ...T.labelCaps,
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', lineHeight: 1 }}>
                      {prevYearPositive ? 'trending_up' : 'trending_down'}
                    </span>
                    {prevYearChipText}
                  </span>
                )}
                {rankChip && (
                  <span
                    style={{
                      background: TOK.surfaceContainer,
                      color: TOK.white,
                      ...T.labelCaps,
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      border: `1px solid ${TOK.borderSubtle}`,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rankChip}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* AI Summary */}
        {aiSummaryRaw && (
          <div
            className="ai-border-gradient"
            style={{
              padding: '16px',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                flexShrink: 0,
                background: `linear-gradient(135deg, ${TOK.primary}, ${TOK.secondary})`,
                padding: '6px',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  color: TOK.white,
                  fontSize: '20px',
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                auto_awesome
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...T.labelCaps, color: TOK.primary, fontWeight: 700, margin: '0 0 4px 0' }}>AI 요약</p>
              <p
                style={{
                  ...T.bodyLg,
                  color: TOK.onSurface,
                  lineHeight: '24px',
                  margin: 0,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                }}
              >
                {aiSummaryRaw}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────── BENTO GRID (지역별/추이) ─────────────── */}
      {(showSection1 || showSection2) && (
        <div
          className={`grid grid-cols-1 ${showBothBento ? 'lg:grid-cols-12' : ''}`}
          style={{ gap: 0 }}
        >
          {/* Section 1: Regional Comparison */}
          {showSection1 && (
            <div
              className={showBothBento ? 'lg:col-span-5' : ''}
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                borderBottom: showBothBento ? `1px solid ${TOK.borderSubtle}` : 'none',
                borderRight: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>지역별 비교</h3>
                <span className="material-symbols-outlined" style={{ color: TOK.onSurfaceVariant, cursor: 'help', fontSize: '20px' }}>info</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 역삼1동 (현 상권) - primary 100% 막대 */}
                {monthlyVal > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', ...T.bodySm, fontWeight: 500 }}>
                      <span style={{ color: TOK.white }}>역삼1동 (현 상권)</span>
                      <span style={{ ...T.dataTab, color: TOK.primary }}>{fmtNum(monthlyVal)}만원</span>
                    </div>
                    <div style={{ height: '32px', width: '100%', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden', position: 'relative' }}>
                      <div
                        style={{
                          height: '100%',
                          background: TOK.primary,
                          width: '100%',
                          borderTopRightRadius: '0.25rem',
                          borderBottomRightRadius: '0.25rem',
                          transition: 'width 700ms',
                        }}
                      />
                    </div>
                  </div>
                )}
                {/* 강남구 - primary 40% 막대 + 동평균 점선 라벨 */}
                {guAvgVal > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                    {dongAvgPct != null && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-12px',
                          left: `${dongAvgPct}%`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          pointerEvents: 'none',
                          zIndex: 2,
                        }}
                      >
                        <div style={{ width: '1px', height: '120px', borderLeft: `1px dashed rgba(59,130,246,0.5)` }} />
                        <span
                          style={{
                            fontSize: '10px',
                            color: TOK.primary,
                            marginTop: '4px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            background: TOK.bg,
                            padding: '0 4px',
                            fontFamily: TOK.fontBody,
                          }}
                        >
                          동 평균 {fmtNum(dongAvgVal)}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', ...T.bodySm }}>
                      <span style={{ color: TOK.onSurfaceVariant }}>강남구</span>
                      <span style={{ ...T.dataTab, color: TOK.onSurface }}>{fmtNum(guAvgVal)}만원</span>
                    </div>
                    <div style={{ height: '24px', width: '100%', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: TOK.primary40,
                          width: `${guPct}%`,
                          borderTopRightRadius: '0.25rem',
                          borderBottomRightRadius: '0.25rem',
                        }}
                      />
                    </div>
                  </div>
                )}
                {/* 서울특별시 - 회색 막대 */}
                {siAvgVal > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', ...T.bodySm }}>
                      <span style={{ color: TOK.onSurfaceVariant }}>서울특별시</span>
                      <span style={{ ...T.dataTab, color: TOK.onSurface }}>{fmtNum(siAvgVal)}만원</span>
                    </div>
                    <div style={{ height: '24px', width: '100%', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: TOK.surfaceVariant,
                          width: `${siPct}%`,
                          borderTopRightRadius: '0.25rem',
                          borderBottomRightRadius: '0.25rem',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 2: Revenue Trends */}
          {showSection2 && (
            <div
              className={showBothBento ? 'lg:col-span-7' : ''}
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                borderTop: showBothBento ? `1px solid ${TOK.borderSubtle}` : 'none',
                borderLeft: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>매출 추이</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontWeight: 700, fontFamily: TOK.fontBody }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TOK.primary, display: 'inline-block' }} />
                    <span style={{ color: TOK.onSurface }}>역삼1동</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TOK.onSurfaceVariant, display: 'inline-block' }} />
                    <span style={{ color: TOK.onSurfaceVariant }}>강남구 비교</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 변동 미니카드 3개 */}
                {miniCards.length > 0 && (
                  <div
                    className="grid"
                    style={{
                      gap: '16px',
                      gridTemplateColumns: `repeat(${miniCards.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {miniCards.map((mc, i) => (
                      <div
                        key={i}
                        style={{
                          background: TOK.surfaceContainer,
                          padding: '16px',
                          borderRadius: '0.75rem',
                          border: `1px solid ${TOK.borderSubtle}`,
                        }}
                      >
                        <p style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: '0 0 4px 0' }}>{mc.label}</p>
                        <p
                          style={{
                            ...T.h2,
                            color: mc.color,
                            margin: 0,
                          }}
                        >
                          {mc.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 작년/전월 강남구 매출 비교 */}
                {compareRows.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(39,42,49,0.5)',
                      border: `1px solid ${TOK.borderSubtle}`,
                      borderRadius: '0.75rem',
                      padding: '12px',
                      display: 'grid',
                      gridTemplateColumns: compareRows.length > 1 ? '1fr 1fr' : '1fr',
                    }}
                  >
                    {compareRows.map((row, i) => (
                      <div
                        key={i}
                        style={{
                          paddingLeft: i === 0 ? '8px' : '16px',
                          borderLeft: i > 0 ? `1px solid ${TOK.borderSubtle}` : 'none',
                        }}
                      >
                        <p style={{ fontSize: '12px', color: TOK.onSurfaceVariant, margin: '0 0 2px 0', fontFamily: TOK.fontBody }}>{row.label}</p>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: TOK.white, margin: 0, fontFamily: TOK.fontH1 }}>
                          {row.value}
                          <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '2px' }}>만원</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Chart Canvas */}
              {pathData && (
                <div style={{ position: 'relative', height: '224px', marginTop: '24px', overflow: 'hidden', paddingBottom: '24px' }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 8px 24px' }}>
                    <svg style={{ width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none" viewBox="0 0 600 200">
                      <defs>
                        <linearGradient id="card5-chart-fill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={TOK.primary} />
                          <stop offset="100%" stopColor={TOK.primary} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={pathData.fillD} fill="url(#card5-chart-fill)" opacity="0.3" />
                      <path d={pathData.lineD} fill="none" stroke={TOK.primary} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                      <circle cx={pathData.last.x} cy={pathData.last.y} fill={TOK.primary} r="5" />
                      <circle cx={pathData.last.x} cy={pathData.last.y} fill={TOK.primary} fillOpacity="0.2" r="10" />
                    </svg>
                    {lastValue != null && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          background: TOK.primary,
                          color: TOK.white,
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 8px',
                          borderRadius: '0.25rem',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                          transform: 'translateX(50%)',
                          top: `${Math.max(8, Math.min(160, pathData.last.y - 28))}px`,
                          fontFamily: TOK.fontBody,
                        }}
                      >
                        {fmtNum(lastValue)}
                      </div>
                    )}
                  </div>
                  {xLabels.length > 0 && (
                    <div style={{ position: 'absolute', bottom: '4px', width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0 8px', fontSize: '10px', color: TOK.onSurfaceVariant, fontFamily: TOK.fontTab }}>
                      {xLabels.map((l, i) => (<span key={i}>{l}</span>))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────── REVENUE STRUCTURE GRID (Section 3) ─────────────── */}
      {showSection3 && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          style={{ borderTop: `1px solid ${TOK.borderSubtle}` }}
        >
          {/* Section 3-1: Revenue Distribution */}
          {showDist && (
            <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
              <h4 style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: '0 0 16px 0', textTransform: 'uppercase' }}>매출 분위 분포</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {distRows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: TOK.onSurfaceVariant, fontFamily: TOK.fontBody }}>
                      <span>{row.label}</span>
                      <span style={{ color: TOK.white, fontWeight: 700 }}>{row.value}</span>
                    </div>
                    <div style={{ height: '12px', width: '100%', background: TOK.surfaceContainer, borderRadius: '9999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: row.fill,
                          width: `${Math.max(2, Math.min(100, Math.round(row.ratio * 100)))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3-2: Payment Analysis */}
          {showPayment && (
            <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}`, borderLeft: `1px solid ${TOK.borderSubtle}` }}>
              <h4 style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: '0 0 16px 0' }}>결제 분석</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {usageCnt && (
                  <div>
                    <p style={{ ...T.bodySm, color: TOK.onSurfaceVariant, margin: '0 0 4px 0' }}>월평균 결제 건수</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: TOK.primary, fontSize: '20px' }}>receipt_long</span>
                      <span style={{ ...T.h2, color: TOK.white, fontFamily: TOK.fontTab, fontVariantNumeric: 'tabular-nums' }}>
                        {usageCnt.replace('건', '')}
                        <span style={{ fontSize: '14px', fontWeight: 500, color: TOK.onSurfaceVariant, marginLeft: '4px' }}>건</span>
                      </span>
                    </div>
                  </div>
                )}
                {unitPrice && (
                  <div>
                    <p style={{ ...T.bodySm, color: TOK.onSurfaceVariant, margin: '0 0 4px 0' }}>평균 결제단가</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: TOK.secondary, fontSize: '20px' }}>payments</span>
                      <span style={{ ...T.h2, color: TOK.white, fontFamily: TOK.fontTab, fontVariantNumeric: 'tabular-nums' }}>
                        {unitPrice.replace('원', '')}
                        <span style={{ fontSize: '14px', fontWeight: 500, color: TOK.onSurfaceVariant, marginLeft: '4px' }}>원</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3-3: Location Statistics */}
          {showLocation && (
            <div
              className="col-span-1 md:col-span-2 lg:col-span-1"
              style={{ padding: '24px', borderLeft: `1px solid ${TOK.borderSubtle}` }}
            >
              <h4 style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: '0 0 16px 0' }}>입지 통계</h4>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                {cafePctNum != null && (
                  <div style={{ position: 'relative', width: '88px', height: '88px', flexShrink: 0 }}>
                    <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={TOK.surfaceContainer}
                        strokeWidth="4"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={TOK.primary}
                        strokeDasharray={`${donutPct}, 100`}
                        strokeLinecap="round"
                        strokeWidth="4"
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: TOK.white, fontFamily: TOK.fontH1 }}>{donutPct}%</span>
                    </div>
                  </div>
                )}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {locationRows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        borderBottom: `1px solid rgba(45,55,72,0.3)`,
                        paddingBottom: '4px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: TOK.onSurfaceVariant, fontFamily: TOK.fontBody, whiteSpace: 'nowrap' }}>{row.label}</span>
                      <span style={{ fontSize: '14px', color: TOK.white, fontWeight: 700, fontFamily: TOK.fontBody, whiteSpace: 'nowrap' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────── 신규 섹션 A: 동 매출 격차 ─────────────── */}
      {showDongRange && (
        <div style={{ padding: '24px', borderTop: `1px solid ${TOK.borderSubtle}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>동 카페 매출 분포</h3>
            <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>최고 / 평균 / 최저</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              dongMaxSales > 0 ? { label: '동 최고 매출', value: dongMaxSales, color: TOK.secondary } : null,
              monthlyVal > 0 ? { label: '동 평균 매출', value: monthlyVal, color: TOK.primary } : null,
              dongMinSales > 0 ? { label: '동 최저 매출', value: dongMinSales, color: TOK.error } : null,
            ].filter(Boolean).map((row, i) => {
              const w = Math.max(4, Math.min(100, Math.round((row.value / dongRangeBase) * 100)));
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', ...T.bodySm }}>
                    <span style={{ color: TOK.onSurfaceVariant }}>{row.label}</span>
                    <span style={{ ...T.dataTab, color: row.color, fontWeight: 700 }}>{fmtNum(row.value)}만원</span>
                  </div>
                  <div style={{ height: '14px', width: '100%', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: row.color, width: `${w}%`, borderRadius: '0.25rem' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────── 신규 섹션 B + C: 매출 건수 변화 + 매장수 추이 ─────────────── */}
      {(showSaleCnt || showStoreTrend) && (
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ borderTop: `1px solid ${TOK.borderSubtle}` }}
        >
          {/* 섹션 B: 매출 건수 + 변화율 */}
          {showSaleCnt && (
            <div style={{ padding: '24px', borderRight: showStoreTrend ? `1px solid ${TOK.borderSubtle}` : 'none' }}>
              <h4 style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: '0 0 16px 0' }}>매출 건수</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
                <span style={{ ...T.h1, color: TOK.white, margin: 0, fontSize: '28px', lineHeight: '36px' }}>{fmtNum(dongSaleCnt)}</span>
                <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>건/월 (동 평균)</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {prevYearCntRate != null && (
                  <span style={{
                    background: prevYearCntRate >= 0 ? TOK.secondary10 : TOK.error10,
                    color: prevYearCntRate >= 0 ? TOK.secondary : TOK.error,
                    ...T.labelCaps, padding: '4px 10px', borderRadius: '9999px', fontWeight: 700,
                  }}>
                    {`작년 대비 ${prevYearCntRate > 0 ? '+' : ''}${prevYearCntRate}%`}
                  </span>
                )}
                {prevMonCntRate != null && (
                  <span style={{
                    background: prevMonCntRate >= 0 ? TOK.secondary10 : TOK.error10,
                    color: prevMonCntRate >= 0 ? TOK.secondary : TOK.error,
                    ...T.labelCaps, padding: '4px 10px', borderRadius: '9999px', fontWeight: 700,
                  }}>
                    {`전월 대비 ${prevMonCntRate > 0 ? '+' : ''}${prevMonCntRate}%`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 섹션 C: 매장수 변화 추이 */}
          {showStoreTrend && (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <h4 style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: 0 }}>{bizmapStore6M ? '6개월 점포수 추이' : '3개월 동 매장수 추이'}</h4>
                <span style={{ ...T.dataTab, color: TOK.white, fontWeight: 700 }}>{fmtNum(storeTrend.values[storeTrend.values.length - 1])}개</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '72px' }}>
                {storeTrend.values.map((v, i) => {
                  const h = Math.max(8, Math.round(((v - storeTrendMin) / storeTrendRange) * 60) + 12);
                  const isLast = i === storeTrend.values.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '100%', height: `${h}px`, background: isLast ? TOK.primary : TOK.primary40, borderRadius: '0.25rem 0.25rem 0 0' }} />
                      <span style={{ fontSize: '10px', color: TOK.onSurfaceVariant, fontFamily: TOK.fontTab }}>{storeTrend.labels[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────── 신규 섹션 D + E: 시간대별 + 요일별 매출 비중 ─────────────── */}
      {(showHourly || showWeekday) && (
        <div
          className="grid grid-cols-1 lg:grid-cols-2"
          style={{ borderTop: `1px solid ${TOK.borderSubtle}` }}
        >
          {/* 섹션 D: 시간대별 매출/건수 비중 */}
          {showHourly && (
            <div style={{ padding: '24px', borderRight: showWeekday ? `1px solid ${TOK.borderSubtle}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <h4 style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: 0 }}>시간대별 매출 비중</h4>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontFamily: TOK.fontBody }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: TOK.onSurfaceVariant }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: TOK.primary }} />건수
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: TOK.onSurfaceVariant }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: TOK.secondary }} />금액
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {bizmapHourly.labels.map((lab, i) => {
                  const cnt = bizmapHourly.cntValues[i] || 0;
                  const amt = bizmapHourly.amtValues[i] || 0;
                  const cntW = Math.max(2, Math.round((cnt / hourlyMaxVal) * 100));
                  const amtW = Math.max(2, Math.round((amt / hourlyMaxVal) * 100));
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '52px', fontSize: '11px', color: TOK.onSurfaceVariant, fontFamily: TOK.fontTab, flexShrink: 0 }}>{lab}시</span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ height: '8px', background: TOK.surfaceContainer, borderRadius: '0.125rem', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: TOK.primary, width: `${cntW}%` }} />
                        </div>
                        <div style={{ height: '8px', background: TOK.surfaceContainer, borderRadius: '0.125rem', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: TOK.secondary, width: `${amtW}%` }} />
                        </div>
                      </div>
                      <span style={{ width: '44px', textAlign: 'right', fontSize: '11px', color: TOK.white, fontFamily: TOK.fontTab, fontWeight: 700, flexShrink: 0 }}>{amt.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 섹션 E: 요일별 매출 비중 */}
          {showWeekday && (
            <div style={{ padding: '24px' }}>
              <h4 style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: '0 0 16px 0' }}>요일별 매출 비중</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {bizmapWeekday.labels.map((lab, i) => {
                  const v = bizmapWeekday.values[i] || 0;
                  const w = Math.max(2, Math.round((v / weekdayMaxVal) * 100));
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '36px', fontSize: '12px', color: TOK.onSurface, fontFamily: TOK.fontBody, fontWeight: 600, flexShrink: 0 }}>{lab}</span>
                      <div style={{ flex: 1, height: '14px', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: TOK.primary, width: `${w}%`, borderRadius: '0.25rem' }} />
                      </div>
                      <span style={{ width: '52px', textAlign: 'right', ...T.dataTab, color: TOK.white, fontWeight: 700, flexShrink: 0 }}>{v.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────── TOP 5 NEARBY DISTRICTS ─────────────── */}
      {showTopDongs && (
        <div
          style={{
            padding: '24px',
            background: TOK.surfaceContainerLowest,
            borderTop: `1px solid ${TOK.borderSubtle}`,
          }}
        >
          <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: '0 0 16px 0' }}>{body.topFiveTitle || '카페 매출 TOP 5'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ columnGap: '48px', rowGap: '16px' }}>
            {topDongs.map((d, i) => {
              const rankStr = String(i + 1).padStart(2, '0');
              const widthPct = topMaxAmt > 0 ? Math.max(4, Math.min(100, Math.round((d.amt / topMaxAmt) * 100))) : 0;
              const warnColor = '#F5A623';
              const isOpen = openWarningIdx === i;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px',
                      borderRadius: '0.5rem',
                      transition: 'background 200ms',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: TOK.primary, fontWeight: 900, fontStyle: 'italic', fontSize: '20px', fontFamily: TOK.fontH1 }}>{rankStr}</span>
                      <span style={{ display: 'flex', alignItems: 'center', color: TOK.white, fontWeight: 500, fontFamily: TOK.fontBody, fontSize: '14px' }}>
                        {d.name}{d.gu ? `(${d.gu})` : ''}
                        {d.warning && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            style={{ cursor: 'pointer', marginLeft: '6px', flexShrink: 0 }}
                            onClick={(e) => { e.stopPropagation(); setOpenWarningIdx(isOpen ? null : i); }}
                            aria-label="이상치 경고"
                            role="button"
                          >
                            <path d="M12 2 L22 20 H2 Z" stroke={warnColor} strokeWidth="2" fill="none" strokeLinejoin="round" />
                            <line x1="12" y1="9" x2="12" y2="14" stroke={warnColor} strokeWidth="2" strokeLinecap="round" />
                            <circle cx="12" cy="17" r="1.2" fill={warnColor} />
                          </svg>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ ...T.dataTab, color: TOK.onSurfaceVariant }}>
                        {d.stores > 0 ? `${fmtNum(d.stores)}개 / ` : ''}{fmtNum(d.amt)}만원
                      </span>
                      <div className="hidden sm:block" style={{ width: '64px', height: '6px', background: TOK.surfaceContainer, borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: TOK.primary, width: `${widthPct}%` }} />
                      </div>
                    </div>
                  </div>
                  {d.warning && isOpen && (
                    <div
                      style={{
                        margin: '4px 8px 8px 8px',
                        padding: '12px 14px',
                        background: TOK.surfaceContainerLow,
                        border: `1px solid ${warnColor}`,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <path d="M12 2 L22 20 H2 Z" stroke={warnColor} strokeWidth="2" fill="none" strokeLinejoin="round" />
                        <line x1="12" y1="9" x2="12" y2="14" stroke={warnColor} strokeWidth="2" strokeLinecap="round" />
                        <circle cx="12" cy="17" r="1.2" fill={warnColor} />
                      </svg>
                      <span style={{ flex: 1, color: TOK.white, fontFamily: TOK.fontBody, fontSize: '13px', lineHeight: '20px' }}>
                        {d.warning}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenWarningIdx(null); }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: TOK.onSurfaceVariant,
                          cursor: 'pointer',
                          fontSize: '16px',
                          lineHeight: 1,
                          padding: '0 4px',
                          flexShrink: 0,
                        }}
                        aria-label="닫기"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Card5SalesAnalysis;
