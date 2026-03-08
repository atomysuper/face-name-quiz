const CHOSEONG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

export function normalizeName(value: string): string {
  return value.replace(/\s+/g, '').trim().toLowerCase();
}

export function cleanDisplayName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseAliases(value: string | string[] | undefined | null): string[] {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : value.split(',');
  const result = raw
    .map((item) => cleanDisplayName(item))
    .filter(Boolean);

  return Array.from(new Set(result));
}

export function isCorrectAnswer(
  input: string,
  correctName: string,
  aliases: string[] = [],
): boolean {
  const normalized = normalizeName(input);
  const candidates = [correctName, ...aliases].map(normalizeName);
  return candidates.includes(normalized);
}

export function sanitizeFileSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9가-힣_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '알 수 없는 오류가 발생했습니다.';
}

export function shuffle<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[target]] = [cloned[target], cloned[index]];
  }
  return cloned;
}

export function getHangulInitials(value: string): string {
  return [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        const offset = code - 0xac00;
        const initialIndex = Math.floor(offset / 588);
        return CHOSEONG[initialIndex];
      }

      if (/[a-zA-Z]/.test(char)) {
        return char.toUpperCase();
      }

      return char;
    })
    .join('');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
