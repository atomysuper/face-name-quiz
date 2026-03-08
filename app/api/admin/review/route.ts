import { NextResponse } from 'next/server';

import { rejectUnlessAdmin } from '@/lib/admin-auth';
import { approveFaceWithName, deleteSubmission } from '@/lib/supabase-admin';
import { parseAliases, toErrorMessage } from '@/lib/utils';

type ReviewRequest =
  | {
      action: 'approveFace';
      faceId: string;
      personName: string;
      aliases?: string[] | string;
      approvedSubmissionId?: string | null;
    }
  | {
      action: 'rejectSubmission';
      submissionId: string;
    };

export async function POST(request: Request) {
  const unauthorizedResponse = await rejectUnlessAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = (await request.json()) as ReviewRequest;

    if (body.action === 'approveFace') {
      if (!body.faceId || !body.personName?.trim()) {
        return NextResponse.json(
          { error: 'faceId와 personName이 필요합니다.' },
          { status: 400 },
        );
      }

      const person = await approveFaceWithName({
        faceId: body.faceId,
        personName: body.personName,
        aliases: parseAliases(body.aliases),
        approvedSubmissionId: body.approvedSubmissionId ?? null,
      });

      return NextResponse.json({ ok: true, person });
    }

    if (body.action === 'rejectSubmission') {
      if (!body.submissionId) {
        return NextResponse.json(
          { error: 'submissionId가 필요합니다.' },
          { status: 400 },
        );
      }

      await deleteSubmission(body.submissionId);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: '지원하지 않는 action입니다.' },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: 500 },
    );
  }
}
