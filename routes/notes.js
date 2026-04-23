const express = require('express');
const router  = express.Router({ mergeParams: true });
const { stmt } = require('../db');
const { verifyOwnership } = require('../lib/sessionOwnership');

const MAX_NOTE_LENGTH = 1000;

// GET /api/sessions/:id/note
router.get('/', (req, res) => {
  const session = verifyOwnership(req.params.id, req, res);
  if (!session) return;
  const row = stmt.getNote.get(req.params.id);
  res.json({ note: row?.note || '' });
});

// PUT /api/sessions/:id/note
router.put('/', (req, res) => {
  const { note = '' } = req.body;
  if (note.length > MAX_NOTE_LENGTH) {
    return res.status(400).json({ error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` });
  }
  const session = verifyOwnership(req.params.id, req, res);
  if (!session) return;
  stmt.saveNote.run(note, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
