import React from 'react';

/**
 * Card 3 - 프랜차이즈 현황 (Card5 디자인 토큰 + 인라인 style 패턴)
 * 데이터 키: card.bodyData (dataMapper.js Card 3 섹션)
 *
 * 구성:
 *  1) 헤더(빅넘버 + 점유율 칩) + AI 요약
 *  2) 시장 점유율 도넛 + 3분할 정보(프랜차이즈/개인/베이커리)
 *  3) 브랜드 TOP 7 가로 막대 차트
 *  4) 거리별 분포 3분할 카드
 *  5) 카페 1개당 잠재 고객 강조
 *  6) 신규 진입 프랜차이즈 (있을 때만)
 */

/* ── 디자인 토큰 (Card5와 동일) ── */
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

const Card3FranchiseAnalysis = ({ card, cardNumber = '03', kosisBoxData = null }) => {
  if (!card) return null;
  const body = card.bodyData || {};

  // 빅넘버
  const franchiseCount = Number(body.franchiseCount) || 0;
  const totalCafes = Number(body.totalCafes) || 0;
  const independentCount = Number(body.independentCount) || 0;
  const bigNumberStr = franchiseCount > 0 ? fmtNum(franchiseCount) : null;

  // 점유율 칩
  const franchiseShare = Number(body.franchiseShare) || 0;
  const independentShare = Number(body.independentShare) || 0;
  const bakeryShare = Number(body.bakeryShare) || 0;
  const showShareChip = franchiseShare > 0;

  // AI 요약
  const aiSummaryRaw = safeStr(card.aiSummary) || safeStr(card.bruSummary);

  // 브랜드 TOP 7
  const brandBarItems = Array.isArray(body.brandBarItems) ? body.brandBarItems : [];
  const showBrandBar = brandBarItems.length > 0;
  const brandMax = brandBarItems.length > 0 ? Math.max(...brandBarItems.map(b => b.count || 0)) : 0;

  // 거리별 분포
  const dd = body.distanceDistribution || {};
  const ddInner = Number(dd.inner) || 0;
  const ddMid = Number(dd.mid) || 0;
  const ddOuter = Number(dd.outer) || 0;
  const showDist = (ddInner + ddMid + ddOuter) > 0;
  const ddMax = Math.max(ddInner, ddMid, ddOuter, 1);

  // 카페 1개당 잠재 고객
  const perCafePotential = Number(body.perCafePotential) || 0;
  const showPotential = perCafePotential > 0;

  // 신규 프랜차이즈
  const newFranchiseList = Array.isArray(body.newFranchiseList) ? body.newFranchiseList : [];
  const showNewFranch = newFranchiseList.length > 0;

  // 시장 점유율 도넛 비율 (반시계 누적)
  const showShareSection = (franchiseShare + independentShare + bakeryShare) > 0;
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
      {/* ── HEADER ── */}
      <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
        <div className="flex flex-col md:flex-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
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
                03 프랜차이즈 현황
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
              <p style={{ ...T.bodyLg, color: TOK.onSurfaceVariant, fontWeight: 500, margin: 0 }}>500m 내 프랜차이즈 카페</p>
            </div>
          </div>

          {/* 우측 칩 */}
          {showShareChip && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <span
                  style={{
                    background: TOK.primary20,
                    color: TOK.primary,
                    ...T.labelCaps,
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  점유율 {franchiseShare}%
                </span>
                {totalCafes > 0 && (
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
                    전체 {fmtNum(totalCafes)}개
                  </span>
                )}
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
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={TOK.white}
                aria-hidden="true"
              >
                <path d="M12 0L14.4 7.2L24 9.6L14.4 12L12 24L9.6 12L0 9.6L9.6 7.2L12 0Z" />
              </svg>
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

      {/* ── 섹션 1: 시장 점유율 ── */}
      {showShareSection && (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          {/* 좌측: 도넛 */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', borderRight: `1px solid ${TOK.borderSubtle}` }}>
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0, alignSelf: 'flex-start' }}>시장 점유율</h3>
            <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
              <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={TOK.surfaceContainer}
                  strokeWidth="3.5"
                />
                {/* 프랜차이즈 (primary) */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={TOK.primary}
                  strokeDasharray={`${franchiseShare}, 100`}
                  strokeDashoffset="0"
                  strokeLinecap="butt"
                  strokeWidth="3.5"
                />
                {/* 개인카페 (secondary) - 누적 위치 */}
                {independentShare > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={TOK.secondary}
                    strokeDasharray={`${independentShare}, 100`}
                    strokeDashoffset={`-${franchiseShare}`}
                    strokeLinecap="butt"
                    strokeWidth="3.5"
                  />
                )}
                {/* 베이커리 (warning) */}
                {bakeryShare > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={TOK.warning}
                    strokeDasharray={`${bakeryShare}, 100`}
                    strokeDashoffset={`-${franchiseShare + independentShare}`}
                    strokeLinecap="butt"
                    strokeWidth="3.5"
                  />
                )}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '28px', fontWeight: 700, color: TOK.white, fontFamily: TOK.fontH1, lineHeight: 1 }}>{franchiseShare}%</span>
                <span style={{ fontSize: '11px', color: TOK.onSurfaceVariant, marginTop: '4px' }}>프랜차이즈</span>
              </div>
            </div>
          </div>

          {/* 우측: 3분할 정보 */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
            {[
              { label: '프랜차이즈', count: franchiseCount, share: franchiseShare, color: TOK.primary },
              { label: '개인 카페', count: independentCount, share: independentShare, color: TOK.secondary },
              { label: '베이커리', count: 0, share: bakeryShare, color: TOK.warning, hideCount: true },
            ].filter(r => r.share > 0).map((row, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...T.bodySm }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: TOK.onSurface }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                    {row.label}
                  </span>
                  <span style={{ ...T.dataTab, color: row.color, fontWeight: 700 }}>
                    {row.share}%{!row.hideCount && row.count > 0 ? ` · ${fmtNum(row.count)}개` : ''}
                  </span>
                </div>
                <div style={{ height: '8px', width: '100%', background: TOK.surfaceContainer, borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: row.color,
                      width: `${Math.min(100, row.share)}%`,
                      borderRadius: '9999px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 섹션 2: 브랜드 TOP 7 ── */}
      {showBrandBar && (
        <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>브랜드 TOP {brandBarItems.length}</h3>
            <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>매장 수 기준</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {brandBarItems.map((b, i) => {
              const w = brandMax > 0 ? Math.max(4, Math.round(((b.count || 0) / brandMax) * 100)) : 0;
              const isTop = i === 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    width: '24px',
                    fontSize: '13px',
                    color: isTop ? TOK.primary : TOK.onSurfaceVariant,
                    fontFamily: TOK.fontH1,
                    fontWeight: 900,
                    fontStyle: 'italic',
                    flexShrink: 0,
                    textAlign: 'right',
                  }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{
                    flex: '0 0 auto',
                    width: '110px',
                    fontSize: '13px',
                    color: TOK.white,
                    fontWeight: isTop ? 700 : 500,
                    fontFamily: TOK.fontBody,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{b.name}</span>
                  <div style={{ flex: 1, height: '14px', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      background: isTop ? TOK.primary : TOK.primary40,
                      width: `${w}%`,
                      borderRadius: '0.25rem',
                    }} />
                  </div>
                  <span style={{
                    width: '40px',
                    textAlign: 'right',
                    ...T.dataTab,
                    color: isTop ? TOK.primary : TOK.onSurface,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>{b.count}개</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 섹션 3: 거리별 분포 ── */}
      {showDist && (
        <div style={{ padding: '24px', borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>거리별 분포</h3>
            <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>500m 반경</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '12px' }}>
            {[
              { label: '200m 이내', value: ddInner, color: TOK.primary, hint: '핵심 경쟁권' },
              { label: '200~350m', value: ddMid, color: TOK.primary60Solid, hint: '직접 경쟁권' },
              { label: '350~500m', value: ddOuter, color: TOK.primary40, hint: '주변 영향권' },
            ].map((row, i) => {
              const w = Math.max(4, Math.round((row.value / ddMax) * 100));
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

      {/* ── 섹션 4: 카페 1개당 잠재 고객 ── */}
      {showPotential && (
        <div style={{ padding: '24px', borderBottom: showNewFranch ? `1px solid ${TOK.borderSubtle}` : 'none' }}>
          <div style={{
            background: `linear-gradient(135deg, ${TOK.primary10}, ${TOK.secondary10})`,
            border: `1px solid ${TOK.borderSubtle}`,
            borderRadius: '0.75rem',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.75rem',
                background: TOK.primary20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={TOK.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <p style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: '0 0 4px 0' }}>카페 1개당 잠재 고객</p>
                <p style={{ ...T.bodySm, color: TOK.onSurfaceVariant, margin: 0 }}>일일 유동인구 ÷ 전체 카페수</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ ...T.h1, color: TOK.white, margin: 0 }}>{fmtNum(perCafePotential)}</span>
              <span style={{ ...T.bodyLg, color: TOK.onSurfaceVariant, fontWeight: 500 }}>명/일</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 섹션 5: 신규 진입 프랜차이즈 ── */}
      {showNewFranch && (
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
            <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>신규 진입 프랜차이즈</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ columnGap: '24px', rowGap: '10px' }}>
            {newFranchiseList.map((f, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: TOK.surfaceContainer,
                border: `1px solid ${TOK.borderSubtle}`,
                borderRadius: '0.5rem',
              }}>
                <span style={{ color: TOK.white, fontFamily: TOK.fontBody, fontWeight: 600, fontSize: '14px' }}>{f.name}</span>
                <span style={{ ...T.dataTab, color: TOK.warning, fontWeight: 700 }}>{f.dist}m</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Card3FranchiseAnalysis;
