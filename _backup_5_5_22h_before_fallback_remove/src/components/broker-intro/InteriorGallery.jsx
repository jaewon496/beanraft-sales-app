import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';

/**
 * InteriorGallery - 오픈 매장 가로 스크롤 갤러리
 * 빈크래프트가 시공한 매장 사진을 가로 스크롤로 보여줍니다.
 * 자동 스크롤 + 터치 드래그 지원
 */
const InteriorGallery = ({ colors, sectionStyle, headingStyle, descStyle }) => {
  const { y, j, k, T } = colors;

  const scrollRef = useRef(null);
  const animFrameRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const autoScrollPausedRef = useRef(false);
  const scrollSpeedRef = useRef(0.3);

  // 매장 목록
  const stores = [
    'OZIO',
    'THE BOIL',
    'PLATE D. 성수',
    'PLATE D. 이태원',
    'PLATE D',
    'RE LITTLE VACATION',
    'THAT COFFEE',
    'TO ALL THE DREAMERS',
    'UNITED COFFEE',
    'FLUID',
  ];

  // 랜덤 매장 사진 선택
  const randomPhotos = useMemo(() => {
    const total = 137;
    const picked = new Set();
    while (picked.size < stores.length) {
      picked.add(Math.floor(Math.random() * total) + 1);
    }
    return [...picked].map(n => `/stores/store_${String(n).padStart(3, '0')}.jpg`);
  }, []);

  // 자동 스크롤 (우측에서 좌측으로)
  const autoScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || autoScrollPausedRef.current) {
      animFrameRef.current = requestAnimationFrame(autoScroll);
      return;
    }

    container.scrollLeft += scrollSpeedRef.current;

    // 끝에 도달하면 처음으로 (부드럽게 리셋)
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (container.scrollLeft >= maxScroll) {
      container.scrollLeft = 0;
    }

    animFrameRef.current = requestAnimationFrame(autoScroll);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(autoScroll);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [autoScroll]);

  // 터치/마우스 드래그 핸들러
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
    // 터치 해제 후 1초 뒤 자동 스크롤 재개
    setTimeout(() => {
      autoScrollPausedRef.current = false;
    }, 1000);
  };

  return (
    <div style={sectionStyle}>
      {/* 라벨 */}
      <p style={{
        fontSize: 17,
        fontWeight: 700,
        marginBottom: 4,
        color: k,
      }}>오픈 매장</p>

      {/* 제목 */}
      <h2 style={headingStyle}>직접 확인해 보세요.</h2>

      {/* 설명 */}
      <p style={descStyle}>빈크래프트가 시공한 매장을 직접 확인할 수 있습니다</p>

      {/* 가로 스크롤 컨테이너 */}
      <div
        ref={scrollRef}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
          paddingBottom: 8,
        }}
      >
        <style>{`
          .interior-gallery-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        {/* 무한 스크롤 효과를 위해 목록을 2번 반복 */}
        {[...stores, ...stores].map((storeName, index) => (
          <div
            key={index}
            style={{
              minWidth: '90vw',
              maxWidth: '90vw',
              flexShrink: 0,
              borderRadius: 16,
              overflow: 'hidden',
              background: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            {/* 매장 사진 */}
            <img
              src={randomPhotos[index % stores.length]}
              alt={storeName}
              style={{
                width: '100%',
                aspectRatio: '4 / 3',
                objectFit: 'cover',
                display: 'block',
                borderRadius: '12px 12px 0 0',
                minHeight: 280,
              }}
            />

          </div>
        ))}
      </div>
    </div>
  );
};

export default InteriorGallery;
