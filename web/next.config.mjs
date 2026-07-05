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
