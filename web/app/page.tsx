'use client';

import { useCharacters } from '@/lib/hooks';
import { CharacterCard } from '@/components/CharacterCard';
import styles from './page.module.css';

export default function HomePage() {
  const { characters, error, isLoading } = useCharacters();

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>&gt; RECOMMENDED.FEED</span>
        <h2 className={styles.title}>추천 캐릭터</h2>
      </header>

      {isLoading && <div className={styles.loading}>불러오는 중...</div>}
      {error && (
        <div className={styles.error}>
          캐릭터를 불러오지 못했습니다.
        </div>
      )}

      {!isLoading && !error && (
        <div className={styles.grid}>
          {characters.map((char, idx) => (
            <CharacterCard
              key={char.id}
              character={char}
              numberBadge={`B${String(idx + 1).padStart(2, '0')}`}
            />
          ))}
        </div>
      )}
    </main>
  );
}
