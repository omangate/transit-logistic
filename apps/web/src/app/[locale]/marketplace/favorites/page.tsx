import { setRequestLocale } from 'next-intl/server';

import { MarketplaceFavoritesContent } from '@/components/marketplace/marketplace-favorites-content';

type Props = { params: Promise<{ locale: string }> };

export default async function MarketplaceFavoritesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MarketplaceFavoritesContent />;
}
