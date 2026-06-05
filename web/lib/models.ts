/**
 * 채팅·빌더에서 공통으로 쓰는 모델 정의.
 * 원본 app.js L2~9 `MODELS` 와 1:1.
 *
 * 백엔드 허용 모델: routes/chat.js의 ALLOWED_MODELS.
 */

export type ModelProvider = 'claude' | 'gemini';

export interface ChatModel {
  id: string;
  label: string;
  desc: string;
  provider: ModelProvider;
}

export const MODELS: ChatModel[] = [
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6',       desc: '균형 잡힌 성능',         provider: 'claude' },
  { id: 'claude-opus-4-8',           label: 'Opus 4.8',         desc: '최신 최고 성능',         provider: 'claude' },
  { id: 'claude-opus-4-7',           label: 'Opus 4.7',         desc: '고성능',                provider: 'claude' },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',         desc: '최고 성능',              provider: 'claude' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',        desc: '빠른 응답',              provider: 'claude' },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash', desc: '빠르고 효율적 · Google', provider: 'gemini' },
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',   desc: '최고 성능 · Google',     provider: 'gemini' },
  { id: 'gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro',   desc: '최신 모델 · Google · 기본값', provider: 'gemini' },
  { id: 'gemini-3.5-flash',          label: 'Gemini 3.5 Flash', desc: '빠른 최신 · Google',     provider: 'gemini' },
];

export const CHAT_DEFAULT_MODEL    = 'gemini-3.1-pro-preview';
export const BUILDER_DEFAULT_MODEL = 'claude-sonnet-4-6';

export function findModel(id: string): ChatModel | undefined {
  return MODELS.find((m) => m.id === id);
}
