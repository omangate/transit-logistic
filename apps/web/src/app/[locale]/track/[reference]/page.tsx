import { setRequestLocale } from 'next-intl/server';

import { TrackDetailsContent } from '@/components/tracking/track-details-content';

type Props = {
  params: Promise<{ locale: string; reference: string }>;
};

export default async function TrackReferencePage({ params }: Props) {
  const { locale, reference } = await params;
  setRequestLocale(locale);

  return <TrackDetailsContent reference={decodeURIComponent(reference)} />;
}
