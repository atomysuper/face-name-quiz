import type { Metadata } from 'next';

import { SiteHeader } from '@/components/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: '드리미학교',
  description: '드리미학교 학생 얼굴과 이름을 익히기 위한 내부용 웹앱',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SiteHeader />
        <main className="container page-shell">{children}</main>
      </body>
    </html>
  );
}
