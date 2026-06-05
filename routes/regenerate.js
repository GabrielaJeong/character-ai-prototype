const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt } = require('../db');
const { verifyOwnership } = require('../lib/sessionOwnership');
const { streamReply } = require('../lib/streamReply');

const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_CHARACTER = 'ihwa';
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-8',
  'claude-opus-4-7',
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
//
// Codex R2 F2: 기존 assistant를 미리 삭제하지 않고, 새 응답이 도착해야 교체.
// 스트림 전체 실패 → 기존 assistant 그대로 유지 (DB 일관성)
// 스트림 partial (1글자라도 옴) → 기존 삭제 + partial 저장 (frontend도 partial 표시)
module.exports = async (req, res) => {
  const { sessionId, model: rawModel } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = verifyOwnership(sessionId, req, res);
  if (!session) return;

  const lastMsg = stmt.getLastMessage.get(sessionId);
  if (!lastMsg || lastMsg.role !== 'assistant') {
    return res.status(400).json({ error: 'No assistant message to regenerate' });
  }

  let model = session.model || DEFAULT_MODEL;
  if (rawModel && ALLOWED_MODELS.has(rawModel) && rawModel !== model) {
    stmt.updateSessionModel.run(rawModel, sessionId);
    model = rawModel;
  }

  // 기존 assistant 삭제는 stream 완료 후로 미룸. 대신 prompt 컨텍스트에서 제외:
  // getMessages는 오래된 순. 마지막은 우리가 교체하려는 assistant이므로 slice(0, -1).
  const allMessages = stmt.getMessages.all(sessionId);
  const history = allMessages.slice(0, -1).map(m => ({
    role:    m.role,
    content: m.content,
  }));

  const noteRow      = stmt.getNote.get(sessionId);
  const charId       = session.character_id || DEFAULT_CHARACTER;
  const safety       = session.safety || 'on';
  const systemPrompt = buildSystemPrompt(charId, JSON.parse(session.persona), noteRow?.note || '', safety, model);

  sseSetup(res);

  let aborted = false;
  // Codex R3 F4: provider SDK까지 abort 전달
  const providerCtrl = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      aborted = true;
      providerCtrl.abort();
    }
  });

  // Codex R2 F1: route-level accumulator
  let accumulated = '';
  let streamError = null;
  try {
    await streamReply({
      model,
      systemPrompt,
      history,
      maxTokens: 8192,
      signal: providerCtrl.signal,
      onDelta: (text) => {
        accumulated += text;
        if (aborted) return;
        sseWrite(res, { type: 'delta', text });
      },
    });
  } catch (err) {
    console.error('Regenerate stream error:', err.message);
    streamError = err.message;
  }

  // Codex R2 F2: 새 응답이 있으면 (성공/partial 무관) 기존 교체. 없으면 기존 유지.
  if (accumulated) {
    stmt.deleteLastAssistantMessage.run(sessionId);
    stmt.addMessage.run(sessionId, 'assistant', accumulated);
  }

  if (streamError) {
    if (!aborted) sseWrite(res, { type: 'error', error: '재생성에 실패했습니다.' });
    if (!aborted) res.end();
    return;
  }

  if (!aborted) {
    sseWrite(res, { type: 'done', model });
    res.end();
  }
};
