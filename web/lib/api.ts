/**
 * API 클라이언트 — fetch wrapper.
 *
 * 개발 환경:
 *   - next.config.mjs rewrites가 /api/* → localhost:3000 으로 프록시
 *   - 따라서 same-origin 요청처럼 동작 (쿠키 자동 포함)
 *
 * 프로덕션 환경:
 *   - NEXT_PUBLIC_API_URL 환경변수가 있으면 prefix로 사용
 *   - 없으면 same-origin (Next.js와 Express가 같은 도메인일 때)
 *
 * 인증:
 *   - express-session 쿠키 기반이므로 credentials: 'include' 필수
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
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const init: RequestInit = {
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
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
      (isJson && typeof data === 'object' && data && 'error' in data && typeof data.error === 'string')
        ? data.error
        : `API error: ${res.status}`;
    throw new ApiError(res.status, data, message);
  }

  return data as T;
}

export const api = {
  get:   <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: 'GET' }),
  post:  <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>(path, { ...options, method: 'PATCH', body }),
  put:   <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>(path, { ...options, method: 'PUT', body }),
  delete:<T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};
