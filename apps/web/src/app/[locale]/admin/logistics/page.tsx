import { setRequestLocale } from 'next-intl/server';

import { AdminLogisticsDashboardContent } from '@/components/logistics/admin-logistics-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminLogisticsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminLogisticsDashboardContent />;
}
