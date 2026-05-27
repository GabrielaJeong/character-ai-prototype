import styles from './Splash.module.css';

const KEY = 'folio-splash-shown';

/**
 * 스플래시.
 *
 * 설계 결정 (Day 3.x ML-009 최종):
 *   - **Server Component**. React state 사용 안 함 → hydration 타이밍 무관.
 *   - SSR HTML에 splash 요소 + dismiss 스크립트를 같이 박음
 *   - critical positioning은 inline style — CSS Module 로드 시점 무관하게 첫 페인트부터 가림
 *   - dismiss는 vanilla JS로 element.remove() — React가 트리에서 관리 안 하므로 removeChild 충돌 없음
 *
 * 동작:
 *   - 첫 방문: 800ms 표시 → opacity 0 (0.4s transition) → DOM 제거 → sessionStorage 세팅
 *   - 재방문: 마운트되자마자 sessionStorage 확인 후 즉시 remove (1프레임만 깜빡, 그것도 inline display:none으로 차단)
 *
 * 원본 대응: index.html L11~12 `<div id="splash">` + app.js의 splash 제거 로직.
 */
export function Splash() {
  // dismiss 스크립트 — DOM 파싱과 동시에 즉시 실행되도록 splash 직후에 위치
  const dismissScript = `
    (function(){
      try {
        var el = document.getElementById('folio-splash');
        if (!el) return;
        if (sessionStorage.getItem('${KEY}')) {
          // returning user — 즉시 숨김 (1프레임도 안 보임)
          el.style.display = 'none';
          // DOM에서도 제거 (cleanup)
          requestAnimationFrame(function(){ if (el.parentNode) el.parentNode.removeChild(el); });
          return;
        }
        // first visit — 800ms 표시 후 fade out
        setTimeout(function(){
          el.style.transition = 'opacity 0.4s ease';
          el.style.opacity = '0';
          sessionStorage.setItem('${KEY}', '1');
          setTimeout(function(){
            if (el.parentNode) el.parentNode.removeChild(el);
          }, 400);
        }, 800);
      } catch(e){}
    })();
  `;

  return (
    <>
      <div
        id="folio-splash"
        className={styles.splash}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#0A0E17',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          pointerEvents: 'none',
        }}
      >
        <span className={styles.logo}>
          Foli
          <span className={styles.oWrap}>
            <span className={styles.dots}>
              <span className={`${styles.dot} ${styles.dot1}`} />
              <span className={`${styles.dot} ${styles.dot2}`} />
            </span>
            o
          </span>
        </span>
        <span className={styles.copy}>당신의 캐릭터와 대화하세요</span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: dismissScript }} />
    </>
  );
}
