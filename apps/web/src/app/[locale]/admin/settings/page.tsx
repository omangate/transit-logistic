import { setRequestLocale } from 'next-intl/server';

import { AdminSettingsContent } from '@/components/admin/admin-settings-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminSettingsContent />;
}
