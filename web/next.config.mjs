/** @type {import('next').NextConfig} */

// 백엔드(Express) origin. prod(Vercel)에서 BACKEND_ORIGIN env로 Railway URL 지정.
// 미설정 시 로컬 개발 기본값.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'http://localhost:3000';

const nextConfig = {
  reactStrictMode: true,
  // 백엔드 API + 정적 자원(이미지/아이콘/업로드)은 Express 서버가 제공.
  // rewrites로 같은 도메인(브라우저 입장 same-origin)에서 프록시 → 세션 쿠키가
  // first-party로 유지되어 크로스도메인 인증 문제가 없음 (docs/CUTOVER_CHECKLIST.md).
  //   dev:  BACKEND_ORIGIN 미설정 → http://localhost:3000
  //   prod: Vercel env BACKEND_ORIGIN = https://<railway-backend-domain>
  // 포트폴리오 iframe 임베드 허용 (D-016).
  // 원래 Express(server.js helmet)의 CSP frameAncestors 로만 걸려 있었는데,
  // cutover 후에는 HTML을 Vercel이 서빙하므로 Express 헤더가 안 붙는다 → 여기서 재현.
  // frame-ancestors 만 지정한다. 전체 CSP를 여기서 다시 쓰면 Next 런타임(인라인
  // 스크립트·스타일)이 깨지므로 건드리지 않는다.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://gabby-pm-portfolio.vercel.app",
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/api/:path*',     destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: '/images/:path*',  destination: `${BACKEND_ORIGIN}/images/:path*` },
      { source: '/icons/:path*',   destination: `${BACKEND_ORIGIN}/icons/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND_ORIGIN}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
