const fs   = require('fs');
const path = require('path');
const { CHARS_DIR, MODELS_DIR } = require('../lib/paths');

const PROMPTS_DIR = __dirname; // repo 고정 자산(guardrails/safety)용. characters·models는 런타임 경로.

function buildSystemPrompt(characterId, persona, note = '', safety = 'on', model = '', memory = '') {
  const guardrails = fs.readFileSync(
    path.join(PROMPTS_DIR, 'common', 'guardrails.md'),
    'utf-8'
  );
  const charPrompt = fs.readFileSync(
    path.join(CHARS_DIR, characterId, 'system.md'),
    'utf-8'
  );

  // Model-specific corrections (skip if file doesn't exist)
  let modelCorrections = '';
  if (model) {
    const modelFile = path.join(MODELS_DIR, `${model}.md`);
    if (fs.existsSync(modelFile)) {
      const raw = fs.readFileSync(modelFile, 'utf-8').trim();
      // 헤더만 남은 껍데기 파일은 주입하지 않는다.
      // 어드민 모델 편집기(PUT /api/admin/models/:id)로 템플릿만 저장하면 내용 없는
      // '### Known tendencies' 가 그대로 시스템 프롬프트에 들어가 토큰만 먹는다.
      // (기존 검사는 '## MODEL-SPECIFIC CORRECTIONS' 완전일치라, 제목에 모델명이 붙는
      //  순간 그냥 통과했다 — claude-opus-4-6.md 가 헤더 77자를 주입하던 원인)
      const body = raw.replace(/^\s*#{1,6}\s.*$/gm, '').trim();
      if (body) {
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

  const memoryBlock = memory.trim() ? `
---

## Long-term Memory (what you remember about this user from past conversations)

${memory.trim()}

Naturally weave this into the conversation where relevant — do not recite it verbatim.
` : '';

  return charPrompt + '\n\n' + guardrails + modelCorrections + safetyBlock + personaBlock + noteBlock + memoryBlock;
}

module.exports = { buildSystemPrompt };
