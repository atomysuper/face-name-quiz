import { NextResponse } from 'next/server';

import { SITE_COOKIE_NAME, getSiteSessionToken, isValidSitePasscode } from '@/lib/site-token';

function sanitizeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/quiz';
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { passcode?: string; nextPath?: string };
    const passcode = body.passcode?.trim() ?? '';

    if (!(await isValidSitePasscode(passcode))) {
      return NextResponse.json(
        { error: '접근 비밀번호가 맞지 않습니다.' },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      nextPath: sanitizeNextPath(body.nextPath),
    });

    response.cookies.set({
      name: SITE_COOKIE_NAME,
      value: await getSiteSessionToken(),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: '접근 비밀번호 확인에 실패했습니다.' },
      { status: 400 },
    );
  }
}
