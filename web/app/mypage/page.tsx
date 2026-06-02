'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useAdultContent } from '@/lib/useAdultContent';
import {
  usePersonas,
  useCharacters,
  useBookmarks,
  useAppVersion,
} from '@/lib/hooks';
import { api, ApiError } from '@/lib/api';
import type { Persona, Character, User } from '@/lib/types';
import { MypageInfoModal } from './MypageInfoModal';
import styles from './page.module.css';

/**
 * 마이페이지 — `/mypage`
 *
 * 원본: index.html L1013~1169 (#screen-mypage) + style.css L3721~4505 + app.js (mypage 관련).
 *
 * 1차 (Day 8.1) 범위:
 *   - 프로필 카드 (avatar/nickname/email/CREATOR 뱃지) — EDIT/avatar 업로드는 toast (Day 8.2/8.3)
 *   - 설정 섹션 (정보수정 → toast, adult toggle → display only, 모델/토큰 display)
 *   - 탭 (페르소나/캐릭터/책갈피) — count + active indicator
 *   - 페르소나 패널: usePersonas + set-default + delete + edit
 *   - 캐릭터 패널: useCharacters 중 owner_username 매칭 + delete + 새 캐릭터 만들기
 *   - 책갈피 패널: useBookmarks 교집합 + 카드
 *   - 메뉴 리스트 (좋아요/크리에이터/어드민/팔로잉/설정/지원/로그아웃)
 *   - 푸터 (버전 + 탈퇴 button → toast)
 *
 * 다음 단계:
 *   - Day 8.2: 정보 수정 모달 (닉네임/이메일/비번) + adult 인증 모달 + adult 토글 동작
 *   - Day 8.3: 탈퇴 모달 + 아바타 업로드
 */
type Tab = 'persona' | 'chars' | 'bookmark';

