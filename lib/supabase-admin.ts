import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getServerEnv } from '@/lib/env';
import type {
  AttemptPayload,
  BoundingBox,
  FaceCard,
  FaceStatus,
  PersonRecord,
  SubmissionRecord,
} from '@/lib/types';
import {
  cleanDisplayName,
  parseAliases,
  sanitizeFileSegment,
  toErrorMessage,
} from '@/lib/utils';

type SupabaseAdminClient = SupabaseClient;

const globalForSupabase = globalThis as typeof globalThis & {
  __faceQuizSupabase?: SupabaseAdminClient;
};

function createSupabaseAdmin(): SupabaseAdminClient {
  const env = getServerEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabaseAdmin =
  globalForSupabase.__faceQuizSupabase ?? createSupabaseAdmin();

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.__faceQuizSupabase = supabaseAdmin;
}

function ensureNoError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function ensureData<T>(data: T | null, context: string): T {
  if (data === null) {
    throw new Error(`${context}: 결과 데이터가 비어 있습니다.`);
  }

  return data;
}

function normalizeBoundingBox(raw: unknown): BoundingBox {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    x: Number(value.x ?? 0),
    y: Number(value.y ?? 0),
    w: Number(value.w ?? 0),
    h: Number(value.h ?? 0),
  };
}

async function createSignedUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  ensureNoError(error, 'signed url 생성 실패');

  if (!data?.signedUrl) {
    throw new Error('signed url 생성 결과가 비어 있습니다.');
  }

  return data.signedUrl;
}

