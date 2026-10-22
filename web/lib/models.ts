/**
 * 채팅·빌더에서 공통으로 쓰는 모델 정의.
 * 원본 app.js `MODELS` 와 1:1. 백엔드 정규 목록: lib/chatModels.js.
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
  { id: 'claude-opus-5',             label: 'Opus 5',           desc: '최신 최고 성능',              provider: 'claude' },
  { id: 'claude-sonnet-5',           label: 'Sonnet 5',         desc: '균형 잡힌 성능 · 빌더 기본값', provider: 'claude' },
  { id: 'claude-opus-4-8',           label: 'Opus 4.8',         desc: '고성능',                     provider: 'claude' },
  { id: 'claude-opus-4-7',           label: 'Opus 4.7',         desc: '고성능',                     provider: 'claude' },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',         desc: '고성능',                     provider: 'claude' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',        desc: '빠른 응답',                  provider: 'claude' },
  { id: 'gemini-3.8-flash',          label: 'Gemini 3.8 Flash', desc: '가장 빠름 · Google · 기본값', provider: 'gemini' },
  { id: 'gemini-3.6-flash',          label: 'Gemini 3.6 Flash', desc: '빠르고 저렴 · Google',       provider: 'gemini' },
  { id: 'gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro',   desc: '최고 성능 · Google · 느림',   provider: 'gemini' },
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',   desc: '구세대 · Google',            provider: 'gemini' },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash', desc: '구세대 · Google',            provider: 'gemini' },
];

// 채팅 기본값 — 첫 토큰 지연(TTFT)이 체감 품질을 지배해서 Flash 계열을 쓴다.
// 실측(이화 프롬프트 + 1000~2000자 요구): 3.7 Flash 4.6s vs 3.1 Pro 33.8s.
//
// 2026-10-21: 3.7-flash 는 Deprecated 이고 Google 이 3.8-flash 로 자동 라우팅한다.
// 실제 서빙 모델과 ID 를 맞추려고 3.8 로 명시했다. 위 TTFT 수치는 3.7 요청 기준이라
// 사실상 3.8 측정값이지만, 재벤치마크 전까지는 참고치로만 본다.
// 백엔드 정규 목록·별칭: lib/chatModels.js (CHAT_DEFAULT_MODEL · LEGACY_MODEL_ALIASES)
export const CHAT_DEFAULT_MODEL    = 'gemini-3.8-flash';
export const BUILDER_DEFAULT_MODEL = 'claude-sonnet-5';

export function findModel(id: string): ChatModel | undefined {
  return MODELS.find((m) => m.id === id);
}
