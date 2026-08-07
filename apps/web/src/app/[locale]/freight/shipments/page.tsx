import { setRequestLocale } from 'next-intl/server';

import { FreightShipmentsContent } from '@/components/logistics/freight-content';

type Props = { params: Promise<{ locale: string }> };

export default async function FreightShipmentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FreightShipmentsContent />;
}
