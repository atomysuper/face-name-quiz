import { redirect } from 'next/navigation';

import { requireSitePage } from '@/lib/site-auth';

export default async function AdminManagePage() {
  await requireSitePage();
  redirect('/admin/review');
}
