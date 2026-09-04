const request = require('supertest');
const app = require('../../server');

describe('GET /api/auth/check-username', () => {
  it('사용 가능한 아이디는 available 필드 반환', async () => {
    const res = await request(app)
      .get('/api/auth/check-username?username=testuser_unique_12345');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('available');
  });

  it('3자 미만 아이디는 available: false', async () => {
    const res = await request(app)
      .get('/api/auth/check-username?username=ab');
    expect(res.body.available).toBe(false);
  });

  it('특수문자 포함 아이디는 available: false', async () => {
    const res = await request(app)
      .get('/api/auth/check-username?username=user@name');
    expect(res.body.available).toBe(false);
  });

  it('username 파라미터 없으면 400', async () => {
    const res = await request(app).get('/api/auth/check-username');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/register', () => {
  it('필수 필드 누락 시 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  it('이메일 형식 오류 시 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password1', nickname: '테스트', username: 'testuser' });
    expect(res.status).toBe(400);
  });

  it('8자 미만 비밀번호는 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'abc', nickname: '테스트', username: 'testuser' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('미로그인 상태에서 user: null 반환', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe('POST /api/auth/demo-login', () => {
  const original = process.env.DEMO_MODE;
  afterAll(() => {
    if (original === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = original;
  });

  it('DEMO_MODE 미설정이면 404', async () => {
    delete process.env.DEMO_MODE;
    const res = await request(app).post('/api/auth/demo-login');
    expect(res.status).toBe(404);
  });

  it('로그인 응답 shape이 GET /me 와 일치한다', async () => {
    // 세 엔드포인트(login/demo-login/me)가 프론트의 같은 store 슬롯을 채운다.
    // 과거 demo-login 만 부분집합을 돌려주면서 id 자리에 public_id(UUID)를 넣어,
    // 체험 로그인 직후에만 default_persona_id·public_id 가 undefined 였다.
    process.env.DEMO_MODE = 'true';
    const agent = request.agent(app);

    const login = await agent.post('/api/auth/demo-login');
    expect(login.status).toBe(200);
    expect(login.body.user.isDemo).toBe(true);
    expect(typeof login.body.user.id).toBe('number');
    expect(login.body.user).toHaveProperty('public_id');
    expect(login.body.user).toHaveProperty('default_persona_id');
    // getUserByEmail row 를 그대로 뿌리면 bcrypt 해시가 새어나간다
    expect(login.body.user).not.toHaveProperty('password_hash');

    const me = await agent.get('/api/auth/me');
    expect(me.body.user.id).toBe(login.body.user.id);
    expect(Object.keys(me.body.user).sort()).toEqual(Object.keys(login.body.user).sort());
  });
});
