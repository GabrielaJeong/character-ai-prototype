'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useCharacters } from '@/lib/hooks';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';
import styles from './Modal.module.css';
import local from './AdultVerifyModal.module.css';

/**
 * 첫 성인 인증 모달. useUIStore.openAdultVerify()로 표시.
 *
 * 원본: index.html L1199~1213 (#adult-verify-overlay) + app.js confirmAdultVerify (L3369~3389).
 *
 * 동작:
 *   - 만 19세 이상 체크박스 동의 → 확인 버튼 활성
 *   - 확인 → POST /api/auth/adult-verify (adult_verified=1 + adult_content_enabled=1)
 *   - setUser + useCharacters mutate (성인 캐릭터 노출)
 *   - 취소/외부클릭 → closeAdultVerify (onClose 콜백으로 호출자 UI 원복)
 */
export function AdultVerifyModal() {
  const open = useUIStore((s) => s.adultVerify);
  const close = useUIStore((s) => s.closeAdultVerify);
  const showToast = useUIStore((s) => s.showToast);
  const setUser = useAuthStore((s) => s.setUser);
  const { mutate: refetchCharacters } = useCharacters();

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const onConfirm = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      const data = await api.post<{ user: User }>('/api/auth/adult-verify');
      setUser(data.user);
      await refetchCharacters();
      // 인증 성공 → 모달 닫되 onClose 콜백은 호출 안 함 (취소가 아니므로 UI 원복 불필요)
      useUIStore.setState({ adultVerify: null });
      setChecked(false);
      showToast('성인 콘텐츠가 활성화되었습니다.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '인증에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = () => {
    setChecked(false);
    close(); // onClose 콜백 호출 → 토글 원복
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className={styles.panel}>
        <p className={styles.title}>성인 콘텐츠 이용 인증</p>
        <p className={styles.desc} style={{ marginBottom: 18 }}>
          성인 콘텐츠에는 폭력적이거나 선정적인 내용이 포함될 수 있습니다. 만 19세 미만은 이용이 제한됩니다.
        </p>
        <label className={local.checkRow}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>본인은 만 19세 이상임을 확인합니다.</span>
        </label>
        <div className={styles.actions} style={{ marginTop: 20 }}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onConfirm}
            disabled={!checked || submitting}
          >
            {submitting ? '...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
