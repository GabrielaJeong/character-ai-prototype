'use client';

import { useRouter } from 'next/navigation';
import styles from './not-found.module.css';

/**
 * 404 페이지 — 원본 #screen-404 (index.html L133~150).
 * Next.js App Router는 매칭되는 라우트가 없을 때 자동으로 이 컴포넌트를 렌더.
 */
export default function NotFound() {
  const router = useRouter();
  return (
    <div className={styles.wrap}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <p className={styles.title}>페이지를 찾을 수 없어요</p>
        <p className={styles.desc}>주소가 잘못되었거나 삭제된 페이지일 수 있어요.</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => router.back()}
          >
            뒤로
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => router.push('/')}
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
