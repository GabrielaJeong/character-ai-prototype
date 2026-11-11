/**
 * 런타임 데이터 레이어링 + 테스트 격리에 대한 테스트.
 *
 * 2026-11-10 에 테스트가 git 추적 파일 `public/images/user_2.jpg` 를 실제로 지웠다.
 * DB 를 격리하자(PR #7) 유저 id 가 1부터 다시 깔려서, 탈퇴 경로의
 * `deleteUserFiles()` 가 테스트 유저 2 번의 아바타로 실제 user_2 의 아바타를
 * 지목한 것이다. 격리가 깨지면 **조용히** repo 데이터가 사라지므로 배선을 못박는다.
 *
 * 동시에 레이어링 규칙 자체를 검증한다: 읽기는 런타임 → repo 폴백, 쓰기는 항상 런타임.
 * 이게 깨지면 repo 수정이 프로덕션에 전파되지 않거나(복사 시드의 결함),
 * 거꾸로 런타임 쓰기가 repo 를 오염시킨다.
 */
const fs = require('fs');
const path = require('path');
const paths = require('../../lib/paths');

const REPO = path.resolve(__dirname, '..', '..');
const inRepo = (p) => path.resolve(p).startsWith(REPO + path.sep);

const PREBUILT = 'ihwa'; // repo 에 있는 프리빌트 캐릭터

// 런타임 디렉터리는 **워커 단위**로 공유된다 (DB 와 같다). 같은 워커에서 뒤에 도는
// 테스트 파일이 여기서 만든 찌꺼기를 보면 안 된다 — 필수 필드 없는 더미 config 를
// 남기자 `GET /api/characters` 검증이 깨졌다. 매 테스트 후 흔적을 되돌린다.
const SCRATCH_IDS = [PREBUILT, 'char_layertest', 'char_ownedby4242'];

afterEach(() => {
  for (const id of SCRATCH_IDS) {
    fs.rmSync(path.join(paths.CHARS_DIR, id), { recursive: true, force: true });
  }
  fs.rmSync(paths.imageWritePath('user_4242.jpg'), { force: true });
});

describe('테스트 격리', () => {
  it('DB 는 repo 밖의 워커 전용 파일을 쓴다', () => {
    expect(process.env.DB_PATH).toBeTruthy();
    expect(inRepo(process.env.DB_PATH)).toBe(false);
    expect(process.env.DB_PATH).toContain(`w${process.env.JEST_WORKER_ID || '1'}`);
  });

  it('런타임 쓰기 경로가 전부 repo 밖을 가리킨다', () => {
    const { CHARS_DIR, MODELS_DIR, IMAGES_DIR, UPLOADS_DIR, DATA_JSON_DIR } = paths;
    for (const dir of [CHARS_DIR, MODELS_DIR, IMAGES_DIR, UPLOADS_DIR, DATA_JSON_DIR]) {
      expect(inRepo(dir)).toBe(false);
    }
  });
});

describe('레이어링 — 읽기는 런타임 → repo 폴백', () => {
  it('런타임에 없는 프리빌트는 repo 에서 읽힌다 (시드 없이)', () => {
    const p = paths.charReadFile(PREBUILT, 'system.md');
    expect(p).toBeTruthy();
    expect(inRepo(p)).toBe(true); // repo 쪽에서 해결됐다 = 복사가 일어나지 않았다
    expect(paths.readCharConfig(PREBUILT)).toMatchObject({ id: PREBUILT });
  });

  it('목록은 프리빌트 ∪ 런타임 제작', () => {
    expect(paths.listCharacterIds()).toContain(PREBUILT);

    fs.writeFileSync(
      paths.charWriteFile('char_layertest', 'config.json'),
      '{"id":"char_layertest"}'
    );
    expect(paths.listCharacterIds()).toEqual(expect.arrayContaining([PREBUILT, 'char_layertest']));
  });

  it('모델 프롬프트·data JSON 도 repo 로 폴백한다', () => {
    const model = paths.modelPromptRead('gemini-3.8-flash');
    if (model) expect(inRepo(model)).toBe(true);
    expect(paths.readDataJson(paths.CURATION_JSON)).toHaveProperty('broadcast');
  });

  it('런타임 오버라이드가 repo 보다 우선한다', () => {
    const before = paths.charReadFile(PREBUILT, 'config.json');
    expect(inRepo(before)).toBe(true);

    fs.writeFileSync(paths.charWriteFile(PREBUILT, 'config.json'), '{"id":"ihwa","name":"덮어씀"}');
    const after = paths.charReadFile(PREBUILT, 'config.json');
    expect(inRepo(after)).toBe(false);
    expect(paths.readCharConfig(PREBUILT).name).toBe('덮어씀');

    // 손대지 않은 파일은 계속 repo 에서 읽힌다 — 부분 오버라이드가 핵심이다.
    expect(inRepo(paths.charReadFile(PREBUILT, 'system.md'))).toBe(true);

    fs.rmSync(path.join(paths.CHARS_DIR, PREBUILT), { recursive: true, force: true });
  });
});

describe('쓰기·삭제는 repo 를 건드리지 않는다', () => {
  it('프리빌트 삭제는 repo 를 지우지 않고 삭제 표식을 세운다', () => {
    const repoCharDir = path.join(paths.REPO_CHARS, PREBUILT);

    paths.deleteCharacter(PREBUILT);

    expect(fs.existsSync(repoCharDir)).toBe(true); // repo 원본 보존
    expect(paths.isTombstoned(PREBUILT)).toBe(true);
    expect(paths.charReadFile(PREBUILT, 'config.json')).toBeNull();
    expect(paths.listCharacterIds()).not.toContain(PREBUILT);

    // 표식을 걷으면 되살아난다 (복구 가능해야 한다)
    fs.rmSync(path.join(paths.CHARS_DIR, PREBUILT), { recursive: true, force: true });
    expect(paths.listCharacterIds()).toContain(PREBUILT);
  });

  it('deleteUserFiles 는 런타임만 지우고 repo public/images 는 무변경', () => {
    const repoImages = path.join(REPO, 'public', 'images');
    const before = fs.readdirSync(repoImages).sort();

    const avatar = paths.imageWritePath('user_4242.jpg');
    fs.writeFileSync(avatar, 'sentinel');
    fs.writeFileSync(
      paths.charWriteFile('char_ownedby4242', 'config.json'),
      JSON.stringify({ owner_user_id: 4242 })
    );

    paths.deleteUserFiles(4242);

    expect(fs.existsSync(avatar)).toBe(false);
    expect(fs.existsSync(path.join(paths.CHARS_DIR, 'char_ownedby4242'))).toBe(false);
    expect(fs.existsSync(path.join(paths.REPO_CHARS, PREBUILT))).toBe(true);
    expect(fs.readdirSync(repoImages).sort()).toEqual(before);
  });
});
