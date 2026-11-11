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
 * 2. **파일 격리** (`RUNTIME_DATA_DIR`). lib/paths.js 는 이 변수가 없으면 런타임 쓰기를
 *    repo 안(`public/images/`, `prompts/characters/`, `data/`)으로 보낸다. 탈퇴 테스트가
 *    `deleteUserFiles()` 를 타면서 git 추적 파일 `public/images/user_2.jpg` 를 실제로
 *    지웠다 (2026-11-10). 테스트 DB 가 깨끗하면 유저 id 가 1부터 다시 깔려서 아무 테스트
 *    유저나 실제 user_2 의 아바타를 자기 것으로 오인한다 — 즉 1번을 고치자 2번이 터졌다.
 *
 * 두 경로 모두 OS 임시 디렉터리의 **워커별** 하위 경로다. 워커가 서로 밟지 않으므로
 * 경합도 없다. 외부에서 준 값은 일부러 무시한다 — 존중하면 개발·운영 데이터로 가는
 * 길을 열어 두는 셈이다.
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

// 프리빌트 캐릭터·모델 프롬프트·data/*.json 을 워커 디렉터리로 복사한다(텍스트 ~110KB).
// server.js 의 부팅 시드에 기댈 수 없다 — 유닛 테스트는 서버를 띄우지 않고
// prompts/buildSystemPrompt.js 를 직접 require 해서 CHARS_DIR 을 읽는다.
// 이미지는 시드 대상이 아니다(express 폴백으로 충분) — lib/paths.js 참고.
//
// require 순서가 중요하다: RUNTIME_DATA_DIR 을 세팅한 **뒤에** 불러야 한다.
// lib/paths.js 는 모듈 로드 시점에 DATA_ROOT 를 고정한다.
//
// setupFiles 는 테스트 **파일마다** 돌아간다(jest 가 파일 사이에 모듈 레지스트리를
// 리셋한다). seed-if-missing 이라 반복 호출이 싸고(텍스트 ~110KB), 앞선 테스트가
// 프리빌트를 지웠다면 되살아나는 쪽이 낫다 — 그래서 일부러 1회로 묶지 않는다.
require('../lib/paths').seedRuntimeData();
