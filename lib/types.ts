export type FaceStatus = 'pending' | 'approved';

export type BoundingBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DetectedCrop = {
  id: string;
  bbox: BoundingBox;
  blob: Blob;
  previewUrl: string;
  source: 'auto' | 'manual';
};

export type PersonRecord = {
  id: string;
  name: string;
  aliases: string[];
  createdAt?: string;
};

export type SubmissionRecord = {
  id: string;
  faceId: string;
  submittedName: string;
  submittedBy: string | null;
  approved: boolean;
  createdAt: string;
};

export type FaceCard = {
  id: string;
  photoId: string;
  photoLabel?: string;
  cropPath: string;
  cropUrl: string;
  status: FaceStatus;
  personId: string | null;
  personName: string | null;
  aliases: string[];
  bbox: BoundingBox;
  submissions?: SubmissionRecord[];
  createdAt: string;
};

export type ReviewDataResponse = {
  pendingFaces: FaceCard[];
  approvedFaces: FaceCard[];
  people: PersonRecord[];
};

export type ImportFacePayload = {
  bbox: BoundingBox;
  fieldName: string;
  index: number;
};

export type AttemptPayload = {
  faceId: string;
  guessedName: string;
  correct: boolean;
  responseMs: number;
};

export type QuizFace = FaceCard & {
  personId: string;
  personName: string;
};
