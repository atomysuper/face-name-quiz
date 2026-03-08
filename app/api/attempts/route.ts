import { NextResponse } from 'next/server';

import { recordQuizAttempt } from '@/lib/supabase-admin';
import { toErrorMessage } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      faceId?: string;
      guessedName?: string;
      correct?: boolean;
      responseMs?: number;
    };

    if (!body.faceId || typeof body.guessedName !== 'string') {
      return NextResponse.json(
        { error: 'faceId와 guessedName이 필요합니다.' },
        { status: 400 },
      );
    }

    await recordQuizAttempt({
      faceId: body.faceId,
      guessedName: body.guessedName,
      correct: Boolean(body.correct),
      responseMs:
        typeof body.responseMs === 'number' && Number.isFinite(body.responseMs)
          ? Math.max(0, Math.round(body.responseMs))
          : 0,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: 500 },
    );
  }
}
