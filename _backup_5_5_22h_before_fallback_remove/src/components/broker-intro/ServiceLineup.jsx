import React from 'react';

/**
 * ServiceLineup - 개인 카페 전문 서비스 그리드
 * 빈크래프트가 제공하는 7가지 서비스 라인업을 표시합니다.
 * 상단 4개 + 하단 3개 배치
 */
const ServiceLineup = ({ colors, sectionStyle, headingStyle, descStyle, ScrollReveal }) => {
  const { y, k, M, L } = colors;
  const ne = 'glass-card-light';

  // 서비스 목록 (7개)
  const services = [
    { name: '인테리어', color: k, desc: '콘셉트 맞춤 설계 · 현장 관리 · 시공' },
    { name: '기기설치', color: '#6366F1', desc: '예산 맞춤 장비 구성 · 설치 · A/S' },
    { name: '메뉴개발', color: '#8B5CF6', desc: '레시피 제공 · 감각적인 메뉴 가이드' },
    { name: '원두공급', color: L, desc: '자체 로스팅 · 안정적 공급 시스템' },
    { name: '사후관리', color: '#F59E0B', desc: '오픈 후 정기 점검 · 운영 컨설팅' },
    { name: '운영교육', color: M, desc: '실전 중심 교육 · 관리자료 제공' },
    { name: '디자인', color: k, desc: '로고 · 간판 · 매장 톤 맞춤 제작' },
  ];

  const topRow = services.slice(0, 4);
  const bottomRow = services.slice(4, 7);

  const renderCard = (item, index) => (
    <ScrollReveal key={index} delay={0.05 * index}>
      <div className={ne} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 8px',
        borderRadius: 14,
        height: 110,
        minHeight: 110,
        flex: 1,
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: item.color,
          marginBottom: 10,
          boxShadow: `0 0 8px ${item.color}40`,
        }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: y }}>{item.name}</span>
        <span style={{
          fontSize: 12,
          color: '#8B95A1',
          marginTop: 4,
          textAlign: 'center',
          lineHeight: 1.3,
          minHeight: '2.5em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          alignContent: 'center',
        }}>{item.desc}</span>
      </div>
    </ScrollReveal>
  );

  return (
    <div style={sectionStyle}>
      <ScrollReveal delay={0}>
        <p className="gradient-text" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>서비스 라인업</p>
        <h2 style={headingStyle}>개인 카페 전문</h2>
        <p style={descStyle}>오직 개인 카페만을 위한 서비스</p>
      </ScrollReveal>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, gridAutoRows: '1fr' }}>
        {topRow.map((item, index) => renderCard(item, index))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8, gridAutoRows: '1fr' }}>
        {bottomRow.map((item, index) => renderCard(item, index + 4))}
      </div>
    </div>
  );
};

export default ServiceLineup;
