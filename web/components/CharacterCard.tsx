'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Character } from '@/lib/types';
import styles from './CharacterCard.module.css';

interface Props {
  character: Character;
  numberBadge?: string; // 예: "B01"
  statusBadge?: { type: 'new' | 'hot' | 'up'; label: string };
}

export function CharacterCard({ character, numberBadge, statusBadge }: Props) {
  const isComingSoon = !character.image && character.tags.length === 0;
  const tagsToShow = character.tags.slice(0, 3);

  return (
    <div className={styles.wrap}>
      <Link
        href={`/character/${character.id}`}
        className={`${styles.card} ${isComingSoon ? styles.disabled : ''}`}
        aria-disabled={isComingSoon}
        onClick={(e) => { if (isComingSoon) e.preventDefault(); }}
      >
        {character.image ? (
          <Image
            src={character.image}
            alt={character.name}
            fill
            sizes="(max-width: 430px) 50vw, 215px"
            className={styles.img}
            priority={false}
          />
        ) : (
          <div className={styles.placeholder}>{character.name[0]}</div>
        )}

        {numberBadge && <span className={styles.number}>#{numberBadge}</span>}

        {statusBadge && (
          <span className={`${styles.statusBadge} ${styles[`badge_${statusBadge.type}`]}`}>
            <span className={styles.dot}>●</span>
            <span className={styles.badgeLabel}>{statusBadge.label}</span>
          </span>
        )}

        {tagsToShow.length > 0 && (
          <div className={styles.overlay}>
            <div className={styles.tags}>
              {tagsToShow.map((t) => (
                <span key={t} className={styles.tag}>
                  {t}
                </span>
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
      </Link>

      <div className={styles.info}>
        <div className={styles.name}>{character.name}</div>
        {character.role && <div className={styles.role}>{character.role}</div>}
        {character.owner_username && (
          <Link href={`/creator/@${character.owner_username}`} className={styles.creator} onClick={(e) => e.stopPropagation()}>
            @{character.owner_username}
          </Link>
        )}
      </div>
    </div>
  );
}
