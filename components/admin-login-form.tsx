"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { toErrorMessage } from '@/lib/utils';

export function AdminLoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? '로그인에 실패했습니다.');
      }

      router.push('/admin/upload');
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
        <label className="label" htmlFor="admin-passcode">
          관리자 비밀번호
        </label>
        <input
          id="admin-passcode"
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
        {loading ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
