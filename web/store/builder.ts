import { create } from 'zustand';
import type { BuilderCharData } from '@/lib/types';
import { BUILDER_DEFAULT_MODEL } from '@/lib/models';

/**
 * AI 빌더 진행 상태 — 챗(/builder/chat) → 검토(/builder/preview) 사이를 잇는 컨텍스트.
 *
 * 원본 SPA의 글로벌 `builderSessionId / builderCharData / builderSystemMd / builderModel` 대응.
 *
 * 라이프사이클:
 *   - /builder/chat 진입 시 reset() → 새 세션 시작
 *   - chat에서 [CHARACTER_READY] 추출 → setCharData
 *   - generate 성공 → setSystemMd 후 /builder/preview 이동
 *   - preview reload 시 store 비어있음 → /builder로 리다이렉트
 *
 * 직접 제작(/builder/manual)은 store 없이 폼 로컬 상태로 처리 (단발성 제출).
 */
interface BuilderState {
  model: string;
  sessionId: string | null;
  charData: BuilderCharData | null;
  systemMd: string | null;
  setModel: (model: string) => void;
  setSession: (sessionId: string) => void;
  setCharData: (charData: BuilderCharData | null) => void;
  setSystemMd: (systemMd: string | null) => void;
  reset: () => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  model: BUILDER_DEFAULT_MODEL,
  sessionId: null,
  charData: null,
  systemMd: null,
  setModel: (model) => set({ model }),
  setSession: (sessionId) => set({ sessionId }),
  setCharData: (charData) => set({ charData }),
  setSystemMd: (systemMd) => set({ systemMd }),
  reset: () =>
    set({ model: BUILDER_DEFAULT_MODEL, sessionId: null, charData: null, systemMd: null }),
}));
