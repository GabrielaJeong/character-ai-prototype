/**
 * 테스트 전용 임시 경로의 단일 소스.
 *
 * setupFiles(워커 프로세스)와 globalSetup/globalTeardown(메인 프로세스)이
 * 같은 디렉터리를 가리켜야 해서 따로 뺐다.
 *
 * DB 뿐 아니라 런타임-mutable 파일(아바타·제작 캐릭터·업로드)까지 여기로 보낸다.
 * repo 안(db/, public/images/, prompts/characters/)에는 아무것도 만들지 않는다.
 */
const os = require('os');
const path = require('path');

// OS 임시 디렉터리 하위. 이 한 그루만 지우면 테스트 잔여물이 전부 사라진다.
const TEST_TMP_ROOT = path.join(os.tmpdir(), 'folio-test');

/** @deprecated TEST_TMP_ROOT 를 써라. 외부 참조 호환용. */
const TEST_DB_DIR = TEST_TMP_ROOT;

/** 워커별 전용 DB 파일. JEST_WORKER_ID 는 1부터, --runInBand 면 미설정일 수 있다. */
function workerDbPath() {
  return path.join(TEST_TMP_ROOT, 'db', `chat.w${workerId()}.db`);
}

/** 워커별 전용 RUNTIME_DATA_DIR — lib/paths.js 의 모든 쓰기가 이 아래로 떨어진다. */
function workerRuntimeDir() {
  return path.join(TEST_TMP_ROOT, 'runtime', `w${workerId()}`);
}

function workerId() {
  return process.env.JEST_WORKER_ID || '1';
}

module.exports = { TEST_TMP_ROOT, TEST_DB_DIR, workerDbPath, workerRuntimeDir };
