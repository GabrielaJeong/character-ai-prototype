import { create } from 'zustand';

/**
 * UI 상태 store — 토스트 / 인증 게이트 / 모달들.
 *
 * 토스트: showToast(message, duration?) 호출 후 자동 dismiss.
 * 인증 게이트: showAuthGate({title, desc, intendedPath}) → 로그인 후 intendedPath로 복귀.
 * 로그아웃 / 탈퇴 / 삭제 확인: 각각 open/close 토글.
 */

interface AuthGatePayload {
  title: string;
  desc: string;
  intendedPath?: string | null;
}

interface DeleteConfirmPayload {
  title: string;
  desc?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

interface UIState {
  // Toast
  toastMessage: string | null;
  toastTimer: ReturnType<typeof setTimeout> | null;
  showToast: (message: string, duration?: number) => void;
  hideToast: () => void;

  // Auth gate modal
  authGate: AuthGatePayload | null;
  showAuthGate: (g: AuthGatePayload) => void;
  closeAuthGate: () => void;

  // Logout confirm
  logoutOpen: boolean;
  openLogout: () => void;
  closeLogout: () => void;

  // Generic delete confirm (재사용 — 세션 삭제, 페르소나 삭제, 캐릭터 삭제, 계정 탈퇴 등)
  deleteConfirm: DeleteConfirmPayload | null;
  showDeleteConfirm: (p: DeleteConfirmPayload) => void;
  closeDeleteConfirm: () => void;

  // 성인 인증 모달 (LandingHeader 18+ / mypage 토글 공유). 닫힐 때 onClose 콜백으로 UI 원복.
  adultVerify: { onClose?: () => void } | null;
  openAdultVerify: (p?: { onClose?: () => void }) => void;
  closeAdultVerify: () => void;

  // Splash gating — 현재 route의 critical 데이터가 준비되면 true.
  // Splash는 (minTimer 경과 && appReady)일 때만 dismiss → 원본 SPA의 _dataReady + _timerReady 패턴.
  appReady: boolean;
  setAppReady: (ready: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // ── Toast ──────────────────────────────────────────────
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

  // ── Auth gate ──────────────────────────────────────────
  authGate: null,
  showAuthGate: (g) => set({ authGate: g }),
  closeAuthGate: () => set({ authGate: null }),

  // ── Logout ─────────────────────────────────────────────
  logoutOpen: false,
  openLogout: () => set({ logoutOpen: true }),
  closeLogout: () => set({ logoutOpen: false }),

  // ── Delete confirm (재사용) ────────────────────────────
  deleteConfirm: null,
  showDeleteConfirm: (p) => set({ deleteConfirm: p }),
  closeDeleteConfirm: () => set({ deleteConfirm: null }),

  // ── Adult verify ───────────────────────────────────────
  adultVerify: null,
  openAdultVerify: (p) => set({ adultVerify: p ?? {} }),
  closeAdultVerify: () => {
    const cb = get().adultVerify?.onClose;
    set({ adultVerify: null });
    cb?.();
  },

  // ── Splash gating ──────────────────────────────────────
  appReady: false,
  setAppReady: (ready) => set({ appReady: ready }),
}));
