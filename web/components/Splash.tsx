'use client';

import { useEffect, useState } from 'react';
import styles from './Splash.module.css';

const KEY = 'folio-splash-shown';

export function Splash() {
  // 첫 렌더에서 sessionStorage 체크 — SSR 시엔 보이지 않음
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(KEY)) return;
    setVisible(true);
    const t = setTimeout(() => {
      setFadeOut(true);
      sessionStorage.setItem(KEY, '1');
      setTimeout(() => setVisible(false), 400);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;
  return (
    <div className={`${styles.splash} ${fadeOut ? styles.out : ''}`}>
      <span className={styles.logo}>Folio.</span>
      <span className={styles.copy}>당신의 캐릭터와 대화하세요</span>
    </div>
  );
}
