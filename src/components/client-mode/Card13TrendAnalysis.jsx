import React, { useState } from 'react';

// ─── AI Output Sanitizer (mirrors Card01MarketReport.jsx) ───
const sanitizeAiOutput = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\b_[a-zA-Z][a-zA-Z0-9_]*\b/g, '')
    .replace(/\[[^\]]*지시사항[^\]]*\]/g, '')
    .replace(/\[[^\]]*톤 지침[^\]]*\]/g, '')
    .replace(/\[[^\]]*필수 생성 규칙[^\]]*\]/g, '')
    .replace(/\[[^\]]*출력 금지 규칙[^\]]*\]/g, '')
    .replace(/\[[^\]]*현장 보정[^\]]*\]/g, '')
    .replace(/\|[-:]+\|[-:|\s]+/g, '')
    .replace(/^#{2,3}\s+.*$/gm, '')
    .replace(/buildCardPrompt/g, '')
    .replace(/AI_CHARACTER_PROMPT/g, '')
    .replace(/bruFeedback/g, '')
    .replace(/bruSummary/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/**
 * Card 13 - 상권 변화 추이 [2026-05-06 외부 지표 섹션 제거 - 카드 12 점수 가산으로 이관]
 *
 * 4개 섹션:
 * 1) 최근 1년 변화 (개업/폐업/순증감)
 * 2) 5년 전 vs 지금
 * 3) 생존 가능성 + 평균 영업기간 (반원형 게이지)
 * 4) 시계열 그래프 (점포수 추이 + 월별 신규/폐업)
 *
 * 카드 12 디자인 톤 일치 (다크모드).
 */

// ── 반원형 게이지 (생존율, 0~100%) ──
const SurvivalGauge = ({ score = 0, label = '', sublabel = '' }) => {
  const s = Math.min(Math.max(Number(score) || 0, 0), 100);
  const cx = 80, cy = 60, r = 44;
  const startAngle = Math.PI, endAngle = 2 * Math.PI;
  const totalAngle = endAngle - startAngle;
  const describeArc = (sA, eA) => {
    const x1 = cx + r * Math.cos(sA), y1 = cy + r * Math.sin(sA);
    const x2 = cx + r * Math.cos(eA), y2 = cy + r * Math.sin(eA);
    return `M ${x1},${y1} A ${r},${r} 0 ${(eA - sA) > Math.PI ? 1 : 0} 1 ${x2},${y2}`;
  };
  const filledEnd = startAngle + (s / 100) * totalAngle;
  const color = s >= 70 ? '#10B981' : s >= 50 ? '#3B82F6' : s >= 30 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <svg width="100%" height="84" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet">
        <path d={describeArc(startAngle, endAngle)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} strokeLinecap="round" />
        <path d={describeArc(startAngle, filledEnd)} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize={20} fontWeight={800} fontFamily="'Pretendard', sans-serif">
          {s}<tspan fontSize={10} fill="#999">%</tspan>
        </text>
      </svg>
      <div style={{ fontSize: 12, color: '#C2C6D6', fontWeight: 600, marginTop: -2 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{sublabel}</div>}
    </div>
  );
};

// ── 점포수 추이 막대 차트 (호버 툴팁) ──
const StoreTrendChart = ({ labels = [], values = [], title = '' }) => {
  const [hoverIdx, setHoverIdx] = useState(-1);
  if (!Array.isArray(values) || values.length === 0) return null;
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  return (
    <div style={{ background: '#1d2027', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 14 }}>단위: 개 (점포수)</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110, padding: '4px 0', position: 'relative' }}>
        {values.map((v, i) => {
          const h = Math.max(8, Math.round(((v - minVal) / range) * 80) + 18);
          const isHover = hoverIdx === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(-1)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
            >
              <div style={{ fontSize: 10, color: isHover ? '#fff' : '#C2C6D6', fontWeight: 700, marginBottom: 2 }}>{v}</div>
              <div style={{
                width: '85%', height: h,
                background: isHover ? '#60A5FA' : '#3B82F6',
                borderRadius: 4,
                transition: 'all 0.2s',
                boxShadow: isHover ? '0 0 12px rgba(96,165,250,0.5)' : 'none',
              }} />
              {isHover && (
                <div style={{
                  position: 'absolute', top: -34,
                  background: '#0f1218', color: '#fff',
                  fontSize: 11, fontWeight: 600,
                  padding: '4px 8px', borderRadius: 6,
                  border: '1px solid #2D3748', whiteSpace: 'nowrap', zIndex: 5,
                }}>{labels[i]}: {v}개</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, fontSize: 10, color: '#999', textAlign: 'center' }}>{l}</div>
        ))}
      </div>
    </div>
  );
};

