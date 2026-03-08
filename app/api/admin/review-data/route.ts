import { NextResponse } from 'next/server';

import { rejectUnlessAdmin } from '@/lib/admin-auth';
import { listPendingFacesForReview, listPeople } from '@/lib/supabase-admin';
import { toErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const unauthorizedResponse = await rejectUnlessAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const [faces, people] = await Promise.all([
      listPendingFacesForReview(150),
      listPeople(),
    ]);

    return NextResponse.json(
      { faces, people },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: 500 },
    );
  }
}
