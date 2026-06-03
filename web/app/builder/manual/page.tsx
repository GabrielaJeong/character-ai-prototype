'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useCharacters } from '@/lib/hooks';
import { api, ApiError } from '@/lib/api';
import { generateManualSystemPrompt } from '@/lib/builder';
import type { BuilderCharData, BuilderRating } from '@/lib/types';
import { AvatarUpload } from '@/components/AvatarUpload';
import { TagInput } from '@/components/TagInput';
import { BuilderLoading } from '@/components/BuilderLoading';
import styles from './page.module.css';

/**
 * 직접 제작 — `/builder/manual`
 *
 * 원본: index.html L556~650 (#screen-builder-manual) + app.js L2838~2904.
 * 폼 입력 → 클라이언트 system.md 생성 → POST /api/characters/create → 홈 이동.
 */
const SUGGESTIONS = ['현실', '판타지', '초자연', '로맨스', '액션', '일상', '다정', '차가운'];

const RATINGS: { value: BuilderRating; label: string }[] = [
  { value: 'all_ages', label: '전연령' },
  { value: 'toggleable', label: '전연령 / 성인 전환' },
  { value: 'adult_only', label: '성인 전용' },
];

export default function BuilderManualPage() {
  const router = useRouter();
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);
  const { mutate: mutateCharacters } = useCharacters();
  const { user, ready } = useRequireAuth('/builder/manual', {
    title: '캐릭터 제작',
    desc: '캐릭터를 제작하려면 로그인이 필요합니다.',
  });

  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [age, setAge] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [speechStyle, setSpeechStyle] = useState('');
  const [speechExamples, setSpeechExamples] = useState('');
  const [background, setBackground] = useState('');
  const [worldbuilding, setWorldbuilding] = useState('');
  const [relationship, setRelationship] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [rating, setRating] = useState<BuilderRating>('all_ages');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const onSubmit = async () => {
    if (!name.trim()) return showToast('캐릭터 이름을 입력해주세요.');
    if (!personality.trim()) return showToast('성격을 입력해주세요.');
    if (!speechStyle.trim()) return showToast('말투를 입력해주세요.');
    if (tags.length === 0) return showToast('태그를 1개 이상 추가해주세요.');

    const examples = speechExamples
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const characterData: BuilderCharData = {
      name: name.trim(),
      occupation: occupation.trim(),
      age: age || '',
      subtitle: subtitle.trim(),
      appearance: appearance.trim(),
      personality: personality.trim(),
      speechStyle: speechStyle.trim(),
      speechExamples: examples,
      background: background.trim(),
      worldbuilding: worldbuilding.trim(),
      relationship: relationship.trim(),
      tags,
      rating,
      hasProfanity: rating === 'adult_only',
    };

    const systemPrompt = generateManualSystemPrompt(characterData);

    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + 8, 85);
      setProgress(p);
    }, 120);

    try {
      await api.post('/api/characters/create', {
        characterData,
        systemPrompt,
        imageData: avatar,
      });
      clearInterval(interval);
      setProgress(100);
      await mutateCharacters();
      setTimeout(() => {
        showToast('캐릭터가 등록되었습니다!');
        router.push('/');
      }, 400);
    } catch (err) {
      clearInterval(interval);
      setProgress(null);
      showToast(err instanceof ApiError ? err.message : '캐릭터 등록에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (!ready || !user) {
    return <div className="page-wrap" />;
  }

  return (
    <div className="page-wrap">
      {progress !== null && <BuilderLoading progress={progress} />}

      <div className="page-nav">
        <button type="button" className="btn-back" onClick={() => router.push('/builder')} aria-label="뒤로">
          ←
        </button>
        <span className="nav-label">직접 만들기</span>
      </div>

      <div className="page-body">
        <div className="content-header">
          <p className="content-header-title">캐릭터 설정</p>
          <p className="content-header-desc">정보를 직접 입력해 캐릭터를 만들어보세요.</p>
        </div>

        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label>프로필 이미지</label>
            <AvatarUpload value={avatar} onChange={setAvatar} />
          </div>
          <div className="form-group">
            <label>캐릭터 이름 <span className="required">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" />
          </div>
          <div className="form-group">
            <label>직업 / 역할</label>
            <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="예) 형사, 마법사, 카페 사장" />
          </div>
          <div className="form-group">
            <label>나이</label>
            <input type="number" min={1} max={999} value={age} onChange={(e) => setAge(e.target.value)} placeholder="숫자 입력" />
          </div>
          <div className="form-group">
            <label>한 줄 소개</label>
            <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="예) 냉철한 형사이자 팀의 리더" />
          </div>
          <div className="form-group">
            <label>외형 묘사</label>
            <textarea rows={2} value={appearance} onChange={(e) => setAppearance(e.target.value)} placeholder="키, 체형, 헤어, 눈빛 등" />
          </div>
          <div className="form-group">
            <label>성격 <span className="required">*</span></label>
            <textarea rows={3} value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="성격, 가치관, 행동 패턴 등" />
          </div>
          <div className="form-group">
            <label>말투 / 문체 <span className="required">*</span></label>
            <textarea rows={2} value={speechStyle} onChange={(e) => setSpeechStyle(e.target.value)} placeholder="예) 무뚝뚝하고 짧게 말함. 존댓말 사용하지 않음" />
          </div>
          <div className="form-group">
            <label>대사 예시 <span className="label-hint">한 줄씩 입력</span></label>
            <textarea rows={4} value={speechExamples} onChange={(e) => setSpeechExamples(e.target.value)} placeholder={'예시 대사 1\n예시 대사 2\n예시 대사 3'} />
          </div>
          <div className="form-group">
            <label>배경 스토리</label>
            <textarea rows={3} value={background} onChange={(e) => setBackground(e.target.value)} placeholder="캐릭터의 과거나 배경을 입력하세요" />
          </div>
          <div className="form-group">
            <label>세계관 <span className="label-hint">선택</span></label>
            <textarea rows={2} value={worldbuilding} onChange={(e) => setWorldbuilding(e.target.value)} placeholder="캐릭터가 사는 세계나 시대적 배경" />
          </div>
          <div className="form-group">
            <label>유저와의 관계 <span className="label-hint">선택</span></label>
            <textarea rows={2} value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="예) 같은 팀 동료, 오랜 친구, 처음 만난 사이" />
          </div>
          <div className="form-group">
            <label>태그 <span className="required">*</span> <span className="label-hint">최소 1개 · 최대 8개</span></label>
            <TagInput tags={tags} onChange={setTags} suggestions={SUGGESTIONS} />
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

          <button type="button" className="btn-primary" style={{ marginTop: 8 }} onClick={onSubmit}>
            캐릭터 만들기
          </button>
        </form>
      </div>
    </div>
  );
}
