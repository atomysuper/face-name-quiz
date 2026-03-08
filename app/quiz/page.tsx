import { QuizGame } from '@/components/quiz-game';

export default function QuizPage() {
  return (
    <section className="stack-lg">
      <div className="stack-xs">
        <span className="badge">학습 모드</span>
        <h1>이름 맞추기 퀴즈</h1>
        <p className="lead">
          객관식부터 시작하고, 익숙해지면 초성 힌트와 주관식으로 넘어가면 더 빨리 외워집니다.
        </p>
      </div>

      <QuizGame />
    </section>
  );
}
