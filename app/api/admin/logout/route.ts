import { NextResponse } from 'next/server';

import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { rejectUnlessSiteAccess } from '@/lib/site-auth';

export async function POST() {
  const siteUnauthorizedResponse = await rejectUnlessSiteAccess();
  if (siteUnauthorizedResponse) {
    return siteUnauthorizedResponse;
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}
