const express  = require('express');
const router   = express.Router();
const { stmt } = require('../db');

// GET /api/notifications
router.get('/', (req, res) => {
  const userId = req.session?.userId || null;
  const list = userId
    ? stmt.listNotifications.all(userId, userId)
    : stmt.listNotificationsGuest.all();
  const unreadCount = userId
    ? stmt.countUnread.get(userId, userId).cnt
    : list.length;
  res.json({ items: list, unreadCount });
});

// GET /api/notifications/unread-count
router.get('/unread-count', (req, res) => {
  const userId = req.session?.userId || null;
  if (!userId) {
    const { cnt } = stmt.countBroadcastNotifs.get();
    return res.json({ count: cnt });
  }
  const { cnt } = stmt.countUnread.get(userId, userId);
  res.json({ count: cnt });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  stmt.markAllRead.run(req.session.userId, req.session.userId);
  res.json({ ok: true });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  stmt.markOneRead.run(req.session.userId, Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
