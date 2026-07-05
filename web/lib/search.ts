/**
 * 캐릭터 검색 매칭 (이름/태그/설명 + 한글 초성 검색).
 * 원본 app.js matchesQuery / getChosung / CHOSUNG (L1577~1607).
 */
import type { Character } from './types';

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/** 한글 문자열 → 초성 문자열 (비한글은 그대로). */
export function getChosung(str: string): string {
  return [...str]
    .map((ch) => {
      const code = ch.charCodeAt(0) - 0xac00;
      if (code < 0 || code > 11171) return ch;
      return CHOSUNG[Math.floor(code / 28 / 21)];
    })
    .join('');
}

/**
 * 캐릭터가 검색어 q에 매칭되는지.
 * q가 초성만이면 초성 비교, 아니면 부분 문자열(대소문자 무시).
 * 대상: name / fullName / subtitle / role / team / tags / description.
 */
export function matchesQuery(char: Character, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  const isChosung = /^[ㄱ-ㅎ]+$/.test(q);

  const targets: string[] = [
    char.name || '',
    char.fullName || '',
    char.subtitle || '',
    char.role || '',
    char.team || '',
    ...(Array.isArray(char.tags) ? char.tags : []),
    ...(Array.isArray(char.description) ? char.description : []),
  ];

  return targets.some((t) => {
    const s = String(t);
    if (isChosung) return getChosung(s).includes(q);
    return s.toLowerCase().includes(lower);
  });
}
