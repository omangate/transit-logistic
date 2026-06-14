import { setRequestLocale } from 'next-intl/server';

import { ShipmentForm } from '@/components/shipments/shipment-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewShipmentPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ShipmentForm />;
}
