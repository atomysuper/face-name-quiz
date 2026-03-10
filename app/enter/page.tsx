import { redirect } from 'next/navigation';

import { SiteEntryForm } from '@/components/site-entry-form';
import { isSiteSessionActive } from '@/lib/site-auth';

export default async function EnterPage() {
  if (await isSiteSessionActive()) {
    redirect('/quiz');
  }

  return (
    <section className="narrow-page stack-lg">
      <div className="stack-sm">
        <span className="badge">내부용</span>
        <h1>드리미학교</h1>
        <p className="lead">먼저 입장 비밀번호를 입력한 뒤 퀴즈와 이름 제보 화면으로 들어오실 수 있습니다.</p>
      </div>

      <SiteEntryForm />
    </section>
  );
}
