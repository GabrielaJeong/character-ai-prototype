const Anthropic = require('@anthropic-ai/sdk');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt }  = require('../db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  // Remove last assistant message from DB
  stmt.deleteLastAssistantMessage.run(sessionId);

  // Reload history (now ends with the user's last message)
  const history = stmt.getMessages.all(sessionId).map(m => ({
    role:    m.role,
    content: m.content,
  }));

  // Always rebuild system prompt fresh from file (including latest note)
  const noteRow      = stmt.getNote.get(sessionId);
  const systemPrompt = buildSystemPrompt(JSON.parse(session.persona), noteRow?.note || '');

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   history,
    });

    const reply = response.content[0].text;
    stmt.addMessage.run(sessionId, 'assistant', reply);

    res.json({ reply });
  } catch (err) {
    console.error('Regenerate error:', err.message);
    res.status(500).json({ error: 'Failed to regenerate' });
  }
};
