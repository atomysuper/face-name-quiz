import { NextResponse } from 'next/server';

import { rejectUnlessAdmin } from '@/lib/admin-auth';
import { rejectUnlessSiteAccess } from '@/lib/site-auth';
import { createPhotoAndFaces } from '@/lib/supabase-admin';
import type { ImportFacePayload } from '@/lib/types';
import { cleanDisplayName, toErrorMessage } from '@/lib/utils';

export async function POST(request: Request) {
  const siteUnauthorizedResponse = await rejectUnlessSiteAccess();
  if (siteUnauthorizedResponse) {
    return siteUnauthorizedResponse;
  }

  const unauthorizedResponse = await rejectUnlessAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const formData = await request.formData();
    const label = cleanDisplayName(String(formData.get('label') ?? ''));
    const photo = formData.get('photo');
    const facesRaw = formData.get('faces');

    if (!(photo instanceof File)) {
      return NextResponse.json(
        { error: '원본 사진 파일이 없습니다.' },
        { status: 400 },
      );
    }

    if (typeof facesRaw !== 'string') {
      return NextResponse.json(
        { error: '얼굴 metadata가 없습니다.' },
        { status: 400 },
      );
    }

    const metadata = JSON.parse(facesRaw) as ImportFacePayload[];

    const crops = metadata.map((item) => {
      const file = formData.get(item.fieldName);

      if (!(file instanceof File)) {
        throw new Error(`crop 파일이 없습니다: ${item.fieldName}`);
      }

      return {
        file,
        bbox: item.bbox,
        index: item.index,
      };
    });

    const result = await createPhotoAndFaces({
      label: label || photo.name,
      photoFile: photo,
      crops,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: 500 },
    );
  }
}
