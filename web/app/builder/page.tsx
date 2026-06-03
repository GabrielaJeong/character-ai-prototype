'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import styles from './page.module.css';

/**
 * 캐릭터 제작 (빌더) — `/builder`
 *
 * Day 13 본격 구현 예정. 현재는 BottomNav "제작" 탭이 404로 빠지지 않도록 placeholder.
 * (Codex R7: BottomNav builder 탭이 라우트 없어 404였음)
 */
export default function BuilderPage() {
  const router = useRouter();
  const setAppReady = useUIStore((s) => s.setAppReady);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  return (
    <div className={styles.wrap}>
      <div className={styles.content}>
        <div className={styles.icon}>✦</div>
        <p className={styles.title}>캐릭터 제작</p>
        <p className={styles.desc}>
          AI 대화형 빌더와 직접 제작 기능을 준비 중입니다.<br />
          곧 만나보실 수 있어요.
        </p>
        <button type="button" className="btn-primary" onClick={() => router.push('/')} style={{ maxWidth: 200, marginTop: 24 }}>
          홈으로
        </button>
      </div>
    </div>
  );
}
