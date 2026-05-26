import { create } from 'zustand';

interface UIState {
  toastMessage: string | null;
  toastTimer: ReturnType<typeof setTimeout> | null;
  showToast: (message: string, duration?: number) => void;
  hideToast: () => void;
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
}));
