import React from 'react';

/**
 * Card 8 - 카페 기회 [2026-05-02 원본 단순 버전]
 *
 * 인허가 데이터 분석으로 발견형 사실만 표시.
 * AI 디렉터 캐릭터, 외부 매체 검색, 결론 짓는 단어, Tier/권리금/매물등록 모두 제거.
 * 영업자가 의뢰인 보면서 자기 입으로 멘트 만들도록 사실만 제공.
 */

const Card8OpportunityRisk = ({ card }) => {
  if (!card) return null;
  const findings = card?.bodyData?.findings || [];
  const dateLabel = card?.date || '';

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
          }}>{card.aiSummary}</p>
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
    </div>
  );
};

export default Card8OpportunityRisk;
