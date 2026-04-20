const request = require('supertest');
const app = require('../../server');

// 고유한 테스트 유저 (병렬 실행 충돌 방지용 타임스탬프)
// Date.now() base36 slice → 4자, 총 username ≤ 20자 보장
const TS = Date.now().toString(36).slice(-4);
const TEST_USER = {
  email:    `test_sess_${TS}@test.com`,
  password: 'testpass123',
  nickname: '세션테스트',
  username: `test_sess_${TS}`,
};

// ── GET /api/sessions (list) ──────────────────────────────

describe('GET /api/sessions', () => {
  it('비로그인 시 200과 배열 반환', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('각 세션에 필수 필드 존재 (L-001 재발 방지)', async () => {
    const res = await request(app).get('/api/sessions');
    // 게스트 세션이 있을 때만 필드 검증
    res.body.forEach(session => {
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('character_id');
      expect(session).toHaveProperty('safety');
      expect(session).toHaveProperty('persona');
      expect(session).toHaveProperty('message_count');
      expect(session).toHaveProperty('last_message');
      expect(session).toHaveProperty('created_at');
    });
  });

  describe('로그인 후', () => {
    let agent;

    beforeAll(async () => {
      agent = request.agent(app);
      const res = await agent.post('/api/auth/register').send(TEST_USER);
      expect(res.status).toBe(200);
    });

    afterAll(async () => {
      await agent.delete('/api/auth/me');
    });

    it('로그인 유저 세션 목록 200 반환', async () => {
      const res = await agent.get('/api/sessions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('신규 유저는 빈 세션 목록', async () => {
      const res = await agent.get('/api/sessions');
      expect(res.body).toHaveLength(0);
    });
  });
});

// ── GET /api/sessions/:id (detail) ───────────────────────

describe('GET /api/sessions/:id', () => {
  it('존재하지 않는 세션 ID는 404', async () => {
    const res = await request(app).get('/api/sessions/nonexistent-id-xyz');
    expect(res.status).toBe(404);
  });

  it('list와 detail 필드 동기화 확인 (L-001 재발 방지)', async () => {
    // 게스트 세션 목록에서 ID를 가져와 detail 필드를 비교
    const listRes = await request(app).get('/api/sessions');
    if (listRes.body.length === 0) return; // 세션 없으면 skip

    const sessionId = listRes.body[0].id;
    const detailRes = await request(app).get(`/api/sessions/${sessionId}`);

    expect(detailRes.status).toBe(200);
    // list와 공통 필드
    expect(detailRes.body).toHaveProperty('id');
    expect(detailRes.body).toHaveProperty('character_id');
    expect(detailRes.body).toHaveProperty('safety');     // 수정으로 추가됨
    expect(detailRes.body).toHaveProperty('model');      // 수정으로 추가됨
    expect(detailRes.body).toHaveProperty('persona');
    expect(detailRes.body).toHaveProperty('message_count'); // 수정으로 추가됨
    expect(detailRes.body).toHaveProperty('messages');
    expect(detailRes.body).toHaveProperty('created_at');
    expect(Array.isArray(detailRes.body.messages)).toBe(true);
  });
});

// ── PUT /api/sessions/:id/safety ─────────────────────────

describe('PUT /api/sessions/:id/safety', () => {
  it('safety 값이 on/off 외의 값이면 400', async () => {
    const res = await request(app)
      .put('/api/sessions/any-id/safety')
      .send({ safety: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('존재하지 않는 세션 ID는 404', async () => {
    const res = await request(app)
      .put('/api/sessions/nonexistent-id/safety')
      .send({ safety: 'on' });
    expect(res.status).toBe(404);
  });
});
