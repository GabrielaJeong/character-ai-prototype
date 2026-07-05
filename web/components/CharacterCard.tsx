'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Character } from '@/lib/types';
import { fmtK } from '@/lib/format';
import styles from './CharacterCard.module.css';

/**
 * 캐릭터 카드 — 홈·탐색·마이페이지·크리에이터에서 재사용.
 *
 * 원본: app.js buildCharCard() 1:1 이식
 *   - 이미지 카드 + 카드 외부 정보 블록(이름·역할·@크리에이터·통계)으로 분리
 *   - 좌상단 numberBadge (#B01)
 *   - 우상단 statusBadge (NEW/HOT/UP) — char.badge 따라
 *   - 하단 그라디언트 오버레이에 태그 (# prefix, 최대 3개)
 *   - char.status === 'coming_soon' 이면 Coming Soon overlay
 *   - 유저 제작 (id.startsWith('char_') && owner_username) → @크리에이터 링크
 *
 * 카드 클릭 → /character/[id] (인트로). coming_soon은 클릭 차단.
 */

interface Props {
  character: Character;
  index: number; // numberBadge 생성용 (0-based)
}

const BADGE_CLASS: Record<NonNullable<Character['badge']>, string> = {
  NEW: 'badge_new',
  HOT: 'badge_hot',
  UP:  'badge_up',
};

export function CharacterCard({ character, index }: Props) {
  const isComingSoon = character.status === 'coming_soon';
  const numberStr = `B${String(index + 1).padStart(2, '0')}`;
  const tagsToShow = (character.tags ?? []).slice(0, 3);
  const badge = character.badge;
  const isUserCreated = character.id?.startsWith('char_') && !!character.owner_username;

  const cardInner = (
    <>
      {character.image ? (
        <Image
          src={character.image}
          alt={character.name}
          fill
          sizes="(max-width: 430px) 50vw, 215px"
          className={styles.img}
          unoptimized
        />
      ) : (
        <div className={styles.placeholder}>{character.name[0]}</div>
      )}

      <span className={styles.number}>#{numberStr}</span>

      {badge && (
        <span className={`${styles.statusBadge} ${styles[BADGE_CLASS[badge]]}`}>
          <span className={styles.dot}>●</span>
          <span className={styles.badgeLabel}>{badge}</span>
        </span>
      )}

      {tagsToShow.length > 0 && (
        <div className={styles.overlay}>
          <div className={styles.tags}>
            {tagsToShow.map((t) => (
              <span key={t} className={styles.tag}>#{t}</span>
            ))}
          </div>
        </div>
      )}

      {isComingSoon && (
        <>
          <div className={styles.comingOverlay} />
          <span className={styles.soonBadge}>Coming Soon</span>
        </>
      )}
    </>
  );

  return (
    <div className={styles.wrap}>
      {isComingSoon ? (
        <div className={`${styles.card} ${styles.disabled}`}>{cardInner}</div>
      ) : (
        <Link href={`/character/${character.id}`} className={styles.card}>
          {cardInner}
        </Link>
      )}

      <div className={styles.info}>
        <div className={styles.name}>{character.name}</div>
        {(character.role || character.team) && (
          <div className={styles.role}>{character.role || character.team}</div>
        )}
        {isUserCreated && (
          <Link
            href={`/creator/@${character.owner_username}`}
            className={styles.creator}
            onClick={(e) => e.stopPropagation()}
          >
            @{character.owner_username}
          </Link>
        )}
        {character.stats && (
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statIcon}>▲</span>
              {fmtK(character.stats.sessions)}
            </span>
            <span className={styles.stat}>
              <span className={styles.statIcon}>♥</span>
              {fmtK(character.stats.bookmarks)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
