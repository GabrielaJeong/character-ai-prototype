const express   = require('express');
const router    = express.Router();
const fs        = require('fs');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { callGemini } = require('../lib/gemini');

const client = new Anthropic();

const GEMINI_MODELS     = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview']);
const ALLOWED_MODELS    = new Set([
  'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001',
  'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview',
]);
const DEFAULT_MODEL     = 'claude-sonnet-4-6';

const AGENT_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'builder', 'agent.md');

// In-memory conversation store keyed by builderSessionId
// Each entry: [{ role: 'user'|'assistant', content: string }]
const builderSessions = new Map();

// POST /api/builder/chat
// Body: { builderSessionId?, message, model? }
// Returns: { reply, builderSessionId, isReady }
router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const model = ALLOWED_MODELS.has(req.body.model) ? req.body.model : DEFAULT_MODEL;
  const sid   = req.body.builderSessionId ||
    ('b-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 5));

  const history = builderSessions.get(sid) || [];
  history.push({ role: 'user', content: message });

  try {
    const agentPrompt = fs.readFileSync(AGENT_PROMPT_PATH, 'utf-8');

    let reply;
    if (GEMINI_MODELS.has(model)) {
      reply = await callGemini({ model, systemInstruction: agentPrompt, history, maxTokens: 2048 });
    } else {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system:     agentPrompt,
        messages:   history,
      });
      reply = response.content[0].text;
    }

    history.push({ role: 'assistant', content: reply });
    builderSessions.set(sid, history);

    const isReady = reply.includes('[CHARACTER_READY]');

    res.json({ reply, builderSessionId: sid, isReady });
  } catch (err) {
    console.error('Builder chat error:', err.message);
    res.status(500).json({ error: 'Builder chat failed' });
  }
});

// POST /api/builder/generate
// Body: { characterData } — parsed JSON from [CHARACTER_READY] block
// Returns: { systemPrompt, characterData }
router.post('/generate', async (req, res) => {
  const { characterData } = req.body;
  if (!characterData) return res.status(400).json({ error: 'characterData required' });

  try {
    const prompt = buildGeneratePrompt(characterData);

    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawPrompt = response.content[0].text;
    // Normalize any remaining "유저" references to the {{user}} token
    const systemPrompt = rawPrompt.replace(/유저(?!들)/g, '{{user}}');
    res.json({ systemPrompt, characterData });
  } catch (err) {
    console.error('Builder generate error:', err.message);
    res.status(500).json({ error: 'Generation failed' });
  }
});

function buildGeneratePrompt(data) {
  const examples = Array.isArray(data.speechExamples)
    ? data.speechExamples.map((e, i) => `${i + 1}. "${e}"`).join('\n')
    : '';

  return `You are a professional AI character prompt writer for a Korean roleplay platform called Folio.

Generate a complete, production-ready character system prompt based on the character data below.

## Rules
1. Write ALL behavioral instructions in English (for AI instruction clarity).
2. All dialogue examples and speech samples must be written in Korean.
3. Structure the prompt in exactly 5 labeled blocks:
   - ## Block 1: Identity
   - ## Block 2: Personality & Behavioral Rules
   - ## Block 3: Writing & Speech Style
   - ## Block 4: Relationship with User
   - ## Block 5: Character-Specific Boundaries
4. In Block 2, convert every personality trait into concrete "DO / DO NOT" behavioral rules.
   Include situation-based mode switching (e.g., casual vs. stressed vs. romantic).
5. In Block 3, include:
   - Formality level (반말/존댓말), sentence length, vocabulary tendencies
   - At least 5 Korean dialogue example lines (use the speech examples provided)
   - One ✅ Good Example paragraph and one ❌ Bad Example paragraph showing correct vs incorrect writing style
6. In Block 5, include any hard limits and sensitive topics to avoid.
7. CRITICAL — {{user}} token: Whenever you refer to "the person chatting with this character" (the player / 유저 / 상대방), you MUST write the literal token {{user}} instead of any word like "유저", "상대방", "the user", "플레이어", etc. This token is replaced at runtime with the actual user's name. Apply this to ALL blocks, including dialogue examples.
8. End the entire prompt with this line exactly:
   > Refer to common/guardrails.md for platform-level content rules.

## Character Data
Name: ${data.name}
Age: ${data.age}
Occupation: ${data.occupation || 'N/A'}
One-line concept: ${data.subtitle || 'N/A'}
Appearance: ${data.appearance || 'N/A'}
Background: ${data.background || 'N/A'}
Personality: ${data.personality || 'N/A'}
Speech style: ${data.speechStyle || 'N/A'}
Speech examples:
${examples || 'N/A'}
Relationship with user: ${data.relationship || 'N/A'}
Boundaries: ${data.boundaries || 'N/A'}
Has profanity: ${data.hasProfanity ? 'yes' : 'no'}

Now write the complete system prompt:`;
}

module.exports = router;
