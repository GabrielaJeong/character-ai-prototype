'use client';

import { useRouter } from 'next/navigation';
import type { GenreItem } from '@/lib/types';
import { FeedHeader } from './FeedHeader';
import styles from './GenreRow.module.css';

/**
 * GENRE.catalog 섹션 — 원본 app.js `_renderLandingCuration` L1869~1890.
 *
 * 동작:
 *   - 가로 스크롤 (drag/swipe). 카드 클릭 → `/explore?tag=<label>` 으로 이동
 *   - 빈 배열일 땐 섹션 자체 미렌더
 *
 * 카드:
 *   - 130x170 background-image 카드 + 어두운 그라디언트 오버레이
 *   - 라벨(아이브로우) / 타이틀 / 카운트 3단 구성
 */
interface Props {
  genres: GenreItem[];
}

export function GenreRow({ genres }: Props) {
  const router = useRouter();
  if (!genres?.length) return null;

  return (
    <section className={styles.section}>
      <FeedHeader
        eyebrow="GENRE.catalog"
        title="장르로 찾아보기"
        viewAllHref="/explore"
        viewAllLabel="ALL"
      />
      <div className={styles.row}>
        {genres.map((g) => (
          <button
            key={g.label}
            type="button"
            className={styles.card}
            style={{ backgroundImage: `url('${g.img}')` }}
            onClick={() => router.push(`/explore?tag=${encodeURIComponent(g.label)}`)}
          >
            <div className={styles.overlay}>
              <span className={styles.label}>{g.label}</span>
              <span className={styles.title}>{g.title}</span>
              <span className={styles.count}>{g.count}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
