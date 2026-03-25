"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

import {
  applyAttempt,
  buildMultipleChoiceOptions,
  selectNextFace,
  type MultipleChoiceOption,
  type QuizProgressMap,
} from '@/lib/quiz-algorithm';
import type { FaceCard, QuizFace } from '@/lib/types';
import { getHangulInitials, isCorrectAnswer, toErrorMessage } from '@/lib/utils';

type FacesResponse = { faces: FaceCard[]; error?: string };
type QuizMode = 'multiple-choice' | 'initial-hint' | 'typed';
type ResultTone = 'correct' | 'wrong' | null;

const STORAGE_KEY = 'face-quiz-progress-v1';
const MAX_TRIES = 3;

function calcScore(responseMs: number): number {
  const s = responseMs / 1000;
  if (s <= 1)  return 120;
  if (s <= 3)  return Math.round(120 - 20 * (s - 1) / 2);
  if (s <= 5)  return Math.round(100 - 30 * (s - 3) / 2);
  if (s <= 10) return Math.round(70 - 20 * (s - 5) / 5);
  return 50;
}

function loadProgress(): QuizProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QuizProgressMap) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: QuizProgressMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function formatChoiceMeta(aliases: string[]): string {
  return aliases.filter(Boolean).join(' / ');
}

export function QuizGame() {
  const [faces, setFaces] = useState<QuizFace[]>([]);
  const [progress, setProgress] = useState<QuizProgressMap>({});
  const [currentFace, setCurrentFace] = useState<QuizFace | null>(null);
  const [mode, setMode] = useState<QuizMode>('multiple-choice');
  const [choices, setChoices] = useState<MultipleChoiceOption[]>([]);
  const [guess, setGuess] = useState('');
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionWrong, setSessionWrong] = useState(0);
  const [sessionScores, setSessionScores] = useState<number[]>([]);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<ResultTone>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightboxUrl(null), []);
  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxUrl, closeLightbox]);

  const startedAtRef = useRef<number>(Date.now());
  const nextTimerRef = useRef<number | null>(null);
  const facesRef = useRef<QuizFace[]>([]);
  const progressRef = useRef<QuizProgressMap>({});
  const modeRef = useRef<QuizMode>('multiple-choice');

  const readyForMultipleChoice = faces.length >= 4;
  const triesLeft = MAX_TRIES - attemptNumber + 1;

  function resetQuestionVisuals() {
    setGuess('');
    setResultMessage(null);
    setResultTone(null);
    setAttemptNumber(1);
    setLastScore(null);
  }

  function scheduleNextQuestion(currentId?: string, nextProgress?: QuizProgressMap) {
    if (nextTimerRef.current) window.clearTimeout(nextTimerRef.current);

    // 다음 얼굴을 지금 바로 선택하고 이미지를 미리 로드 (900ms 대기 중 캐시에 올림)
    const activeFaces = facesRef.current;
    const activeProgress = nextProgress ?? progressRef.current;
    const nextFace = selectNextFace(activeFaces, activeProgress, currentId);
    if (nextFace) {
      const img = new window.Image();
      img.src = nextFace.cropUrl;
    }

    nextTimerRef.current = window.setTimeout(() => {
      const activeMode = modeRef.current;
      if (!nextFace) return;

      setCurrentFace(nextFace);
      resetQuestionVisuals();
      startedAtRef.current = Date.now();

      if (activeMode === 'multiple-choice' && activeFaces.length >= 4) {
        setChoices(buildMultipleChoiceOptions(activeFaces, nextFace));
      } else {
        setChoices([]);
      }
    }, 900);
  }

  useEffect(() => {
    const saved = loadProgress();
    setProgress(saved);
    progressRef.current = saved;
  }, []);

  useEffect(() => { facesRef.current = faces; }, [faces]);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    return () => {
      if (nextTimerRef.current) window.clearTimeout(nextTimerRef.current);
    };
  }, []);

  useEffect(() => {
    async function loadFaces() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch('/api/faces?status=approved&limit=500', { cache: 'no-store' });
        const payload = (await response.json()) as FacesResponse;
        if (!response.ok) throw new Error(payload.error ?? '퀴즈 데이터를 불러오지 못했습니다.');

        const approved = payload.faces.filter(
          (f): f is QuizFace => Boolean(f.personId) && Boolean(f.personName),
        );
        setFaces(approved);

        if (approved.length > 0) {
          const saved = loadProgress();
          const first = selectNextFace(approved, saved);
          if (first) {
            setCurrentFace(first);
            resetQuestionVisuals();
            startedAtRef.current = Date.now();
            setChoices(approved.length >= 4 ? buildMultipleChoiceOptions(approved, first) : []);
          }
          // 첫 화면 로드 시 상위 이미지 몇 장 미리 캐시
          approved.slice(0, 8).forEach((f) => {
            const img = new window.Image();
            img.src = f.cropUrl;
          });
        }
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }
    void loadFaces();
  }, []);

  useEffect(() => {
    if (!currentFace) return;
    if (mode === 'multiple-choice' && faces.length >= 4) {
      setChoices(buildMultipleChoiceOptions(faces, currentFace));
    } else {
      setChoices([]);
    }
  }, [mode, currentFace, faces]);

  async function finalizeAnswer(answer: string, correct: boolean) {
    if (!currentFace) return;

    const responseMs = Date.now() - startedAtRef.current;
    const nextProgress = applyAttempt(progress, currentFace.id, correct, responseMs);
    setProgress(nextProgress);
    saveProgress(nextProgress);

    const score = correct ? calcScore(responseMs) : 0;
    setLastScore(score);
    setSessionScores((prev) => [...prev, score]);

    if (correct) {
      setSessionCorrect((v) => v + 1);
      setResultTone('correct');
      setResultMessage(`정답! ${currentFace.personName}`);
    } else {
      setSessionWrong((v) => v + 1);
      setResultTone('wrong');
      setResultMessage(`오답 — 정답은 ${currentFace.personName}`);
    }

    void fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceId: currentFace.id, guessedName: answer, correct, responseMs }),
    }).catch(() => {});

    scheduleNextQuestion(currentFace.id, nextProgress);
  }

  async function handleAnswer(answer: string) {
    if (!currentFace) return;
    const correct = isCorrectAnswer(answer, currentFace.personName, currentFace.aliases);

    if (correct) {
      await finalizeAnswer(answer, true);
      return;
    }

    setResultTone('wrong');

    if (attemptNumber < MAX_TRIES) {
      const remaining = MAX_TRIES - attemptNumber;
      setAttemptNumber((v) => v + 1);
      setResultMessage(`아직 아니에요. ${remaining}번 더 도전할 수 있어요.`);
      if (mode !== 'multiple-choice') setGuess('');
      return;
    }

    await finalizeAnswer(answer, false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!guess.trim()) return;
    void handleAnswer(guess);
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div className="loading-dots" style={{ justifyContent: 'center' }}>
          <span /><span /><span />
        </div>
        <p className="muted-text" style={{ marginTop: 12, fontSize: '0.9rem' }}>퀴즈 문제를 준비하는 중입니다</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="card">
        <p className="error-text">{errorMessage}</p>
      </div>
    );
  }

  if (faces.length === 0 || !currentFace) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ fontSize: '2rem', marginBottom: 12 }}>📭</p>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>아직 승인된 얼굴이 없습니다</p>
        <p className="muted-text" style={{ fontSize: '0.9rem' }}>이름을 승인한 뒤 퀴즈를 시작해주세요.</p>
      </div>
    );
  }

  const initials = getHangulInitials(currentFace.personName);
  const questionCardClass = [
    'card',
    'stack-sm',
    'quiz-question-card',
    resultTone ? `quiz-question-card-${resultTone}` : '',
  ].filter(Boolean).join(' ');

  return (
    <section className="stack-md animate-fade-up">
      <div className="quiz-shell">
        <div className="quiz-face-card">
          <img
            src={currentFace.cropUrl}
            alt="퀴즈 얼굴"
            style={{ cursor: 'zoom-in' }}
            onClick={() => setLightboxUrl(currentFace.cropUrl)}
          />
        </div>

        <div className={questionCardClass}>
          <div className="stack-xs quiz-head-block">
            <div className="tab-group quiz-mode-tabs">
              <button
                className={`button ${mode === 'multiple-choice' ? 'primary' : ''}`}
                type="button"
                disabled={!readyForMultipleChoice}
                onClick={() => setMode('multiple-choice')}
              >
                객관식
              </button>
              <button
                className={`button ${mode === 'initial-hint' ? 'primary' : ''}`}
                type="button"
                onClick={() => setMode('initial-hint')}
              >
                초성 힌트
              </button>
              <button
                className={`button ${mode === 'typed' ? 'primary' : ''}`}
                type="button"
                onClick={() => setMode('typed')}
              >
                주관식
              </button>
            </div>

            <div className="quiz-title-block">
              <h3>이 사람의 이름은?</h3>
              {mode === 'initial-hint' && (
                <p className="muted-text" style={{ marginTop: 4, fontSize: '0.9rem' }}>
                  힌트: <strong style={{ color: 'var(--primary)' }}>{initials}</strong>
                </p>
              )}
            </div>
          </div>

          {mode === 'multiple-choice' && readyForMultipleChoice ? (
            <div className="choice-grid compact-choice-grid">
              {choices.map((choice) => {
                const meta = formatChoiceMeta(choice.aliases);
                return (
                  <button
                    key={`${currentFace.id}-${choice.faceId}`}
                    className="button choice compact-choice"
                    type="button"
                    onClick={() => void handleAnswer(choice.personName)}
                  >
                    <span className="choice-label">
                      <span className="choice-title-inline">
                        <span className="choice-name">{choice.personName}</span>
                        {meta && <span className="choice-meta-inline">{meta}</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <form className="stack-sm quiz-answer-form" onSubmit={handleSubmit}>
              <input
                className="input"
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="이름을 입력하세요"
                autoFocus
              />
              <button className="button primary" type="submit">
                정답 확인
              </button>
            </form>
          )}

          <p className="muted-text small-text quiz-tries-text">
            남은 기회: {triesLeft} / {MAX_TRIES}
          </p>

          {resultMessage && (
            <div className={`quiz-result-message ${resultTone ?? ''}`}>
              <span>{resultMessage}</span>
              {lastScore !== null && (
                <span className={`score-badge score-badge-${resultTone ?? 'wrong'}`}>
                  {lastScore}점
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card quiz-summary-card">
        <div className="quiz-stat-row">
          <div className="quiz-stat">
            <span style={{ color: 'var(--success)' }}>✓</span>
            <span>정답</span>
            <span className="quiz-stat-value" style={{ color: 'var(--success)' }}>
              {sessionCorrect}
            </span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div className="quiz-stat">
            <span style={{ color: 'var(--danger)' }}>✕</span>
            <span>오답</span>
            <span className="quiz-stat-value" style={{ color: 'var(--danger)' }}>
              {sessionWrong}
            </span>
          </div>
          {(sessionCorrect + sessionWrong) > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <div className="quiz-stat">
                <span>정답률</span>
                <span className="quiz-stat-value">
                  {Math.round((sessionCorrect / (sessionCorrect + sessionWrong)) * 100)}%
                </span>
              </div>
            </>
          )}
          {sessionScores.length > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <div className="quiz-stat">
                <span>평균점수</span>
                <span className="quiz-stat-value" style={{ color: 'var(--primary)' }}>
                  {Math.round(sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length)}점
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {lightboxUrl ? (
        <div className="lightbox-backdrop" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox} aria-label="닫기">✕</button>
          <img
            className="lightbox-img"
            src={lightboxUrl}
            alt="확대 보기"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}
