import { setRequestLocale } from 'next-intl/server';

import { FleetDriversContent } from '@/components/fleet/fleet-drivers-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FleetDriversPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FleetDriversContent />;
}
