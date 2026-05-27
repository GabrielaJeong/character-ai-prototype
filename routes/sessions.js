const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const { stmt } = require('../db');
const { verifyOwnership } = require('../lib/sessionOwnership');

const CHARS_DIR = path.join(__dirname, '..', 'prompts', 'characters');

/**
 * Codex R4 F4: 세션 detail에 character config 임베드.
 * 클라이언트가 별도로 /api/characters/:id를 호출하면 adult filter를 우회하는 문제 →
 * "본인이 소유한 세션" 권한 안에서만 character 정보를 받도록 함.
 */
function loadCharacterMeta(id) {
  if (!id) return null;
  const p = path.join(CHARS_DIR, id, 'config.json');
  if (!fs.existsSync(p)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(p, 'utf-8'));
    // 채팅에 필요한 필드만 노출 (notes/_builderData 같은 IP 노출 안 함)
    return {
      id:           config.id || id,
      name:         config.name,
      nameEn:       config.nameEn,
      role:         config.role,
      team:         config.team,
      image:        config.image,
      rating:       config.rating,
      defaultSafety: config.defaultSafety,
      safetyToggle: config.safetyToggle,
      owner_username: config.owner_username,
    };
  } catch { return null; }
}

// GET /api/sessions — list sessions (filtered by auth state)
router.get('/', (req, res) => {
  const uid  = req.session?.userId || null;
  const rows = uid
    ? stmt.listSessionsByUser.all(uid)
    : stmt.listSessionsByGuest.all(req.session?.guestId || '');
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

// GET /api/sessions/:id — get session + full message history + character meta
router.get('/:id', (req, res) => {
  const session = verifyOwnership(req.params.id, req, res);
  if (!session) return;

  const messages = stmt.getMessages.all(req.params.id);
  res.json({
    id:            session.id,
    character_id:  session.character_id,
    character:     loadCharacterMeta(session.character_id), // Codex R4 F4
    safety:        session.safety || 'on',
    model:         session.model,
    persona:       JSON.parse(session.persona),
    message_count: messages.length,
    messages,
    created_at:    session.created_at,
  });
});

// GET  /api/sessions/:id/safety
// Codex R4 F3: 같은 리소스 정책 — verifyOwnership 적용 (PUT은 이미 있음)
router.get('/:id/safety', (req, res) => {
  const session = verifyOwnership(req.params.id, req, res);
  if (!session) return;
  res.json({ safety: session.safety || 'on' });
});

// PUT  /api/sessions/:id/safety
router.put('/:id/safety', (req, res) => {
  const { safety } = req.body;
  if (safety !== 'on' && safety !== 'off') {
    return res.status(400).json({ error: 'safety must be "on" or "off"' });
  }
  const session = verifyOwnership(req.params.id, req, res);
  if (!session) return;
  stmt.updateSessionSafety.run(safety, req.params.id);
  res.json({ ok: true, safety });
});

module.exports = router;
