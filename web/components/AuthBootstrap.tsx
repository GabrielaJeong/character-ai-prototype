'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';

/**
 * 클라이언트 마운트 시 한 번만 /api/auth/me 호출하여 세션 복원.
 * Next.js App Router의 root layout에서 children 위에 마운트.
 * UI는 렌더하지 않음 (side effect 전용).
 */
export function AuthBootstrap() {
  const initAuth     = useAuthStore((s) => s.initAuth);
  const checkDemoMode = useAuthStore((s) => s.checkDemoMode);

  useEffect(() => {
    initAuth();
    checkDemoMode();
  }, [initAuth, checkDemoMode]);

  return null;
}
