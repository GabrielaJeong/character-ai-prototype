import { create } from 'zustand';
import type { PersonaData, Safety } from '@/lib/types';

/**
 * 채팅 진입 직전에 페르소나 설정 화면에서 준비된 컨텍스트를 챗 화면으로 전달.
 *
 * 원본 SPA의 `window._persona / _characterId / _safety / sessionId` 글로벌 변수 대응.
 *
 * 라이프사이클:
 *   - persona/new 또는 persona/select/[id] form 제출 시 set
 *   - /character/[id]/chat 마운트 시 read + clear
 *   - 페이지 reload 시 store 비어있음 → chat이 /character/[id]로 리다이렉트해 다시 셋업
 *
 * 모델 / sessionId는 챗 화면에서 추가로 설정 가능.
 */
export interface ChatPrep {
  characterId: string;
  persona: PersonaData;
  safety: Safety;
}

interface ChatPrepState {
  prep: ChatPrep | null;
  setPrep: (prep: ChatPrep) => void;
  consume: () => ChatPrep | null;
}

export const useChatPrepStore = create<ChatPrepState>((set, get) => ({
  prep: null,
  setPrep: (prep) => set({ prep }),
  consume: () => {
    const p = get().prep;
    set({ prep: null });
    return p;
  },
}));
