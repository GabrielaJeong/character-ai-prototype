/**
 * 테스트 격리 자체에 대한 테스트.
 *
 * 2026-11-10 에 테스트가 git 추적 파일 `public/images/user_2.jpg` 를 실제로 지웠다.
 * DB 를 격리하자(PR #7) 유저 id 가 1부터 다시 깔려서, 탈퇴 경로의
 * `deleteUserFiles()` 가 테스트 유저 2 번의 아바타로 실제 user_2 의 아바타를
 * 지목한 것이다. 격리가 깨지면 조용히 repo 데이터가 사라지므로,
 * 배선이 살아 있는지를 테스트로 못박는다.
 */
const fs = require('fs');
const path = require('path');
const { CHARS_DIR, MODELS_DIR, IMAGES_DIR, UPLOADS_DIR, DATA_JSON_DIR, deleteUserFiles } =
  require('../../lib/paths');

const REPO = path.resolve(__dirname, '..', '..');
const inRepo = (p) => path.resolve(p).startsWith(REPO + path.sep);

describe('테스트 격리', () => {
  it('DB 는 repo 밖의 워커 전용 파일을 쓴다', () => {
    expect(process.env.DB_PATH).toBeTruthy();
    expect(inRepo(process.env.DB_PATH)).toBe(false);
    expect(process.env.DB_PATH).toContain(`w${process.env.JEST_WORKER_ID || '1'}`);
  });

  it('런타임-mutable 경로가 전부 repo 밖을 가리킨다', () => {
    for (const dir of [CHARS_DIR, MODELS_DIR, IMAGES_DIR, UPLOADS_DIR, DATA_JSON_DIR]) {
      expect(inRepo(dir)).toBe(false);
    }
  });

  it('프리빌트 캐릭터·모델 프롬프트는 격리 경로로 시드된다', () => {
    expect(fs.readdirSync(CHARS_DIR)).toContain('ihwa');
    expect(fs.readdirSync(MODELS_DIR).length).toBeGreaterThan(0);
  });

  it('이미지는 시드하지 않는다 — express 가 public/ 으로 폴백한다', () => {
    const seeded = fs.readdirSync(IMAGES_DIR).filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
    const prebuilt = fs.readdirSync(path.join(REPO, 'public', 'images'));
    expect(seeded).not.toEqual(expect.arrayContaining(prebuilt));
  });

  it('deleteUserFiles 는 격리 경로만 지우고 repo 는 건드리지 않는다', () => {
    const repoImages = path.join(REPO, 'public', 'images');
    const before = fs.readdirSync(repoImages).sort();

    const avatar = path.join(IMAGES_DIR, 'user_4242.jpg');
    const charDir = path.join(CHARS_DIR, 'char_isolationtest');
    fs.mkdirSync(charDir, { recursive: true });
    fs.writeFileSync(avatar, 'sentinel');
    fs.writeFileSync(path.join(charDir, 'config.json'), JSON.stringify({ owner_user_id: 4242 }));

    deleteUserFiles(4242);

    expect(fs.existsSync(avatar)).toBe(false);
    expect(fs.existsSync(charDir)).toBe(false);
    expect(fs.existsSync(path.join(CHARS_DIR, 'ihwa'))).toBe(true); // 프리빌트 보존
    expect(fs.readdirSync(repoImages).sort()).toEqual(before);
  });
});
