'use client';

import { useRouter } from 'next/navigation';
import { useNotifBadgeCount } from '@/lib/hooks';
import { useAdultContent } from '@/lib/useAdultContent';
import { notifBadgeText } from '@/lib/format';
import styles from './LandingHeader.module.css';

/**
 * 홈 화면 상단 헤더.
 * - 좌: Folio 로고 (Foli + 점 들어간 o)
 * - 우: ALL/18+ 토글 + 알림 벨 (미읽음 배지)
 *
 * 18+ 토글 로직은 useAdultContent 훅으로 공유 (mypage 토글과 동일).
 *   - 비로그인: AuthGate / 로그인+미인증: AdultVerifyModal / 인증완료: 즉시 PATCH / OFF: 즉시
 */
export function LandingHeader() {
  const router = useRouter();
  const { setAdult, adultEnabled } = useAdultContent();
  const unreadCount = useNotifBadgeCount();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
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
      </div>
      <div className={styles.right}>
        <div className={styles.segment}>
          <button
            className={`${styles.segBtn} ${!adultEnabled ? styles.active : ''}`}
            onClick={() => setAdult(false, '/')}
            aria-pressed={!adultEnabled}
          >
            ALL
          </button>
          <button
            className={`${styles.segBtn} ${adultEnabled ? styles.active : ''}`}
            onClick={() => setAdult(true, '/')}
            aria-pressed={adultEnabled}
          >
            18+
          </button>
        </div>
        <button
          className={styles.bellBtn}
          onClick={() => router.push('/notification')}
          aria-label="알림"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className={styles.badge}>{notifBadgeText(unreadCount)}</span>
          )}
        </button>
      </div>
    </header>
  );
}
