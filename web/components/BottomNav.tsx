'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

interface Tab {
  href: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { href: '/',         label: '캐릭터',    icon: '⊞' },
  { href: '/history',  label: '대화',      icon: '◷' },
  { href: '/explore',  label: '탐색',      icon: '◎' },
  { href: '/builder',  label: '제작',      icon: '✦' },
  { href: '/mypage',   label: '마이페이지', icon: '◉' },
];

// 네비바를 숨길 페이지 path 패턴
const HIDE_PATTERNS: RegExp[] = [
  /^\/character\/[^/]+\/chat$/,
  /^\/builder\/(chat|manual|loading|preview)$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/reset-password$/,
  /^\/notification$/,
  /^\/persona\/(new|select(\/.*)?)$/,
];

export function BottomNav() {
  const pathname = usePathname() || '/';
  const hidden = HIDE_PATTERNS.some((re) => re.test(pathname));
  if (hidden) return null;

  // active 판정: 홈은 정확히 일치, 나머지는 startsWith
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
