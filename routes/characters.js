const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const { stmt } = require('../db');

const CHARS_DIR  = path.join(__dirname, '..', 'prompts', 'characters');
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

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
router.get('/:id', (req, res) => {
  const configPath = path.join(CHARS_DIR, req.params.id, 'config.json');
  if (!fs.existsSync(configPath)) {
    return res.status(404).json({ error: 'Character not found' });
  }
  try {
    res.json(JSON.parse(fs.readFileSync(configPath, 'utf-8')));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read character config' });
  }
});

// POST /api/characters/create
// Body: { characterData, systemPrompt }
// Returns: { success, id, config }
router.post('/create', (req, res) => {
  const { characterData, systemPrompt } = req.body;
  if (!characterData || !systemPrompt) {
    return res.status(400).json({ error: 'characterData and systemPrompt required' });
  }

  const id = 'char_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const charDir = path.join(CHARS_DIR, id);

  try {
    fs.mkdirSync(charDir, { recursive: true });

    // Write system.md
    fs.writeFileSync(path.join(charDir, 'system.md'), systemPrompt, 'utf-8');

    // Save image if provided (base64 dataURL)
    let imagePath = null;
    const { imageData } = req.body;
    if (imageData && typeof imageData === 'string') {
      const match = imageData.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/);
      if (match) {
        const ext      = match[1].replace('jpeg', 'jpg');
        const filename = `${id}.${ext}`;
        fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(match[2], 'base64'));
        imagePath = `/images/${filename}`;
      }
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
router.get('/:id/system', (req, res) => {
  const sysPath = path.join(CHARS_DIR, req.params.id, 'system.md');
  if (!fs.existsSync(sysPath)) return res.status(404).json({ error: 'Not found' });
  res.json({ systemPrompt: fs.readFileSync(sysPath, 'utf-8') });
});

// DELETE /api/characters/:id
router.delete('/:id', (req, res) => {
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
