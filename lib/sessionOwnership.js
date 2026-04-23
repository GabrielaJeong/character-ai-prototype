const { stmt } = require('../db');

/**
 * 세션 소유권 검증.
 * 통과하면 session 객체 반환, 실패하면 res에 오류 전송 후 null 반환.
 * 반환값이 null이면 호출 측에서 즉시 return.
 */
function verifyOwnership(sessionId, req, res) {
  const session = stmt.getSession.get(sessionId);
  if (!session) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    return null;
  }

  const currentUserId = req.session?.userId || null;

  if (currentUserId) {
    if (session.user_id !== currentUserId) {
      res.status(403).json({ error: '권한이 없습니다' });
      return null;
    }
  } else {
    const guestId = req.session?.guestId || null;
    if (session.user_id !== null || session.guest_id !== guestId) {
      res.status(403).json({ error: '권한이 없습니다' });
      return null;
    }
  }

  return session;
}

module.exports = { verifyOwnership };
