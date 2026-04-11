const express = require('express');
const bcrypt  = require('bcryptjs');
const Joi     = require('joi');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();
const { stmt } = require('../db');

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
});

const loginSchema = Joi.object({
  email:    Joi.string().email({ tlds: { allow: false } }).required()
              .messages({ 'string.email': '이메일 형식이 올바르지 않습니다', 'any.required': '이메일을 입력해주세요' }),
  password: Joi.string().min(1).required()
              .messages({ 'any.required': '비밀번호를 입력해주세요', 'string.empty': '비밀번호를 입력해주세요' }),
});

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: true });
  if (error) return res.status(400).json({ error: error.message });

  const { email, password, nickname } = value;

  if (stmt.getUserByEmail.get(email)) {
    return res.status(409).json({ error: '이미 사용 중인 이메일입니다' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const info = stmt.createUser.run(email, hash, nickname);
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

  const { email, password } = value;
  const row = stmt.getUserByEmail.get(email);
  if (!row) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });

  try {
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });

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

  const { nickname, email, currentPassword, newPassword, avatarData } = req.body;

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
