"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const desktopMenuItems = [
  { href: '/quiz', label: '퀴즈' },
  { href: '/upload', label: '업로드' },
  { href: '/contribute', label: '이름 제보' },
  { href: '/admin/review', label: '검토' },
] as const;

const mobileQuickLinks = [
  { href: '/quiz', label: '퀴즈' },
  { href: '/upload', label: '업로드' },
] as const;

const mobileMenuItems = [
  { href: '/upload', label: '업로드' },
  { href: '/contribute', label: '이름 제보' },
  { href: '/admin/review', label: '검토' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (pathname === '/enter') {
    return null;
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/quiz" className="brand">
          <span className="brand-dot" />
          드리미퀴즈
        </Link>

        <nav className="desktop-nav" aria-label="주요 메뉴">
          {desktopMenuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'nav-active' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mobile-nav-shell">
          <div className="mobile-quick-links">
            {mobileQuickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-quiz-link ${pathname === item.href ? 'nav-active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? '닫기' : '메뉴'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-menu-wrap animate-fade-in">
          <nav id="mobile-menu" className="container mobile-menu" aria-label="모바일 메뉴">
            {mobileMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? 'nav-active' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
