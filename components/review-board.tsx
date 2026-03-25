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
  const top = face.submissions?.[0];
  return {
    personName: face.personName ?? top?.submittedName ?? '',
    aliasesText: (face.aliases ?? []).join(', '),
    approvedSubmissionId: top?.id ?? null,
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
      const res = await fetch('/api/admin/review-data', { cache: 'no-store' });
      const payload = (await res.json()) as ReviewDataResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? '검토 목록을 불러오지 못했습니다.');

      setPendingFaces(payload.pendingFaces);
      setApprovedFaces(payload.approvedFaces);
      setPeopleNames(payload.people.map((p) => p.name));

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

  useEffect(() => { void loadData(); }, []);

  const dataListId = useMemo(() => 'people-name-options', []);

  function updateFaceForm(faceId: string, partial: Partial<ReviewFormState>) {
    setForms((cur) => ({
      ...cur,
      [faceId]: { ...(cur[faceId] ?? { personName: '', aliasesText: '', approvedSubmissionId: null }), ...partial },
    }));
  }

  async function handleApprove(faceId: string) {
    const form = forms[faceId];
    if (!form?.personName?.trim()) { setErrorMessage('승인할 이름을 입력해주세요.'); return; }
    setSavingFaceId(faceId); setErrorMessage(null); setMessage(null);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approveFace', faceId,
          personName: form.personName,
          aliases: parseAliases(form.aliasesText),
          approvedSubmissionId: form.approvedSubmissionId,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? '얼굴 승인에 실패했습니다.');

      const approved = pendingFaces.find((f) => f.id === faceId);
      setPendingFaces((cur) => cur.filter((f) => f.id !== faceId));
      if (approved) {
        setApprovedFaces((cur) => [{
          ...approved,
          personName: payload.person?.name ?? form.personName,
          aliases: payload.person?.aliases ?? parseAliases(form.aliasesText),
          personId: payload.person?.id ?? approved.personId,
          status: 'approved',
        }, ...cur]);
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
    if (!form?.personName?.trim()) { setErrorMessage('수정할 이름을 입력해주세요.'); return; }
    setSavingFaceId(faceId); setErrorMessage(null); setMessage(null);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateApprovedFace', faceId,
          personName: form.personName,
          aliases: parseAliases(form.aliasesText),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? '승인된 얼굴 수정에 실패했습니다.');

      setApprovedFaces((cur) =>
        cur.map((f) => f.id === faceId ? {
          ...f,
          personName: payload.person?.name ?? form.personName,
          aliases: payload.person?.aliases ?? parseAliases(form.aliasesText),
          personId: payload.person?.id ?? f.personId,
        } : f),
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
    setSavingFaceId(faceId); setErrorMessage(null); setMessage(null);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopenFace', faceId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? '다시 검토 상태로 돌리지 못했습니다.');

      const target = approvedFaces.find((f) => f.id === faceId);
      setApprovedFaces((cur) => cur.filter((f) => f.id !== faceId));
      if (target) {
        setPendingFaces((cur) => [{ ...target, status: 'pending', personId: null, personName: null }, ...cur]);
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
    setSavingFaceId(faceId); setErrorMessage(null); setMessage(null);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rejectSubmission', submissionId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? '제출 삭제에 실패했습니다.');
      setPendingFaces((cur) =>
        cur.map((f) => f.id === faceId
          ? { ...f, submissions: (f.submissions ?? []).filter((s) => s.id !== submissionId) }
          : f,
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
    const target = [...pendingFaces, ...approvedFaces].find((f) => f.id === faceId);
    const label = target?.personName || forms[faceId]?.personName?.trim() || '이 얼굴';
    if (!window.confirm(`${label} 얼굴을 삭제할까요? 연결된 이름 제보와 퀴즈 기록도 함께 사라집니다.`)) return;

    setSavingFaceId(faceId); setErrorMessage(null); setMessage(null);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteFace', faceId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? '얼굴 삭제에 실패했습니다.');
      setPendingFaces((cur) => cur.filter((f) => f.id !== faceId));
      setApprovedFaces((cur) => cur.filter((f) => f.id !== faceId));
      setForms((cur) => { const next = { ...cur }; delete next[faceId]; return next; });
      setMessage('얼굴을 삭제했습니다.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSavingFaceId(null);
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div className="loading-dots" style={{ justifyContent: 'center' }}>
          <span /><span /><span />
        </div>
        <p className="muted-text" style={{ marginTop: 12, fontSize: '0.9rem' }}>검토 목록을 불러오는 중입니다</p>
      </div>
    );
  }

  const activeFaces = mode === 'pending' ? pendingFaces : approvedFaces;

  return (
    <section className="stack-lg animate-fade-up">
      <div className="card stack-md">
        <div className="tab-group" style={{ maxWidth: 360 }}>
          <button
            className={`button ${mode === 'pending' ? 'primary' : ''}`}
            type="button"
            onClick={() => setMode('pending')}
          >
            검토 대기 {pendingFaces.length > 0 && (
              <span style={{
                background: mode === 'pending' ? 'rgba(255,255,255,0.25)' : 'var(--primary-surface)',
                color: mode === 'pending' ? 'white' : 'var(--primary)',
                borderRadius: 999,
                padding: '1px 7px',
                fontSize: '0.78rem',
                fontWeight: 700,
                marginLeft: 2,
              }}>{pendingFaces.length}</span>
            )}
          </button>
          <button
            className={`button ${mode === 'approved' ? 'primary' : ''}`}
            type="button"
            onClick={() => setMode('approved')}
          >
            승인 완료 {approvedFaces.length > 0 && (
              <span style={{
                background: mode === 'approved' ? 'rgba(255,255,255,0.25)' : 'var(--primary-surface)',
                color: mode === 'approved' ? 'white' : 'var(--primary)',
                borderRadius: 999,
                padding: '1px 7px',
                fontSize: '0.78rem',
                fontWeight: 700,
                marginLeft: 2,
              }}>{approvedFaces.length}</span>
            )}
          </button>
        </div>

        <div className="row gap-sm">
          <button className="button ghost" type="button" onClick={() => void loadData()} style={{ fontSize: '0.85rem', padding: '8px 14px' }}>
            새로고침
          </button>
          <p className="muted-text small-text">자동 추출이 부족하면 업로드 화면에서 수동 박스를 추가하세요.</p>
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

      <datalist id={dataListId}>
        {peopleNames.map((name) => <option key={name} value={name} />)}
      </datalist>

      {activeFaces.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>{mode === 'pending' ? '✅' : '📭'}</p>
          <p style={{ fontWeight: 600 }}>
            {mode === 'pending' ? '검토할 얼굴이 없습니다' : '승인된 얼굴이 아직 없습니다'}
          </p>
          <p className="muted-text" style={{ marginTop: 6, fontSize: '0.9rem' }}>
            {mode === 'pending' ? '이름 제보가 쌓이면 여기서 승인할 수 있습니다.' : ''}
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
                  <div>
                    <p className="small-text muted-text" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{index + 1} · {face.photoLabel ?? '사진 없음'}</p>
                    <span style={{
                      display: 'inline-block',
                      marginTop: 4,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: mode === 'pending' ? '#FEF3C7' : 'var(--success-surface)',
                      color: mode === 'pending' ? '#92400E' : 'var(--success)',
                    }}>
                      {mode === 'pending' ? '검토 대기' : '승인 완료'}
                    </span>
                  </div>

                  <div className="stack-xs">
                    <label className="label" htmlFor={`person-name-${face.id}`}>최종 이름</label>
                    <input
                      id={`person-name-${face.id}`}
                      className="input"
                      type="text"
                      list={dataListId}
                      value={form.personName}
                      onChange={(e) => updateFaceForm(face.id, { personName: e.target.value })}
                      placeholder="예: 드리미"
                      style={{ fontSize: '0.88rem' }}
                    />
                  </div>

                  <div className="stack-xs">
                    <label className="label" htmlFor={`aliases-${face.id}`}>별칭 / 기수</label>
                    <input
                      id={`aliases-${face.id}`}
                      className="input"
                      type="text"
                      value={form.aliasesText}
                      onChange={(e) => updateFaceForm(face.id, { aliasesText: e.target.value })}
                      placeholder="예: 8기 (쉼표로 구분)"
                      style={{ fontSize: '0.88rem' }}
                    />
                  </div>

                  {mode === 'pending' && (
                    <div className="stack-xs">
                      <p className="label">제출된 이름</p>
                      {(face.submissions ?? []).length === 0 ? (
                        <p className="muted-text small-text">아직 제출이 없습니다.</p>
                      ) : (
                        <div className="submission-list">
                          {(face.submissions ?? []).map((sub) => (
                            <div key={sub.id} className="submission-chip">
                              <button
                                className="chip-button"
                                type="button"
                                onClick={() => updateFaceForm(face.id, {
                                  personName: sub.submittedName,
                                  approvedSubmissionId: sub.id,
                                })}
                              >
                                {sub.submittedName}
                                {sub.submittedBy ? ` · ${sub.submittedBy}` : ''}
                              </button>
                              <button
                                className="chip-delete"
                                type="button"
                                onClick={() => void handleDeleteSubmission(face.id, sub.id)}
                                title="이 제출 삭제"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="row gap-sm wrap" style={{ marginTop: 4 }}>
                    {mode === 'pending' ? (
                      <>
                        <button
                          className="button primary"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleApprove(face.id)}
                          style={{ fontSize: '0.85rem' }}
                        >
                          {savingFaceId === face.id ? '승인 중...' : '이 이름으로 승인'}
                        </button>
                        <button
                          className="button danger"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleDeleteFace(face.id)}
                          style={{ fontSize: '0.85rem' }}
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
                          style={{ fontSize: '0.85rem' }}
                        >
                          {savingFaceId === face.id ? '수정 중...' : '저장'}
                        </button>
                        <button
                          className="button ghost"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleReopen(face.id)}
                          style={{ fontSize: '0.85rem' }}
                        >
                          대기로
                        </button>
                        <button
                          className="button danger"
                          type="button"
                          disabled={savingFaceId === face.id}
                          onClick={() => void handleDeleteFace(face.id)}
                          style={{ fontSize: '0.85rem' }}
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
