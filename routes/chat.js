const express = require('express');
const router  = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt } = require('../db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
]);
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_CHARACTER = 'ihwa';

// POST /api/chat
router.post('/', async (req, res) => {
  const { sessionId, message, persona, model: rawModel, characterId: rawCharId } = req.body;

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
    stmt.createSession.run(sessionId, JSON.stringify(persona), model, characterId);
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
  const systemPrompt = buildSystemPrompt(charId, persona_data, noteRow?.note || '');

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   history,
    });

    const reply = response.content[0].text;
    stmt.addMessage.run(sessionId, 'assistant', reply);

    res.json({ reply, sessionId, model, characterId: charId });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.status(500).json({ error: 'Failed to get response from Claude' });
  }
});

// DELETE /api/chat/:sessionId
router.delete('/:sessionId', (req, res) => {
  stmt.deleteSession.run(req.params.sessionId);
  res.json({ ok: true });
});

module.exports = router;
