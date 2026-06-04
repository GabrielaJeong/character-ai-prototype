'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import styles from './page.module.css';

/**
 * 어드민 — `/admin` (Step 1: 보안 골격 + placeholder).
 *
 * 접근 보호는 `web/middleware.ts`(서버 측 게이트)가 담당 — 비어드민은 이 페이지 셸을
 * 받기 전에 `/`로 redirect됨. 따라서 여기 도달했다면 이미 어드민.
 *
 * 실제 어드민 기능(차트/모더레이션/캐릭터·큐레이션 관리)은 Step 2에서 점진 이전 예정.
 * 그 전까지는 기존 `public/admin.html`(Express :3000 /admin, adminPageGuard)이 운영용.
 */
export default function AdminPage() {
  const router = useRouter();
  const setAppReady = useUIStore((s) => s.setAppReady);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  return (
    <div className={styles.wrap}>
      <div className={styles.content}>
        <div className={styles.badge}>ADMIN</div>
        <p className={styles.title}>어드민 콘솔 (이전 중)</p>
        <p className={styles.desc}>
          서버 측 게이트(middleware)가 적용된 어드민 라우트입니다.
          <br />
          기능은 단계적으로 이전됩니다.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => router.push('/')}
          style={{ maxWidth: 200, marginTop: 24 }}
        >
          홈으로
        </button>
      </div>
    </div>
  );
}
