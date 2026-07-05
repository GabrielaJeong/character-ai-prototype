'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

/**
 * 하단 5탭 네비.
 *
 * 원본의 noNavScreens (app.js:816) 매칭:
 *   - screen-chat → /character/[id]/chat
 *   - screen-builder-chat / manual / loading → /builder/chat /manual /loading
 *   - screen-login → /login, /signup
 *   - screen-reset-password → /reset-password
 *   - screen-notification → /notification
 *   - screen-persona-select / select-edit → /persona/select 및 /persona/select/[id]
 *
 * 추가로 (원본엔 없지만 안전): /404 등도 BottomNav 숨김 안 함 (홈/탐색/마이페이지 등에서만 표시).
 */

interface Tab {
  href: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { href: '/',        label: '캐릭터',     icon: '⊞' },
  { href: '/history', label: '대화',       icon: '◷' },
  { href: '/explore', label: '탐색',       icon: '◎' },
  { href: '/builder', label: '제작',       icon: '✦' },
  { href: '/mypage',  label: '마이페이지', icon: '◉' },
];

const HIDE_PATTERNS: RegExp[] = [
  /^\/character\/[^/]+\/chat$/,
  /^\/builder\/(chat|manual|loading|preview)$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/reset-password$/,
  /^\/notification$/,
  /^\/persona(\/.*)?$/,           // /persona, /persona/new, /persona/select, /persona/select/[id], /persona/[id]
  /^\/admin(\/.*)?$/,             // 어드민 콘솔 — 유저 BottomNav 숨김
];

export function BottomNav() {
  const pathname = usePathname() || '/';
  const hidden = HIDE_PATTERNS.some((re) => re.test(pathname));
  if (hidden) return null;

  // active 판정: 홈은 정확히, 나머지는 startsWith
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className={styles.nav}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`${styles.tab} ${isActive(tab.href) ? styles.active : ''}`}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
