import Link from 'next/link';

import { AdminLogoutButton } from '@/components/admin-logout-button';
import { ManageBoard } from '@/components/manage-board';
import { requireAdminPage } from '@/lib/admin-auth';

export default async function AdminManagePage() {
  await requireAdminPage();

  return (
    <section className="stack-lg">
      <div className="row space-between wrap">
        <div className="stack-xs">
          <span className="badge">관리자 전용</span>
          <h1>얼굴 관리</h1>
          <p className="lead">잘못 올린 얼굴을 삭제하고 현재 등록 상태를 정리할 수 있습니다.</p>
        </div>

        <AdminLogoutButton />
      </div>

      <div className="card row gap-sm wrap">
        <Link className="button ghost" href="/admin/upload">
          업로드로 이동
        </Link>
        <Link className="button ghost" href="/admin/review">
          검토로 이동
        </Link>
      </div>

      <ManageBoard />
    </section>
  );
}
