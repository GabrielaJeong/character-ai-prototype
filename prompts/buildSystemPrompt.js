const fs   = require('fs');
const path = require('path');

const PROMPTS_DIR = __dirname;

function buildSystemPrompt(characterId, persona, note = '', safety = 'on') {
  const guardrails = fs.readFileSync(
    path.join(PROMPTS_DIR, 'common', 'guardrails.md'),
    'utf-8'
  );
  const charPrompt = fs.readFileSync(
    path.join(PROMPTS_DIR, 'characters', characterId, 'system.md'),
    'utf-8'
  );

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

  const safetyBlock = `
---

## Content Rating (Safety Toggle)

Current setting: **${safety === 'off' ? 'Safety OFF (19+)' : 'Safety ON (All Ages)'}**

${safety === 'off'
  ? 'Sexual and explicit content is permitted. Follow the Safety OFF rules defined in the guardrails.'
  : 'Safety ON is active. Follow the Safety ON rules defined in the guardrails. No sexual or explicit content.'}
`;

  return charPrompt + '\n\n' + guardrails + safetyBlock + personaBlock + noteBlock;
}

module.exports = { buildSystemPrompt };
