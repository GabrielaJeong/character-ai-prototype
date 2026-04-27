require('dotenv').config();
const express        = require('express');
const session        = require('express-session');
const path           = require('path');
const helmet         = require('helmet');
const rateLimit      = require('express-rate-limit');
const { randomUUID } = require('crypto');
const { db, stmt }   = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// Railway 등 역방향 프록시 뒤에서 실제 클라이언트 IP를 신뢰
// (없으면 rate limiter가 모든 유저를 프록시 IP 하나로 묶음)
app.set('trust proxy', 1);

// ── Security headers (helmet) ─────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      scriptSrcAttr:  ["'unsafe-inline'"], // helmet 기본값 'none'이 onclick 속성 전부 차단 → 명시적 허용
      styleSrc:       ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      imgSrc:         ["'self'", "data:", "https:"],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'", "data:", "cdn.jsdelivr.net"], // Pretendard 폰트
      frameAncestors: ["'self'", "https://gabby-pm-portfolio.vercel.app"], // 포트폴리오 iframe 허용
    },
  },
  frameguard: false, // frameAncestors CSP로 제어하므로 X-Frame-Options 비활성화
  crossOriginEmbedderPolicy: false, // 이미지 업로드 호환성
}));

// ── Rate Limiting ─────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '너무 많은 시도입니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// check-username은 실시간 타이핑 중 hit → 별도 완화 limiter (반박: authLimiter 10회는 너무 빡셈)
const checkUsernameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: '요청이 너무 많습니다.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: '요청이 너무 많습니다.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: '어드민 요청이 너무 많습니다.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login',          authLimiter);
app.use('/api/auth/register',       authLimiter);
app.use('/api/auth/check-username', checkUsernameLimiter);
app.use('/api/admin',               adminLimiter);
app.use('/api/',                    apiLimiter);

// ── SQLite session store ──────────────────────────────────
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

const sessionSecret = process.env.SESSION_SECRET || 'folio-dev-secret-change-in-prod';
if (!process.env.SESSION_SECRET) {
  console.warn('[WARN] SESSION_SECRET not set — using insecure default (dev only)');
}

app.use(express.json({ limit: '10mb' }));
app.use(session({
  store:             new SQLiteStore(),
  name:              'folio.sid',
  secret:            sessionSecret,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  },
}));
app.use(express.static(path.join(__dirname, 'public')));

// ── Guest ID 발급 — 비로그인 세션 소유권 추적용 ──────────
app.use((req, res, next) => {
  if (!req.session.userId && !req.session.guestId) {
    req.session.guestId = randomUUID();
  }
  next();
});

// ── Page View tracking (HTML 페이지 요청만 로깅) ──────────
const STATIC_EXT = /\.(css|js|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|svg|map)$/i;
app.use((req, res, next) => {
  if (STATIC_EXT.test(req.path)) return next();
  if (req.path.startsWith('/api/')) return next();
  try {
    const userId       = req.session?.userId || null;
    const sessionToken = req.sessionID || null;
    if (sessionToken) stmt.insertPageView.run(userId, sessionToken, req.path);
  } catch (_) {}
  next();
});

// ── Routes ────────────────────────────────────────────────
app.post('/api/chat/regenerate', require('./routes/regenerate'));
app.use('/api/chat',             require('./routes/chat'));
app.use('/api/sessions',         require('./routes/sessions'));
app.use('/api/sessions/:id/note',require('./routes/notes'));
app.use('/api/characters',       require('./routes/characters'));
app.use('/api/builder',          require('./routes/builder'));
app.use('/api/auth',             require('./routes/auth'));
app.use('/api/personas',         require('./routes/personas'));
app.use('/api/bookmarks',        require('./routes/bookmarks'));
app.use('/api/notifications',    require('./routes/notifications'));
app.use('/api/admin',            require('./routes/admin'));
app.use('/api/creator',          require('./routes/creator'));

// ── Public curation read ──────────────────────────────────
const fs   = require('fs');
const CURATION_FILE = path.join(__dirname, 'data', 'curation.json');
app.get('/api/version', (_req, res) => {
  try {
    const changelog = fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf-8');
    const match = changelog.match(/changelog-last-version:\s*([\d.]+)/);
    res.json({ version: match ? `v${match[1]}` : 'v?' });
  } catch { res.json({ version: 'v?' }); }
});

app.get('/api/curation', (_req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(CURATION_FILE, 'utf-8')));
  } catch { res.status(500).json({ error: '큐레이션 로드 실패' }); }
});

// ── Admin pages (서버사이드 role 검증) ───────────────────
function adminPageGuard(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) return res.redirect('/');
  const user = stmt.getUserById.get(userId);
  if (!user || user.role !== 'admin') return res.redirect('/');
  next();
}
app.get('/admin', adminPageGuard, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin/{*splat}', adminPageGuard, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── SPA fallback ──────────────────────────────────────────
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // 서버 시작 시 새 버전 감지 → 자동 알림 생성
    require('./lib/releaseNotify').checkAndNotify().catch(() => {});
  });
}

module.exports = app;
