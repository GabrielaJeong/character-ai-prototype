const express    = require('express');
const router     = express.Router();
const { randomUUID } = require('crypto');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');
const { stmt } = require('../db');
const { verifyOwnership } = require('../lib/sessionOwnership');
const { generateMemory }  = require('../lib/memory');
const { streamReply }     = require('../lib/streamReply');

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
]);
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_CHARACTER = 'ihwa';

/**
 * SSE 이벤트 writer.
 * 클라이언트는 각 `data: { ... }\n\n` 블록을 JSON으로 파싱.
 */
function sseSetup(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx proxy buffer 회피
  res.flushHeaders?.();
}
function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// POST /api/chat — SSE streaming
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

  // Save user message before streaming
  stmt.addMessage.run(sessionId, 'user', message);

  const history = stmt.getMessages.all(sessionId).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const noteRow  = stmt.getNote.get(sessionId);
  const safety   = session.safety || 'on';
  const userId   = session.user_id;

  let memory = '';
  if (userId) {
    const memRow = stmt.getMemory.get(userId, charId);
    memory = memRow?.summary || '';
    if (isNew) {
      generateMemory(userId, charId, sessionId, model).catch(() => {});
    }
  }

  const systemPrompt = buildSystemPrompt(charId, persona_data, noteRow?.note || '', safety, model, memory);

  // ── SSE streaming ────────────────────────────────────
  sseSetup(res);

  // 클라이언트 연결이 진짜 끊겼을 때만 abort.
  // 주의: req.on('close')는 Node HTTP에서 request body 다 읽으면 발화되므로 사용 불가.
  // res.on('close')는 res.end() 호출 전 연결 종료 시에만 발화 → 정확히 우리가 원하는 시점.
  let aborted = false;
  // Codex R3 F4: provider SDK까지 abort 전달 — client 중단 시 모델 호출도 취소
  const providerCtrl = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      aborted = true;
      providerCtrl.abort();
    }
  });

  // Codex R3 F3: stream 시작 전에 session 정보 송신 — 프론트가 URL 즉시 갱신해
  // 첫 메시지 스트리밍이 실패해도 새로고침 시 세션 손실 없음.
  sseWrite(res, { type: 'session', sessionId: session.id, model });

  // Codex R2 F1: 라우트 레벨 accumulator. streamReply 내부 acc는 중간 throw 시 lost되어
  // 빈 string만 반환되므로 partial 저장이 의미 없었음. onDelta에서 직접 누적해야 안전.
  let accumulated = '';
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
    console.error('Chat stream error:', err.message);
    if (!aborted) {
      sseWrite(res, { type: 'error', error: 'AI 응답에 실패했습니다.' });
    }
    if (accumulated) stmt.addMessage.run(sessionId, 'assistant', accumulated);
    if (!aborted) res.end();
    return;
  }

  // Save complete assistant message
  if (accumulated) {
    stmt.addMessage.run(sessionId, 'assistant', accumulated);
  }

  // ── Safety violation auto-logging (전연령 모드) ───────
  if (safety === 'on' && accumulated) {
    const OOC_NOTICE_KO = '현재 전연령 모드에서는 성인 콘텐츠를 제공할 수 없습니다';
    const OOC_BYPASS_KO = 'OOC 지시로는 등급 설정을 변경할 수 없습니다';
    let triggerStep = null;
    if (accumulated.includes(OOC_BYPASS_KO))      triggerStep = 3;
    else if (accumulated.includes(OOC_NOTICE_KO)) triggerStep = 2;
    else if (/\(현재 전연령|캐릭터 프로필에서 등급/.test(accumulated)) triggerStep = 1;

    if (triggerStep) {
      const masked  = message.replace(/[^\s가-힣a-zA-Z0-9]/g, '*').slice(0, 200);
      const summary = accumulated.slice(0, 300);
      stmt.insertModerationLog.run(
        randomUUID(), sessionId, session.user_id || null, charId, model, 'triggered', triggerStep, masked, summary
      );
    }
  }

  if (!aborted) {
    sseWrite(res, { type: 'done', sessionId, model, characterId: charId });
    res.end();
  }
});

// DELETE /api/chat/:sessionId
// Codex R3 F1: session ID 알기만 하면 누구나 삭제 가능했던 보안 취약점.
// verifyOwnership으로 user/guest 격리 강제.
router.delete('/:sessionId', (req, res) => {
  const session = verifyOwnership(req.params.sessionId, req, res);
  if (!session) return;
  stmt.deleteSession.run(req.params.sessionId);
  res.json({ ok: true });
});

module.exports = router;
