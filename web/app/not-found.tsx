'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './not-found.module.css';

export default function NotFoundPage() {
  const router = useRouter();
  return (
    <main className={styles.wrap}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <p className={styles.title}>페이지를 찾을 수 없어요</p>
        <p className={styles.desc}>주소가 잘못되었거나 삭제된 페이지일 수 있어요.</p>
        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={() => router.back()}>뒤로</button>
          <Link href="/" className={styles.btnPrimary}>홈으로</Link>
        </div>
      </div>
    </main>
  );
}
