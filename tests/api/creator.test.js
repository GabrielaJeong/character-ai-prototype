const request = require('supertest');
const app = require('../../server');

const TS = Date.now().toString(36).slice(-4);
const TEST_USER = {
  email:    `test_cr_${TS}@test.com`,
  password: 'testpass123',
  nickname: '크리에이터테스트',
  username: `test_cr_${TS}`,
};

// ── GET /api/creator/:username ────────────────────────────

describe('GET /api/creator/:username', () => {
  let agent;
  let registeredUsername;

  beforeAll(async () => {
    agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(TEST_USER);
    expect(res.status).toBe(200);
    registeredUsername = res.body.user.username;
  });

  afterAll(async () => {
    await agent.delete('/api/auth/me');
  });

  it('존재하는 크리에이터는 200과 user + characters 반환', async () => {
    const res = await request(app).get(`/api/creator/${registeredUsername}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('characters');
    expect(Array.isArray(res.body.characters)).toBe(true);
  });

  it('user 필드에 필수 키 포함', async () => {
    const res = await request(app).get(`/api/creator/${registeredUsername}`);
    const { user } = res.body;
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('nickname');
    expect(user).toHaveProperty('avatar');
    expect(user).toHaveProperty('public_id');
    expect(user).toHaveProperty('created_at');
  });

  it('각 character 항목에 필수 필드 존재 (L-001 재발 방지)', async () => {
    const res = await request(app).get(`/api/creator/${registeredUsername}`);
    res.body.characters.forEach(char => {
      expect(char).toHaveProperty('id');
      expect(char).toHaveProperty('name');
      expect(char).toHaveProperty('stats');
      expect(char.stats).toHaveProperty('sessions');
      expect(char.stats).toHaveProperty('bookmarks');
    });
  });

  it('@prefix 붙은 username도 정상 처리', async () => {
    const res = await request(app).get(`/api/creator/@${registeredUsername}`);
    expect(res.status).toBe(200);
  });

  it('isOwner: 본인 요청 시 true', async () => {
    const res = await agent.get(`/api/creator/${registeredUsername}`);
    expect(res.body.isOwner).toBe(true);
  });

  it('isOwner: 비로그인 요청 시 false', async () => {
    const res = await request(app).get(`/api/creator/${registeredUsername}`);
    expect(res.body.isOwner).toBe(false);
  });

  it('존재하지 않는 username은 404', async () => {
    const res = await request(app).get('/api/creator/no_such_user_xyz_99999');
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/creator/:charId/pin ────────────────────────

describe('PATCH /api/creator/:charId/pin', () => {
  it('비로그인 시 401', async () => {
    const res = await request(app)
      .patch('/api/creator/char_fake123/pin');
    expect(res.status).toBe(401);
  });

  describe('로그인 후', () => {
    let agent;

    beforeAll(async () => {
      agent = request.agent(app);
      await agent.post('/api/auth/register').send({
        email:    `test_pn_${TS}@test.com`,
        password: 'testpass123',
        nickname: '핀테스트',
        username: `test_pn_${TS}`,
      });
    });

    afterAll(async () => {
      await agent.delete('/api/auth/me');
    });

    it('char_ prefix 없는 ID는 400', async () => {
      const res = await agent.patch('/api/creator/notachar/pin');
      expect(res.status).toBe(400);
    });

    it('존재하지 않는 char_ ID는 404', async () => {
      const res = await agent.patch('/api/creator/char_nonexistent999/pin');
      expect(res.status).toBe(404);
    });
  });
});
