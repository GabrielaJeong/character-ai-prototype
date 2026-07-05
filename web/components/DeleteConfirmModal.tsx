'use client';

import { useState } from 'react';
import { useUIStore } from '@/store/ui';
import styles from './Modal.module.css';

/**
 * 재사용 가능한 삭제/위험 액션 확인 모달.
 *
 * 사용:
 *   showDeleteConfirm({
 *     title: '대화를 삭제하시겠습니까?',
 *     desc: '복구할 수 없습니다.',
 *     confirmLabel: '삭제',
 *     onConfirm: async () => { await api.delete(...); },
 *   })
 */
export function DeleteConfirmModal() {
  const payload = useUIStore((s) => s.deleteConfirm);
  const close   = useUIStore((s) => s.closeDeleteConfirm);
  const [running, setRunning] = useState(false);

  if (!payload) return null;

  const onConfirm = async () => {
    if (running) return;
    setRunning(true);
    try { await payload.onConfirm(); }
    finally {
      setRunning(false);
      close();
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget && !running) close(); }}
    >
      <div className={styles.panel}>
        <p className={styles.title}>{payload.title}</p>
        {payload.desc && <p className={styles.desc}>{payload.desc}</p>}
        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={close} disabled={running}>취소</button>
          <button className={styles.btnDelete} onClick={onConfirm} disabled={running}>
            {running ? '처리 중...' : (payload.confirmLabel ?? '삭제')}
          </button>
        </div>
      </div>
    </div>
  );
}
