const express = require('express');
const router  = express.Router();
const { stmt } = require('../db');

// GET /api/sessions — list sessions (filtered by auth state)
router.get('/', (req, res) => {
  const uid  = req.session?.userId || null;
  const rows = uid
    ? stmt.listSessionsByUser.all(uid)
    : stmt.listSessionsGuest.all();
  const sessions = rows.map(s => ({
    id:            s.id,
    character_id:  s.character_id,
    safety:        s.safety || 'on',
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
    id:           session.id,
    character_id: session.character_id,
    persona:      JSON.parse(session.persona),
    messages,
    created_at:   session.created_at,
  });
});

// GET  /api/sessions/:id/safety
router.get('/:id/safety', (req, res) => {
  const session = stmt.getSession.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ safety: session.safety || 'on' });
});

// PUT  /api/sessions/:id/safety
router.put('/:id/safety', (req, res) => {
  const { safety } = req.body;
  if (safety !== 'on' && safety !== 'off') {
    return res.status(400).json({ error: 'safety must be "on" or "off"' });
  }
  const session = stmt.getSession.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  stmt.updateSessionSafety.run(safety, req.params.id);
  res.json({ ok: true, safety });
});

module.exports = router;
