'use client';

import styles from './BuilderLoading.module.css';

/**
 * 캐릭터 생성 중 로딩 화면 (전체 화면 오버레이).
 *
 * 원본: index.html #screen-builder-loading + style.css L3103~3157.
 * 진행 바는 부모가 progress(0~100)로 제어 — 원본의 setInterval 애니메이션 대응.
 */
export function BuilderLoading({ progress }: { progress: number }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.wrap}>
        <div className={styles.icon}>✦</div>
        <p className={styles.title}>캐릭터를 만드는 중...</p>
        <p className={styles.desc}>AI가 시스템 프롬프트를 작성하고 있습니다</p>
        <div className={styles.progress}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
