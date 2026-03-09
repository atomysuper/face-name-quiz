"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  applyAttempt,
  buildMultipleChoiceOptions,
  selectNextFace,
  type QuizProgressMap,
} from '@/lib/quiz-algorithm';
import type { FaceCard, QuizFace } from '@/lib/types';
import { getHangulInitials, isCorrectAnswer, toErrorMessage } from '@/lib/utils';

type FacesResponse = {
  faces: FaceCard[];
  error?: string;
};

type QuizMode = 'multiple-choice' | 'initial-hint' | 'typed';

const STORAGE_KEY = 'face-quiz-progress-v1';
const MAX_TRIES = 3;

function loadProgress(): QuizProgressMap {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as QuizProgressMap;
  } catch {
    return {};
  }
}

function saveProgress(progress: QuizProgressMap) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function QuizGame() {
  const [faces, setFaces] = useState<QuizFace[]>([]);
  const [progress, setProgress] = useState<QuizProgressMap>({});
  const [currentFace, setCurrentFace] = useState<QuizFace | null>(null);
  const [mode, setMode] = useState<QuizMode>('multiple-choice');
  const [choices, setChoices] = useState<string[]>([]);
  const [guess, setGuess] = useState('');
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionWrong, setSessionWrong] = useState(0);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const nextTimerRef = useRef<number | null>(null);
  const facesRef = useRef<QuizFace[]>([]);
  const progressRef = useRef<QuizProgressMap>({});
  const modeRef = useRef<QuizMode>('multiple-choice');

  const readyForMultipleChoice = faces.length >= 4;
  const triesLeft = MAX_TRIES - attemptNumber + 1;

  const accuracy = useMemo(() => {
    const total = sessionCorrect + sessionWrong;
    if (total === 0) {
      return 0;
    }
    return Math.round((sessionCorrect / total) * 100);
  }, [sessionCorrect, sessionWrong]);

  function scheduleNextQuestion(currentId?: string, nextProgress?: QuizProgressMap) {
    if (nextTimerRef.current) {
      window.clearTimeout(nextTimerRef.current);
    }

    nextTimerRef.current = window.setTimeout(() => {
      const activeFaces = facesRef.current;
      const activeProgress = nextProgress ?? progressRef.current;
      const activeMode = modeRef.current;
      const nextFace = selectNextFace(activeFaces, activeProgress, currentId);

      if (!nextFace) {
        return;
      }

      setCurrentFace(nextFace);
      setGuess('');
      setResultMessage(null);
      setAttemptNumber(1);
      startedAtRef.current = Date.now();

      if (activeMode === 'multiple-choice' && activeFaces.length >= 4) {
        setChoices(buildMultipleChoiceOptions(activeFaces, nextFace));
      } else {
        setChoices([]);
      }
    }, 900);
  }

  useEffect(() => {
    const savedProgress = loadProgress();
    setProgress(savedProgress);
    progressRef.current = savedProgress;
  }, []);

  useEffect(() => {
    facesRef.current = faces;
  }, [faces]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    return () => {
      if (nextTimerRef.current) {
        window.clearTimeout(nextTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadFaces() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/faces?status=approved&limit=500', {
          cache: 'no-store',
        });
        const payload = (await response.json()) as FacesResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? '퀴즈 데이터를 불러오지 못했습니다.');
        }

        const approvedFaces = payload.faces.filter(
          (face): face is QuizFace =>
            Boolean(face.personId) && Boolean(face.personName),
        );

        setFaces(approvedFaces);

        if (approvedFaces.length > 0) {
          const savedProgress = loadProgress();
          const firstFace = selectNextFace(approvedFaces, savedProgress);
          if (firstFace) {
            setCurrentFace(firstFace);
            setAttemptNumber(1);
            startedAtRef.current = Date.now();
            setChoices(
              approvedFaces.length >= 4
                ? buildMultipleChoiceOptions(approvedFaces, firstFace)
                : [],
            );
          }
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
    if (!currentFace) {
      return;
    }

    if (mode === 'multiple-choice' && faces.length >= 4) {
      setChoices(buildMultipleChoiceOptions(faces, currentFace));
    } else {
      setChoices([]);
    }
  }, [mode, currentFace, faces]);

  async function finalizeAnswer(answer: string, correct: boolean) {
    if (!currentFace) {
      return;
    }

    const responseMs = Date.now() - startedAtRef.current;
    const nextProgress = applyAttempt(progress, currentFace.id, correct, responseMs);
    setProgress(nextProgress);
    saveProgress(nextProgress);

    if (correct) {
      setSessionCorrect((value) => value + 1);
      setResultMessage(`정답! ${currentFace.personName}`);
    } else {
      setSessionWrong((value) => value + 1);
      setResultMessage(`오답. 정답은 ${currentFace.personName}`);
    }

    void fetch('/api/attempts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        faceId: currentFace.id,
        guessedName: answer,
        correct,
        responseMs,
      }),
    }).catch(() => {
      // 퀴즈 기록 저장 실패는 화면 진행을 막지 않습니다.
    });

    scheduleNextQuestion(currentFace.id, nextProgress);
  }

  async function handleAnswer(answer: string) {
    if (!currentFace) {
      return;
    }

    const correct = isCorrectAnswer(
      answer,
      currentFace.personName,
      currentFace.aliases,
    );

    if (correct) {
      await finalizeAnswer(answer, true);
      return;
    }

    if (attemptNumber < MAX_TRIES) {
      const remaining = MAX_TRIES - attemptNumber;
      setAttemptNumber((value) => value + 1);
      setResultMessage(`아직 아니에요. ${remaining}번 더 도전할 수 있어요.`);
      if (mode !== 'multiple-choice') {
        setGuess('');
      }
      return;
    }

    await finalizeAnswer(answer, false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guess.trim()) {
      return;
    }
    void handleAnswer(guess);
  }

  if (loading) {
    return <p className="muted-text">퀴즈 문제를 준비하는 중입니다...</p>;
  }

  if (errorMessage) {
    return <p className="error-text">{errorMessage}</p>;
  }

  if (faces.length === 0 || !currentFace) {
    return (
      <div className="card">
        <p>아직 승인된 얼굴이 없습니다. 먼저 이름을 승인한 뒤 퀴즈를 시작해주세요.</p>
      </div>
    );
  }

  const initials = getHangulInitials(currentFace.personName);

  return (
    <section className="stack-lg">
      <div className="quiz-shell quiz-shell-top">
        <div className="card quiz-face-card">
          <img src={currentFace.cropUrl} alt="퀴즈 얼굴" />
        </div>

        <div className="card stack-md quiz-question-card">
          <div className="stack-sm quiz-head-block">
            <div className="row gap-sm wrap quiz-mode-tabs">
              <button
                className={`button ${mode === 'multiple-choice' ? 'primary' : 'ghost'}`}
                type="button"
                disabled={!readyForMultipleChoice}
                onClick={() => setMode('multiple-choice')}
              >
                객관식
              </button>
              <button
                className={`button ${mode === 'initial-hint' ? 'primary' : 'ghost'}`}
                type="button"
                onClick={() => setMode('initial-hint')}
              >
                초성 힌트
              </button>
              <button
                className={`button ${mode === 'typed' ? 'primary' : 'ghost'}`}
                type="button"
                onClick={() => setMode('typed')}
              >
                주관식
              </button>
            </div>

            <div className="stack-xs quiz-title-block">
              <h3>이 사람의 이름은?</h3>
              {mode === 'initial-hint' ? (
                <p className="muted-text">힌트: {initials}</p>
              ) : null}
            </div>
          </div>

          {mode === 'multiple-choice' && readyForMultipleChoice ? (
            <div className="choice-grid compact-choice-grid">
              {choices.map((choice) => (
                <button
                  key={`${currentFace.id}-${choice}`}
                  className="button choice compact-choice"
                  type="button"
                  onClick={() => void handleAnswer(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <form className="stack-sm quiz-answer-form" onSubmit={handleSubmit}>
              <input
                className="input"
                type="text"
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                placeholder="이름을 입력하세요"
                autoFocus
              />
              <button className="button primary" type="submit">
                정답 확인
              </button>
            </form>
          )}

          <p className="muted-text small-text quiz-tries-text">이번 문제 기회: {triesLeft} / {MAX_TRIES}</p>

          {resultMessage ? (
            <p className={resultMessage.startsWith('정답') ? 'success-text' : 'error-text'}>
              {resultMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stack-xs">
          <p className="label">이번 세션 정답</p>
          <strong>{sessionCorrect}</strong>
        </div>
        <div className="card stack-xs">
          <p className="label">이번 세션 오답</p>
          <strong>{sessionWrong}</strong>
        </div>
        <div className="card stack-xs">
          <p className="label">정답률</p>
          <strong>{accuracy}%</strong>
        </div>
        <div className="card stack-xs">
          <p className="label">등록된 얼굴</p>
          <strong>{faces.length}</strong>
        </div>
      </div>
    </section>
  );
}
