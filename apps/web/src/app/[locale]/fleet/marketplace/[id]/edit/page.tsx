import { setRequestLocale } from 'next-intl/server';

import { FleetTruckListingFormPage } from '@/components/fleet/fleet-truck-listing-form-page';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function FleetEditTruckListingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <FleetTruckListingFormPage listingId={id} />;
}
