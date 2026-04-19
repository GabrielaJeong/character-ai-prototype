const Database    = require('better-sqlite3');
const path        = require('path');
const { randomUUID } = require('crypto');

const db = new Database(path.join(__dirname, 'chat.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Core tables ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    email            TEXT    UNIQUE NOT NULL,
    password_hash    TEXT    NOT NULL,
    nickname         TEXT    NOT NULL,
    default_persona_id INTEGER,
    created_at       INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT    PRIMARY KEY,
    persona      TEXT    NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-6',
    character_id TEXT    NOT NULL DEFAULT 'ihwa',
    safety       TEXT    NOT NULL DEFAULT 'on',
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    role        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    created_at  INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS personas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data       TEXT    NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    sid     TEXT    PRIMARY KEY,
    sess    TEXT    NOT NULL,
    expired INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id TEXT    NOT NULL,
    created_at   INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, character_id)
  );
`);

// ── Notifications ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category    TEXT    NOT NULL DEFAULT 'system',
    title       TEXT    NOT NULL,
    body        TEXT,
    related_id  TEXT,
    created_at  INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS notification_reads (
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    read_at         INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, notification_id)
  );
`);
// 마이그레이션 (기존 테이블에 컬럼 추가)
try { db.exec(`ALTER TABLE notifications ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`); } catch(_) {}
try { db.exec(`ALTER TABLE notifications ADD COLUMN category TEXT NOT NULL DEFAULT 'system'`); } catch(_) {}
try { db.exec(`ALTER TABLE notifications ADD COLUMN related_id TEXT`); } catch(_) {}

// 샘플 알림 시드 (최초 1회 — category 기준)
const _notifCount = db.prepare(`SELECT COUNT(*) AS cnt FROM notifications WHERE category IN ('social','system')`).get();
if (_notifCount.cnt === 0) {
  const _ins = db.prepare(`INSERT INTO notifications (user_id, category, title, body, related_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const _now = Math.floor(Date.now() / 1000);
  // SYS — 전체 공지 (user_id NULL)
  _ins.run(null, 'system', '새로운 AI 모델 · Gemini 1.5 Pro 추가', '더 긴 문맥, 더 섬세한 한국어 문체를 지원합니다. 채팅 화면에서 모델을 선택할 수 있어요.', null, _now - 60);
  _ins.run(null, 'system', '캐릭터 빌더 오픈', '이제 누구나 나만의 AI 캐릭터를 직접 만들 수 있습니다. 빌더 탭에서 시작해보세요.', null, _now - 3600);
  _ins.run(null, 'system', '가이드라인 업데이트', '4월 20일부터 캐릭터 등록 시 요약문이 120자 이상이어야 합니다.', null, _now - 86400 * 2);
  // SOCIAL — 전체 공지 (user_id NULL, 실제론 user_id별로 생성됨)
  _ins.run(null, 'social', '이화 이번주 인기 캐릭터 톱 3 진입 🎉', '#로맨스 카테고리에서 3위. 12.4K 대화 · 3.2K 좋아요.', 'ihwa', _now - 1800);
}

// ── Password reset tokens ────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0
  );
`);

// ── Admin tables ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS moderation_logs (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id            TEXT,
    session_id           TEXT,
    user_id              INTEGER,
    character_id         TEXT,
    model                TEXT,
    safety_status        TEXT,
    trigger_step         INTEGER,
    user_input_masked    TEXT,
    ai_response_summary  TEXT,
    created_at           INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS eval_results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT    NOT NULL,
    model        TEXT    NOT NULL,
    score        REAL    NOT NULL,
    detail       TEXT    NOT NULL,
    evaluated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER,
    session_token TEXT,
    path          TEXT,
    created_at    INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at);
  CREATE INDEX IF NOT EXISTS idx_pv_user    ON page_views(user_id, created_at);
`);

// ── Migrations (idempotent) ───────────────────────────────
try { db.exec(`ALTER TABLE sessions ADD COLUMN note         TEXT NOT NULL DEFAULT ''`);       } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN model        TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'`); } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN character_id TEXT NOT NULL DEFAULT 'ihwa'`);   } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN safety       TEXT NOT NULL DEFAULT 'on'`);     } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN adult_content_enabled INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN adult_verified        INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN role      TEXT NOT NULL DEFAULT 'user'`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN public_id TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE moderation_logs ADD COLUMN public_id TEXT`); } catch (_) {}

// ── Backfill public_ids ───────────────────────────────────
const _setPubId = db.prepare('UPDATE users SET public_id = ? WHERE id = ?');
db.transaction(() => {
  const rows = db.prepare('SELECT id FROM users WHERE public_id IS NULL').all();
  for (const r of rows) _setPubId.run(randomUUID(), r.id);
})();

