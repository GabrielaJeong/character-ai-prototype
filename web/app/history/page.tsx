'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessions, useCharacters } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import type { Session } from '@/lib/types';
import styles from './page.module.css';

/**
 * 대화 (History) — `/history`
 *
 * 원본: index.html L152~172 (#screen-history) + style.css L1722~1914 + app.js L596~801.
 *
 * 기능:
 *   - 세션 목록 (GET /api/sessions, user 또는 guest 격리)
 *   - 카드 클릭 → `/character/<charId>/chat?session=<id>` 로 진입 (chat 페이지가 hydrate)
 *   - 선택삭제 모드: 체크박스로 다중 선택 → DELETE /api/chat/<id>
 *   - 전체삭제: 확인 후 모두 DELETE
 *
 * 백엔드: routes/chat.js의 `DELETE /api/chat/:sessionId` 사용 (기존 동작).
 */
export default function HistoryPage() {
  const router = useRouter();
  const { sessions, error, isLoading, mutate } = useSessions();
  const { characters } = useCharacters();
  const showToast = useUIStore((s) => s.showToast);
  const showDeleteConfirm = useUIStore((s) => s.showDeleteConfirm);
  const setAppReady = useUIStore((s) => s.setAppReady);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardClick = (s: Session) => {
    if (selectMode) {
      toggleSelect(s.id);
      return;
    }
    const charId = s.character_id || 'ihwa';
    router.push(`/character/${charId}/chat?session=${encodeURIComponent(s.id)}`);
  };

  const deleteSessions = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.delete(`/api/chat/${id}`)));
      await mutate(); // SWR 재요청
      exitSelectMode();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '삭제에 실패했습니다.');
    }
  };

  const handleDeleteAll = () => {
    if (sessions.length === 0) return;
    showDeleteConfirm({
      title: `대화 ${sessions.length}개를 모두 삭제하시겠습니까?`,
      desc: '삭제된 대화는 복구할 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: () => deleteSessions(sessions.map((s) => s.id)),
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    showDeleteConfirm({
      title: `선택한 ${selectedIds.size}개의 대화를 삭제하시겠습니까?`,
      desc: '삭제된 대화는 복구할 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: () => deleteSessions([...selectedIds]),
    });
  };

  return (
    <div className="page-wrap">
      <div className={styles.tabHeader}>
        <span className={styles.tabTitle}>대화</span>
      </div>

      <div className={styles.actionBar}>
        {!selectMode ? (
          <>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleDeleteAll}
              disabled={sessions.length === 0}
            >
              전체삭제
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={enterSelectMode}
              disabled={sessions.length === 0}
            >
              선택삭제
            </button>
          </>
        ) : (
          <>
            <button type="button" className={styles.actionBtn} onClick={exitSelectMode}>
              취소
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              삭제
            </button>
          </>
        )}
      </div>

      <div className={styles.body}>
        {isLoading && <p className={styles.stateMsg}>불러오는 중...</p>}
        {error && !isLoading && <p className={styles.stateMsg}>불러오기 실패</p>}
        {!isLoading && !error && sessions.length === 0 && (
          <p className={styles.stateMsg}>저장된 대화가 없습니다.</p>
        )}
        {!isLoading && !error && sessions.length > 0 && (
          <div className={styles.list}>
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                charName={characters.find((c) => c.id === s.character_id)?.name ?? s.character_id ?? '이화'}
                charImage={characters.find((c) => c.id === s.character_id)?.image}
                selectMode={selectMode}
                selected={selectedIds.has(s.id)}
                onClick={() => handleCardClick(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  session: Session;
  charName: string;
  charImage?: string;
  selectMode: boolean;
  selected: boolean;
  onClick: () => void;
}

function SessionCard({ session, charName, charImage, selectMode, selected, onClick }: CardProps) {
  const date = new Date(session.created_at * 1000);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  const isAdult = session.safety === 'off';
  const personaName = session.persona?.name || '알 수 없음';

  return (
    <div
      className={`${styles.card} ${selectMode ? styles.cardSelectMode : ''} ${selected ? styles.cardSelected : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <span className={`${styles.pennant} ${isAdult ? styles.pennantAdult : styles.pennantAllAges}`} />
      <span className={`${styles.checkbox} ${selected ? styles.checkboxChecked : ''}`} />
      <div className={styles.avatarWrap}>
        {charImage ? (
          <div className={`${styles.avatar} ${styles.avatarImg}`} style={{ backgroundImage: `url('${charImage}')` }} />
        ) : (
          <div className={styles.avatar}>{charName[0]}</div>
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.charName}>{charName}</span>
          <span className={styles.date}>{dateStr}</span>
        </div>
        <p className={styles.preview}>{session.last_message || '대화 없음'}</p>
        <span className={styles.personaTag}>{personaName}</span>
      </div>
    </div>
  );
}
