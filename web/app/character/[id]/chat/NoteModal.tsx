'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import styles from './NoteModal.module.css';

/**
 * 유저 노트 모달. 채팅 헤더의 📝 클릭 시 표시.
 *
 * 원본: index.html L476~496 (#note-overlay) + app.js openNote/saveNote (L2372~2409).
 *
 * 동작:
 *   - 열릴 때 GET /api/sessions/:id/note 로 기존 노트 로드
 *   - textarea (최대 1000자) + 카운트
 *   - 저장 → PUT /api/sessions/:id/note → onSaved(hasNote) 콜백으로 헤더 dot 갱신
 *
 * 한계: 첫 메시지 전(백엔드 세션 미생성)엔 GET/PUT 404. 저장 시 안내 toast.
 */
const MAX = 1000;

interface Props {
  sessionId: string;
  onClose: () => void;
  onSaved: (hasNote: boolean) => void;
}

export function NoteModal({ sessionId, onClose, onSaved }: Props) {
  const showToast = useUIStore((s) => s.showToast);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ note: string }>(`/api/sessions/${sessionId}/note`);
        if (!cancelled) setNote(data.note || '');
      } catch {
        // 세션 미생성(첫 메시지 전) 등 — 빈 노트로 시작
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.put(`/api/sessions/${sessionId}/note`, { note });
      onSaved(note.trim().length > 0);
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '노트 저장에 실패했습니다. (첫 메시지 후 가능)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>유저 노트</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <p className={styles.desc}>
          캐릭터가 대화 중 참고할 사실이나 맥락을 입력하세요. 매 응답에 자동 반영됩니다.
        </p>
        <textarea
          className={styles.textarea}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX))}
          placeholder="예: 오늘 강현의 생일이다. 이화는 미리 선물을 준비해뒀다."
          disabled={loading}
          maxLength={MAX}
        />
        <div className={styles.footer}>
          <span className={styles.count}>{note.length} / {MAX}</span>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={onSave}
            disabled={saving || loading}
          >
            {saving ? '...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
