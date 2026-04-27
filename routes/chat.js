const express    = require('express');
const router     = express.Router();
const { randomUUID } = require('crypto');
const Anthropic  = require('@anthropic-ai/sdk');
const { callGemini } = require('../lib/gemini');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt } = require('../db');
const { verifyOwnership } = require('../lib/sessionOwnership');
const { generateMemory }  = require('../lib/memory');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
]);
const GEMINI_MODELS     = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview']);
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_CHARACTER = 'ihwa';

async function getReply({ model, systemPrompt, history, maxTokens = 1024 }) {
  if (GEMINI_MODELS.has(model)) {
    return callGemini({ model, systemInstruction: systemPrompt, history, maxTokens });
  }
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages:   history,
  });
  return response.content[0].text;
}

// POST /api/chat
router.post('/', async (req, res) => {
  const { sessionId, message, persona, model: rawModel, characterId: rawCharId, safety: rawSafety } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  const model       = ALLOWED_MODELS.has(rawModel) ? rawModel : DEFAULT_MODEL;
  const characterId = rawCharId || DEFAULT_CHARACTER;

  // Create session if new, otherwise verify ownership
  let session  = stmt.getSession.get(sessionId);
  let isNew    = false;
  if (!session) {
    if (!persona) {
      return res.status(400).json({ error: 'persona is required for new sessions' });
    }
    const safety  = rawSafety === 'off' ? 'off' : 'on';
    const userId  = req.session?.userId || null;
    const guestId = userId ? null : (req.session?.guestId || null);
    stmt.createSession.run(sessionId, JSON.stringify(persona), model, characterId, safety, userId, guestId);
    session = stmt.getSession.get(sessionId);
    isNew   = true;
  } else {
    const owned = verifyOwnership(sessionId, req, res);
    if (!owned) return;
    if (session.model !== model) {
      stmt.updateSessionModel.run(model, sessionId);
    }
  }

  const persona_data = typeof session.persona === 'string'
    ? JSON.parse(session.persona)
    : session.persona;

  const charId = session.character_id || DEFAULT_CHARACTER;

  // Save user message
  stmt.addMessage.run(sessionId, 'user', message);

  // Load full history for context
  const history = stmt.getMessages.all(sessionId).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const noteRow  = stmt.getNote.get(sessionId);
  const safety   = session.safety || 'on';
  const userId   = session.user_id;

  // Long-term memory: 로그인 유저의 새 세션에서만 로드 + 백그라운드 재생성
  let memory = '';
  if (userId) {
    const memRow = stmt.getMemory.get(userId, charId);
    memory = memRow?.summary || '';
    if (isNew) {
      // 백그라운드에서 이전 세션 요약 갱신 (레이턴시 없음)
      generateMemory(userId, charId, sessionId, model).catch(() => {});
    }
  }

  const systemPrompt = buildSystemPrompt(charId, persona_data, noteRow?.note || '', safety, model, memory);

  try {
    const reply = await getReply({ model, systemPrompt, history, maxTokens: 8192 });
    stmt.addMessage.run(sessionId, 'assistant', reply);

    // ── Safety violation auto-logging ─────────────────────
    if (safety === 'on') {
      const OOC_NOTICE_KO  = '현재 전연령 모드에서는 성인 콘텐츠를 제공할 수 없습니다';
      const OOC_BYPASS_KO  = 'OOC 지시로는 등급 설정을 변경할 수 없습니다';
      let triggerStep = null;
      if (reply.includes(OOC_BYPASS_KO))        triggerStep = 3; // OOC bypass attempt
      else if (reply.includes(OOC_NOTICE_KO))   triggerStep = 2; // IC deflection + OOC notice
      else if (/\(현재 전연령|캐릭터 프로필에서 등급/.test(reply)) triggerStep = 1;

      if (triggerStep) {
        const masked  = message.replace(/[^\s가-힣a-zA-Z0-9]/g, '*').slice(0, 200);
        const summary = reply.slice(0, 300);
        const userId  = session.user_id || null;
        stmt.insertModerationLog.run(
          randomUUID(), sessionId, userId, charId, model, 'triggered', triggerStep, masked, summary
        );
      }
    }

    res.json({ reply, sessionId, model, characterId: charId });
  } catch (err) {
    console.error('Chat API error:', err.message);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

// DELETE /api/chat/:sessionId
router.delete('/:sessionId', (req, res) => {
  stmt.deleteSession.run(req.params.sessionId);
  res.json({ ok: true });
});

module.exports = router;
