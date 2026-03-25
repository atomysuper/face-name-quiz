import Link from 'next/link';

import { PhotoImporter } from '@/components/photo-importer';
import { requireSitePage } from '@/lib/site-auth';

export default async function UploadPage() {
  await requireSitePage();

  return (
    <section className="stack-lg">
      <div className="stack-xs">
        <h1>단체사진 업로드</h1>
        <p className="lead">
          단체사진에서 얼굴을 자동 추출한 뒤, 오검출만 지우고 저장하면 됩니다.
        </p>
      </div>

      <div className="card row gap-sm wrap">
        <Link className="button ghost" href="/quiz">
          퀴즈로 이동
        </Link>
        <Link className="button ghost" href="/contribute">
          이름 제보 페이지 보기
        </Link>
      </div>

      <PhotoImporter apiEndpoint="/api/import-photo" />
    </section>
  );
}
