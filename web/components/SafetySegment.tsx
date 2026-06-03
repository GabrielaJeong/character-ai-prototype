'use client';

import styles from './SafetySegment.module.css';
import type { Safety } from '@/lib/types';

/**
 * 전연령/성인 모드 세그먼트 토글. 캐릭터 인트로 floating nav에 사용.
 *
 * 원본: public/js/app.js createSafetySegment (L504~547) + mountSafetySegment (L553~570).
 *
 * 토글 가능 판정(호출자가 계산):
 *   - canToggle = char.safetyToggle !== false && !(rating === 'toggleable' && !adultEnabled)
 *   - 즉 toggleable인데 성인 인증 안 했으면 전연령 고정 / all은 토글 없음 / adult_only는 성인 고정
 *
 * 잠금 시 hint "모드를 변경할 수 없습니다" 표시.
 */
interface Props {
  value: Safety;
  canToggle: boolean;
  onChange: (v: Safety) => void;
}

export function SafetySegment({ value, canToggle, onChange }: Props) {
  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.segment} ${!canToggle ? styles.disabled : ''}`}
        data-safety={value}
      >
        <button
          type="button"
          className={`${styles.btn} ${value === 'on' ? styles.active : ''}`}
          onClick={() => canToggle && onChange('on')}
          disabled={!canToggle}
        >
          🔒 전연령
        </button>
        <button
          type="button"
          className={`${styles.btn} ${value === 'off' ? styles.active : ''}`}
          onClick={() => canToggle && onChange('off')}
          disabled={!canToggle}
        >
          🔞 성인
        </button>
      </div>
    </div>
  );
}
