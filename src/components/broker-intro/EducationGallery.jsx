import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * EducationGallery
 * 운영/경영/이론 3개 카드 + 랜덤 사진 + 회전초밥 자동 스크롤
 */
const EducationGallery = ({ colors, sectionStyle, headingStyle, descStyle }) => {
  const { y, j, k, N, T, L } = colors;

  const scrollRef = useRef(null);
  const animFrameRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const autoScrollPausedRef = useRef(false);
  const scrollSpeedRef = useRef(0.4);

  const categories = [
    { name: '이론', color: k,
      items: ['우유스팀', '바세팅', '커피기초', '그라인더', '에스프레소', '장비운용'] },
    { name: '경영', color: '#6366F1',
      items: ['인건비/고정비', '상권분석', '세무/회계', '손익분기점', '가격책정'] },
    { name: '운영', color: L,
      items: ['발주/재고', '직원근태', '배달관리', '매출정산', '원가계산', '문서체계화'] },
  ];

  // 매 마운트(중개사모드 진입)마다 랜덤 사진 3장 선택
  const randomPhotos = useMemo(() => {
    const total = 18;
    const picked = new Set();
    while (picked.size < 3) {
      picked.add(Math.floor(Math.random() * total) + 1);
    }
    return [...picked].map(n => `/education/edu_${String(n).padStart(2, '0')}.jpg`);
  }, []);

  const autoScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || autoScrollPausedRef.current) {
      animFrameRef.current = requestAnimationFrame(autoScroll);
      return;
    }
    container.scrollLeft += scrollSpeedRef.current;
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (container.scrollLeft >= maxScroll) { container.scrollLeft = 0; }
    animFrameRef.current = requestAnimationFrame(autoScroll);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(autoScroll);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [autoScroll]);

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    autoScrollPausedRef.current = true;
    startXRef.current = e.touches ? e.touches[0].pageX : e.pageX;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.touches ? e.touches[0].pageX : e.pageX;
    const walk = (startXRef.current - x) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftRef.current + walk;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setTimeout(() => { autoScrollPausedRef.current = false; }, 2000);
  };

  const hideScrollbarCSS = '.edu-gallery-scroll::-webkit-scrollbar { display: none; }';

  return (
    <div style={sectionStyle}>
      <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: k }}>직접 교육</p>
      <h2 style={headingStyle}>창업자를 위한 1:1 교육</h2>
      <p style={descStyle}>카페 운영에 필요한 모든 것을 1:1로 교육합니다</p>
      <div
        ref={scrollRef}
        className="edu-gallery-scroll"
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        style={{
          display: 'flex', gap: 12,
          overflowX: 'auto', overflowY: 'hidden',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          cursor: 'grab', paddingBottom: 8,
        }}
      >
        <style>{hideScrollbarCSS}</style>
        {[...categories, ...categories, ...categories].map((category, index) => {
          const photoIdx = index % 3;
          return (
            <div key={index} style={{
              minWidth: '90vw', maxWidth: '90vw',
              flexShrink: 0, borderRadius: 16, overflow: 'hidden',
              background: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              {/* 사진 영역 (아이콘 없음, 실제 사진 사용) */}
              <div style={{
                width: '100%', aspectRatio: '4 / 3', minHeight: 280,
                background: T, overflow: 'hidden',
              }}>
                <img
                  src={randomPhotos[photoIdx]}
                  alt={`${category.name} 교육`}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>

              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: category.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 18, fontWeight: 800, color: y, letterSpacing: '-0.01em' }}>{category.name} 교육</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {category.items.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px',
                      background: category.color + '10', borderRadius: 8,
                    }}>
                      <div style={{ width: 4, height: 4, borderRadius: 2, background: category.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: y }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EducationGallery;
