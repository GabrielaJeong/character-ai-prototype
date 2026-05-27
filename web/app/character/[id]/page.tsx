'use client';

import { useEffect, useState } from 'react';
import { useRouter, notFound } from 'next/navigation';
import Image from 'next/image';
import { useCharacters } from '@/lib/hooks';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import { fmtK } from '@/lib/format';
import { IntroAccordion } from '@/components/IntroAccordion';
import styles from './page.module.css';

/**
 * 캐릭터 인트로 — `/character/[id]`
 *
 * 원본: public/index.html L185~303 #screen-intro + app.js populateIntroScreen (L355~486)
 *
 * 구조:
 *   1. Hero (이미지 + 그라디언트 오버레이 + floating nav)
 *      - 뒤로가기 / [Safety segment placeholder] / 좋아요 / 책갈피 / 더보기
 *   2. Identity block (role · world / name / nameEn)
 *   3. Stats bar (CHATS / LIKES)
 *   4. Created.By (유저 제작 캐릭터인 경우)
 *   5. 탭바 (ABOUT / NOTES / COMMENTS) + 패널 전환
 *   6. ABOUT panel: 카드 grid + traits + opening line + description + worldbuilding accordion
 *   7. NOTES panel: creator note + rules + tip + footer
 *   8. COMMENTS placeholder
 *   9. Bottom CTA "대화 시작 →"
 *
 * 데이터 소스:
 *   - useCharacters() 목록에서 id로 find — 원본 SPA의 `characters.find(c => c.id === id)` 패턴과 동일
 *   - /api/characters/:id (단건 endpoint)은 stats/badge merge가 안 돼있어서 미사용
 *
 * 미구현 (다음 Day로 이연):
 *   - Safety segment 토글 (Day 6 chat 작업과 함께)
 *   - 좋아요는 클라이언트 토스트만 (백엔드 없음 — 원본 _likedIds Set과 동일)
 *   - 책갈피는 /api/bookmarks/:id 연결 (인증 게이트 포함)
 *   - Follow 버튼은 토스트만 (백엔드 없음)
 */
type Tab = 'about' | 'notes' | 'comments';

