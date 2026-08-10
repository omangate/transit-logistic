import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { CustomsNewWizard } from '@/components/logistics/customs-new-wizard';

type Props = { params: Promise<{ locale: string }> };

export default async function CustomsNewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <CustomsNewWizard />
    </Suspense>
  );
}
