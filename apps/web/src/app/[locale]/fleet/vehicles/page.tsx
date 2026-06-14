import { setRequestLocale } from 'next-intl/server';

import { FleetVehiclesContent } from '@/components/fleet/fleet-vehicles-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FleetVehiclesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FleetVehiclesContent />;
}
