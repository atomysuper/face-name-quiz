import { getConfiguredSitePasscode } from '@/lib/env';

export const SITE_COOKIE_NAME = 'dreami_school_gate_v2';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}

export async function isValidSitePasscode(input: string): Promise<boolean> {
  const sitePasscode = getConfiguredSitePasscode();
  const [inputHash, expectedHash] = await Promise.all([
    sha256Hex(input),
    sha256Hex(sitePasscode),
  ]);

  return constantTimeEqual(inputHash, expectedHash);
}

export async function getSiteSessionToken(): Promise<string> {
  const sitePasscode = getConfiguredSitePasscode();
  const sessionSecret = process.env.SITE_SESSION_SECRET ?? process.env.SESSION_SECRET ?? sitePasscode;
  return sha256Hex(`${sitePasscode}:${sessionSecret}:site-access:v2`);
}
