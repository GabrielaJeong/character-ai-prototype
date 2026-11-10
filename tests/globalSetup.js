/**
 * jest globalSetup — 메인 프로세스에서 워커 기동 **전** 1회 실행.
 * 이전 실행이 남긴 테스트 DB 를 지워 매 실행을 깨끗한 상태에서 시작한다.
 * 이 시점엔 아무 워커도 파일 핸들을 쥐고 있지 않아 삭제가 안전하다.
 */
const fs = require('fs');
const { TEST_DB_DIR } = require('./testDbPath');

module.exports = () => {
  fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
};
