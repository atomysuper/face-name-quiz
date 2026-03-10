import { NextResponse } from 'next/server';

import { rejectUnlessSiteAccess } from '@/lib/site-auth';
import { createNameSubmission } from '@/lib/supabase-admin';
import { toErrorMessage } from '@/lib/utils';

export async function POST(request: Request) {
  const siteUnauthorizedResponse = await rejectUnlessSiteAccess();
  if (siteUnauthorizedResponse) {
    return siteUnauthorizedResponse;
  }

  try {
    const body = (await request.json()) as {
      faceId?: string;
      submittedName?: string;
      submittedBy?: string | null;
    };

    if (!body.faceId || !body.submittedName?.trim()) {
      return NextResponse.json(
        { error: 'faceId와 submittedName이 필요합니다.' },
        { status: 400 },
      );
    }

    await createNameSubmission({
      faceId: body.faceId,
      submittedName: body.submittedName,
      submittedBy: body.submittedBy ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: 500 },
    );
  }
}
