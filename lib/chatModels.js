// 챗봇 모델 정규 목록 (백엔드).
// 프론트 web/lib/models.ts MODELS 와 동일 순서/ID 유지.
// 어드민 모델 관리(Layer 3 프롬프트 편집)의 단일 소스.
// (chat.js/regenerate.js/builder.js 의 ALLOWED_MODELS Set 도 이 목록과 일치해야 함)
//
// 정렬: provider 그룹 연속(피커가 그룹 경계에 divider 삽입) · 그룹 내 최신순.
// Gemini 2.5는 구세대(2.0은 2026-06-01 셧다운) — 하단 유지, 셧다운 공지 시 제거.
// 2.5 계열은 공식 문서상 '기존 사용자만 접근' — 우리 키는 정상 동작 확인(2026-10-21).

const CHAT_MODELS = [
  { id: 'claude-opus-5',             label: 'Opus 5',           provider: 'claude' },
  { id: 'claude-sonnet-5',           label: 'Sonnet 5',         provider: 'claude' },
  { id: 'claude-opus-4-8',           label: 'Opus 4.8',         provider: 'claude' },
  { id: 'claude-opus-4-7',           label: 'Opus 4.7',         provider: 'claude' },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',         provider: 'claude' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',        provider: 'claude' },
  { id: 'gemini-3.8-flash',          label: 'Gemini 3.8 Flash', provider: 'gemini' },
  { id: 'gemini-3.6-flash',          label: 'Gemini 3.6 Flash', provider: 'gemini' },
  { id: 'gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro',   provider: 'gemini' },
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',   provider: 'gemini' },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash', provider: 'gemini' },
];

// 채팅 기본값 — 프론트(web/lib/models.ts CHAT_DEFAULT_MODEL)와 일치시켜야 한다.
// 라우트의 DEFAULT_MODEL(claude-sonnet-5)은 "알 수 없는 모델" 폴백이지 기본값이 아니다.
const CHAT_DEFAULT_MODEL = 'gemini-3.8-flash';

// 구 ID → 현행 ID.
// Google이 서버에서 자동 라우팅한다(실측 2026-10-21: 3.7-flash→3.8-flash, 3.5-flash→3.6-flash).
// 그래도 여기서 흡수하는 이유 셋:
//   1. 별칭이 내려가면 404. 공식 deprecation 페이지상 두 모델 다 Deprecated.
//   2. Layer 3 보정 파일을 요청 ID로 찾으므로(prompts/buildSystemPrompt.js) 구 ID면 빗나간다.
//   3. sessions.model 에 구 ID가 남아 있는데 목록에서 빼면 라우트 폴백이 걸려
//      claude-sonnet-5 로 — 버전이 아니라 프로바이더가 바뀐다.
const LEGACY_MODEL_ALIASES = {
  'gemini-3.7-flash': 'gemini-3.8-flash',
  'gemini-3.5-flash': 'gemini-3.6-flash',
  // v0.33 에서 목록에서 빠졌는데 sessions.model 컬럼 DEFAULT 가 아직 이 값이다
  // (db/index.js). 구 세션·기본값으로 들어온 행을 현행으로 옮긴다.
  'claude-sonnet-4-6': 'claude-sonnet-5',
};

/** 구 모델 ID를 현행으로 옮긴다. 모르는 값은 그대로 돌려준다(검증은 호출부에서). */
function resolveModel(id) {
  return LEGACY_MODEL_ALIASES[id] || id;
}

const CHAT_MODEL_IDS = new Set(CHAT_MODELS.map(m => m.id));
// Gemini 서브셋 — provider 분기(Gemini SDK vs Anthropic SDK)용. 누락 시 무음 오라우팅.
const GEMINI_MODEL_IDS = new Set(CHAT_MODELS.filter(m => m.provider === 'gemini').map(m => m.id));

module.exports = {
  CHAT_MODELS,
  CHAT_MODEL_IDS,
  GEMINI_MODEL_IDS,
  CHAT_DEFAULT_MODEL,
  LEGACY_MODEL_ALIASES,
  resolveModel,
};
