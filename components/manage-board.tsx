"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FaceCard } from '@/lib/types';
import { toErrorMessage } from '@/lib/utils';

type FilterMode = 'all' | 'pending' | 'approved';

type ManageResponse = {
  faces: FaceCard[];
  totalCount: number;
  counts: { all: number; pending: number; approved: number };
  page: { offset: number; limit: number; hasMore: boolean };
  error?: string;
};

const PAGE_SIZE = 48;

export function ManageBoard() {
  const [faces, setFaces] = useState<FaceCard[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [page, setPage] = useState(0);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (nextFilter: FilterMode, nextPage: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/manage-data?status=${nextFilter}&limit=${PAGE_SIZE}&offset=${nextPage * PAGE_SIZE}`,
        { cache: 'no-store' },
      );
      const payload = (await res.json()) as ManageResponse;
      if (!res.ok) throw new Error(payload.error ?? '관리 목록을 불러오지 못했습니다.');
      setFaces(payload.faces);
      setCounts(payload.counts);
      setTotalCount(payload.totalCount);
      setHasMore(payload.page.hasMore);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(filter, page); }, [filter, page, loadData]);

  function handleChangeFilter(nextFilter: FilterMode) {
    setMessage(null);
    setFilter(nextFilter);
    setPage(0);
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  async function handleDelete(faceId: string) {
    const target = faces.find((f) => f.id === faceId);
    const label = target?.personName ?? '이 얼굴';
    if (!window.confirm(`${label} 항목을 삭제할까요? 연결된 이름 제보와 퀴즈 기록도 함께 사라집니다.`)) return;

    setWorkingId(faceId); setMessage(null); setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteFace', faceId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? '얼굴 삭제에 실패했습니다.');

      const deletedStatus = target?.status;
      setCounts({
        all: Math.max(0, counts.all - 1),
        pending: deletedStatus === 'pending' ? Math.max(0, counts.pending - 1) : counts.pending,
        approved: deletedStatus === 'approved' ? Math.max(0, counts.approved - 1) : counts.approved,
      });
      setTotalCount((c) => Math.max(0, c - 1));
      setMessage('얼굴 항목을 삭제했습니다.');

      if (faces.length <= 1 && page > 0) {
        setPage((p) => Math.max(0, p - 1));
      } else {
        setFaces((cur) => cur.filter((f) => f.id !== faceId));
        void loadData(filter, page);
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="stack-lg animate-fade-up">
      <div className="card stack-md">
        <div className="tab-group" style={{ maxWidth: 400 }}>
          {(['all', 'pending', 'approved'] as FilterMode[]).map((f) => {
            const labels: Record<FilterMode, string> = { all: '전체', pending: '검토 대기', approved: '승인 완료' };
            const count = counts[f];
            return (
              <button
                key={f}
                className={`button ${filter === f ? 'primary' : ''}`}
                type="button"
                onClick={() => handleChangeFilter(f)}
              >
                {labels[f]}
                {count > 0 && (
                  <span style={{
                    background: filter === f ? 'rgba(255,255,255,0.25)' : 'var(--primary-surface)',
                    color: filter === f ? 'white' : 'var(--primary)',
                    borderRadius: 999,
                    padding: '1px 7px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    marginLeft: 2,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="row gap-sm">
          <button className="button ghost" type="button" onClick={() => void loadData(filter, page)} style={{ fontSize: '0.85rem', padding: '8px 14px' }}>
            새로고침
          </button>
          <p className="muted-text small-text">잘못 올린 얼굴은 여기서 삭제할 수 있습니다.</p>
        </div>
      </div>

      {message && (
        <div style={{ background: 'var(--success-surface)', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-sm)', padding: '12px 16px', color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>
          ✓ {message}
        </div>
      )}
      {errorMessage && (
        <div style={{ background: 'var(--danger-surface)', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', padding: '12px 16px', color: 'var(--danger)', fontWeight: 600, fontSize: '0.9rem' }}>
          {errorMessage}
        </div>
      )}

      <div className="row gap-sm wrap space-between manage-toolbar">
        <p className="muted-text small-text">
          총 {totalCount}개 중{' '}
          {totalCount === 0 ? 0 : page * PAGE_SIZE + 1}
          {` – ${Math.min(totalCount, (page + 1) * PAGE_SIZE)}`} 표시
        </p>
        <div className="row gap-sm manage-pagination">
          <button
            className="button ghost"
            type="button"
            disabled={loading || page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{ fontSize: '0.85rem', padding: '8px 14px' }}
          >
            이전
          </button>
          <span className="small-text muted-text" style={{ padding: '0 4px' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            className="button ghost"
            type="button"
            disabled={loading || !hasMore}
            onClick={() => setPage((p) => p + 1)}
            style={{ fontSize: '0.85rem', padding: '8px 14px' }}
          >
            다음
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <div className="loading-dots" style={{ justifyContent: 'center' }}>
            <span /><span /><span />
          </div>
          <p className="muted-text" style={{ marginTop: 12, fontSize: '0.9rem' }}>목록을 불러오는 중입니다</p>
        </div>
      ) : faces.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontWeight: 600 }}>표시할 얼굴이 없습니다.</p>
        </div>
      ) : (
        <div className="review-grid">
          {faces.map((face, index) => (
            <article key={face.id} className="review-card">
              <img src={face.cropUrl} alt={`관리 얼굴 ${index + 1}`} loading="lazy" />
              <div className="stack-sm">
                <div>
                  <p className="small-text" style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {face.personName ?? '이름 미지정'}
                  </p>
                  <p className="small-text muted-text" style={{ marginTop: 2 }}>{face.photoLabel ?? '사진 이름 없음'}</p>
                  <span style={{
                    display: 'inline-block',
                    marginTop: 4,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: face.status === 'approved' ? 'var(--success-surface)' : '#FEF3C7',
                    color: face.status === 'approved' ? 'var(--success)' : '#92400E',
                  }}>
                    {face.status === 'approved' ? '승인 완료' : '검토 대기'}
                  </span>
                </div>
                <p className="small-text muted-text">#{page * PAGE_SIZE + index + 1}</p>
                <button
                  className="button danger"
                  type="button"
                  disabled={workingId === face.id}
                  onClick={() => void handleDelete(face.id)}
                  style={{ fontSize: '0.85rem', marginTop: 'auto' }}
                >
                  {workingId === face.id ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
