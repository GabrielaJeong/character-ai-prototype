'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useNotifications } from '@/lib/hooks';
import { api } from '@/lib/api';
import type { Notification, NotificationCategory } from '@/lib/types';
import styles from './page.module.css';

/**
 * 알림함 — `/notification`
 *
 * 원본: index.html L838~868 (#screen-notification) + style.css L3307~3622
 *        + app.js L878~1059 (loadNotifications / renderNotifFeed / buildNotifRow / accordion).
 *
 * 정책: 알림은 공개. 비로그인 시 브로드캐스트(공지)만 표시되고 전부 unread (백엔드 listNotificationsGuest).
 *        읽음 처리(PATCH)는 로그인 사용자만 — 원본 onNotifRowClick의 `_currentUser` 가드와 동일.
 */
type Tab = 'all' | NotificationCategory;

const TABS: { key: Tab; en: string; ko: string }[] = [
  { key: 'all', en: 'ALL', ko: '전체' },
  { key: 'social', en: 'SOCIAL', ko: '소셜' },
  { key: 'system', en: 'SYSTEM', ko: '시스템' },
  { key: 'notice', en: 'NOTICE', ko: '공지' },
];

export default function NotificationPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setAppReady = useUIStore((s) => s.setAppReady);
  const { notifications, unreadCount, isLoading, error, mutate } = useNotifications();
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const filtered =
    tab === 'all' ? notifications : notifications.filter((n) => n.category === tab);

  // ── 날짜 그룹 (원본 renderNotifFeed) ──────────────────
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayStart = todayMidnight.getTime() / 1000;
  const yesterdayStart = todayStart - 86400;
  const weekStart = todayStart - 6 * 86400;

  const groups = [
    {
      key: 'today',
      label: 'TODAY · 오늘',
      items: filtered.filter((n) => n.created_at >= todayStart),
    },
    {
      key: 'yesterday',
      label: 'YESTERDAY · 어제',
      items: filtered.filter((n) => n.created_at >= yesterdayStart && n.created_at < todayStart),
    },
    {
      key: 'week',
      label: 'THIS.WEEK · 이번주',
      items: filtered.filter((n) => n.created_at >= weekStart && n.created_at < yesterdayStart),
    },
    {
      key: 'older',
      label: 'EARLIER · 이전',
      items: filtered.filter((n) => n.created_at < weekStart),
    },
  ].filter((g) => g.items.length > 0);

  // ── 읽음 처리 (로그인 시) ─────────────────────────────
  const onRowClick = (n: Notification) => {
    if (n.is_read || !user) return;
    // 낙관적 업데이트 후 서버 반영
    mutate(
      (cur) =>
        cur
          ? {
              items: cur.items.map((it) => (it.id === n.id ? { ...it, is_read: true } : it)),
              unreadCount: Math.max(0, cur.unreadCount - 1),
            }
          : cur,
      { revalidate: false },
    );
    api.patch(`/api/notifications/${n.id}/read`).catch(() => mutate());
  };

  const onMarkAll = () => {
    if (!user || unreadCount === 0) return;
    mutate(
      (cur) =>
        cur
          ? { items: cur.items.map((it) => ({ ...it, is_read: true })), unreadCount: 0 }
          : cur,
      { revalidate: false },
    );
    api.patch('/api/notifications/read-all').catch(() => mutate());
  };

  return (
    <div className={`page-wrap ${styles.pageWrap}`}>
      {/* 커스텀 헤더 */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => router.push('/')}
          aria-label="뒤로"
        >
          ←
        </button>
        <div className={styles.headerCenter}>
          <div className={styles.eyebrow}>&gt; INBOX.feed</div>
          <div className={styles.inboxTitle}>
            알림함
            {unreadCount > 0 && <span className={styles.newCount}>[{unreadCount} new]</span>}
          </div>
        </div>
        <button type="button" className={styles.markAllBtn} onClick={onMarkAll}>
          MARK ALL
        </button>
      </div>

      {/* 필터 탭 */}
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.en} <span className={styles.tabSub}>· {t.ko}</span>
          </button>
        ))}
      </div>

      {/* 피드 */}
      <div className={styles.feed}>
        {isLoading && <p className={styles.loading}>불러오는 중...</p>}
        {!isLoading && error && <p className={styles.loading}>알림을 불러오지 못했습니다.</p>}
        {!isLoading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>NO MATCHES</p>
            <p className={styles.emptyDesc}>새로운 알림이 오면 여기에 표시돼요.</p>
          </div>
        )}
        {!isLoading &&
          !error &&
          groups.map((g) => (
            <div key={g.key} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupLabel}>{g.label}</span>
                <span className={styles.groupDate}>{fmtDate(g.items[0].created_at)}</span>
              </div>
              {g.items.map((n) => (
                <NotifRow key={n.id} n={n} onClick={() => onRowClick(n)} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

// ── 알림 행 ─────────────────────────────────────────────
function NotifRow({ n, onClick }: { n: Notification; onClick: () => void }) {
  const cat = n.category;
  const iconSrc =
    cat === 'social'
      ? '/images/icon-social.svg'
      : cat === 'notice'
        ? '/images/icon-notice.svg'
        : '/images/icon-system.svg';
  const catBadge =
    cat === 'social'
      ? { cls: styles.catSocial, label: 'SOCIAL' }
      : cat === 'notice'
        ? { cls: styles.catNotice, label: 'NOTICE' }
        : { cls: styles.catSys, label: 'SYSTEM' };

  return (
    <div
      className={`${styles.row} ${n.is_read ? styles.rowRead : styles.rowRecent}`}
      onClick={onClick}
    >
      <div className={`${styles.rowIcon} ${cat === 'social' ? styles.iconSocial : styles.iconSystem}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={18} height={18} alt={cat} />
      </div>
      <div className={styles.rowContent}>
        <div className={styles.rowTop}>
          <span className={styles.rowTitle}>{n.title}</span>
          <span className={`${styles.catBadge} ${catBadge.cls}`}>{catBadge.label}</span>
        </div>
        {n.body &&
          (cat === 'notice' ? (
            <NoticeBody body={n.body} />
          ) : (
            <p className={styles.rowBody}>{n.body}</p>
          ))}
        <p className={styles.rowTime}>{notifTimeStr(n.created_at)}</p>
      </div>
    </div>
  );
}

// ── NOTICE 아코디언 (원본 applyNoticeAccordions: 실제 높이 측정 후 토글 버튼) ──
function NoticeBody({ body }: { body: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setOverflow(el.scrollHeight > el.clientHeight + 2);
  }, [body]);

  return (
    <>
      <div
        ref={wrapRef}
        className={`${styles.noticeBodyWrap} ${expanded ? styles.noticeExpanded : ''}`}
      >
        <p className={styles.rowBody}>{body}</p>
      </div>
      {overflow && (
        <button
          type="button"
          className={styles.noticeToggle}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? '접기' : '더 보기'}
        </button>
      )}
    </>
  );
}

// ── 시간/날짜 포맷 (원본 notifTimeStr / fmtDate) ──────────
function notifTimeStr(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  const d = new Date(unixSec * 1000);
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff < 86400) return hhmm;
  if (diff < 86400 * 2) return `어제 ${hhmm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`;
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
