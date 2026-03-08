import { createHash, timingSafeEqual } from 'crypto';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

import { getServerEnv } from '@/lib/env';

export const ADMIN_COOKIE_NAME = 'face_quiz_admin';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function constantTimeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function isValidAdminPasscode(input: string): boolean {
  const { adminPasscode } = getServerEnv();
  return constantTimeEqual(input, adminPasscode);
}

export function getAdminSessionToken(): string {
  const { adminPasscode, sessionSecret } = getServerEnv();
  return createHash('sha256')
    .update(`${adminPasscode}:${sessionSecret}`)
    .digest('hex');
}

export async function isAdminSessionActive(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  return constantTimeEqual(token, getAdminSessionToken());
}

export async function requireAdminPage(): Promise<void> {
  if (!(await isAdminSessionActive())) {
    redirect('/admin/login');
  }
}

export async function rejectUnlessAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminSessionActive())) {
    return NextResponse.json(
      { error: '관리자 로그인이 필요합니다.' },
      { status: 401 },
    );
  }

  return null;
}
