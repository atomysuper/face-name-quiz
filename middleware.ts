import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { SITE_COOKIE_NAME, constantTimeEqual, getSiteSessionToken } from '@/lib/site-token';

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/enter' ||
    pathname.startsWith('/api/site-auth/login') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SITE_COOKIE_NAME)?.value;
  const expectedToken = await getSiteSessionToken();

  if (token && constantTimeEqual(token, expectedToken)) {
    return NextResponse.next();
  }

  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: '접근 비밀번호가 필요합니다.' },
      { status: 401 },
    );
  }

  const loginUrl = new URL('/enter', request.url);
  const nextPath = `${pathname}${search}`;

  if (nextPath && nextPath !== '/') {
    loginUrl.searchParams.set('next', nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
