import { setRequestLocale } from 'next-intl/server';

import { FleetShipmentsContent } from '@/components/fleet/fleet-shipments-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FleetShipmentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FleetShipmentsContent />;
}
