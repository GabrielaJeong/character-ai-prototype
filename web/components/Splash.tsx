'use client';

import { useEffect, useState } from 'react';
import styles from './Splash.module.css';

const KEY = 'folio-splash-shown';

/**
 * 스플래시. 세션당 1회만 표시 (sessionStorage).
 *
 * FOUC 방지 (Day 3.x ML-009):
 *   - SSR HTML에 splash 마크업이 항상 포함 → 첫 페인트부터 가려짐
 *   - layout.tsx의 <head> inline script가 sessionStorage 체크 후 <html>에 'splash-shown' 클래스 추가
 *     → CSS에서 그 클래스가 있으면 splash를 즉시 숨김 (returning user는 1프레임도 안 보임)
 *
 * 동작:
 *   - 첫 방문: 800ms 표시 → fadeOut 0.4s → unmount
 *   - 재방문: 마운트 즉시 unmount (CSS에서 이미 숨겨진 상태로 페인트)
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

  return (
    <div className={`${styles.splash} ${fadeOut ? styles.out : ''}`}>
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
