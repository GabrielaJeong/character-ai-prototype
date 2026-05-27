const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt } = require('../db');
const { verifyOwnership } = require('../lib/sessionOwnership');
const { streamReply } = require('../lib/streamReply');

const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_CHARACTER = 'ihwa';
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
]);

function sseSetup(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}
function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// POST /api/chat/regenerate — SSE streaming
// Body: { sessionId, model? }
module.exports = async (req, res) => {
  const { sessionId, model: rawModel } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = verifyOwnership(sessionId, req, res);
  if (!session) return;

  const lastMsg = stmt.getLastMessage.get(sessionId);
  if (!lastMsg || lastMsg.role !== 'assistant') {
    return res.status(400).json({ error: 'No assistant message to regenerate' });
  }

  // 새 모델 받으면 세션에 반영 (Codex F1 patch와 동일 정책)
  let model = session.model || DEFAULT_MODEL;
  if (rawModel && ALLOWED_MODELS.has(rawModel) && rawModel !== model) {
    stmt.updateSessionModel.run(rawModel, sessionId);
    model = rawModel;
  }

  stmt.deleteLastAssistantMessage.run(sessionId);

  const history = stmt.getMessages.all(sessionId).map(m => ({
    role:    m.role,
    content: m.content,
  }));

  const noteRow      = stmt.getNote.get(sessionId);
  const charId       = session.character_id || DEFAULT_CHARACTER;
  const safety       = session.safety || 'on';
  const systemPrompt = buildSystemPrompt(charId, JSON.parse(session.persona), noteRow?.note || '', safety, model);

  sseSetup(res);

  // res.on('close')만 true abort 신호 — req.on('close')는 body 읽음 끝에도 발화함
  let aborted = false;
  res.on('close', () => { if (!res.writableEnded) aborted = true; });

  let accumulated = '';
  try {
    accumulated = await streamReply({
      model,
      systemPrompt,
      history,
      maxTokens: 8192,
      onDelta: (text) => {
        if (aborted) return;
        sseWrite(res, { type: 'delta', text });
      },
    });
  } catch (err) {
    console.error('Regenerate stream error:', err.message);
    if (!aborted) sseWrite(res, { type: 'error', error: '재생성에 실패했습니다.' });
    if (accumulated) stmt.addMessage.run(sessionId, 'assistant', accumulated);
    if (!aborted) res.end();
    return;
  }

  if (accumulated) {
    stmt.addMessage.run(sessionId, 'assistant', accumulated);
  }

  if (!aborted) {
    sseWrite(res, { type: 'done', model });
    res.end();
  }
};
