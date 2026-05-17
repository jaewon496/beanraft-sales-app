import React from 'react';

/**
 * Card 6 - 유동인구 (Card5/Card3 디자인 토큰 + 인라인 style 패턴)
 * 데이터 키: card.bodyData (dataMapper.js Card 6 섹션)
 *
 * 구성:
 *  1) 헤더(빅넘버 동 일평균 + 최다 요일 칩) + AI 요약
 *  2) 반경 vs 동 전체 비교 (2개 빅넘버)
 *  3) 시간대별 유동인구 비중 (가로 막대) + 요일별 유동인구 비중 (가로 막대)
 *  4) 주중/주말 도넛 + 시간대 사람 수 미니 카드
 *  5) 상위 유동인구 지역 + 방문 고객 비교
 */

/* ── 디자인 토큰 (Card5/Card3와 동일) ── */
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

const Card6FloatingPop = ({ card }) => {
  if (!card) return null;
  const body = card.bodyData || {};
  const chart = card.chartData || {};

  // ── 헤더 빅넘버: 동 전체 일평균 ──
  const dongDailyPop = Number(body.dongDailyPop) || 0;
  const totalPop = Number(body.totalPop) || 0;
  const headerBig = dongDailyPop > 0 ? dongDailyPop : totalPop;
  const headerLabel = dongDailyPop > 0 ? '동 일평균 유동인구' : '반경 500m 일평균 유동인구';
  const bigStr = headerBig > 0 ? fmtNum(headerBig) : null;

  // 최다 요일 칩
  const popPeakDay = safeStr(body.popPeakDay);
  const popPeakDayPct = Number(body.popPeakDayPct) || 0;
  const showPeakDayChip = popPeakDay && popPeakDayPct > 0;
  const peakDayChipText = showPeakDayChip ? `${popPeakDay}요일 ${popPeakDayPct.toFixed(1)}% 최다` : '';

  // 최다 시간대 칩
  const popPeakHour = safeStr(body.popPeakHour);
  const popPeakHourPct = Number(body.popPeakHourPct) || 0;
  const showPeakHourChip = popPeakHour && popPeakHourPct > 0;
  const peakHourChipText = showPeakHourChip ? `${popPeakHour} ${popPeakHourPct.toFixed(1)}%` : '';

  // 기준월
  const popStdYm = safeStr(body.popStdYm);

  // AI 요약
  const aiSummaryRaw = safeStr(card.aiSummary) || safeStr(card.bruSummary);

  // ── 섹션: 반경 vs 동 비교 ──
  const showCompare = totalPop > 0 || dongDailyPop > 0;

  // ── 섹션: 시간대별 비중 ──
  const hourlyPctChart = body.hourlyPctChart && Array.isArray(body.hourlyPctChart.labels) ? body.hourlyPctChart : null;
  const showHourlyPct = hourlyPctChart && hourlyPctChart.values.some(v => v > 0);
  const hourlyMax = showHourlyPct ? Math.max.apply(null, hourlyPctChart.values) || 1 : 1;
  const hourlyMaxIdx = showHourlyPct ? hourlyPctChart.values.indexOf(hourlyMax) : -1;

  // ── 섹션: 요일별 비중 ──
  const weeklyPctChart = body.weeklyPctChart && Array.isArray(body.weeklyPctChart.labels) ? body.weeklyPctChart : null;
  const showWeeklyPct = weeklyPctChart && weeklyPctChart.values.some(v => v > 0);
  const weeklyMax = showWeeklyPct ? Math.max.apply(null, weeklyPctChart.values) || 1 : 1;
  const weeklyMaxIdx = showWeeklyPct ? weeklyPctChart.values.indexOf(weeklyMax) : -1;

  // ── 섹션: 주중/주말 도넛 ──
  const weekdayPct = Number(body.weekdayPct) || 0;
  const weekendPct = Number(body.weekendPct) || 0;
  const showDonut = weekdayPct > 0 || weekendPct > 0;
  // 합계 정규화
  const wkSum = weekdayPct + weekendPct;
  const wkdNorm = wkSum > 0 ? (weekdayPct / wkSum) * 100 : 0;
  const wkeNorm = wkSum > 0 ? (weekendPct / wkSum) * 100 : 0;

  // ── 섹션: 시간대별 사람 수 (chartData) - 절대값 미니카드 ──
  const hourlyAbs = chart && Array.isArray(chart.labels) && Array.isArray(chart.values)
    ? { labels: chart.labels, values: chart.values }
    : null;
  const showHourlyAbs = hourlyAbs && hourlyAbs.values.some(v => v > 0);

  // ── 섹션: 상위 유동인구 지역 ──
  const topArea = body.topArea && body.topArea.name ? body.topArea : null;
  const showTopArea = topArea && Number(topArea.pop) > 0;

  // ── 섹션: 방문고객 ──
  const visitors = Number(body.visitors) || 0;
  const showVisitors = visitors > 0;

  // ── 평일 vs 주말 사람 수 (dynPplCmpr 일평균 기준) ──
  const weekday = Number(body.weekday) || 0;
  const weekend = Number(body.weekend) || 0;
  const showWdWePop = weekday > 0 || weekend > 0;

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
                06 유동인구
              </span>
              {dateLabel && (
                <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>{dateLabel}</span>
              )}
              {popStdYm && (
                <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant, fontSize: '12px' }}>기준 {popStdYm}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px', marginTop: '4px' }}>
              {bigStr && (
                <h2 style={{ ...T.h1, color: TOK.white, margin: 0 }}>
                  {bigStr}
                  <span style={{ ...T.h2, color: TOK.white, marginLeft: '4px' }}>명</span>
                </h2>
              )}
              <p style={{ ...T.bodyLg, color: TOK.onSurfaceVariant, fontWeight: 500, margin: 0 }}>{headerLabel}</p>
            </div>
          </div>

          {/* 우측 칩 */}
          {(showPeakDayChip || showPeakHourChip) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {showPeakDayChip && (
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
                    {peakDayChipText}
                  </span>
                )}
                {showPeakHourChip && (
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
                    {peakHourChipText}
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

      {/* ── 섹션 1: 반경 vs 동 비교 ── */}
      {showCompare && (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          {/* 좌측: 반경 500m */}
          {totalPop > 0 && (
            <div style={{
              padding: '24px',
              borderRight: dongDailyPop > 0 ? `1px solid ${TOK.borderSubtle}` : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: TOK.primary, fontSize: '20px' }}>my_location</span>
                <p style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: 0 }}>반경 500m 일평균</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ ...T.h1, color: TOK.white, margin: 0 }}>{fmtNum(totalPop)}</span>
                <span style={{ ...T.bodyLg, color: TOK.onSurfaceVariant, fontWeight: 500 }}>명</span>
              </div>
              <p style={{ ...T.bodySm, color: TOK.onSurfaceVariant, margin: 0 }}>현 상권 통행량 (월간 ÷ 30)</p>
            </div>
          )}

          {/* 우측: 동 전체 */}
          {dongDailyPop > 0 && (
            <div style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: TOK.secondary, fontSize: '20px' }}>location_city</span>
                <p style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: 0 }}>동 전체 일평균</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ ...T.h1, color: TOK.white, margin: 0 }}>{fmtNum(dongDailyPop)}</span>
                <span style={{ ...T.bodyLg, color: TOK.onSurfaceVariant, fontWeight: 500 }}>명</span>
              </div>
              <p style={{ ...T.bodySm, color: TOK.onSurfaceVariant, margin: 0 }}>행정동 전체 평균</p>
            </div>
          )}
        </div>
      )}

      {/* ── 섹션 2: 시간대별 + 요일별 비중 ── */}
      {(showHourlyPct || showWeeklyPct) && (
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          {/* 시간대별 비중 */}
          {showHourlyPct && (
            <div style={{
              padding: '24px',
              borderRight: showWeeklyPct ? `1px solid ${TOK.borderSubtle}` : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>시간대별 비중</h3>
                <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>유동인구 %</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {hourlyPctChart.labels.map((lab, i) => {
                  const v = hourlyPctChart.values[i] || 0;
                  const w = Math.max(2, Math.round((v / hourlyMax) * 100));
                  const isMax = i === hourlyMaxIdx;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '64px',
                        fontSize: '12px',
                        color: TOK.onSurfaceVariant,
                        fontFamily: TOK.fontTab,
                        flexShrink: 0,
                      }}>{lab}</span>
                      <div style={{ flex: 1, height: '14px', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: isMax ? TOK.primary : TOK.primary40,
                          width: `${w}%`,
                          borderRadius: '0.25rem',
                        }} />
                      </div>
                      <span style={{
                        width: '52px',
                        textAlign: 'right',
                        ...T.dataTab,
                        color: isMax ? TOK.primary : TOK.white,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>{v.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 요일별 비중 */}
          {showWeeklyPct && (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>요일별 비중</h3>
                <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>유동인구 %</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {weeklyPctChart.labels.map((lab, i) => {
                  const v = weeklyPctChart.values[i] || 0;
                  const w = Math.max(2, Math.round((v / weeklyMax) * 100));
                  const isMax = i === weeklyMaxIdx;
                  const isWeekend = (lab === '토' || lab === '일');
                  const barColor = isMax ? TOK.primary : (isWeekend ? TOK.secondary : TOK.primary40);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '36px',
                        fontSize: '12px',
                        color: TOK.onSurface,
                        fontFamily: TOK.fontBody,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>{lab}</span>
                      <div style={{ flex: 1, height: '14px', background: TOK.surfaceContainer, borderRadius: '0.25rem', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: barColor,
                          width: `${w}%`,
                          borderRadius: '0.25rem',
                        }} />
                      </div>
                      <span style={{
                        width: '52px',
                        textAlign: 'right',
                        ...T.dataTab,
                        color: isMax ? TOK.primary : TOK.white,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>{v.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 섹션 3: 주중/주말 도넛 + 시간대별 사람 수 미니카드 ── */}
      {(showDonut || showHourlyAbs) && (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderBottom: `1px solid ${TOK.borderSubtle}` }}>
          {/* 주중/주말 도넛 */}
          {showDonut && (
            <div style={{
              padding: '24px',
              borderRight: showHourlyAbs ? `1px solid ${TOK.borderSubtle}` : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>주중 vs 주말</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ position: 'relative', width: '140px', height: '140px', flexShrink: 0 }}>
                  <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={TOK.surfaceContainer}
                      strokeWidth="3.5"
                    />
                    {/* 주중 (primary) */}
                    {wkdNorm > 0 && (
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={TOK.primary}
                        strokeDasharray={`${wkdNorm}, 100`}
                        strokeDashoffset="0"
                        strokeLinecap="butt"
                        strokeWidth="3.5"
                      />
                    )}
                    {/* 주말 (secondary) */}
                    {wkeNorm > 0 && (
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={TOK.secondary}
                        strokeDasharray={`${wkeNorm}, 100`}
                        strokeDashoffset={`-${wkdNorm}`}
                        strokeLinecap="butt"
                        strokeWidth="3.5"
                      />
                    )}
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: TOK.white, fontFamily: TOK.fontH1, lineHeight: 1 }}>{wkdNorm.toFixed(1)}%</span>
                    <span style={{ fontSize: '11px', color: TOK.onSurfaceVariant, marginTop: '4px' }}>주중</span>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TOK.primary }} />
                      <span style={{ ...T.bodySm, color: TOK.onSurface }}>주중 (월~금)</span>
                    </div>
                    <span style={{ ...T.dataTab, color: TOK.primary, fontWeight: 700, fontSize: '18px', marginLeft: '18px' }}>
                      {weekdayPct.toFixed(1)}%
                    </span>
                    {weekday > 0 && (
                      <span style={{ fontSize: '12px', color: TOK.onSurfaceVariant, marginLeft: '18px' }}>{fmtNum(weekday)}명/일</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TOK.secondary }} />
                      <span style={{ ...T.bodySm, color: TOK.onSurface }}>주말 (토~일)</span>
                    </div>
                    <span style={{ ...T.dataTab, color: TOK.secondary, fontWeight: 700, fontSize: '18px', marginLeft: '18px' }}>
                      {weekendPct.toFixed(1)}%
                    </span>
                    {weekend > 0 && (
                      <span style={{ fontSize: '12px', color: TOK.onSurfaceVariant, marginLeft: '18px' }}>{fmtNum(weekend)}명/일</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 시간대별 사람 수 미니카드 */}
          {showHourlyAbs && (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <h3 style={{ ...T.h2, fontSize: '18px', lineHeight: '28px', color: TOK.white, margin: 0 }}>시간대별 사람 수</h3>
                <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>일평균 (반경 500m)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: '8px' }}>
                {hourlyAbs.labels.map((lab, i) => {
                  const v = Number(hourlyAbs.values[i]) || 0;
                  return (
                    <div key={i} style={{
                      background: TOK.surfaceContainer,
                      border: `1px solid ${TOK.borderSubtle}`,
                      borderRadius: '0.5rem',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}>
                      <span style={{ fontSize: '11px', color: TOK.onSurfaceVariant, fontFamily: TOK.fontBody }}>{lab}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                        <span style={{ ...T.dataTab, color: TOK.white, fontWeight: 700, fontSize: '16px' }}>{fmtNum(v)}</span>
                        <span style={{ fontSize: '10px', color: TOK.onSurfaceVariant }}>명</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 섹션 4: 상위 유동인구 지역 + 방문 고객 ── */}
      {(showTopArea || showVisitors || showWdWePop) && (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ background: TOK.surfaceContainerLowest }}>
          {/* 상위 유동인구 지역 */}
          {showTopArea && (
            <div style={{
              padding: '24px',
              borderRight: (showVisitors || showWdWePop) ? `1px solid ${TOK.borderSubtle}` : 'none',
            }}>
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
                    <span className="material-symbols-outlined" style={{ color: TOK.primary, fontSize: '24px' }}>trending_up</span>
                  </div>
                  <div>
                    <p style={{ ...T.labelCaps, color: TOK.onSurfaceVariant, margin: '0 0 4px 0' }}>상위 유동인구 지역</p>
                    <p style={{ ...T.bodyLg, color: TOK.white, margin: 0, fontWeight: 600 }}>{topArea.name}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ ...T.h2, color: TOK.white, margin: 0, fontFamily: TOK.fontH1 }}>{fmtNum(topArea.pop)}</span>
                  <span style={{ ...T.bodySm, color: TOK.onSurfaceVariant }}>명/일</span>
                </div>
              </div>
            </div>
          )}

          {/* 방문고객 */}
          {(showVisitors || showWdWePop) && (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {showVisitors && (
                <div style={{
                  background: TOK.surfaceContainer,
                  border: `1px solid ${TOK.borderSubtle}`,
                  borderRadius: '0.75rem',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="material-symbols-outlined" style={{ color: TOK.secondary, fontSize: '20px' }}>person_check</span>
                    <p style={{ ...T.bodySm, color: TOK.onSurfaceVariant, margin: 0 }}>방문 고객 (일평균)</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ ...T.dataTab, color: TOK.white, fontWeight: 700, fontSize: '18px' }}>{fmtNum(visitors)}</span>
                    <span style={{ fontSize: '12px', color: TOK.onSurfaceVariant }}>명</span>
                  </div>
                </div>
              )}
              {showWdWePop && (
                <div style={{
                  background: TOK.surfaceContainer,
                  border: `1px solid ${TOK.borderSubtle}`,
                  borderRadius: '0.75rem',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: TOK.onSurfaceVariant }}>평일 일평균</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                      <span style={{ ...T.dataTab, color: TOK.primary, fontWeight: 700, fontSize: '16px' }}>{fmtNum(weekday)}</span>
                      <span style={{ fontSize: '10px', color: TOK.onSurfaceVariant }}>명</span>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    paddingLeft: '12px',
                    borderLeft: `1px solid ${TOK.borderSubtle}`,
                  }}>
                    <span style={{ fontSize: '11px', color: TOK.onSurfaceVariant }}>주말 일평균</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                      <span style={{ ...T.dataTab, color: TOK.secondary, fontWeight: 700, fontSize: '16px' }}>{fmtNum(weekend)}</span>
                      <span style={{ fontSize: '10px', color: TOK.onSurfaceVariant }}>명</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Card6FloatingPop;
