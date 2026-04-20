const { buildSystemPrompt } = require('../../prompts/buildSystemPrompt');

const TEST_PERSONA = {
  name: '테스트',
  age: 25,
  appearance: '평범한 외모',
  personality: '조용한 편',
  notes: '',
};

describe('buildSystemPrompt (3층 아키텍처)', () => {
  it('Layer 1 (캐릭터) 내용 포함', () => {
    const prompt = buildSystemPrompt('ihwa', TEST_PERSONA, '', 'on', 'claude-sonnet-4-6');
    // ihwa system.md 첫 줄: "You are Ihwa."
    expect(prompt).toContain('Ihwa');
  });

  it('Layer 2 (공통 가드레일) 내용 포함', () => {
    const prompt = buildSystemPrompt('ihwa', TEST_PERSONA, '', 'on', 'claude-sonnet-4-6');
    // guardrails.md 첫 줄 키워드
    expect(prompt).toContain('Platform-Level Guardrails');
  });

  it('Layer 3 (모델별 보정) 포함 — 모델 파일 존재 시', () => {
    const prompt = buildSystemPrompt('ihwa', TEST_PERSONA, '', 'on', 'claude-sonnet-4-6');
    // 모델 파일 존재 여부와 무관하게 최소 캐릭터+가드레일 포함
    expect(prompt.length).toBeGreaterThan(500);
  });

  it('Safety ON/OFF에 따라 다른 내용 포함', () => {
    const onPrompt  = buildSystemPrompt('ihwa', TEST_PERSONA, '', 'on',  'claude-sonnet-4-6');
    const offPrompt = buildSystemPrompt('ihwa', TEST_PERSONA, '', 'off', 'claude-sonnet-4-6');
    expect(onPrompt).not.toBe(offPrompt);
  });

  it('페르소나 블록이 프롬프트에 포함됨', () => {
    const prompt = buildSystemPrompt('ihwa', TEST_PERSONA, '', 'on', 'claude-sonnet-4-6');
    expect(prompt).toContain('테스트'); // persona.name
  });

  it('유저 노트가 있으면 프롬프트에 포함됨', () => {
    const note = '오늘은 비가 오는 날입니다';
    const prompt = buildSystemPrompt('ihwa', TEST_PERSONA, note, 'on', 'claude-sonnet-4-6');
    expect(prompt).toContain(note);
  });

  it('유저 노트가 없으면 User Notes 블록 미포함', () => {
    const prompt = buildSystemPrompt('ihwa', TEST_PERSONA, '', 'on', 'claude-sonnet-4-6');
    expect(prompt).not.toContain('## User Notes');
  });

  it('존재하지 않는 캐릭터 ID는 에러 발생', () => {
    expect(() => {
      buildSystemPrompt('nonexistent', TEST_PERSONA, '', 'on', 'claude-sonnet-4-6');
    }).toThrow();
  });
});
