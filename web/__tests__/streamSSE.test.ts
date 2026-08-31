import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamSSE, ApiError } from '@/lib/api';

/**
 * SSE 수신 파서 — 채팅/재생성의 유일한 응답 경로.
 * 백엔드가 chunk를 어떻게 쪼개 보내든(네트워크·프록시 사정으로 임의 분할됨)
 * 프레임 경계 `\n\n` 기준으로 복원돼야 한다.
 */

/** 주어진 문자열 조각들을 순서대로 흘려보내는 Response 생성 */
function sseResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

type Ev = { type: string; text?: string; sessionId?: string; error?: string };

describe('streamSSE', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('data 블록들을 순서대로 JSON 파싱해 yield', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        'data: {"type":"session","sessionId":"s1"}\n\n',
        'data: {"type":"delta","text":"안"}\n\n',
        'data: {"type":"delta","text":"녕"}\n\n',
      ]),
    );

    const events = await collect(streamSSE<Ev>('/api/chat', {}));
    expect(events.map((e) => e.type)).toEqual(['session', 'delta', 'delta']);
    expect(events[0].sessionId).toBe('s1');
    expect(events.map((e) => e.text).join('')).toBe('안녕');
  });

  it('chunk가 프레임 중간에서 잘려도 복원한다', async () => {
    // 한 이벤트가 3개 chunk에 걸쳐 도착 — 실제 네트워크에서 흔한 분할
    vi.mocked(fetch).mockResolvedValue(
      sseResponse(['data: {"type":"del', 'ta","text":"흐른다"}', '\n\ndata: {"type":"done"}\n\n']),
    );

    const events = await collect(streamSSE<Ev>('/api/chat', {}));
    expect(events).toEqual([{ type: 'delta', text: '흐른다' }, { type: 'done' }]);
  });

  it('여러 이벤트가 한 chunk에 뭉쳐 와도 개별로 분리한다', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse(['data: {"type":"delta","text":"a"}\n\ndata: {"type":"delta","text":"b"}\n\n']),
    );
    expect(await collect(streamSSE<Ev>('/api/chat', {}))).toHaveLength(2);
  });

  it('깨진 JSON 블록은 건너뛰고 스트림을 계속 진행한다', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        'data: {"type":"delta","text":"ok"}\n\n',
        'data: {깨진\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    );

    const events = await collect(streamSSE<Ev>('/api/chat', {}));
    expect(events.map((e) => e.type)).toEqual(['delta', 'done']);
  });

  it('data 가 아닌 라인(event:, id:, retry:)은 무시한다', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse(['event: message\nid: 1\ndata: {"type":"delta","text":"x"}\n\n', ': keepalive\n\n']),
    );
    expect(await collect(streamSSE<Ev>('/api/chat', {}))).toEqual([{ type: 'delta', text: 'x' }]);
  });

  it('스트림 시작 전 에러 응답은 백엔드 한국어 메시지를 담은 ApiError로 던진다', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'persona is required for new sessions' }), {
        status: 400,
      }),
    );

    await expect(collect(streamSSE<Ev>('/api/chat', {}))).rejects.toMatchObject({
      status: 400,
      message: 'persona is required for new sessions',
    });
    await expect(collect(streamSSE<Ev>('/api/chat', {}))).rejects.toBeInstanceOf(ApiError);
  });

  it('본문 없는 응답은 ApiError', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    await expect(collect(streamSSE<Ev>('/api/chat', {}))).rejects.toBeInstanceOf(ApiError);
  });

  it('signal을 fetch로 전달한다 — 페이지 이탈 시 백엔드 호출까지 취소', async () => {
    vi.mocked(fetch).mockResolvedValue(sseResponse(['data: {"type":"done"}\n\n']));
    const ctrl = new AbortController();

    await collect(streamSSE<Ev>('/api/chat', {}, { signal: ctrl.signal }));

    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });
});
