"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { toErrorMessage } from '@/lib/utils';

export function SiteEntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const nextPath = searchParams.get('next') ?? '/quiz';
      const response = await fetch('/api/site-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode, nextPath }),
      });

      const payload = (await response.json()) as { error?: string; nextPath?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? '입장에 실패했습니다.');
      }

      router.push(payload.nextPath ?? nextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack-md card" onSubmit={handleSubmit}>
      <div className="stack-xs">
        <label className="label" htmlFor="site-passcode">
          입장 비밀번호
        </label>
        <input
          id="site-passcode"
          className="input"
          type="password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          placeholder="비밀번호를 입력하세요"
          autoComplete="current-password"
          required
        />
      </div>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <button className="button primary" type="submit" disabled={loading}>
        {loading ? '확인 중...' : '입장하기'}
      </button>
    </form>
  );
}
