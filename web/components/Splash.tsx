'use client';

import { useEffect, useState } from 'react';
import styles from './Splash.module.css';

const KEY = 'folio-splash-shown';

/**
 * 스플래시. 세션당 1회만 표시 (sessionStorage).
 *
 * 설계 (Day 3.x ML-009 최종):
 *   - **Client Component + useState(true)**
 *     · useState(true)로 SSR HTML에 splash 마크업 포함 → 첫 페인트부터 가림
 *     · 초기 client state도 true → SSR과 동일 → hydration mismatch 없음
 *   - **모든 dismiss는 React state로만**
 *     · DOM 직접 조작 금지 (element.remove() 등)
 *     · setState로 conditional render → React가 자체 reconciliation으로 안전하게 unmount
 *   - **critical positioning은 inline style**
 *     · CSS Module 로드 시점 무관하게 첫 페인트부터 position:fixed/z-index:9999 적용
 *
 * 동작:
 *   - 첫 방문: 800ms 표시 → fadeOut 0.4s → unmount + sessionStorage 세팅
 *   - 재방문: useEffect 즉시 setMounted(false) — hydration 후 1프레임 정도 보이고 사라짐
 *     (이 1프레임은 home이 비치는 것보다 훨씬 짧고, brand 노출이라 부정적이지도 않음)
 */
export function Splash() {
  const [mounted, setMounted] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // returning user — 즉시 unmount
    if (sessionStorage.getItem(KEY)) {
      setMounted(false);
      return;
    }
    // first visit — 800ms 후 fadeOut, 400ms 후 unmount
    const showTimer = setTimeout(() => {
      setFadeOut(true);
      sessionStorage.setItem(KEY, '1');
    }, 800);
    return () => clearTimeout(showTimer);
  }, []);

  // fadeOut 이후 unmount는 onAnimationEnd로 React-safe하게 처리
  const handleAnimationEnd = () => {
    if (fadeOut) setMounted(false);
  };

  if (!mounted) return null;

  return (
    <div
      className={`${styles.splash} ${fadeOut ? styles.out : ''}`}
      onAnimationEnd={handleAnimationEnd}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0A0E17',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        pointerEvents: 'none',
      }}
    >
      <span className={styles.logo}>
        Foli
        <span className={styles.oWrap}>
          <span className={styles.dots}>
            <span className={`${styles.dot} ${styles.dot1}`} />
            <span className={`${styles.dot} ${styles.dot2}`} />
          </span>
          o
        </span>
      </span>
      <span className={styles.copy}>당신의 캐릭터와 대화하세요</span>
    </div>
  );
}
