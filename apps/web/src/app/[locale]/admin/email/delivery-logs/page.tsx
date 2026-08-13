import { setRequestLocale } from 'next-intl/server';

import { AdminEmailLogsContent } from '@/components/admin/admin-email-logs-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminEmailLogsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminEmailLogsContent />;
}
