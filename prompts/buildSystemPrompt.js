const fs   = require('fs');
const path = require('path');

const PROMPTS_DIR = __dirname;

function buildSystemPrompt(characterId, persona, note = '', safety = 'on', model = '') {
  const guardrails = fs.readFileSync(
    path.join(PROMPTS_DIR, 'common', 'guardrails.md'),
    'utf-8'
  );
  const charPrompt = fs.readFileSync(
    path.join(PROMPTS_DIR, 'characters', characterId, 'system.md'),
    'utf-8'
  );

  // Model-specific corrections (skip if file doesn't exist)
  let modelCorrections = '';
  if (model) {
    const modelFile = path.join(PROMPTS_DIR, 'models', `${model}.md`);
    if (fs.existsSync(modelFile)) {
      const raw = fs.readFileSync(modelFile, 'utf-8').trim();
      // Only include if there's actual content beyond the header
      if (raw && raw !== '## MODEL-SPECIFIC CORRECTIONS') {
        modelCorrections = `\n\n---\n\n${raw}`;
      }
    }
  }

  // Safety block from dedicated files
  const safetyFile = safety === 'off' ? 'off.md' : 'on.md';
  const safetyContent = fs.readFileSync(
    path.join(PROMPTS_DIR, 'common', 'safety', safetyFile),
    'utf-8'
  );
  const safetyBlock = `\n\n---\n\n${safetyContent}`;

  const personaBlock = `
---

## User Persona (set by user at session start)

- **Name**: ${persona.name}
- **Age**: ${persona.age}
- **Appearance**: ${persona.appearance || 'Not specified'}
- **Personality**: ${persona.personality || 'Not specified'}
- **Notes**: ${persona.notes || 'None'}

Address them by name or pet name as appropriate.
`;

  const noteBlock = note.trim() ? `
---

## User Notes

The user has provided the following context.
Treat these as established facts in the conversation:

${note.trim()}
` : '';

  return charPrompt + '\n\n' + guardrails + modelCorrections + safetyBlock + personaBlock + noteBlock;
}

module.exports = { buildSystemPrompt };
