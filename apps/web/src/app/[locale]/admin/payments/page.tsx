import { setRequestLocale } from 'next-intl/server';

import { AdminPaymentsContent } from '@/components/admin/admin-payments-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminPaymentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminPaymentsContent />;
}
