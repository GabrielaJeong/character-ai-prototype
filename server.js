require('dotenv').config();
const express        = require('express');
const session        = require('express-session');
const path           = require('path');
const helmet         = require('helmet');
const rateLimit      = require('express-rate-limit');
const { randomUUID } = require('crypto');
const { db, stmt }   = require('./db');
const { seedRuntimeData, IMAGES_DIR, UPLOADS_DIR } = require('./lib/paths');

// R5-1: RUNTIME_DATA_DIR(=Volume) 지정 시 repo 프리빌트/시드를 런타임 디렉터리로 seed-if-missing.
// dev(미지정)는 no-op. 파일 서빙·라우트보다 먼저 실행되어야 함.
seedRuntimeData();

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

// 빌더는 비인증 데모 + 매 호출이 AI라 전역(200)보다 빡세게 (R5-3 비용 보호)
const builderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: '빌더 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login',          authLimiter);
app.use('/api/auth/register',       authLimiter);
app.use('/api/auth/check-username', checkUsernameLimiter);
app.use('/api/admin',               adminLimiter);
app.use('/api/builder',             builderLimiter);
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

// ── 환경변수 검증 (L-013: 프로덕션에서 필수 변수 누락 시 startup fail) ──
const REQUIRED_PROD_ENV = ['SESSION_SECRET', 'NODE_ENV'];
const isProd = process.env.NODE_ENV === 'production';
const missingProd = REQUIRED_PROD_ENV.filter(k => !process.env[k]);

if (isProd && missingProd.length) {
  console.error(`[FATAL] 프로덕션 필수 환경변수 누락: ${missingProd.join(', ')}`);
  console.error('  → SESSION_SECRET: 세션 쿠키 위조 방지용 (32자+ 랜덤 문자열)');
  console.error('  → NODE_ENV=production: cookie secure 플래그 활성화');
  process.exit(1);
}
if (!isProd && !process.env.SESSION_SECRET) {
  console.warn('[WARN] SESSION_SECRET not set — using insecure default (dev only)');
}
// 권장 변수 (없어도 기동은 되나 기능 제한)
const recommended = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY'];
const missingRec = recommended.filter(k => !process.env[k]);
if (missingRec.length) {
  console.warn(`[WARN] 권장 환경변수 누락: ${missingRec.join(', ')} (해당 모델 사용 불가)`);
}

const sessionSecret = process.env.SESSION_SECRET || 'folio-dev-secret-change-in-prod';

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
// 런타임 생성 이미지·업로드는 IMAGES_DIR/UPLOADS_DIR(Volume 가능)에서 먼저 서빙,
// 이후 public/(아이콘·favicon·프리빌트 이미지)로 폴백. (R5-1)
// cutover 후 public/ 에 남는 것은 정적 자원뿐 — Next가 /images·/icons·/uploads 를
// 이 서버로 프록시하므로(next.config.mjs rewrites) 계속 필요하다.
app.use('/images',  express.static(IMAGES_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ── Guest ID 발급 — 비로그인 세션 소유권 추적용 ──────────
app.use((req, res, next) => {
  if (!req.session.userId && !req.session.guestId) {
    req.session.guestId = randomUUID();
  }
  next();
});

// ── Page View tracking (실제 앱 화면 GET 요청만 로깅) ──────────
// 대시보드 PV/UV/DAU가 유저 화면 트래픽만 반영하도록, 비화면 요청을 광범위하게 제외.
const STATIC_EXT = /\.(css|js|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|svg|map)$/i;
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();                    // PV = GET 화면 요청만
  if (STATIC_EXT.test(req.path)) return next();               // 정적 자원
  if (req.path.startsWith('/api/')) return next();            // API
  if (req.path === '/admin' || req.path.startsWith('/admin/')) return next(); // 어드민(화면 아님)
  if (req.path.startsWith('/.well-known/')) return next();    // 브라우저/툴 자동 요청(devtools 등)
  // 파일형 경로(마지막 세그먼트에 '.' 포함: *.json·favicon 등)는 화면 아님 → 제외
  if ((req.path.split('/').pop() || '').includes('.')) return next();
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
const { CURATION_FILE } = require('./lib/paths');
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

// ── Cutover: 이 서버는 API + 정적 자원(images/icons/uploads)만 담당 ──
//
// 화면은 전부 Next(web/)가 Vercel에서 서빙한다. 어드민 페이지도 web/app/admin/*
// 이고, 서버사이드 role 검증은 web/middleware.ts 가 /api/auth/me 로 대신한다
// (구 adminPageGuard 대응). 레거시 SPA(public/index.html·admin.html·js·css)는
// D-019 완료와 함께 제거됐다.
//
// 남은 HTML 요청은 프론트로 넘긴다. FRONTEND_ORIGIN 미설정 시 리다이렉트 대신
// 404를 준다 — 잘못된 도메인으로 보내는 것보다 안 보내는 쪽이 안전하다.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || null;

app.get('/{*splat}', (req, res) => {
  if (!FRONTEND_ORIGIN) {
    return res.status(404).json({
      error: '이 서버는 API 전용입니다. 화면은 프론트엔드 도메인을 이용해주세요.',
    });
  }
  res.redirect(302, FRONTEND_ORIGIN + req.originalUrl);
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
