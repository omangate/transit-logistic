import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { FreightNewWizard } from '@/components/logistics/freight-new-wizard';

type Props = { params: Promise<{ locale: string }> };

export default async function FreightRequestPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <FreightNewWizard />
    </Suspense>
  );
}
