"use client";

import { useEffect, useMemo, useState } from 'react';

import type { FaceCard, ReviewDataResponse } from '@/lib/types';
import { parseAliases, toErrorMessage } from '@/lib/utils';

type ReviewFormState = {
  personName: string;
  aliasesText: string;
  approvedSubmissionId: string | null;
};

type Mode = 'pending' | 'approved';

function getInitialFormState(face: FaceCard): ReviewFormState {
  const topSubmission = face.submissions?.[0];

  return {
    personName: face.personName ?? topSubmission?.submittedName ?? '',
    aliasesText: (face.aliases ?? []).join(', '),
    approvedSubmissionId: topSubmission?.id ?? null,
  };
}

export function ReviewBoard() {
  const [pendingFaces, setPendingFaces] = useState<FaceCard[]>([]);
  const [approvedFaces, setApprovedFaces] = useState<FaceCard[]>([]);
  const [peopleNames, setPeopleNames] = useState<string[]>([]);
  const [forms, setForms] = useState<Record<string, ReviewFormState>>({});
  const [mode, setMode] = useState<Mode>('pending');
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

      setPendingFaces(payload.pendingFaces);
      setApprovedFaces(payload.approvedFaces);
      setPeopleNames(payload.people.map((person) => person.name));

      const nextForms: Record<string, ReviewFormState> = {};
      for (const face of [...payload.pendingFaces, ...payload.approvedFaces]) {
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

      const approved = pendingFaces.find((face) => face.id === faceId);
      setPendingFaces((current) => current.filter((face) => face.id !== faceId));
      if (approved) {
        setApprovedFaces((current) => [
          {
            ...approved,
            personName: payload.person?.name ?? form.personName,
            aliases: payload.person?.aliases ?? parseAliases(form.aliasesText),
            personId: payload.person?.id ?? approved.personId,
            status: 'approved',
          },
          ...current,
        ]);
      }
      updateFaceForm(faceId, {
        personName: payload.person?.name ?? form.personName,
        aliasesText: (payload.person?.aliases ?? parseAliases(form.aliasesText)).join(', '),
      });
      setMessage(`승인 완료: ${payload.person?.name ?? form.personName}`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSavingFaceId(null);
    }
  }

  async function handleUpdateApproved(faceId: string) {
    const form = forms[faceId];
    if (!form?.personName?.trim()) {
      setErrorMessage('수정할 이름을 입력해주세요.');
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
          action: 'updateApprovedFace',
          faceId,
          personName: form.personName,
          aliases: parseAliases(form.aliasesText),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '승인된 얼굴 수정에 실패했습니다.');
      }

      setApprovedFaces((current) =>
        current.map((face) =>
          face.id === faceId
            ? {
                ...face,
                personName: payload.person?.name ?? form.personName,
                aliases: payload.person?.aliases ?? parseAliases(form.aliasesText),
                personId: payload.person?.id ?? face.personId,
              }
            : face,
        ),
      );
      updateFaceForm(faceId, {
        personName: payload.person?.name ?? form.personName,
        aliasesText: (payload.person?.aliases ?? parseAliases(form.aliasesText)).join(', '),
      });
      setMessage(`수정 완료: ${payload.person?.name ?? form.personName}`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSavingFaceId(null);
    }
  }

  async function handleReopen(faceId: string) {
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
          action: 'reopenFace',
          faceId,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '다시 검토 상태로 돌리지 못했습니다.');
      }

      const target = approvedFaces.find((face) => face.id === faceId);
      setApprovedFaces((current) => current.filter((face) => face.id !== faceId));
      if (target) {
        setPendingFaces((current) => [
          {
            ...target,
            status: 'pending',
            personId: null,
            personName: null,
          },
          ...current,
        ]);
        setMode('pending');
      }
      setMessage('다시 이름 검토 대상으로 돌렸습니다.');
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

      setPendingFaces((current) =>
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


  async function handleDeleteFace(faceId: string) {
    const pendingTarget = pendingFaces.find((face) => face.id === faceId);
    const approvedTarget = approvedFaces.find((face) => face.id === faceId);
    const target = pendingTarget ?? approvedTarget;
    const label = target?.personName || forms[faceId]?.personName?.trim() || '이 얼굴';

    const confirmed = window.confirm(`${label} 얼굴을 삭제할까요? 연결된 이름 제보와 퀴즈 기록도 함께 사라집니다.`);
    if (!confirmed) {
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
          action: 'deleteFace',
          faceId,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? '얼굴 삭제에 실패했습니다.');
      }

      setPendingFaces((current) => current.filter((face) => face.id !== faceId));
      setApprovedFaces((current) => current.filter((face) => face.id !== faceId));
      setForms((current) => {
        const next = { ...current };
        delete next[faceId];
        return next;
      });

      setMessage('얼굴을 삭제했습니다.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSavingFaceId(null);
    }
  }

  if (loading) {
    return <p className="muted-text">검토 목록을 불러오는 중입니다...</p>;
  }

  const activeFaces = mode === 'pending' ? pendingFaces : approvedFaces;

  return (
    <section className="stack-lg">
      <div className="card stack-sm">
        <div className="row gap-sm wrap">
          <button
            className={`button ${mode === 'pending' ? 'primary' : 'ghost'}`}
            type="button"
            onClick={() => setMode('pending')}
          >
            검토 대기 {pendingFaces.length}
          </button>
          <button
            className={`button ${mode === 'approved' ? 'primary' : 'ghost'}`}
            type="button"
            onClick={() => setMode('approved')}
          >
            승인 완료 {approvedFaces.length}
          </button>
          <button className="button ghost" type="button" onClick={() => void loadData()}>
            새로고침
          </button>
        </div>

        <p className="muted-text">
          자동 추출이 부족하면 업로드 화면에서 수동 박스를 추가하고, 여기서는 이미 승인한 얼굴도 언제든 다시 수정할 수 있습니다.
        </p>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <datalist id={dataListId}>
        {peopleNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {activeFaces.length === 0 ? (
        <div className="card">
          <p>
            {mode === 'pending'
              ? '검토할 얼굴이 없습니다. 이름 제보가 쌓이면 여기서 승인할 수 있습니다.'
              : '승인된 얼굴이 아직 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="review-grid">
          {activeFaces.map((face, index) => {
            const form = forms[face.id] ?? getInitialFormState(face);

            return (
              <article key={face.id} className="review-card">
                <img src={face.cropUrl} alt={`검토할 얼굴 ${index + 1}`} loading="lazy" />

                <div className="stack-sm">
                  <div className="stack-xs">
                    <p className="small-text">#{index + 1}</p>
                    <p className="small-text muted-text">{face.photoLabel ?? '사진 이름 없음'}</p>
                    <p className="small-text muted-text">현재 상태: {mode === 'pending' ? '검토 대기' : '승인 완료'}</p>
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
                      placeholder="예: 드리미"
                    />
                  </div>

                  <div className="stack-xs">
                    <label className="label" htmlFor={`aliases-${face.id}`}>
                      별칭 / 기수 (쉼표로 구분)
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
                      placeholder="예: 8기"
                    />
                  </div>

                  {mode === 'pending' ? (
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
                  ) : null}

                  <div className="row gap-sm wrap">
                    {mode === 'pending' ? (
                      <>
                        <button
                          className="button primary"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleApprove(face.id)}
                        >
                          {savingFaceId === face.id ? '승인 중...' : '이 이름으로 승인'}
                        </button>
                        <button
                          className="button danger"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleDeleteFace(face.id)}
                        >
                          삭제
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="button primary"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleUpdateApproved(face.id)}
                        >
                          {savingFaceId === face.id ? '수정 중...' : '저장'}
                        </button>
                        <button
                          className="button ghost"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleReopen(face.id)}
                        >
                          검토대기로
                        </button>
                        <button
                          className="button danger"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleDeleteFace(face.id)}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
