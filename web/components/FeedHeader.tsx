'use client';

import { useRouter } from 'next/navigation';
import styles from './FeedHeader.module.css';

/**
 * 섹션 헤더 (RECOMMENDED.feed / TOP.creators / GENRE.catalog / UPCOMING.feed 등).
 *
 * 원본: public/css/style.css .feed-header / .feed-eyebrow / .feed-title / .feed-view-all (L363~415)
 *
 * 구성:
 *   - eyebrow (예: "RECOMMENDED.feed") with leading "›" chevron
 *   - title (예: "추천 캐릭터")
 *   - 선택: viewAllHref + viewAllLabel (예: "VIEW ALL" → /explore)
 *   - 선택: subtitle (Explore 의 EDITOR.PICKS 처럼 한 줄 부제)
 */
interface Props {
  eyebrow: string;
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  subtitle?: string;
}

export function FeedHeader({ eyebrow, title, viewAllHref, viewAllLabel, subtitle }: Props) {
  const router = useRouter();
  return (
    <div className={styles.header}>
      <div className={styles.top}>
        <span className={styles.eyebrow}>
          <span className={styles.chevron}>›</span> {eyebrow}
        </span>
      </div>
      <div className={styles.main}>
        <h2 className={styles.title}>{title}</h2>
        {viewAllHref && (
          <button
            type="button"
            className={styles.viewAll}
            onClick={() => router.push(viewAllHref)}
          >
            {viewAllLabel ?? 'VIEW ALL'} <span className={styles.arrow}>→</span>
          </button>
        )}
      </div>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
