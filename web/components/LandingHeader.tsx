'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useCharacters, useNotifBadgeCount } from '@/lib/hooks';
import { notifBadgeText } from '@/lib/format';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';
import styles from './LandingHeader.module.css';

/**
 * 홈 화면 상단 헤더.
 * - 좌: Folio 로고 (Foli + 점 들어간 o)
 * - 우: ALL/18+ 토글 (로그인 시 동작) + 알림 벨 (미읽음 배지)
 *
 * 18+ 토글 동작:
 *   - 비로그인: 인증 게이트
 *   - 로그인 + 성인인증 안 됨: AdultVerify 모달 (현재는 토스트 안내 — Day N에서 모달)
 *   - 로그인 + 성인인증 완료: 즉시 PATCH /api/auth/adult-content
 *   - OFF는 항상 가능
 *
 * 백엔드 응답:
 *   - /api/characters 가 user.adult_content_enabled 기준 필터링하므로
 *     토글 변경 후 useCharacters mutate 호출 필요
 */
export function LandingHeader() {
  const router          = useRouter();
  const user            = useAuthStore((s) => s.user);
  const setUser         = useAuthStore((s) => s.setUser);
  const showAuthGate    = useUIStore((s) => s.showAuthGate);
  const showToast       = useUIStore((s) => s.showToast);
  const { mutate: refetchCharacters } = useCharacters();
  const unreadCount     = useNotifBadgeCount();

  const adultEnabled = !!user?.adult_content_enabled;

  const setAdult = async (enable: boolean) => {
    // OFF는 항상 OK (비로그인이라도 그냥 무시)
    if (!enable) {
      if (user) {
        try {
          const data = await api.patch<{ user: User }>('/api/auth/adult-content', { enabled: false });
          setUser(data.user);
          await refetchCharacters();
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '설정 변경 실패');
        }
      }
      return;
    }
    // ON: 로그인 필요
    if (!user) {
      showAuthGate({
        title: '성인 콘텐츠',
        desc: '성인 콘텐츠를 이용하려면 로그인이 필요합니다.',
        intendedPath: '/',
      });
      return;
    }
    // 인증 완료 → 즉시 ON
    if (user.adult_verified) {
      try {
        const data = await api.patch<{ user: User }>('/api/auth/adult-content', { enabled: true });
        setUser(data.user);
        await refetchCharacters();
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : '설정 변경 실패');
      }
      return;
    }
    // 인증 미완료 → AdultVerify 모달 (현재 미구현, 추후 Day X에서)
    showToast('성인 인증이 필요합니다 (모달 구현 예정).');
  };

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
            onClick={() => setAdult(false)}
            aria-pressed={!adultEnabled}
          >
            ALL
          </button>
          <button
            className={`${styles.segBtn} ${adultEnabled ? styles.active : ''}`}
            onClick={() => setAdult(true)}
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
