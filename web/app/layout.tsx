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
      <body>
        <AuthBootstrap />
        <div id="app">{children}</div>
      </body>
    </html>
  );
}
