import { setRequestLocale } from 'next-intl/server';

import { AdminDashboardContent } from '@/components/admin/admin-dashboard-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminDashboardContent />;
}
