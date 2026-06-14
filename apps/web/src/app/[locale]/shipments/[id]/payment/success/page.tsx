import { setRequestLocale } from 'next-intl/server';

import { PaymentResultContent } from '@/components/payment/payment-result-content';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function PaymentSuccessPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <PaymentResultContent shipmentId={id} variant="success" />;
}
