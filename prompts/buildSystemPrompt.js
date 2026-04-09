const fs = require('fs');
const path = require('path');

function buildSystemPrompt(persona) {
  const base = fs.readFileSync(path.join(__dirname, 'system.md'), 'utf-8');

  const personaBlock = `
---

## User Persona (set by user at session start)

- **Name**: ${persona.name}
- **Age**: ${persona.age}
- **Appearance**: ${persona.appearance || 'Not specified'}
- **Personality**: ${persona.personality || 'Not specified'}
- **Notes**: ${persona.notes || 'None'}

Ihwa knows this person. Address them by name or pet name as appropriate.
`;

  return base + personaBlock;
}

module.exports = { buildSystemPrompt };
