'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

/**
 * 인증 필수 라우트에서 마운트 시 AuthGate 자동 표시.
 *
 * 정책 (사용자 결정):
 *   - public: `/`, `/character/[id]`, `/login`, `/signup`, `/reset-password`, `/explore`(TBD)
 *   - login required: `/persona/*`, `/character/[id]/chat`, `/history`, `/mypage`, `/notification`(TBD)
 *
 * 동작:
 *   - `ready=false` (initAuth 진행 중)이면 아무 동작 안 함
 *   - `user=null`이면 `showAuthGate({ title, desc, intendedPath })`
 *   - AuthGate 닫으면 기본 동작은 `/`로 — close-vs-login 분기는 AuthGate 컴포넌트 책임
 *   - L-011 패턴 (intendedPath로 복귀)
 *
 * 호출자 패턴:
 *   const { user, ready } = useRequireAuth('/history', { title: '대화', desc: '대화 기록을 보려면 로그인이 필요합니다.' });
 *   if (!ready || !user) return <div className={styles.wrap} />;
 */
export function useRequireAuth(
  intendedPath: string,
  opts: { title: string; desc: string },
) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const showAuthGate = useUIStore((s) => s.showAuthGate);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      showAuthGate({
        title: opts.title,
        desc: opts.desc,
        intendedPath,
      });
    }
  }, [ready, user, intendedPath, showAuthGate, opts.title, opts.desc]);

  return { user, ready };
}
