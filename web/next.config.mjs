/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 백엔드 API는 root 폴더의 Express 서버에서 제공.
  // 개발 환경: rewrites로 /api/* → http://localhost:3000/api/*
  // 프로덕션 환경: NEXT_PUBLIC_API_URL 환경변수 사용 (Vercel/AWS에서 설정)
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3000/api/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
