import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="stack-xl">
      <div className="hero card stack-md">
        <span className="badge">단체사진 → 얼굴 추출 → 이름 제보 → 퀴즈</span>
        <h1>학생 얼굴과 이름을 빨리 외우기 위한 퀴즈 앱</h1>
        <p className="lead">
          단체사진에서 얼굴을 자동으로 잘라 저장하고, 처음에는 누구나 이름을 제보할 수 있게
          한 뒤, 승인된 이름만 퀴즈로 반복 출제하는 흐름으로 만들었습니다.
        </p>

        <div className="row gap-sm wrap">
          <Link className="button primary" href="/admin/upload">
            관리자 업로드 시작
          </Link>
          <Link className="button ghost" href="/quiz">
            바로 퀴즈 보기
          </Link>
        </div>
      </div>

      <div className="feature-grid">
        <article className="card stack-sm">
          <h3>1. 관리자 업로드</h3>
          <p>단체사진을 올리면 얼굴을 자동 추출하고, 잘못 잡힌 얼굴은 바로 제거할 수 있습니다.</p>
          <Link className="text-link" href="/admin/upload">
            업로드 페이지로 이동
          </Link>
        </article>

        <article className="card stack-sm">
          <h3>2. 누구나 이름 제보</h3>
          <p>학생, 교사, 학부모 누구나 얼굴을 보고 이름을 제출할 수 있습니다.</p>
          <Link className="text-link" href="/contribute">
            이름 제보 페이지로 이동
          </Link>
        </article>

        <article className="card stack-sm">
          <h3>3. 관리자 검토</h3>
          <p>제출된 이름 중 맞는 이름을 승인하면 그때부터 퀴즈에 반영됩니다.</p>
          <Link className="text-link" href="/admin/review">
            검토 페이지로 이동
          </Link>
        </article>

        <article className="card stack-sm">
          <h3>4. 퀴즈 반복 학습</h3>
          <p>객관식, 초성 힌트, 주관식으로 연습하고 틀린 얼굴은 더 자주 다시 나옵니다.</p>
          <Link className="text-link" href="/quiz">
            퀴즈 페이지로 이동
          </Link>
        </article>
      </div>

      <div className="card stack-sm">
        <h3>추천 운영 방식</h3>
        <ol className="ordered-list">
          <li>입학식/행사 단체사진 업로드</li>
          <li>이름 제보 링크 공유</li>
          <li>관리자가 승인</li>
          <li>담임/교사가 퀴즈로 암기</li>
        </ol>
      </div>
    </section>
  );
}
