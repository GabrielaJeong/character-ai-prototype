'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCharacters } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { matchesQuery } from '@/lib/search';
import { CHART_DATA, CHART_LABELS, type ChartSort } from '@/lib/exploreChart';
import { CharacterCard } from '@/components/CharacterCard';
import styles from './page.module.css';

/**
 * 탐색 — `/explore`
 *
 * 원본: index.html L779~835 (#screen-explore) + app.js loadExplore / _renderChart (L1610~1834).
 *
 * 구현:
 *   - 큐레이션 뷰: 검색(초성, 300ms debounce) + 태그 바(다중 AND) + char grid
 *   - 랭킹 뷰: mock 차트 (일간/주간/월간 TOP 20)
 *
 * 미완 (Day 10.3):
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
        <RankingView />
      )}
    </div>
  );
}

/** 랭킹 뷰 — mock 차트 (일간/주간/월간 TOP 20). 원본 _renderChart. */
function RankingView() {
  const [sort, setSort] = useState<ChartSort>('weekly');
  const label = CHART_LABELS[sort];
  const data = CHART_DATA[sort];

  return (
    <div className={styles.rankingWrap}>
      <div className={styles.chartHeader}>
        <span className={styles.chartEyebrow}>
          <span className={styles.chartChevron}>›</span> {label.eyebrow}
        </span>
        <h2 className={styles.chartTitle}>{label.title}</h2>
        <p className={styles.chartDate}>{label.date()}</p>
      </div>

      <div className={styles.chartSortBar}>
        {(['daily', 'weekly', 'monthly'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.chartSortBtn} ${sort === s ? styles.chartSortBtnActive : ''}`}
            onClick={() => setSort(s)}
          >
            {s === 'daily' ? '일간' : s === 'weekly' ? '주간' : '월간'}
          </button>
        ))}
      </div>

      <div className={styles.chartList}>
        {data.map((item) => (
          <div key={item.rank} className={styles.chartRow}>
            <span className={styles.chartRank}>#{item.rank}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.chartAvatar} src={item.img} alt={item.name} />
            <div className={styles.chartInfo}>
              <span className={styles.chartName}>{item.name}</span>
              <span className={styles.chartMeta}>{item.role} · {item.chats} chats</span>
            </div>
            <span
              className={`${styles.chartChange} ${
                item.dir === 'up' ? styles.chartChangeUp
                : item.dir === 'down' ? styles.chartChangeDown
                : styles.chartChangeNone
              }`}
            >
              {item.dir === 'up' ? `▲ ${item.change}`
                : item.dir === 'down' ? `▼ ${item.change}`
                : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
