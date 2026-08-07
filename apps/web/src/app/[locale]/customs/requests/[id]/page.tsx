import { setRequestLocale } from 'next-intl/server';

import { CustomsRequestDetailContent } from '@/components/logistics/customs-content';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function CustomsRequestDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <CustomsRequestDetailContent id={id} />;
}
