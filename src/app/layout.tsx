import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Header } from '@/components/site/Header';

export const metadata: Metadata = {
  title: {
    default: 'Site — 작은 실험실',
    template: '%s · Site',
  },
  description: '작은 서비스들을 모아두는 개인 실험실.',
  metadataBase: new URL('https://atzlab.github.io/Site/'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard (KR) loaded via CDN — variable weight, no FOIT. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/[email protected]/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-zinc-200 py-8 text-sm text-zinc-500">
          <div className="mx-auto max-w-5xl px-6">
            <p>© {new Date().getFullYear()} Site — 작은 실험실</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
