const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'chat.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migrate: add note column if not exists
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN note TEXT NOT NULL DEFAULT ''`);
} catch (_) { /* column already exists */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT    PRIMARY KEY,
    persona     TEXT    NOT NULL,
    created_at  INTEGER DEFAULT (unixepoch())
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
  createSession:  db.prepare('INSERT INTO sessions (id, persona) VALUES (?, ?)'),
  getSession:     db.prepare('SELECT * FROM sessions WHERE id = ?'),
  deleteSession:  db.prepare('DELETE FROM sessions WHERE id = ?'),

  listSessions: db.prepare(`
    SELECT
      s.id,
      s.persona,
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