// ── 월별 신규/폐업 이중 막대 차트 ──
const OpenCloseChart = ({ data = [], title = '' }) => {
  const [hoverIdx, setHoverIdx] = useState(-1);
  if (!Array.isArray(data) || data.length === 0) return null;
  const maxVal = Math.max(...data.flatMap(d => [d.opened || 0, d.closed || 0]), 1);
  return (
    <div style={{ background: '#1d2027', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{title}</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#999' }}>
            <span style={{ width: 8, height: 8, background: '#10B981', borderRadius: 2, display: 'inline-block' }} />신규
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#999' }}>
            <span style={{ width: 8, height: 8, background: '#EF4444', borderRadius: 2, display: 'inline-block' }} />폐업
          </span>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 14 }}>단위: 개</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, padding: '4px 0', position: 'relative' }}>
        {data.map((d, i) => {
          const opened = d.opened || 0;
          const closed = d.closed || 0;
          const hO = Math.max(2, Math.round((opened / maxVal) * 80));
          const hC = Math.max(2, Math.round((closed / maxVal) * 80));
          const isHover = hoverIdx === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(-1)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
            >
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 90 }}>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#10B981', fontWeight: 700 }}>{opened}</span>
                  <div style={{ width: 12, height: hO, background: '#10B981', borderRadius: 2 }} />
                </div>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#EF4444', fontWeight: 700 }}>{closed}</span>
                  <div style={{ width: 12, height: hC, background: '#EF4444', borderRadius: 2 }} />
                </div>
              </div>
              {isHover && (
                <div style={{
                  position: 'absolute', top: -42,
                  background: '#0f1218', color: '#fff',
                  fontSize: 11, fontWeight: 600,
                  padding: '4px 8px', borderRadius: 6,
                  border: '1px solid #2D3748', whiteSpace: 'nowrap', zIndex: 5,
                }}>
                  {d.period}<br />신규 {opened} / 폐업 {closed} (순 {d.net >= 0 ? '+' : ''}{d.net})
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, fontSize: 10, color: '#999', textAlign: 'center' }}>{d.period}</div>
        ))}
      </div>
    </div>
  );
};

