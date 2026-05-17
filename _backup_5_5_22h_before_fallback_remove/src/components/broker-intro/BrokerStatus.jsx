import React from 'react';
import ScrollReveal from './ScrollReveal';

/**
 * BrokerStatus - 중개사 현황 섹션
 * 지도 + 수집/협력 중개사 카운트 + 영업관리 설명
 */
const BrokerStatus = ({ colors, sectionStyle, headingStyle, descStyle, companies, BrokerMapSection, brokerCount = 17534 }) => {
  const { y, j, k } = colors;
  const ne = 'glass-card-light';

  return (
    <div style={sectionStyle}>
      <ScrollReveal delay={0}>
        <p className="gradient-text" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>중개사 현황</p>
        <h2 style={headingStyle}>중개사 현황</h2>
        <p style={descStyle}>현재 빈크래프트와 함께하는 중개사 현황입니다</p>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div className={ne} style={{ flex: 1, borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: j, marginBottom: 4 }}>수집 중개사</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: y }}>{brokerCount.toLocaleString()}</p>
          </div>
          <div className={ne} style={{ flex: 1, borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: j, marginBottom: 4 }}>관리 업체</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: k }}>{(companies?.length || 0).toLocaleString()}</p>
          </div>
        </div>
        <BrokerMapSection dark={false} companies={companies} realtorCount={companies?.length || 0} />
      </ScrollReveal>

      <ScrollReveal delay={0.2}>
        <div className={ne} style={{ borderRadius: 18, padding: '14px 16px', marginTop: 10 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: y, marginBottom: 6, lineHeight: 1.5 }}>
            빈크래프트는 자체 개발한 영업관리 프로그램을 통해 전국의 중개사분들과 실시간으로 소통하고 있습니다.
          </p>
          <p style={{ fontSize: 15, color: j, lineHeight: 1.7, marginBottom: 8 }}>
            앞으로도 더 많은 중개사분들과 함께하며, 투명하고 실질적인 거래를 만들어가겠습니다. 매물을 다양하게 보유하고 계신 중개사분들을 대상으로 우선 제안을 드리고 있습니다.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: k, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: k }}>자체 개발 영업관리 시스템 운영 중</span>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
};

export default BrokerStatus;
