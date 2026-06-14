import { setRequestLocale } from 'next-intl/server';

import { ShipmentDetailsContent } from '@/components/shipments/shipment-details-content';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ShipmentDetailsPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <ShipmentDetailsContent shipmentId={id} />;
}
