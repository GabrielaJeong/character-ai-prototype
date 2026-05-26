'use client';

import { useUIStore } from '@/store/ui';
import styles from './Toast.module.css';

export function Toast() {
  const message = useUIStore((s) => s.toastMessage);
  return (
    <div className={`${styles.toast} ${message ? styles.show : ''}`} aria-live="polite">
      {message}
    </div>
  );
}
