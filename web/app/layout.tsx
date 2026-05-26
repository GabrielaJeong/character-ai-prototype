import type { Metadata, Viewport } from 'next';
import { AuthBootstrap } from '@/components/AuthBootstrap';
import './globals.css';

export const metadata: Metadata = {
  title: 'Folio',
  description: '캐릭터와 대화하는 AI 플랫폼',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard 폰트 — CSS @import 대신 link 태그로 로드 (Next.js dev 호환) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body>
        <AuthBootstrap />
        <div id="app">{children}</div>
      </body>
    </html>
  );
}
