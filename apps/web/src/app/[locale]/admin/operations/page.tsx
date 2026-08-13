import { setRequestLocale } from 'next-intl/server';

import { AdminOpsTowerContent } from '@/components/admin/admin-ops-tower-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminOperationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminOpsTowerContent />;
}