export default function MypagePage() {
  const router = useRouter();
  const { user, ready } = useRequireAuth('/mypage', {
    title: '마이페이지',
    desc: '마이페이지를 보려면 로그인이 필요합니다.',
  });
  const setUser = useAuthStore((s) => s.setUser);
  const showToast = useUIStore((s) => s.showToast);
  const showDeleteConfirm = useUIStore((s) => s.showDeleteConfirm);
  const openLogout = useUIStore((s) => s.openLogout);
  const setAppReady = useUIStore((s) => s.setAppReady);
  const version = useAppVersion();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { personas, mutate: mutatePersonas } = usePersonas();
  const { characters, mutate: mutateCharacters } = useCharacters();
  const { bookmarks, mutate: mutateBookmarks } = useBookmarks();
  const { setAdult } = useAdultContent();

  const [tab, setTab] = useState<Tab>('persona');
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  if (!ready || !user) {
    return <div className={styles.wrap} />;
  }

  const myChars = characters.filter(
    (c) => c.id.startsWith('char_') && c.owner_username === user.username,
  );
  const bookmarkedChars = characters.filter((c) => bookmarks.includes(c.id));
  const personaCount = personas.length;
  const charsCount = myChars.length;
  const bookmarkCount = bookmarks.length;

  const initial = (user.nickname || user.email || '?')[0].toUpperCase();
  const isCreator = !!user.username && myChars.length > 0;
  const isAdmin = user.role === 'admin';

  // ── 페르소나 액션 ────────────────────────────────────
  const onSetDefault = async (p: Persona) => {
    try {
      await api.patch(`/api/personas/${p.id}/set-default`);
      // user.default_persona_id 업데이트 (Setting it locally for immediate UI feedback)
      useAuthStore.getState().setUser({ ...user, default_persona_id: p.id });
      await mutatePersonas();
      showToast('기본 페르소나로 설정되었습니다.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '실패했습니다.');
    }
  };
  const onDeletePersona = (p: Persona) => {
    showDeleteConfirm({
      title: `"${p.data.name || '이름 없음'}" 페르소나를 삭제하시겠습니까?`,
      desc: '삭제된 페르소나는 복구할 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await api.delete(`/api/personas/${p.id}`);
          await mutatePersonas();
          showToast('페르소나가 삭제되었습니다.');
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '실패했습니다.');
        }
      },
    });
  };
  const onEditPersona = (p: Persona) => {
    // 페르소나 detail/edit 페이지는 후속. 지금은 toast.
    showToast('페르소나 편집은 준비 중입니다.');
  };

  // ── 캐릭터 액션 ──────────────────────────────────────
  const onDeleteChar = (c: Character) => {
    showDeleteConfirm({
      title: `"${c.name}" 캐릭터를 삭제하시겠습니까?`,
      desc: '삭제된 캐릭터는 복구할 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await api.delete(`/api/characters/${c.id}`);
          await mutateCharacters();
          showToast('캐릭터가 삭제되었습니다.');
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '실패했습니다.');
        }
      },
    });
  };
  const onEditChar = (c: Character) => {
    // 빌더 편집은 추후. 지금은 toast.
    showToast('캐릭터 편집은 준비 중입니다.');
  };

  // ── 책갈피 액션 ──────────────────────────────────────
  const onUnbookmark = async (charId: string) => {
    try {
      await api.delete(`/api/bookmarks/${charId}`);
      await mutateBookmarks();
      showToast('책갈피에서 제거되었습니다.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '실패했습니다.');
    }
  };

  // ── 아바타 업로드 ────────────────────────────────────
  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능하도록 리셋
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('이미지는 5MB 이하만 업로드 가능합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const avatarData = ev.target?.result;
      if (typeof avatarData !== 'string') return;
      try {
        const data = await api.patch<{ user: User }>('/api/auth/me', { avatarData });
        setUser(data.user);
        showToast('프로필 사진이 변경되었습니다.');
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : '사진 업로드에 실패했습니다.');
      }
    };
    reader.readAsDataURL(file);
  };

  // ── 탈퇴 ─────────────────────────────────────────────
  const onWithdraw = () => {
    showDeleteConfirm({
      title: '정말 탈퇴하시겠습니까?',
      desc: '모든 대화, 페르소나, 제작 캐릭터가 삭제됩니다. 복구할 수 없습니다.',
      confirmLabel: '탈퇴',
      onConfirm: async () => {
        try {
          await api.delete('/api/auth/me');
          setUser(null);
          showToast('탈퇴가 완료되었습니다.');
          router.push('/');
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '탈퇴에 실패했습니다.');
        }
      },
    });
  };

  return (
    <div className="page-wrap">
      <div className={styles.tabHeader}>
        <span className={styles.tabTitle}>마이페이지</span>
      </div>

      <div className={styles.body}>
        {/* 프로필 카드 */}
        <div className={styles.profileCard}>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => setInfoModalOpen(true)}
          >
            EDIT
          </button>
          <div className={styles.profileRow}>
            <button
              type="button"
              className={styles.avatarWrap}
              onClick={() => avatarInputRef.current?.click()}
              aria-label="아바타 변경"
            >
              {user.avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={user.avatar} alt="" className={styles.avatarImg} />
              ) : (
                <div className={styles.avatar}>
                  <span>{initial}</span>
                </div>
              )}
              <div className={styles.avatarEdit}>✎</div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onAvatarChange}
            />
            <div className={styles.profileInfo}>
              <p className={styles.nickname}>{user.nickname}</p>
              <p className={styles.email}>{user.email}</p>
              {isCreator && (
                <div className={styles.creatorBadge}>
                  <span className={styles.creatorDot} />
                  CREATOR
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 설정 섹션 */}
        <div className={styles.section} style={{ marginTop: 5 }}>
          <button
            type="button"
            className={styles.row}
            onClick={() => setInfoModalOpen(true)}
          >
            <div className={styles.rowLeft}>
              <span className={styles.rowLabel}>내 정보 수정하기</span>
            </div>
            <span className={styles.rowArrow}>›</span>
          </button>
          <div className={`${styles.row} ${styles.rowToggle}`}>
            <div className={styles.rowLeft}>
              <div>
                <span className={styles.rowLabel}>성인 콘텐츠 허용</span>
                <p className={styles.rowSub}>
                  {!user.adult_verified
                    ? '성인 인증 후 이용 가능'
                    : user.adult_content_enabled
                      ? '현재 성인 콘텐츠 표시 중'
                      : '현재 전연령 콘텐츠만 표시'}
                </p>
              </div>
            </div>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={!!user.adult_content_enabled}
                onChange={(e) => setAdult(e.target.checked, '/mypage')}
                aria-label="성인 콘텐츠 허용 토글"
              />
              <span className={styles.toggleThumb} />
            </label>
          </div>
          <div className={`${styles.row} ${styles.rowToggle}`}>
            <div className={styles.rowLeft}>
              <div>
                <span className={styles.rowLabel}>기본 대화 모델</span>
                <p className={styles.rowSub}>Gemini 3.1 Pro</p>
              </div>
            </div>
          </div>
          <div className={`${styles.row} ${styles.rowToggle}`}>
            <div className={styles.rowLeft}>
              <div>
                <span className={styles.rowLabel}>토큰 잔량</span>
                <p className={styles.rowSub}>247,300 / 500,000</p>
              </div>
            </div>
            <div className={styles.tokenRight}>
              <span className={styles.betaBadge}>BETA</span>
              <button
                type="button"
                className={styles.chargeBtn}
                onClick={() => showToast('결제 시스템 준비 중입니다.')}
              >
                충전
              </button>
            </div>
          </div>
        </div>

        {/* 탭 바 */}
        <div className={styles.tabBar} style={{ marginTop: 24 }} role="tablist">
          <button
            type="button"
            role="tab"
            className={`${styles.tabBtn} ${tab === 'persona' ? styles.tabActive : ''}`}
            onClick={() => setTab('persona')}
            aria-selected={tab === 'persona'}
          >
            내 페르소나{personaCount > 0 && <span className={styles.tabCount}>{personaCount}</span>}
          </button>
          <button
            type="button"
            role="tab"
            className={`${styles.tabBtn} ${tab === 'chars' ? styles.tabActive : ''}`}
            onClick={() => setTab('chars')}
            aria-selected={tab === 'chars'}
          >
            내 캐릭터{charsCount > 0 && <span className={styles.tabCount}>{charsCount}</span>}
          </button>
          <button
            type="button"
            role="tab"
            className={`${styles.tabBtn} ${tab === 'bookmark' ? styles.tabActive : ''}`}
            onClick={() => setTab('bookmark')}
            aria-selected={tab === 'bookmark'}
          >
            책갈피{bookmarkCount > 0 && <span className={styles.tabCount}>{bookmarkCount}</span>}
          </button>
          <div
            className={styles.tabIndicator}
            style={{ left: tab === 'persona' ? '0' : tab === 'chars' ? '33.333%' : '66.666%' }}
          />
        </div>

        {/* 페르소나 패널 */}
        {tab === 'persona' && (
          <div className={styles.panel}>
            {personas.length === 0 ? (
              <p className={styles.empty}>아직 페르소나가 없습니다.</p>
            ) : (
              <div className={styles.personaList}>
                {personas.map((p) => (
                  <div
                    key={p.id}
                    className={`${styles.personaCard} ${
                      user.default_persona_id === p.id ? styles.personaCardDefault : ''
                    }`}
                  >
                    <div className={styles.personaInfo}>
                      <div className={styles.personaName}>
                        {p.data.name || '이름 없음'}
                        {user.default_persona_id === p.id && (
                          <span className="default-badge">기본</span>
                        )}
                      </div>
                      <div className={styles.personaMeta}>
                        {[
                          p.data.age ? `${p.data.age}세` : '',
                          p.data.gender === 'male' ? '남' : p.data.gender === 'female' ? '여' : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className={styles.personaActions}>
                      {user.default_persona_id !== p.id && (
                        <button
                          type="button"
                          className={styles.charActionBtn}
                          onClick={() => onSetDefault(p)}
                        >
                          기본으로
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.charActionBtn}
                        onClick={() => onEditPersona(p)}
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        className={`${styles.charActionBtn} ${styles.charActionDanger}`}
                        onClick={() => onDeletePersona(p)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 캐릭터 패널 */}
        {tab === 'chars' && (
          <div className={styles.panel}>
            {myChars.length === 0 ? (
              <p className={styles.empty}>아직 만든 캐릭터가 없습니다.</p>
            ) : (
              <div className={styles.charList}>
                {myChars.map((c) => (
                  <div key={c.id} className={styles.charRow}>
                    <div className={styles.charInfo}>
                      {c.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={c.image} alt={c.name} className={styles.charThumb} />
                      ) : (
                        <div className={styles.charThumbEmpty}>{c.name[0]}</div>
                      )}
                      <button
                        type="button"
                        className={styles.charLink}
                        onClick={() => router.push(`/character/${c.id}`)}
                      >
                        {c.name}
                      </button>
                    </div>
                    <div className={styles.charActions}>
                      <button
                        type="button"
                        className={styles.charActionBtn}
                        onClick={() => onEditChar(c)}
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        className={`${styles.charActionBtn} ${styles.charActionDanger}`}
                        onClick={() => onDeleteChar(c)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => router.push('/builder')}
            >
              + 새 캐릭터 만들기
            </button>
          </div>
        )}

        {/* 책갈피 패널 */}
        {tab === 'bookmark' && (
          <div className={styles.panel}>
            {bookmarkedChars.length === 0 ? (
              <p className={styles.empty} style={{ padding: '48px 0' }}>
                아직 책갈피한 캐릭터가 없습니다.
              </p>
            ) : (
              <div className={styles.charList}>
                {bookmarkedChars.map((c) => (
                  <div key={c.id} className={styles.charRow}>
                    <div className={styles.charInfo}>
                      {c.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={c.image} alt={c.name} className={styles.charThumb} />
                      ) : (
                        <div className={styles.charThumbEmpty}>{c.name[0]}</div>
                      )}
                      <button
                        type="button"
                        className={styles.charLink}
                        onClick={() => router.push(`/character/${c.id}`)}
                      >
                        {c.name}
                      </button>
                    </div>
                    <div className={styles.charActions}>
                      <button
                        type="button"
                        className={`${styles.charActionBtn} ${styles.charActionDanger}`}
                        onClick={() => onUnbookmark(c.id)}
                      >
                        해제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 메뉴 리스트 */}
        <div className={styles.section} style={{ marginTop: 16 }}>
          <button type="button" className={styles.row} onClick={() => showToast('준비 중입니다.')}>
            <div>
              <span className={styles.rowLabel}>좋아요</span>
              <span className={styles.menuEn}>LIKES</span>
            </div>
            <span className={styles.rowArrow}>›</span>
          </button>
          {isCreator && (
            <button
              type="button"
              className={styles.row}
              onClick={() => router.push(`/creator/@${user.username}`)}
            >
              <div>
                <span className={styles.rowLabel}>크리에이터 프로필</span>
                <span className={styles.menuEn}>MY.CREATOR</span>
              </div>
              <span className={styles.rowArrow}>›</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={`${styles.row} ${styles.adminRow}`}
              onClick={() => { window.location.href = '/admin'; }}
            >
              <div>
                <span className={styles.rowLabel}>어드민 대시보드</span>
                <span className={styles.menuEn}>ADMIN</span>
              </div>
              <span className={styles.rowArrow}>›</span>
            </button>
          )}
          <button type="button" className={styles.row} onClick={() => showToast('준비 중입니다.')}>
            <div>
              <span className={styles.rowLabel}>팔로잉 작가</span>
              <span className={styles.menuEn}>FOLLOWING</span>
            </div>
            <span className={styles.rowArrow}>›</span>
          </button>
          <button type="button" className={styles.row} onClick={() => showToast('준비 중입니다.')}>
            <div>
              <span className={styles.rowLabel}>설정</span>
              <span className={styles.menuEn}>SETTINGS</span>
            </div>
            <span className={styles.rowArrow}>›</span>
          </button>
          <button type="button" className={styles.row} onClick={() => showToast('준비 중입니다.')}>
            <div>
              <span className={styles.rowLabel}>고객 지원</span>
              <span className={styles.menuEn}>SUPPORT</span>
            </div>
            <span className={styles.rowArrow}>›</span>
          </button>
          <button
            type="button"
            className={`${styles.row} ${styles.signoutRow}`}
            onClick={openLogout}
          >
            <div>
              <span className={styles.rowLabel}>로그아웃</span>
              <span className={styles.menuEn}>SIGN OUT</span>
            </div>
            <span className={styles.rowArrow}>›</span>
          </button>
        </div>

        {/* 푸터 */}
        <div className={styles.footer}>
          <p className={styles.footerText}>Folio {version}</p>
          <button
            type="button"
            className={`${styles.textBtn} ${styles.textBtnDanger}`}
            onClick={onWithdraw}
            style={{ marginTop: 10 }}
          >
            탈퇴하기
          </button>
        </div>
      </div>

      {infoModalOpen && <MypageInfoModal onClose={() => setInfoModalOpen(false)} />}
    </div>
  );
}
