import type { QuizFace } from '@/lib/types';
import { shuffle } from '@/lib/utils';

export type QuizProgressEntry = {
  seen: number;
  correct: number;
  wrong: number;
  streak: number;
  avgMs: number;
  dueAt: number;
  lastSeenAt: number;
};

export type QuizProgressMap = Record<string, QuizProgressEntry>;

export type MultipleChoiceOption = {
  faceId: string;
  personName: string;
  aliases: string[];
};

const DEFAULT_PROGRESS: QuizProgressEntry = {
  seen: 0,
  correct: 0,
  wrong: 0,
  streak: 0,
  avgMs: 0,
  dueAt: 0,
  lastSeenAt: 0,
};

function getEntry(progress: QuizProgressMap, faceId: string): QuizProgressEntry {
  return progress[faceId] ?? DEFAULT_PROGRESS;
}

function getCorrectDelayMs(streak: number, responseMs: number): number {
  const fastLadder = [
    0,
    5 * 60 * 1000,
    20 * 60 * 1000,
    60 * 60 * 1000,
    4 * 60 * 60 * 1000,
    12 * 60 * 60 * 1000,
  ];
  const slowLadder = [
    0,
    2 * 60 * 1000,
    10 * 60 * 1000,
    30 * 60 * 1000,
    60 * 60 * 1000,
    4 * 60 * 60 * 1000,
  ];

  const ladder = responseMs <= 3000 ? fastLadder : slowLadder;
  return ladder[Math.min(streak, ladder.length - 1)];
}

export function applyAttempt(
  progress: QuizProgressMap,
  faceId: string,
  correct: boolean,
  responseMs: number,
  now = Date.now(),
): QuizProgressMap {
  const current = getEntry(progress, faceId);

  const next: QuizProgressEntry = {
    seen: current.seen + 1,
    correct: current.correct + (correct ? 1 : 0),
    wrong: current.wrong + (correct ? 0 : 1),
    streak: correct ? current.streak + 1 : 0,
    avgMs:
      current.avgMs === 0
        ? responseMs
        : Math.round(current.avgMs * 0.7 + responseMs * 0.3),
    dueAt: correct
      ? now + getCorrectDelayMs(current.streak + 1, responseMs)
      : now + 30 * 1000,
    lastSeenAt: now,
  };

  return {
    ...progress,
    [faceId]: next,
  };
}

export function selectNextFace(
  faces: QuizFace[],
  progress: QuizProgressMap,
  previousFaceId?: string,
): QuizFace | null {
  if (faces.length === 0) {
    return null;
  }

  const now = Date.now();
  const weighted = faces.map((face) => {
    const entry = getEntry(progress, face.id);
    const dueBonus = entry.dueAt <= now ? 4 : 1;
    const wrongBonus = 1 + entry.wrong * 1.4;
    const unseenBonus = entry.seen === 0 ? 3 : 1;
    const speedBonus = entry.avgMs > 6000 ? 1.8 : 1;
    const repeatPenalty = face.id === previousFaceId ? 0.1 : 1;

    return {
      face,
      weight: dueBonus * wrongBonus * unseenBonus * speedBonus * repeatPenalty,
    };
  });

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);

  let cursor = Math.random() * total;

  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.face;
    }
  }

  return weighted[weighted.length - 1]?.face ?? null;
}

export function buildMultipleChoiceOptions(
  faces: QuizFace[],
  correctFace: QuizFace,
  count = 4,
): MultipleChoiceOption[] {
  const distractors = shuffle(faces.filter((face) => face.id !== correctFace.id)).reduce<QuizFace[]>(
    (result, face) => {
      if (result.some((item) => item.personName === face.personName)) {
        return result;
      }

      result.push(face);
      return result;
    },
    [],
  ).slice(0, Math.max(0, count - 1));

  return shuffle([correctFace, ...distractors])
    .slice(0, count)
    .map((face) => ({
      faceId: face.id,
      personName: face.personName,
      aliases: face.aliases,
    }));
}
