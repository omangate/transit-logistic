import { setRequestLocale } from 'next-intl/server';

import { TrackFormContent } from '@/components/tracking/track-form-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TrackPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <TrackFormContent />;
}
