const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'chat.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migrations
try { db.exec(`ALTER TABLE sessions ADD COLUMN note         TEXT NOT NULL DEFAULT ''`);       } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN model        TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'`); } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN character_id TEXT NOT NULL DEFAULT 'ihwa'`);   } catch (_) {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN safety       TEXT NOT NULL DEFAULT 'on'`);     } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT    PRIMARY KEY,
    persona      TEXT    NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-6',
    character_id TEXT    NOT NULL DEFAULT 'ihwa',
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
`);

const stmt = {
  createSession:        db.prepare('INSERT INTO sessions (id, persona, model, character_id, safety) VALUES (?, ?, ?, ?, ?)'),
  getSession:           db.prepare('SELECT * FROM sessions WHERE id = ?'),
  deleteSession:        db.prepare('DELETE FROM sessions WHERE id = ?'),
  updateSessionModel:   db.prepare('UPDATE sessions SET model = ? WHERE id = ?'),
  updateSessionSafety:  db.prepare('UPDATE sessions SET safety = ? WHERE id = ?'),

  listSessions: db.prepare(`
    SELECT
      s.id,
      s.persona,
      s.model,
      s.character_id,
      s.safety,
      s.created_at,
      COUNT(m.id)  AS message_count,
      (SELECT content FROM messages
       WHERE session_id = s.id
       ORDER BY created_at DESC LIMIT 1) AS last_message
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
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
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    )
  `),

  getNote:  db.prepare(`SELECT note FROM sessions WHERE id = ?`),
  saveNote: db.prepare(`UPDATE sessions SET note = ? WHERE id = ?`),
};

module.exports = { stmt };
