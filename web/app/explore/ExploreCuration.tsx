'use client';

import { useEffect, useRef, useState } from 'react';
import { useCuration } from '@/lib/hooks';
import { FeedHeader } from '@/components/FeedHeader';
import styles from './ExploreCuration.module.css';

/**
 * Explore 큐레이션 섹션 — BROADCAST 캐러셀 / TAG.CLOUD / EDITOR.PICKS.
 *
 * 원본: app.js _renderExploreCuration (L1916~1984) + style.css L4729~4928.
 * 데이터: useCuration() 의 broadcast / tags / collections.
 *
 * 검색·태그 필터가 active일 땐 이 섹션을 숨기고 결과 grid에 집중 (원본은 항상 표시였으나 UX 개선).
 */
export function ExploreCuration() {
  const { curation } = useCuration();
  const broadcast = curation?.broadcast ?? [];
  const tags = curation?.tags ?? [];
  const collections = curation?.collections ?? [];

  return (
    <div className={styles.wrap}>
      {broadcast.length > 0 && <BroadcastCarousel items={broadcast} />}

      {tags.length > 0 && (
        <div className={styles.tagCloud}>
          <FeedHeader eyebrow="TAG.CLOUD" title="지금 자주 쓰이는 태그" />
          <div className={styles.tagPills}>
            {tags.map((t) => (
              <span key={t} className={styles.tagPill}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {collections.length > 0 && (
        <div className={styles.editorPicks}>
          <FeedHeader
            eyebrow="EDITOR.PICKS"
            title="이번 달의 큐레이션"
            viewAllHref="/explore"
            viewAllLabel="ARCHIVE"
            subtitle="주제로 묶인 캐릭터 시리즈."
          />
          <div className={styles.collectionList}>
            {collections.map((col) => (
              <div key={col.num} className={styles.collectionCard}>
                <div
                  className={styles.collectionImg}
                  style={{ backgroundImage: `url('${col.img}')` }}
                />
                <div className={styles.collectionInner}>
                  <div>
                    <div className={styles.collectionNum}>{col.num}</div>
                    <h3 className={styles.collectionTitle}>{col.title}</h3>
                  </div>
                  <p className={styles.collectionMeta}>{col.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** BROADCAST 배너 캐러셀 — 4초 auto-advance + dots + 스와이프. 원본 bc-carousel + _bcGo. */
function BroadcastCarousel({ items }: { items: { title: string; subtitle: string; img: string }[] }) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(t);
  }, [items.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff < -40 && idx < items.length - 1) setIdx(idx + 1);
    if (diff > 40 && idx > 0) setIdx(idx - 1);
    touchStartX.current = null;
  };

  return (
    <div className={styles.bcCarousel}>
      <div
        className={styles.bcTrack}
        style={{ transform: `translateX(${-idx * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {items.map((bc, i) => (
          <div key={i} className={styles.broadcastBanner}>
            <div className={styles.broadcastImg} style={{ backgroundImage: `url('${bc.img}')` }} />
            <div className={styles.broadcastInner}>
              <div className={styles.broadcastBadge}>
                <span className={styles.broadcastDot} />
                BROADCAST · NOW
              </div>
              <h3 className={styles.broadcastTitle}>
                {bc.title.split('\n').map((line, j) => (
                  <span key={j}>{line}{j < bc.title.split('\n').length - 1 && <br />}</span>
                ))}
              </h3>
              <p className={styles.broadcastMeta}>{bc.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className={styles.bcDots}>
          {items.map((_, i) => (
            <span
              key={i}
              className={`${styles.bcDot} ${i === idx ? styles.bcDotActive : ''}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
