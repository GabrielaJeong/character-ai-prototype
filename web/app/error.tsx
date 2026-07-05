'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './not-found.module.css';

/**
 * 라우트 단위 에러 boundary — App Router의 에러 폴백.
 *
 * Next.js 요구사항:
 *   - 반드시 Client Component ('use client')
 *   - `error` (Error & { digest? }) / `reset` 함수 props
 *
 * 디자인: 404 페이지와 동일한 .not-found-* 패턴 재사용 (텍스트만 다름).
 * 실제 에러 메시지는 dev에서만 노출 — prod에선 일반 안내문.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // dev에선 콘솔에도 출력 — Next.js overlay와 별개로 추적 용이
      console.error('[ErrorBoundary]', error);
    }
  }, [error]);

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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <p className={styles.title}>문제가 발생했어요</p>
        <p className={styles.desc}>
          {process.env.NODE_ENV === 'production'
            ? '잠시 후 다시 시도해주세요.'
            : error.message || '알 수 없는 오류'}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => router.push('/')}>
            홈으로
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => reset()}>
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
