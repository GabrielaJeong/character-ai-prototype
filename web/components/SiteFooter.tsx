'use client';

import { useAppVersion } from '@/lib/hooks';
import styles from './SiteFooter.module.css';

/**
 * 사이트 푸터 — 원본 index.html L96~125 `.site-footer`.
 *
 * 표시:
 *   - 브랜드: `Folio.` + 빌드 (`Folio · vX.Y · Build 2026.04`)
 *   - 태그라인: "모두의 폴리오, 모두의 책장"
 *   - 두 컬럼 (LEGAL / SUPPORT) + legal 영역
 *
 * 버전:
 *   - `useAppVersion()` (`/api/version`) — Express가 CHANGELOG의 last-version을 읽어 반환.
 *   - 빌드 라벨 "2026.04"는 원본 app.js L3290과 동일하게 하드코딩 (월간 빌드 표시).
 */
export function SiteFooter() {
  const version = useAppVersion();
  return (
    <footer className={styles.footer}>
      <div className={styles.brand}>
        <span className={styles.logo}>Folio.</span>
        <span className={styles.build}>Folio · {version} · Build 2026.04</span>
      </div>
      <p className={styles.tagline}>모두의 폴리오, 모두의 책장</p>
      <div className={styles.cols}>
        <div className={styles.col}>
          <span className={styles.colTitle}>LEGAL</span>
          <ul className={styles.links}>
            <li><a href="#">이용약관</a></li>
            <li><a href="#">개인정보처리방침</a></li>
            <li><a href="#">커뮤니티 가이드</a></li>
            <li><a href="#">청소년 보호정책</a></li>
          </ul>
        </div>
        <div className={styles.col}>
          <span className={styles.colTitle}>SUPPORT</span>
          <ul className={styles.links}>
            <li><a href="#">도움말</a></li>
            <li><a href="#">신고하기</a></li>
            <li><a href="#">피드백</a></li>
            <li><a href="#">서비스 상태</a></li>
          </ul>
        </div>
      </div>
      <div className={styles.legal}>
        <p>© 2026 Folio Studio · 서울특별시 동작구 보라매로7가길</p>
        <p>사업자등록번호 123-45-67890 · 대표 정소채 · 통신판매업신고 제 2025-서울동작-0000호</p>
      </div>
    </footer>
  );
}
