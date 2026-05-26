import { create } from 'zustand';

interface AuthGate {
  title: string;
  desc: string;
  intendedPath?: string | null;
}

interface UIState {
  toastMessage: string | null;
  toastTimer: ReturnType<typeof setTimeout> | null;
  showToast: (message: string, duration?: number) => void;
  hideToast: () => void;

  authGate: AuthGate | null;
  showAuthGate: (g: AuthGate) => void;
  closeAuthGate: () => void;

  logoutOpen: boolean;
  openLogout: () => void;
  closeLogout: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  toastMessage: null,
  toastTimer: null,

  showToast: (message, duration = 2000) => {
    const prev = get().toastTimer;
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => set({ toastMessage: null, toastTimer: null }), duration);
    set({ toastMessage: message, toastTimer: timer });
  },

  hideToast: () => {
    const prev = get().toastTimer;
    if (prev) clearTimeout(prev);
    set({ toastMessage: null, toastTimer: null });
  },

  authGate: null,
  showAuthGate: (g) => set({ authGate: g }),
  closeAuthGate: () => set({ authGate: null }),

  logoutOpen: false,
  openLogout: () => set({ logoutOpen: true }),
  closeLogout: () => set({ logoutOpen: false }),
}));
