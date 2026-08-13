import { setRequestLocale } from 'next-intl/server';

import { CustomerPaymentsContent } from '@/components/payments/customer-payments-content';

type Props = { params: Promise<{ locale: string }> };

export default async function PaymentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CustomerPaymentsContent />;
}
