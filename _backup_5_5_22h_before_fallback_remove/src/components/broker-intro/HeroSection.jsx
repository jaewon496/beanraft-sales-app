import React from 'react';

/**
 * HeroSection - 중개사 소개 탭 히어로 섹션
 * 검정(위) → 흰색(아래) 단순 그라데이션, 로고 가운데
 */
const HeroSection = ({ colors }) => {
  const { g } = colors;

  return (
    <div style={{
      minHeight: 'calc(100vh - 130px)',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
      scrollSnapAlign: 'start',
      background: `linear-gradient(to bottom, #000000 0%, #000000 25%, #0a0a0a 40%, #111111 50%, #1a1a1a 58%, #333333 65%, #666666 72%, #999999 79%, #cccccc 86%, #e8e8e8 92%, ${g} 100%)`,
    }}>
      {/* 로고 + 안내 텍스트 (같은 블록에 배치하여 어두운 영역 유지) */}
      <div style={{
        opacity: 0,
        animation: 'heroLogoReveal 2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards',
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <img
          src="/logo.png"
          alt="BEANCRAFT"
          style={{
            maxWidth: 520,
            width: '92vw',
            height: 'auto',
            objectFit: 'contain',
            marginBottom: 24,
            imageRendering: 'auto',
            WebkitBackfaceVisibility: 'hidden',
          }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <p style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.05em',
          fontWeight: 300,
          opacity: 0,
          animation: 'heroTextSlideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) 2s forwards',
        }}>
          아래로 스크롤하여 제안을 확인하세요
        </p>
      </div>
    </div>
  );
};

export default HeroSection;
