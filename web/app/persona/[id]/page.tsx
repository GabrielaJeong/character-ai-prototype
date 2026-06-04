'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePersonas } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { api, ApiError } from '@/lib/api';
import type { PersonaData } from '@/lib/types';
import { AvatarUpload } from '@/components/AvatarUpload';
import styles from './page.module.css';

/**
 * 페르소나 상세/편집 — `/persona/[id]` (마이페이지에서 진입).
 *
 * 원본: index.html #screen-persona-detail (L992~1011) + app.js `_routePersonaDetail`/`onPdImgSelected`.
 * 원본 detail은 읽기전용 + 아바타 업로드 + 기본설정/삭제였으나, web mypage는 '편집' 버튼이 분리돼 있어
 * **전체 필드 영구 편집**으로 확장 (PATCH /api/personas/:id, 백엔드가 full data 교체 지원).
 *
 * 정적 세그먼트(new/select)가 우선이라 `/persona/new`·`/persona/select`와 충돌 없음.
 */
export default function PersonaEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const personaId = Number(params.id);
  const { user, ready } = useRequireAuth(`/persona/${params.id}`, {
    title: '페르소나',
    desc: '페르소나를 보려면 로그인이 필요합니다.',
  });
  const { personas, isLoading, mutate } = usePersonas();
  const showToast = useUIStore((s) => s.showToast);
  const showDeleteConfirm = useUIStore((s) => s.showDeleteConfirm);
  const setAppReady = useUIStore((s) => s.setAppReady);

  const persona = personas.find((p) => p.id === personaId) ?? null;
  const isDefault = !!user && user.default_persona_id === personaId;

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [notes, setNotes] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // prefill (최초 1회)
  useEffect(() => {
    if (filled || isLoading || !persona) return;
    const d = persona.data;
    setName(d.name || '');
    setAge(d.age ? String(d.age) : '');
    setGender(d.gender ?? null);
    setAppearance(d.appearance || '');
    setPersonality(d.personality || '');
    setNotes(d.notes || '');
    setAvatar(d.avatar ?? null);
    setFilled(true);
  }, [filled, isLoading, persona]);

  // 로딩 끝났는데 페르소나 없음(잘못된 id) → 마이페이지 (원본 _routePersonaDetail 동작)
  useEffect(() => {
    if (ready && user && !isLoading && !persona) router.replace('/mypage');
  }, [ready, user, isLoading, persona, router]);

  if (!ready || !user || isLoading || !persona) {
    return <div className="page-wrap" />;
  }

  const onGender = (v: 'male' | 'female') => setGender((cur) => (cur === v ? null : v));

  const buildData = (): PersonaData => ({
    name: name.trim(),
    age: age ? parseInt(age, 10) : undefined,
    gender,
    appearance: appearance.trim(),
    personality: personality.trim(),
    notes: notes.trim(),
    ...(avatar ? { avatar } : {}),
  });

  const onSave = async () => {
    if (!name.trim()) return showToast('이름을 입력해주세요.');
    setSaving(true);
    try {
      await api.patch(`/api/personas/${personaId}`, { data: buildData() });
      await mutate();
      showToast('페르소나가 수정되었습니다.');
      router.push('/mypage');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const onSetDefault = async () => {
    try {
      await api.patch(`/api/personas/${personaId}/set-default`);
      useAuthStore.getState().setUser({ ...user, default_persona_id: personaId });
      showToast('기본 페르소나로 설정되었습니다.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '실패했습니다.');
    }
  };

  const onClearDefault = async () => {
    try {
      await api.delete('/api/personas/default');
      useAuthStore.getState().setUser({ ...user, default_persona_id: null });
      showToast('기본 페르소나가 해제되었습니다.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '실패했습니다.');
    }
  };

  const onDelete = () => {
    showDeleteConfirm({
      title: `"${name.trim() || '이름 없음'}" 페르소나를 삭제하시겠습니까?`,
      desc: '삭제된 페르소나는 복구할 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await api.delete(`/api/personas/${personaId}`);
          if (isDefault) {
            useAuthStore.getState().setUser({ ...user, default_persona_id: null });
          }
          await mutate();
          showToast('페르소나가 삭제되었습니다.');
          router.push('/mypage');
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : '삭제에 실패했습니다.');
        }
      },
    });
  };

  return (
    <div className="page-wrap">
      <div className="page-nav">
        <button type="button" className="btn-back" onClick={() => router.push('/mypage')} aria-label="뒤로">
          ←
        </button>
        <span className="nav-label">페르소나</span>
      </div>

      <div className="page-body">
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label>프로필 이미지</label>
            <AvatarUpload value={avatar} onChange={setAvatar} />
          </div>
          <div className="form-group">
            <label htmlFor="pd-name">이름 <span className="required">*</span></label>
            <input id="pd-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="{{user}}" />
          </div>
          <div className="form-group">
            <label htmlFor="pd-age">나이</label>
            <input id="pd-age" type="number" min={1} max={99} value={age} onChange={(e) => setAge(e.target.value)} placeholder="29" />
          </div>
          <div className="form-group">
            <label>성별</label>
            <div className="gender-btn-group">
              <button type="button" className={`gender-btn ${gender === 'male' ? 'active' : ''}`} onClick={() => onGender('male')} aria-pressed={gender === 'male'}>
                남
              </button>
              <button type="button" className={`gender-btn ${gender === 'female' ? 'active' : ''}`} onClick={() => onGender('female')} aria-pressed={gender === 'female'}>
                여
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="pd-appearance">외형</label>
            <input id="pd-appearance" type="text" value={appearance} onChange={(e) => setAppearance(e.target.value)} placeholder="키가 크고 무표정한 인상" />
          </div>
          <div className="form-group">
            <label htmlFor="pd-personality">성격</label>
            <textarea id="pd-personality" value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="무뚝뚝하고 말이 없는 편" rows={2} />
          </div>
          <div className="form-group">
            <label htmlFor="pd-notes">특이사항</label>
            <textarea id="pd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <button type="button" className="btn-primary" onClick={onSave} disabled={saving || !name.trim()} style={{ marginTop: 4 }}>
            저장
          </button>

          {/* 기본 설정 / 해제 + 삭제 */}
          <div className={styles.actions}>
            {!isDefault ? (
              <button type="button" className="btn-ghost" onClick={onSetDefault}>
                기본 페르소나로 설정
              </button>
            ) : (
              <>
                <p className={styles.defaultLabel}>✓ 현재 기본 페르소나</p>
                <button type="button" className={styles.deleteLink} style={{ color: 'var(--text-dim)' }} onClick={onClearDefault}>
                  기본 해제
                </button>
              </>
            )}
            <button type="button" className={styles.deleteLink} onClick={onDelete}>
              페르소나 삭제
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
