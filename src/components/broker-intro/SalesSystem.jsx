import React, { useRef, useEffect } from 'react';
import ScrollReveal from './ScrollReveal';

/**
 * SalesSystem - 영업관리 시스템 섹션
 * MacMockupCarousel + 4개 기능 카드 (자동수집, 중복검증, 지역별분류, 담당자배정)
 */
const SalesSystem = ({ colors, sectionStyle, headingStyle, descStyle, companies, regionData, topRegions, maxCount, MacMockupCarousel }) => {
  const { y, j, k, N, L } = colors;
  const ne = 'glass-card-light';
  const te = '#F2F4F6';

  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 5;

    const handleTimeUpdate = () => {
      if (video.currentTime >= 15) {
        video.currentTime = 5;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  // 4개 기능 카드 데이터 (거래처 관점 - 수집 능력 어필)
  const features = [
    {
      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
      label: '전국 자동 수집',
      desc: '전국 부동산 중개사를 자동으로 찾아냅니다',
      color: k,
    },
    {
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      label: '폐업·중복 필터링',
      desc: '정확한 데이터만 남기는 자동 검증',
      color: '#6366F1',
    },
    {
      icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
      label: '지역별 매칭',
      desc: '시/도/구 단위로 정밀하게 분류',
      color: L,
    },
    {
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      label: '전담팀 배정',
      desc: '지역별 영업 전담팀이 직접 찾아갑니다',
      color: '#8B5CF6',
    },
  ];

  return (
    <div style={sectionStyle}>
      <ScrollReveal delay={0}>
        <p className="gradient-text" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>전국 중개사 수집</p>
        <h2 style={headingStyle}>자체 프로그램 제작</h2>
        <p style={descStyle}>자체 개발 시스템으로 전국 중개사를 직접 만나며 인사드립니다</p>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
        <div style={{
          margin: '20px 0 0',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        }}>
          <video
            ref={videoRef}
            src="/collect-demo.mp4"
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 16,
            }}
          />
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <MacMockupCarousel
          isDark={false}
          companies={companies}
          regionData={regionData}
          topRegions={topRegions}
          maxCount={maxCount}
          k={k}
          L={L}
          N={N}
          j={j}
          y={y}
          te={te}
        />
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <p style={{ fontSize: 15, color: j, lineHeight: 1.7, marginBottom: 10 }}>
          자체 개발 프로그램으로 전국 17,000개 이상 중개사를 수집했습니다. 빈크래프트는 중개사님이 연락을 기다리는 게 아니라, 직접 찾아가는 구조입니다.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={0.2}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {features.map((feat, i) => (
            <div key={i} className={ne} style={{ borderRadius: 14, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${feat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={feat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={feat.icon} />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: y }}>{feat.label}</div>
              <div style={{ fontSize: 13, color: N, lineHeight: 1.4 }}>{feat.desc}</div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </div>
  );
};

export default SalesSystem;
