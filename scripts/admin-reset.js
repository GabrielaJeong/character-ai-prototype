#!/usr/bin/env node
/**
 * scripts/admin-reset.js
 * 유저 비밀번호 강제 재설정 + role 변경 (운영 긴급용).
 *
 * 사용법:
 *   node scripts/admin-reset.js <email> <newPassword> [role]
 *
 * 예시 (로컬):
 *   node scripts/admin-reset.js fbrkqls94@gmail.com 1234 admin
 *
 * 예시 (Railway 프로덕션):
 *   railway run node scripts/admin-reset.js fbrkqls94@gmail.com 1234 admin
 *
 * 주의:
 *   - bcrypt 해싱 후 DB 직접 업데이트
 *   - 약한 비밀번호도 검증 없이 통과 (의도된 긴급 도구)
 *   - 작업 후 유저는 즉시 강한 비밀번호로 변경할 것
 */

const bcrypt    = require('bcryptjs');
const { db, stmt } = require('../db');

const [, , email, newPassword, roleArg] = process.argv;

if (!email || !newPassword) {
  console.error('사용법: node scripts/admin-reset.js <email> <newPassword> [role]');
  process.exit(1);
}

const user = stmt.getUserByEmail.get(email);
if (!user) {
  console.error(`✗ 유저를 찾을 수 없습니다: ${email}`);
  process.exit(1);
}

const hash = bcrypt.hashSync(newPassword, 10);
stmt.updatePassword.run(hash, user.id);
console.log(`✓ 비밀번호 변경 완료 (user_id=${user.id})`);

if (roleArg) {
  if (!['user', 'admin'].includes(roleArg)) {
    console.error(`✗ role 은 'user' 또는 'admin' 만 허용`);
    process.exit(1);
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(roleArg, user.id);
  console.log(`✓ role 변경 완료: ${roleArg}`);
}

const after = stmt.getUserByEmail.get(email);
console.log(`\n현재 상태:`);
console.log(`  email:    ${after.email}`);
console.log(`  nickname: ${after.nickname}`);
console.log(`  username: ${after.username || '(없음)'}`);
console.log(`  role:     ${after.role}`);
console.log(`  id:       ${after.id}`);
