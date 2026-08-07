import { setRequestLocale } from 'next-intl/server';

import { CustomsNewWizard } from '@/components/logistics/customs-new-wizard';

type Props = { params: Promise<{ locale: string }> };

export default async function CustomsNewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CustomsNewWizard />;
}
