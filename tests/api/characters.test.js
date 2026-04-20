const request = require('supertest');
const app = require('../../server');

describe('GET /api/characters', () => {
  let response;

  beforeAll(async () => {
    response = await request(app).get('/api/characters');
  });

  it('상태 코드 200 반환', () => {
    expect(response.status).toBe(200);
  });

  it('배열 응답', () => {
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('각 캐릭터에 필수 필드 존재 (L-001 재발 방지)', () => {
    response.body.forEach(char => {
      expect(char).toHaveProperty('id');
      expect(char).toHaveProperty('name');
      expect(char).toHaveProperty('nameEn');
      expect(char).toHaveProperty('rating');
      expect(char).toHaveProperty('tags');
      expect(char).toHaveProperty('badge');
      expect(char).toHaveProperty('stats');
      expect(char.stats).toHaveProperty('sessions');
      expect(char.stats).toHaveProperty('bookmarks');
    });
  });

  it('rating은 all / toggleable / adult_only 중 하나', () => {
    const validRatings = ['all', 'toggleable', 'adult_only'];
    response.body.forEach(char => {
      expect(validRatings).toContain(char.rating);
    });
  });

  it('유저 제작 캐릭터에만 owner_username 존재', () => {
    response.body.forEach(char => {
      if (char.owner_username) {
        expect(typeof char.owner_username).toBe('string');
      }
    });
  });
});

describe('GET /api/characters/:id', () => {
  it('존재하는 캐릭터 조회 시 상세 정보 반환', async () => {
    const res = await request(app).get('/api/characters/ihwa');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('about');
    expect(res.body).toHaveProperty('notes');
    expect(res.body.about).toHaveProperty('traits');
    expect(res.body.about).toHaveProperty('opening_line');
  });

  it('존재하지 않는 캐릭터는 404', async () => {
    const res = await request(app).get('/api/characters/nonexistent');
    expect(res.status).toBe(404);
  });
});
