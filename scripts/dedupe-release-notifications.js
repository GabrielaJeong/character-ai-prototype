#!/usr/bin/env node
/**
 * scripts/dedupe-release-notifications.js
 *
 * notifications 테이블에서 같은 버전(related_id) 알림이 여러 개면
 * 가장 최신 1개만 남기고 나머지 삭제.
 *
 * 사용법:
 *   node scripts/dedupe-release-notifications.js              # 미리보기 (dry run)
 *   node scripts/dedupe-release-notifications.js --apply      # 실제 삭제
 *   railway run node scripts/dedupe-release-notifications.js --apply  # 프로덕션
 */

const { db } = require('../db');

const apply = process.argv.includes('--apply');

const dupes = db.prepare(`
  SELECT related_id, COUNT(*) AS cnt
  FROM notifications
  WHERE category = 'notice' AND user_id IS NULL AND related_id IS NOT NULL
  GROUP BY related_id
  HAVING cnt > 1
`).all();

if (!dupes.length) {
  console.log('✓ 중복된 release 알림 없음');
  process.exit(0);
}

console.log(`발견된 중복 그룹: ${dupes.length}개\n`);

let totalDeleted = 0;
for (const { related_id, cnt } of dupes) {
  // 같은 버전 알림들 가져와서 가장 최신 ID 빼고 삭제
  const rows = db.prepare(`
    SELECT id, title, created_at FROM notifications
    WHERE category = 'notice' AND user_id IS NULL AND related_id = ?
    ORDER BY id DESC
  `).all(related_id);

  const keep = rows[0];
  const remove = rows.slice(1);

  console.log(`[${related_id}] ${cnt}개 발견 → 유지 id=${keep.id}, 삭제 ${remove.length}개`);
  console.log(`  유지: "${keep.title}"`);
  remove.forEach(r => console.log(`  삭제: id=${r.id} "${r.title}"`));

  if (apply) {
    const ids = remove.map(r => r.id);
    db.prepare(`DELETE FROM notifications WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    db.prepare(`DELETE FROM notification_reads WHERE notification_id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    totalDeleted += ids.length;
  }
  console.log();
}

if (apply) {
  console.log(`✓ ${totalDeleted}개 알림 삭제 완료`);
} else {
  console.log(`(미리보기 모드. 실제 삭제는 --apply 옵션 추가)`);
}
