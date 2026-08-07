import { setRequestLocale } from 'next-intl/server';

import { FreightShipmentDetailContent } from '@/components/logistics/freight-content';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function FreightShipmentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <FreightShipmentDetailContent id={id} />;
}
