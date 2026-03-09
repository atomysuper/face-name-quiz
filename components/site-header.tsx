"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/quiz', label: '퀴즈' },
  { href: '/admin/upload', label: '업로드' },
  { href: '/admin/review', label: '검토' },
  { href: '/admin/manage', label: '관리' },
  { href: '/contribute', label: '이름 제보' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/quiz" className="brand">
          드리미학교
        </Link>

        <nav className="desktop-nav" aria-label="주요 메뉴">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'nav-active' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mobile-nav-shell">
          <Link href="/quiz" className={`mobile-quiz-link ${pathname === '/quiz' ? 'nav-active' : ''}`}>
            퀴즈
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            메뉴
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="mobile-menu-wrap">
          <nav id="mobile-menu" className="container mobile-menu" aria-label="모바일 메뉴">
            {menuItems
              .filter((item) => item.href !== '/quiz')
              .map((item) => (
                <Link key={item.href} href={item.href} className={pathname === item.href ? 'nav-active' : undefined}>
                  {item.label}
                </Link>
              ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
