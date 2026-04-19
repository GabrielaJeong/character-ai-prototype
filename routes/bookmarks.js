const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const { stmt } = require('../db');

const CHARS_DIR = path.join(__dirname, '..', 'prompts', 'characters');

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
  const { characterId } = req.params;
  const userId = req.session.userId;
  stmt.addBookmark.run(userId, characterId);

  // 캐릭터 오너에게 SOCIAL 알림 생성
  try {
    const configPath = path.join(CHARS_DIR, characterId, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const ownerId = config.owner_user_id;
      if (ownerId && ownerId !== userId) {
        const me = stmt.getUserById.get(userId);
        const charName = config.name || characterId;
        stmt.createNotification.run(
          ownerId,
          'social',
          `누군가 ${charName}를 북마크했습니다`,
          `${me?.nickname || '익명'} 님이 ${charName} 캐릭터를 저장했어요.`,
          characterId
        );
      }
    }
  } catch (_) {}

  res.json({ ok: true });
});

// DELETE /api/bookmarks/:characterId — 해제
router.delete('/:characterId', requireAuth, (req, res) => {
  stmt.removeBookmark.run(req.session.userId, req.params.characterId);
  res.json({ ok: true });
});

module.exports = router;
