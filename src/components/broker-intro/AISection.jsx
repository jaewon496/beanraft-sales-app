import React from 'react';
import ScrollReveal from './ScrollReveal';

/**
 * AISection - AI 활용 섹션
 * PhoneMockupCarousel + 5개 데이터 기능 항목 + 6개 리포트 태그 + CTA
 */
const AISection = ({ colors, sectionStyle, headingStyle, descStyle, PhoneMockupCarousel }) => {
  const { y, j, k, N, L, M } = colors;
  const ne = 'glass-card-light';
  const te = '#F2F4F6';

  // 카테고리별 수집 데이터 (그룹화하여 깔끔하게 표시)
  const dataCategories = [
    {
      category: '공공 빅데이터 연동',
      color: k,
      items: [
        { label: '유동인구', desc: '시간대·요일별 실측 데이터' },
        { label: '매출 추정', desc: '매장별 90% 정확도 추정' },
        { label: '업종 밀집도', desc: '경쟁 강도·포화도 분석' },
        { label: '개폐업 현황', desc: '개업·폐업 추이·생존율' },
        { label: '연령별 소비', desc: '연령대별 소비 금액·빈도' },
        { label: '임대 시세', desc: '평균 임대료·보증금·평당 단가' },
      ],
    },
    {
      category: '실시간 수집 + 분석',
      color: L,
      items: [
        { label: '카페 전수 조사', desc: '반경 500m 리뷰·평점·영업시간·가격대' },
        { label: '프랜차이즈 분리', desc: '프랜차이즈·개인카페 구분 분석' },
        { label: '폐업 자동 판별', desc: '미등록 업체 감지·실시간 검증' },
      ],
    },
    {
      category: 'AI 매출 추정 엔진',
      color: '#6366F1',
      items: [
        { label: '다층 추정 알고리즘', desc: '4단계 레이어로 매장별 매출 산출' },
        { label: '프랜차이즈 DB', desc: '19개 브랜드 정보공개서 기반 보정' },
        { label: '6개 리포트', desc: '상권개요·연령·프랜차이즈·개인카페·매출·AI종합' },
      ],
    },
  ];

  // 6개 리포트 태그
  const reportTags = [
    { name: '상권 개요', color: k },
    { name: '연령 분석', color: '#6366F1' },
    { name: '프랜차이즈', color: '#F59E0B' },
    { name: '개인카페', color: L },
    { name: '매출 추정', color: M },
    { name: 'AI 종합평가', color: '#8B5CF6' },
  ];

  // 경쟁 우위 항목
  const advantages = [
    {
      label: '52개 API 동시 수집·분석',
      desc: '공공 빅데이터 + 실시간 웹 수집 + AI 매출 추정까지 한 번에',
      color: '#6366F1',
    },
    {
      label: '전국 단위 실시간 분석',
      desc: '17개 시·도 어디서든 지역명 입력 하나로 3분 내 전문 리포트 생성',
      color: '#F59E0B',
    },
  ];

  return (
    <div style={{ ...sectionStyle, position: 'relative', overflow: 'hidden' }}>
      <div className="bg-blob bg-blob-blue" style={{ width: 220, height: 220, bottom: '5%', right: '-12%', opacity: 0.1 }} />

      <ScrollReveal delay={0}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="gradient-text" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, display: 'block' }}>자체 개발 시스템</span>
            <h2 style={{ ...headingStyle, marginBottom: 6, fontSize: 30 }}>
              정밀 상권<br/>분석 엔진
            </h2>
            <p style={{ fontSize: 14, color: j, marginBottom: 10, lineHeight: 1.65 }}>
              52개 API + AI 분석 엔진으로 매장별 매출을 90% 정확도로 추정합니다
            </p>

            {/* 속도 비교 카드 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              background: '#FFFFFF',
              borderRadius: 16,
              padding: '14px 12px',
              marginBottom: 14,
              border: '1px solid #E5E7EB',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              {/* 좌: 기존 방식 */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>기존 방식</div>
                <div style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#9CA3AF',
                  textDecoration: 'line-through',
                  lineHeight: 1.2,
                }}>평균 2~4주</div>
              </div>

              {/* 화살표 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                flexShrink: 0,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke={k} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* 우: 빈크래프트 */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: k, marginBottom: 4 }}>빈크래프트</div>
                <div style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: k,
                  lineHeight: 1.2,
                }}>3분</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: N, textAlign: 'center', marginBottom: 14, marginTop: -8, lineHeight: 1.4 }}>
              52개 API가 동시에 수집하고 AI가 교차 분석합니다
            </div>

            {/* 카테고리별 수집 데이터 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dataCategories.map((cat, ci) => (
                <div key={ci}>
                  {/* 카테고리 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 3, height: 16, borderRadius: 2, background: cat.color }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: cat.color }}>{cat.category}</span>
                  </div>
                  {/* 항목 리스트 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 9 }}>
                    {cat.items.map((item, ii) => (
                      <div key={ii} style={{
                        padding: '5px 10px',
                        background: `${cat.color}0A`,
                        borderRadius: 8,
                        border: `1px solid ${cat.color}18`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: y, lineHeight: 1.3 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: N, lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 경쟁 우위 강조 */}
            <div style={{ marginTop: 12, borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
              {advantages.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: `${item.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke={item.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: y, marginBottom: 1, lineHeight: 1.3 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: N, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <PhoneMockupCarousel dark={false} />
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10 }}>
          {reportTags.map((tag, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px', background: te, borderRadius: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: 3, background: tag.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: y }}>{tag.name}</span>
            </div>
          ))}
        </div>
      </ScrollReveal>

    </div>
  );
};

export default AISection;
