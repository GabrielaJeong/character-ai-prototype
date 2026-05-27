'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import styles from './not-found.module.css';

/**
 * 404 페이지 — 원본 #screen-404 (index.html L133~150).
 * Next.js App Router는 매칭되는 라우트가 없을 때 자동으로 이 컴포넌트를 렌더.
 *
 * Splash 게이팅 (ML-009, L-018):
 *   - Splash는 useUIStore.appReady && timerReady 둘 다 true일 때만 dismiss
 *   - not-found는 로딩할 데이터가 없으므로 mount 즉시 setAppReady(true) 호출
 *   - 그렇지 않으면 splash가 maxTimer(5초) 다 차야 사라짐
 *   - 새 entry route 추가 시 데이터 게이팅 필요 없으면 동일하게 설정할 것
 */
export default function NotFound() {
  const router = useRouter();
  const setAppReady = useUIStore((s) => s.setAppReady);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  return (
    <div className={styles.wrap}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <p className={styles.title}>페이지를 찾을 수 없어요</p>
        <p className={styles.desc}>주소가 잘못되었거나 삭제된 페이지일 수 있어요.</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => router.back()}
          >
            뒤로
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => router.push('/')}
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
