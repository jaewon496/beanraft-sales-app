import React from 'react';

/**
 * ComparisonCard - 프랜차이즈 vs 빈크래프트 구조 비교 (완전 리디자인)
 * Part A: 프랜차이즈 구조 (gray/red, 부정적 톤)
 * Part B: 빈크래프트 구조 (blue/green, 긍정적 톤)
 * Part C: 결론 CTA
 */
const ComparisonCard = ({ colors, sectionStyle, headingStyle, descStyle, ScrollReveal }) => {
  const { y, k } = colors;

  const franchiseSteps = [
    '매물 수색 요청 → 매출 확보된 매물 찾기',
    '중개사 배제하고 건물주와 직거래 시도',
    '수개월 소요 + 발품 + 에너지',
    '정보만 뺏기는 정보 먹튀',
  ];

  const beancraftSteps = [
    '기존 매물 그대로 거래',
    '중개사님 매물이기에 안전한 거래 조건',
    '고객이 원하는 매장을 직접 선택',
    '중개 수익 그대로 + 별도 파트너 수익',
  ];

  const numberBadge = (num, bgColor) => ({
    width: 28,
    height: 28,
    minWidth: 28,
    borderRadius: '50%',
    background: bgColor,
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    flexShrink: 0,
  });

  const cardBaseStyle = {
    borderRadius: 18,
    padding: '28px 22px',
    position: 'relative',
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={{ ...sectionStyle, position: 'relative', overflow: 'hidden' }}>
      <div className="bg-blob bg-blob-blue" style={{ width: 200, height: 200, top: '5%', right: '-10%', opacity: 0.1 }} />

      {/* 섹션 헤더 */}
      <ScrollReveal delay={0}>
        <p className="gradient-text" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>왜 빈크래프트인가</p>
        <h2 style={headingStyle}>구조가 다릅니다</h2>
        <p style={descStyle}>수수료가 적은 게 아니라, 하는 일이 다릅니다</p>
      </ScrollReveal>

      {/* Part A + B: 두 카드 (데스크톱: 나란히, 모바일: 세로 배치) */}
      <ScrollReveal delay={0.1}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginTop: 4,
        }}>

          {/* Part A: 프랜차이즈 구조 카드 */}
          <div
            className="glass-card-light"
            style={{
              ...cardBaseStyle,
              background: '#f8f9fa',
              borderLeft: '4px solid #e74c3c',
              minWidth: 280,
            }}
          >
            {/* 카드 헤더 */}
            <div style={{ marginBottom: 6 }}>
              <span style={{
                fontSize: 19,
                fontWeight: 800,
                color: '#555',
                letterSpacing: '-0.02em',
              }}>
                <span style={{ color: '#e74c3c' }}>●</span>{' '}프랜차이즈 구조
              </span>
            </div>

            {/* 부제 */}
            <p style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: '#999',
              fontStyle: 'italic',
              marginBottom: 20,
              paddingLeft: 2,
            }}>
              "매출로 영업합니다"
            </p>

            {/* 단계 리스트 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {franchiseSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={numberBadge(i + 1, '#B0B0B0')}>
                    {i + 1}
                  </div>
                  <p style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#777',
                    lineHeight: 1.55,
                    margin: 0,
                    paddingTop: 3,
                  }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>

            {/* 하단 결론 */}
            <div style={{
              marginTop: 22,
              paddingTop: 14,
              borderTop: '1px dashed #D5D5D5',
            }}>
              <p style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: '#e74c3c',
                margin: 0,
                lineHeight: 1.5,
              }}>
                본사의 일방적 요구 조건 + 계약 전 정보만 가로채는 구조
              </p>
            </div>
          </div>

          {/* Part B: 빈크래프트 구조 카드 */}
          <div
            className="glass-card-light"
            style={{
              ...cardBaseStyle,
              background: '#eef6ff',
              borderLeft: `4px solid ${k}`,
              boxShadow: '0 4px 20px rgba(30,100,200,0.08)',
              minWidth: 280,
            }}
          >
            {/* 카드 헤더 */}
            <div style={{ marginBottom: 6 }}>
              <span style={{
                fontSize: 19,
                fontWeight: 800,
                color: y,
                letterSpacing: '-0.02em',
              }}>
                <span style={{ color: k }}>●</span>{' '}빈크래프트 구조
              </span>
            </div>

            {/* 부제 */}
            <p style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: k,
              fontStyle: 'italic',
              marginBottom: 20,
              paddingLeft: 2,
            }}>
              "기존 매물에 추가하세요"
            </p>

            {/* 단계 리스트 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {beancraftSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={numberBadge(i + 1, k)}>
                    {i + 1}
                  </div>
                  <p style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: y,
                    lineHeight: 1.55,
                    margin: 0,
                    paddingTop: 3,
                  }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>

            {/* 하단 결론 */}
            <div style={{
              marginTop: 22,
              paddingTop: 14,
              borderTop: `1px dashed ${k}44`,
            }}>
              <p style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: '#2563eb',
                margin: 0,
                lineHeight: 1.5,
              }}>
                기존 업무 + 빈크래프트 = 추가 수익
              </p>
            </div>
          </div>

        </div>
      </ScrollReveal>

      {/* Part C: 결론 CTA */}
      <ScrollReveal delay={0.2}>
        <div style={{
          marginTop: 24,
          padding: '32px 20px',
          borderRadius: 18,
          background: `linear-gradient(135deg, ${k}, #1A6DD4)`,
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.4,
            marginBottom: 4,
            letterSpacing: '-0.02em',
          }}>
            빈 상가만 보여주던 시절은 끝났습니다.
          </p>
          <p style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.4,
            marginBottom: 12,
            letterSpacing: '-0.02em',
          }}>
            고객이 원하는걸 공간을 제안 해주는건 어떨까요?
          </p>
          <p style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.8)',
            lineHeight: 1.5,
            margin: 0,
          }}>
            단순히 매물을 보여주는 것과 협력 업체가 방문해 공간을 제안하는 건 계약 성사율부터 다릅니다.
          </p>
        </div>
      </ScrollReveal>
    </div>
  );
};

export default ComparisonCard;
