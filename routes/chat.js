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
const DEFAULT_MODEL = 'claude-sonnet-4-6';

// POST /api/chat
router.post('/', async (req, res) => {
  const { sessionId, message, persona, model: rawModel } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  const model = ALLOWED_MODELS.has(rawModel) ? rawModel : DEFAULT_MODEL;

  // Create session if new
  let session = stmt.getSession.get(sessionId);
  if (!session) {
    if (!persona) {
      return res.status(400).json({ error: 'persona is required for new sessions' });
    }
    stmt.createSession.run(sessionId, JSON.stringify(persona), model);
    session = stmt.getSession.get(sessionId);
  } else if (session.model !== model) {
    // Update model if user switched mid-session
    stmt.updateSessionModel.run(model, sessionId);
  }

  const persona_data = typeof session.persona === 'string'
    ? JSON.parse(session.persona)
    : session.persona;

  // Save user message
  stmt.addMessage.run(sessionId, 'user', message);

  // Load full history for context
  const history = stmt.getMessages.all(sessionId).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const noteRow      = stmt.getNote.get(sessionId);
  const systemPrompt = buildSystemPrompt(persona_data, noteRow?.note || '');

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   history,
    });

    const reply = response.content[0].text;
    stmt.addMessage.run(sessionId, 'assistant', reply);

    res.json({ reply, sessionId, model });
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
