const express   = require('express');
const router    = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { callGemini } = require('../lib/gemini');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt } = require('../db');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);
const GEMINI_MODELS     = new Set(['gemini-2.5-flash', 'gemini-2.5-pro']);
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_CHARACTER = 'ihwa';

async function getReply({ model, systemPrompt, history, maxTokens = 1024 }) {
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

// POST /api/chat
router.post('/', async (req, res) => {
  const { sessionId, message, persona, model: rawModel, characterId: rawCharId, safety: rawSafety } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  const model       = ALLOWED_MODELS.has(rawModel) ? rawModel : DEFAULT_MODEL;
  const characterId = rawCharId || DEFAULT_CHARACTER;

  // Create session if new
  let session = stmt.getSession.get(sessionId);
  if (!session) {
    if (!persona) {
      return res.status(400).json({ error: 'persona is required for new sessions' });
    }
    const safety = rawSafety === 'off' ? 'off' : 'on';
    stmt.createSession.run(sessionId, JSON.stringify(persona), model, characterId, safety);
    session = stmt.getSession.get(sessionId);
  } else if (session.model !== model) {
    stmt.updateSessionModel.run(model, sessionId);
  }

  const persona_data = typeof session.persona === 'string'
    ? JSON.parse(session.persona)
    : session.persona;

  const charId = session.character_id || DEFAULT_CHARACTER;

  // Save user message
  stmt.addMessage.run(sessionId, 'user', message);

  // Load full history for context
  const history = stmt.getMessages.all(sessionId).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const noteRow      = stmt.getNote.get(sessionId);
  const safety       = session.safety || 'on';
  const systemPrompt = buildSystemPrompt(charId, persona_data, noteRow?.note || '', safety);

  try {
    const reply = await getReply({ model, systemPrompt, history, maxTokens: 8192 });
    stmt.addMessage.run(sessionId, 'assistant', reply);
    res.json({ reply, sessionId, model, characterId: charId });
  } catch (err) {
    console.error('Chat API error:', err.message);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

// DELETE /api/chat/:sessionId
router.delete('/:sessionId', (req, res) => {
  stmt.deleteSession.run(req.params.sessionId);
  res.json({ ok: true });
});

module.exports = router;
