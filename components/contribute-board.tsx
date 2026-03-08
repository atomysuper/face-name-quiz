"use client";

import { useEffect, useState } from 'react';

import type { FaceCard } from '@/lib/types';
import { toErrorMessage } from '@/lib/utils';

type FacesResponse = {
  faces: FaceCard[];
  error?: string;
};

export function ContributeBoard() {
  const [faces, setFaces] = useState<FaceCard[]>([]);
  const [submittedBy, setSubmittedBy] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submittingFaceId, setSubmittingFaceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadFaces() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/faces?status=pending&limit=120', {
        cache: 'no-store',
      });
      const payload = (await response.json()) as FacesResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? '얼굴 목록을 불러오지 못했습니다.');
      }

      setFaces(payload.faces);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFaces();
  }, []);

  async function handleSubmit(faceId: string) {
    const submittedName = drafts[faceId]?.trim();

    if (!submittedName) {
      setErrorMessage('이름을 입력한 뒤 제출해주세요.');
      return;
    }

    setSubmittingFaceId(faceId);
    setErrorMessage(null);
    setMessage(null);

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          faceId,
          submittedName,
          submittedBy,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? '이름 제출에 실패했습니다.');
      }

      setFaces((current) => current.filter((face) => face.id !== faceId));
      setDrafts((current) => {
        const next = { ...current };
        delete next[faceId];
        return next;
      });
      setMessage(`제출 완료: ${submittedName}`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSubmittingFaceId(null);
    }
  }

  if (loading) {
    return <p className="muted-text">이름을 기다리는 얼굴을 불러오는 중입니다...</p>;
  }

  return (
    <section className="stack-lg">
      <div className="card stack-md">
        <div className="stack-xs">
          <label className="label" htmlFor="submitted-by">
            제출자 이름 (선택)
          </label>
          <input
            id="submitted-by"
            className="input"
            type="text"
            value={submittedBy}
            onChange={(event) => setSubmittedBy(event.target.value)}
            placeholder="예: 담임교사, 홍길동"
          />
        </div>

        <p className="muted-text">
          얼굴을 보고 이름을 적어주세요. 관리자가 검토한 뒤 퀴즈에 반영됩니다.
        </p>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      {faces.length === 0 ? (
        <div className="card">
          <p>지금은 이름을 기다리는 얼굴이 없습니다.</p>
        </div>
      ) : (
        <div className="face-grid">
          {faces.map((face, index) => (
            <article key={face.id} className="face-card">
              <img src={face.cropUrl} alt={`이름 제보용 얼굴 ${index + 1}`} />
              <div className="stack-xs">
                <input
                  className="input"
                  type="text"
                  value={drafts[face.id] ?? ''}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [face.id]: event.target.value,
                    }))
                  }
                  placeholder="이름 입력"
                />
                <button
                  className="button primary"
                  type="button"
                  disabled={submittingFaceId === face.id}
                  onClick={() => void handleSubmit(face.id)}
                >
                  {submittingFaceId === face.id ? '제출 중...' : '이 이름 제출'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
