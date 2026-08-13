import { setRequestLocale } from 'next-intl/server';

import { ScheduleSearchContent } from '@/components/ocean/schedule-search-content';

type Props = { params: Promise<{ locale: string }> };

export default async function OceanSchedulesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ScheduleSearchContent />;
}
