/**
 * 테스트 전용 DB 경로의 단일 소스.
 *
 * setupFiles(워커 프로세스)와 globalSetup/globalTeardown(메인 프로세스)이
 * 같은 디렉터리를 가리켜야 해서 따로 뺐다.
 */
const os = require('os');
const path = require('path');

// OS 임시 디렉터리 하위 — repo 안(db/)에 절대 만들지 않는다.
const TEST_DB_DIR = path.join(os.tmpdir(), 'folio-test-db');

/** 워커별 전용 DB 파일. JEST_WORKER_ID 는 1부터, --runInBand 면 미설정일 수 있다. */
function workerDbPath() {
  return path.join(TEST_DB_DIR, `chat.w${process.env.JEST_WORKER_ID || '1'}.db`);
}

module.exports = { TEST_DB_DIR, workerDbPath };
