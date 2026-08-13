import { setRequestLocale } from 'next-intl/server';

import { CarrierDirectoryContent } from '@/components/ocean/carrier-directory-content';

type Props = { params: Promise<{ locale: string }> };

export default async function OceanCarriersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CarrierDirectoryContent />;
}
