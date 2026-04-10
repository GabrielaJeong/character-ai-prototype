const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const CHARS_DIR = path.join(__dirname, '..', 'prompts', 'characters');

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

module.exports = router;
