import type { BuilderCharData } from './types';

/**
 * AI 빌더 응답 파싱 유틸.
 * 원본: public/js/app.js L3022~3037 (cleanBuilderReply / extractCharReady).
 */

/** [CHARACTER_READY]...[/CHARACTER_READY] 블록을 표시 텍스트에서 제거 */
export function cleanBuilderReply(text: string): string {
  return text.replace(/\[CHARACTER_READY\][\s\S]*?\[\/CHARACTER_READY\]/g, '').trim();
}

/**
 * 직접 제작 시 클라이언트에서 간단한 system.md 생성.
 * 원본: public/js/app.js L2814~2836 `_generateManualSystemPrompt`.
 */
export function generateManualSystemPrompt(d: BuilderCharData): string {
  const lines: string[] = [];
  lines.push(`당신은 ${d.name}입니다. 아래 설정에 따라 캐릭터를 연기하세요.\n`);
  if (d.age || d.occupation) {
    lines.push('## 기본 정보');
    if (d.age) lines.push(`- 나이: ${d.age}세`);
    if (d.occupation) lines.push(`- 직업/역할: ${d.occupation}`);
    lines.push('');
  }
  if (d.appearance) lines.push(`## 외형\n${d.appearance}\n`);
  if (d.personality) lines.push(`## 성격\n${d.personality}\n`);
  if (d.speechStyle) lines.push(`## 말투\n${d.speechStyle}\n`);
  if (d.speechExamples?.length) {
    lines.push('## 말투 예시');
    d.speechExamples.forEach((e) => lines.push(`- "${e}"`));
    lines.push('');
  }
  if (d.background) lines.push(`## 배경 스토리\n${d.background}\n`);
  if (d.worldbuilding) lines.push(`## 세계관\n${d.worldbuilding}\n`);
  if (d.relationship) lines.push(`## 유저와의 관계\n${d.relationship}\n`);
  lines.push(
    `## 대화 규칙\n- 항상 ${d.name}의 말투와 성격을 유지하세요.\n- 캐릭터 설정에서 벗어나지 마세요.\n- 자연스럽고 몰입감 있는 대화를 이어가세요.`,
  );
  return lines.join('\n');
}

/** [CHARACTER_READY] 블록 안의 JSON을 파싱 (코드펜스 허용). 실패 시 null */
export function extractCharReady(text: string): BuilderCharData | null {
  const match = text.match(/\[CHARACTER_READY\]([\s\S]*?)\[\/CHARACTER_READY\]/);
  if (!match) return null;
  try {
    let jsonStr = match[1].trim();
    const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) jsonStr = codeMatch[1];
    return JSON.parse(jsonStr) as BuilderCharData;
  } catch {
    return null;
  }
}
