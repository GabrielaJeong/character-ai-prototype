const express = require('express');
const router  = express.Router();
const { stmt } = require('../db');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  next();
}

// GET /api/personas
router.get('/', requireAuth, (req, res) => {
  const rows = stmt.getPersonasByUser.all(req.session.userId);
  res.json(rows.map(r => ({ ...r, data: JSON.parse(r.data) })));
});

// POST /api/personas
router.post('/', requireAuth, (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data required' });
  const info = stmt.createPersona.run(req.session.userId, JSON.stringify(data));
  res.json({ id: info.lastInsertRowid });
});

// PATCH /api/personas/:id
router.patch('/:id', requireAuth, (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data required' });
  const result = stmt.updatePersona.run(JSON.stringify(data), req.params.id, req.session.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// DELETE /api/personas/default — 기본 페르소나 해제
router.delete('/default', requireAuth, (req, res) => {
  stmt.updateDefaultPersona.run(null, req.session.userId);
  res.json({ ok: true });
});

// DELETE /api/personas/:id
router.delete('/:id', requireAuth, (req, res) => {
  const uid = req.session.userId;
  // If this was the default persona, clear default
  const user = stmt.getUserById.get(uid);
  if (user?.default_persona_id == req.params.id) {
    stmt.updateDefaultPersona.run(null, uid);
  }
  stmt.deletePersona.run(req.params.id, uid);
  res.json({ ok: true });
});

// PATCH /api/personas/:id/set-default
router.patch('/:id/set-default', requireAuth, (req, res) => {
  const row = stmt.getPersonaById.get(req.params.id, req.session.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  stmt.updateDefaultPersona.run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
