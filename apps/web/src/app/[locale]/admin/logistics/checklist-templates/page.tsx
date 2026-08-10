import { setRequestLocale } from 'next-intl/server';

import { AdminChecklistTemplatesContent } from '@/components/logistics/admin-checklist-templates-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminChecklistTemplatesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminChecklistTemplatesContent />;
}
