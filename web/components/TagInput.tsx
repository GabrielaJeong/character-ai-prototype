'use client';

import { useRef } from 'react';

/**
 * 태그 입력 (칩 + 텍스트 입력 + 추천 버튼). 제어 컴포넌트.
 *
 * 원본: public/js/app.js L2710~2812 (_initTagInput / _addBuilderTag / renderManualTags 등).
 * 스타일은 forms.css의 글로벌 .tag-input-wrap / .tag-chip / .tag-suggest-* 사용.
 *
 * 규칙: 중복 불가, 앞의 # 제거, 최대 8개.
 */
interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

const MAX_TAGS = 8;

export function TagInput({ tags, onChange, suggestions = [], placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '');
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return;
    onChange([...tags, tag]);
  };

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && input.value === '' && tags.length) {
      removeTag(tags.length - 1);
    }
  };

  const onInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.value.includes(',')) {
      input.value.split(',').forEach((t) => addTag(t));
      input.value = '';
    }
  };

  return (
    <>
      <div className="tag-input-wrap" onClick={() => inputRef.current?.focus()}>
        <div className="tag-chips">
          {tags.map((t, i) => (
            <span key={t} className="tag-chip">
              #{t}
              <button
                type="button"
                className="tag-chip-x"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(i);
                }}
                aria-label={`${t} 제거`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="tag-text-input"
          placeholder={placeholder ?? '태그 입력 후 Enter 또는 ,'}
          maxLength={12}
          onKeyDown={onKeyDown}
          onInput={onInput}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="tag-suggestions">
          <span className="tag-suggest-label">추천</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="tag-suggest-btn"
              onClick={() => {
                addTag(s);
                inputRef.current?.focus();
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
