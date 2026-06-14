import { setRequestLocale } from 'next-intl/server';

import { DriverDashboardContent } from '@/components/driver/driver-dashboard-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DriverDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DriverDashboardContent />;
}
