// 런타임-mutable 파일 경로의 단일 소스 (R5-1 파일 영속성).
//
// 문제: 유저 아바타·제작 캐릭터·큐레이션 업로드·admin이 편집하는 config/model 프롬프트·
//   curation.json 등은 런타임에 파일로 쓰이는데, Railway는 재배포 시 컨테이너 디스크가
//   초기화되어 이들이 유실됨.
//
// ── 2층 구조 ─────────────────────────────────────────────────────────────
//   REPO    프리빌트. 코드와 함께 배포된다. **런타임에 절대 쓰지 않는다.**
//   RUNTIME 유저·admin이 만들거나 고친 것. 쓰기는 항상 여기, 읽기는 여기 우선.
//
//   읽기: RUNTIME → 없으면 REPO 폴백
//   쓰기: 항상 RUNTIME
//
// 예전 방식(부팅 시드: repo를 Volume으로 복사)은 폐기했다. 복사하는 순간 Volume
// 사본이 정답이 되고, seed-if-missing이라 그 뒤 repo 수정이 **영원히 전파되지
// 않는다**. 프리빌트 캐릭터·모델 프롬프트·큐레이션을 코드로 고칠 수 없게 되는 것이라
// 배포 파이프라인이 망가진다. 레이어링은 그 문제가 구조적으로 없고, Volume에
// **유저 데이터만** 남아 백업·보존 대상이 명확해진다.
// (express.static이 /images에 대해 이미 이 방식을 쓴다 — server.js 참고.)

const path = require('path');
const fs   = require('fs');

const ROOT = path.join(__dirname, '..');

// 쓰기 루트. 프로덕션은 Railway Volume(예 /data), 로컬은 repo 안의 gitignore된 폴더.
// 로컬 기본값을 repo 원본 디렉터리로 두지 않는 게 중요하다 — 그래서 유저 업로드가
// public/images/ 에 섞여 git에 추적되는 사고(user_2.jpg)가 구조적으로 안 생긴다.
const RUNTIME_ROOT = process.env.RUNTIME_DATA_DIR || path.join(ROOT, '.runtime');

// repo 원본(프리빌트 = 읽기 전용 폴백)
const REPO_CHARS  = path.join(ROOT, 'prompts', 'characters');
const REPO_MODELS = path.join(ROOT, 'prompts', 'models');
const REPO_IMAGES = path.join(ROOT, 'public', 'images');
const REPO_DATA   = path.join(ROOT, 'data');

// 런타임(쓰기) 경로
const CHARS_DIR     = path.join(RUNTIME_ROOT, 'characters');
const MODELS_DIR    = path.join(RUNTIME_ROOT, 'models');
const IMAGES_DIR    = path.join(RUNTIME_ROOT, 'images');
const UPLOADS_DIR   = path.join(RUNTIME_ROOT, 'uploads');
const DATA_JSON_DIR = path.join(RUNTIME_ROOT, 'data');

// 프리빌트 삭제 표식. 프리빌트는 repo에 있어 지울 수 없으니 런타임에 묘비를 세운다.
// (예전 방식에선 Volume 사본을 지워도 다음 배포의 시드가 되살려 놨다 — 삭제가
//  아예 영속되지 않는 결함이었다.)
const TOMBSTONE = '.deleted';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const exists = (p) => {
  try { return fs.existsSync(p); } catch { return false; }
};

/** 런타임 → repo 순으로 찾아 **존재하는** 경로를 주고, 둘 다 없으면 null. */
function resolveRead(runtimePath, repoPath) {
  if (exists(runtimePath)) return runtimePath;
  if (repoPath && exists(repoPath)) return repoPath;
  return null;
}

// ── 캐릭터 ────────────────────────────────────────────────

const isPrebuilt   = (id) => exists(path.join(REPO_CHARS, id));
const isTombstoned = (id) => exists(path.join(CHARS_DIR, id, TOMBSTONE));

/** 캐릭터의 파일 하나를 읽을 경로. 없거나 삭제 표식이 있으면 null. */
function charReadFile(id, name) {
  if (isTombstoned(id)) return null;
  return resolveRead(path.join(CHARS_DIR, id, name), path.join(REPO_CHARS, id, name));
}

/** 캐릭터 파일을 쓸 경로 — 항상 런타임. 부모 디렉터리를 만들어 준다. */
function charWriteFile(id, name) {
  ensureDir(path.join(CHARS_DIR, id));
  return path.join(CHARS_DIR, id, name);
}

/** config.json을 읽어 파싱. 손상·부재는 null. */
function readCharConfig(id) {
  const p = charReadFile(id, 'config.json');
  if (!p) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

const dirNames = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch { return []; }
};

/** 프리빌트 ∪ 런타임 제작. 삭제 표식이 선 것은 제외. */
function listCharacterIds() {
  const ids = new Set([...dirNames(REPO_CHARS), ...dirNames(CHARS_DIR)]);
  return [...ids].filter((id) => !isTombstoned(id)).sort();
}

