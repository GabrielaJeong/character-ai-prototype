/**
 * jest setupFiles — 테스트 파일이 로드되기 전에 워커 프로세스에서 실행된다.
 *
 * 테스트를 repo 의 실제 데이터에서 떼어 놓는다. 둘 다 실제로 사고를 냈다:
 *
 * 1. **DB 격리** (`DB_PATH`). db/index.js 는 `DB_PATH` 가 없으면 `db/chat.db`(개발 DB)를
 *    연다. 그걸 그대로 쓰면 워커 여러 개가 같은 파일에 `PRAGMA journal_mode = WAL` 을
 *    동시에 걸어 `SqliteError: database is locked` 로 스위트가 통째로 로드 실패하고
 *    (CI 2026-10-22 run 39802722463), 테스트가 만든 유저·세션·알림이 개발 DB 에 남는다.
 *
 * 2. **파일 격리** (`RUNTIME_DATA_DIR`). lib/paths.js 의 모든 **쓰기**가 이 루트 아래로
 *    간다. 탈퇴 테스트가 `deleteUserFiles()` 를 타면서 git 추적 파일
 *    `public/images/user_2.jpg` 를 실제로 지웠다 (2026-11-10). 테스트 DB 가 깨끗하면
 *    유저 id 가 1부터 다시 깔려서 아무 테스트 유저나 실제 user_2 의 아바타를 자기
 *    것으로 오인한다 — 즉 1번을 고치자 2번이 터졌다.
 *
 * 두 경로 모두 OS 임시 디렉터리의 **워커별** 하위 경로다. 워커가 서로 밟지 않으므로
 * 경합도 없다. 외부에서 준 값은 일부러 무시한다 — 존중하면 개발·운영 데이터로 가는
 * 길을 열어 두는 셈이다.
 *
 * 시드는 하지 않는다. lib/paths.js 가 읽을 때 런타임 → repo 로 폴백하므로
 * 프리빌트 캐릭터·모델 프롬프트·data/*.json 은 repo 에서 그대로 읽힌다.
 * (복사하던 시절엔 워커마다 수 MB 를 퍼 날랐다.)
 */
const fs = require('fs');
const path = require('path');
const { workerDbPath, workerRuntimeDir } = require('./testPaths');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';

const dbPath = workerDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.DB_PATH = dbPath;

const runtimeDir = workerRuntimeDir();
fs.mkdirSync(runtimeDir, { recursive: true });
process.env.RUNTIME_DATA_DIR = runtimeDir;
