'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';
import styles from './LandingHeader.module.css';

/**
 * 홈 화면 상단 헤더.
 * Folio 로고 + ALL/18+ 토글 (로그인 시) + 알림 벨
 */
export function LandingHeader() {
  const router    = useRouter();
  const user      = useAuthStore((s) => s.user);
  const setUser   = useAuthStore((s) => s.setUser);
  const showGate  = useUIStore((s) => s.showAuthGate);
  const showToast = useUIStore((s) => s.showToast);

  const adultEnabled = !!user?.adult_content_enabled;

  const handleAdultToggle = async (enable: boolean) => {
    if (!enable) {
      // OFF 항상 가능
      if (user) {
        try {
          const data = await api.patch<{ user: User }>('/api/auth/adult-content', { enabled: false });
          setUser(data.user);
        } catch { showToast('설정 변경에 실패했습니다.'); }
      }
      return;
    }
    // ON: 로그인 필요
    if (!user) {
      showGate({
        title: '성인 콘텐츠',
        desc: '성인 콘텐츠를 이용하려면 로그인이 필요합니다.',
        intendedPath: '/',
      });
      return;
    }
    // 이미 인증됐으면 바로 ON
    if (user.adult_verified) {
      try {
        const data = await api.patch<{ user: User }>('/api/auth/adult-content', { enabled: true });
        setUser(data.user);
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : '설정 변경에 실패했습니다.');
      }
      return;
    }
    // 첫 성인 인증은 추후 모달로 (Wave 5에서 구현)
    showToast('성인 인증이 필요합니다 (구현 예정).');
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>Folio.</span>
      </div>
      <div className={styles.right}>
        <div className={styles.segment}>
          <button
            className={`${styles.segBtn} ${!adultEnabled ? styles.active : ''}`}
            onClick={() => handleAdultToggle(false)}
          >
            ALL
          </button>
          <button
            className={`${styles.segBtn} ${adultEnabled ? styles.active : ''}`}
            onClick={() => handleAdultToggle(true)}
          >
            18+
          </button>
        </div>
        <button
          className={styles.bellBtn}
          onClick={() => router.push('/notification')}
          aria-label="알림"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
      </div>
    </header>
  );
}
