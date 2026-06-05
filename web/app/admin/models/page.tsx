'use client';

import { useEffect, useState } from 'react';
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
 * 백엔드: GET /api/admin/models, PUT /api/admin/models/:id (id 화이트리스트 검증).
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
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // 데이터 로드 시 draft 시드 (이미 편집 중인 건 보존)
  useEffect(() => {
    if (!data.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const m of data) if (next[m.id] === undefined) next[m.id] = m.content;
      return next;
    });
  }, [data]);

  const onSave = async (m: AdminModelPrompt) => {
    setSaving(m.id);
    try {
      await api.put(`/api/admin/models/${m.id}`, { content: drafts[m.id] ?? '' });
      await mutate();
      showToast(`${m.label} 프롬프트 저장됨`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '저장 실패');
    } finally {
      setSaving(null);
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

      {data.map((m) => {
        const draft = drafts[m.id] ?? '';
        const dirty = draft !== m.content;
        return (
          <div key={m.id} className={`${shell.card} ${shell.cardPad}`} style={{ marginBottom: 16 }}>
            <div className={styles.cardHead}>
              <span className={styles.modelLabel}>{m.label}</span>
              <span className={`${shell.badge} ${m.provider === 'gemini' ? shell.badgeUser : shell.badgePrebuilt}`}>
                {m.provider === 'gemini' ? 'Google' : 'Anthropic'}
              </span>
              <span className={`${styles.fileTag} ${m.hasFile ? styles.fileTagOn : ''}`}>
                {m.hasFile ? '파일 있음' : '파일 없음'}
              </span>
              <code className={styles.modelId}>{m.id}.md</code>
              {dirty && <span className={styles.dirty}>● 수정됨</span>}
            </div>
            <textarea
              className={`${shell.textarea} ${shell.textareaCode}`}
              value={draft}
              onChange={(e) => setDrafts((p) => ({ ...p, [m.id]: e.target.value }))}
              placeholder={TEMPLATE}
              spellCheck={false}
            />
            <div className={shell.actionRow}>
              <button className={`${shell.btn} ${shell.btnPrimary}`} onClick={() => onSave(m)} disabled={saving === m.id || !dirty}>
                {saving === m.id ? '저장 중...' : '저장'}
              </button>
              {!m.hasFile && (
                <button
                  className={`${shell.btn} ${shell.btnGhost}`}
                  onClick={() => setDrafts((p) => ({ ...p, [m.id]: TEMPLATE.replace('<모델명>', m.label) }))}
                >
                  템플릿 채우기
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
