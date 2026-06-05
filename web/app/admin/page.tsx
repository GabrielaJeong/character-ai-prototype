'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/ui';
import shell from './admin.module.css';
import styles from './page.module.css';

/**
 * 어드민 대시보드 — `/admin` (Step 2에서 차트/통계 이전 예정, 현재 placeholder).
 *
 * 접근 보호: web/middleware.ts(서버 게이트). 셸(사이드바)은 app/admin/layout.tsx.
 */
export default function AdminDashboardPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  return (
    <>
      <div className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>대시보드</h1>
        <span className={shell.pageSub}>Step 2 이전 중</span>
      </div>
      <div className={styles.placeholder}>
        <p className={styles.placeholderTitle}>대시보드는 이전 예정입니다.</p>
        <p className={styles.placeholderDesc}>
          어드민 셸(사이드바·라우팅)과 서버 게이트는 완료됐습니다.
          <br />
          기능 페이지(유저·캐릭터·알림·큐레이션 등)를 순차 이전합니다.
        </p>
      </div>
    </>
  );
}
