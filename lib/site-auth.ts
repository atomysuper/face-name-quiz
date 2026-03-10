import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

import { SITE_COOKIE_NAME, constantTimeEqual, getSiteSessionToken } from '@/lib/site-token';

export async function isSiteSessionActive(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SITE_COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  const expectedToken = await getSiteSessionToken();
  return constantTimeEqual(token, expectedToken);
}

export async function requireSitePage(): Promise<void> {
  if (!(await isSiteSessionActive())) {
    redirect('/enter');
  }
}

export async function rejectUnlessSiteAccess(): Promise<NextResponse | null> {
  if (!(await isSiteSessionActive())) {
    return NextResponse.json(
      { error: '접근 비밀번호가 필요합니다.' },
      { status: 401 },
    );
  }

  return null;
}
