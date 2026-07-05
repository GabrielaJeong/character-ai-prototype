'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/ui';
import styles from './Splash.module.css';

const KEY = 'folio-splash-shown';
const MIN_TIMER_FIRST_VISIT = 800;
const MAX_TIMER_SAFETY      = 5000;   // appReady 신호 안 와도 안 갇히게

/**
 * 스플래시. 원본 SPA의 _tryDismissSplash 로직 (app.js L159~186) 이식.
 *
 * 핵심 규칙 (ML-009 최종):
 *   - **dismiss = (timerReady && appReady)** — 둘 다 true일 때만
 *   - **데이터 로딩은 splash 뒤에서**: home page가 SWR로 캐릭터 받아오는 동안 splash가 가림.
 *     splash 사라질 때 home은 이미 완전 로드 상태 → "splash → loading placeholder → grid" 깜빡임 차단
 *   - 첫 방문: minTimer 800ms + appReady
 *   - 재방문 (sessionStorage 'folio-splash-shown' 있음): minTimer 0 + appReady
 *   - 최대 5초 안에 appReady 신호 없으면 강제 dismiss (안전망)
 *
 * 기술 결정 (Day 3.x ML-009):
 *   - Client Component + useState(true). SSR HTML에 splash 마크업 포함.
 *   - critical positioning은 inline style. CSS Module 로드 시점 무관하게 첫 페인트부터 가림.
 *   - dismiss는 setState로만 (DOM 직접 조작 금지) → React-managed unmount, hydration 안전.
 */
export function Splash() {
  const appReady = useUIStore((s) => s.appReady);
  const [timerReady, setTimerReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [mounted, setMounted] = useState(true);

  // 1. minTimer + maxTimer 시작 (재방문자는 minTimer 0)
  useEffect(() => {
    const isReturning = !!sessionStorage.getItem(KEY);
    const minDelay = isReturning ? 0 : MIN_TIMER_FIRST_VISIT;

    const minT = setTimeout(() => setTimerReady(true), minDelay);
    // 안전망: appReady 신호 없어도 5초면 강제 진행
    const maxT = setTimeout(() => setTimerReady(true), MAX_TIMER_SAFETY);

    return () => {
      clearTimeout(minT);
      clearTimeout(maxT);
    };
  }, []);

  // 2. (timerReady && appReady) → fadeOut 트리거
  useEffect(() => {
    if (timerReady && appReady && !fadeOut) {
      sessionStorage.setItem(KEY, '1');
      setFadeOut(true);
    }
  }, [timerReady, appReady, fadeOut]);

  // 3. fadeOut 애니메이션 끝나면 unmount
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
