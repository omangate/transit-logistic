import { setRequestLocale } from 'next-intl/server';

import { AdminRatingsContent } from '@/components/admin/admin-ratings-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminRatingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminRatingsContent />;
}
