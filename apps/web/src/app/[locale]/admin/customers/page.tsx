import { setRequestLocale } from 'next-intl/server';

import { AdminCustomersContent } from '@/components/admin/admin-customers-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminCustomersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminCustomersContent />;
}
