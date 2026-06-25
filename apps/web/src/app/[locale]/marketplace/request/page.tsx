import { setRequestLocale } from 'next-intl/server';

import { ShipmentRequestContent } from '@/components/marketplace/shipment-request-content';

type Props = { params: Promise<{ locale: string }> };

export default async function ShipmentRequestPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ShipmentRequestContent />;
}
