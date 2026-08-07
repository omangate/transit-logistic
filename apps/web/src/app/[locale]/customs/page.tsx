import { setRequestLocale } from 'next-intl/server';

import { CustomsLandingContent } from '@/components/logistics/customs-landing-content';

type Props = { params: Promise<{ locale: string }> };

export default async function CustomsLandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CustomsLandingContent />;
}
