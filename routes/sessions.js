const express = require('express');
const router  = express.Router();
const { stmt } = require('../db');

// GET /api/sessions — list all sessions
router.get('/', (req, res) => {
  const sessions = stmt.listSessions.all().map(s => ({
    id:            s.id,
    persona:       JSON.parse(s.persona),
    message_count: s.message_count,
    last_message:  s.last_message,
    created_at:    s.created_at,
  }));
  res.json(sessions);
});

// GET /api/sessions/:id — get session + full message history
router.get('/:id', (req, res) => {
  const session = stmt.getSession.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const messages = stmt.getMessages.all(req.params.id);
  res.json({
    id:       session.id,
    persona:  JSON.parse(session.persona),
    messages,
    created_at: session.created_at,
  });
});

module.exports = router;
