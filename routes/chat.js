const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory session store: sessionId -> { persona, history }
const sessions = new Map();

// POST /api/chat
router.post('/', async (req, res) => {
  const { sessionId, message, persona } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  // Initialize session if new
  if (!sessions.has(sessionId)) {
    if (!persona) {
      return res.status(400).json({ error: 'persona is required for new sessions' });
    }
    sessions.set(sessionId, { persona, history: [] });
  }

  const session = sessions.get(sessionId);
  session.history.push({ role: 'user', content: message });

  const systemPrompt = buildSystemPrompt(session.persona);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: session.history,
    });

    const reply = response.content[0].text;
    session.history.push({ role: 'assistant', content: reply });

    res.json({ reply, sessionId });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.status(500).json({ error: 'Failed to get response from Claude' });
  }
});

// DELETE /api/chat/:sessionId — clear session
router.delete('/:sessionId', (req, res) => {
  sessions.delete(req.params.sessionId);
  res.json({ ok: true });
});

module.exports = router;
