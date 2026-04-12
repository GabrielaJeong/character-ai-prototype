const Database = require('better-sqlite3');
const path = require('path');

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

// ── Migrations (idempotent) ───────────────────────────────
try { db.exec(`ALTER TABLE sessions ADD COLUMN note         TEXT NOT NULL DEFAULT ''`);       } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN model        TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'`); } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN character_id TEXT NOT NULL DEFAULT 'ihwa'`);   } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN safety       TEXT NOT NULL DEFAULT 'on'`);     } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`); } catch (_) {}

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
  createUser:          db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)'),
  getUserByEmail:      db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById:         db.prepare('SELECT id, email, nickname, avatar, default_persona_id, created_at FROM users WHERE id = ?'),
  updateAvatar:        db.prepare('UPDATE users SET avatar = ? WHERE id = ?'),
  updateNickname:      db.prepare('UPDATE users SET nickname = ? WHERE id = ?'),
  updateEmail:         db.prepare('UPDATE users SET email = ? WHERE id = ?'),
  updatePassword:      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  updateDefaultPersona:db.prepare('UPDATE users SET default_persona_id = ? WHERE id = ?'),
  deleteUser:          db.prepare('DELETE FROM users WHERE id = ?'),

  deleteUserSessions:  db.prepare('DELETE FROM sessions WHERE user_id = ?'),

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

  // ── Auth sessions (SQLite session store) ─────────────────
  sessionGet:     db.prepare('SELECT sess FROM auth_sessions WHERE sid = ? AND expired > ?'),
  sessionSet:     db.prepare('INSERT OR REPLACE INTO auth_sessions (sid, sess, expired) VALUES (?, ?, ?)'),
  sessionDestroy: db.prepare('DELETE FROM auth_sessions WHERE sid = ?'),
  sessionPrune:   db.prepare('DELETE FROM auth_sessions WHERE expired <= ?'),
};

module.exports = { db, stmt };
