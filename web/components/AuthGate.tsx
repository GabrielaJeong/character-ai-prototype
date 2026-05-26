'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import styles from './Modal.module.css';

export function AuthGate() {
  const router        = useRouter();
  const gate          = useUIStore((s) => s.authGate);
  const close         = useUIStore((s) => s.closeAuthGate);
  const showToast     = useUIStore((s) => s.showToast);
  const demoAvailable = useAuthStore((s) => s.demoAvailable);
  const demoLogin     = useAuthStore((s) => s.demoLogin);

  if (!gate) return null;

  const goToLogin = () => {
    const intended = gate.intendedPath || '/';
    close();
    const url = `/login?redirect=${encodeURIComponent(intended)}`;
    router.replace(url);
  };

  const handleDemo = async () => {
    try {
      await demoLogin();
      const dest = gate.intendedPath || '/';
      close();
      router.replace(dest);
    } catch {
      showToast('체험 로그인에 실패했습니다.');
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={styles.panel}>
        <p className={styles.title}>{gate.title}</p>
        <p className={styles.desc}>{gate.desc}</p>
        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={close}>닫기</button>
          <button className={`${styles.btnPrimary} ${styles.primary}`} onClick={goToLogin}>로그인하기</button>
        </div>
        {demoAvailable && (
          <button className={styles.demoBtn} onClick={handleDemo}>
            로그인 없이 체험하기 →
          </button>
        )}
      </div>
    </div>
  );
}
