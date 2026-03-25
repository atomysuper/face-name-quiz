import { NextResponse } from 'next/server';

import { rejectUnlessSiteAccess } from '@/lib/site-auth';
import { createRanking, listRankings } from '@/lib/supabase-admin';
import { toErrorMessage } from '@/lib/utils';

export async function GET() {
  const siteUnauthorizedResponse = await rejectUnlessSiteAccess();
  if (siteUnauthorizedResponse) return siteUnauthorizedResponse;

  try {
    const rankings = await listRankings(30);
    return NextResponse.json({ rankings });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const siteUnauthorizedResponse = await rejectUnlessSiteAccess();
  if (siteUnauthorizedResponse) return siteUnauthorizedResponse;

  try {
    const body = await request.json() as { nickname?: string; score?: number; correctCount?: number; mode?: string };
    const nickname = String(body.nickname ?? '').trim();
    const score = Number(body.score ?? 0);
    const correctCount = Number(body.correctCount ?? 0);
    const mode = String(body.mode ?? 'multiple-choice');

    if (!nickname) {
      return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 });
    }
    if (correctCount < 5) {
      return NextResponse.json({ error: '5개 이상 맞혀야 등록할 수 있습니다.' }, { status: 400 });
    }

    await createRanking({ nickname, score, correctCount, mode });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
