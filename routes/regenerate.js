const Anthropic = require('@anthropic-ai/sdk');
const { callGemini } = require('../lib/gemini');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt } = require('../db');
const { verifyOwnership } = require('../lib/sessionOwnership');

const anthropic         = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GEMINI_MODELS     = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview']);
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_CHARACTER = 'ihwa';
// chat.js와 동일하게 화이트리스트 검증 (요청 body에서 model 받을 때 사용)
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
]);

async function getReply({ model, systemPrompt, history, maxTokens = 8192 }) {
  if (GEMINI_MODELS.has(model)) {
    return callGemini({ model, systemInstruction: systemPrompt, history, maxTokens });
  }
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages:   history,
  });
  return response.content[0].text;
}

// POST /api/chat/regenerate
// Body: { sessionId, model? }  — model 전달 시 세션 모델 갱신 (Codex F1).
module.exports = async (req, res) => {
  const { sessionId, model: rawModel } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = verifyOwnership(sessionId, req, res);
  if (!session) return;

  const lastMsg = stmt.getLastMessage.get(sessionId);
  if (!lastMsg || lastMsg.role !== 'assistant') {
    return res.status(400).json({ error: 'No assistant message to regenerate' });
  }

  // 요청에서 새 모델이 왔고 화이트리스트면 세션에 반영. 아니면 기존 session.model 유지.
  let model = session.model || DEFAULT_MODEL;
  if (rawModel && ALLOWED_MODELS.has(rawModel) && rawModel !== model) {
    stmt.updateSessionModel.run(rawModel, sessionId);
    model = rawModel;
  }

  stmt.deleteLastAssistantMessage.run(sessionId);

  const history = stmt.getMessages.all(sessionId).map(m => ({
    role:    m.role,
    content: m.content,
  }));

  const noteRow      = stmt.getNote.get(sessionId);
  const charId       = session.character_id || DEFAULT_CHARACTER;
  const safety       = session.safety || 'on';
  const systemPrompt = buildSystemPrompt(charId, JSON.parse(session.persona), noteRow?.note || '', safety, model);

  try {
    const reply = await getReply({ model, systemPrompt, history, maxTokens: 8192 });
    stmt.addMessage.run(sessionId, 'assistant', reply);
    res.json({ reply, model });
  } catch (err) {
    console.error('Regenerate error:', err.message);
    res.status(500).json({ error: 'Failed to regenerate' });
  }
};
