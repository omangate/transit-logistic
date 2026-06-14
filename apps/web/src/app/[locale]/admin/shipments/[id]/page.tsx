import { setRequestLocale } from 'next-intl/server';

import { AdminShipmentDetailsContent } from '@/components/admin/admin-shipment-details-content';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function AdminShipmentDetailsPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <AdminShipmentDetailsContent shipmentId={id} />;
}