async function loadPeopleMap(personIds: string[]): Promise<Map<string, PersonRecord>> {
  const uniqueIds = Array.from(new Set(personIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from('people')
    .select('id, name, aliases, created_at')
    .in('id', uniqueIds);

  ensureNoError(error, 'people 조회 실패');

  return new Map(
    (data ?? []).map((person) => [
      person.id,
      {
        id: person.id,
        name: person.name,
        aliases: person.aliases ?? [],
        createdAt: person.created_at,
      },
    ]),
  );
}

async function loadPhotoLabelMap(photoIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(photoIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from('photos')
    .select('id, label')
    .in('id', uniqueIds);

  ensureNoError(error, 'photos 조회 실패');

  return new Map((data ?? []).map((photo) => [photo.id, photo.label]));
}

export async function listPeople(): Promise<PersonRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('people')
    .select('id, name, aliases, created_at')
    .order('name', { ascending: true });

  ensureNoError(error, 'people 목록 조회 실패');

  return (data ?? []).map((person) => ({
    id: person.id,
    name: person.name,
    aliases: person.aliases ?? [],
    createdAt: person.created_at,
  }));
}

export async function listFaces(
  status: FaceStatus,
  limit = 100,
): Promise<FaceCard[]> {
  const { data, error } = await supabaseAdmin
    .from('faces')
    .select('id, photo_id, crop_path, status, person_id, bbox, created_at, sort_index')
    .eq('status', status)
    .order('created_at', { ascending: true })
    .order('sort_index', { ascending: true })
    .limit(limit);

  ensureNoError(error, 'faces 조회 실패');

  const rows = data ?? [];
  const peopleMap = await loadPeopleMap(
    rows.map((row) => row.person_id).filter(Boolean) as string[],
  );
  const photoLabelMap = await loadPhotoLabelMap(rows.map((row) => row.photo_id));
  const signedUrls = await Promise.all(
    rows.map((row) => createSignedUrl('face-crops', row.crop_path)),
  );

  return rows.map((row, index) => {
    const person = row.person_id ? peopleMap.get(row.person_id) : null;
    return {
      id: row.id,
      photoId: row.photo_id,
      photoLabel: photoLabelMap.get(row.photo_id),
      cropPath: row.crop_path,
      cropUrl: signedUrls[index],
      status: row.status,
      personId: row.person_id,
      personName: person?.name ?? null,
      aliases: person?.aliases ?? [],
      bbox: normalizeBoundingBox(row.bbox),
      createdAt: row.created_at,
    };
  });
}

export async function listPendingFacesForReview(limit = 120): Promise<FaceCard[]> {
  const faces = await listFaces('pending', limit);
  const faceIds = faces.map((face) => face.id);

  if (faceIds.length === 0) {
    return faces;
  }

  const { data, error } = await supabaseAdmin
    .from('name_submissions')
    .select('id, face_id, submitted_name, submitted_by, approved, created_at')
    .in('face_id', faceIds)
    .order('created_at', { ascending: false });

  ensureNoError(error, 'name_submissions 조회 실패');

  const submissionsByFace = new Map<string, SubmissionRecord[]>();

  for (const row of data ?? []) {
    const current = submissionsByFace.get(row.face_id) ?? [];
    current.push({
      id: row.id,
      faceId: row.face_id,
      submittedName: row.submitted_name,
      submittedBy: row.submitted_by,
      approved: row.approved,
      createdAt: row.created_at,
    });
    submissionsByFace.set(row.face_id, current);
  }

  return faces.map((face) => ({
    ...face,
    submissions: submissionsByFace.get(face.id) ?? [],
  }));
}

async function getOrCreatePerson(
  personName: string,
  aliases: string[] = [],
): Promise<PersonRecord> {
  const cleanName = cleanDisplayName(personName);

  if (!cleanName) {
    throw new Error('사람 이름이 비어 있습니다.');
  }

  const { data: existingList, error: existingError } = await supabaseAdmin
    .from('people')
    .select('id, name, aliases, created_at')
    .eq('name', cleanName)
    .limit(1);

  ensureNoError(existingError, '기존 사람 조회 실패');

  const existing = existingList?.[0];

  if (existing) {
    const mergedAliases = Array.from(
      new Set([...(existing.aliases ?? []), ...parseAliases(aliases)]),
    );

    if (mergedAliases.length !== (existing.aliases ?? []).length) {
      const { error: updateError } = await supabaseAdmin
        .from('people')
        .update({ aliases: mergedAliases })
        .eq('id', existing.id);

      ensureNoError(updateError, '사람 alias 업데이트 실패');
    }

    return {
      id: existing.id,
      name: existing.name,
      aliases: mergedAliases,
      createdAt: existing.created_at,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('people')
    .insert({
      name: cleanName,
      aliases: parseAliases(aliases),
    })
    .select('id, name, aliases, created_at')
    .single();

  ensureNoError(error, '사람 생성 실패');

  const createdPerson = ensureData(data, '사람 생성 결과 확인 실패');

  return {
    id: createdPerson.id,
    name: createdPerson.name,
    aliases: createdPerson.aliases ?? [],
    createdAt: createdPerson.created_at,
  };
}

export async function createPhotoAndFaces(params: {
  label: string;
  photoFile: File;
  crops: Array<{
    file: File;
    bbox: BoundingBox;
    index: number;
  }>;
}): Promise<{ photoId: string; faceCount: number }> {
  const photoBaseName = sanitizeFileSegment(params.label || params.photoFile.name || 'photo');
  const photoPath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${photoBaseName || 'group-photo'}`;

  const { error: uploadPhotoError } = await supabaseAdmin.storage
    .from('group-photos')
    .upload(photoPath, params.photoFile, {
      contentType: params.photoFile.type || 'image/jpeg',
      upsert: false,
    });

  ensureNoError(uploadPhotoError, '원본 사진 업로드 실패');

  const { data: photoRow, error: photoInsertError } = await supabaseAdmin
    .from('photos')
    .insert({
      label: cleanDisplayName(params.label || params.photoFile.name || '단체사진'),
      original_path: photoPath,
    })
    .select('id')
    .single();

  ensureNoError(photoInsertError, 'photos insert 실패');

  const createdPhoto = ensureData(photoRow, 'photos insert 결과 확인 실패');

  const faceRows: Array<{
    photo_id: string;
    crop_path: string;
    bbox: BoundingBox;
    status: 'pending';
    sort_index: number;
  }> = [];

  for (const crop of params.crops) {
    const cropPath = `${createdPhoto.id}/${String(crop.index).padStart(3, '0')}-${crypto.randomUUID()}.jpg`;

    const { error: cropUploadError } = await supabaseAdmin.storage
      .from('face-crops')
      .upload(cropPath, crop.file, {
        contentType: crop.file.type || 'image/jpeg',
        upsert: false,
      });

    ensureNoError(cropUploadError, `crop 업로드 실패 (${crop.index})`);

    faceRows.push({
      photo_id: createdPhoto.id,
      crop_path: cropPath,
      bbox: crop.bbox,
      status: 'pending',
      sort_index: crop.index,
    });
  }

  if (faceRows.length > 0) {
    const { error: faceInsertError } = await supabaseAdmin
      .from('faces')
      .insert(faceRows);

    ensureNoError(faceInsertError, 'faces insert 실패');
  }

  return {
    photoId: createdPhoto.id,
    faceCount: faceRows.length,
  };
}

export async function createNameSubmission(params: {
  faceId: string;
  submittedName: string;
  submittedBy?: string | null;
}): Promise<void> {
  const submittedName = cleanDisplayName(params.submittedName);
  const submittedBy = cleanDisplayName(params.submittedBy ?? '');

  if (!submittedName) {
    throw new Error('제출할 이름을 입력해주세요.');
  }

  const { error } = await supabaseAdmin.from('name_submissions').insert({
    face_id: params.faceId,
    submitted_name: submittedName,
    submitted_by: submittedBy || null,
  });

  ensureNoError(error, '이름 제출 실패');
}

export async function approveFaceWithName(params: {
  faceId: string;
  personName: string;
  aliases?: string[];
  approvedSubmissionId?: string | null;
}): Promise<PersonRecord> {
  const person = await getOrCreatePerson(params.personName, params.aliases ?? []);

  const { error: faceUpdateError } = await supabaseAdmin
    .from('faces')
    .update({
      person_id: person.id,
      status: 'approved',
    })
    .eq('id', params.faceId);

  ensureNoError(faceUpdateError, 'face 승인 실패');

  const { error: resetError } = await supabaseAdmin
    .from('name_submissions')
    .update({ approved: false })
    .eq('face_id', params.faceId);

  ensureNoError(resetError, 'submission 초기화 실패');

  if (params.approvedSubmissionId) {
    const { error: markError } = await supabaseAdmin
      .from('name_submissions')
      .update({ approved: true })
      .eq('id', params.approvedSubmissionId);

    ensureNoError(markError, 'submission 승인 실패');
  }

  return person;
}


export async function updateApprovedFace(params: {
  faceId: string;
  personName: string;
  aliases?: string[];
}): Promise<PersonRecord> {
  const person = await getOrCreatePerson(params.personName, params.aliases ?? []);

  const { error } = await supabaseAdmin
    .from('faces')
    .update({
      person_id: person.id,
      status: 'approved',
    })
    .eq('id', params.faceId);

  ensureNoError(error, '승인 얼굴 수정 실패');

  return person;
}

export async function reopenApprovedFace(faceId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('faces')
    .update({
      person_id: null,
      status: 'pending',
    })
    .eq('id', faceId);

  ensureNoError(error, '승인 얼굴을 다시 검토 상태로 변경하지 못했습니다.');
}


export async function deleteFace(faceId: string): Promise<void> {
  const { data: faceRow, error: fetchError } = await supabaseAdmin
    .from('faces')
    .select('id, photo_id, crop_path')
    .eq('id', faceId)
    .maybeSingle();

  ensureNoError(fetchError, '삭제할 face 조회 실패');

  if (!faceRow) {
    throw new Error('삭제할 얼굴을 찾지 못했습니다.');
  }

  const { error: deleteError } = await supabaseAdmin
    .from('faces')
    .delete()
    .eq('id', faceId);

  ensureNoError(deleteError, '얼굴 삭제 실패');

  const { error: storageError } = await supabaseAdmin.storage
    .from('face-crops')
    .remove([faceRow.crop_path]);

  ensureNoError(storageError, '얼굴 이미지 삭제 실패');

  const { count, error: countError } = await supabaseAdmin
    .from('faces')
    .select('id', { count: 'exact', head: true })
    .eq('photo_id', faceRow.photo_id);

  ensureNoError(countError, '남은 얼굴 수 확인 실패');

  if ((count ?? 0) === 0) {
    const { data: photoRow, error: photoFetchError } = await supabaseAdmin
      .from('photos')
      .select('id, original_path')
      .eq('id', faceRow.photo_id)
      .maybeSingle();

    ensureNoError(photoFetchError, '원본 사진 조회 실패');

    if (photoRow) {
      const { error: photoDeleteError } = await supabaseAdmin
        .from('photos')
        .delete()
        .eq('id', photoRow.id);

      ensureNoError(photoDeleteError, '원본 사진 레코드 삭제 실패');

      const { error: originalStorageError } = await supabaseAdmin.storage
        .from('group-photos')
        .remove([photoRow.original_path]);

      ensureNoError(originalStorageError, '원본 사진 파일 삭제 실패');
    }
  }
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('name_submissions')
    .delete()
    .eq('id', submissionId);

  ensureNoError(error, 'submission 삭제 실패');
}

export async function recordQuizAttempt(payload: AttemptPayload): Promise<void> {
  const guessedName = cleanDisplayName(payload.guessedName);

  const { error } = await supabaseAdmin.from('quiz_attempts').insert({
    face_id: payload.faceId,
    guessed_name: guessedName,
    correct: payload.correct,
    response_ms: payload.responseMs,
  });

  ensureNoError(error, 'quiz_attempts 저장 실패');
}

export function errorMessageWithContext(context: string, error: unknown): Error {
  return new Error(`${context}: ${toErrorMessage(error)}`);
}
