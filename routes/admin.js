const express    = require('express');
const router     = express.Router();
const fs         = require('fs');
const path       = require('path');
const Anthropic  = require('@anthropic-ai/sdk');
const { db, stmt } = require('../db');
const { buildSystemPrompt } = require('../prompts/buildSystemPrompt');

const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CHARS_DIR     = path.join(__dirname, '..', 'prompts', 'characters');
const CURATION_FILE = path.join(__dirname, '..', 'data', 'curation.json');

// ── Admin guard ───────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  const user = stmt.getUserById.get(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '어드민 권한 필요' });
  next();
}
router.use(requireAdmin);

// ── Helper: load all character configs ───────────────────
function loadAllCharacters() {
  try {
    return fs.readdirSync(CHARS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const configPath = path.join(CHARS_DIR, d.name, 'config.json');
        if (!fs.existsSync(configPath)) return null;
        try {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          cfg._isPrebuilt = !d.name.startsWith('char_');
          return cfg;
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

// ── Helper: generate period labels ───────────────────────
function periodConfig(period) {
  if (period === 'week') {
    return { fmt: '%Y-W%W', days: 84,  label: 'week' };
  } else if (period === 'month') {
    return { fmt: '%Y-%m',  days: 365, label: 'month' };
  }
  return { fmt: '%Y-%m-%d', days: 30, label: 'day' };
}

function generateLabels(period) {
  const { fmt, days } = periodConfig(period);
  const labels = new Set();
  const now = new Date();

  if (period === 'day') {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      labels.add(d.toISOString().slice(0, 10));
    }
  } else if (period === 'week') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i * 7);
      const y = d.getFullYear();
      // ISO week
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const wk = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
      labels.add(`${tmp.getUTCFullYear()}-W${String(wk).padStart(2,'0')}`);
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      labels.add(d.toISOString().slice(0, 7));
    }
  }
  return [...labels];
}

function buildTimeSeries(rows, labels) {
  const map = {};
  for (const r of rows) map[r.period] = r.cnt;
  return labels.map(l => map[l] || 0);
}

// ══════════════════════════════════════════════════════════
//  STATS  GET /api/admin/stats
// ══════════════════════════════════════════════════════════
router.get('/stats', (req, res) => {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const todayStart   = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const monthStart   = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  const totalUsers    = stmt.countUsers.get().cnt;
  const todaySessions = stmt.countCharSessions.get(todayStart).cnt;
  const totalChars    = loadAllCharacters().length;
  const modLogs7d     = stmt.countModerationLogs7d.get(sevenDaysAgo).cnt;

  const todayPV = db.prepare('SELECT COUNT(*) AS cnt FROM page_views WHERE created_at >= ?').get(todayStart).cnt;
  const todayUV = db.prepare('SELECT COUNT(DISTINCT session_token) AS cnt FROM page_views WHERE created_at >= ?').get(todayStart).cnt;
  const dau     = db.prepare('SELECT COUNT(DISTINCT user_id) AS cnt FROM page_views WHERE user_id IS NOT NULL AND created_at >= ?').get(todayStart).cnt;
  const mau     = db.prepare('SELECT COUNT(DISTINCT user_id) AS cnt FROM page_views WHERE user_id IS NOT NULL AND created_at >= ?').get(thirtyDaysAgo).cnt;

  res.json({ totalUsers, todaySessions, totalChars, modLogs7d, todayPV, todayUV, dau, mau });
});

// ══════════════════════════════════════════════════════════
//  GRAPH  GET /api/admin/stats/graph?period=day|week|month
// ══════════════════════════════════════════════════════════
router.get('/stats/graph', (req, res) => {
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day';
  const { fmt, days } = periodConfig(period);
  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  const q = (table, col = 'created_at') => db.prepare(`
    SELECT strftime('${fmt}', ${col}, 'unixepoch') AS period, COUNT(*) AS cnt
    FROM ${table}
    WHERE ${col} >= ${since}
    GROUP BY period ORDER BY period
  `).all();

  const qDistinct = (table, col, groupCol) => db.prepare(`
    SELECT strftime('${fmt}', ${col}, 'unixepoch') AS period, COUNT(DISTINCT ${groupCol}) AS cnt
    FROM ${table}
    WHERE ${col} >= ${since}
    GROUP BY period ORDER BY period
  `).all();

  const labels   = generateLabels(period);
  const users    = buildTimeSeries(q('users'), labels);
  const sessions = buildTimeSeries(q('sessions'), labels);
  const pv       = buildTimeSeries(q('page_views'), labels);
  const uv       = buildTimeSeries(qDistinct('page_views', 'created_at', 'session_token'), labels);
  const moderation = buildTimeSeries(q('moderation_logs'), labels);

  res.json({ labels, users, sessions, pv, uv, moderation });
});

