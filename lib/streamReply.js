/**
 * 모델 응답 스트리밍 헬퍼.
 *
 * Anthropic Messages API와 Google Gemini API의 streaming 호출을 통일된 인터페이스로 감쌈.
 *
 * 사용:
 *   const fullText = await streamReply({
 *     model, systemPrompt, history, maxTokens,
 *     onDelta: (chunk) => sseWrite({ type: 'delta', text: chunk }),
 *   });
 *
 * 반환값:
 *   - 누적된 전체 응답 텍스트 (DB에 저장하기 위함)
 *
 * 에러:
 *   - SDK / 네트워크 / rate limit 등은 throw — 호출자가 try/catch로 SSE 에러 이벤트 전송
 */

const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenAI } = require('@google/genai');
const { GEMINI_MODEL_IDS: GEMINI_MODELS } = require('./chatModels');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let _geminiClient = null;
function getGemini() {
  if (!_geminiClient) _geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _geminiClient;
}

// Anthropic history → Gemini contents
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

// Gemini thinking(추론) 예산 — 첫 토큰 지연(TTFT)의 주범.
// 미설정 시 3.x/2.5 "thinking" 모델은 dynamic thinking(사실상 최대치)로 동작해
// gemini-3.1-pro-preview 기준 첫 토큰까지 ~26~30초 침묵 → 스트리밍 체감이 깨짐.
// 예산을 제한하면 추론 시간이 줄어 TTFT가 크게 단축된다(품질과의 트레이드오프).
//   - 값 낮을수록 빠르지만 추론 깊이 감소. 0=비활성(일부 모델만 허용).
//   - env GEMINI_THINKING_BUDGET 로 재배포 없이 조절(A/B 튜닝용).
const DEFAULT_GEMINI_THINKING_BUDGET = 1024;
function geminiThinkingBudget() {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  if (raw === undefined || raw === '') return DEFAULT_GEMINI_THINKING_BUDGET;
  const n = Number(raw);
  return Number.isFinite(n) ? n : DEFAULT_GEMINI_THINKING_BUDGET;
}

// Claude 추론 깊이 — Gemini의 thinkingBudget과 같은 목적(TTFT 단축).
// Claude 5 세대(opus-5/sonnet-5)는 thinking 파라미터를 생략해도 adaptive thinking이
// 기본 ON이라, 생략 시 추론을 안 하던 4.x와 달리 첫 토큰까지 침묵이 길어진다.
// output_config.effort 로 추론 깊이를 낮춰 TTFT를 단축한다(품질과의 트레이드오프).
//   - low | medium | high | xhigh | max. 미지정 시 high.
//   - 4.x/haiku는 애초에 추론을 안 하므로 대상 아님(값을 보내지 않는다).
//   - env CLAUDE_EFFORT 로 재배포 없이 조절(A/B 튜닝용).
const EFFORT_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5']);
const DEFAULT_CLAUDE_EFFORT = 'low';
function claudeEffort(model) {
  if (!EFFORT_MODELS.has(model)) return null;
  return process.env.CLAUDE_EFFORT || DEFAULT_CLAUDE_EFFORT;
}

async function streamAnthropic({ model, systemPrompt, history, maxTokens, onDelta, signal }) {
  const body = {
    model,
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages:   history,
    stream:     true,
  };
  const effort = claudeEffort(model);
  if (effort) body.output_config = { effort };

  // Codex R3 F4: signal 전달 — 클라이언트 abort 시 SDK 호출도 취소되어 API 비용 절감
  const stream = await anthropic.messages.create(body, { signal });

  let acc = '';
  for await (const event of stream) {
    if (signal?.aborted) break;
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const text = event.delta.text;
      if (text) {
        acc += text;
        onDelta(text);
      }
    }
  }
  return acc;
}

async function streamGemini({ model, systemPrompt, history, maxTokens, onDelta, signal }) {
  // Gemini SDK는 httpOptions.abortSignal 또는 두 번째 인자에 signal을 받음 (버전 차이 있음).
  // 안전을 위해 iteration 중 signal 체크로 폴백 — abort 시 후속 chunk 처리 안 함.
  const result = await getGemini().models.generateContentStream({
    model,
    contents: toGeminiContents(history),
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
      abortSignal: signal, // Gemini v1+ config에서 받기도 함
      // 추론 예산 제한으로 첫 토큰 지연 단축 (thinking 모델 대응).
      thinkingConfig: { thinkingBudget: geminiThinkingBudget() },
    },
  });

  let acc = '';
  for await (const chunk of result) {
    if (signal?.aborted) break;
    const text = chunk.text || '';
    if (text) {
      acc += text;
      onDelta(text);
    }
  }
  return acc;
}

async function streamReply({ model, systemPrompt, history, maxTokens = 8192, onDelta, signal }) {
  if (GEMINI_MODELS.has(model)) {
    return streamGemini({ model, systemPrompt, history, maxTokens, onDelta, signal });
  }
  return streamAnthropic({ model, systemPrompt, history, maxTokens, onDelta, signal });
}

module.exports = { streamReply, GEMINI_MODELS };
