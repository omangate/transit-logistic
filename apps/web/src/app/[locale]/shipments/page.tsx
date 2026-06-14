import { setRequestLocale } from 'next-intl/server';

import { ShipmentsListContent } from '@/components/shipments/shipments-list-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ShipmentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ShipmentsListContent />;
}
