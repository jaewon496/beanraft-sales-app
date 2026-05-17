import React from 'react';

/**
 * FeeTable - 수수료 안내 (가로 바 차트)
 * 카테고리별 수수료를 직관적인 바 차트로 표시
 */
const FeeTable = ({ colors, sectionStyle, headingStyle, descStyle, ScrollReveal }) => {
  const { y, j, k, T } = colors;

  const feeItems = [
    { label: '전체 패키지', amount: '100만 원', widthPercent: 100, delay: 0.1 },
    { label: '인테리어', amount: '견적의 1%', widthPercent: 65, delay: 0.2 },
    { label: '기기설치', amount: '견적의 1%', widthPercent: 65, delay: 0.3 },
    { label: '메뉴 개발', amount: '40만 원', widthPercent: 40, delay: 0.4 },
    { label: '원두 공급', amount: '40만 원', widthPercent: 40, delay: 0.5 },
  ];

  return (
    <div style={sectionStyle}>
      <ScrollReveal delay={0}>
        <p className="gradient-text" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>수수료 안내</p>
        <h2 style={headingStyle}>카테고리별 수수료</h2>
        <p style={descStyle}>명확하고 투명한 정산 기준</p>
      </ScrollReveal>

      {/* 바 차트 */}
      <div style={{
        borderRadius: 18,
        padding: '20px 18px',
        background: '#fff',
        border: `1px solid ${T}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {feeItems.map((item, index) => (
          <ScrollReveal key={index} delay={item.delay}>
            <div>
              {/* 라벨 + 금액 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 8,
              }}>
                <span style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: y,
                }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: k,
                }}>
                  {item.amount}
                </span>
              </div>
              {/* 바 */}
              <div style={{
                width: '100%',
                height: 12,
                borderRadius: 6,
                background: '#F0F0F0',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${item.widthPercent}%`,
                  height: '100%',
                  borderRadius: 6,
                  background: `linear-gradient(90deg, ${k}, #5BA4FC)`,
                  transition: 'width 0.8s ease-out',
                }} />
              </div>
            </div>
          </ScrollReveal>
        ))}

        {/* 하단 안내 */}
        <div style={{
          marginTop: 4,
          paddingTop: 14,
          borderTop: `1px solid ${T}`,
          textAlign: 'center',
        }}>
          <span style={{
            fontSize: 13,
            color: j,
            fontWeight: 500,
          }}>
            계약일 기준 3영업일 이내 입금
          </span>
        </div>
      </div>
    </div>
  );
};

export default FeeTable;
