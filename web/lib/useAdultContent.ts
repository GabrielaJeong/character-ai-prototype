'use client';

import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useCharacters } from '@/lib/hooks';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

/**
 * 성인 콘텐츠 ON/OFF 토글 로직 공유 훅.
 *
 * 원본 app.js `setAdultToggle` (L3310~3351) 이식. LandingHeader(18+ 세그먼트)와
 * mypage(토글 스위치)가 동일 로직을 쓰도록 분리.
 *
 * 분기:
 *   - OFF: 인증 불필요. 로그인 상태면 즉시 PATCH /api/auth/adult-content (enabled:false)
 *   - ON + 비로그인: AuthGate
 *   - ON + 인증 완료: 즉시 PATCH (enabled:true)
 *   - ON + 미인증: AdultVerifyModal (첫 인증). 모달 confirm 시 verify + enable 동시.
 *
 * 토글 변경 후 useCharacters mutate — 서버가 adult_content_enabled 따라 필터링하므로.
 */
export function useAdultContent() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const showAuthGate = useUIStore((s) => s.showAuthGate);
  const openAdultVerify = useUIStore((s) => s.openAdultVerify);
  const showToast = useUIStore((s) => s.showToast);
  const { mutate: refetchCharacters } = useCharacters();

  const adultEnabled = !!user?.adult_content_enabled;
  const adultVerified = !!user?.adult_verified;

  const patchAdult = async (enabled: boolean) => {
    try {
      const data = await api.patch<{ user: User }>('/api/auth/adult-content', { enabled });
      setUser(data.user);
      await refetchCharacters();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '설정 변경 실패');
    }
  };

  /** @param intendedPath 비로그인 시 AuthGate가 로그인 후 복귀할 경로 */
  const setAdult = async (enable: boolean, intendedPath: string) => {
    if (!enable) {
      if (user) await patchAdult(false);
      return;
    }
    if (!user) {
      showAuthGate({
        title: '성인 콘텐츠',
        desc: '성인 콘텐츠를 이용하려면 로그인이 필요합니다.',
        intendedPath,
      });
      return;
    }
    if (adultVerified) {
      await patchAdult(true);
      return;
    }
    // 첫 인증 — 모달 (confirm 시 verify가 enabled=1까지 처리)
    openAdultVerify();
  };

  return { setAdult, adultEnabled, adultVerified };
}
