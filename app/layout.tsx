import type { Metadata } from 'next';

import { SiteHeader } from '@/components/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: '드리미퀴즈',
  description: '드리미학교 얼굴과 이름을 익히기 위한 내부용 퀴즈 웹앱',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <SiteHeader />
        <main className="container page-shell">{children}</main>
      </body>
    </html>
  );
}
