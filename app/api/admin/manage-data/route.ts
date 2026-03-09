import { NextResponse } from 'next/server';

import { rejectUnlessAdmin } from '@/lib/admin-auth';
import { listFaces } from '@/lib/supabase-admin';
import { toErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const unauthorizedResponse = await rejectUnlessAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const [pendingFaces, approvedFaces] = await Promise.all([
      listFaces('pending', 300),
      listFaces('approved', 500),
    ]);

    return NextResponse.json(
      {
        faces: [...pendingFaces, ...approvedFaces],
      },
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