export default function CharacterIntroPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { characters, isLoading } = useCharacters();
  const user = useAuthStore((s) => s.user);
  const showAuthGate = useUIStore((s) => s.showAuthGate);
  const showToast = useUIStore((s) => s.showToast);
  const setAppReady = useUIStore((s) => s.setAppReady);

  const [tab, setTab] = useState<Tab>('about');
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const char = characters.find((c) => c.id === params.id) ?? null;

  // Splash dismiss 신호 — 캐릭터 데이터 로드 완료 시점
  useEffect(() => {
    if (!isLoading) setAppReady(true);
  }, [isLoading, setAppReady]);

  // 로딩 끝났는데 해당 id 없으면 not-found 처리 (Next.js 표준 notFound)
  if (!isLoading && !char) notFound();

  if (isLoading || !char) {
    return <div className={styles.wrap}><p className={styles.stateMsg}>불러오는 중...</p></div>;
  }

  // ── 핸들러 ────────────────────────────────────────────────
  const onBack = () => router.push('/');

  const onLike = () => {
    if (!user) {
      showAuthGate({
        title: '좋아요',
        desc: '좋아요를 누르려면 로그인이 필요합니다.',
        intendedPath: `/character/${char.id}`,
      });
      return;
    }
    setLiked((v) => !v);
    showToast(liked ? '좋아요를 취소했습니다.' : '좋아요를 눌렀습니다.');
  };

  const onBookmark = async () => {
    if (!user) {
      showAuthGate({
        title: '책갈피',
        desc: '책갈피를 사용하려면 로그인이 필요합니다.',
        intendedPath: `/character/${char.id}`,
      });
      return;
    }
    try {
      if (bookmarked) {
        await api.delete(`/api/bookmarks/${char.id}`);
        setBookmarked(false);
        showToast('책갈피를 해제했습니다.');
      } else {
        await api.post(`/api/bookmarks/${char.id}`);
        setBookmarked(true);
        showToast('책갈피에 추가했습니다.');
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '오류가 발생했습니다.');
    }
  };

  const onMore = () => showToast('준비 중입니다.');
  // 페르소나 setup → /persona가 redirect 결정 (기존 페르소나 있으면 select, 없으면 new)
  const onStartChat = () => router.push(`/persona?char=${encodeURIComponent(char.id)}`);

  // ── 파생값 ────────────────────────────────────────────────
  const roleLabel = [char.role, char.about?.world]
    .filter(Boolean)
    .map((s) => s!.toUpperCase())
    .join('  ·  ');
  const sessions = char.stats?.sessions ?? 0;
  const bookmarksCount = char.stats?.bookmarks ?? 0;
  const isUserCreated = char.id.startsWith('char_') && !!char.owner_username;

  const aboutCards = [
    { label: 'WORLD', value: char.about?.world },
    { label: 'AVG.LENGTH', value: char.about?.avg_length },
    { label: 'TONE', value: char.about?.tone },
  ].filter((c): c is { label: string; value: string } => !!c.value);

  return (
    <div className={styles.wrap}>
      <div className={styles.wrapper}>
        {/* ── Hero ─────────────────────────────────────── */}
        <div className={styles.hero}>
          {char.image ? (
            <Image
              src={char.image}
              alt={char.name}
              fill
              sizes="(max-width: 430px) 100vw, 430px"
              className={styles.heroImg}
              unoptimized
              priority
            />
          ) : (
            <div className={styles.heroPlaceholder}>{char.name[0]}</div>
          )}
          <div className={styles.heroOverlay} />

          {/* Floating nav */}
          <div className={styles.floatNav}>
            <button type="button" className={styles.navBtn} onClick={onBack} aria-label="뒤로">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 4 5 9 11 14" />
              </svg>
            </button>
            <div className={styles.floatNavRight}>
              {/* TODO: Safety segment — Day 6 chat 작업과 함께 */}
              <button
                type="button"
                className={`${styles.actionBtn} ${liked ? styles.actionActive : ''}`}
                onClick={onLike}
                aria-label="좋아요"
                aria-pressed={liked}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${bookmarked ? styles.actionActive : ''}`}
                onClick={onBookmark}
                aria-label="책갈피"
                aria-pressed={bookmarked}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                </svg>
              </button>
              <button type="button" className={styles.actionBtn} onClick={onMore} aria-label="더보기">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ────────────────────────── */}
        <div className={styles.scroll}>
          {/* Identity */}
          <div className={styles.identity}>
            {roleLabel && <p className={styles.roleLabel}>{roleLabel}</p>}
            <h1 className={styles.name}>{char.name}</h1>
            {char.nameEn && <p className={styles.nameEn}>{char.nameEn}</p>}
          </div>

          {/* Stats */}
          <div className={styles.statsBar}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{fmtK(sessions)}</span>
              <span className={styles.statLabel}>CHATS</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{fmtK(bookmarksCount)}</span>
              <span className={styles.statLabel}>LIKES</span>
            </div>
          </div>

          {/* Created.By */}
          {isUserCreated && (
            <div className={styles.createdBy}>
              <span className={styles.sectionLabel}>CREATED.BY</span>
              <div className={styles.creatorRow}>
                <div className={styles.creatorAvatar}>{char.owner_username![0].toUpperCase()}</div>
                <div className={styles.creatorInfo}>
                  <span className={styles.creatorHandle}>@{char.owner_username}</span>
                  <span className={styles.verifiedBadge}>VERIFIED</span>
                </div>
                <button
                  type="button"
                  className={styles.followBtn}
                  onClick={() => router.push(`/creator/@${char.owner_username}`)}
                >
                  FOLLOW
                </button>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className={styles.tabBar} role="tablist">
            {(['about', 'notes', 'comments'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => setTab(t)}
                aria-selected={tab === t}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Panels */}
          {tab === 'about' && (
            <div className={styles.panel}>
              {aboutCards.length > 0 && (
                <div className={styles.aboutGrid}>
                  {aboutCards.map((c) => (
                    <div key={c.label} className={styles.aboutCard}>
                      <span className={styles.aboutCardLabel}>{c.label}</span>
                      <span className={styles.aboutCardVal}>{c.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {char.about?.traits && char.about.traits.length > 0 && (
                <div className={styles.traitsWrap}>
                  <span className={styles.sectionLabel}>TRAITS</span>
                  <div className={styles.traits}>
                    {char.about.traits.map((t) => (
                      <span key={t} className={styles.traitChip}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {char.about?.opening_line && (
                <div className={styles.openingWrap}>
                  <span className={styles.sectionLabel}>OPENING LINE</span>
                  <div className={styles.openingBubble}>{char.about.opening_line}</div>
                </div>
              )}
              {char.description && char.description.length > 0 && (
                <div className={styles.descWrap}>
                  <span className={styles.sectionLabel}>ABOUT</span>
                  <div className={styles.descBody}>
                    {char.description.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              )}
              {char.worldbuilding && (
                <IntroAccordion title="세계관">{char.worldbuilding}</IntroAccordion>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div className={styles.panel}>
              <NotesPanel char={char} />
            </div>
          )}

          {tab === 'comments' && (
            <div className={styles.panel}>
              <div className={styles.commentsSoon}>
                <p className={styles.commentsLabel}>COMMENTS</p>
                <p className={styles.commentsSub}>곧 오픈됩니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className={styles.bottomBar}>
        <button type="button" className={styles.startBtn} onClick={onStartChat}>
          대화 시작 →
        </button>
      </div>
    </div>
  );
}

/**
 * NOTES 패널 분기. 원본 app.js L460~478과 동일.
 */
function NotesPanel({ char }: { char: NonNullable<ReturnType<typeof useCharacters>['characters']>[number] }) {
  const notes = char.notes;
  const hasContent = !!(notes?.creator_note || notes?.rules?.length || notes?.tip || notes?.notes_by || notes?.notes_date);
  if (!hasContent) return <p className={styles.notesEmpty}>노트가 없습니다.</p>;
  return (
    <div className={styles.notesBody}>
      {notes?.creator_note && (
        <div className={styles.notesSection}>
          <p className={styles.sectionLabel}>FROM.CREATOR</p>
          <p className={styles.notesText}>{notes.creator_note}</p>
        </div>
      )}
      {notes?.rules && notes.rules.length > 0 && (
        <div className={styles.notesSection}>
          <p className={styles.sectionLabel}>RULES</p>
          <ol className={styles.rulesList}>
            {notes.rules.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        </div>
      )}
      {notes?.tip && (
        <div className={styles.tipCard}>
          <span className={styles.tipLabel}>TIP</span>
          <p className={styles.tipText}>{notes.tip}</p>
        </div>
      )}
      {(notes?.notes_by || notes?.notes_date) && (
        <p className={styles.notesFooter}>
          NOTES BY {notes.notes_by || ''} · {notes.notes_date || ''}
        </p>
      )}
    </div>
  );
}
