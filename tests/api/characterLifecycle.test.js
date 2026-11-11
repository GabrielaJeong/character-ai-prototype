/**
 * 캐릭터 생성 → 목록 → 조회 → 삭제를 **라우트 레벨**에서 검증한다.
 *
 * 런타임 데이터 레이어링(읽기: 런타임 → repo 폴백 / 쓰기: 항상 런타임)으로
 * 바꾸면서 가장 위험해진 경로다. 여기가 깨지면 유저가 만든 캐릭터가 목록에
 * 안 나오거나, 거꾸로 repo 의 프리빌트를 지우는 사고가 난다.
 */
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../server');
const paths = require('../../lib/paths');

const PREBUILT = 'ihwa';
const pw = 'testpass123';

/** 로그인된 agent 를 만든다 (세션 쿠키 유지). */
async function loggedInAgent(tag) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({
    email: `lifecycle_${tag}@test.local`,
    password: pw,
    nickname: `테스트${tag}`,
    username: `lifecycle_${tag}`,
  });
  if (res.status !== 200 && res.status !== 201) {
    await agent
      .post('/api/auth/login')
      .send({ identifier: `lifecycle_${tag}@test.local`, password: pw });
  }
  return agent;
}

const characterPayload = (name) => ({
  characterData: {
    name,
    age: 27,
    occupation: '바리스타',
    background: '조용한 동네 카페를 혼자 지킨다.',
    tags: ['차분함'],
    rating: 'all_ages',
  },
  systemPrompt: `당신은 ${name}입니다.`,
});

describe('캐릭터 생성·삭제 (레이어링)', () => {
  it('비로그인 생성은 401', async () => {
    const res = await request(app).post('/api/characters/create').send(characterPayload('무명'));
    expect(res.status).toBe(401);
  });

  it('생성한 캐릭터는 런타임에만 쓰이고 목록·조회에 나타난다', async () => {
    const agent = await loggedInAgent('create');

    const created = await agent
      .post('/api/characters/create')
      .send(characterPayload('테스트바리스타'));
    expect(created.status).toBe(200);
    const id = created.body.id;
    expect(id).toMatch(/^char_/);

    // 쓰기는 런타임 레이어에만
    expect(fs.existsSync(path.join(paths.CHARS_DIR, id, 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(paths.REPO_CHARS, id))).toBe(false);

    // 목록에 신규 + 프리빌트가 함께 보인다
    const list = await agent.get('/api/characters');
    const ids = list.body.map((c) => c.id);
    expect(ids).toContain(id);
    expect(ids).toContain(PREBUILT);

    // 단건 조회
    const one = await agent.get(`/api/characters/${id}`);
    expect(one.status).toBe(200);
    expect(one.body.name).toBe('테스트바리스타');

    // 소유자는 삭제 가능 — repo 는 건드리지 않는다
    const del = await agent.delete(`/api/characters/${id}`);
    expect(del.status).toBe(200);
    expect(fs.existsSync(path.join(paths.CHARS_DIR, id))).toBe(false);

    const after = await agent.get('/api/characters');
    expect(after.body.map((c) => c.id)).not.toContain(id);
    expect(after.body.map((c) => c.id)).toContain(PREBUILT); // 프리빌트 생존
  });

  it('프리빌트는 일반 유저가 삭제할 수 없다 (403) — repo 보존', async () => {
    const agent = await loggedInAgent('nodelete');

    const res = await agent.delete(`/api/characters/${PREBUILT}`);
    expect(res.status).toBe(403);
    expect(fs.existsSync(path.join(paths.REPO_CHARS, PREBUILT))).toBe(true);

    const list = await request(app).get('/api/characters');
    expect(list.body.map((c) => c.id)).toContain(PREBUILT);
  });

  it('프리빌트 단건 조회는 repo 폴백으로 동작한다', async () => {
    const res = await request(app).get(`/api/characters/${PREBUILT}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(PREBUILT);
    // 런타임에 사본이 생기지 않았다 = 복사 시드가 없다
    expect(fs.existsSync(path.join(paths.CHARS_DIR, PREBUILT))).toBe(false);
  });
});
