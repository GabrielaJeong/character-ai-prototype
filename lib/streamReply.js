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

async function streamAnthropic({ model, systemPrompt, history, maxTokens, onDelta }) {
  const stream = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages:   history,
    stream:     true,
  });

  let acc = '';
  for await (const event of stream) {
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

async function streamGemini({ model, systemPrompt, history, maxTokens, onDelta }) {
  const result = await getGemini().models.generateContentStream({
    model,
    contents: toGeminiContents(history),
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
    },
  });

  let acc = '';
  for await (const chunk of result) {
    // chunk.text는 thought parts 제외하고 응답 텍스트만 (Gemini SDK v1+)
    const text = chunk.text || '';
    if (text) {
      acc += text;
      onDelta(text);
    }
  }
  return acc;
}

async function streamReply({ model, systemPrompt, history, maxTokens = 8192, onDelta }) {
  if (GEMINI_MODELS.has(model)) {
    return streamGemini({ model, systemPrompt, history, maxTokens, onDelta });
  }
  return streamAnthropic({ model, systemPrompt, history, maxTokens, onDelta });
}

module.exports = { streamReply, GEMINI_MODELS };
