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
 * 스트리밍 응답을 위한 raw fetch (채팅에서 사용 예정).
 * SWR / 일반 api.* 와 별도.
 */
export async function rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
  });
}
