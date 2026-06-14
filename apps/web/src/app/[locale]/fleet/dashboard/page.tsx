import { setRequestLocale } from 'next-intl/server';

import { FleetDashboardContent } from '@/components/fleet/fleet-dashboard-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FleetDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FleetDashboardContent />;
}
