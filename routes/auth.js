const express    = require('express');
const bcrypt     = require('bcryptjs');
const Joi        = require('joi');
const fs         = require('fs');
const path       = require('path');
const router     = express.Router();
const { randomUUID } = require('crypto');
const { stmt }   = require('../db');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

// ── Validation schemas ────────────────────────────────────
const registerSchema = Joi.object({
  email:    Joi.string().email({ tlds: { allow: false } }).required()
              .messages({ 'string.email': '이메일 형식이 올바르지 않습니다', 'any.required': '이메일을 입력해주세요' }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-zA-Z])(?=.*\d)/).required()
              .messages({
                'string.min':     '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다',
                'string.pattern.base': '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다',
                'any.required':   '비밀번호를 입력해주세요',
              }),
  nickname: Joi.string().min(2).max(12).pattern(/^[^\s!@#$%^&*()+=\[\]{};':"\\|,.<>/?`~]+$/).required()
              .messages({
                'string.min':           '닉네임은 2~12자, 특수문자 없이 입력해주세요',
                'string.max':           '닉네임은 2~12자, 특수문자 없이 입력해주세요',
                'string.pattern.base':  '닉네임은 2~12자, 특수문자 없이 입력해주세요',
                'any.required':         '닉네임을 입력해주세요',
              }),
  username: Joi.string().min(3).max(20).pattern(/^[a-z0-9_]+$/).required()
              .messages({
                'string.min':          '@아이디는 3~20자, 영문 소문자/숫자/언더바만 가능합니다',
                'string.max':          '@아이디는 3~20자, 영문 소문자/숫자/언더바만 가능합니다',
                'string.pattern.base': '@아이디는 3~20자, 영문 소문자/숫자/언더바만 가능합니다',
                'any.required':        '@아이디를 입력해주세요',
              }),
});

const loginSchema = Joi.object({
  identifier: Joi.string().min(1).required()
                .messages({ 'any.required': '이메일 또는 @아이디를 입력해주세요', 'string.empty': '이메일 또는 @아이디를 입력해주세요' }),
  password: Joi.string().min(1).required()
              .messages({ 'any.required': '비밀번호를 입력해주세요', 'string.empty': '비밀번호를 입력해주세요' }),
});

// ── GET /api/auth/check-username ─────────────────────────
router.get('/check-username', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: '아이디를 입력해주세요' });

  const lower = username.toLowerCase();
  const { error } = Joi.string().min(3).max(20).pattern(/^[a-z0-9_]+$/).validate(lower);
  if (error) return res.json({ available: false, error: '@아이디는 3~20자, 영문 소문자/숫자/언더바만 가능합니다' });

  // Reserved usernames
  const reserved = ['admin', 'folio', 'system', 'support', 'help', 'mod', 'moderator', 'official', 'staff'];
  if (reserved.includes(lower)) return res.json({ available: false, error: '사용할 수 없는 아이디입니다' });

  const existing = stmt.getUserByUsername.get(lower);
  res.json({ available: !existing });
});

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: true });
  if (error) return res.status(400).json({ error: error.message });

  const { email, password, nickname, username } = value;
  const lowerUsername = username.toLowerCase();

  if (stmt.getUserByEmail.get(email)) {
    return res.status(409).json({ error: '이미 사용 중인 이메일입니다' });
  }
  if (stmt.getUserByUsername.get(lowerUsername)) {
    return res.status(409).json({ error: '이미 사용 중인 @아이디입니다' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const info = stmt.createUser.run(email, hash, nickname, randomUUID(), lowerUsername);
    const user = stmt.getUserById.get(info.lastInsertRowid);
    req.session.userId = user.id;
    res.json({ user });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: '회원가입에 실패했습니다' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: true });
  if (error) return res.status(400).json({ error: error.message });

  const { identifier, password } = value;

  // Determine if identifier is email or username
  const isEmail = identifier.includes('@') && identifier.includes('.');
  const row = isEmail
    ? stmt.getUserByEmail.get(identifier)
    : stmt.getUserByUsername.get(identifier.toLowerCase().replace(/^@/, ''));

  if (!row) return res.status(401).json({ error: '아이디/이메일 또는 비밀번호가 올바르지 않습니다' });

  try {
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: '아이디/이메일 또는 비밀번호가 올바르지 않습니다' });

    req.session.userId = row.id;
    const user = stmt.getUserById.get(row.id);
    res.json({ user });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: '로그인에 실패했습니다' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('folio.sid');
    res.json({ ok: true });
  });
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = stmt.getUserById.get(req.session.userId);
  res.json({ user: user || null });
});

