import React from 'react';

/**
 * OpenProcess - 6주 완성 오픈 프로세스 타임라인
 * 1주차부터 6주차까지 카페 오픈 과정을 보여주는 타임라인 카드
 */
const OpenProcess = ({ colors, sectionStyle, headingStyle, descStyle, ScrollReveal }) => {
  const ne = 'glass-card-light';

  // 중립 색상 (컬러 통일 - 테마 색상 미사용)
  const badgeBg = '#E8F0FE';
  const badgeText = '#3B6FB6';
  const weekColor = '#8B95A1';
  const labelColor = '#333D4B';
  const descColor = '#6B7684';

  // 6주 타임라인 데이터
  const timeline = [
    { week: '1주차', label: '집기 견적', desc: '매장 규모와 예산에 맞는 장비 리스트 작성 및 견적 비교' },
    { week: '2주차', label: '인테리어', desc: '콘셉트 설계, 도면 확정, 시공 착수' },
    { week: '3주차', label: '디자인', desc: '로고, 간판, 메뉴보드, 매장 내부 톤 맞춤 제작' },
    { week: '4주차', label: '메뉴 개발', desc: '시그니처 메뉴 구성, 레시피 제공, 원가 계산' },
    { week: '5주차', label: '운영 교육', desc: '에스프레소 추출, 우유 스팀, 경영/운영 실전 교육' },
    { week: '6주차', label: '매장 오픈', desc: '최종 점검, 시범 운영, 정식 오픈' },
  ];

  return (
    <div style={sectionStyle}>
      <ScrollReveal delay={0}>
        <p className="gradient-text" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>오픈 프로세스</p>
        <h2 style={headingStyle}>6주 완성</h2>
        <p style={descStyle}>체계적인 프로세스로 빠르고 확실하게</p>
      </ScrollReveal>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {timeline.map((item, index) => (
          <ScrollReveal key={index} delay={0.06 * index}>
            <div className={ne} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 14 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: badgeBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: badgeText }}>{index + 1}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: weekColor, marginBottom: 2 }}>{item.week}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: labelColor }}>{item.label}</div>
                <div style={{ fontSize: 12, color: descColor, marginTop: 3, lineHeight: 1.45 }}>{item.desc}</div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
};

export default OpenProcess;
