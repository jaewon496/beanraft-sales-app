import React from 'react';

/**
 * Card 8 - 카페 기회 [2026-05-02 원본 단순 버전]
 *
 * 인허가 데이터 분석으로 발견형 사실만 표시.
 * AI 디렉터 캐릭터, 외부 매체 검색, 결론 짓는 단어, Tier/권리금/매물등록 모두 제거.
 * 영업자가 의뢰인 보면서 자기 입으로 멘트 만들도록 사실만 제공.
 */

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

// 미니 SVG 라인 차트 (Card8 vacancySeries 추이용 - 다크모드 톤)
const VacancyMiniLine = ({ series = [], color = '#EF4444', baseLine = 10 }) => {
  if (!Array.isArray(series) || series.length < 2) return null;
  const values = series.map(s => Number(s.value) || 0);
  const periods = series.map(s => s.period || '');
  const w = 240, h = 50;
  const padX = 6, padY = 8;
  const baseLineNum = Number(baseLine);
  const hasBase = Number.isFinite(baseLineNum);
  const maxV = hasBase ? Math.max(...values, baseLineNum) : Math.max(...values);
  const minV = hasBase ? Math.min(...values, baseLineNum) : Math.min(...values);
  const range = (maxV - minV) || 1;
  const stepX = (w - padX * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = h - padY - ((v - minV) / range) * (h - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lastX = padX + (values.length - 1) * stepX;
  const last = values[values.length - 1];
  const ly = h - padY - ((last - minV) / range) * (h - padY * 2);
  const fmtPeriod = (p) => String(p || '').replace(/(\d{4})Q(\d)/, '$1·$2분기').replace(/(\d{4})(\d{2})/, '$1·$2월');
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 6, fontWeight: 500 }}>
        분기별 추이 (최근 {values.length}분기)
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="vac-mini-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 기준선 (10% 위험 임계) */}
        {hasBase && (() => {
          const by = h - padY - ((baseLineNum - minV) / range) * (h - padY * 2);
          return (
            <line x1={padX} y1={by} x2={w - padX} y2={by}
              stroke="#9CA3AF" strokeWidth="0.8" strokeDasharray="2.5,2" opacity="0.6" />
          );
        })()}
        <path d={`M ${padX},${h} L ${points.split(' ').join(' L ')} L ${lastX.toFixed(1)},${h} Z`} fill="url(#vac-mini-grad)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={ly} r="2.5" fill={color} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#666', marginTop: 2 }}>
        <span>{fmtPeriod(periods[0])}</span>
        <span>{fmtPeriod(periods[periods.length - 1])}</span>
      </div>
    </div>
  );
};

const Card8OpportunityRisk = ({ card, kosisBoxData = null }) => {
  if (!card) return null;
  const findings = card?.bodyData?.findings || [];
  const dateLabel = card?.date || '';

  // 한국부동산원 공실률 박스 (5% 미만=초록, 5~10%=노랑, 10% 이상=빨강)
  const vacancy = kosisBoxData?.vacancy || null;
  const vacancySeries = kosisBoxData?.vacancySeries?.series || [];
  let vacColor = '#10B981';
  let vacLabel = '기회 신호 - 활기찬 상권';
  let vacBg = 'rgba(16, 185, 129, 0.06)';
  let vacBorder = 'rgba(16, 185, 129, 0.4)';
  if (vacancy && vacancy.value != null) {
    if (vacancy.value >= 10) {
      vacColor = '#EF4444';
      vacLabel = '위험 신호 - 빈 점포 많음';
      vacBg = 'rgba(239, 68, 68, 0.06)';
      vacBorder = 'rgba(239, 68, 68, 0.4)';
    } else if (vacancy.value >= 5) {
      vacColor = '#F59E0B';
      vacLabel = '보통';
      vacBg = 'rgba(245, 158, 11, 0.06)';
      vacBorder = 'rgba(245, 158, 11, 0.4)';
    }
  }

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
    }}>
      {/* 헤더 */}
      <div style={{ padding: '24px', borderBottom: '1px solid #2D3748' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            background: 'rgba(59,130,246,0.2)',
            color: '#3B82F6',
            fontSize: 12, fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em',
          }}>08 카페 기회</span>
          {dateLabel && <span style={{ fontSize: 13, color: '#C2C6D6' }}>{dateLabel}</span>}
        </div>
        <h2 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 24, lineHeight: '32px', fontWeight: 600,
          color: '#fff', margin: 0,
        }}>이 동네 카페 데이터</h2>
      </div>

      {/* AI 한 줄 */}
      {card?.aiSummary && (
        <div style={{
          padding: '16px 24px',
          background: 'rgba(59,130,246,0.08)',
          borderBottom: '1px solid #2D3748',
        }}>
          <p style={{
            fontSize: 14, lineHeight: '20px',
            color: '#3B82F6', margin: 0,
            fontWeight: 500,
          }}>{card.aiSummary && sanitizeAiOutput(card.aiSummary)}</p>
        </div>
      )}

      {/* 발견 사실 표시 */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {findings.map((f, i) => (
          <div key={i} style={{
            background: '#1d2027',
            border: '1px solid #2D3748',
            borderLeft: '3px solid #10B981',
            borderRadius: '0.5rem',
            padding: '14px 16px',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: '#10B981',
              letterSpacing: '0.05em',
              marginBottom: 6,
              textTransform: 'uppercase',
            }}>{f.axis}</div>
            <p style={{
              fontSize: 16, lineHeight: '24px',
              color: '#fff', margin: 0,
              wordBreak: 'keep-all',
            }}>{f.text}</p>
          </div>
        ))}
      </div>

      {/* 신규 박스: 한국부동산원 공실률 */}
      {vacancy && vacancy.value != null && (
        <div style={{ padding: '20px 24px', borderTop: '1px solid #2D3748' }}>
          <div style={{
            background: vacBg,
            border: '1px solid ' + vacBorder,
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              이 상권 빈 점포 비율 (한국부동산원)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: vacColor, lineHeight: 1.1 }}>
                {Number(vacancy.value).toFixed(1)}
              </span>
              <span style={{ fontSize: 14, color: '#C2C6D6' }}>% 공실률</span>
            </div>
            <div style={{ fontSize: 12, color: vacColor, fontWeight: 600, marginTop: 2 }}>
              {vacLabel}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 6, textAlign: 'right' }}>
              {(vacancy.region || '시도 평균')}{vacancy.scope === '시도평균' ? ' (시도 평균)' : ''} 기준
              {vacancy.period ? ' · ' + vacancy.period : ''}
            </div>
            {/* 12분기 공실률 추이 미니 차트 */}
            {vacancySeries.length >= 2 && (
              <VacancyMiniLine series={vacancySeries} color={vacColor} baseLine={10} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Card8OpportunityRisk;
