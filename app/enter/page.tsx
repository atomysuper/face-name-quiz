import { redirect } from 'next/navigation';

import { SiteEntryForm } from '@/components/site-entry-form';
import { isSiteSessionActive } from '@/lib/site-auth';

export default async function EnterPage() {
  if (await isSiteSessionActive()) {
    redirect('/quiz');
  }

  return (
    <div className="enter-page-wrap">
      <div className="enter-card">
        <div className="enter-brand" aria-hidden="true">
          <span className="enter-brand-icon">✦</span>
        </div>
        <h1 className="enter-title">드리미학교</h1>
        <p className="enter-subtitle">
          내부용 얼굴·이름 퀴즈입니다.<br />입장 비밀번호를 입력해주세요.
        </p>
        <SiteEntryForm />
      </div>
    </div>
  );
}
