import type { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

export const metadata: Metadata = {
  title: '얼굴 이름 퀴즈',
  description: '단체사진 얼굴 추출과 이름 퀴즈를 위한 내부용 웹앱',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              얼굴 이름 퀴즈
            </Link>

            <nav className="nav-links">
              <Link href="/admin/upload">업로드</Link>
              <Link href="/admin/review">검토</Link>
              <Link href="/contribute">이름 제보</Link>
              <Link href="/quiz">퀴즈</Link>
            </nav>
          </div>
        </header>

        <main className="container page-shell">{children}</main>
      </body>
    </html>
  );
}
