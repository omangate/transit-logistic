import { setRequestLocale } from 'next-intl/server';

import { DriverShipmentContent } from '@/components/driver/driver-shipment-content';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function DriverShipmentPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <DriverShipmentContent shipmentId={id} />;
}
