const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const { stmt } = require('../db');

const CHARS_DIR = path.join(__dirname, '..', 'prompts', 'characters');

// GET /api/creator/:username
router.get('/:username', (req, res) => {
  const username = req.params.username.replace(/^@/, '').toLowerCase();
  const user = stmt.getUserByUsername.get(username);
  if (!user) return res.status(404).json({ error: '크리에이터를 찾을 수 없습니다' });

  // Collect user's characters from file system
  const chars = [];
  try {
    const sessionTotals  = Object.fromEntries(stmt.charSessionCounts.all().map(r => [r.character_id, r.cnt]));
    const bookmarkTotals = Object.fromEntries(stmt.charBookmarkCounts.all().map(r => [r.character_id, r.cnt]));

    const dirs = fs.readdirSync(CHARS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const id of dirs) {
      if (!id.startsWith('char_')) continue;
      const cfgPath = path.join(CHARS_DIR, id, 'config.json');
      if (!fs.existsSync(cfgPath)) continue;
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        if (cfg.owner_user_id !== user.id) continue;
        chars.push({
          id,
          name:        cfg.name || '',
          role:        cfg.role || cfg.team || '',
          image:       cfg.image || null,
          tags:        cfg.tags  || [],
          status:      cfg.status,
          rating:      cfg.rating,
          description: cfg.description || [],
          pinned:      cfg.pinned || false,
          stats: {
            sessions:  sessionTotals[id]  || 0,
            bookmarks: bookmarkTotals[id] || 0,
          },
        });
      } catch (_) {}
    }
  } catch (_) {}

  // Sort: pinned first, then by stats.sessions desc
  chars.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.stats.sessions + b.stats.bookmarks) - (a.stats.sessions + a.stats.bookmarks);
  });

  const isOwner = req.session?.userId === user.id;

  res.json({
    user: {
      id:         user.id,
      username:   user.username,
      nickname:   user.nickname,
      avatar:     user.avatar,
      public_id:  user.public_id,
      created_at: user.created_at,
    },
    characters: chars,
    isOwner,
  });
});

// PATCH /api/creator/:charId/pin — toggle pinned status (owner only)
router.patch('/:charId/pin', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: '로그인이 필요합니다' });

  const { charId } = req.params;
  if (!charId.startsWith('char_')) return res.status(400).json({ error: '잘못된 캐릭터 ID입니다' });

  const cfgPath = path.join(CHARS_DIR, charId, 'config.json');
  if (!fs.existsSync(cfgPath)) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });

  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg.owner_user_id !== req.session.userId) return res.status(403).json({ error: '권한이 없습니다' });

    cfg.pinned = !cfg.pinned;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
    res.json({ pinned: cfg.pinned });
  } catch (err) {
    console.error('Pin error:', err.message);
    res.status(500).json({ error: '처리에 실패했습니다' });
  }
});

module.exports = router;
