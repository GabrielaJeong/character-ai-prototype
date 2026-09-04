'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useIsEmbedded, topLevelUrl } from '@/lib/useIsEmbedded';
import styles from './Modal.module.css';

/**
 * 비로그인 유저가 인증 필요 기능 접근 시 표시되는 모달.
 *
 * 호출:
 *   showAuthGate({
 *     title: '마이페이지',
 *     desc: '마이페이지를 이용하려면 로그인이 필요합니다.',
 *     intendedPath: '/mypage',
 *   })
 *
 * L-011 패턴:
 *   - "로그인하기" 클릭 시 replaceState로 /login?redirect=... 로 교체
 *   - 현재 URL이 history에 누적되지 않도록
 *   - 호출자(라우트 핸들러)도 게이트 표시 전에 현재 URL을 / 로 replaceState 해야 안전
 *
 * 데모 모드:
 *   - DEMO_MODE env 활성 시 "체험하기" 버튼 노출
 */
export function AuthGate() {
  const router        = useRouter();
  const gate          = useUIStore((s) => s.authGate);
  const close         = useUIStore((s) => s.closeAuthGate);
  const showToast     = useUIStore((s) => s.showToast);
  const demoAvailable = useAuthStore((s) => s.demoAvailable);
  const demoLogin     = useAuthStore((s) => s.demoLogin);
  const embedded      = useIsEmbedded();

  if (!gate) return null;

  const goToLogin = () => {
    const intended = gate.intendedPath || '/';
    close();
    // L-011: pushState 대신 replaceState 사용해야 history 누적 안 됨
    router.replace(`/login?redirect=${encodeURIComponent(intended)}`);
  };

  const handleDemo = async () => {
    try {
      await demoLogin();
      const dest = gate.intendedPath || '/';
      close();
      router.replace(dest);
    } catch {
      showToast('체험 로그인에 실패했습니다.');
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={styles.panel}>
        <p className={styles.title}>{gate.title}</p>
        {embedded ? (
          <>
            {/* iframe 안에서는 세션 쿠키가 차단되어 로그인 자체가 성립하지 않는다.
                시도하게 두면 성공한 것처럼 보이다 이후 요청이 전부 401 이 되므로,
                여기서는 로그인·체험 버튼을 아예 내리고 새 탭으로만 유도한다. */}
            <p className={styles.desc}>
              이 기능은 새 탭에서 이용할 수 있어요. 지금 화면은 미리보기예요.
            </p>
            <div className={styles.actions}>
              <button className={styles.btnGhost} onClick={close}>닫기</button>
              <a
                className={styles.btnPrimary}
                href={topLevelUrl(gate.intendedPath || '/')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
              >
                새 탭에서 열기 →
              </a>
            </div>
          </>
        ) : (
          <>
            <p className={styles.desc}>{gate.desc}</p>
            <div className={styles.actions}>
              <button className={styles.btnGhost} onClick={close}>닫기</button>
              <button className={styles.btnPrimary} onClick={goToLogin}>로그인하기</button>
            </div>
            {demoAvailable && (
              <button className={styles.demoBtn} onClick={handleDemo}>
                로그인 없이 체험하기 →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
