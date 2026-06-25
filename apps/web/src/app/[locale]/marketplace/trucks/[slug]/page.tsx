import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { MarketplaceTruckProfileContent } from '@/components/marketplace/marketplace-truck-profile-content';

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function MarketplaceTruckPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<main className="container"><p>…</p></main>}>
      <MarketplaceTruckProfileContent slug={slug} />
    </Suspense>
  );
}
