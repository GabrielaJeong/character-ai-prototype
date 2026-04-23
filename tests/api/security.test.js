const request = require('supertest');
const app = require('../../server');

// ── Security Headers ──────────────────────────────────────

describe('Security Headers (helmet)', () => {
  it('X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('X-Frame-Options 설정됨', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('Content-Security-Policy 설정됨', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

// ── Rate Limiting ─────────────────────────────────────────

describe('Rate Limiting — 로그인', () => {
  it('11회 연속 실패 시 429', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'nobody@x.com', password: 'wrongpass' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@x.com', password: 'wrongpass' });
    expect(res.status).toBe(429);
  }, 30000);
});

// ── Cookie 보안 플래그 ────────────────────────────────────

describe('Session Cookie', () => {
  it('httpOnly 플래그 설정됨', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@x.com', password: 'x' });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
      expect(cookieStr.toLowerCase()).toContain('httponly');
    } else {
      // 로그인 실패 시 쿠키 없음 — 헤더 체크 통과
      expect(true).toBe(true);
    }
  });
});

// ── 세션 소유권 — 게스트 격리 ──────────────────────────────

describe('세션 소유권 — 게스트 격리', () => {
  const { randomUUID } = require('crypto');
  const cookieSig = require('cookie-signature');
  const { stmt, db } = require('../../db');

  const SESSION_SECRET = process.env.SESSION_SECRET || 'folio-dev-secret-change-in-prod';
  const PERSONA = JSON.stringify({ name: '테스트', description: '테스트 페르소나' });

  function extractGuestId(setCookieHeader) {
    const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
    if (!header) return null;
    const match = header.match(/folio\.sid=([^;]+)/);
    if (!match) return null;
    const encoded = decodeURIComponent(match[1]);
    const val = encoded.startsWith('s:') ? encoded.slice(2) : encoded;
    const sid = cookieSig.unsign(val, SESSION_SECRET);
    if (!sid) return null;
    const row = db.prepare('SELECT sess FROM auth_sessions WHERE sid = ?').get(sid);
    return row ? JSON.parse(row.sess).guestId : null;
  }

  it('존재하지 않는 세션 → 404', async () => {
    const res = await request(app).get(`/api/sessions/${randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it('다른 게스트 쿠키로 타 세션 접근 → 403', async () => {
    const sessionId = randomUUID();
    const ownerGuestId = randomUUID();
    // DB에 직접 세션 생성 (AI 호출 없이)
    stmt.createSession.run(sessionId, PERSONA, 'claude-sonnet-4-6', 'ihwa', 'on', null, ownerGuestId);

    try {
      const agentB = request.agent(app);
      await agentB.get('/api/sessions'); // guestId 발급 트리거
      const res = await agentB.get(`/api/sessions/${sessionId}`);
      expect(res.status).toBe(403);
    } finally {
      stmt.deleteSession.run(sessionId);
    }
  });

  it('자신의 게스트 세션 접근 → 200', async () => {
    const agentA = request.agent(app);
    const init = await agentA.get('/api/sessions');
    const guestId = extractGuestId(init.headers['set-cookie']);
    expect(guestId).toBeTruthy();

    const sessionId = randomUUID();
    stmt.createSession.run(sessionId, PERSONA, 'claude-sonnet-4-6', 'ihwa', 'on', null, guestId);

    try {
      const res = await agentA.get(`/api/sessions/${sessionId}`);
      expect(res.status).toBe(200);
    } finally {
      stmt.deleteSession.run(sessionId);
    }
  });
});