// ══════════════════════════════════════════════════════════
//  EVAL
// ══════════════════════════════════════════════════════════
router.get('/eval', (req, res) => {
  const matrix  = stmt.getLatestEvalMatrix.all();
  const history = stmt.listEvalResults.all().map(r => ({ ...r, detail: JSON.parse(r.detail) }));
  res.json({ matrix, history });
});

router.post('/eval/run', async (req, res) => {
  const { characterId, model, testInput } = req.body;
  if (!characterId || !model || !testInput) {
    return res.status(400).json({ error: 'characterId, model, testInput 필수' });
  }
  console.log(`[eval] START char=${characterId} model=${model}`);

  // 캐릭터 config에서 추천 페르소나 로드
  const configPath = path.join(CHARS_DIR, characterId, 'config.json');
  let persona = { name: '유저', age: 25, appearance: '', personality: '', notes: '' };
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (cfg.recommendedPersona) persona = cfg.recommendedPersona;
    } catch (_) {}
  }

  // 실제 채팅과 동일한 full system prompt 빌드 (guardrails + model corrections + safety + persona)
  let systemPrompt = '';
  try {
    systemPrompt = buildSystemPrompt(characterId, persona, '', 'on', model);
  } catch (_) {
    // system.md가 없는 경우 fallback
    const sysPath = path.join(CHARS_DIR, characterId, 'system.md');
    if (fs.existsSync(sysPath)) systemPrompt = fs.readFileSync(sysPath, 'utf-8');
  }

  let aiResponse = '';
  try {
    const GEMINI = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview']);
    // thinking 모델(gemini-3.1-pro-preview 등)은 토큰을 더 넉넉히 줘야 함
    const THINKING_MODELS = new Set(['gemini-3.1-pro-preview']);
    if (GEMINI.has(model)) {
      const { callGemini } = require('../lib/gemini');
      const maxTokens = THINKING_MODELS.has(model) ? 8192 : 2048;
      aiResponse = await callGemini({ model, systemInstruction: systemPrompt, history: [{ role: 'user', content: testInput }], maxTokens });
    } else {
      const resp = await anthropic.messages.create({ model, max_tokens: 2048, system: systemPrompt, messages: [{ role: 'user', content: testInput }] });
      aiResponse = resp.content[0].text;
    }
  } catch (err) {
    console.error('[eval] 모델 응답 실패:', err.message, err.status, JSON.stringify(err.errorDetails ?? ''));
    return res.status(500).json({ error: `모델 응답 실패: ${err.message}` });
  }
  console.log(`[eval] AI response OK, length=${aiResponse.length}`);

  // 평가용: system.md 원본만 슬라이싱 (guardrails/모델보정 제외하고 캐릭터 본질만)
  let charSystemMd = systemPrompt;
  try {
    const sysPath = path.join(CHARS_DIR, characterId, 'system.md');
    if (fs.existsSync(sysPath)) charSystemMd = fs.readFileSync(sysPath, 'utf-8');
  } catch (_) {}

  // 페르소나 컨텍스트 (적용된 경우)
  const hasPersona = !!(persona.name && persona.name !== '유저');
  const personaLines = hasPersona
    ? [`이름: ${persona.name}`, persona.age ? `나이: ${persona.age}세` : '', persona.personality ? `성격: ${persona.personality}` : '', persona.notes ? `기타: ${persona.notes}` : ''].filter(Boolean)
    : [];

  const personaSection = hasPersona
    ? `\n## 평가 전제 조건 (반드시 숙지)\n이 평가는 아래 페르소나가 사전 설정된 세션에서 진행되었습니다.\n${personaLines.map(l => `- ${l}`).join('\n')}\n→ 캐릭터가 유저를 "${persona.name}"으로 부르는 것은 **정확한 호칭**입니다. 임의 생성이 아닙니다. 호칭 항목에서 이 이름을 문제 삼지 마세요.\n`
    : '';

  const ho칭Guide = hasPersona
    ? `- 호칭: 캐릭터가 유저를 부르는 방식의 자연스러움. 이 평가에서 유저 이름은 "${persona.name}"으로 사전 설정되어 있으므로, 캐릭터가 이 이름을 사용한다면 감점 없이 만점에 가깝게 평가하세요.`
    : `- 호칭: 캐릭터가 유저를 부르는 방식의 자연스러움. 유저 이름이 별도 설정되지 않았으므로, 캐릭터가 이름을 임의로 사용했다면 감점 요인입니다.`;

  const evalPrompt = `당신은 한국어 롤플레이 캐릭터 품질 평가 전문가입니다.
아래 캐릭터 프롬프트와 대화를 보고 9개 항목을 0~100점으로 평가하세요.
${personaSection}
## 캐릭터 프롬프트
${charSystemMd.slice(0, 3000)}

## 유저 입력
${testInput}

## AI 응답
${aiResponse}

## 평가 기준
- 시점: 1인칭/3인칭 시점의 일관성
- 한국어: 자연스러운 한국어 표현
- 문체: 캐릭터 고유 문체·어투의 일관성
${ho칭Guide}
- 감정: 감정 표현의 풍부함과 적절함
- 클리셰: 클리셰·진부한 표현 회피
- 유려함: 문장의 유려함과 가독성
- 묘사: 배경·상황·감각 묘사의 풍부함
- 존댓말: 존댓말/반말 사용의 캐릭터 설정 일치도

## 응답 형식 (JSON만, 다른 텍스트 없이)
{"시점":<num>,"한국어":<num>,"문체":<num>,"호칭":<num>,"감정":<num>,"클리셰":<num>,"유려함":<num>,"묘사":<num>,"존댓말":<num>,"판정_이유":"<2문장 이내 한국어>"}

판정_이유는 2문장 이내로 간결하게 작성하세요.`;

  let detail = {};
  try {
    console.log('[eval] Calling judge (Opus)...');
    const evalResp = await anthropic.messages.create({ model: 'claude-opus-4-6', max_tokens: 1024, messages: [{ role: 'user', content: evalPrompt }] });
    console.log('[eval] Judge stop_reason:', evalResp.stop_reason);
    const raw = evalResp.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    console.log('[eval] Raw judge output:', raw.slice(0, 300));
    try {
      detail = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[eval] JSON parse failed. raw:', raw);
      return res.status(500).json({ error: `평가 파싱 실패: ${parseErr.message}`, raw });
    }
  } catch (err) {
    console.error('[eval] Judge API 실패:', err.message);
    return res.status(500).json({ error: `평가 API 호출 실패: ${err.message}` });
  }

  const weights = { '시점':15,'한국어':15,'문체':15,'호칭':10,'감정':10,'클리셰':10,'유려함':10,'묘사':5,'존댓말':5 };
  let score = 0;
  for (const [k, w] of Object.entries(weights)) score += ((detail[k] ?? 0) * w) / 100;
  score = Math.round(score * 10) / 10;

  console.log(`[eval] DONE score=${score}`);
  stmt.insertEvalResult.run(characterId, model, score, JSON.stringify(detail));
  res.json({ score, detail, aiResponse });
});

