'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import styles from './DemoBanner.module.css';

/**
 * 체험 모드 배너 — 원본 public/index.html `#demo-banner` 대응.
 * React 이식 때 누락돼 있었다 (버튼은 AuthGate로 넘어왔으나 배너는 빠짐).
 *
 * 체험 계정으로 둘러보는 중이라는 표시 + 빠져나갈 경로를 함께 준다.
 * 이게 없으면 체험 유저가 자기 상태를 모른 채 데이터를 남기고, 로그아웃
 * 경로도 마이페이지 안쪽으로 숨는다.
 *
 * 노출 조건: /api/auth/me 의 isDemo (DEMO_MODE && email === demo@folio.app).
 */
export function DemoBanner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useUIStore((s) => s.showToast);

  if (!user?.isDemo) return null;

  const endDemo = async () => {
    await logout();
    showToast('체험을 종료했어요.');
    router.push('/');
  };

  return (
    <div className={styles.banner} role="status">
      <span>체험 모드로 둘러보는 중</span>
      <button className={styles.endBtn} onClick={endDemo}>
        체험 종료
      </button>
    </div>
  );
}
