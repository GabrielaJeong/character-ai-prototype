'use client';

import type { Character } from '@/lib/types';
import styles from './CharProfileModal.module.css';

/**
 * 채팅 헤더 프로필 클릭 시 캐릭터 정보 모달.
 *
 * 원본: index.html L466~474 (#char-profile-overlay) + app.js openCharProfile (L2311~2350).
 *
 * 표시: 이미지 / fullName / subtitle / profile rows (나이·직업 등) / 제작자 노트(description).
 */
interface Props {
  char: Character;
  onClose: () => void;
}

export function CharProfileModal({ char, onClose }: Props) {
  const profileEntries = char.profile ? Object.entries(char.profile) : [];
  const description = char.description ?? [];

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {char.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={char.image} alt={char.name} className={styles.img} />
          )}
          <div className={styles.names}>
            <p className={styles.fullname}>{char.fullName || char.name}</p>
            <p className={styles.subtitle}>{char.subtitle || char.team || ''}</p>
          </div>

          {profileEntries.length > 0 && (
            <div className={styles.profileCard}>
              {profileEntries.map(([k, v]) => (
                <div key={k} className={styles.ptRow}>
                  <span className={styles.ptKey}>{k}</span>
                  <span className={styles.ptVal}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {description.length > 0 && (
            <div className={styles.noteCard}>
              <p className={styles.noteEyebrow}>제작자 노트</p>
              {description.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
