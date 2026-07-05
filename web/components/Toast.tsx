'use client';

import { useUIStore } from '@/store/ui';
import styles from './Toast.module.css';

/**
 * 전역 토스트. 사용:
 *   const showToast = useUIStore((s) => s.showToast);
 *   showToast('저장되었습니다.');
 */
export function Toast() {
  const message = useUIStore((s) => s.toastMessage);
  return (
    <div className={`${styles.toast} ${message ? styles.show : ''}`} aria-live="polite">
      {message}
    </div>
  );
}
