"use client";

import { useEffect, useState } from 'react';

import type { FaceCard } from '@/lib/types';
import { toErrorMessage } from '@/lib/utils';

type FacesResponse = { faces: FaceCard[]; error?: string };

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
      const response = await fetch('/api/faces?status=pending&limit=120', { cache: 'no-store' });
      const payload = (await response.json()) as FacesResponse;
      if (!response.ok) throw new Error(payload.error ?? '얼굴 목록을 불러오지 못했습니다.');
      setFaces(payload.faces);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadFaces(); }, []);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceId, submittedName, submittedBy }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '이름 제출에 실패했습니다.');

      setFaces((cur) => cur.filter((f) => f.id !== faceId));
      setDrafts((cur) => {
        const next = { ...cur };
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
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div className="loading-dots" style={{ justifyContent: 'center' }}>
          <span /><span /><span />
        </div>
        <p className="muted-text" style={{ marginTop: 12, fontSize: '0.9rem' }}>얼굴 목록을 불러오는 중입니다</p>
      </div>
    );
  }

  return (
    <section className="stack-lg animate-fade-up">
      <div className="card stack-md">
        <div className="stack-xs">
          <label className="label" htmlFor="submitted-by">
            제출자 이름 <span className="muted-text" style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.82rem' }}>(선택사항)</span>
          </label>
          <input
            id="submitted-by"
            className="input"
            type="text"
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
            placeholder="예: 담임교사, 홍길동"
            style={{ maxWidth: 320 }}
          />
        </div>
        <p className="muted-text" style={{ fontSize: '0.9rem' }}>
          얼굴을 보고 이름을 적어주세요. 관리자 검토 후 퀴즈에 반영됩니다.
        </p>
      </div>

      {message && (
        <div style={{
          background: 'var(--success-surface)',
          border: '1px solid #A7F3D0',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          color: 'var(--success)',
          fontWeight: 600,
          fontSize: '0.9rem',
          animation: 'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          ✓ {message}
        </div>
      )}

      {errorMessage && (
        <div style={{
          background: 'var(--danger-surface)',
          border: '1px solid #FECACA',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          color: 'var(--danger)',
          fontWeight: 600,
          fontSize: '0.9rem',
        }}>
          {errorMessage}
        </div>
      )}

      {faces.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>✨</p>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>지금은 이름을 기다리는 얼굴이 없습니다</p>
          <p className="muted-text" style={{ fontSize: '0.9rem' }}>나중에 다시 확인해주세요.</p>
        </div>
      ) : (
        <>
          <p className="muted-text small-text">{faces.length}개의 얼굴이 이름을 기다리고 있습니다</p>
          <div className="face-grid">
            {faces.map((face, index) => (
              <article key={face.id} className="face-card animate-fade-up" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
                <img src={face.cropUrl} alt={`이름 제보용 얼굴 ${index + 1}`} />
                <div className="stack-xs" style={{ padding: '12px 14px 14px' }}>
                  <input
                    className="input"
                    type="text"
                    value={drafts[face.id] ?? ''}
                    onChange={(e) =>
                      setDrafts((cur) => ({ ...cur, [face.id]: e.target.value }))
                    }
                    placeholder="이름 입력"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit(face.id);
                    }}
                    style={{ fontSize: '0.88rem', padding: '9px 12px' }}
                  />
                  <button
                    className="button primary"
                    type="button"
                    disabled={submittingFaceId === face.id}
                    onClick={() => void handleSubmit(face.id)}
                    style={{ fontSize: '0.85rem', padding: '9px' }}
                  >
                    {submittingFaceId === face.id ? '제출 중...' : '제출'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
