'use client';

// useSearchParams 사용 → Suspense boundary 필요 (ML-004).

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePersonas } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { useRequireAuth } from '@/lib/useRequireAuth';

/**
 * `/persona/select?char=<id>` — 기존 페르소나 목록에서 선택.
 *
 * 원본 app.js `_routePersonaSelect` (L1310~1355).
 *
 * 동작:
 *   - 캐릭터 컨텍스트 필수 — 없으면 / 로 redirect
 *   - 비로그인 → /persona/new (linked)
 *   - 페르소나 0개 → /persona/new (이 화면 의미 없음)
 *   - 카드 클릭 → /persona/select/[id]?char=<id> (편집 후 채팅 시작)
 *   - 마지막에 "새 페르소나" CTA 카드 → /persona/new?char=<id>
 */
export default function PersonaSelectPage() {
  return (
    <Suspense fallback={null}>
      <PersonaSelectInner />
    </Suspense>
  );
}

function PersonaSelectInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const charId = sp.get('char');
  const intendedPath = charId ? `/persona/select?char=${encodeURIComponent(charId)}` : '/persona/select';
  const { user, ready } = useRequireAuth(intendedPath, {
    title: '페르소나 선택',
    desc: '페르소나를 선택하려면 로그인이 필요합니다.',
  });
  const { personas, isLoading } = usePersonas();
  const setAppReady = useUIStore((s) => s.setAppReady);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // 캐릭터 컨텍스트 / 페르소나 0개 가드
  useEffect(() => {
    if (!ready || !user) return;
    if (!charId) {
      router.replace('/');
      return;
    }
    if (!isLoading && personas.length === 0) {
      router.replace(`/persona/new?char=${encodeURIComponent(charId)}`);
    }
  }, [ready, user, charId, isLoading, personas.length, router]);

  if (!ready || !user || !charId || isLoading) {
    return null;
  }

  const onBack = () => router.push(`/character/${charId}`);
  const onPickPersona = (pid: number) =>
    router.push(`/persona/select/${pid}?char=${encodeURIComponent(charId)}`);
  const onNewPersona = () =>
    router.push(`/persona/new?char=${encodeURIComponent(charId)}`);

  const defaultId = user.default_persona_id;

  return (
    <div className="page-wrap">
      <div className="page-nav">
        <button type="button" className="btn-back" onClick={onBack} aria-label="뒤로">←</button>
        <span className="nav-label">페르소나 선택</span>
      </div>
      <div className="page-body">
        <p className="content-header-desc">사용할 페르소나를 선택하세요.</p>
        <div className="mypage-card-grid">
          {personas.map((p) => {
            const d = p.data;
            const isDefault = p.id === defaultId;
            const hasImg = !!d.avatar;
            const meta = [
              d.age ? `${d.age}세` : '',
              d.gender === 'male' ? '남' : d.gender === 'female' ? '여' : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={p.id}
                type="button"
                className={`mypage-p-card ${isDefault ? 'is-default' : ''} ${hasImg ? 'has-image' : ''}`}
                onClick={() => onPickPersona(p.id)}
              >
                {hasImg ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img className="mypage-p-img" src={d.avatar!} alt={d.name || ''} />
                ) : (
                  <div className="mypage-p-no-img">
                    <div className="mypage-p-add-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                      </svg>
                    </div>
                  </div>
                )}
                <div className="mypage-p-overlay">
                  <div className="mypage-p-name">
                    {d.name || '이름 없음'}
                    {isDefault && <span className="default-badge">기본</span>}
                  </div>
                  {meta && <div className="mypage-p-meta">{meta}</div>}
                </div>
              </button>
            );
          })}
          {/* 새 페르소나 CTA 카드 */}
          <button type="button" className="mypage-p-card" onClick={onNewPersona}>
            <div className="mypage-p-no-img">
              <div className="mypage-p-add-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
            </div>
            <div className="mypage-p-overlay">
              <div className="mypage-p-name">새 페르소나</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
