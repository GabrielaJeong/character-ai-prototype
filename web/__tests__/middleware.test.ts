import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from '@/middleware';

/**
 * 어드민 게이트 — 백엔드 verifyOwnership/adminPageGuard 에 대응하는 프론트 측 방어.
 * 어드민 셸이 비어드민에게 내려가면 안 되므로 서버 단계에서 차단된다 (D-019 결정 3).
 */

function req(cookie?: string) {
  return new NextRequest('https://example.com/admin', {
    headers: cookie ? { cookie } : {},
  });
}

/** 302 redirect 인지 + 목적지가 홈인지 */
function expectRedirectHome(res: Response) {
  expect(res.status).toBe(307);
  expect(new URL(res.headers.get('location')!).pathname).toBe('/');
}

describe('admin middleware', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('쿠키가 없으면 백엔드 호출 없이 즉시 홈으로 차단', async () => {
    const res = await middleware(req());
    expectRedirectHome(res);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('role이 admin이면 통과', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user: { role: 'admin' } }), { status: 200 }),
    );
    const res = await middleware(req('sid=abc'));
    // NextResponse.next() 는 redirect 가 아니다
    expect(res.headers.get('location')).toBeNull();
  });

  it('일반 유저는 차단', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user: { role: 'user' } }), { status: 200 }),
    );
    expectRedirectHome(await middleware(req('sid=abc')));
  });

  it('user가 null이면 차단', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ user: null }), { status: 200 }),
    );
    expectRedirectHome(await middleware(req('sid=abc')));
  });

  it('백엔드가 401이면 차단', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }));
    expectRedirectHome(await middleware(req('sid=abc')));
  });

  it('백엔드 불통(throw) 시 통과시키지 않고 차단 — fail closed', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    expectRedirectHome(await middleware(req('sid=abc')));
  });

  it('matcher가 /admin 과 그 하위만 대상으로 한다', () => {
    expect(config.matcher).toEqual(['/admin', '/admin/:path*']);
  });
});
