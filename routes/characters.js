const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const CHARS_DIR  = path.join(__dirname, '..', 'prompts', 'characters');
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

// GET /api/characters — list all characters from config.json files
router.get('/', (req, res) => {
  try {
    const dirs = fs.readdirSync(CHARS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const characters = dirs
      .map(id => {
        const configPath = path.join(CHARS_DIR, id, 'config.json');
        if (!fs.existsSync(configPath)) return null;
        try {
          return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);

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
    const config = {
      id,
      status:       'active',
      name:         characterData.name,
      fullName:     characterData.name,
      subtitle:     characterData.subtitle || `${characterData.name} · ${characterData.occupation || ''}`,
      team:         characterData.occupation || '',
      role:         characterData.occupation || '',
      image:        imagePath,
      safetyToggle: !characterData.hasProfanity,
      defaultSafety: characterData.hasProfanity ? 'off' : 'on',
      profile: {
        '나이':  `${characterData.age}세`,
        '직업':  characterData.occupation || '',
      },
      description:        [characterData.background || ''].filter(Boolean),
      recommendedPersona: null,
    };

    fs.writeFileSync(path.join(charDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');

    res.json({ success: true, id, config });
  } catch (err) {
    console.error('Create character error:', err.message);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

module.exports = router;
