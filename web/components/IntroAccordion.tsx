'use client';

import { useState } from 'react';
import styles from './IntroAccordion.module.css';

/**
 * 펼칠 수 있는 아코디언 (캐릭터 인트로의 세계관 등에 사용).
 *
 * 원본: public/css/style.css .wb-accordion / .wb-toggle / .wb-body / .wb-content (L1206~1263)
 *       + app.js toggleWorldbuilding()
 */
interface Props {
  title: string;
  children: React.ReactNode;
}

export function IntroAccordion({ title, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.accordion}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.title}>{title}</span>
        <span className={styles.caret}>›</span>
      </button>
      {open && <div className={styles.body}><div className={styles.content}>{children}</div></div>}
    </div>
  );
}
