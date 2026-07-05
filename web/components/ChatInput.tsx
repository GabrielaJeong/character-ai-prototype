'use client';

import { useEffect, useRef } from 'react';
import styles from './ChatInput.module.css';

/**
 * 채팅·빌더 공통 입력 컴포넌트.
 *
 * 원본: public/js/app.js L128~150 `createChatInput`.
 *
 * 동작:
 *   - textarea + 보내기 버튼
 *   - Enter → 전송, Shift+Enter → 줄바꿈
 *   - 입력 변경 시 자동 height (max 100px)
 *   - 외부에서 disabled / 보내는 중 표시 가능
 *   - 모바일 iOS 자동 zoom 방지 (font-size 16px)
 */
interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = '메시지를 입력하세요...',
  autoFocus = false,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // value 변경 시 height 재계산
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  }, [value]);

  // 외부 disabled가 풀리면 다시 포커스
  useEffect(() => {
    if (!disabled && autoFocus) taRef.current?.focus();
  }, [disabled, autoFocus]);

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.wrap}>
      <textarea
        ref={taRef}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button
        type="button"
        className={styles.sendBtn}
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="전송"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
