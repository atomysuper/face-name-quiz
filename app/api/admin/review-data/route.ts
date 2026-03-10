import { NextResponse } from 'next/server';

import { rejectUnlessAdmin } from '@/lib/admin-auth';
import { rejectUnlessSiteAccess } from '@/lib/site-auth';
import { listFaces, listPendingFacesForReview, listPeople } from '@/lib/supabase-admin';
import { toErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const siteUnauthorizedResponse = await rejectUnlessSiteAccess();
  if (siteUnauthorizedResponse) {
    return siteUnauthorizedResponse;
  }

  const unauthorizedResponse = await rejectUnlessAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const [pendingFaces, approvedFaces, people] = await Promise.all([
      listPendingFacesForReview(150),
      listFaces('approved', 250),
      listPeople(),
    ]);

    return NextResponse.json(
      { pendingFaces, approvedFaces, people },
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