// ── 시도 카페 폐업 11년 추이 (빨강 톤 막대 차트) ──
const ClosureTrendChart = ({ series = [], title = '', regionLabel = '' }) => {
  const [hoverIdx, setHoverIdx] = useState(-1);
  if (!Array.isArray(series) || series.length === 0) return null;
  const values = series.map(s => Number(s.value) || 0);
  const labels = series.map(s => (s.year || s.period || '').slice(-2));
  const fullLabels = series.map(s => (s.year || s.period || ''));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  const latest = values[values.length - 1];
  const earliest = values[0];
  const totalChange = earliest > 0 ? Math.round((latest - earliest) / earliest * 1000) / 10 : 0;
  return (
    <div style={{ background: '#1d2027', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{title}</div>
        {totalChange !== 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: totalChange > 0 ? '#EF4444' : '#10B981',
            background: totalChange > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
            padding: '2px 8px', borderRadius: 10,
          }}>
            11년 {totalChange > 0 ? '+' : ''}{totalChange}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 12 }}>
        단위: 곳 {regionLabel ? ` · ${regionLabel}` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, padding: '4px 0', position: 'relative' }}>
        {values.map((v, i) => {
          const h = Math.max(6, Math.round(((v - minVal) / range) * 75) + 15);
          const isHover = hoverIdx === i;
          const isLatest = i === values.length - 1;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(-1)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
            >
              <div style={{
                width: '85%', height: h,
                background: isHover ? '#F87171' : (isLatest ? '#EF4444' : 'rgba(239,68,68,0.55)'),
                borderRadius: 3,
                transition: 'all 0.2s',
                boxShadow: isHover ? '0 0 10px rgba(248,113,113,0.5)' : 'none',
              }} />
              {isHover && (
                <div style={{
                  position: 'absolute', top: -32,
                  background: '#0f1218', color: '#fff',
                  fontSize: 11, fontWeight: 600,
                  padding: '4px 8px', borderRadius: 6,
                  border: '1px solid #2D3748', whiteSpace: 'nowrap', zIndex: 5,
                }}>{fullLabels[i]}년: {v.toLocaleString('ko-KR')}곳</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {labels.map((l, i) => (
          <div key={i} style={{
            flex: 1, fontSize: 9,
            color: i === labels.length - 1 ? '#EF4444' : '#999',
            textAlign: 'center', fontWeight: i === labels.length - 1 ? 700 : 400,
          }}>{l}</div>
        ))}
      </div>
    </div>
  );
};

const Card13TrendAnalysis = ({ card, cardNumber = '13', kosisBoxData = null }) => {
  if (!card) return null;
  const body = card.bodyData || {};
  const dateLabel = card?.date || '';

  // ── 섹션 1 데이터 ──
  const openCount = body.openCount || 0;
  const closeCount = body.closeCount || 0;
  const netChange = body.netChange != null ? body.netChange : (openCount - closeCount);
  const trend = body.trend || '';
  const showTrendChip = !!trend && trend !== '-';
  const closeSource = body.closeCountSource || 'none';
  const trendColor = trend === '성장' ? '#10B981' : trend === '쇠퇴' ? '#EF4444' : '#F59E0B';

  // ── 섹션 2 ──
  const cafesNow = body.cafesNow || 0;
  const cafes5yAgo = body.cafes5yAgo || 0;
  const cafes5yChangeRate = body.cafes5yChangeRate || 0;
  const has5yData = cafes5yAgo > 0 || cafesNow > 0;

  // ── 섹션 3 ──
  const sr1 = body.survivalRate1y || 0;
  const sr3 = body.survivalRate3y || 0;
  const sr5 = body.survivalRate5y || 0;
  const avgYears = body.avgOperatingYears || 0;
  const survivalInsight = body.survivalInsight || '';

  // ── 섹션 4 ──
  const trendChart = body.bizmapStoreTrendChart;
  const monthlyList = Array.isArray(body.monthlyChangeList) ? body.monthlyChangeList : [];
  const hasTrendChart = trendChart && Array.isArray(trendChart.values) && trendChart.values.length > 0;
  // 시도 카페 폐업 11년 추이 (kosisExternalSeries)
  const closureSeries = kosisBoxData?.cafeClosureSeries || null;

  // ── 섹션 5: 비즈맵 메뉴 (카드 4→3 이관) ──
  const popularMenus = Array.isArray(body.popularMenus) ? body.popularMenus.filter(m => m && m.name) : [];
  const risingMenus = Array.isArray(body.risingMenus) ? body.risingMenus.filter(m => m && m.name) : [];
  const showMenuSection = popularMenus.length > 0 || risingMenus.length > 0;
  const fmtPrice = (n) => {
    const v = Number(n) || 0;
    if (v <= 0) return '';
    return v.toLocaleString('ko-KR') + '원';
  };

  return (
    <div style={{
      background: '#1A1F2C',
      border: '1px solid #2D3748',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      color: '#E1E2EC',
      fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      width: '100%',
      position: 'relative',
    }}>
      {/* 헤더 — 다른 카드(CardTemplate)와 동일한 표기 패턴 */}
      <div style={{ padding: '24px', borderBottom: '1px solid #2D3748', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 'clamp(12px, 1vw, 14px)',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.08em',
              fontFeatureSettings: '"tnum"',
            }}>{cardNumber}</span>
            <h3 style={{
              margin: 0,
              fontSize: 'clamp(20px, 2vw, 26px)',
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: '-0.01em',
              color: '#fff',
            }}>{card.title || '상권 변화 추이'}</h3>
          </div>
          {card.subtitle && (
            <p style={{
              margin: '8px 0 0',
              fontSize: 'clamp(12px, 1vw, 14px)',
              color: '#C2C6D6',
              fontWeight: 400,
            }}>{card.subtitle}</p>
          )}
        </div>
        {dateLabel && (
          <span style={{
            fontSize: 11,
            color: '#C2C6D6',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            paddingTop: 4,
          }}>{dateLabel}</span>
        )}
      </div>

      {/* AI 요약 */}
      {card?.aiSummary && (
        <div style={{
          padding: '14px 24px',
          background: 'rgba(16,185,129,0.08)',
          borderBottom: '1px solid #2D3748',
        }}>
          <p style={{
            fontSize: 13, lineHeight: '20px',
            color: '#10B981', margin: 0, fontWeight: 500,
          }}>{card.aiSummary && sanitizeAiOutput(card.aiSummary)}</p>
        </div>
      )}

      {/* ──────── 섹션 1: 최근 1년 변화 ──────── */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #2D3748' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', letterSpacing: '0.04em' }}>최근 1년 변화</div>
          {showTrendChip && (
            <span style={{
              fontSize: 12, fontWeight: 700, color: '#fff',
              background: trendColor,
              padding: '3px 12px', borderRadius: 20,
              letterSpacing: '0.05em',
            }}>{trend}</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ background: '#1d2027', borderRadius: 12, padding: '16px 12px', textAlign: 'center', borderTop: '3px solid #10B981' }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 6, fontWeight: 500 }}>신규 개업</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#10B981', lineHeight: 1 }}>{openCount}<span style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>개</span></div>
          </div>
          <div style={{ background: '#1d2027', borderRadius: 12, padding: '16px 12px', textAlign: 'center', borderTop: '3px solid #EF4444' }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 6, fontWeight: 500 }}>폐업</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#EF4444', lineHeight: 1 }}>{closeCount}<span style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>개</span></div>
          </div>
          <div style={{ background: '#1d2027', borderRadius: 12, padding: '16px 12px', textAlign: 'center', borderTop: `3px solid ${trendColor}` }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 6, fontWeight: 500 }}>순증감</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: trendColor, lineHeight: 1 }}>{netChange >= 0 ? '+' : ''}{netChange}<span style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>개</span></div>
          </div>
        </div>
        {closeSource === 'localdata' && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#666', textAlign: 'right' }}>
            폐업 수치: 행정 인허가 데이터 기준
          </div>
        )}
      </div>

      {/* ──────── 섹션 2: 5년 전 vs 지금 (항상 노출 - dataMapper 폴백 보장) ──────── */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #2D3748' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', letterSpacing: '0.04em', marginBottom: 12 }}>5년 전 vs 지금</div>
        {(
          <div style={{ background: '#1d2027', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>5년 전</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#94A3B8', lineHeight: 1 }}>{cafes5yAgo}<span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>개</span></div>
              </div>
              <div style={{ fontSize: 24, color: '#555' }}>→</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>현재</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{cafesNow}<span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>개</span></div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>변화율</div>
                <div style={{
                  fontSize: 22, fontWeight: 800, lineHeight: 1,
                  color: cafes5yChangeRate >= 0 ? '#10B981' : '#EF4444',
                }}>{cafes5yChangeRate >= 0 ? '+' : ''}{cafes5yChangeRate}<span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>%</span></div>
              </div>
            </div>
            {/* 시각화 막대 비교 */}
            {(cafes5yAgo > 0 && cafesNow > 0) && (() => {
              const max = Math.max(cafes5yAgo, cafesNow);
              const wPast = (cafes5yAgo / max) * 100;
              const wNow = (cafesNow / max) * 100;
              return (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>5년 전</div>
                    <div style={{ height: 8, background: '#0f1218', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${wPast}%`, height: '100%', background: '#94A3B8', borderRadius: 4 }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>현재</div>
                    <div style={{ height: 8, background: '#0f1218', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${wNow}%`, height: '100%',
                        background: cafes5yChangeRate >= 0 ? '#10B981' : '#EF4444',
                        borderRadius: 4,
                      }} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ──────── 섹션 3: 생존 가능성 + 평균 영업기간 (항상 노출 - dataMapper 폴백 보장) ──────── */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #2D3748' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', letterSpacing: '0.04em', marginBottom: 12 }}>생존 가능성 + 평균 영업기간</div>
        {(
          <>
            <div style={{ background: '#1d2027', borderRadius: 12, padding: 14, display: 'flex', gap: 8, marginBottom: 12 }}>
              <SurvivalGauge score={sr1} label="1년 생존율" />
              <SurvivalGauge score={sr3} label="3년 생존율" />
              <SurvivalGauge score={sr5} label="5년 생존율" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: avgYears > 0 ? '1fr 1.4fr' : '1fr', gap: 10 }}>
              {avgYears > 0 && (
                <div style={{
                  background: '#1d2027', borderRadius: 12,
                  padding: '14px 16px', textAlign: 'center',
                  borderLeft: '3px solid #8B5CF6',
                }}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>평균 영업기간</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{avgYears}<span style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>년</span></div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>평균 {avgYears}년 영업</div>
                </div>
              )}
              {survivalInsight && (
                <div style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 12, lineHeight: 1.6,
                  color: '#C2C6D6',
                  display: 'flex', alignItems: 'center',
                }}>{survivalInsight}</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ──────── 섹션 4: 시계열 그래프 ──────── */}
      {/* 빈 박스 금지: 점포수 추이가 있으면 노출, 없으면 시도 폐업 추이로 대체 */}
      {/* 폐업 시계열은 2개 이상일 때만 차트로 노출 (1개 이하는 추이가 안됨) */}
      {(hasTrendChart || monthlyList.length > 0 || (closureSeries && closureSeries.series && closureSeries.series.length >= 2)) && (
        <div style={{ padding: '20px 24px', borderBottom: showMenuSection ? '1px solid #2D3748' : 'none' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', letterSpacing: '0.04em', marginBottom: 12 }}>시계열 추이</div>
          {hasTrendChart && (
            <StoreTrendChart labels={trendChart.labels} values={trendChart.values} title="월별 카페 점포수 추이" />
          )}
          {monthlyList.length > 0 && (
            <OpenCloseChart data={monthlyList} title="월별 신규/폐업 카페 수" />
          )}
          {closureSeries && closureSeries.series && closureSeries.series.length >= 2 && (
            <ClosureTrendChart
              series={closureSeries.series}
              title={`시도 카페 폐업 ${closureSeries.series.length}년 추이 (국세청)`}
              regionLabel={closureSeries.region || ''}
            />
          )}
        </div>
      )}

      {/* ──────── 섹션 5: 메뉴 변화 (비즈맵) ──────── */}
      {/* 빈 값 숨김: popularMenus 비면 좌측 박스 X, risingMenus 비면 우측 박스 X, 둘 다 비면 섹션 전체 X */}
      {showMenuSection && (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C2C6D6', letterSpacing: '0.04em', marginBottom: 12 }}>메뉴 변화</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: (popularMenus.length > 0 && risingMenus.length > 0) ? '1fr 1fr' : '1fr',
            gap: 12,
          }}>
            {/* 좌측: 가장 많이 팔리는 메뉴 (popularMenus가 있을 때만 렌더) */}
            {popularMenus.length > 0 && (
              <div style={{
                background: '#1d2027',
                borderRadius: 12,
                padding: 14,
                borderTop: '3px solid #3B82F6',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#C2C6D6' }}>가장 많이 팔리는 메뉴</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {popularMenus.map((m, i) => (
                    <div key={i} style={{
                      background: '#0f1218',
                      borderRadius: 8,
                      padding: '10px 12px',
                      borderLeft: i === 0 ? '3px solid #3B82F6' : '3px solid rgba(59,130,246,0.3)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                          <span style={{ color: '#666', marginRight: 6 }}>{i + 1}.</span>{m.name}
                        </div>
                        {m.salesRate > 0 && (
                          <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 700 }}>
                            {m.salesRate.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      {m.avgPrice > 0 && (
                        <div style={{ fontSize: 11, color: '#999' }}>
                          평균 <span style={{ color: '#fff', fontWeight: 600 }}>{fmtPrice(m.avgPrice)}</span>
                          {(m.minPrice > 0 && m.maxPrice > 0) && (
                            <span style={{ color: '#666', marginLeft: 6 }}>
                              ({fmtPrice(m.minPrice)}~{fmtPrice(m.maxPrice)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 우측: 전월대비 인기 급상승 (risingMenus가 있을 때만 렌더) */}
            {risingMenus.length > 0 && (
              <div style={{
                background: '#1d2027',
                borderRadius: 12,
                padding: 14,
                borderTop: '3px solid #F59E0B',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#C2C6D6' }}>전월대비 인기 급상승</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {risingMenus.map((m, i) => (
                    <div key={i} style={{
                      background: '#0f1218',
                      borderRadius: 8,
                      padding: '10px 12px',
                      borderLeft: i === 0 ? '3px solid #F59E0B' : '3px solid rgba(245,158,11,0.3)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                          <span style={{ color: '#666', marginRight: 6 }}>{i + 1}.</span>{m.name}
                        </div>
                        {m.growthRate !== 0 && (
                          <div style={{ fontSize: 11, color: m.growthRate >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                            {m.growthRate >= 0 ? '+' : ''}{m.growthRate.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      {m.avgPrice > 0 && (
                        <div style={{ fontSize: 11, color: '#999' }}>
                          평균 <span style={{ color: '#fff', fontWeight: 600 }}>{fmtPrice(m.avgPrice)}</span>
                          {(m.minPrice > 0 && m.maxPrice > 0) && (
                            <span style={{ color: '#666', marginLeft: 6 }}>
                              ({fmtPrice(m.minPrice)}~{fmtPrice(m.maxPrice)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 한국부동산원 + 행정 인허가 변동 박스 2개
          [2026-05-12] regionClosure가 KOSIS DT_133001N_9816 응답 인코딩 문제로 시군구 매칭 불가 → LOCALDATA 카페 폐업 수(closeCount)로 대체.
          폐업자 수(명, 전국 시도 합) 대신 이 상권 카페 폐업 수(개)를 표시. 더 정확하고 의미 명확. */}
      {(closeCount > 0 || kosisBoxData?.priceChange) && (() => {
        const rc = closeCount > 0 ? { value: closeCount, region: '이 동', period: '최근 1년' } : null;
        const pc = kosisBoxData?.priceChange;
        const rcRegion = rc?.region || '이 동';
        const rcPeriod = rc?.period || '';
        const rcPeriodLabel = rcPeriod;
        const pcVal = pc?.value;
        const pcUp = pcVal != null && pcVal > 0;
        const pcDown = pcVal != null && pcVal < 0;
        const pcColor = pcUp ? '#EF4444' : pcDown ? '#3B82F6' : '#C2C6D6';
        const pcArrow = pcUp ? '↑' : pcDown ? '↓' : '–';
        const pcSign = pcUp ? '+' : '';
        const pcRegion = pc?.region || '';
        const pcPeriod = pc?.period || '';
        const pcPeriodLabel = /^\d{4}Q\d$/.test(pcPeriod) ? `${pcPeriod.slice(0,4)} ${pcPeriod.slice(5)}분기` : pcPeriod;
        return (
          <div style={{ padding: '20px 24px', borderTop: '1px solid #2D3748' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {rc && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 12,
                  padding: '16px 16px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ fontSize: 12, color: '#C2C6D6', fontWeight: 500 }}>이 동 카페 폐업 (1년)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444', lineHeight: 1.1 }}>
                    {rc.value.toLocaleString('ko-KR')}<span style={{ fontSize: 12, color: '#C2C6D6', marginLeft: 4, fontWeight: 400 }}>개</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                    행정 인허가 · {rcRegion} · {rcPeriodLabel}
                  </div>
                </div>
              )}
              {pcVal != null && (
                <div style={{
                  background: pcUp ? 'rgba(239, 68, 68, 0.06)' : 'rgba(59, 130, 246, 0.06)',
                  border: `1px solid ${pcUp ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                  borderRadius: 12,
                  padding: '16px 16px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ fontSize: 12, color: '#C2C6D6', fontWeight: 500 }}>임대가격 1년 변동</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: pcColor, lineHeight: 1.1 }}>
                    <span style={{ marginRight: 4 }}>{pcArrow}</span>
                    {pcSign}{pcVal}<span style={{ fontSize: 12, color: '#C2C6D6', marginLeft: 4, fontWeight: 400 }}>%</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                    한국부동산원 · {pcRegion || '시도 평균'} · {pcPeriodLabel}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Card13TrendAnalysis;
