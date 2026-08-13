import { setRequestLocale } from 'next-intl/server';

import { DocumentCenterContent } from '@/components/documents/document-center-content';

type Props = { params: Promise<{ locale: string }> };

export default async function DocumentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocumentCenterContent />;
}
