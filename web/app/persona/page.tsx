'use client';

// useSearchParams 사용 → Suspense boundary 필요 (ML-004).
// 페이지를 outer + inner로 분리하고 outer가 inner를 <Suspense>로 감쌈.

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePersonas } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { useRequireAuth } from '@/lib/useRequireAuth';

/**
 * `/persona?char=<id>` — 페르소나 진입 리다이렉터.
 *
 * 원본 app.js `openPersonaSetup` (L1233~1247) + `_routePersonaLinked` (L1250~1264) 패턴 이식.
 *
 * 분기:
 *   - 캐릭터 컨텍스트 없음 (?char 없음) → /persona/new (standalone — 마이페이지에서 새 페르소나)
 *   - 로그인 + 기존 페르소나 있음    → /persona/select?char=<id>
 *   - 로그인 + 페르소나 없음 또는 비로그인 → /persona/new?char=<id> (linked)
 *
 * 비고: 이 화면 자체는 렌더 안 함 — replaceState로 즉시 redirect.
 */
export default function PersonaIndexPage() {
  return (
    <Suspense fallback={null}>
      <PersonaIndexInner />
    </Suspense>
  );
}

function PersonaIndexInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const charId = sp.get('char');
  const safety = sp.get('safety'); // 'on' | 'off' | null — 인트로 SafetySegment 선택값
  const safetyQ = safety ? `&safety=${safety}` : '';
  const intendedPath = charId ? `/persona?char=${encodeURIComponent(charId)}${safetyQ}` : '/persona';
  const { user, ready } = useRequireAuth(intendedPath, {
    title: '페르소나 설정',
    desc: '페르소나를 사용하려면 로그인이 필요합니다.',
  });
  const { personas, isLoading } = usePersonas();
  const setAppReady = useUIStore((s) => s.setAppReady);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return; // useRequireAuth가 AuthGate 띄움
    if (!charId) {
      // standalone — 마이페이지 진입 경로. 페르소나 신규 작성으로.
      router.replace('/persona/new');
      return;
    }
    if (isLoading) return;
    const cq = encodeURIComponent(charId);
    if (personas.length > 0) {
      router.replace(`/persona/select?char=${cq}${safetyQ}`);
    } else {
      router.replace(`/persona/new?char=${cq}${safetyQ}`);
    }
  }, [ready, user, charId, safetyQ, personas.length, isLoading, router]);

  return null;
}
