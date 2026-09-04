'use client';

import { useEffect, useState } from 'react';

/**
 * 이 문서가 다른 사이트의 iframe 안에서 열렸는지.
 *
 * 왜 필요한가 — 포트폴리오(gabby-pm-portfolio.vercel.app)가 이 앱을 iframe으로
 * 임베드하는데, 그 안에서는 **세션 쿠키가 아예 전송되지 않는다.**
 * SameSite 는 최상위 사이트 기준으로 판정되고 vercel.app 은 Public Suffix 라
 * 두 서브도메인은 완전히 별개 사이트다. 즉 iframe 안 요청은 전부 cross-site 로
 * 취급되어 SameSite=Lax 쿠키가 붙지 않는다.
 *
 * 결과적으로 임베드 상태에서는 로그인·체험 로그인이 성공한 것처럼 보여도
 * 이후 요청이 전부 401 이 된다. 그래서 인증이 필요한 지점에서는 로그인을
 * 시도하게 두지 않고 새 탭(=최상위 사이트)으로 유도한다.
 *
 * SSR 안전: 서버 렌더와 첫 페인트에서는 false, 마운트 후에 실제 값으로 바뀐다
 * (window 접근이라 hydration mismatch 를 피해야 함 — ML-011 계열).
 */
export function useIsEmbedded(): boolean {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      // cross-origin 접근이 막히면 그것 자체가 임베드 상태라는 뜻
      setEmbedded(true);
    }
  }, []);

  return embedded;
}

/** 임베드 상태에서 최상위로 열 절대 URL. 서버에서는 상대 경로 그대로. */
export function topLevelUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}
