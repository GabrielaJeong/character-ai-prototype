'use client';

import type { UpcomingItem } from '@/lib/types';
import { FeedHeader } from './FeedHeader';
import styles from './UpcomingGrid.module.css';

/**
 * UPCOMING.feed 섹션 — 원본 app.js `_renderLandingCuration` L1892~1910.
 *
 * - 2열 그리드, 카드는 disabled 상태 (.char-card-disabled + .char-card-pending-overlay)
 * - 클릭 불가, "준비중" 배지 표시
 * - 빈 배열이면 섹션 자체 미렌더
 */
interface Props {
  upcoming: UpcomingItem[];
}

export function UpcomingGrid({ upcoming }: Props) {
  if (!upcoming?.length) return null;

  return (
    <section className={styles.section}>
      <FeedHeader eyebrow="UPCOMING.feed" title="다가오는 캐릭터" />
      <div className={styles.grid}>
        {upcoming.map((u) => (
          <div key={u.name} className={styles.card} aria-disabled="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.img} src={u.img} alt="" />
            <div className={styles.overlay}>
              <div className={styles.name}>{u.name}</div>
              <div className={styles.role}>{u.role}</div>
            </div>
            <div className={styles.pendingOverlay}>
              <span className={styles.pendingLabel}>준비중</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
