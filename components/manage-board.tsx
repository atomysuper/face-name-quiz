"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FaceCard } from '@/lib/types';
import { toErrorMessage } from '@/lib/utils';

type FilterMode = 'all' | 'pending' | 'approved';

type ManageResponse = {
  faces: FaceCard[];
  totalCount: number;
  counts: {
    all: number;
    pending: number;
    approved: number;
  };
  page: {
    offset: number;
    limit: number;
    hasMore: boolean;
  };
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

  const loadData = useCallback(
    async (nextFilter: FilterMode, nextPage: number) => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const statusParam = nextFilter === 'all' ? 'all' : nextFilter;
        const response = await fetch(
          `/api/admin/manage-data?status=${statusParam}&limit=${PAGE_SIZE}&offset=${nextPage * PAGE_SIZE}`,
          {
            cache: 'no-store',
          },
        );
        const payload = (await response.json()) as ManageResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? '관리 목록을 불러오지 못했습니다.');
        }

        setFaces(payload.faces);
        setCounts(payload.counts);
        setTotalCount(payload.totalCount);
        setHasMore(payload.page.hasMore);
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadData(filter, page);
  }, [filter, page, loadData]);

  function handleChangeFilter(nextFilter: FilterMode) {
    setMessage(null);
    setFilter(nextFilter);
    setPage(0);
  }

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  async function handleDelete(faceId: string) {
    const target = faces.find((face) => face.id === faceId);
    const label = target?.personName ?? '이 얼굴';

    const confirmed = window.confirm(`${label} 항목을 삭제할까요? 연결된 이름 제보와 퀴즈 기록도 함께 사라집니다.`);
    if (!confirmed) {
      return;
    }

    setWorkingId(faceId);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deleteFace',
          faceId,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '얼굴 삭제에 실패했습니다.');
      }

      const deletedStatus = target?.status;
      const nextCounts = {
        all: Math.max(0, counts.all - 1),
        pending:
          deletedStatus === 'pending'
            ? Math.max(0, counts.pending - 1)
            : counts.pending,
        approved:
          deletedStatus === 'approved'
            ? Math.max(0, counts.approved - 1)
            : counts.approved,
      };

      const nextTotalCount = Math.max(0, totalCount - 1);
      const currentPageWouldBeEmpty = faces.length <= 1 && page > 0;

      setCounts(nextCounts);
      setTotalCount(nextTotalCount);
      setMessage('얼굴 항목을 삭제했습니다.');

      if (currentPageWouldBeEmpty) {
        setPage((current) => Math.max(0, current - 1));
      } else {
        setFaces((current) => current.filter((face) => face.id !== faceId));
        void loadData(filter, page);
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="stack-lg">
      <div className="card stack-sm">
        <div className="row gap-sm wrap">
          <button
            className={`button ${filter === 'all' ? 'primary' : 'ghost'}`}
            type="button"
            onClick={() => handleChangeFilter('all')}
          >
            전체 {counts.all}
          </button>
          <button
            className={`button ${filter === 'pending' ? 'primary' : 'ghost'}`}
            type="button"
            onClick={() => handleChangeFilter('pending')}
          >
            검토 대기 {counts.pending}
          </button>
          <button
            className={`button ${filter === 'approved' ? 'primary' : 'ghost'}`}
            type="button"
            onClick={() => handleChangeFilter('approved')}
          >
            승인 완료 {counts.approved}
          </button>
          <button className="button ghost" type="button" onClick={() => void loadData(filter, page)}>
            새로고침
          </button>
        </div>
        <p className="muted-text">
          한 번에 모든 사진을 다 불러오지 않고 현재 페이지만 가져오도록 바꿔서 훨씬 빨라졌습니다. 잘못 올린 얼굴은 여기서 삭제할 수 있습니다.
        </p>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <div className="row gap-sm wrap space-between manage-toolbar">
        <p className="muted-text small-text">
          총 {totalCount}개 중 {totalCount === 0 ? 0 : page * PAGE_SIZE + 1}
          {` - ${totalCount === 0 ? 0 : Math.min(totalCount, (page + 1) * PAGE_SIZE)}`} 표시
        </p>
        <div className="row gap-sm wrap manage-pagination">
          <button
            className="button ghost"
            type="button"
            disabled={loading || page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            이전
          </button>
          <span className="small-text muted-text">
            {page + 1} / {totalPages}
          </span>
          <button
            className="button ghost"
            type="button"
            disabled={loading || !hasMore}
            onClick={() => setPage((current) => current + 1)}
          >
            다음
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted-text">관리 목록을 불러오는 중입니다...</p>
      ) : faces.length === 0 ? (
        <div className="card">
          <p>표시할 얼굴이 없습니다.</p>
        </div>
      ) : (
        <div className="review-grid">
          {faces.map((face, index) => (
            <article key={face.id} className="review-card">
              <img src={face.cropUrl} alt={`관리 얼굴 ${index + 1}`} loading="lazy" />
              <div className="stack-sm">
                <div className="stack-xs">
                  <p className="small-text">#{page * PAGE_SIZE + index + 1}</p>
                  <p className="small-text muted-text">{face.photoLabel ?? '사진 이름 없음'}</p>
                  <p className="small-text muted-text">상태: {face.status === 'approved' ? '승인 완료' : '검토 대기'}</p>
                  <p className="small-text muted-text">이름: {face.personName ?? '미지정'}</p>
                </div>
                <button
                  className="button danger"
                  type="button"
                  disabled={workingId === face.id}
                  onClick={() => void handleDelete(face.id)}
                >
                  {workingId === face.id ? '삭제 중...' : '이 얼굴 삭제'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
