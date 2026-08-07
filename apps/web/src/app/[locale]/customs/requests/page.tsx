import { setRequestLocale } from 'next-intl/server';

import { CustomsRequestsContent } from '@/components/logistics/customs-content';

type Props = { params: Promise<{ locale: string }> };

export default async function CustomsRequestsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CustomsRequestsContent />;
}
