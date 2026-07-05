'use client';

import { useEffect, useRef, useState } from 'react';
import { MODELS, findModel } from '@/lib/models';
import styles from './ModelPicker.module.css';

/**
 * 모델 선택 popover.
 *
 * 원본 app.js L2097~2127 `toggleModelPicker / selectModel / setModelUI`.
 *
 * 동작:
 *   - 트리거 버튼 위에 fixed positioning으로 띄움
 *   - claude / gemini 그룹 사이에 divider
 *   - 선택 시 onChange + close
 *   - 외부 클릭 시 close
 */
interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const current = findModel(value) ?? MODELS[0];

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPos({ bottom: window.innerHeight - rect.top + 20, left: rect.left });
    setOpen(true);
  };

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const onSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={toggle}
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <span className={styles.caret}>⌃</span>
      </button>

      {open && pos && (
        <div
          ref={pickerRef}
          className={styles.picker}
          style={{ bottom: pos.bottom, left: pos.left }}
          role="menu"
        >
          {MODELS.map((m, i) => {
            const prev = i > 0 ? MODELS[i - 1] : null;
            const showDivider = prev && prev.provider !== m.provider;
            const active = m.id === value;
            return (
              <div key={m.id}>
                {showDivider && <div className={styles.divider} />}
                <div
                  className={`${styles.option} ${active ? styles.optionActive : ''}`}
                  onClick={() => onSelect(m.id)}
                  role="menuitemradio"
                  aria-checked={active}
                >
                  <div className={styles.optionLeft}>
                    <span className={styles.optionName}>
                      {m.label}
                      <span className={`${styles.providerBadge} ${styles[`provider_${m.provider}`]}`}>
                        {m.provider === 'gemini' ? 'Google' : 'Anthropic'}
                      </span>
                    </span>
                    <span className={styles.optionDesc}>{m.desc}</span>
                  </div>
                  <span className={styles.optionCheck}>✓</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
