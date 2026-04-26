const Anthropic     = require('@anthropic-ai/sdk');
const { callGemini } = require('./gemini');
const { stmt }       = require('../db');

const MAX_CHARS = 8000;

const GEMINI_MODELS     = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview']);
const SUMMARY_GEMINI    = 'gemini-2.5-flash';
const SUMMARY_ANTHROPIC = 'claude-haiku-4-5-20251001';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = '당신은 AI 캐릭터의 기억 관리자입니다. 유저에 대한 정보를 간결하게 요약합니다.';

function buildPrompt(combined) {
  return `다음은 AI 캐릭터와 유저 사이의 대화 기록입니다.
이 유저에 대해 캐릭터가 다음 대화에서 기억해야 할 핵심 정보를 200자 이내로 요약하세요.
이름, 나이, 성격, 선호도, 감정적 연결고리, 중요한 사건 등을 포함하세요.
반드시 한국어로, 3인칭 ("이 유저는...") 으로 작성하세요.

대화 기록:
${combined}`;
}

async function summarizeWithGemini(prompt) {
  return callGemini({
    model:             SUMMARY_GEMINI,
    systemInstruction: SYSTEM,
    history:           [{ role: 'user', content: prompt }],
    maxTokens:         400,
  });
}

async function summarizeWithAnthropic(prompt) {
  const res = await anthropic.messages.create({
    model:      SUMMARY_ANTHROPIC,
    max_tokens: 400,
    system:     SYSTEM,
    messages:   [{ role: 'user', content: prompt }],
  });
  return res.content[0].text;
}

async function generateMemory(userId, characterId, currentSessionId, sessionModel = '') {
  const sessions = stmt.getPrevSessions.all(userId, characterId, currentSessionId);
  if (!sessions.length) return;

  const convos = sessions
    .map(s => stmt.getMessages.all(s.id)
      .map(m => `${m.role === 'user' ? '유저' : '캐릭터'}: ${m.content}`)
      .join('\n')
    )
    .filter(c => c.trim().length > 0);

  if (!convos.length) return;

  const prompt   = buildPrompt(convos.join('\n\n---\n\n').slice(0, MAX_CHARS));
  const useGemini = GEMINI_MODELS.has(sessionModel);

  let summary;
  try {
    // 세션 모델의 제공사 기준으로 경량 모델 선택, 실패 시 반대쪽 폴백
    summary = useGemini
      ? await summarizeWithGemini(prompt)
      : await summarizeWithAnthropic(prompt);
  } catch (primaryErr) {
    console.warn(`[Memory] primary summarizer failed (${primaryErr.message}), trying fallback`);
    try {
      summary = useGemini
        ? await summarizeWithAnthropic(prompt)
        : await summarizeWithGemini(prompt);
    } catch (fallbackErr) {
      console.error('[Memory] fallback also failed:', fallbackErr.message);
      return;
    }
  }

  if (summary?.trim()) {
    stmt.upsertMemory.run(userId, characterId, summary.trim());
  }
}

module.exports = { generateMemory };
