'use client';

import { useRouter } from 'next/navigation';
import { LandingHeader } from '@/components/LandingHeader';
import { CharacterCard } from '@/components/CharacterCard';
import { useCharacters } from '@/lib/hooks';
import styles from './page.module.css';

/**
 * 홈 (랜딩) — `/`
 *
 * 원본: public/index.html  #screen-landing (라인 35~129)
 *
 * 구조:
 *   - <LandingHeader>             — Foli 로고 + ALL/18+ + 알림 벨
 *   - RECOMMENDED.feed            — 추천 캐릭터 + VIEW ALL → /explore
 *     · char-grid (2열, 캐릭터 카드 N개)
 *   - (백로그) 공지 캐러셀 / TOP.creators / GENRE.catalog / UPCOMING / FOOTER
 *     → 후속 Day (3.x)에서 추가
 *
 * 백엔드:
 *   - GET /api/characters     useCharacters() (SWR)
 *     · user.adult_content_enabled에 따라 서버에서 필터링됨
 *     · 헤더의 ALL/18+ 토글이 PATCH → mutate(/api/characters)로 갱신
 */
export default function HomePage() {
  const router = useRouter();
  const { characters, error, isLoading } = useCharacters();

  return (
    <div className={styles.pageWrap}>
      <LandingHeader />

      <div className={styles.pageBody}>
        <section className={styles.section}>
          <div className={styles.feedHeader}>
            <div className={styles.feedHeaderTop}>
              <span className={styles.feedEyebrow}>
                <span className={styles.feedChevron}>›</span> RECOMMENDED.feed
              </span>
            </div>
            <div className={styles.feedHeaderMain}>
              <h2 className={styles.feedTitle}>추천 캐릭터</h2>
              <button
                type="button"
                className={styles.feedViewAll}
                onClick={() => router.push('/explore')}
              >
                VIEW ALL <span className={styles.feedArrow}>→</span>
              </button>
            </div>
          </div>

          {isLoading && (
            <p className={styles.stateMsg}>불러오는 중...</p>
          )}
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
      </div>
    </div>
  );
}
