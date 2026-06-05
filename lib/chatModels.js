// 챗봇 모델 정규 목록 (백엔드).
// 프론트 web/lib/models.ts · public/js/app.js MODELS 와 동일 순서/ID 유지.
// 어드민 모델 관리(Layer 3 프롬프트 편집)의 단일 소스.
// (chat.js/regenerate.js/builder.js 의 ALLOWED_MODELS Set 도 이 목록과 일치해야 함)

const CHAT_MODELS = [
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6',       provider: 'claude' },
  { id: 'claude-opus-4-8',           label: 'Opus 4.8',         provider: 'claude' },
  { id: 'claude-opus-4-7',           label: 'Opus 4.7',         provider: 'claude' },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',         provider: 'claude' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',        provider: 'claude' },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash', provider: 'gemini' },
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',   provider: 'gemini' },
  { id: 'gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro',   provider: 'gemini' },
  { id: 'gemini-3.5-flash',          label: 'Gemini 3.5 Flash', provider: 'gemini' },
];

const CHAT_MODEL_IDS = new Set(CHAT_MODELS.map(m => m.id));

module.exports = { CHAT_MODELS, CHAT_MODEL_IDS };
