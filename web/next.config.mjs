/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 백엔드 API + 정적 자원은 root 폴더의 Express 서버에서 제공.
  // Express가 public/ 전체를 static으로 서빙 (server.js:137):
  //   /api/*       — REST 라우트
  //   /images/*    — 캐릭터·배너 이미지
  //   /icons/*     — SVG 아이콘
  //   /uploads/*   — 유저 업로드
  // 개발: rewrites로 위 경로들을 http://localhost:3000으로 프록시
  // 프로덕션: NEXT_PUBLIC_API_URL env (Vercel/AWS에서 설정)
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        { source: '/api/:path*',     destination: 'http://localhost:3000/api/:path*' },
        { source: '/images/:path*',  destination: 'http://localhost:3000/images/:path*' },
        { source: '/icons/:path*',   destination: 'http://localhost:3000/icons/:path*' },
        { source: '/uploads/:path*', destination: 'http://localhost:3000/uploads/:path*' },
      ];
    }
    return [];
  },
};

export default nextConfig;
