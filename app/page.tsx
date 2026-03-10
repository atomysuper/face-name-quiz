import { redirect } from 'next/navigation';

import { requireSitePage } from '@/lib/site-auth';

export default async function HomePage() {
  await requireSitePage();
  redirect('/quiz');
}
