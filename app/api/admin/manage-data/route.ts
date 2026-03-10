import { NextResponse } from 'next/server';

import { rejectUnlessAdmin } from '@/lib/admin-auth';
import { rejectUnlessSiteAccess } from '@/lib/site-auth';
import { countFaces, listFacesPage } from '@/lib/supabase-admin';
import type { FaceStatus } from '@/lib/types';
import { clamp, toErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const siteUnauthorizedResponse = await rejectUnlessSiteAccess();
  if (siteUnauthorizedResponse) {
    return siteUnauthorizedResponse;
  }

  const unauthorizedResponse = await rejectUnlessAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get('status');
    const rawLimit = Number(url.searchParams.get('limit') ?? '48');
    const rawOffset = Number(url.searchParams.get('offset') ?? '0');

    const status: FaceStatus | undefined =
      rawStatus === 'pending'
        ? 'pending'
        : rawStatus === 'approved'
          ? 'approved'
          : undefined;

    const limit = clamp(Number.isFinite(rawLimit) ? rawLimit : 48, 1, 120);
    const offset = Math.max(0, Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0);

    const [faces, pendingCount, approvedCount, totalCount] = await Promise.all([
      listFacesPage({ status, limit, offset, ascending: false }),
      countFaces('pending'),
      countFaces('approved'),
      countFaces(status),
    ]);

    return NextResponse.json(
      {
        faces,
        totalCount,
        counts: {
          all: pendingCount + approvedCount,
          pending: pendingCount,
          approved: approvedCount,
        },
        page: {
          offset,
          limit,
          hasMore: offset + faces.length < totalCount,
        },
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
