import { setRequestLocale } from 'next-intl/server';

import { FleetTruckListingFormPage } from '@/components/fleet/fleet-truck-listing-form-page';

type Props = { params: Promise<{ locale: string }> };

export default async function FleetNewTruckListingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FleetTruckListingFormPage />;
}
