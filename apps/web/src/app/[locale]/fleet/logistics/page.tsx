import { setRequestLocale } from 'next-intl/server';

import { FleetLogisticsDashboardContent } from '@/components/fleet/fleet-logistics-dashboard-content';

type Props = { params: Promise<{ locale: string }> };

export default async function FleetLogisticsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FleetLogisticsDashboardContent />;
}
