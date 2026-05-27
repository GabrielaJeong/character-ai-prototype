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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let _geminiClient = null;
function getGemini() {
  if (!_geminiClient) _geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _geminiClient;
}

const GEMINI_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
]);

// Anthropic history → Gemini contents
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

async function streamAnthropic({ model, systemPrompt, history, maxTokens, onDelta, signal }) {
  // Codex R3 F4: signal 전달 — 클라이언트 abort 시 SDK 호출도 취소되어 API 비용 절감
  const stream = await anthropic.messages.create(
    {
      model,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   history,
      stream:     true,
    },
    { signal },
  );

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
