import { setRequestLocale } from 'next-intl/server';

import { LogisticsDashboardContent } from '@/components/logistics/logistics-dashboard-content';

type Props = { params: Promise<{ locale: string }> };

export default async function LogisticsDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LogisticsDashboardContent />;
}
