/**
 * jest setupFiles — 테스트 파일이 로드되기 전에 워커 프로세스에서 실행된다.
 *
 * 핵심: **DB 격리**. db/index.js 는 `DB_PATH` 가 없으면 `db/chat.db`(개발 DB)를 연다.
 * 테스트가 그걸 그대로 쓰면 두 가지 사고가 난다:
 *   1. 워커 여러 개가 같은 파일에 `PRAGMA journal_mode = WAL` 을 동시에 걸어
 *      `SqliteError: database is locked` 로 스위트가 통째로 로드 실패한다
 *      (CI 2026-10-22 run 39802722463 — 낮은 빈도라 오래 묻혀 있었다)
 *   2. 테스트가 만든 유저·세션·알림이 개발 DB 에 섞여 남는다
 *
 * 그래서 워커마다 OS 임시 디렉터리의 자기 파일을 쓴다. repo 안에는 만들지 않는다.
 *
 * 주의: 이 파일은 2026-10-23 이전까지 **jest 설정에 연결돼 있지 않아 실행되지 않았다**
 * (setupFiles 미설정 + 어떤 테스트도 require 하지 않음). CI 는 워크플로 step env 로
 * NODE_ENV·SESSION_SECRET 를 주입해 가려져 있었다.
 */
const fs = require('fs');
const path = require('path');
const { workerDbPath } = require('./testDbPath');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';

const dbPath = workerDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.DB_PATH = dbPath;
