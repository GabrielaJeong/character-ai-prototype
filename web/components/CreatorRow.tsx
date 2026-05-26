'use client';

import { useRouter } from 'next/navigation';
import type { CreatorItem } from '@/lib/types';
import { FeedHeader } from './FeedHeader';
import styles from './CreatorRow.module.css';

/**
 * TOP.creators 섹션 — 원본 app.js `_renderLandingCuration` L1850~1867.
 *
 * 동작:
 *   - 가로 스크롤 (drag/swipe), creators[].handle 클릭 시 `/creator/:handle` (@포함) 이동
 *   - 데스크탑 마우스 drag 슬라이딩은 원본 `initDragSlider`. Phase A에서는 native scroll만 (간소화)
 *   - 빈 배열일 땐 섹션 자체 미렌더
 *
 * 모바일:
 *   - touch-action: pan-x
 *   - 카드 자체는 touch-action: manipulation (pan-x 컨테이너 내 클릭 충돌 방지)
 */
interface Props {
  creators: CreatorItem[];
}

export function CreatorRow({ creators }: Props) {
  const router = useRouter();
  if (!creators?.length) return null;

  return (
    <section className={styles.section}>
      <FeedHeader eyebrow="TOP.creators" title="이번 주 제작자" />
      <div className={styles.row}>
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
