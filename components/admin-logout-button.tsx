"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
      });
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="button ghost" type="button" onClick={handleLogout} disabled={loading}>
      {loading ? '로그아웃 중...' : '관리자 로그아웃'}
    </button>
  );
}
