'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './admin.module.css';

/**
 * 어드민 셸 — 사이드바 + 메인 콘텐츠. `/admin/*` 전체를 감싼다.
 *
 * 원본: public/admin.html(sidebar/main-content) + public/css/admin.css.
 * 접근 보호는 web/middleware.ts(서버 게이트)가 담당.
 *
 * 앱은 #app(max-width 430px 모바일 프레임)인데 어드민은 데스크탑 풀폭이라,
 * shell을 position:fixed로 프레임 위에 덮어 풀뷰포트를 차지한다.
 *
 * nav의 `ready`는 Step 2 점진 이전 표시 — 아직 안 옮긴 페이지는 dimmed(비활성).
 */
interface NavItem {
  label: string;
  href: string;
  ready: boolean;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  {
    label: '대시보드',
    href: '/admin',
    ready: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    label: '캐릭터 평가',
    href: '/admin/eval',
    ready: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 3h12v1.5H2zm0 4h9v1.5H2zm0 4h6v1.5H2z" />
      </svg>
    ),
  },
  {
    label: '유저 관리',
    href: '/admin/users',
    ready: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="5" r="3" />
        <path d="M2 13c0-3.3 2.7-6 6-6s6 2.7 6 6H2z" />
      </svg>
    ),
  },
  {
    label: '캐릭터 관리',
    href: '/admin/characters',
    ready: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a4 4 0 0 1 4 4c0 2.2-1.8 4-4 4S4 7.2 4 5a4 4 0 0 1 4-4zm0 9c3.5 0 7 1.5 7 4H1c0-2.5 3.5-4 7-4z" />
      </svg>
    ),
  },
  {
    label: '모더레이션',
    href: '/admin/moderation',
    ready: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1L1 4v4c0 4 3 7.4 7 8 4-.6 7-4 7-8V4L8 1z" />
      </svg>
    ),
  },
  {
    label: '알림 관리',
    href: '/admin/notifications',
    ready: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a5 5 0 0 1 5 5v3l1.5 2H1.5L3 9V6a5 5 0 0 1 5-5zm-1.5 11h3a1.5 1.5 0 0 1-3 0z" />
      </svg>
    ),
  },
  {
    label: '큐레이션 관리',
    href: '/admin/curation',
    ready: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="2" width="14" height="2.5" rx="1.2" />
        <rect x="1" y="6.8" width="9" height="2.5" rx="1.2" />
        <rect x="1" y="11.5" width="11" height="2.5" rx="1.2" />
      </svg>
    ),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin';

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoText}>Folio</span>
          <span className={styles.logoBadge}>Admin</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                className={`${styles.navItem} ${styles.navItemDisabled}`}
                title="이전 예정"
                aria-disabled="true"
              >
                {item.icon}
                {item.label}
                <span className={styles.soon}>준비 중</span>
              </span>
            ),
          )}
        </nav>

        <div className={styles.footer}>
          <Link href="/" className={`${styles.navItem} ${styles.footerLink}`}>
            ← 앱으로 돌아가기
          </Link>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
