require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');
const { db, stmt } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── SQLite session store (uses existing better-sqlite3 DB) ─
const { Store } = session;
class SQLiteStore extends Store {
  constructor() { super(); }
  get(sid, cb) {
    try {
      const row = stmt.sessionGet.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000;
      stmt.sessionSet.run(sid, JSON.stringify(sess), ttl);
      cb(null);
    } catch (e) { cb(e); }
  }
  destroy(sid, cb) {
    try { stmt.sessionDestroy.run(sid); cb(null); }
    catch (e) { cb(e); }
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(session({
  store:             new SQLiteStore(),
  name:              'folio.sid',
  secret:            process.env.SESSION_SECRET || 'folio-dev-secret-change-in-prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));
app.use(express.static(path.join(__dirname, 'public')));

// Routes — regenerate must be registered before /api/chat router (Express 5 path matching)
app.post('/api/chat/regenerate', require('./routes/regenerate'));
app.use('/api/chat',             require('./routes/chat'));
app.use('/api/sessions',         require('./routes/sessions'));
app.use('/api/sessions/:id/note',require('./routes/notes'));
app.use('/api/characters',       require('./routes/characters'));
app.use('/api/builder',          require('./routes/builder'));
app.use('/api/auth',             require('./routes/auth'));
app.use('/api/personas',         require('./routes/personas'));

// Fallback: serve index.html for all non-API routes
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
