import type { Metadata, Viewport } from 'next';
import { AuthBootstrap } from '@/components/AuthBootstrap';
import { BottomNav } from '@/components/BottomNav';
import { Toast } from '@/components/Toast';
import { Splash } from '@/components/Splash';
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
      <body>
        <Splash />
        <AuthBootstrap />
        <div id="app">
          {children}
          <BottomNav />
        </div>
        <Toast />
      </body>
    </html>
  );
}
