import type { Metadata, Viewport } from 'next';
import { AuthBootstrap } from '@/components/AuthBootstrap';
import { Splash } from '@/components/Splash';
import { Toast } from '@/components/Toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { AuthGate } from '@/components/AuthGate';
import { LogoutModal } from '@/components/LogoutModal';
import { BottomNav } from '@/components/BottomNav';
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
        <Splash />
        <AuthBootstrap />
        <div id="app">
          {/* screen-host: 라우트 페이지의 스크롤 컨테이너.
              flex:1 + overflow-y:auto 로 viewport 안에서만 스크롤 → BottomNav 하단 고정.
              (원본의 .screen 패턴과 동일) */}
          <main className="screen-host">{children}</main>
          <BottomNav />
        </div>
        <AuthGate />
        <LogoutModal />
        <DeleteConfirmModal />
        <Toast />
      </body>
    </html>
  );
}
