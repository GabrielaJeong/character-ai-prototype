'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCharacters } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { matchesQuery } from '@/lib/search';
import { CharacterCard } from '@/components/CharacterCard';
import styles from './page.module.css';

/**
 * 탐색 — `/explore`
 *
 * 원본: index.html L779~835 (#screen-explore) + app.js loadExplore / _applyExploreFilter (L1610~1708).
 *
 * Day 10.1 범위 (큐레이션 뷰):
 *   - 검색 (이름·태그·설명 + 초성, 300ms debounce)
 *   - 태그 바 (추천 태그 + 캐릭터 태그, 다중 선택 AND)
 *   - char grid (CharacterCard 재사용)
 *   - 뷰 탭 (큐레이션 / 랭킹) — 랭킹은 Day 10.2 placeholder
 *
 * Day 10.2 (다음):
 *   - 랭킹 차트 (mock 데이터)
 *   - BROADCAST 배너 / TAG.CLOUD / EDITOR.PICKS 큐레이션 섹션
 */
const SUGGESTED_TAGS = [
  '현실', '판타지', '초자연', '로맨스', '액션', '일상',
  '다정', '차가운', '다혈질', '과묵', '밝은', '어두운',
];

type View = 'curation' | 'ranking';

export default function ExplorePage() {
  const { characters, isLoading } = useCharacters();
  const setAppReady = useUIStore((s) => s.setAppReady);

  const [view, setView] = useState<View>('curation');
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // 검색어 300ms debounce (원본 _exploreDebounce)
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // 태그 바: 추천 태그 + 캐릭터에서 수집한 태그 (중복 제거)
  const allTags = useMemo(() => {
    const merged = [...SUGGESTED_TAGS];
    characters.forEach((c) => (c.tags ?? []).forEach((t) => {
      if (!merged.includes(t)) merged.push(t);
    }));
    return merged;
  }, [characters]);

  // 필터: 검색어 매칭 && 선택 태그 모두 포함(AND)
  const results = useMemo(() => {
    return characters.filter((c) => {
      const matchSearch = matchesQuery(c, query);
      const matchTags =
        activeTags.size === 0 || [...activeTags].every((tag) => (c.tags ?? []).includes(tag));
      return matchSearch && matchTags;
    });
  }, [characters, query, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="page-wrap">
      <div className={styles.tabHeader}>
        <span className={styles.tabTitle}>탐색</span>
      </div>

      {/* 뷰 탭 (큐레이션 / 랭킹) */}
      <div className={styles.viewTabs}>
        <button
          type="button"
          className={`${styles.viewTab} ${view === 'curation' ? styles.viewTabActive : ''}`}
          onClick={() => setView('curation')}
        >
          큐레이션
        </button>
        <button
          type="button"
          className={`${styles.viewTab} ${view === 'ranking' ? styles.viewTabActive : ''}`}
          onClick={() => setView('ranking')}
        >
          랭킹
        </button>
      </div>

      {view === 'curation' ? (
        <>
          {/* 검색 */}
          <div className={styles.searchWrap}>
            <div className={styles.searchRow}>
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="7.5" cy="7.5" r="5" />
                <line x1="11.5" y1="11.5" x2="16" y2="16" />
              </svg>
              <input
                type="text"
                className={styles.searchInput}
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setRawQuery(''); }}
                placeholder="이름, 태그, 설명 검색"
                autoComplete="off"
              />
            </div>
          </div>

          {/* 태그 바 */}
          <div className={styles.tagBar}>
            <button
              type="button"
              className={`${styles.tagChip} ${activeTags.size === 0 ? styles.tagChipActive : ''}`}
              onClick={() => setActiveTags(new Set())}
            >
              전체
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`${styles.tagChip} ${activeTags.has(tag) ? styles.tagChipActive : ''}`}
                onClick={() => toggleTag(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>

          {/* 결과 grid */}
          <div className={styles.body}>
            {isLoading && <p className={styles.empty}>불러오는 중...</p>}
            {!isLoading && results.length === 0 && (
              <p className={styles.empty}>검색 결과가 없습니다.</p>
            )}
            {!isLoading && results.length > 0 && (
              <div className={styles.grid}>
                {results.map((c, i) => (
                  <CharacterCard key={c.id} character={c} index={i} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.body}>
          <p className={styles.empty}>랭킹은 준비 중입니다.</p>
        </div>
      )}
    </div>
  );
}
