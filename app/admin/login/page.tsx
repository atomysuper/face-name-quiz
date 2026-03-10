import { redirect } from 'next/navigation';

import { AdminLoginForm } from '@/components/admin-login-form';
import { isAdminSessionActive } from '@/lib/admin-auth';
import { requireSitePage } from '@/lib/site-auth';

export default async function AdminLoginPage() {
  await requireSitePage();

  if (await isAdminSessionActive()) {
    redirect('/admin/upload');
  }

  return (
    <section className="narrow-page stack-lg">
      <div className="stack-sm">
        <span className="badge">관리자 전용</span>
        <h1>관리자 로그인</h1>
        <p className="lead">사진 업로드와 이름 승인은 관리자 로그인 뒤에 가능합니다.</p>
      </div>

      <AdminLoginForm />
    </section>
  );
}
