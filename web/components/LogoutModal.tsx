'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import styles from './Modal.module.css';

/**
 * 로그아웃 확인 모달.
 *
 * 호출:
 *   const openLogout = useUIStore((s) => s.openLogout);
 *   <button onClick={openLogout}>로그아웃</button>
 *
 * 확인 시: /api/auth/logout → 상태 비우고 홈으로
 */
export function LogoutModal() {
  const open    = useUIStore((s) => s.logoutOpen);
  const close   = useUIStore((s) => s.closeLogout);
  const logout  = useAuthStore((s) => s.logout);
  const router  = useRouter();

  if (!open) return null;

  const confirm = async () => {
    await logout();
    close();
    router.push('/');
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={styles.panel}>
        <p className={styles.title}>로그아웃 하시겠습니까?</p>
        <p className={styles.desc}>다시 이용하려면 로그인이 필요합니다.</p>
        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={close}>취소</button>
          <button className={styles.btnPrimary} onClick={confirm}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}
