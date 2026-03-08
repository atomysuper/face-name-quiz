import { NextResponse } from 'next/server';

import { listFaces } from '@/lib/supabase-admin';
import type { FaceStatus } from '@/lib/types';
import { clamp, toErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get('status');
    const rawLimit = Number(url.searchParams.get('limit') ?? '100');

    const status: FaceStatus =
      rawStatus === 'pending' ? 'pending' : 'approved';
    const limit = clamp(Number.isFinite(rawLimit) ? rawLimit : 100, 1, 500);

    const faces = await listFaces(status, limit);
    const filtered =
      status === 'approved'
        ? faces.filter((face) => Boolean(face.personId) && Boolean(face.personName))
        : faces;

    return NextResponse.json(
      { faces: filtered },
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
