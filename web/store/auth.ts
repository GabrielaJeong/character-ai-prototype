import { create } from 'zustand';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  ready: boolean; // initAuth 완료 여부 (race condition 방지 — L-011 유사 패턴)
  demoAvailable: boolean;
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
      // 이미 다른 경로(demoLogin 등)로 user가 설정됐으면 덮어쓰지 않음 (L-011 race 회피)
      if (!get().user) set({ user: data.user });
    } catch (_) {
      // 401/네트워크 에러는 무시 (로그아웃 상태로 간주)
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

  setUser: (user) => set({ user }),

  logout: async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    set({ user: null });
  },

  demoLogin: async () => {
    const data = await api.post<{ user: User }>('/api/auth/demo-login');
    set({ user: data.user });
    return data.user;
  },
}));
