'use client';

import { useEffect, useState } from 'react';
import styles from './Splash.module.css';

const KEY = 'folio-splash-shown';

/**
 * 스플래시. 세션당 1회만 표시 (sessionStorage).
 *
 * 동작:
 *   - 마운트 시 sessionStorage 체크
 *   - 처음이면 800ms 표시 → fadeOut 0.4s → unmount
 *   - 두 번째 이후엔 즉시 unmount (return null)
 */
export function Splash() {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(KEY)) return;

    setVisible(true);
    const showTimer = setTimeout(() => {
      setFadeOut(true);
      sessionStorage.setItem(KEY, '1');
      const removeTimer = setTimeout(() => setVisible(false), 400);
      // cleanup의 outer return은 setShowTimer 정리. inner는 자체적으로 처리.
      return () => clearTimeout(removeTimer);
    }, 800);

    return () => clearTimeout(showTimer);
  }, []);

  if (!visible) return null;

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
