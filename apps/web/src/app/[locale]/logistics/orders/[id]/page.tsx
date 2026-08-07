import { setRequestLocale } from 'next-intl/server';

import { LogisticsOrderDetailContent } from '@/components/logistics/logistics-order-detail-content';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function LogisticsOrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <LogisticsOrderDetailContent id={id} />;
}
