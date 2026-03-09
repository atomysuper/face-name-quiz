"use client";

import { useEffect, useMemo, useState } from 'react';

import type { FaceCard } from '@/lib/types';
import { toErrorMessage } from '@/lib/utils';

type ManageResponse = {
  faces: FaceCard[];
  error?: string;
};

type FilterMode = 'all' | 'pending' | 'approved';

export function ManageBoard() {
  const [faces, setFaces] = useState<FaceCard[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/manage-data', {
        cache: 'no-store',
      });
      const payload = (await response.json()) as ManageResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? '관리 목록을 불러오지 못했습니다.');
      }

      setFaces(payload.faces);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredFaces = useMemo(() => {
    if (filter === 'all') {
      return faces;
    }

    return faces.filter((face) => face.status === filter);
  }, [faces, filter]);

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

      setFaces((current) => current.filter((face) => face.id !== faceId));
      setMessage('얼굴 항목을 삭제했습니다.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) {
    return <p className="muted-text">관리 목록을 불러오는 중입니다...</p>;
  }

  return (
    <section className="stack-lg">
      <div className="card stack-sm">
        <div className="row gap-sm wrap">
          <button
            className={`button ${filter === 'all' ? 'primary' : 'ghost'}`}
            type="button"
            onClick={() => setFilter('all')}
          >
            전체 {faces.length}
          </button>
          <button
            className={`button ${filter === 'pending' ? 'primary' : 'ghost'}`}
            type="button"
            onClick={() => setFilter('pending')}
          >
            검토 대기 {faces.filter((face) => face.status === 'pending').length}
          </button>
          <button
            className={`button ${filter === 'approved' ? 'primary' : 'ghost'}`}
            type="button"
            onClick={() => setFilter('approved')}
          >
            승인 완료 {faces.filter((face) => face.status === 'approved').length}
          </button>
          <button className="button ghost" type="button" onClick={() => void loadData()}>
            새로고침
          </button>
        </div>
        <p className="muted-text">
          잘못 올린 얼굴을 여기서 삭제할 수 있습니다. 같은 원본 사진에 얼굴이 하나도 남지 않으면 원본 사진도 함께 정리됩니다.
        </p>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      {filteredFaces.length === 0 ? (
        <div className="card">
          <p>표시할 얼굴이 없습니다.</p>
        </div>
      ) : (
        <div className="review-grid">
          {filteredFaces.map((face, index) => (
            <article key={face.id} className="review-card">
              <img src={face.cropUrl} alt={`관리 얼굴 ${index + 1}`} />
              <div className="stack-sm">
                <div className="stack-xs">
                  <p className="small-text">#{index + 1}</p>
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
