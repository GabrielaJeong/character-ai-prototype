import { create } from 'zustand';
import { mutate } from 'swr';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

/**
 * 신분이 바뀌면 SWR 캐시 전체를 재검증한다.
 *
 * 서버가 user 기준으로 응답을 필터링·소유자 판정하는 엔드포인트가 여럿이다
 * (캐릭터 성인 필터, 세션·북마크·페르소나). 로그인/로그아웃 시점에 재검증하지
 * 않으면 이전 신분으로 받아온 캐시가 그대로 남는다 — 실제로 체험 로그인 후
 * 18+ 는 켜졌는데(user 객체는 갱신됨) 캐릭터 목록은 비로그인 응답 그대로라
 * 성인 캐릭터가 안 보이는 문제가 있었다.
 *
 * data를 비우지 않고 재검증만 한다(로딩 깜빡임 방지).
 * initAuth 는 부팅 경로라 호출하지 않는다 — 매 페이지 진입마다 전체 재검증이
 * 도는 것을 피한다.
 */
const revalidateAll = () => {
  void mutate(() => true);
};

/**
 * 인증 상태 store.
 *
 * 책임:
 *   - 세션 복원 (initAuth) — 앱 시작 시 한 번 /api/auth/me 호출
 *   - 데모 모드 가능 여부 확인 (DEMO_MODE env 노출)
 *   - 로그아웃 / 데모 로그인
 *
 * L-011 race condition 방지:
 *   - initAuth가 비동기로 응답 오는 동안 demoLogin / submitLogin 등이 먼저
 *     user를 set하면, initAuth 응답이 user를 null로 덮어쓸 수 있음
 *   - 해결: initAuth 응답 처리 시 get().user 가 이미 있으면 덮어쓰지 않음
 */

interface AuthState {
  user: User | null;
  ready: boolean;             // initAuth 1회 완료 여부 (UI에서 로딩 표시 등에 사용)
  demoAvailable: boolean;     // DEMO_MODE 활성 여부

  initAuth: () => Promise<void>;
  checkDemoMode: () => Promise<void>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  demoLogin: () => Promise<User | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  ready: false,
  demoAvailable: false,

  initAuth: async () => {
    try {
      const data = await api.get<{ user: User | null }>('/api/auth/me');
      // L-011: demoLogin / submitLogin이 먼저 끝났다면 덮어쓰지 않음
      if (!get().user) set({ user: data.user });
    } catch {
      // 네트워크/401 모두 비로그인 상태로 간주
    } finally {
      set({ ready: true });
    }
  },

  checkDemoMode: async () => {
    try {
      const data = await api.get<{ available: boolean }>('/api/auth/demo-available');
      set({ demoAvailable: !!data.available });
    } catch {
      set({ demoAvailable: false });
    }
  },

  // 로그인 페이지·성인 토글 등 신분/권한이 바뀌는 모든 경로가 이 setter를 쓴다.
  setUser: (user) => {
    set({ user });
    revalidateAll();
  },

  logout: async () => {
    try { await api.post('/api/auth/logout'); } catch { /* 그래도 클라이언트 상태는 비움 */ }
    set({ user: null });
    revalidateAll();
  },

  demoLogin: async () => {
    const data = await api.post<{ user: User }>('/api/auth/demo-login');
    set({ user: data.user });
    revalidateAll();
    return data.user;
  },
}));