const _setLogPubId = db.prepare('UPDATE moderation_logs SET public_id = ? WHERE id = ?');
db.transaction(() => {
  const rows = db.prepare('SELECT id FROM moderation_logs WHERE public_id IS NULL').all();
  for (const r of rows) _setLogPubId.run(randomUUID(), r.id);
})();

// ── Prepared statements ───────────────────────────────────
const stmt = {
  // ── Chat sessions ────────────────────────────────────────
  createSession:        db.prepare('INSERT INTO sessions (id, persona, model, character_id, safety, user_id) VALUES (?, ?, ?, ?, ?, ?)'),
  getSession:           db.prepare('SELECT * FROM sessions WHERE id = ?'),
  deleteSession:        db.prepare('DELETE FROM sessions WHERE id = ?'),
  updateSessionModel:   db.prepare('UPDATE sessions SET model = ? WHERE id = ?'),
  updateSessionSafety:  db.prepare('UPDATE sessions SET safety = ? WHERE id = ?'),

  listSessionsByUser: db.prepare(`
    SELECT s.id, s.persona, s.model, s.character_id, s.safety, s.created_at,
      COUNT(m.id) AS message_count,
      (SELECT content FROM messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) AS last_message
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    WHERE s.user_id = ?
    GROUP BY s.id ORDER BY s.created_at DESC
  `),
  listSessionsGuest: db.prepare(`
    SELECT s.id, s.persona, s.model, s.character_id, s.safety, s.created_at,
      COUNT(m.id) AS message_count,
      (SELECT content FROM messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) AS last_message
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    WHERE s.user_id IS NULL
    GROUP BY s.id ORDER BY s.created_at DESC
  `),

  addMessage:  db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)'),
  getMessages: db.prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC'),
  getAllMessages: db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'),

  getLastMessage: db.prepare(`
    SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
  `),
  deleteLastAssistantMessage: db.prepare(`
    DELETE FROM messages WHERE id = (
      SELECT id FROM messages
      WHERE session_id = ? AND role = 'assistant'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
  `),

  getNote:  db.prepare(`SELECT note FROM sessions WHERE id = ?`),
  saveNote: db.prepare(`UPDATE sessions SET note = ? WHERE id = ?`),

  // ── Users ────────────────────────────────────────────────
  createUser:          db.prepare('INSERT INTO users (email, password_hash, nickname, public_id) VALUES (?, ?, ?, ?)'),
  getUserByEmail:      db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById:         db.prepare('SELECT id, email, nickname, avatar, role, public_id, default_persona_id, adult_content_enabled, adult_verified, created_at FROM users WHERE id = ?'),
  getUserByPublicId:   db.prepare('SELECT id, email, nickname, avatar, role, public_id, default_persona_id, adult_content_enabled, adult_verified, created_at FROM users WHERE public_id = ?'),
  updateAvatar:        db.prepare('UPDATE users SET avatar = ? WHERE id = ?'),
  updateNickname:      db.prepare('UPDATE users SET nickname = ? WHERE id = ?'),
  updateEmail:         db.prepare('UPDATE users SET email = ? WHERE id = ?'),
  updatePassword:      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  updateDefaultPersona:    db.prepare('UPDATE users SET default_persona_id = ? WHERE id = ?'),
  updateAdultContent:      db.prepare('UPDATE users SET adult_content_enabled = ? WHERE id = ?'),
  setAdultVerified:        db.prepare('UPDATE users SET adult_verified = 1, adult_content_enabled = 1 WHERE id = ?'),
  deleteUser:              db.prepare('DELETE FROM users WHERE id = ?'),
  deleteUserSessions:      db.prepare('DELETE FROM sessions WHERE user_id = ?'),

  // ── Personas ─────────────────────────────────────────────
  createPersona:       db.prepare('INSERT INTO personas (user_id, data) VALUES (?, ?)'),
  getPersonasByUser:   db.prepare('SELECT * FROM personas WHERE user_id = ? ORDER BY created_at DESC'),
  getPersonaById:      db.prepare('SELECT * FROM personas WHERE id = ? AND user_id = ?'),
  updatePersona:       db.prepare('UPDATE personas SET data = ? WHERE id = ? AND user_id = ?'),
  deletePersona:       db.prepare('DELETE FROM personas WHERE id = ? AND user_id = ?'),

  // ── Bookmarks ────────────────────────────────────────────
  addBookmark:          db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, character_id) VALUES (?, ?)'),
  removeBookmark:       db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND character_id = ?'),
  getBookmarksByUser:   db.prepare('SELECT character_id, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC'),
  getBookmark:          db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND character_id = ?'),

  // ── Character stats ──────────────────────────────────────
  // 전체 세션 수 (캐릭터별)
  charSessionCounts: db.prepare(`
    SELECT character_id, COUNT(*) AS cnt FROM sessions GROUP BY character_id
  `),
  // 최근 7일 세션 수 (캐릭터별) — HOT 판정용
  charSessionCountsRecent: db.prepare(`
    SELECT character_id, COUNT(*) AS cnt FROM sessions
    WHERE created_at >= ? GROUP BY character_id
  `),
  // 전체 북마크 수 (캐릭터별)
  charBookmarkCounts: db.prepare(`
    SELECT character_id, COUNT(*) AS cnt FROM bookmarks GROUP BY character_id
  `),

  // ── Notifications ────────────────────────────────────────
  // 로그인 유저: 전체 공지(user_id NULL) + 본인 알림(user_id=me)
  listNotifications: db.prepare(`
    SELECT n.*,
      CASE WHEN nr.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_read
    FROM notifications n
    LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
    WHERE n.user_id IS NULL OR n.user_id = ?
    ORDER BY n.created_at DESC
  `),
  // 비로그인: 전체 공지만, 전부 unread
  listNotificationsGuest: db.prepare(`
    SELECT n.*, 0 AS is_read FROM notifications n
    WHERE n.user_id IS NULL
    ORDER BY n.created_at DESC
  `),
  countUnread: db.prepare(`
    SELECT COUNT(*) AS cnt FROM notifications n
    WHERE (n.user_id IS NULL OR n.user_id = ?)
      AND NOT EXISTS (
        SELECT 1 FROM notification_reads nr
        WHERE nr.notification_id = n.id AND nr.user_id = ?
      )
  `),
  markAllRead: db.prepare(`
    INSERT OR IGNORE INTO notification_reads (user_id, notification_id)
    SELECT ?, id FROM notifications WHERE user_id IS NULL OR user_id = ?
  `),
  markOneRead: db.prepare(`
    INSERT OR IGNORE INTO notification_reads (user_id, notification_id) VALUES (?, ?)
  `),
  createNotification: db.prepare(`
    INSERT INTO notifications (user_id, category, title, body, related_id) VALUES (?, ?, ?, ?, ?)
  `),

  // ── Password reset tokens ────────────────────────────────
  createResetToken:    db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'),
  getResetToken:       db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?'),
  markResetTokenUsed:  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?'),
  deleteOldResetTokens: db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND used = 0'),

  // ── Auth sessions (SQLite session store) ─────────────────
  sessionGet:     db.prepare('SELECT sess FROM auth_sessions WHERE sid = ? AND expired > ?'),
  sessionSet:     db.prepare('INSERT OR REPLACE INTO auth_sessions (sid, sess, expired) VALUES (?, ?, ?)'),
  sessionDestroy: db.prepare('DELETE FROM auth_sessions WHERE sid = ?'),
  sessionPrune:   db.prepare('DELETE FROM auth_sessions WHERE expired <= ?'),

  // ── Page Views ────────────────────────────────────────────
  insertPageView: db.prepare('INSERT INTO page_views (user_id, session_token, path) VALUES (?, ?, ?)'),

  // ── Admin — Users ─────────────────────────────────────────
  listAllUsers: db.prepare(`
    SELECT u.id, u.email, u.nickname, u.role, u.avatar, u.public_id,
           u.adult_verified, u.adult_content_enabled, u.created_at,
           COUNT(s.id) AS session_count
    FROM users u
    LEFT JOIN sessions s ON s.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `),
  updateUserRole:  db.prepare('UPDATE users SET role = ? WHERE public_id = ?'),
  adminDeleteUser: db.prepare('DELETE FROM users WHERE public_id = ?'),

  // ── Admin — Stats ─────────────────────────────────────────
  countUsers:             db.prepare('SELECT COUNT(*) AS cnt FROM users'),
  countCharSessions:      db.prepare('SELECT COUNT(*) AS cnt FROM sessions WHERE created_at >= ?'),
  countModerationLogs7d:  db.prepare('SELECT COUNT(*) AS cnt FROM moderation_logs WHERE created_at >= ?'),

  // ── Admin — Moderation Logs ───────────────────────────────
  insertModerationLog: db.prepare(`
    INSERT INTO moderation_logs
      (public_id, session_id, user_id, character_id, model, safety_status, trigger_step, user_input_masked, ai_response_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getModerationLogByPublicId: db.prepare('SELECT * FROM moderation_logs WHERE public_id = ?'),

  // ── Admin — Eval ──────────────────────────────────────────
  insertEvalResult: db.prepare(`
    INSERT INTO eval_results (character_id, model, score, detail)
    VALUES (?, ?, ?, ?)
  `),
  listEvalResults: db.prepare('SELECT * FROM eval_results ORDER BY evaluated_at DESC'),
  getLatestEvalMatrix: db.prepare(`
    SELECT character_id, model, score, detail, evaluated_at
    FROM eval_results e1
    WHERE evaluated_at = (
      SELECT MAX(e2.evaluated_at) FROM eval_results e2
      WHERE e2.character_id = e1.character_id AND e2.model = e1.model
    )
  `),
};

module.exports = { db, stmt };
