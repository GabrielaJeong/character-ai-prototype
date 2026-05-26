/**
 * 숫자를 1000+ 단위로 줄여 표시. 원본 app.js의 fmtK.
 *   1234   → "1.2K"
 *   1000   → "1K"
 *   999    → "999"
 */
export function fmtK(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/** Unix epoch 초 → "방금 / N분 전 / N시간 전 / N일 전 / YYYY.MM.DD" */
export function relativeTime(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60)         return '방금';
  if (diff < 3600)       return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7)  return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(unixSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** 알림 미읽음 카운트 표시: 9개 초과 → "9+" */
export function notifBadgeText(n: number): string {
  return n > 9 ? '9+' : String(n);
}
