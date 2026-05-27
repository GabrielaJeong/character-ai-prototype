'use client';

import { useEffect, useState } from 'react';
import styles from './Splash.module.css';

const KEY = 'folio-splash-shown';

/**
 * 스플래시. 세션당 1회만 표시 (sessionStorage).
 *
 * FOUC 방지 (Day 3.x ML-009):
 *   - useState(true) 기본값으로 SSR HTML에 splash 마크업 항상 포함
 *   - critical positioning(position:fixed/z-index:9999/background 등)을 inline style로
 *     → CSS Module 로드 시점과 무관하게 첫 페인트부터 home 콘텐츠 가림
 *
 * 동작:
 *   - 첫 방문: 800ms 표시 → fadeOut 0.4s → unmount
 *   - 재방문: useEffect에서 즉시 setMounted(false) — 1프레임 splash 노출은 감수
 *     (inline script로 <html> 클래스 부여하는 트릭은 React 트리 밖 DOM 조작이라
 *      hydration removeChild 에러 유발 → 제거)
 */
export function Splash() {
  // SSR/Hydration 일관성을 위해 항상 true로 시작 — CSS가 returning user의 첫 페인트를 숨김
  const [mounted, setMounted] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // returning user — 즉시 unmount
    if (sessionStorage.getItem(KEY)) {
      setMounted(false);
      return;
    }

    // first visit — 800ms 후 fadeOut 시작
    const showTimer = setTimeout(() => {
      setFadeOut(true);
      sessionStorage.setItem(KEY, '1');
      const removeTimer = setTimeout(() => setMounted(false), 400);
      // outer cleanup이 inner timer를 못 보지만 컴포넌트가 unmount되면 어차피 무관
      return () => clearTimeout(removeTimer);
    }, 800);

    return () => clearTimeout(showTimer);
  }, []);

  if (!mounted) return null;

  // 핵심 positioning은 inline style로 — CSS Module이 dev에서 지연 적용되는 경우
  // 첫 페인트부터 home 콘텐츠가 비치는 FOUC를 차단. (ML-009 보강)
  return (
    <div
      className={`${styles.splash} ${fadeOut ? styles.out : ''}`}
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
