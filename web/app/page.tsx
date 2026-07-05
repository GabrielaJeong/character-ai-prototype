'use client';

import { useEffect } from 'react';
import { LandingHeader } from '@/components/LandingHeader';
import { CharacterCard } from '@/components/CharacterCard';
import { FeedHeader } from '@/components/FeedHeader';
import { NoticeCarousel } from '@/components/NoticeCarousel';
import { CreatorRow } from '@/components/CreatorRow';
import { GenreRow } from '@/components/GenreRow';
import { UpcomingGrid } from '@/components/UpcomingGrid';
import { SiteFooter } from '@/components/SiteFooter';
import { useCharacters, useCuration } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import styles from './page.module.css';

/**
 * 홈 (랜딩) — `/`
 *
 * 원본: public/index.html  #screen-landing (라인 35~129)
 *
 * 구조:
 *   1. <LandingHeader>             — Foli 로고 + ALL/18+ + 알림 벨
 *   2. RECOMMENDED.feed            — 추천 캐릭터 char-grid + VIEW ALL → /explore
 *   3. <NoticeCarousel>            — 공지 캐러셀 (정적)
 *   4. <CreatorRow>                — TOP.creators
 *   5. <GenreRow>                  — GENRE.catalog
 *   6. <UpcomingGrid>              — UPCOMING.feed (준비중 카드)
 *   7. <SiteFooter>                — 푸터 (버전 표기 + LEGAL/SUPPORT/legal)
 *
 * 백엔드:
 *   - GET /api/characters    useCharacters() (SWR) — 헤더의 18+ 토글이 mutate
 *   - GET /api/curation      useCuration() (SWR)
 *   - GET /api/version       useAppVersion() — 푸터 내에서 직접 호출
 */
export default function HomePage() {
  const { characters, error, isLoading } = useCharacters();
  const { curation } = useCuration();
  const setAppReady = useUIStore((s) => s.setAppReady);

  // 캐릭터 데이터 로드 끝나면 splash dismiss 가능 신호.
  // 원본 SPA app.js의 _dataReady = true 와 동일 (loadCharacters 후).
  useEffect(() => {
    if (!isLoading) setAppReady(true);
  }, [isLoading, setAppReady]);

  return (
    <div className={styles.pageWrap}>
      <LandingHeader />

      <div className={styles.pageBody}>
        {/* ── RECOMMENDED ─────────────────────────────────── */}
        <section className={styles.section}>
          <FeedHeader
            eyebrow="RECOMMENDED.feed"
            title="추천 캐릭터"
            viewAllHref="/explore"
            viewAllLabel="VIEW ALL"
          />
          {isLoading && <p className={styles.stateMsg}>불러오는 중...</p>}
          {error && !isLoading && (
            <p className={styles.stateMsg}>캐릭터를 불러오지 못했습니다.</p>
          )}
          {!isLoading && !error && characters.length === 0 && (
            <p className={styles.stateMsg}>표시할 캐릭터가 없습니다.</p>
          )}
          {!isLoading && !error && characters.length > 0 && (
            <div className={styles.charGrid}>
              {characters.map((c, i) => (
                <CharacterCard key={c.id} character={c} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* ── 공지 캐러셀 ─────────────────────────────────── */}
        <section className={styles.section}>
          <NoticeCarousel />
        </section>

        {/* ── 큐레이션 (TOP.creators / GENRE / UPCOMING) ─── */}
        {curation && (
          <>
            <CreatorRow creators={curation.creators ?? []} />
            <GenreRow genres={curation.genres ?? []} />
            <UpcomingGrid upcoming={curation.upcoming ?? []} />
          </>
        )}

        {/* ── 푸터 ───────────────────────────────────────── */}
        <SiteFooter />
      </div>
    </div>
  );
}