// ══════════════════════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════════════════════
router.get('/users', (req, res) => {
  res.json(stmt.listAllUsers.all());
});

router.get('/users/:publicId', (req, res) => {
  const user = stmt.getUserByPublicId.get(req.params.publicId);
  if (!user) return res.status(404).json({ error: '유저 없음' });

  const sessions = stmt.listSessionsByUser.all(user.id);
  const personas = stmt.getPersonasByUser.all(user.id);

  res.json({ user, sessions, personas });
});

router.patch('/users/:publicId/role', (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'role은 user 또는 admin' });
  stmt.updateUserRole.run(role, req.params.publicId);
  res.json({ ok: true });
});

router.delete('/users/:publicId', (req, res) => {
  const user = stmt.getUserByPublicId.get(req.params.publicId);
  if (!user) return res.status(404).json({ error: '유저 없음' });
  if (user.id === req.session.userId) return res.status(400).json({ error: '자기 자신은 삭제 불가' });
  stmt.deleteUserSessions.run(user.id);
  stmt.adminDeleteUser.run(req.params.publicId);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
//  CHARACTERS
// ══════════════════════════════════════════════════════════
router.get('/characters', (req, res) => {
  const chars = loadAllCharacters();
  const counts = db.prepare('SELECT character_id, COUNT(*) AS cnt FROM sessions GROUP BY character_id').all();
  const countMap = Object.fromEntries(counts.map(r => [r.character_id, r.cnt]));
  res.json(chars.map(c => ({ ...c, sessionCount: countMap[c.id] || 0 })));
});

router.get('/characters/:id', (req, res) => {
  const id = req.params.id;
  const configPath = path.join(CHARS_DIR, id, 'config.json');
  const sysPath    = path.join(CHARS_DIR, id, 'system.md');
  if (!fs.existsSync(configPath)) return res.status(404).json({ error: '없음' });

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const system = fs.existsSync(sysPath) ? fs.readFileSync(sysPath, 'utf-8') : '';
  const sessionCount = db.prepare('SELECT COUNT(*) AS cnt FROM sessions WHERE character_id = ?').get(id)?.cnt || 0;
  res.json({ config, system, sessionCount });
});

// PATCH /api/admin/characters/:id — config.json 또는 system.md 수정
// Body: { config?: object|string, system?: string }
router.patch('/characters/:id', (req, res) => {
  const id         = req.params.id;
  const configPath = path.join(CHARS_DIR, id, 'config.json');
  const sysPath    = path.join(CHARS_DIR, id, 'system.md');
  const { config, system } = req.body;

  if (config !== undefined) {
    if (!fs.existsSync(configPath)) return res.status(404).json({ error: '없음' });
    try {
      const parsed = typeof config === 'string' ? JSON.parse(config) : config;
      parsed.id = id; // ID는 항상 원본 유지
      fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch (err) {
      return res.status(400).json({ error: 'JSON 파싱 오류: ' + err.message });
    }
  }

  if (system !== undefined) {
    fs.writeFileSync(sysPath, system, 'utf-8');
  }

  res.json({ ok: true });
});

router.patch('/characters/:id/status', (req, res) => {
  const configPath = path.join(CHARS_DIR, req.params.id, 'config.json');
  if (!fs.existsSync(configPath)) return res.status(404).json({ error: '없음' });
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.status = req.body.status === 'inactive' ? 'inactive' : 'active';
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  res.json({ ok: true, status: config.status });
});

router.delete('/characters/:id', (req, res) => {
  const charDir = path.join(CHARS_DIR, req.params.id);
  if (!fs.existsSync(charDir)) return res.status(404).json({ error: '없음' });
  fs.rmSync(charDir, { recursive: true, force: true });
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
//  MODERATION
// ══════════════════════════════════════════════════════════
router.get('/moderation', (req, res) => {
  const { from, to, characterId, triggerStep } = req.query;
  let sql = `
    SELECT ml.*, u.nickname AS user_nickname
    FROM moderation_logs ml
    LEFT JOIN users u ON u.id = ml.user_id
    WHERE 1=1
  `;
  const params = [];
  if (from)        { sql += ' AND ml.created_at >= ?'; params.push(Math.floor(new Date(from).getTime() / 1000)); }
  if (to)          { sql += ' AND ml.created_at <= ?'; params.push(Math.floor(new Date(to).getTime() / 1000) + 86400); }
  if (characterId) { sql += ' AND ml.character_id = ?'; params.push(characterId); }
  if (triggerStep) { sql += ' AND ml.trigger_step = ?'; params.push(parseInt(triggerStep, 10)); }
  sql += ' ORDER BY ml.created_at DESC LIMIT 500';
  try {
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/moderation/:publicId — detail with full context
// ── Notifications (Admin) ────────────────────────────────
router.get('/notifications', (req, res) => {
  const items = stmt.adminListNotifications.all();
  res.json(items);
});

router.post('/notifications', (req, res) => {
  const { category, title, body, user_id } = req.body;
  if (!category || !title) return res.status(400).json({ error: 'category, title 필수' });
  const validCategories = ['social', 'system', 'notice'];
  if (!validCategories.includes(category)) return res.status(400).json({ error: '올바른 category: social, system, notice' });
  const result = stmt.createNotification.run(
    user_id || null,
    category,
    title,
    body || null,
    null
  );
  res.json({ ok: true, id: result.lastInsertRowid });
});

router.delete('/notifications/:id', (req, res) => {
  stmt.adminDeleteNotification.run(Number(req.params.id));
  res.json({ ok: true });
});

router.get('/moderation/:publicId', (req, res) => {
  const log = stmt.getModerationLogByPublicId.get(req.params.publicId);
  if (!log) return res.status(404).json({ error: '없음' });

  const session  = log.session_id ? stmt.getSession.get(log.session_id) : null;
  const messages = log.session_id
    ? db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(log.session_id)
    : [];
  const user = log.user_id ? stmt.getUserById.get(log.user_id) : null;

  res.json({ log, session, messages, user });
});

// ── Curation ──────────────────────────────────────────────
router.get('/curation', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(CURATION_FILE, 'utf-8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: '큐레이션 파일 읽기 실패' });
  }
});

router.put('/curation', (req, res) => {
  try {
    const data = req.body;
    fs.writeFileSync(CURATION_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '큐레이션 파일 저장 실패' });
  }
});

module.exports = router;
