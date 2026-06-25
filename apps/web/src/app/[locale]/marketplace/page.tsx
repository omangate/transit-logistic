import { setRequestLocale } from 'next-intl/server';

import { MarketplaceBrowseContent } from '@/components/marketplace/marketplace-browse-content';

type Props = { params: Promise<{ locale: string }> };

export default async function MarketplacePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MarketplaceBrowseContent />;
}
