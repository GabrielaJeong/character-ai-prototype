import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatPrepStore } from '@/store/chatPrep';
import { useBuilderStore } from '@/store/builder';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { BUILDER_DEFAULT_MODEL } from '@/lib/models';
import type { PersonaData } from '@/lib/types';

/**
 * 원본 SPA의 글로벌 변수(window._persona, builderCharData 등)를 대체한 store들.
 * 글로벌이 암묵적으로 공유되던 걸 명시적 store로 옮긴 게 마이그레이션 핵심 위험
 * 포인트였으므로(D-014), 최소한 수명주기 계약은 고정해둔다.
 */

const PERSONA = { name: '도현', age: 32 } as unknown as PersonaData;

/**
 * lib/api 의 request()는 content-type 에 application/json 이 있어야 파싱한다.
 * Response 기본값은 text/plain 이라, 명시하지 않으면 본문이 문자열로 넘어와
 * 테스트가 조용히 잘못된 경로를 검증하게 된다.
 */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('chatPrep store — 1-hop 전달 (persona setup → chat)', () => {
  beforeEach(() => useChatPrepStore.setState({ prep: null }));

  it('초기값은 비어있다', () => {
    expect(useChatPrepStore.getState().prep).toBeNull();
  });

  it('consume은 값을 반환하고 즉시 비운다 — 1회성이라 뒤로가기 재진입에 남지 않는다', () => {
    const prep = { characterId: 'ihwa', persona: PERSONA, safety: 'on' as const };
    useChatPrepStore.getState().setPrep(prep);

    expect(useChatPrepStore.getState().consume()).toEqual(prep);
    expect(useChatPrepStore.getState().prep).toBeNull();
    expect(useChatPrepStore.getState().consume()).toBeNull(); // 두 번째는 null
  });
});

describe('builder store', () => {
  beforeEach(() => useBuilderStore.getState().reset());

  it('기본 모델은 BUILDER_DEFAULT_MODEL', () => {
    expect(useBuilderStore.getState().model).toBe(BUILDER_DEFAULT_MODEL);
  });

  it('reset은 세션 컨텍스트를 전부 비우고 모델을 기본값으로 되돌린다', () => {
    const s = useBuilderStore.getState();
    s.setModel('claude-opus-5');
    s.setSession('sess-1');
    s.setSystemMd('# md');

    useBuilderStore.getState().reset();

    const after = useBuilderStore.getState();
    expect(after.model).toBe(BUILDER_DEFAULT_MODEL);
    expect(after.sessionId).toBeNull();
    expect(after.charData).toBeNull();
    expect(after.systemMd).toBeNull();
  });
});

describe('ui store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.getState().hideToast();
  });
  afterEach(() => vi.useRealTimers());

  it('토스트는 duration 후 자동으로 사라진다', () => {
    useUIStore.getState().showToast('저장됐어요', 2000);
    expect(useUIStore.getState().toastMessage).toBe('저장됐어요');

    vi.advanceTimersByTime(2000);
    expect(useUIStore.getState().toastMessage).toBeNull();
  });

  it('연속 토스트는 이전 타이머를 취소해 새 메시지가 조기 소멸하지 않는다', () => {
    useUIStore.getState().showToast('첫번째', 2000);
    vi.advanceTimersByTime(1500);
    useUIStore.getState().showToast('두번째', 2000);

    vi.advanceTimersByTime(600); // 첫 타이머가 살아있었다면 여기서 지워졌을 시점
    expect(useUIStore.getState().toastMessage).toBe('두번째');

    vi.advanceTimersByTime(1400);
    expect(useUIStore.getState().toastMessage).toBeNull();
  });

  it('authGate는 intendedPath를 보존한다 — 로그인 후 복귀 지점 (L-011)', () => {
    useUIStore.getState().showAuthGate({
      title: '로그인이 필요해요',
      desc: '',
      intendedPath: '/character/ihwa/chat',
    });
    expect(useUIStore.getState().authGate?.intendedPath).toBe('/character/ihwa/chat');

    useUIStore.getState().closeAuthGate();
    expect(useUIStore.getState().authGate).toBeNull();
  });

  it('closeAdultVerify는 onClose 콜백을 호출한 뒤 상태를 비운다 — UI 원복용', () => {
    const onClose = vi.fn();
    useUIStore.getState().openAdultVerify({ onClose });
    useUIStore.getState().closeAdultVerify();

    expect(onClose).toHaveBeenCalledOnce();
    expect(useUIStore.getState().adultVerify).toBeNull();
  });
});

describe('auth store — 체험 모드', () => {
  beforeEach(() => useAuthStore.setState({ user: null, ready: false, demoAvailable: false }));

  it('demo-available 가 true면 demoAvailable 을 켠다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ available: true })),
    );
    await useAuthStore.getState().checkDemoMode();
    expect(useAuthStore.getState().demoAvailable).toBe(true);
  });

  it('demo-available 호출이 실패하면 노출하지 않는다 — fail closed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await useAuthStore.getState().checkDemoMode();
    expect(useAuthStore.getState().demoAvailable).toBe(false);
  });

  it('demoLogin 성공 시 user 를 채운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ user: { id: 9, nickname: '체험 유저', isDemo: true } })),
    );
    const user = await useAuthStore.getState().demoLogin();
    expect(user?.isDemo).toBe(true);
    expect(useAuthStore.getState().user?.isDemo).toBe(true);
  });
});

describe('auth store — initAuth race (L-011)', () => {
  beforeEach(() => useAuthStore.setState({ user: null, ready: false }));

  it('initAuth 응답이 늦게 와도 이미 로그인된 user를 null로 덮어쓰지 않는다', async () => {
    // initAuth 진행 중 다른 경로(demoLogin 등)가 먼저 user를 채운 상황을 재현
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ user: null })),
    );
    useAuthStore.setState({ user: { id: 1, username: 'gabby' } as never });

    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().user).not.toBeNull();
    expect(useAuthStore.getState().ready).toBe(true);
  });
});
