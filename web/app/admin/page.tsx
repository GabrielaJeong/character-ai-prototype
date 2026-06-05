'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { useUIStore } from '@/store/ui';
import { api } from '@/lib/api';
import type { AdminStats } from '@/lib/admin';
import { ActivityChart, SafetyChart } from './dashboard';
import shell from './admin.module.css';

/**
 * 어드민 대시보드 — `/admin`.
 *
 * 원본: admin.html #page-dashboard + admin.js loadDashboard/renderChartActivity/renderChartSafety
 *        + routes/admin.js GET /stats, /stats/graph. 차트는 chart.js + react-chartjs-2.
 * 접근 보호: web/middleware.ts(서버 게이트). 셸: app/admin/layout.tsx.
 */
const statsFetcher = (p: string) => api.get<AdminStats>(p);

export default function AdminDashboardPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);
  const { data: s } = useSWR('/api/admin/stats', statsFetcher);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString());

  return (
    <>
      <div className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>대시보드</h1>
      </div>

      {/* Row 1 */}
      <div className={shell.statGrid}>
        <div className={shell.statCard}>
          <div className={shell.statLabel}>총 가입자</div>
          <div className={shell.statValue}>{fmt(s?.totalUsers)}</div>
        </div>
        <div className={shell.statCard}>
          <div className={shell.statLabel}>오늘 활성 세션</div>
          <div className={shell.statValue}>{fmt(s?.todaySessions)}</div>
        </div>
        <div className={shell.statCard}>
          <div className={shell.statLabel}>등록된 캐릭터</div>
          <div className={shell.statValue}>{fmt(s?.totalChars)}</div>
        </div>
        <div className={`${shell.statCard} ${shell.statCardWarn}`}>
          <div className={shell.statLabel}>Safety 위반 (7일)</div>
          <div className={shell.statValue}>{fmt(s?.modLogs7d)}</div>
        </div>
      </div>

      {/* Row 2 */}
      <div className={shell.statGrid} style={{ marginTop: -4 }}>
        <div className={shell.statCard}>
          <div className={shell.statLabel}>오늘 PV</div>
          <div className={`${shell.statValue} ${shell.statValueSm}`}>{fmt(s?.todayPV)}</div>
        </div>
        <div className={shell.statCard}>
          <div className={shell.statLabel}>오늘 UV</div>
          <div className={`${shell.statValue} ${shell.statValueSm}`}>{fmt(s?.todayUV)}</div>
        </div>
        <div className={shell.statCard}>
          <div className={shell.statLabel}>DAU (오늘)</div>
          <div className={`${shell.statValue} ${shell.statValueSm}`}>{fmt(s?.dau)}</div>
        </div>
        <div className={shell.statCard}>
          <div className={shell.statLabel}>MAU (30일)</div>
          <div className={`${shell.statValue} ${shell.statValueSm}`}>{fmt(s?.mau)}</div>
        </div>
      </div>

      {/* Charts */}
      <div className={shell.chartsGrid}>
        <ActivityChart />
        <SafetyChart />
      </div>
    </>
  );
}
