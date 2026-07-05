// 런타임-mutable 파일 경로의 단일 소스 (R5-1 파일 영속성).
//
// 문제: 유저 아바타·제작 캐릭터·큐레이션 업로드·admin이 편집하는 config/model 프롬프트·
//   curation.json 등은 런타임에 파일로 쓰이는데, Railway는 재배포 시 컨테이너 디스크가
//   초기화되어 이들이 유실됨.
//
// 방식 A(부팅 시드): RUNTIME_DATA_DIR(=Railway Volume, 예 /data)가 지정되면 런타임 쓰기를
//   그 하위로 보내고, 부팅 시 repo 프리빌트/시드를 "없는 것만" 복사(seed-if-missing).
//   → 프리빌트/신규는 채워지고, 기존 런타임·admin 편집물은 보존.
//   RUNTIME_DATA_DIR 미설정(로컬 dev)이면 경로가 기존 repo 위치와 동일 → 동작 무변경, 시드 skip.

const path = require('path');
const fs   = require('fs');

const ROOT      = path.join(__dirname, '..');
const DATA_ROOT = process.env.RUNTIME_DATA_DIR || null; // 예: /data (Railway Volume)

// repo 원본(시드 소스 + dev 기본 경로)
const REPO_CHARS  = path.join(ROOT, 'prompts', 'characters');
const REPO_MODELS = path.join(ROOT, 'prompts', 'models');
const REPO_IMAGES = path.join(ROOT, 'public', 'images');
const REPO_DATA   = path.join(ROOT, 'data');

// 런타임 경로: DATA_ROOT 있으면 그 하위, 없으면 repo 원본과 동일
const CHARS_DIR     = DATA_ROOT ? path.join(DATA_ROOT, 'characters') : REPO_CHARS;
const MODELS_DIR    = DATA_ROOT ? path.join(DATA_ROOT, 'models')     : REPO_MODELS;
const IMAGES_DIR    = DATA_ROOT ? path.join(DATA_ROOT, 'images')     : REPO_IMAGES;
const UPLOADS_DIR   = DATA_ROOT ? path.join(DATA_ROOT, 'uploads')    : path.join(ROOT, 'public', 'uploads');
const DATA_JSON_DIR = DATA_ROOT ? path.join(DATA_ROOT, 'data')       : REPO_DATA;

const CURATION_FILE   = path.join(DATA_JSON_DIR, 'curation.json');
const BCAST_HIST_FILE = path.join(DATA_JSON_DIR, 'broadcast-history.json');
const COL_HIST_FILE   = path.join(DATA_JSON_DIR, 'collection-history.json');

// 부팅 시드 — DATA_ROOT 지정 시에만. seed-if-missing(force:false)라 기존 편집물/런타임 생성물 보존.
// (프리빌트 '업데이트'는 전파 안 됨 — /data에 이미 있으면 skip. 신규 프리빌트는 채워짐.)
function seedRuntimeData() {
  if (!DATA_ROOT) return; // dev: 경로가 repo와 동일 → 시드 불필요
  const pairs = [
    [REPO_CHARS,  CHARS_DIR],
    [REPO_MODELS, MODELS_DIR],
    [REPO_IMAGES, IMAGES_DIR],
    [REPO_DATA,   DATA_JSON_DIR],
  ];
  for (const [src, dst] of pairs) {
    fs.mkdirSync(dst, { recursive: true });
    if (fs.existsSync(src)) {
      fs.cpSync(src, dst, { recursive: true, force: false, errorOnExist: false });
    }
  }
  fs.mkdirSync(UPLOADS_DIR, { recursive: true }); // uploads는 프리빌트 없음 — 디렉터리만 보장
}

// 탈퇴/유저삭제 시 파일 데이터 정리 (R5-2): 아바타 + 제작 캐릭터 dir·이미지.
// DB CASCADE로 안 지워지는 파일 잔존(개인정보) 제거. 프리빌트/타인 것은 안 건드림.
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
function _rmByBase(dir, base) {
  for (const ext of IMG_EXTS) {
    const f = path.join(dir, `${base}.${ext}`);
    try { if (fs.existsSync(f)) fs.rmSync(f, { force: true }); } catch { /* noop */ }
  }
}
function deleteUserFiles(userId) {
  _rmByBase(IMAGES_DIR, `user_${userId}`); // 아바타
  try {
    if (!fs.existsSync(CHARS_DIR)) return;
    for (const dir of fs.readdirSync(CHARS_DIR)) {
      if (!dir.startsWith('char_')) continue; // 프리빌트 제외
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(CHARS_DIR, dir, 'config.json'), 'utf-8'));
        if (cfg.owner_user_id !== userId) continue; // 본인 제작만
        fs.rmSync(path.join(CHARS_DIR, dir), { recursive: true, force: true });
        _rmByBase(IMAGES_DIR, dir); // 캐릭터 이미지
      } catch { /* 손상 config 등은 skip */ }
    }
  } catch { /* noop */ }
}

module.exports = {
  CHARS_DIR, MODELS_DIR, IMAGES_DIR, UPLOADS_DIR, DATA_JSON_DIR,
  CURATION_FILE, BCAST_HIST_FILE, COL_HIST_FILE,
  seedRuntimeData, deleteUserFiles,
};
