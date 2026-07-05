'use client';

import { useRouter } from 'next/navigation';
import type { CreatorItem } from '@/lib/types';
import { useDragScroll } from '@/lib/useDragScroll';
import { FeedHeader } from './FeedHeader';
import styles from './CreatorRow.module.css';

/**
 * TOP.creators 섹션 — 원본 app.js `_renderLandingCuration` L1850~1867.
 *
 * 동작:
 *   - 가로 스크롤: 모바일은 native `touch-action: pan-x` / 데스크탑은 `useDragScroll` 마우스 드래그
 *   - creators[].handle 클릭 시 `/creator/:handle` (@포함) 이동
 *   - 빈 배열일 땐 섹션 자체 미렌더
 */
interface Props {
  creators: CreatorItem[];
}

export function CreatorRow({ creators }: Props) {
  const router = useRouter();
  const rowRef = useDragScroll<HTMLDivElement>();
  if (!creators?.length) return null;

  return (
    <section className={styles.section}>
      <FeedHeader eyebrow="TOP.creators" title="이번 주 제작자" />
      <div className={styles.row} ref={rowRef}>
        {creators.map((c) => (
          <button
            key={c.handle}
            type="button"
            className={styles.card}
            onClick={() => router.push(`/creator/${encodeURIComponent(c.handle)}`)}
          >
            <div className={styles.avatar}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.img} alt="" />
            </div>
            <span className={styles.handle}>{c.handle}</span>
            <span className={styles.count}>{c.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
