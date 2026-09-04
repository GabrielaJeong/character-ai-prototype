'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useIsEmbedded, topLevelUrl } from '@/lib/useIsEmbedded';
import styles from './DemoCta.module.css';

/**
 * 홈 상단 체험 진입점.
 *
 * 기존에는 "로그인 없이 체험하기"가 AuthGate 모달 안에만 있었다(원본과 동일).
 * 그러면 채팅을 시도해 로그인 벽에 부딪혀야 발견되는데, 포트폴리오로 처음
 * 들어온 사람에게는 그 경로가 너무 늦다. 랜딩에 같은 동작을 노출한다.
 *
 * 노출 조건: DEMO_MODE 활성(demoAvailable) && 비로그인.
 * ready 전에는 렌더하지 않는다 — 로그인 상태 확인 전 깜빡임 방지.
 */
export function DemoCta() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const demoAvailable = useAuthStore((s) => s.demoAvailable);
  const demoLogin = useAuthStore((s) => s.demoLogin);
  const showToast = useUIStore((s) => s.showToast);
  const embedded = useIsEmbedded();
  const [busy, setBusy] = useState(false);

  if (!ready || user || !demoAvailable) return null;

  // iframe 안에서는 세션 쿠키가 차단되어 체험 로그인이 성립하지 않는다.
  // 성공한 것처럼 보이다 이후 요청이 401 이 되므로, 시도시키지 않고 새 탭으로 보낸다.
  if (embedded) {
    return (
      <div className={styles.cta}>
        <div className={styles.copy}>
          <span className={styles.title}>지금 화면은 미리보기예요</span>
          <span className={styles.desc}>새 탭에서 열면 가입 없이 채팅까지 체험할 수 있어요</span>
        </div>
        <a
          className={styles.btn}
          href={topLevelUrl('/')}
          target="_blank"
          rel="noopener noreferrer"
        >
          새 탭에서 열기 →
        </a>
      </div>
    );
  }

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await demoLogin();
      showToast('체험 모드로 시작했어요.');
    } catch {
      showToast('체험 로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.cta}>
      <div className={styles.copy}>
        <span className={styles.title}>가입 없이 둘러보세요</span>
        <span className={styles.desc}>체험 계정으로 채팅까지 바로 이용할 수 있어요</span>
      </div>
      <button className={styles.btn} onClick={start} aria-busy={busy}>
        {busy ? '시작하는 중...' : '체험 시작 →'}
      </button>
    </div>
  );
}
