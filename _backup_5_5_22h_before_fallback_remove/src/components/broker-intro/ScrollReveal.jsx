import React, { useRef, useState, useEffect } from 'react';

/**
 * ScrollRevealItem - 스크롤 애니메이션 아이템
 * IntersectionObserver 기반 등장 애니메이션 (fade + translate + blur)
 */
const ScrollRevealItem = ({ children, delay = 0, inView }) => (
  <div style={{
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0) scale(1)' : 'translateY(60px) scale(0.88)',
    filter: inView ? 'blur(0px)' : 'blur(4px)',
    transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, filter 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
    willChange: 'transform, opacity, filter',
  }}>
    {children}
  </div>
);

/**
 * ScrollReveal - 스크롤 등장 애니메이션 래퍼
 * 뷰포트 진입 시 한 번만 애니메이션 실행
 */
const ScrollReveal = ({ children, delay = 0, threshold = 0.15 }) => {
  const revealRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = revealRef.current;
    if (!el) return;
    let scrollParent = el.parentElement;
    while (scrollParent) {
      const style = window.getComputedStyle(scrollParent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { root: scrollParent || null, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={revealRef}>
      <ScrollRevealItem delay={delay} inView={inView}>{children}</ScrollRevealItem>
    </div>
  );
};

export { ScrollReveal, ScrollRevealItem };
export default ScrollReveal;
