import { ContributeBoard } from '@/components/contribute-board';

export default function ContributePage() {
  return (
    <section className="stack-lg">
      <div className="stack-xs">
        <span className="badge">공개 참여</span>
        <h1>이름 제보</h1>
        <p className="lead">
          얼굴을 보고 이름을 입력해주세요. 관리자가 승인하면 퀴즈에 반영됩니다.
        </p>
      </div>

      <ContributeBoard />
    </section>
  );
}
