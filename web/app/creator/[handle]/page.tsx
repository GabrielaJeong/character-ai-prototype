'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useCreator } from '@/lib/hooks';
import { api } from '@/lib/api';
import { fmtK } from '@/lib/format';
import type { CreatorCharacter } from '@/lib/types';
import { MypageInfoModal } from '@/app/mypage/MypageInfoModal';
import styles from './page.module.css';

/**
 * 크리에이터 프로필 — `/creator/@:username`
 *
 * 원본: index.html L1240~1250 (#screen-creator) + style.css L5069~5250
 *        + app.js L1104~1216 (loadCreatorProfile / toggleCreatorPin).
 *
 * 공개 페이지 (비로그인도 조회 가능). 본인(isOwner)이면 PINNED 토글 + 프로필 편집 노출.
 * 동적 세그먼트 [handle]은 `@username` 형태 — 백엔드가 @ 제거 후 조회.
 */
export default function CreatorPage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const handle = decodeURIComponent(params.handle || ''); // "@username"
  const username = handle.replace(/^@/, '');
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);
  const { profile, error, isLoading, mutate } = useCreator(handle || null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const onTogglePin = async (c: CreatorCharacter) => {
    try {
      await api.patch(`/api/creator/${c.id}/pin`);
      await mutate();
    } catch {
      showToast('처리에 실패했습니다.');
    }
  };

  return (
    <div className="page-wrap">
      <div className="page-nav">
        <button type="button" className="btn-back" onClick={() => router.push('/')} aria-label="뒤로">
          ←
        </button>
        <span className="nav-label">@{username}</span>
      </div>

      <div className={styles.body}>
        {isLoading && <p className={styles.statusMsg}>불러오는 중...</p>}
        {!isLoading && (error || !profile) && (
          <p className={styles.statusMsg}>크리에이터를 찾을 수 없습니다.</p>
        )}
        {!isLoading && profile && (
          <CreatorContent
            profile={profile}
            onTogglePin={onTogglePin}
            onEdit={() => setInfoModalOpen(true)}
            onFollow={() => showToast('팔로우 기능은 준비 중입니다.')}
            onOpenChar={(id) => router.push(`/character/${id}`)}
          />
        )}
      </div>

      {infoModalOpen && <MypageInfoModal onClose={() => setInfoModalOpen(false)} />}
    </div>
  );
}

function CreatorContent({
  profile,
  onTogglePin,
  onEdit,
  onFollow,
  onOpenChar,
}: {
  profile: NonNullable<ReturnType<typeof useCreator>['profile']>;
  onTogglePin: (c: CreatorCharacter) => void;
  onEdit: () => void;
  onFollow: () => void;
  onOpenChar: (id: string) => void;
}) {
  const { user, characters, isOwner } = profile;

  const totalWorks = characters.length;
  const totalChats = characters.reduce((s, c) => s + (c.stats?.sessions || 0), 0);
  const totalLikes = characters.reduce((s, c) => s + (c.stats?.bookmarks || 0), 0);

  const pinnedChars = characters.filter((c) => c.pinned);

  const CharCard = (c: CreatorCharacter) => (
    <div key={c.id} className={styles.charCard} onClick={() => onOpenChar(c.id)}>
      {c.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={c.image} className={styles.charImg} alt="" />
      ) : (
        <div className={`${styles.charImg} ${styles.charImgEmpty}`}>✦</div>
      )}
      {isOwner && (
        <button
          type="button"
          className={`${styles.pinBtn} ${c.pinned ? styles.pinBtnActive : ''}`}
          title={c.pinned ? '핀 해제' : '핀 고정'}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(c);
          }}
        >
          {c.pinned ? '⊛' : '⊙'}
        </button>
      )}
      <div className={styles.charInfo}>
        <div className={styles.charName}>{c.name}</div>
        <div className={styles.charRole}>{c.role || ''}</div>
        <div className={styles.charStats}>
          <span>▲ {fmtK(c.stats?.sessions || 0)}</span>
          <span>♥ {fmtK(c.stats?.bookmarks || 0)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          {user.avatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={user.avatar} className={styles.avatarImg} alt="" />
          ) : (
            <div className={styles.avatarLetter}>{(user.nickname || '?')[0].toUpperCase()}</div>
          )}
        </div>
        <div className={styles.headerInfo}>
          <div className={styles.nickname}>{user.nickname}</div>
          <div className={styles.handle}>@{user.username}</div>
        </div>
        <div className={styles.headerActions}>
          {isOwner ? (
            <button type="button" className={styles.actionBtn} onClick={onEdit}>
              프로필 편집
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.followBtn}`}
              onClick={onFollow}
            >
              팔로우
            </button>
          )}
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statVal}>{totalWorks}</span>
          <span className={styles.statLabel}>WORKS</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{fmtK(totalChats)}</span>
          <span className={styles.statLabel}>CHATS</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{fmtK(totalLikes)}</span>
          <span className={styles.statLabel}>LIKES</span>
        </div>
      </div>

      {pinnedChars.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            <span className={styles.sectionPrefix}>&gt;</span> PINNED.WORK
          </div>
          <div className={styles.charList}>{pinnedChars.map(CharCard)}</div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          <span className={styles.sectionPrefix}>&gt;</span> ALL.WORKS
        </div>
        {characters.length > 0 ? (
          <div className={styles.charList}>{characters.map(CharCard)}</div>
        ) : (
          <p className={styles.empty}>아직 공개된 작품이 없습니다.</p>
        )}
      </div>
    </>
  );
}
