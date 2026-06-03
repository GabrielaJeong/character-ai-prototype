'use client';

import { useRef } from 'react';
import styles from './AvatarUpload.module.css';

/**
 * 프로필 이미지 업로드 위젯 (제어 컴포넌트).
 *
 * 원본: public/js/app.js L30~125 `createAvatarUpload`.
 *
 * 동작:
 *   - 원형 트리거 클릭 → 파일 선택 → FileReader로 dataURL 변환 → onChange(url)
 *   - 이미지 있으면 미리보기 + "이미지 제거" 버튼
 *   - value(dataURL|null)는 부모가 관리 (빌더 store 또는 폼 로컬 state)
 */
interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
}

export function AvatarUpload({ value, onChange, hint = '1장 업로드 가능' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      if (typeof url === 'string') onChange(url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.avatar}
        onClick={() => fileRef.current?.click()}
        aria-label="프로필 이미지 업로드"
      >
        {value ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={value} className={styles.img} alt="프로필" />
        ) : (
          <span className={styles.plus}>+</span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      <div>
        <p className={styles.hint}>{hint}</p>
        {value && (
          <button type="button" className={styles.remove} onClick={() => onChange(null)}>
            이미지 제거
          </button>
        )}
      </div>
    </div>
  );
}
