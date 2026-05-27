/**
 * API 클라이언트 (fetch wrapper).
 *
 * 환경:
 *   - Dev: next.config.mjs rewrites가 /api/* → http://localhost:3000/api/* (Express) 프록시
 *   - Prod: NEXT_PUBLIC_API_URL env가 있으면 prefix로 사용, 없으면 same-origin
 *
 * 인증:
 *   - express-session 쿠키 기반 — credentials: 'include' 필수
 *   - 401 응답 시 호출자가 적절히 처리 (인증 게이트 / 리다이렉트)
 *
 * 에러:
 *   - 백엔드는 { error: '한국어 메시지' } 형식으로 응답 (CONVENTIONS.md)
 *   - ApiError로 wrap해서 status / data / message 보존
 *
 * 시크릿:
 *   - API 키 / 토큰 / SESSION_SECRET 등은 절대 로그·UI 출력 금지 (L-014)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const init: RequestInit = {
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...rest,
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, init);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (isJson && typeof data === 'object' && data && 'error' in data && typeof (data as { error: unknown }).error === 'string')
        ? (data as { error: string }).error
        : `API error: ${res.status}`;
    throw new ApiError(res.status, data, message);
  }
  return data as T;
}

export const api = {
  get:    <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: 'GET' }),
  post:   <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>(path, { ...options, method: 'POST', body }),
  patch:  <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>(path, { ...options, method: 'PATCH', body }),
  put:    <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * 스트리밍 응답을 위한 raw fetch.
 * SWR / 일반 api.* 와 별도.
 */
export async function rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
  });
}

/**
 * Server-Sent Events 스트림을 AsyncGenerator로 노출.
 *
 * 각 `data: {...}\n\n` 블록을 JSON 파싱해서 yield.
 * 파싱 실패 블록은 조용히 건너뜀.
 *
 * 사용 예:
 *   for await (const ev of streamSSE<{ type: string; text?: string }>('/api/chat', body, { signal })) {
 *     if (ev.type === 'delta') append(ev.text);
 *   }
 *
 * 중단:
 *   - AbortSignal로 호출자가 중단 가능 (페이지 이탈, 사용자 cancel 등)
 *   - 백엔드는 `req.on('close')`로 partial 저장 처리
 */
export async function* streamSSE<T = unknown>(
  path: string,
  body: unknown,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<T, void, unknown> {
  const res = await rawFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    // SSE 시작 전에 에러 응답이면 JSON으로 파싱 시도
    let message = `API error: ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') message = data.error;
      throw new ApiError(res.status, data, message);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(res.status, null, message);
    }
  }
  if (!res.body) {
    throw new ApiError(res.status, null, '스트림 응답이 비어있습니다.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 메시지는 `\n\n`으로 구분. 각 메시지의 `data: ...` 라인을 추출.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        // 한 블록 안에 여러 라인 — data: 만 처리 (event:, id:, retry: 무시)
        const dataLines = block
          .split('\n')
          .filter((l) => l.startsWith('data: '))
          .map((l) => l.slice(6));
        if (dataLines.length === 0) continue;
        const payloadStr = dataLines.join('\n');
        try {
          yield JSON.parse(payloadStr) as T;
        } catch {
          // 깨진 JSON은 건너뜀
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}
