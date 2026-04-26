const { callGemini } = require('./gemini');
const { stmt }       = require('../db');

const SUMMARY_MODEL  = 'gemini-2.5-flash';
const MAX_CHARS      = 8000; // 요약에 사용할 대화 최대 길이

async function generateMemory(userId, characterId, currentSessionId) {
  const sessions = stmt.getPrevSessions.all(userId, characterId, currentSessionId);
  if (!sessions.length) return;

  const convos = sessions
    .map(s => stmt.getMessages.all(s.id)
      .map(m => `${m.role === 'user' ? '유저' : '캐릭터'}: ${m.content}`)
      .join('\n')
    )
    .filter(c => c.trim().length > 0);

  if (!convos.length) return;

  const combined = convos.join('\n\n---\n\n').slice(0, MAX_CHARS);

  const prompt = `다음은 AI 캐릭터와 유저 사이의 대화 기록입니다.
이 유저에 대해 캐릭터가 다음 대화에서 기억해야 할 핵심 정보를 200자 이내로 요약하세요.
이름, 나이, 성격, 선호도, 감정적 연결고리, 중요한 사건 등을 포함하세요.
반드시 한국어로, 3인칭 ("이 유저는...") 으로 작성하세요.

대화 기록:
${combined}`;

  try {
    const summary = await callGemini({
      model:             SUMMARY_MODEL,
      systemInstruction: '당신은 AI 캐릭터의 기억 관리자입니다. 유저에 대한 정보를 간결하게 요약합니다.',
      history:           [{ role: 'user', content: prompt }],
      maxTokens:         400,
    });
    if (summary?.trim()) {
      stmt.upsertMemory.run(userId, characterId, summary.trim());
    }
  } catch (err) {
    console.error('[Memory] generation failed:', err.message);
  }
}

module.exports = { generateMemory };
