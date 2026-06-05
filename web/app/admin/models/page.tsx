'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import type { AdminModelPrompt } from '@/lib/admin';
import shell from '../admin.module.css';
import styles from './page.module.css';

/**
 * 어드민 모델 관리 — `/admin/models`.
 *
 * 모델별 Layer 3 보정 프롬프트(`prompts/models/{id}.md`)를 편집. buildSystemPrompt가
 * charPrompt + guardrails + **이 내용** + safety + persona 순으로 주입(주입 로직 변경 없음).
 * 문체·분위기·이야기 진전도·깊이 등 모델별 지시를 자유 마크다운으로 작성.
 *
 * 좌측 모델 목록(provider 그룹·파일/수정 표시) + 우측 단일 에디터 — 스크롤로 찾을 필요 없음.
 */
const fetcher = (p: string) => api.get<AdminModelPrompt[]>(p);

const TEMPLATE = `## MODEL-SPECIFIC CORRECTIONS — <모델명>

### 문체 (Writing style)
-

### 분위기 (Mood / tone)
-

### 이야기 진전도 (Story progression)
-

### 깊이 (Depth / detail)
-
`;

export default function AdminModelsPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);
  const { data = [], mutate, isLoading } = useSWR('/api/admin/models', fetcher);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // draft 시드 + 최초 선택
  useEffect(() => {
    if (!data.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const m of data) if (next[m.id] === undefined) next[m.id] = m.content;
      return next;
    });
    setSelected((cur) => cur ?? data[0].id);
  }, [data]);

  const groups = useMemo(() => {
    const claude = data.filter((m) => m.provider === 'claude');
    const gemini = data.filter((m) => m.provider === 'gemini');
    return [
      { label: 'Anthropic', items: claude },
      { label: 'Google', items: gemini },
    ].filter((g) => g.items.length);
  }, [data]);

  const current = data.find((m) => m.id === selected) ?? null;
  const isDirty = (m: AdminModelPrompt) => (drafts[m.id] ?? '') !== m.content;

  const onSave = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/models/${current.id}`, { content: drafts[current.id] ?? '' });
      await mutate();
      showToast(`${current.label} 프롬프트 저장됨`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>모델 관리</h1>
        <span className={shell.pageSub}>Layer 3 · 모델별 보정 프롬프트</span>
      </div>

      <p className={styles.intro}>
        모델별 문체·분위기·이야기 진전도·깊이 등을 지정합니다. 저장 시 해당 모델로 대화할 때
        시스템 프롬프트에 자동 주입됩니다(캐릭터 프롬프트 → guardrails → <b>모델 보정</b> → safety → 페르소나).
      </p>

      {isLoading && <p className={shell.dim}>불러오는 중...</p>}

      {data.length > 0 && (
        <div className={styles.layout}>
          {/* 좌: 모델 목록 */}
          <aside className={styles.list}>
            {groups.map((g) => (
              <div key={g.label}>
                <div className={styles.groupLabel}>{g.label}</div>
                {g.items.map((m) => {
                  const dirty = isDirty(m);
                  return (
                    <button
                      key={m.id}
                      className={`${styles.item} ${m.id === selected ? styles.itemActive : ''}`}
                      onClick={() => setSelected(m.id)}
                    >
                      {m.label}
                      <span
                        className={`${styles.itemDot} ${dirty ? styles.dotDirty : m.hasFile ? styles.dotFile : ''}`}
                        title={dirty ? '저장 안 됨' : m.hasFile ? '파일 있음' : '파일 없음'}
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* 우: 에디터 */}
          <div className={styles.editor}>
            {current && (
              <div className={`${shell.card} ${shell.cardPad}`}>
                <div className={styles.cardHead}>
                  <span className={styles.modelLabel}>{current.label}</span>
                  <span className={`${shell.badge} ${current.provider === 'gemini' ? shell.badgeUser : shell.badgePrebuilt}`}>
                    {current.provider === 'gemini' ? 'Google' : 'Anthropic'}
                  </span>
                  <span className={`${styles.fileTag} ${current.hasFile ? styles.fileTagOn : ''}`}>
                    {current.hasFile ? '파일 있음' : '파일 없음'}
                  </span>
                  <code className={styles.modelId}>{current.id}.md</code>
                  {isDirty(current) && <span className={styles.dirty}>● 수정됨</span>}
                </div>
                <textarea
                  className={`${shell.textarea} ${shell.textareaCode}`}
                  value={drafts[current.id] ?? ''}
                  onChange={(e) => setDrafts((p) => ({ ...p, [current.id]: e.target.value }))}
                  placeholder={TEMPLATE}
                  spellCheck={false}
                  style={{ minHeight: 360 }}
                />
                <div className={shell.actionRow}>
                  <button className={`${shell.btn} ${shell.btnPrimary}`} onClick={onSave} disabled={saving || !isDirty(current)}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  {!current.hasFile && (drafts[current.id] ?? '') === '' && (
                    <button
                      className={`${shell.btn} ${shell.btnGhost}`}
                      onClick={() => setDrafts((p) => ({ ...p, [current.id]: TEMPLATE.replace('<모델명>', current.label) }))}
                    >
                      템플릿 채우기
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
