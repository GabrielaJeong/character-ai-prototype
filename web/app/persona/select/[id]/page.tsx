'use client';

// useSearchParams 사용 → Suspense boundary 필요 (ML-004).

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams, notFound } from 'next/navigation';
import { useCharacters, usePersonas } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useChatPrepStore } from '@/store/chatPrep';
import { resolveUser } from '@/lib/format';
import type { PersonaData } from '@/lib/types';
import styles from './page.module.css';

/**
 * `/persona/select/[id]?char=<charId>` — 선택한 페르소나를 채팅 전 한 번 검토/수정.
 *
 * 원본 app.js `_routePersonaSelectEdit` (L1360~1379) + `startChatFromSelected` (L1388~1411).
 *
 * 동작:
 *   - 페르소나 id 받아 form prefill (이름·나이·성별·외형·성격·특이사항)
 *   - 제출 시: 변경된 값으로 chat prep 세팅, `{{user}}` 치환, /character/<charId>/chat 이동
 *   - 백엔드 PATCH는 호출 안 함 — 일회성 수정만 (원본 동작과 동일)
 */
export default function PersonaSelectEditPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <PersonaSelectEditInner params={params} />
    </Suspense>
  );
}

function PersonaSelectEditInner({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const charId = sp.get('char');
  const intendedPath = charId
    ? `/persona/select/${params.id}?char=${encodeURIComponent(charId)}`
    : `/persona/select/${params.id}`;
  const { user, ready } = useRequireAuth(intendedPath, {
    title: '페르소나 편집',
    desc: '페르소나를 사용하려면 로그인이 필요합니다.',
  });
  const { personas, isLoading } = usePersonas();
  const { characters } = useCharacters();
  const showToast = useUIStore((s) => s.showToast);
  const setAppReady = useUIStore((s) => s.setAppReady);
  const setPrep = useChatPrepStore((s) => s.setPrep);

  const personaId = Number(params.id);
  const persona = personas.find((p) => p.id === personaId) ?? null;
  const char = charId ? characters.find((c) => c.id === charId) ?? null : null;

  // 폼 상태
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [notes, setNotes] = useState('');
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // 캐릭터 컨텍스트 없으면 홈으로 (비로그인은 useRequireAuth가 처리)
  useEffect(() => {
    if (!ready || !user) return;
    if (!charId) router.replace('/');
  }, [ready, user, charId, router]);

  // 페르소나 prefill
  useEffect(() => {
    if (filled || isLoading) return;
    if (!persona) return;
    const d = persona.data;
    setName(d.name || '');
    setAge(d.age ? String(d.age) : '');
    setGender(d.gender ?? null);
    setAppearance(d.appearance || '');
    setPersonality(d.personality || '');
    setNotes(d.notes || '');
    setFilled(true);
  }, [filled, isLoading, persona]);

  // 로딩 끝났는데 페르소나 없음 → /persona/select로 (잘못된 id)
  if (!isLoading && personas.length > 0 && !persona) {
    notFound();
  }

  if (!ready || !user || !charId || isLoading || !persona) {
    return null;
  }

  const onGender = (v: 'male' | 'female') => {
    setGender((cur) => (cur === v ? null : v));
  };

  const onBack = () =>
    router.push(`/persona/select?char=${encodeURIComponent(charId)}`);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age) return;
    if (!char) {
      showToast('캐릭터를 불러올 수 없습니다.');
      return;
    }
    const personaName = name.trim();
    const r = (t: string) => resolveUser(t.trim(), personaName);

    const data: PersonaData = {
      name: personaName,
      age: parseInt(age, 10),
      gender,
      appearance: r(appearance),
      personality: r(personality),
      notes: r(notes),
      // avatar는 원본 그대로 (편집 화면에서 안 바꿈)
      ...(persona.data.avatar ? { avatar: persona.data.avatar } : {}),
    };

    setPrep({
      characterId: charId,
      persona: data,
      safety: char.defaultSafety === 'off' ? 'off' : 'on',
    });
    router.push(`/character/${charId}/chat`);
  };

  return (
    <div className="page-wrap">
      <div className="page-nav">
        <button type="button" className="btn-back" onClick={onBack} aria-label="뒤로">←</button>
        <span className="nav-label">페르소나 확인</span>
      </div>
      <div className="page-body">
        <div className="content-header">
          <p className="content-header-title">페르소나 정보</p>
          <p className="content-header-desc">내용을 수정한 뒤 대화를 시작할 수 있습니다.</p>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className="form-group">
            <label htmlFor="pse-name">이름 <span className="required">*</span></label>
            <input
              id="pse-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="{{user}}"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="pse-age">나이 <span className="required">*</span></label>
            <input
              id="pse-age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="29"
              min={1}
              max={99}
              required
            />
          </div>
          <div className="form-group">
            <label>성별</label>
            <div className="gender-btn-group">
              <button
                type="button"
                className={`gender-btn ${gender === 'male' ? 'active' : ''}`}
                onClick={() => onGender('male')}
                aria-pressed={gender === 'male'}
              >
                남
              </button>
              <button
                type="button"
                className={`gender-btn ${gender === 'female' ? 'active' : ''}`}
                onClick={() => onGender('female')}
                aria-pressed={gender === 'female'}
              >
                여
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="pse-appearance">외형</label>
            <input
              id="pse-appearance"
              type="text"
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              placeholder="키가 크고 무표정한 인상"
            />
          </div>
          <div className="form-group">
            <label htmlFor="pse-personality">성격</label>
            <textarea
              id="pse-personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="무뚝뚝하고 말이 없는 편"
              rows={2}
            />
          </div>
          <div className="form-group">
            <label htmlFor="pse-notes">특이사항</label>
            <textarea
              id="pse-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={!name.trim() || !age}
            style={{ marginTop: 4 }}
          >
            캐릭터와 대화하기
          </button>
        </form>
      </div>
    </div>
  );
}
