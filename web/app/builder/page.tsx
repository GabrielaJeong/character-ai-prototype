'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useRequireAuth } from '@/lib/useRequireAuth';
import styles from './page.module.css';

/**
 * 캐릭터 제작 방식 선택 — `/builder`
 *
 * 원본: index.html L512~554 (#screen-builder) + style.css L2993~3048 (select-card).
 * AI 빌더(/builder/chat) 또는 직접 제작(/builder/manual) 분기.
 * 제작은 로그인 필수 (원본 openBuilder authGate).
 */
export default function BuilderPage() {
  const router = useRouter();
  const setAppReady = useUIStore((s) => s.setAppReady);
  const { user, ready } = useRequireAuth('/builder', {
    title: '캐릭터 제작',
    desc: '캐릭터를 제작하려면 로그인이 필요합니다.',
  });

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  if (!ready || !user) {
    return <div className="page-wrap" />;
  }

  return (
    <div className="page-wrap">
      <div className={styles.tabHeader}>
        <div className={styles.titleRow}>
          <span className={styles.tabTitle}>캐릭터 제작</span>
        </div>
        <p className={styles.subtitle}>어떤 방식으로 만들까요?</p>
      </div>
      <div className={styles.tabBody}>
        <div className="select-card-list">
          <button type="button" className="select-card" onClick={() => router.push('/builder/chat')}>
            <div className="select-card-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 2C6.03 2 2 5.58 2 10c0 2.1.9 4 2.36 5.44L3.5 19.5l4.3-1.3A9.3 9.3 0 0 0 11 18.5c4.97 0 9-3.58 9-8s-4.03-8-9-8Z" />
                <path d="M8 10h.01M11 10h.01M14 10h.01" />
              </svg>
            </div>
            <div className="select-card-body">
              <p className="select-card-title">AI 빌더로 만들기</p>
              <p className="select-card-desc">
                AI와 대화하며 캐릭터를 만들어보세요.
                <br />
                질문에 답하다 보면 캐릭터가 완성됩니다.
              </p>
            </div>
            <span className="select-card-arrow">›</span>
          </button>

          <button type="button" className="select-card" onClick={() => router.push('/builder/manual')}>
            <div className="select-card-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h14M4 10h10M4 14h7" />
                <path d="M17 14l2 2-4 4-2-2" />
              </svg>
            </div>
            <div className="select-card-body">
              <p className="select-card-title">직접 만들기</p>
              <p className="select-card-desc">캐릭터 설정을 직접 입력해서 만들 수 있습니다.</p>
            </div>
            <span className="select-card-arrow">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
