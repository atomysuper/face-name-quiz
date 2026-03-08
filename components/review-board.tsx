"use client";

import { useEffect, useMemo, useState } from 'react';

import type { FaceCard, ReviewDataResponse } from '@/lib/types';
import { parseAliases, toErrorMessage } from '@/lib/utils';

type ReviewFormState = {
  personName: string;
  aliasesText: string;
  approvedSubmissionId: string | null;
};

function getInitialFormState(face: FaceCard): ReviewFormState {
  const topSubmission = face.submissions?.[0];

  return {
    personName: topSubmission?.submittedName ?? '',
    aliasesText: '',
    approvedSubmissionId: topSubmission?.id ?? null,
  };
}

export function ReviewBoard() {
  const [faces, setFaces] = useState<FaceCard[]>([]);
  const [peopleNames, setPeopleNames] = useState<string[]>([]);
  const [forms, setForms] = useState<Record<string, ReviewFormState>>({});
  const [loading, setLoading] = useState(true);
  const [savingFaceId, setSavingFaceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/review-data', {
        cache: 'no-store',
      });
      const payload = (await response.json()) as ReviewDataResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? '검토 목록을 불러오지 못했습니다.');
      }

      setFaces(payload.faces);
      setPeopleNames(payload.people.map((person) => person.name));

      const nextForms: Record<string, ReviewFormState> = {};
      for (const face of payload.faces) {
        nextForms[face.id] = getInitialFormState(face);
      }
      setForms(nextForms);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const pendingCount = faces.length;

  const dataListId = useMemo(() => 'people-name-options', []);

  function updateFaceForm(faceId: string, partial: Partial<ReviewFormState>) {
    setForms((current) => ({
      ...current,
      [faceId]: {
        ...(current[faceId] ?? {
          personName: '',
          aliasesText: '',
          approvedSubmissionId: null,
        }),
        ...partial,
      },
    }));
  }

  async function handleApprove(faceId: string) {
    const form = forms[faceId];

    if (!form?.personName?.trim()) {
      setErrorMessage('승인할 이름을 입력해주세요.');
      return;
    }

    setSavingFaceId(faceId);
    setErrorMessage(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approveFace',
          faceId,
          personName: form.personName,
          aliases: parseAliases(form.aliasesText),
          approvedSubmissionId: form.approvedSubmissionId,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? '얼굴 승인에 실패했습니다.');
      }

      setFaces((current) => current.filter((face) => face.id !== faceId));
      setMessage(`승인 완료: ${form.personName}`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSavingFaceId(null);
    }
  }

  async function handleDeleteSubmission(faceId: string, submissionId: string) {
    setSavingFaceId(faceId);
    setErrorMessage(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'rejectSubmission',
          submissionId,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? '제출 삭제에 실패했습니다.');
      }

      setFaces((current) =>
        current.map((face) =>
          face.id === faceId
            ? {
                ...face,
                submissions: (face.submissions ?? []).filter(
                  (submission) => submission.id !== submissionId,
                ),
              }
            : face,
        ),
      );

      setMessage('제출을 삭제했습니다.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSavingFaceId(null);
    }
  }

  if (loading) {
    return <p className="muted-text">검토 목록을 불러오는 중입니다...</p>;
  }

  return (
    <section className="stack-lg">
      <div className="card row space-between wrap">
        <div className="stack-xs">
          <h3>검토 대기 얼굴</h3>
          <p className="muted-text">
            현재 {pendingCount}개의 얼굴이 이름 승인을 기다리고 있습니다.
          </p>
        </div>

        <button className="button ghost" type="button" onClick={() => void loadData()}>
          새로고침
        </button>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <datalist id={dataListId}>
        {peopleNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {faces.length === 0 ? (
        <div className="card">
          <p>검토할 얼굴이 없습니다. 이름 제보가 쌓이면 여기서 승인할 수 있습니다.</p>
        </div>
      ) : (
        <div className="review-grid">
          {faces.map((face, index) => {
            const form = forms[face.id] ?? getInitialFormState(face);

            return (
              <article key={face.id} className="review-card">
                <img src={face.cropUrl} alt={`검토할 얼굴 ${index + 1}`} />

                <div className="stack-sm">
                  <div className="stack-xs">
                    <p className="small-text">#{index + 1}</p>
                    <p className="small-text muted-text">
                      {face.photoLabel ?? '사진 이름 없음'}
                    </p>
                  </div>

                  <div className="stack-xs">
                    <label className="label" htmlFor={`person-name-${face.id}`}>
                      최종 이름
                    </label>
                    <input
                      id={`person-name-${face.id}`}
                      className="input"
                      type="text"
                      list={dataListId}
                      value={form.personName}
                      onChange={(event) =>
                        updateFaceForm(face.id, {
                          personName: event.target.value,
                        })
                      }
                      placeholder="예: 김민준"
                    />
                  </div>

                  <div className="stack-xs">
                    <label className="label" htmlFor={`aliases-${face.id}`}>
                      별칭 (쉼표로 구분)
                    </label>
                    <input
                      id={`aliases-${face.id}`}
                      className="input"
                      type="text"
                      value={form.aliasesText}
                      onChange={(event) =>
                        updateFaceForm(face.id, {
                          aliasesText: event.target.value,
                        })
                      }
                      placeholder="예: 민준, 민준이"
                    />
                  </div>

                  <div className="stack-xs">
                    <p className="label">제출된 이름</p>
                    {(face.submissions ?? []).length === 0 ? (
                      <p className="muted-text small-text">아직 제출이 없습니다.</p>
                    ) : (
                      <div className="submission-list">
                        {(face.submissions ?? []).map((submission) => (
                          <div key={submission.id} className="submission-chip">
                            <button
                              className="chip-button"
                              type="button"
                              onClick={() =>
                                updateFaceForm(face.id, {
                                  personName: submission.submittedName,
                                  approvedSubmissionId: submission.id,
                                })
                              }
                            >
                              {submission.submittedName}
                              {submission.submittedBy ? ` · ${submission.submittedBy}` : ''}
                            </button>

                            <button
                              className="chip-delete"
                              type="button"
                              onClick={() => void handleDeleteSubmission(face.id, submission.id)}
                              title="이 제출 삭제"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    className="button primary"
                    type="button"
                    disabled={savingFaceId === face.id}
                    onClick={() => void handleApprove(face.id)}
                  >
                    {savingFaceId === face.id ? '승인 중...' : '이 이름으로 승인'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
