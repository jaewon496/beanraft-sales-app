import React from 'react';

/**
 * Card 4 - 개인 카페 분석 (Card5 디자인 토큰 + 인라인 style 패턴)
 * 데이터 키: card.bodyData (dataMapper.js Card 4 섹션)
 *
 * 구성:
 *  1) 헤더(빅넘버 + 비중 칩) + AI 요약
 *  2) 평균 가격 비교 3개 미니카드 (아메리카노/메뉴/디저트)
 *  3) 개인 vs 프랜차이즈 가격 비교
 *  4) 가격대 분포 (저가/중가/고가) + 도넛
 *  5) 거리별 분포 (100m/100~250m/250~500m)
 *  6) 가까운 개인 카페 TOP 5
 *  7) 신규 오픈 (있을 때만)
 */

const TOK = {
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
  secondary:          '#10B981',
  secondary10:        'rgba(16, 185, 129, 0.1)',
  secondary20:        'rgba(16, 185, 129, 0.2)',
  warning:            '#F59E0B',
  warning10:          'rgba(245, 158, 11, 0.1)',
  warning20:          'rgba(245, 158, 11, 0.2)',
  error:              '#EF4444',
  error10:            'rgba(239, 68, 68, 0.1)',
  white:              '#FFFFFF',
  onSurface:          '#E1E2EC',
  onSurfaceVariant:   '#C2C6D6',

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

const Card4IndieCafeAnalysis = ({ card }) => {
  if (!card) return null;
  const body = card.bodyData || {};

  // 헤더
  const indieCount = Number(body.independentCount) || 0;
  const totalCafes = Number(body.totalCafes) || 0;
  // bodyData에 totalCafes 가 없을 수 있음 → 비중은 가능한 경우만
  let indieShare = 0;
  if (totalCafes > 0) {
    indieShare = Math.round((indieCount / totalCafes) * 100);
  }
  const bigNumberStr = indieCount > 0 ? fmtNum(indieCount) : null;

  const aiSummaryRaw = safeStr(card.aiSummary) || safeStr(card.bruSummary);
  const dateLabel = safeStr(card.date);

  // 평균 가격 미니카드
  const americanoAvg = Number(body.americanoAvg) || 0;
  const menuAvg = Number(body.menuAvg) || 0;
  const dessertAvg = Number(body.dessertAvg) || 0;
  const priceMiniCards = [
    americanoAvg > 0 ? { label: '아메리카노 평균', value: americanoAvg, color: TOK.primary, icon: 'local_cafe' } : null,
    menuAvg > 0 ? { label: '메뉴 평균', value: menuAvg, color: TOK.secondary, icon: 'restaurant_menu' } : null,
    dessertAvg > 0 ? { label: '디저트 평균', value: dessertAvg, color: TOK.warning, icon: 'cake' } : null,
  ].filter(Boolean);
  const showPriceMini = priceMiniCards.length > 0;

  // 개인 vs 프랜차이즈 가격 비교
  const ifc = body.indieFranchPriceCompare || null;
  const showCompare = ifc && ifc.indie > 0 && ifc.franch > 0;
  const compareMaxBase = showCompare ? Math.max(ifc.indie, ifc.franch) : 1;

  // 가격대 분포
  const ipd = body.indiePriceDistribution || null;
  const showPriceDist = ipd && (Number(ipd.cheap) + Number(ipd.mid) + Number(ipd.premium)) > 0;
  const cheapCnt = ipd ? Number(ipd.cheap) || 0 : 0;
  const midCnt = ipd ? Number(ipd.mid) || 0 : 0;
  const premiumCnt = ipd ? Number(ipd.premium) || 0 : 0;
  const priceDistTotal = cheapCnt + midCnt + premiumCnt;
  const cheapPct = priceDistTotal > 0 ? Math.round((cheapCnt / priceDistTotal) * 100) : 0;
  const midPct = priceDistTotal > 0 ? Math.round((midCnt / priceDistTotal) * 100) : 0;
  const premiumPct = priceDistTotal > 0 ? Math.round((premiumCnt / priceDistTotal) * 100) : 0;

  // 거리별 분포
  const idd = body.indieDistanceDistribution || {};
  const iddInner = Number(idd.inner) || 0;
  const iddMid = Number(idd.mid) || 0;
  const iddOuter = Number(idd.outer) || 0;
  const showDist = (iddInner + iddMid + iddOuter) > 0;
  const iddMax = Math.max(iddInner, iddMid, iddOuter, 1);

  // TOP 5
  const topNearbyIndie = Array.isArray(body.topNearbyIndie) ? body.topNearbyIndie.filter(c => c.name) : [];
  const showTop = topNearbyIndie.length > 0;
  const topMaxDist = topNearbyIndie.length > 0 ? Math.max(...topNearbyIndie.map(c => c.dist || 0), 1) : 1;

  // 신규
  const newIndieList = Array.isArray(body.newIndieList) ? body.newIndieList.filter(c => c.name) : [];
  const showNew = newIndieList.length > 0;

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
      {/* ── HEADER ── */}
      <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
        <div className="flex flex-col md:flex-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: TOK.secondary20,
                  color: TOK.secondary,
                  ...T.labelCaps,
                  padding: '2px 8px',
                  borderRadius: '0.25rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                04 개인 카페 분석
              </span>
              {dateLabel && (
                <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>{dateLabel}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px', marginTop: '4px' }}>
              {bigNumberStr && (
                <h2 style={{ ...T.h1, color: TOK.white, margin: 0 }}>
                  {bigNumberStr}
                  <span style={{ ...T.h2, color: TOK.white, marginLeft: '4px' }}>개</span>
                </h2>
              )}
              <p style={{ ...T.bodyLg, color: TOK.onSurfaceVariant, fontWeight: 500, margin: 0 }}>500m 내 개인 카페</p>
            </div>
          </div>

          {indieShare > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <span
                  style={{
                    background: TOK.secondary20,
                    color: TOK.secondary,
                    ...T.labelCaps,
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  비중 {indieShare}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* AI 요약 */}
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

      {/* ── 섹션 1: 평균 가격 미니카드 ── */}
      {showPriceMini && (
        <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: '0 0 16px 0' }}>평균 가격</h3>
          <div className="grid" style={{ gap: '12px', gridTemplateColumns: `repeat(${priceMiniCards.length}, minmax(0, 1fr))` }}>
            {priceMiniCards.map((mc, i) => (
              <div key={i} style={{
                background: TOK.surfaceContainer,
                border: `1px solid ${TOK.borderSubtle}`,
                borderRadius: '0.75rem',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: mc.color, fontSize: '20px' }}>{mc.icon}</span>
                  <span style={{ ...T.labelCaps, color: TOK.onSurfaceVariant }}>{mc.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ ...T.h2, color: TOK.white, margin: 0, fontFamily: TOK.fontTab }}>{fmtNum(mc.value)}</span>
                  <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>원</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 섹션 2: 개인 vs 프랜차이즈 가격 비교 ── */}
      {showCompare && (
        <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>아메리카노 가격 비교</h3>
            <span style={{
              background: ifc.diff >= 0 ? TOK.error10 : TOK.secondary10,
              color: ifc.diff >= 0 ? TOK.error : TOK.secondary,
              ...T.labelCaps,
              padding: '4px 10px',
              borderRadius: '9999px',
              fontWeight: 700,
            }}>
              개인 카페가 {ifc.diff >= 0 ? '+' : ''}{ifc.pctDiff}% {ifc.diff >= 0 ? '비쌈' : '저렴'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: '개인 카페', value: ifc.indie, color: TOK.secondary },
              { label: '프랜차이즈 (스타벅스 톨)', value: ifc.franch, color: TOK.primary },
            ].map((row, i) => {
              const w = Math.max(4, Math.round((row.value / compareMaxBase) * 100));
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...T.bodySm }}>
                    <span style={{ color: TOK.onSurface, fontWeight: 500 }}>{row.label}</span>
                    <span style={{ ...T.dataTab, color: row.color, fontWeight: 700 }}>{fmtNum(row.value)}원</span>
                  </div>
                  <div style={{ height: '20px', width: '100%', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: row.color, width: `${w}%`, borderRadius: '0.25rem' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 섹션 3: 가격대 분포 ── */}
      {showPriceDist && (
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          {/* 좌측: 도넛 */}
          <div style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            borderRight: `1px solid ${TOK.borderSubtle}`,
          }}>
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0, alignSelf: 'flex-start' }}>가격대 분포</h3>
            <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
              <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={TOK.surfaceContainer}
                  strokeWidth="3.5"
                />
                {/* 저가 */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={TOK.secondary}
                  strokeDasharray={`${cheapPct}, 100`}
                  strokeDashoffset="0"
                  strokeWidth="3.5"
                />
                {/* 중가 */}
                {midPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={TOK.primary}
                    strokeDasharray={`${midPct}, 100`}
                    strokeDashoffset={`-${cheapPct}`}
                    strokeWidth="3.5"
                  />
                )}
                {/* 고가 */}
                {premiumPct > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={TOK.warning}
                    strokeDasharray={`${premiumPct}, 100`}
                    strokeDashoffset={`-${cheapPct + midPct}`}
                    strokeWidth="3.5"
                  />
                )}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: TOK.white, fontFamily: TOK.fontH1 }}>{priceDistTotal}</span>
                <span style={{ fontSize: '10px', color: TOK.onSurfaceVariant }}>표본</span>
              </div>
            </div>
          </div>

          {/* 우측: 3분할 카드 */}
          <div className="grid" style={{
            gridColumn: 'span 2 / span 2',
            gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
            gap: 0,
          }}>
            {[
              { label: '저가', sub: '3,500원 미만', count: cheapCnt, pct: cheapPct, color: TOK.secondary },
              { label: '중가', sub: '3,500~5,000원', count: midCnt, pct: midPct, color: TOK.primary },
              { label: '고가', sub: '5,000원 초과', count: premiumCnt, pct: premiumPct, color: TOK.warning },
            ].map((row, i) => (
              <div key={i} style={{
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                borderLeft: i > 0 ? `1px solid ${TOK.borderSubtle}` : 'none',
              }}>
                <span style={{ ...T.labelCaps, color: row.color, fontWeight: 700 }}>{row.label}</span>
                <span style={{ fontSize: '11px', color: TOK.onSurfaceVariant, fontFamily: TOK.fontBody }}>{row.sub}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                  <span style={{ ...T.h2, color: TOK.white, fontFamily: TOK.fontTab, margin: 0 }}>{row.count}</span>
                  <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>개</span>
                </div>
                <span style={{ ...T.dataTab, color: row.color, fontWeight: 700 }}>{row.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 섹션 4: 거리별 분포 ── */}
      {showDist && (
        <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>거리별 분포</h3>
            <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>500m 반경</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '12px' }}>
            {[
              { label: '100m 이내', value: iddInner, color: TOK.secondary, hint: '바로 옆 경쟁' },
              { label: '100~250m', value: iddMid, color: TOK.primary, hint: '도보 3분권' },
              { label: '250~500m', value: iddOuter, color: TOK.warning, hint: '도보 7분권' },
            ].map((row, i) => {
              const w = Math.max(4, Math.round((row.value / iddMax) * 100));
              return (
                <div key={i} style={{
                  background: TOK.surfaceContainer,
                  border: `1px solid ${TOK.borderSubtle}`,
                  borderRadius: '0.75rem',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ ...T.labelCaps, color: TOK.onSurfaceVariant }}>{row.label}</span>
                    <span style={{ fontSize: '11px', color: TOK.onSurfaceVariant, fontFamily: TOK.fontBody }}>{row.hint}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ ...T.h1, fontSize: '28px', lineHeight: '36px', color: TOK.white, margin: 0 }}>{row.value}</span>
                    <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>개</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: TOK.surfaceContainerLowest, borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: row.color, width: `${w}%`, borderRadius: '9999px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 섹션 5: 가까운 개인 카페 TOP 5 ── */}
      {showTop && (
        <div style={{ padding: '24px', background: TOK.surfaceContainerLowest, borderBottom: showNew ? `1px solid ${TOK.borderSubtle}` : 'none' }}>
          <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: '0 0 16px 0' }}>가까운 개인 카페 TOP {topNearbyIndie.length}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topNearbyIndie.map((c, i) => {
              const rankStr = String(i + 1).padStart(2, '0');
              // 거리는 가까울수록 막대가 길게(역수)
              const w = topMaxDist > 0 ? Math.max(8, 100 - Math.round(((c.dist || 0) / topMaxDist) * 90)) : 50;
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: TOK.surfaceContainer,
                  border: `1px solid ${TOK.borderSubtle}`,
                  borderRadius: '0.5rem',
                }}>
                  <span style={{ color: TOK.secondary, fontWeight: 900, fontStyle: 'italic', fontSize: '18px', fontFamily: TOK.fontH1, flexShrink: 0, width: '28px' }}>{rankStr}</span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: TOK.white, fontWeight: 600, fontFamily: TOK.fontBody, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.addr && (
                      <span style={{ color: TOK.onSurfaceVariant, fontSize: '11px', fontFamily: TOK.fontBody, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.addr}</span>
                    )}
                  </div>
                  <div className="hidden sm:block" style={{ width: '80px', height: '6px', background: TOK.surfaceContainerLowest, borderRadius: '9999px', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', background: TOK.secondary, width: `${w}%` }} />
                  </div>
                  <span style={{ ...T.dataTab, color: TOK.secondary, fontWeight: 700, flexShrink: 0, width: '52px', textAlign: 'right' }}>{c.dist}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 섹션 6: 신규 오픈 ── */}
      {showNew && (
        <div style={{ padding: '24px', background: TOK.surfaceContainerLowest }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{
              background: TOK.warning20,
              color: TOK.warning,
              ...T.labelCaps,
              padding: '2px 8px',
              borderRadius: '0.25rem',
              fontWeight: 700,
            }}>NEW</span>
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>신규 오픈 개인 카페</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ columnGap: '24px', rowGap: '10px' }}>
            {newIndieList.map((c, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: TOK.surfaceContainer,
                border: `1px solid ${TOK.borderSubtle}`,
                borderRadius: '0.5rem',
              }}>
                <span style={{ color: TOK.white, fontFamily: TOK.fontBody, fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ ...T.dataTab, color: TOK.warning, fontWeight: 700, flexShrink: 0 }}>{c.dist}m</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Card4IndieCafeAnalysis;