/**
 * 캐릭터 삭제. 유저 제작은 런타임 디렉터리를 지우고, 프리빌트는 묘비를 세운다.
 * repo는 어느 경우에도 건드리지 않는다.
 */
function deleteCharacter(id) {
  const runtimeDir = path.join(CHARS_DIR, id);
  try { fs.rmSync(runtimeDir, { recursive: true, force: true }); } catch { /* noop */ }
  if (isPrebuilt(id)) fs.writeFileSync(path.join(ensureDir(runtimeDir), TOMBSTONE), '');
}

// ── 이미지·업로드 ─────────────────────────────────────────
// 읽기는 express.static 이 IMAGES_DIR → public/ 순으로 폴백하므로(server.js)
// 여기서는 쓰기 경로만 다룬다. 쓰기 헬퍼가 디렉터리를 직접 보장하는 게 중요하다 —
// 부팅의 ensureRuntimeDirs() 에만 기대면, 서버를 띄우지 않는 경로(유닛 테스트 등)에서
// ENOENT 가 나고 그게 실행 순서에 따라 가려진다.
const imageWritePath  = (name) => path.join(ensureDir(IMAGES_DIR), name);
const uploadWritePath = (name) => path.join(ensureDir(UPLOADS_DIR), name);

// ── 모델 프롬프트 (Layer 3) ───────────────────────────────

const modelPromptRead  = (id) =>
  resolveRead(path.join(MODELS_DIR, `${id}.md`), path.join(REPO_MODELS, `${id}.md`));
const modelPromptWrite = (id) =>
  path.join(ensureDir(MODELS_DIR), `${id}.md`);

// ── data/*.json (큐레이션·방송 이력 등) ───────────────────

const dataFileRead  = (name) =>
  resolveRead(path.join(DATA_JSON_DIR, name), path.join(REPO_DATA, name));
const dataFileWrite = (name) =>
  path.join(ensureDir(DATA_JSON_DIR), name);

/** data/*.json 읽기. 런타임 오버라이드 → repo 기본값 → fallback. */
function readDataJson(name, fallback = null) {
  const p = dataFileRead(name);
  if (!p) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; }
}

function writeDataJson(name, value) {
  fs.writeFileSync(dataFileWrite(name), JSON.stringify(value, null, 2), 'utf-8');
}

const CURATION_JSON   = 'curation.json';
const BCAST_HIST_JSON = 'broadcast-history.json';
const COL_HIST_JSON   = 'collection-history.json';

// ── 탈퇴/유저삭제 시 파일 정리 (R5-2) ────────────────────
// DB CASCADE로 안 지워지는 파일 잔존(개인정보) 제거. 런타임 레이어만 본다 —
// 프리빌트와 타인 것은 구조적으로 사정권 밖이다.
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

function _rmByBase(dir, base) {
  for (const ext of IMG_EXTS) {
    const f = path.join(dir, `${base}.${ext}`);
    try { if (exists(f)) fs.rmSync(f, { force: true }); } catch { /* noop */ }
  }
}

function deleteUserFiles(userId) {
  _rmByBase(IMAGES_DIR, `user_${userId}`); // 아바타
  for (const dir of dirNames(CHARS_DIR)) {
    if (!dir.startsWith('char_')) continue; // 프리빌트 오버라이드/묘비는 제외
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(CHARS_DIR, dir, 'config.json'), 'utf-8'));
      if (cfg.owner_user_id !== userId) continue; // 본인 제작만
      fs.rmSync(path.join(CHARS_DIR, dir), { recursive: true, force: true });
      _rmByBase(IMAGES_DIR, dir); // 캐릭터 이미지
    } catch { /* 손상 config 등은 skip */ }
  }
}

/** 부팅 시 쓰기 디렉터리만 보장한다. 복사는 하지 않는다 (위 주석 참고). */
function ensureRuntimeDirs() {
  for (const d of [CHARS_DIR, MODELS_DIR, IMAGES_DIR, UPLOADS_DIR, DATA_JSON_DIR]) ensureDir(d);
}

module.exports = {
  RUNTIME_ROOT,
  REPO_CHARS, REPO_MODELS, REPO_IMAGES, REPO_DATA,
  CHARS_DIR, MODELS_DIR, IMAGES_DIR, UPLOADS_DIR, DATA_JSON_DIR,

  imageWritePath, uploadWritePath,
  isPrebuilt, isTombstoned,
  charReadFile, charWriteFile, readCharConfig, listCharacterIds, deleteCharacter,
  modelPromptRead, modelPromptWrite,
  dataFileRead, dataFileWrite, readDataJson, writeDataJson,
  CURATION_JSON, BCAST_HIST_JSON, COL_HIST_JSON,

  ensureRuntimeDirs, deleteUserFiles,
};
