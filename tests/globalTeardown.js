/**
 * jest globalTeardown — 모든 워커 종료 후 1회 실행. 테스트 DB·런타임 파일 정리.
 *
 * best-effort 다. forceExit: true 라 핸들이 남아 Windows 에서 삭제가 실패할 수 있는데,
 * 그걸로 테스트를 실패시키지는 않는다 — 다음 실행의 globalSetup 이 어차피 지운다.
 */
const fs = require('fs');
const { TEST_TMP_ROOT } = require('./testPaths');

module.exports = () => {
  try {
    fs.rmSync(TEST_TMP_ROOT, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[jest] 테스트 임시 파일 정리 실패 (무해, 다음 실행에서 정리됨): ${err.message}`);
  }
};
