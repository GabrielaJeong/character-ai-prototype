'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';

/**
 * 클라이언트 마운트 시 한 번만 세션 복원 + 데모 모드 체크.
 * Root layout에 마운트 (UI 렌더 없음).
 */
export function AuthBootstrap() {
  const initAuth      = useAuthStore((s) => s.initAuth);
  const checkDemoMode = useAuthStore((s) => s.checkDemoMode);

  useEffect(() => {
    initAuth();
    checkDemoMode();
  }, [initAuth, checkDemoMode]);

  return null;
}
