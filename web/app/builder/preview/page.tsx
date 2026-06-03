'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useCharacters } from '@/lib/hooks';
import { useBuilderStore } from '@/store/builder';
import { api, ApiError } from '@/lib/api';
import type { BuilderCharData, BuilderRating } from '@/lib/types';
import { AvatarUpload } from '@/components/AvatarUpload';
import { TagInput } from '@/components/TagInput';
import { BuilderLoading } from '@/components/BuilderLoading';
import styles from './page.module.css';

/**
 * AI 빌더 캐릭터 검토/편집 — `/builder/preview`
 *
 * 원본: index.html L684~777 (#screen-builder-edit) + app.js L3100~3193.
 * 빌더 store의 charData/systemMd를 폼에 시드 → 수정 후 등록 또는 프롬프트 재생성.
 * store가 비어있으면(reload 등) /builder로 리다이렉트.
 */
const SUGGESTIONS = [
  '현실', '판타지', '초자연', '로맨스', '액션', '일상',
  '다정', '차가운', '다혈질', '과묵', '밝은', '어두운',
];

const RATINGS: { value: BuilderRating; label: string }[] = [
  { value: 'all_ages', label: '전연령' },
  { value: 'toggleable', label: '전연령 / 성인 전환' },
  { value: 'adult_only', label: '성인 전용' },
];

export default function BuilderPreviewPage() {
  const router = useRouter();
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);
  const { mutate: mutateCharacters } = useCharacters();
  const { user, ready } = useRequireAuth('/builder/preview', {
    title: '캐릭터 제작',
    desc: '캐릭터를 제작하려면 로그인이 필요합니다.',
  });

  const charData = useBuilderStore((s) => s.charData);
  const systemMd = useBuilderStore((s) => s.systemMd);
  const setCharData = useBuilderStore((s) => s.setCharData);
  const setSystemMd = useBuilderStore((s) => s.setSystemMd);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [occupation, setOccupation] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [speechStyle, setSpeechStyle] = useState('');
  const [speechExamples, setSpeechExamples] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [rating, setRating] = useState<BuilderRating>('all_ages');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const seededRef = useRef(false);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // store 비어있으면 빌더 선택으로 (reload 안전장치)
  useEffect(() => {
    if (ready && user && !charData) router.replace('/builder');
  }, [ready, user, charData, router]);

  // charData/systemMd → 폼 시드 (최초 1회)
  useEffect(() => {
    if (seededRef.current || !charData) return;
    seededRef.current = true;
    const d = charData;
    setName(d.name || '');
    setAge(d.age != null ? String(d.age) : '');
    setOccupation(d.occupation || '');
    setSubtitle(d.subtitle || '');
    setAppearance(d.appearance || '');
    setPersonality(d.personality || '');
    setSpeechStyle(d.speechStyle || '');
    setSpeechExamples(Array.isArray(d.speechExamples) ? d.speechExamples.join('\n') : '');
    setTags(Array.isArray(d.tags) ? [...d.tags] : []);
    setRating(d.rating || (d.hasProfanity ? 'adult_only' : 'all_ages'));
    setSystemPrompt(systemMd || '');
  }, [charData, systemMd]);

  const collectData = (): BuilderCharData => ({
    ...(charData || {}),
    name: name.trim(),
    age: age ? Number(age) : charData?.age,
    occupation: occupation.trim(),
    subtitle: subtitle.trim(),
    appearance: appearance.trim(),
    personality: personality.trim(),
    speechStyle: speechStyle.trim(),
    speechExamples: speechExamples.split('\n').map((l) => l.trim()).filter(Boolean),
    rating,
    hasProfanity: rating === 'adult_only',
    tags: [...tags],
  });

  const onRegister = async () => {
    if (!name.trim()) return showToast('이름을 입력해주세요.');

    try {
      await api.post('/api/characters/create', {
        characterData: collectData(),
        systemPrompt: systemPrompt.trim(),
        imageData: avatar,
      });
      showToast('캐릭터가 등록되었습니다!');
      await mutateCharacters();
      useBuilderStore.getState().reset();
      router.push('/');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '등록에 실패했습니다.');
    }
  };

  const onRebuild = async () => {
    const updated = collectData();
    setCharData(updated);

    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + (Math.random() * 12 + 4), 85);
      setProgress(p);
    }, 500);

    try {
      const data = await api.post<{ systemPrompt: string }>('/api/builder/generate', {
        characterData: updated,
      });
      clearInterval(interval);
      setProgress(100);
      setSystemMd(data.systemPrompt);
      setSystemPrompt(data.systemPrompt);
      setTimeout(() => setProgress(null), 400);
    } catch (err) {
      clearInterval(interval);
      setProgress(null);
      showToast(err instanceof ApiError ? err.message : '생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (!ready || !user || !charData) {
    return <div className="page-wrap" />;
  }

  return (
    <div className="page-wrap">
      {progress !== null && <BuilderLoading progress={progress} />}

      <div className="page-nav">
        <button type="button" className="btn-back" onClick={() => router.push('/builder/chat')} aria-label="뒤로">
          ←
        </button>
        <span className="nav-label">캐릭터 검토</span>
      </div>

      <div className="page-body">
        <div className="content-header">
          <p className="content-header-title">캐릭터 검토</p>
          <p className="content-header-desc">내용을 확인하고 수정한 뒤 등록해주세요.</p>
        </div>

        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label>프로필 이미지</label>
            <AvatarUpload value={avatar} onChange={setAvatar} />
          </div>
          <div className="form-group">
            <label>이름 <span className="required">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>나이</label>
            <input type="number" min={1} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="form-group">
            <label>직업 / 역할</label>
            <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </div>
          <div className="form-group">
            <label>한 줄 소개</label>
            <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label>외형</label>
            <textarea rows={2} value={appearance} onChange={(e) => setAppearance(e.target.value)} />
          </div>
          <div className="form-group">
            <label>성격 (행동 규칙)</label>
            <textarea rows={3} value={personality} onChange={(e) => setPersonality(e.target.value)} />
          </div>
          <div className="form-group">
            <label>말투</label>
            <textarea rows={2} value={speechStyle} onChange={(e) => setSpeechStyle(e.target.value)} />
          </div>
          <div className="form-group">
            <label>말투 예시 (한 줄씩)</label>
            <textarea rows={4} value={speechExamples} onChange={(e) => setSpeechExamples(e.target.value)} placeholder={'예시 1\n예시 2\n예시 3'} />
          </div>
          <div className="form-group">
            <label>태그 <span className="label-hint">최소 1개 · 최대 8개</span></label>
            <TagInput tags={tags} onChange={setTags} suggestions={SUGGESTIONS} />
          </div>
          <div className="form-group">
            <label>생성된 시스템 프롬프트</label>
            <textarea
              rows={10}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              style={{ fontSize: 12, lineHeight: 1.6 }}
            />
          </div>
          <div className="form-group">
            <label>콘텐츠 등급</label>
            <div className="rating-select-group">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`rating-select-btn ${rating === r.value ? 'active' : ''}`}
                  data-value={r.value}
                  onClick={() => setRating(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className={styles.ratingHint}>
              성인 전환: 유저가 Safety 토글로 전환 가능 · 성인 전용: 성인 인증 유저만 접근
            </p>
          </div>

          <button type="button" className="btn-primary" onClick={onRegister}>
            캐릭터 등록하기
          </button>
          <button type="button" className="btn-ghost" onClick={onRebuild}>
            ↺ 프롬프트 다시 생성
          </button>
        </form>
      </div>
    </div>
  );
}
