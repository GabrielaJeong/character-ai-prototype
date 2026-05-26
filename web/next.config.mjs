/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Express가 서빙하는 /images/* 및 /uploads/* 경로 허용
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost', port: '3000', pathname: '/images/**' },
      { protocol: 'http',  hostname: 'localhost', port: '3000', pathname: '/uploads/**' },
      { protocol: 'https', hostname: '**.railway.app',          pathname: '/images/**' },
      { protocol: 'https', hostname: '**.railway.app',          pathname: '/uploads/**' },
    ],
    // 같은 도메인 (Express가 root에서 정적 파일 서빙) 또는 별도 도메인 둘 다 대응
    unoptimized: false,
  },
  // 백엔드 API는 root 폴더의 Express 서버에서 제공.
  // 개발 환경: rewrites로 /api/* + /images/* + /uploads/* → http://localhost:3000
  // 프로덕션 환경: NEXT_PUBLIC_API_URL 환경변수 사용 (Vercel/AWS에서 설정)
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        { source: '/api/:path*',     destination: 'http://localhost:3000/api/:path*' },
        { source: '/images/:path*',  destination: 'http://localhost:3000/images/:path*' },
        { source: '/uploads/:path*', destination: 'http://localhost:3000/uploads/:path*' },
      ];
    }
    return [];
  },
};

export default nextConfig;
