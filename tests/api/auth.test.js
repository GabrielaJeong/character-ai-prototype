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
