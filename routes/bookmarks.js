const express = require('express');
const router  = express.Router();
const { stmt } = require('../db');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  next();
}

// GET /api/bookmarks — 북마크한 character_id 목록
router.get('/', requireAuth, (req, res) => {
  const rows = stmt.getBookmarksByUser.all(req.session.userId);
  res.json(rows.map(r => r.character_id));
});

// POST /api/bookmarks/:characterId — 추가
router.post('/:characterId', requireAuth, (req, res) => {
  stmt.addBookmark.run(req.session.userId, req.params.characterId);
  res.json({ ok: true });
});

// DELETE /api/bookmarks/:characterId — 해제
router.delete('/:characterId', requireAuth, (req, res) => {
  stmt.removeBookmark.run(req.session.userId, req.params.characterId);
  res.json({ ok: true });
});

module.exports = router;