// ── PATCH /api/auth/me ────────────────────────────────────
router.patch('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });

  const { nickname, email, username, currentPassword, newPassword, avatarData } = req.body;

  if (username !== undefined) {
    const lower = username.toLowerCase();
    const { error: uErr } = Joi.string().min(3).max(20).pattern(/^[a-z0-9_]+$/).validate(lower);
    if (uErr) return res.status(400).json({ error: '@아이디는 3~20자, 영문 소문자/숫자/언더바만 가능합니다' });
    const existing = stmt.getUserByUsername.get(lower);
    if (existing && existing.id !== req.session.userId) {
      return res.status(409).json({ error: '이미 사용 중인 @아이디입니다' });
    }
    stmt.updateUsername.run(lower, req.session.userId);
  }

  if (nickname !== undefined) {
    const { error } = Joi.string().min(2).max(12)
      .pattern(/^[^\s!@#$%^&*()+=\[\]{};':"\\|,.<>/?`~]+$/)
      .validate(nickname);
    if (error) return res.status(400).json({ error: '닉네임은 2~12자, 특수문자 없이 입력해주세요' });
    stmt.updateNickname.run(nickname, req.session.userId);
  }

  if (email !== undefined) {
    const { error } = Joi.string().email({ tlds: { allow: false } }).validate(email);
    if (error) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다' });
    const existing = stmt.getUserByEmail.get(email);
    if (existing && existing.id !== req.session.userId) {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다' });
    }
    stmt.updateEmail.run(email, req.session.userId);
  }

  if (newPassword !== undefined) {
    if (!currentPassword) return res.status(400).json({ error: '현재 비밀번호를 입력해주세요' });

    const { error: pwErr } = Joi.string().min(8).pattern(/^(?=.*[a-zA-Z])(?=.*\d)/).validate(newPassword);
    if (pwErr) return res.status(400).json({ error: '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다' });

    const row = stmt.getUserByEmail.get(
      stmt.getUserById.get(req.session.userId)?.email
    );
    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다' });

    const hash = await bcrypt.hash(newPassword, 12);
    stmt.updatePassword.run(hash, req.session.userId);
  }

  if (avatarData && typeof avatarData === 'string') {
    const match = avatarData.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/);
    if (match) {
      const ext      = match[1].replace('jpeg', 'jpg');
      const filename = `user_${req.session.userId}.${ext}`;
      fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(match[2], 'base64'));
      stmt.updateAvatar.run(`/images/${filename}`, req.session.userId);
    }
  }

  const user = stmt.getUserById.get(req.session.userId);
  res.json({ user });
});

// ── POST /api/auth/adult-verify ───────────────────────────
// 최초 성인 인증 (adult_verified + adult_content_enabled = 1)
router.post('/adult-verify', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  stmt.setAdultVerified.run(req.session.userId);
  const user = stmt.getUserById.get(req.session.userId);
  res.json({ user });
});

// ── PATCH /api/auth/adult-content ─────────────────────────
// 이미 인증된 유저의 ON/OFF 전환
router.patch('/adult-content', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  const user = stmt.getUserById.get(req.session.userId);
  if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다' });
  if (!user.adult_verified) return res.status(403).json({ error: '성인 인증이 필요합니다' });

  const { enabled } = req.body;
  stmt.updateAdultContent.run(enabled ? 1 : 0, req.session.userId);
  const updated = stmt.getUserById.get(req.session.userId);
  res.json({ user: updated });
});

// ── POST /api/auth/forgot-password ───────────────────────
// 데모 버전: 실제 이메일 발송 없이 토큰을 응답에 포함
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const { error } = Joi.string().email({ tlds: { allow: false } }).validate(email);
  if (error) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다' });

  const user = stmt.getUserByEmail.get(email);
  // 이메일이 존재하지 않아도 동일한 응답 (보안 고려)
  if (!user) {
    return res.json({ ok: true, _demo_token: null });
  }

  // 기존 미사용 토큰 삭제 후 새 토큰 생성
  stmt.deleteOldResetTokens.run(user.id);
  const token     = randomUUID().replace(/-/g, '');
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 30; // 30분 유효
  stmt.createResetToken.run(user.id, token, expiresAt);

  res.json({ ok: true, _demo_token: token });
});

// ── POST /api/auth/reset-password ────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token) return res.status(400).json({ error: '유효하지 않은 링크입니다' });

  const { error: pwErr } = Joi.string().min(8).pattern(/^(?=.*[a-zA-Z])(?=.*\d)/).validate(password);
  if (pwErr) return res.status(400).json({ error: '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다' });

  const now = Math.floor(Date.now() / 1000);
  const row = stmt.getResetToken.get(token, now);
  if (!row) return res.status(400).json({ error: '링크가 만료되었거나 이미 사용된 링크입니다' });

  try {
    const hash = await bcrypt.hash(password, 12);
    stmt.updatePassword.run(hash, row.user_id);
    stmt.markResetTokenUsed.run(token);
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다' });
  }
});

// ── DELETE /api/auth/me ───────────────────────────────────
router.delete('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });

  const uid = req.session.userId;
  stmt.deleteUserSessions.run(uid);
  stmt.deleteUser.run(uid);

  req.session.destroy(() => {
    res.clearCookie('folio.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
