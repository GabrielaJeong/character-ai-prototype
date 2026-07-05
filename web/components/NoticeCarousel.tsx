'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './NoticeCarousel.module.css';

/**
 * 홈의 공지 캐러셀 — 원본 index.html L74~84 `.notice-carousel-wrap` 1:1.
 *
 * 동작:
 *   - 3개 슬라이드 (첫 번째는 배너 이미지 + 외부 링크, 나머지 2개는 공백 — 향후 채울 예정)
 *   - 가로 스크롤 + scroll-snap, 우하단에 페이지네이션 (1 / 3) 표시
 *   - 페이지네이션은 scroll position 추적으로 업데이트
 *
 * 모바일:
 *   - touch-action: pan-x (가로 스크롤만 허용)
 *   - scrollSnap으로 정확히 한 슬라이드 단위로 정지
 */
const TOTAL = 3;

export function NoticeCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(1);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth) + 1;
      setIdx(Math.min(Math.max(1, i), TOTAL));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.track} ref={trackRef}>
        <div className={styles.slide}>
          <a
            href="https://drive.google.com/file/d/11p9oWB9VQk1lVP9JDXXDQNHWhYaBhqYH/view?usp=drive_link"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.slideLink}
          >
            {/* next/image 대신 일반 img — 외부 링크 배너, sizing 단순 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/banner.png" alt="" className={styles.slideImg} />
          </a>
        </div>
        <div className={styles.slide} />
        <div className={styles.slide} />
      </div>
      <div className={styles.pagination}>
        {idx} / {TOTAL}
      </div>
    </div>
  );
}
