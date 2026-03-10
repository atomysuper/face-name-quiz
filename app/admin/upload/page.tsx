import Link from 'next/link';

import { AdminLogoutButton } from '@/components/admin-logout-button';
import { PhotoImporter } from '@/components/photo-importer';
import { requireAdminPage } from '@/lib/admin-auth';
import { requireSitePage } from '@/lib/site-auth';

export default async function AdminUploadPage() {
  await requireSitePage();
  await requireAdminPage();

  return (
    <section className="stack-lg">
      <div className="row space-between wrap">
        <div className="stack-xs">
          <span className="badge">관리자 전용</span>
          <h1>단체사진 업로드</h1>
          <p className="lead">
            단체사진에서 얼굴을 자동 추출한 뒤, 오검출만 지우고 저장하면 됩니다.
          </p>
        </div>

        <AdminLogoutButton />
      </div>

      <div className="card row gap-sm wrap">
        <Link className="button ghost" href="/admin/review">
          이름 검토로 이동
        </Link>
        <Link className="button ghost" href="/contribute">
          이름 제보 페이지 보기
        </Link>
      </div>

      <PhotoImporter />
    </section>
  );
}
