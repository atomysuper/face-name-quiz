import Link from 'next/link';

import { AdminLogoutButton } from '@/components/admin-logout-button';
import { ReviewBoard } from '@/components/review-board';
import { requireAdminPage } from '@/lib/admin-auth';
import { requireSitePage } from '@/lib/site-auth';

export default async function AdminReviewPage() {
  await requireSitePage();
  await requireAdminPage();

  return (
    <section className="stack-lg">
      <div className="row space-between wrap">
        <div className="stack-xs">
          <span className="badge">관리자 전용</span>
          <h1>이름 제출 검토</h1>
          <p className="lead">제보된 이름 중 맞는 이름을 선택하거나 직접 입력해서 승인하세요.</p>
        </div>

        <AdminLogoutButton />
      </div>

      <div className="card row gap-sm wrap">
        <Link className="button ghost" href="/admin/upload">
          업로드로 이동
        </Link>
        <Link className="button ghost" href="/quiz">
          퀴즈 페이지 보기
        </Link>
      </div>

      <ReviewBoard />
    </section>
  );
}
