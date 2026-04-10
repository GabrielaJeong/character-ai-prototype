const Anthropic = require('@anthropic-ai/sdk');
const { callGemini } = require('../lib/gemini');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt } = require('../db');

const anthropic         = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GEMINI_MODELS     = new Set(['gemini-2.5-flash', 'gemini-2.5-pro']);
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_CHARACTER = 'ihwa';

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
module.exports = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = stmt.getSession.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const lastMsg = stmt.getLastMessage.get(sessionId);
  if (!lastMsg || lastMsg.role !== 'assistant') {
    return res.status(400).json({ error: 'No assistant message to regenerate' });
  }

  stmt.deleteLastAssistantMessage.run(sessionId);

  const history = stmt.getMessages.all(sessionId).map(m => ({
    role:    m.role,
    content: m.content,
  }));

  const noteRow      = stmt.getNote.get(sessionId);
  const charId       = session.character_id || DEFAULT_CHARACTER;
  const safety       = session.safety || 'on';
  const systemPrompt = buildSystemPrompt(charId, JSON.parse(session.persona), noteRow?.note || '', safety);
  const model        = session.model || DEFAULT_MODEL;

  try {
    const reply = await getReply({ model, systemPrompt, history, maxTokens: 8192 });
    stmt.addMessage.run(sessionId, 'assistant', reply);
    res.json({ reply });
  } catch (err) {
    console.error('Regenerate error:', err.message);
    res.status(500).json({ error: 'Failed to regenerate' });
  }
};
