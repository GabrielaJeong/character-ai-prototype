import { NextRequest, NextResponse } from 'next/server';

/**
 * 서버 측 어드민 게이트 — `/admin*` 진입 시 페이지 셸을 보내기 전에 차단.
 *
 * 원본 server.js `adminPageGuard`(세션 확인 후 비어드민 redirect)와 동등한 보호를
 * Next 측에서 재현. 유저 화면들이 쓰는 클라이언트 게이트(useRequireAuth)와 달리,
 * 민감한 어드민은 **셸 자체가 비어드민에게 내려가면 안 되므로** 서버 단계에서 막는다.
 *
 * 동작:
 *   - 들어온 요청의 세션 쿠키를 백엔드 `/api/auth/me`로 포워드 → role 확인.
 *   - role !== 'admin' (또는 검증 실패) → `/`로 redirect.
 *
 * 백엔드 origin: 서버 측 fetch라 rewrites(클라 전용)를 못 쓴다. `API_INTERNAL_URL`
 *   (없으면 dev 기본 http://localhost:3000)로 직접 호출. **prod 배포 시 이 env 설정 필요.**
 */
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://localhost:3000';

export async function middleware(req: NextRequest) {
  const cookie = req.headers.get('cookie') ?? '';
  const home = new URL('/', req.url);

  // 쿠키 없으면 세션 자체가 없음 → 즉시 차단 (불필요한 백엔드 호출 회피)
  if (!cookie) return NextResponse.redirect(home);

  try {
    const res = await fetch(`${API_INTERNAL}/api/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { user?: { role?: string } | null };
      if (data?.user?.role === 'admin') return NextResponse.next();
    }
  } catch {
    // 백엔드 불통 시 보안 우선 — 통과시키지 않고 차단
  }
  return NextResponse.redirect(home);
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
