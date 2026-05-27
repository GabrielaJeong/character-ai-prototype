'use client';

// useSearchParams 사용 → Suspense boundary 필요 (ML-004).

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCharacters } from '@/lib/hooks';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useChatPrepStore } from '@/store/chatPrep';
import { api, ApiError } from '@/lib/api';
import { resolveUser } from '@/lib/format';
import type { PersonaData } from '@/lib/types';
import styles from './page.module.css';

/**
 * `/persona/new` — 새 페르소나 작성 화면.
 *
 * 원본 app.js `_routePersonaNew` (L1267~1308) + `startChat` (L2231~2299).
 *
 * 모드:
 *   - **linked** (`?char=<id>`): 캐릭터와 연동. 제출 시 페르소나 저장 + /character/<id>/chat 이동.
 *   - **standalone** (param 없음): 마이페이지에서 페르소나만 새로 작성. 제출 시 저장 + /mypage 이동.
 *
 * linked 모드 동작:
 *   - 추천 페르소나 채우기 버튼 (캐릭터의 `recommendedPersona`가 있을 때)
 *   - 제출 시 텍스트 필드에 `{{user}}` placeholder를 페르소나 이름으로 치환 (resolveUser)
 *   - 페르소나 저장은 로그인 시에만 (비로그인은 chat prep만 set하고 진행)
 *
 * 미구현 (다음 단계):
 *   - 프로필 이미지 업로드 (원본 personaAvatarUpload). Phase A는 placeholder만.
 */
export default function PersonaNewPage() {
  return (
    <Suspense fallback={null}>
      <PersonaNewInner />
    </Suspense>
  );
}

function PersonaNewInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const charId = sp.get('char');
  const isLinked = !!charId;

  const user = useAuthStore((s) => s.user);
  const { characters } = useCharacters();
  const showToast = useUIStore((s) => s.showToast);
  const setAppReady = useUIStore((s) => s.setAppReady);
  const setPrep = useChatPrepStore((s) => s.setPrep);

  const char = isLinked ? characters.find((c) => c.id === charId) ?? null : null;

  // 폼 상태
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // 캐릭터 컨텍스트 있으나 캐릭터 로드 끝났는데 없음 → 홈으로 (URL 잘못)
  useEffect(() => {
    if (isLinked && characters.length > 0 && !char) {
      router.replace('/');
    }
  }, [isLinked, characters.length, char, router]);

  const fillRecommended = () => {
    const p = char?.recommendedPersona;
    if (!p) return;
    setName(p.name || '');
    setAge(p.age ? String(p.age) : '');
    setGender(p.gender ?? null);
    setAppearance(p.appearance || '');
    setPersonality(p.personality || '');
    setNotes(p.notes || '');
  };

  const onGender = (v: 'male' | 'female') => {
    setGender((cur) => (cur === v ? null : v));
  };

  const onBack = () => {
    if (isLinked && charId) router.push(`/character/${charId}`);
    else router.push('/mypage');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age) return;
    setSubmitting(true);

    const personaName = name.trim();
    const r = (t: string) => resolveUser(t.trim(), personaName);

    const data: PersonaData = {
      name: personaName,
      age: parseInt(age, 10),
      gender,
      appearance: r(appearance),
      personality: r(personality),
      notes: r(notes),
    };

    try {
      // 로그인 사용자만 백엔드에 저장
      if (user) {
        await api.post('/api/personas', { data });
      }

      if (isLinked && charId) {
        // 채팅 진입 prep
        setPrep({
          characterId: charId,
          persona: data,
          safety: char?.defaultSafety === 'off' ? 'off' : 'on',
        });
        router.push(`/character/${charId}/chat`);
      } else {
        showToast('페르소나가 저장되었습니다.');
        router.push('/mypage');
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 비로그인 + standalone 모드 → 로그인 필요
  const requiresLogin = !isLinked && !user;

  const navLabel = isLinked ? 'PERSONA SETUP' : '새 페르소나';
  const subtitleText = isLinked
    ? `${char?.name ?? '캐릭터'}이(가) 당신을 알 수 있도록 정보를 입력해주세요.`
    : '페르소나 정보를 입력해주세요.';
  const notesPlaceholder = isLinked
    ? `${char?.name ?? '캐릭터'}와(과)의 관계 등 특이사항을 입력해주세요`
    : '특이사항을 입력해주세요';
  const submitLabel = isLinked ? '대화 시작' : '저장하기';

  return (
    <div className="page-wrap">
      <div className="page-nav">
        <button type="button" className="btn-back" onClick={onBack} aria-label="뒤로">←</button>
        <span className="nav-label">{navLabel}</span>
      </div>
      <div className="page-body">
        <div className="content-header">
          <p className="content-header-title">당신은 누구인가요?</p>
          <p className="content-header-desc">{subtitleText}</p>
        </div>

        {isLinked && char?.recommendedPersona && (
          <button type="button" className="recommend-btn" onClick={fillRecommended}>
            ✦ 추천 페르소나 채우기
          </button>
        )}

        {requiresLogin && (
          <p className={styles.loginHint}>
            페르소나를 저장하려면 로그인이 필요합니다.
          </p>
        )}

        <form onSubmit={onSubmit} className={styles.form}>
          {/* TODO: 아바타 업로드 — Phase A에서 placeholder */}

          <div className="form-group">
            <label htmlFor="p-name">이름 <span className="required">*</span></label>
            <input
              id="p-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="{{user}}"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="p-age">나이 <span className="required">*</span></label>
            <input
              id="p-age"
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
            <label htmlFor="p-appearance">외형</label>
            <input
              id="p-appearance"
              type="text"
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              placeholder="외모나 스타일을 입력해주세요"
            />
          </div>

          <div className="form-group">
            <label htmlFor="p-personality">성격</label>
            <textarea
              id="p-personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="성격이나 말투를 입력해주세요"
              rows={2}
            />
          </div>

          <div className="form-group">
            <label htmlFor="p-notes">특이사항</label>
            <textarea
              id="p-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={notesPlaceholder}
              rows={2}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !name.trim() || !age}
            style={{ marginTop: 4 }}
          >
            {submitting ? '...' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
