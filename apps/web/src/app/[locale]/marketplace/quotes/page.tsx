import { setRequestLocale } from 'next-intl/server';

import { CustomerQuotesContent } from '@/components/marketplace/customer-quotes-content';

type Props = { params: Promise<{ locale: string }> };

export default async function CustomerQuotesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CustomerQuotesContent />;
}
