import { setRequestLocale } from 'next-intl/server';

import { FleetMarketplaceContent } from '@/components/fleet/fleet-marketplace-content';

type Props = { params: Promise<{ locale: string }> };

export default async function FleetMarketplacePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FleetMarketplaceContent />;
}
