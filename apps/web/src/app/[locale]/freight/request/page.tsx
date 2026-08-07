import { setRequestLocale } from 'next-intl/server';

import { FreightRequestContent } from '@/components/logistics/freight-content';

type Props = { params: Promise<{ locale: string }> };

export default async function FreightRequestPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FreightRequestContent />;
}
