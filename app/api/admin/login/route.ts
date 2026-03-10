import { NextResponse } from 'next/server';

import {
  ADMIN_COOKIE_NAME,
  getAdminSessionToken,
  isValidAdminPasscode,
} from '@/lib/admin-auth';
import { rejectUnlessSiteAccess } from '@/lib/site-auth';

export async function POST(request: Request) {
  const siteUnauthorizedResponse = await rejectUnlessSiteAccess();
  if (siteUnauthorizedResponse) {
    return siteUnauthorizedResponse;
  }

  try {
    const body = (await request.json()) as { passcode?: string };
    const passcode = body.passcode?.trim() ?? '';

    if (!isValidAdminPasscode(passcode)) {
      return NextResponse.json(
        { error: '관리자 비밀번호가 맞지 않습니다.' },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: getAdminSessionToken(),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: '로그인 요청을 처리하지 못했습니다.' },
      { status: 400 },
    );
  }
}
