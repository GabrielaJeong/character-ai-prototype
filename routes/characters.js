const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const { stmt } = require('../db');
const { parseImageDataUrl } = require('../lib/imageData');
const { CHARS_DIR, IMAGES_DIR } = require('../lib/paths');

// ── Auth helpers (Codex R4 F1) ─────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  next();
}

function loadCharConfig(id) {
  const p = path.join(CHARS_DIR, id, 'config.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

/** 캐릭터 owner 또는 admin만 통과. 프리빌트(owner_user_id 없음)는 admin만. */
function requireOwnerOrAdmin(req, res, next) {
  const uid = req.session?.userId;
  if (!uid) return res.status(401).json({ error: '로그인이 필요합니다' });
  const config = loadCharConfig(req.params.id);
  if (!config) return res.status(404).json({ error: 'Not found' });
  if (config.owner_user_id && config.owner_user_id === uid) {
    req._charConfig = config;
    return next();
  }
  const user = stmt.getUserById.get(uid);
  if (user?.role === 'admin') {
    req._charConfig = config;
    return next();
  }
  return res.status(403).json({ error: '권한이 없습니다' });
}

// GET /api/characters — list all characters from config.json files
// Filters adult_only characters unless user has adult_content_enabled
router.get('/', (req, res) => {
  try {
    // Determine adult access from session
    let adultEnabled = false;
    if (req.session?.userId) {
      const user = stmt.getUserById.get(req.session.userId);
      adultEnabled = !!(user?.adult_content_enabled);
    }

    const dirs = fs.readdirSync(CHARS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    // ── 통계 집계 ─────────────────────────────────────────
    const now7dAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    const sessionTotals  = Object.fromEntries(
      stmt.charSessionCounts.all().map(r => [r.character_id, r.cnt])
    );
    const sessionRecent  = Object.fromEntries(
      stmt.charSessionCountsRecent.all(now7dAgo).map(r => [r.character_id, r.cnt])
    );
    const bookmarkTotals = Object.fromEntries(
      stmt.charBookmarkCounts.all().map(r => [r.character_id, r.cnt])
    );

    // HOT 임계값: 최근 7일 세션 상위 기준 (최소 1회 이상이면서 상위 50%)
    const recentCounts = Object.values(sessionRecent).filter(n => n > 0);
    const hotThreshold = recentCounts.length > 0
      ? Math.max(1, Math.ceil(recentCounts.sort((a, b) => b - a)[Math.floor(recentCounts.length / 2)]))
      : Infinity;

    const characters = dirs
      .map(id => {
        const configPath = path.join(CHARS_DIR, id, 'config.json');
        if (!fs.existsSync(configPath)) return null;
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          // ── 배지 판정 ──────────────────────────────────
          const charDir   = path.join(CHARS_DIR, id);
          const configStat = fs.statSync(configPath);
          const sysMdPath  = path.join(charDir, 'system.md');
          const sysMtime   = fs.existsSync(sysMdPath) ? fs.statSync(sysMdPath).mtimeMs : 0;
          const updatedMs  = Math.max(configStat.mtimeMs, sysMtime);
          const createdAt  = config.created_at
            ? new Date(config.created_at).getTime()
            : configStat.birthtimeMs;

          const isNew = (Date.now() - createdAt)    < 7 * 24 * 60 * 60 * 1000;
          const isHot = (sessionRecent[id] || 0)   >= hotThreshold;
          const isUp  = !isNew && (Date.now() - updatedMs) < 7 * 24 * 60 * 60 * 1000;

          // badge_override가 있으면 우선 적용
          const badge = config.badge_override !== undefined
            ? (config.badge_override || null)
            : isNew ? 'NEW' : isHot ? 'HOT' : isUp ? 'UP' : null;

          // Resolve owner username for user-created characters
          let owner_username = null;
          if (id.startsWith('char_') && config.owner_user_id) {
            const owner = stmt.getUserById.get(config.owner_user_id);
            owner_username = owner?.username || null;
          }

          return {
            ...config,
            owner_username,
            badge,
            stats: {
              sessions:  sessionTotals[id]  || 0,
              bookmarks: bookmarkTotals[id] || 0,
            },
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(c => {
        if (c.rating === 'adult_only' && !adultEnabled) return false;
        return true;
      });

    res.json(characters);
  } catch (err) {
    console.error('Failed to load characters:', err.message);
    res.status(500).json({ error: 'Failed to load characters' });
  }
});

// GET /api/characters/:id — single character config
// Codex R4 F4 (가벼운 대안): adult_only 캐릭터는 어드민 또는
//   (1) 본인의 adult_content_enabled === 1 인 사용자
//   (2) 해당 캐릭터로 만든 기존 세션 소유자 (user_id 또는 guest_id 매칭)
// 에게만 노출. 나머지(all/toggleable)는 누구나 조회 가능 (필터 없음).
router.get('/:id', (req, res) => {
  const charId = req.params.id;
  const configPath = path.join(CHARS_DIR, charId, 'config.json');
  if (!fs.existsSync(configPath)) {
    return res.status(404).json({ error: 'Character not found' });
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read character config' });
  }

  if (config.rating === 'adult_only') {
    const uid = req.session?.userId || null;
    const guestId = req.session?.guestId || null;
    let allowed = false;
    if (uid) {
      const user = stmt.getUserById.get(uid);
      if (user?.role === 'admin') allowed = true;
      else if (user?.adult_content_enabled) allowed = true;
    }
    // 본인이 기존에 대화한 세션이 있으면 통과 (history에서 그 세션 진입 가능하도록)
    if (!allowed && (uid || guestId)) {
      if (stmt.hasSessionForChar.get(charId, uid, guestId)) allowed = true;
    }
    if (!allowed) return res.status(403).json({ error: '권한이 없습니다' });
  }

  res.json(config);
});

// POST /api/characters/create
// Body: { characterData, systemPrompt }
// Returns: { success, id, config }
// Codex R4 F1: 로그인 필수 — 비로그인 생성 시 owner_user_id null이라 orphan + 비용/스팸 위험
router.post('/create', requireAuth, (req, res) => {
  const { characterData, systemPrompt } = req.body;
  if (!characterData || !systemPrompt) {
    return res.status(400).json({ error: 'characterData and systemPrompt required' });
  }

  // 이미지 검증을 파일 생성 전에 — 오버사이즈면 orphan 디렉터리 안 남김 (R5-7)
  const { imageData } = req.body;
  let img = null;
  if (imageData && typeof imageData === 'string') {
    img = parseImageDataUrl(imageData);
    if (img.error) return res.status(400).json({ error: img.error });
  }

  const id = 'char_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const charDir = path.join(CHARS_DIR, id);

  try {
    fs.mkdirSync(charDir, { recursive: true });

    // Write system.md
    fs.writeFileSync(path.join(charDir, 'system.md'), systemPrompt, 'utf-8');

    // Save image if provided (검증 완료된 버퍼)
    let imagePath = null;
    if (img) {
      const filename = `${id}.${img.ext}`;
      fs.writeFileSync(path.join(IMAGES_DIR, filename), img.buffer);
      imagePath = `/images/${filename}`;
    }

    // Build config.json from characterData
    const rating = characterData.rating || (characterData.hasProfanity ? 'adult_only' : 'all_ages');
    const config = {
      id,
      status:       'active',
      owner_user_id: req.session?.userId || null,
      name:         characterData.name,
      fullName:     characterData.name,
      subtitle:     characterData.subtitle || `${characterData.name} · ${characterData.occupation || ''}`,
      team:         characterData.occupation || '',
      role:         characterData.occupation || '',
      image:        imagePath,
      rating,
      safetyToggle: rating === 'toggleable',
      defaultSafety: rating === 'adult_only' ? 'off' : 'on',
      profile: {
        '나이':  `${characterData.age}세`,
        '직업':  characterData.occupation || '',
      },
      tags:               Array.isArray(characterData.tags) ? characterData.tags.slice(0, 8) : [],
      description:        [characterData.background || ''].filter(Boolean),
      recommendedPersona: null,
      _builderData: {
        appearance:    characterData.appearance    || '',
        personality:   characterData.personality   || '',
        speechStyle:   characterData.speechStyle   || '',
        speechExamples: Array.isArray(characterData.speechExamples) ? characterData.speechExamples : [],
        background:    characterData.background    || '',
        relationship:  characterData.relationship  || '',
        boundaries:    characterData.boundaries    || '',
      },
    };

    fs.writeFileSync(path.join(charDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');

    res.json({ success: true, id, config });
  } catch (err) {
    console.error('Create character error:', err.message);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// GET /api/characters/:id/system — return system.md for editing
// Codex R4 F1: prompt engineering IP 보호 + 프리빌트는 admin만, 유저 제작은 owner+admin만
router.get('/:id/system', requireOwnerOrAdmin, (req, res) => {
  const sysPath = path.join(CHARS_DIR, req.params.id, 'system.md');
  if (!fs.existsSync(sysPath)) return res.status(404).json({ error: 'Not found' });
  res.json({ systemPrompt: fs.readFileSync(sysPath, 'utf-8') });
});

// DELETE /api/characters/:id
// Codex R4 F1: owner 또는 admin만. 프리빌트는 admin만 삭제 가능.
router.delete('/:id', requireOwnerOrAdmin, (req, res) => {
  const id      = req.params.id;
  const charDir = path.join(CHARS_DIR, id);
  if (!fs.existsSync(charDir)) return res.status(404).json({ error: 'Not found' });
  try {
    fs.rmSync(charDir, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete character error:', err.message);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

module.exports = router;
